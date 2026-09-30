// fallstack · stack.mjs — the SaaS a company rents, against the estate organ that replaces it, and how finished that
// organ really is. A replacement is claimed only where an organ covers the function (registry/organs.json names what
// it covers and what it does not), and its maturity is the ladder's verdict from what GitHub's runners did (tier.mjs,
// vendored verbatim from fallworld) — never a label anyone typed.
//
// PURE and TOTAL: no I/O, no clock, no throw on garbage.
import { tierOf } from './tier.mjs';
import { lookup, exVat, toGbp } from './prices.mjs';

const isStr = (v) => typeof v === 'string' && v.length > 0;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const fail = (why) => ({ ok: false, why });
const strList = (v) => Array.isArray(v) && v.every(isStr);

/** checkOrgans(map) — every function says what it is; a replaced function names its organ, what the organ covers,
 *  what it does not, and whether it carries a route that sends data out (byok); a kept one says why. */
export function checkOrgans(map) {
  if (!isObj(map) || !Array.isArray(map.functions) || map.functions.length === 0) return fail('an organ map with functions');
  const problems = [], seen = new Set();
  for (const f of map.functions) {
    const fn = isObj(f) && isStr(f.fn) ? f.fn : null;
    if (!fn) { problems.push('a function without its id (fn)'); continue; }
    if (seen.has(fn)) problems.push(fn + ' appears twice');
    seen.add(fn);
    if (!isStr(f.label)) problems.push(fn + ' needs a label');
    if (f.organ === null) { if (!isStr(f.why)) problems.push(fn + ' is kept: say why no organ replaces it'); continue; }
    if (!isStr(f.organ)) problems.push(fn + ' needs an organ, or organ: null with why');
    if (!strList(f.covers) || f.covers.length === 0) problems.push(fn + ' needs what the organ covers');
    if (!strList(f.gaps)) problems.push(fn + ' needs what the organ does not cover (gaps: [] if none)');
    if (f.byok !== true && f.byok !== false) problems.push(fn + ' must say whether the organ carries a bring-your-own-key cloud route (byok)');
  }
  return { ok: problems.length === 0, problems, functions: seen.size };
}

/** replacement(fn, map, evidence) — the organ that replaces a function, and its rung on the ladder from GitHub's own
 *  record (evidence: { organ: [workflow records] }). A function with no organ is kept, with the reason. */
export function replacement(fn, map, evidence) {
  if (!isObj(map) || !Array.isArray(map.functions)) return fail('an organ map');
  const f = map.functions.find((x) => isObj(x) && x.fn === fn);
  if (!f) return fail('the organ map has no function ' + String(fn));
  if (!isStr(f.organ)) return { ok: true, fn, replaced: false, why: isStr(f.why) ? f.why : '' };
  const records = isObj(evidence) && Array.isArray(evidence[f.organ]) ? evidence[f.organ] : [];
  const t = tierOf(records, { live: true });
  const gated = records.filter((r) => isObj(r) && r.mutation === true && r.conclusion === 'success').flatMap((r) => (strList(r.mutates) ? r.mutates : []));
  return {
    ok: true, fn, replaced: true, organ: f.organ, label: f.label, tier: t.tier, tierWhy: t.why, workflow: t.workflow, sha: t.sha,
    gated: [...new Set(gated)], covers: f.covers, gaps: f.gaps, byok: f.byok,
  };
}

/** audit(stack, reg, map, evidence) — a company's rented stack, line by line: what each subscription costs a year (ex
 *  VAT, in pounds, from the registry's list price), and the organ that replaces it with its ladder rung.
 *  stack: [{ fn, rent: registry id, users }]; reg: the price registry (needs uk-vat and fx-gbp-usd). */
export function audit(stack, reg, map, evidence) {
  if (!Array.isArray(stack) || stack.length === 0) return fail('the rented stack: [{ fn, rent, users }]');
  const vat = lookup(reg, 'uk-vat'), fx = lookup(reg, 'fx-gbp-usd');
  if (!vat || !isNum(vat.value) || !fx || !isNum(fx.gbpPerUsd)) return fail('the registry needs uk-vat and fx-gbp-usd');
  const lines = [];
  for (const s of stack) {
    if (!isObj(s) || !isStr(s.fn) || !isStr(s.rent)) return fail('each stack line needs fn and rent');
    if (!Number.isInteger(s.users) || s.users < 0) return fail(s.fn + ': users must be a whole number');
    const e = lookup(reg, s.rent);
    if (!e || (e.kind !== 'saas' && e.kind !== 'seat')) return fail(s.fn + ': the registry has no subscription ' + s.rent);
    const monthly = toGbp(exVat(e.price, e.vat, vat.value), e.currency, fx.gbpPerUsd);
    if (monthly === null) return fail(s.fn + ': ' + s.rent + ' cannot be priced in pounds');
    const r = replacement(s.fn, map, evidence);
    if (!r.ok) return r;
    lines.push({ fn: s.fn, rent: s.rent, product: e.product, users: s.users, perUserMonth: Math.round(monthly * 100) / 100, perYear: Math.round(monthly * s.users * 12 * 100) / 100, source: e.source, checked: e.checked, replacement: r });
  }
  const sum = (f) => Math.round(lines.filter(f).reduce((a, l) => a + l.perYear, 0) * 100) / 100;
  return {
    ok: true, lines,
    rentPerYear: sum(() => true),
    replaceablePerYear: sum((l) => l.replacement.replaced),
    provenPerYear: sum((l) => l.replacement.replaced && l.replacement.tier === 'proven'),
    keptPerYear: sum((l) => !l.replacement.replaced),
  };
}
