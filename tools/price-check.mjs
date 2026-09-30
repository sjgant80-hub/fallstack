#!/usr/bin/env node
// tools/price-check.mjs — the price half of konomify's basis gate, and the way a build takes its prices.
//
//   node tools/price-check.mjs pull <repo> <id> [<id> …]   write <repo>/prices.lock.json from the registry
//   node tools/price-check.mjs <repo>                      exit 1 unless every price the build states is current
//
// Current means: every entry in the build's prices.lock.json is exactly what the registry holds today and is not
// stale, and every object in the build's JSON data that states a price in a currency names a locked entry (its
// "registry" field, or it is a locked entry itself). A price typed anywhere else fails.
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = fileURLToPath(new URL('..', import.meta.url));
const P = await import(pathToFileURL(join(HERE, 'prices.mjs')).href);
export const REGISTRY_PATH = join(HERE, 'registry', 'prices.json');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
// the latest calendar date anywhere on Earth (UTC+14): an entry checked today in any time zone is never 'in the future'
const latest = () => new Date(Date.now() + 14 * 3600000).toISOString().slice(0, 10);
const SKIP = new Set(['.git', 'node_modules', 'konomi-out', '.claude']);

export function loadRegistry() { return readJson(REGISTRY_PATH); }

function jsonFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (SKIP.has(name)) continue;
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (name.endsWith('.json') && name !== 'prices.lock.json' && name !== 'package.json' && name !== 'package-lock.json') out.push(p);
    }
  };
  walk(root);
  return out;
}

/** checkBuild(repo, asOf) — { ok, problems, locked, priced } for one build. */
export function checkBuild(repo, asOf = latest()) {
  const reg = loadRegistry();
  const problems = [];
  const lockPath = join(repo, 'prices.lock.json');
  let lock = null;
  if (existsSync(lockPath)) {
    try { lock = readJson(lockPath); } catch (e) { return { ok: false, problems: ['prices.lock.json does not parse: ' + e.message] }; }
    const r = P.checkLock(lock, reg, asOf);
    if (r.why) problems.push(r.why);
    else problems.push(...r.problems);
  }
  const lockedIds = new Map(lock && Array.isArray(lock.entries) ? lock.entries.filter((e) => e && typeof e.id === 'string').map((e) => [e.id, e]) : []);
  const own = resolve(repo) === resolve(HERE);   // the registry repository does not check its own registry against a lock
  let priced = 0;
  for (const f of jsonFiles(repo)) {
    const rel = relative(repo, f).replace(/\\/g, '/');
    if (own && rel.startsWith('registry/')) continue;
    let data;
    try { data = readJson(f); } catch { continue; }   // not JSON data (a fixture with comments, say): nothing to read
    for (const o of P.pricedObjects(data, rel)) {
      priced++;
      if (o.id === null) problems.push(o.path + ' states a price with no registry entry — pull it from the registry (fallstack) instead of typing it');
      else if (!lockedIds.has(o.id)) problems.push(o.path + ' names ' + o.id + ', which prices.lock.json does not lock');
      else { const off = P.agrees(o.value, lockedIds.get(o.id)); if (off.length) problems.push(o.path + ' says something other than registry entry ' + o.id + ' (' + off.join(', ') + ') — pull it, never retype it'); }
    }
  }
  return { ok: problems.length === 0, problems, locked: lockedIds.size, priced };
}

/** pullInto(repo, ids) — write the build's lock from the registry. */
export function pullInto(repo, ids) {
  const r = P.pull(loadRegistry(), ids);
  if (!r.ok) return r;
  writeFileSync(join(repo, 'prices.lock.json'), JSON.stringify({ ...r.lock, pulled: today() }, null, 1) + '\n');
  return { ok: true, count: r.lock.entries.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [a, b, ...rest] = process.argv.slice(2);
  if (a === 'pull') {
    if (!b || !rest.length) { console.error('usage: price-check.mjs pull <repo> <id> [<id> …]'); process.exit(2); }
    const r = pullInto(b, rest);
    if (!r.ok) { console.error('NOT PULLED: ' + r.why); process.exit(1); }
    console.log('wrote prices.lock.json — ' + r.count + ' registry entries');
  } else {
    if (!a) { console.error('usage: price-check.mjs <repo>  |  price-check.mjs pull <repo> <id> …'); process.exit(2); }
    const r = checkBuild(a);
    if (!r.ok) { console.error('PRICES FAIL:\n  ' + r.problems.join('\n  ')); process.exit(1); }
    console.log('prices current — ' + r.locked + ' registry entries locked, ' + r.priced + ' priced objects in the data, every one sourced');
  }
}
