// fallstack · prices.mjs — the estate's one registry of vendor list prices and public rates, and the gate that keeps
// every build honest to it. A build never types a price: it pulls registry entries into its prices.lock.json, and
// konomify's basis gate fails the build when a locked entry differs from the registry, is missing from it, or is
// older than the registry allows. A price with no source, no date or no stated figure never enters the registry.
//
// PURE and TOTAL: no I/O, no clock (the caller passes asOf), no throw on garbage.

const isStr = (v) => typeof v === 'string' && v.length > 0;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const fail = (why) => ({ ok: false, why });
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const HTTPS = /^https:\/\/\S+$/;
const ID = /^[a-z0-9][a-z0-9.-]*$/;

export const KINDS = ['seat', 'saas', 'api', 'rate', 'fx', 'energy', 'power', 'salaries', 'rise'];
export const CURRENCIES = ['GBP', 'USD'];
export const VATS = ['excluded', 'included', 'not stated'];

/** days(a, b) — whole calendar days from a to b (both YYYY-MM-DD); null if either is not a date. */
export function days(a, b) {
  if (!DATE.test(a || '') || !DATE.test(b || '')) return null;
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
}

/** checkEntry(e) — what is wrong with one registry entry ([] when nothing is). Every entry names its kind, links the
 *  page its figure came from (https) and the date it was checked; each kind must carry its stated figure. */
export function checkEntry(e) {
  if (!isObj(e)) return ['not an entry'];
  const p = [];
  const id = isStr(e.id) && ID.test(e.id) ? e.id : null;
  if (!id) p.push('an id (lower-case letters, digits, dots and dashes)');
  if (!KINDS.includes(e.kind)) p.push('a kind (' + KINDS.join(', ') + ')');
  if (!HTTPS.test(e.source || '')) p.push('an https source');
  if (!DATE.test(e.checked || '')) p.push('a checked date');
  const says = isStr(e.quote) || isStr(e.what) || isStr(e.how) || isStr(e.why);
  if (e.kind === 'seat' || e.kind === 'saas') {
    if (!isStr(e.product)) p.push('the product');
    if (!isNum(e.price) || e.price < 0) p.push('the list price');
    if (!CURRENCIES.includes(e.currency)) p.push('the currency');
    if (!isStr(e.per)) p.push('what the price is per');
    if (!VATS.includes(e.vat)) p.push('the VAT treatment');
    if (!isStr(e.quote)) p.push('the price as the vendor states it');
  } else if (e.kind === 'api') {
    if (!isStr(e.provider) || !isStr(e.model)) p.push('the provider and model');
    if (!isNum(e.inPerM) || !isNum(e.outPerM) || e.inPerM < 0 || e.outPerM < 0) p.push('the prices per million tokens in and out');
    if (!CURRENCIES.includes(e.currency)) p.push('the currency');
  } else if (e.kind === 'rate') {
    if (!isNum(e.value)) p.push('the value');
    if (!says) p.push('what the figure is');
  } else if (e.kind === 'fx') {
    if (!isNum(e.gbpPerUsd) || e.gbpPerUsd <= 0) p.push('pounds per dollar');
    if (!isStr(e.how)) p.push('how the rate was derived');
  } else if (e.kind === 'energy') {
    if (!isNum(e.pencePerKwh) || e.pencePerKwh <= 0) p.push('pence per kWh');
    if (!says) p.push('what the figure is');
  } else if (e.kind === 'power') {
    if (!isNum(e.wattsLow) || !isNum(e.wattsHigh) || e.wattsLow <= 0 || e.wattsHigh < e.wattsLow) p.push('the published power range');
  } else if (e.kind === 'salaries') {
    const roles = isObj(e.roles) ? Object.values(e.roles) : [];
    if (roles.length === 0 || roles.some((r) => !isObj(r) || !isNum(r.median) || r.median <= 0)) p.push('the roles with their medians');
  } else if (e.kind === 'rise') {
    if (!isNum(e.low) || !isNum(e.high) || e.low <= 0 || e.high < e.low) p.push('the rise, low to high');
    if (!isStr(e.quote) || !isStr(e.what)) p.push('what rose, as the vendor states it');
  }
  return p;
}

/** checkRegistry(reg, asOf) — the whole registry: every entry well formed, ids unique, nothing older than
 *  reg.maxAgeDays or dated after asOf. */
export function checkRegistry(reg, asOf) {
  if (!isObj(reg) || !Array.isArray(reg.entries)) return fail('a registry with entries');
  if (!isNum(reg.maxAgeDays) || reg.maxAgeDays <= 0) return fail('the registry must say how old an entry may be (maxAgeDays)');
  if (!DATE.test(asOf || '')) return fail('asOf must be a date');
  const problems = [], stale = [], seen = new Set();
  for (const e of reg.entries) {
    const bad = checkEntry(e);
    const name = isObj(e) && isStr(e.id) ? e.id : '(no id)';
    if (bad.length) { problems.push(name + ' needs ' + bad.join(', ')); continue; }
    if (seen.has(e.id)) problems.push(e.id + ' appears twice');
    seen.add(e.id);
    const age = days(e.checked, asOf);
    if (age < 0) problems.push(e.id + ' is dated after ' + asOf);
    else if (age > reg.maxAgeDays) { stale.push(e.id); problems.push(e.id + ' was checked ' + age + ' days ago (limit ' + reg.maxAgeDays + ') — re-check it at its source'); }
  }
  return { ok: problems.length === 0, count: reg.entries.length, problems, stale };
}

/** lookup(reg, id) — one entry, or null. */
export function lookup(reg, id) {
  if (!isObj(reg) || !Array.isArray(reg.entries) || !isStr(id)) return null;
  return reg.entries.find((e) => isObj(e) && e.id === id) || null;
}

// Canonical JSON: keys sorted at every level, so two entries compare by content, not by key order.
export function canon(v) {
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (isObj(v)) return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v);
}

/** pull(reg, ids) — the lock a build commits: exact copies of the registry entries it uses. */
export function pull(reg, ids) {
  if (!Array.isArray(ids) || ids.length === 0) return fail('the ids the build uses');
  const entries = [];
  for (const id of ids) {
    const e = lookup(reg, id);
    if (!e) return fail('the registry has no entry ' + String(id));
    if (!entries.some((x) => x.id === e.id)) entries.push(JSON.parse(JSON.stringify(e)));
  }
  return { ok: true, lock: { registry: 'sjgant80-hub/fallstack', entries } };
}

/** checkLock(lock, reg, asOf) — does the build's lock still say exactly what the registry says, and is every entry
 *  it leans on fresh? */
export function checkLock(lock, reg, asOf) {
  if (!isObj(lock) || !Array.isArray(lock.entries) || lock.entries.length === 0) return fail('a lock with entries (prices.lock.json)');
  const r = checkRegistry(reg, asOf);
  if (!r.ok && r.why) return r;
  const problems = [], seen = new Set();
  for (const e of lock.entries) {
    const id = isObj(e) && isStr(e.id) ? e.id : null;
    if (!id) { problems.push('a locked entry without an id'); continue; }
    if (seen.has(id)) problems.push(id + ' is locked twice');
    seen.add(id);
    const truth = lookup(reg, id);
    if (!truth) { problems.push(id + ' is not in the registry — a price the registry does not hold is a typed price'); continue; }
    if (canon(e) !== canon(truth)) problems.push(id + ' differs from the registry — pull it again');
    if (r.stale.includes(id)) problems.push(id + ' is stale in the registry (checked ' + truth.checked + ') — re-check it at its source, then pull');
  }
  return { ok: problems.length === 0, problems, locked: seen.size };
}

/** exVat(amount, vat, rate) — a price net of VAT. 'excluded' and 'not stated' are taken as net (a vendor that does
 *  not state VAT is quoting its list price); 'included' is divided out. */
export function exVat(amount, vat, rate) {
  if (!isNum(amount) || !VATS.includes(vat) || !isNum(rate) || rate < 0) return null;
  return vat === 'included' ? amount / (1 + rate) : amount;
}

/** toGbp(amount, currency, gbpPerUsd) — pounds. */
export function toGbp(amount, currency, gbpPerUsd) {
  if (!isNum(amount) || !isNum(gbpPerUsd) || gbpPerUsd <= 0) return null;
  if (currency === 'GBP') return amount;
  if (currency === 'USD') return amount * gbpPerUsd;
  return null;
}

/** pricedObjects(value, path) — every object in a build's data that states a price in a currency, with the registry
 *  entry it claims to come from: { path, id, entry, value }. id is the object's "registry" field, or its own id when the
 *  object is a registry-shaped entry (entry: true); null means a typed price. The build gate checks each against the
 *  build's lock. */
export function pricedObjects(value, path) {
  const out = [];
  const walk = (v, p) => {
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, p + '[' + i + ']')); return; }
    if (!isObj(v)) return;
    if (CURRENCIES.includes(v.currency) && ['price', 'inPerM', 'outPerM', 'amount'].some((k) => isNum(v[k]))) {
      const entry = isStr(v.id) && KINDS.includes(v.kind);
      out.push({ path: p, id: isStr(v.registry) ? v.registry : entry ? v.id : null, entry, value: v });
    }
    for (const k of Object.keys(v)) walk(v[k], p + '.' + k);
  };
  walk(value, isStr(path) ? path : '$');
  return out;
}

/** agrees(value, entry) — the fields an object shares with its registry entry (all but "registry") are equal: a
 *  price that names an entry but states a different figure is a typed price wearing a label. */
export function agrees(value, entry) {
  if (!isObj(value) || !isObj(entry)) return ['not an object'];
  return Object.keys(value).filter((k) => k !== 'registry' && k in entry && canon(value[k]) !== canon(entry[k]));
}
