#!/usr/bin/env node
// tools/tiers.mjs — read, from GitHub's own record, what each replacement organ's workflows did on GitHub's runners,
// and write registry/tier-evidence.json. The ladder (tier.mjs) turns these records into Prototype / Works / Proven.
// For every workflow on the organ's default branch: its latest run's conclusion, whether the workflow file runs a
// mutation gate (witness / mutate), whether it pins its checker, and which files the gate mutates.
//   node tools/tiers.mjs            (needs the gh CLI, authenticated)
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const at = (f) => new URL('../' + f, import.meta.url);
const gh = (path) => JSON.parse(execFileSync('gh', ['api', path], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
const ORG = 'sjgant80-hub';
const map = JSON.parse(readFileSync(at('registry/organs.json'), 'utf8'));
const organs = [...new Set(map.functions.map((f) => f.organ).filter((o) => typeof o === 'string'))];
const d = new Date(), scanned = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const out = { scanned, how: 'GitHub Actions API: each workflow on the default branch, its latest run there, and the workflow file itself. The Pages deploy is recorded but the ladder never counts it as a test.', organs: {} };
for (const o of organs) {
  const repo = gh(`repos/${ORG}/${o}`);
  const flows = gh(`repos/${ORG}/${o}/actions/workflows`).workflows || [];
  const records = [];
  for (const w of flows) {
    const runs = gh(`repos/${ORG}/${o}/actions/workflows/${w.id}/runs?per_page=1&branch=${repo.default_branch}`).workflow_runs || [];
    let text = '';
    if (w.path.startsWith('.github/')) {
      try { text = Buffer.from(gh(`repos/${ORG}/${o}/contents/${w.path}?ref=${repo.default_branch}`).content, 'base64').toString('utf8'); } catch { text = ''; }
    }
    records.push({
      name: w.name, conclusion: runs[0] ? runs[0].conclusion : null, mutation: /witness|mutat/i.test(text),
      pinned: /witness@v?\d|--branch v\d|witness\.git.*v\d/i.test(text), sha: runs[0] ? runs[0].head_sha.slice(0, 7) : null,
      at: runs[0] ? runs[0].updated_at.slice(0, 10) : null, mutates: [...new Set([...text.matchAll(/mutate\s+([\w./-]+\.mjs)/g)].map((m) => m[1]))],
    });
  }
  out.organs[o] = records;
  console.log(o + ': ' + records.map((r) => r.name + ' ' + r.conclusion + (r.mutation ? ' (mutation gate' + (r.mutates.length ? ': ' + r.mutates.join(', ') : '') + ')' : '')).join(' · '));
}
writeFileSync(at('registry/tier-evidence.json'), JSON.stringify(out, null, 1) + '\n');
console.log('wrote registry/tier-evidence.json (' + organs.length + ' organs, scanned ' + scanned + ')');
