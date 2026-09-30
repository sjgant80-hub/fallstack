import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { KINDS, CURRENCIES, VATS, days, checkEntry, checkRegistry, lookup, canon, pull, checkLock, exVat, toGbp, pricedObjects, agrees } from './prices.mjs';

const REG = JSON.parse(readFileSync(new URL('./registry/prices.json', import.meta.url), 'utf8'));
const ASOF = '2026-09-30';
const saas = { id: 'x-suite', kind: 'saas', product: 'X Suite', price: 80, currency: 'GBP', per: 'user / month', vat: 'excluded', quote: '£80 user/month', source: 'https://x.example/pricing', checked: '2026-09-30' };
const mini = (entries, maxAgeDays = 180) => ({ maxAgeDays, entries });

test('the vocabulary', () => {
  assert.deepEqual(KINDS, ['seat', 'saas', 'api', 'rate', 'fx', 'energy', 'power', 'salaries', 'rise']);
  assert.deepEqual(CURRENCIES, ['GBP', 'USD']);
  assert.deepEqual(VATS, ['excluded', 'included', 'not stated']);
});

test('the registry as committed: every entry sourced, dated, stated, unique and fresh', () => {
  const r = checkRegistry(REG, ASOF);
  assert.deepEqual(r, { ok: true, count: REG.entries.length, problems: [], stale: [] });
  assert.equal(REG.maxAgeDays, 180);
  for (const id of ['m365-copilot', 'salesforce-pro-suite', 'dynamics-365-finance', 'dynamics-365-human-resources', 'ons-cpi', 'uk-national-living-wage', 'uk-vat', 'fx-gbp-usd']) assert.ok(lookup(REG, id), id);
  assert.equal(lookup(REG, 'salesforce-pro-suite').price, 80);
  assert.equal(lookup(REG, 'dynamics-365-finance').price, 161.5);
});

test('days', () => {
  assert.equal(days('2026-09-29', '2026-09-30'), 1);
  assert.equal(days('2026-09-30', '2026-09-29'), -1);
  assert.equal(days('2026-01-01', '2026-12-31'), 364);
  assert.equal(days('x', '2026-09-30'), null);
  assert.equal(days('2026-09-30', undefined), null);
});

test('checkEntry: each kind must carry its stated figure, a source and a date', () => {
  assert.deepEqual(checkEntry(saas), []);
  assert.deepEqual(checkEntry({ ...saas, kind: 'seat' }), []);
  assert.deepEqual(checkEntry({ ...saas, price: 0 }), []);
  for (const price of [NaN, Infinity, -Infinity]) assert.deepEqual(checkEntry({ ...saas, price }), ['the list price']);
  assert.deepEqual(checkEntry(null), ['not an entry']);
  assert.deepEqual(checkEntry([]), ['not an entry']);
  assert.deepEqual(checkEntry({ ...saas, id: 'X Suite' }), ['an id (lower-case letters, digits, dots and dashes)']);
  assert.deepEqual(checkEntry({ ...saas, id: '' }), ['an id (lower-case letters, digits, dots and dashes)']);
  assert.deepEqual(checkEntry({ ...saas, id: '-x' }), ['an id (lower-case letters, digits, dots and dashes)']);
  assert.deepEqual(checkEntry({ ...saas, kind: 'fee' }), ['a kind (seat, saas, api, rate, fx, energy, power, salaries, rise)']);
  assert.deepEqual(checkEntry({ ...saas, source: 'http://x.example' }), ['an https source']);
  assert.deepEqual(checkEntry({ ...saas, checked: '30/09/2026' }), ['a checked date']);
  assert.deepEqual(checkEntry({ ...saas, product: '' }), ['the product']);
  assert.deepEqual(checkEntry({ ...saas, price: -1 }), ['the list price']);
  assert.deepEqual(checkEntry({ ...saas, price: '80' }), ['the list price']);
  assert.deepEqual(checkEntry({ ...saas, currency: 'EUR' }), ['the currency']);
  assert.deepEqual(checkEntry({ ...saas, per: '' }), ['what the price is per']);
  assert.deepEqual(checkEntry({ ...saas, vat: 'maybe' }), ['the VAT treatment']);
  assert.deepEqual(checkEntry({ ...saas, quote: '' }), ['the price as the vendor states it']);
  const api = { id: 'm', kind: 'api', provider: 'P', model: 'M', inPerM: 0, outPerM: 2, currency: 'USD', source: 'https://p.example', checked: ASOF };
  assert.deepEqual(checkEntry(api), []);
  assert.deepEqual(checkEntry({ ...api, inPerM: 1, outPerM: 0 }), []);
  assert.deepEqual(checkEntry({ ...api, model: '' }), ['the provider and model']);
  assert.deepEqual(checkEntry({ ...api, provider: 1 }), ['the provider and model']);
  for (const bad of [{ inPerM: -1 }, { outPerM: -0.5 }, { inPerM: '1' }, { outPerM: null }]) assert.deepEqual(checkEntry({ ...api, ...bad }), ['the prices per million tokens in and out']);
  assert.deepEqual(checkEntry({ ...api, currency: 'JPY' }), ['the currency']);
  const rate = { id: 'r', kind: 'rate', value: 0.031, quote: 'rose by 3.1%', source: 'https://o.example', checked: ASOF };
  assert.deepEqual(checkEntry(rate), []);
  assert.deepEqual(checkEntry({ ...rate, value: '3.1%' }), ['the value']);
  assert.deepEqual(checkEntry({ ...rate, quote: undefined }), ['what the figure is']);
  for (const k of ['what', 'how', 'why']) assert.deepEqual(checkEntry({ ...rate, quote: undefined, [k]: 'text' }), []);
  const fx = { id: 'f', kind: 'fx', gbpPerUsd: 0.75, how: 'ECB', source: 'https://e.example', checked: ASOF };
  assert.deepEqual(checkEntry(fx), []);
  assert.deepEqual(checkEntry({ ...fx, gbpPerUsd: 0 }), ['pounds per dollar']);
  assert.deepEqual(checkEntry({ ...fx, gbpPerUsd: 'x' }), ['pounds per dollar']);
  assert.deepEqual(checkEntry({ ...fx, how: '' }), ['how the rate was derived']);
  const en = { id: 'e', kind: 'energy', pencePerKwh: 24.51, what: 'DESNZ', source: 'https://d.example', checked: ASOF };
  assert.deepEqual(checkEntry(en), []);
  assert.deepEqual(checkEntry({ ...en, pencePerKwh: 0 }), ['pence per kWh']);
  assert.deepEqual(checkEntry({ ...en, pencePerKwh: null }), ['pence per kWh']);
  assert.deepEqual(checkEntry({ ...en, what: undefined }), ['what the figure is']);
  const pw = { id: 'p', kind: 'power', wattsLow: 15, wattsHigh: 55, source: 'https://i.example', checked: ASOF };
  assert.deepEqual(checkEntry(pw), []);
  assert.deepEqual(checkEntry({ ...pw, wattsHigh: 15 }), []);
  for (const bad of [{ wattsLow: 0 }, { wattsHigh: 14 }, { wattsLow: 'x' }, { wattsHigh: undefined }]) assert.deepEqual(checkEntry({ ...pw, ...bad }), ['the published power range']);
  const sal = { id: 's', kind: 'salaries', roles: { a: { median: 50000 } }, source: 'https://o.example', checked: ASOF };
  assert.deepEqual(checkEntry(sal), []);
  for (const roles of [{}, null, { a: { median: 0 } }, { a: { median: '1' } }, { a: 5 }, { a: { median: 1 }, b: {} }]) assert.deepEqual(checkEntry({ ...sal, roles }), ['the roles with their medians']);
  const rise = { id: 'u', kind: 'rise', low: 0.05, high: 0.33, what: 'M365 rose', quote: 'take effect', source: 'https://m.example', checked: ASOF };
  assert.deepEqual(checkEntry(rise), []);
  assert.deepEqual(checkEntry({ ...rise, high: 0.05 }), []);
  for (const bad of [{ low: 0 }, { high: 0.04 }, { low: 'x' }, { high: null }]) assert.deepEqual(checkEntry({ ...rise, ...bad }), ['the rise, low to high']);
  assert.deepEqual(checkEntry({ ...rise, quote: '' }), ['what rose, as the vendor states it']);
  assert.deepEqual(checkEntry({ ...rise, what: undefined }), ['what rose, as the vendor states it']);
});

test('checkRegistry: malformed, duplicate, future and stale entries are all named', () => {
  assert.deepEqual(checkRegistry(mini([saas]), ASOF), { ok: true, count: 1, problems: [], stale: [] });
  assert.deepEqual(checkRegistry(mini([saas, saas]), ASOF).problems, ['x-suite appears twice']);
  assert.deepEqual(checkRegistry(mini([{ ...saas, price: -1 }]), ASOF).problems, ['x-suite needs the list price']);
  assert.deepEqual(checkRegistry(mini([{ ...saas, id: 1, quote: '' }]), ASOF).problems, ['(no id) needs an id (lower-case letters, digits, dots and dashes), the price as the vendor states it']);
  assert.deepEqual(checkRegistry(mini([null]), ASOF).problems, ['(no id) needs not an entry']);
  assert.deepEqual(checkRegistry(mini([{ ...saas, checked: '2026-10-01' }]), ASOF).problems, ['x-suite is dated after 2026-09-30']);
  const edge = checkRegistry(mini([{ ...saas, checked: '2026-04-03' }]), ASOF);
  assert.deepEqual([edge.ok, days('2026-04-03', ASOF)], [true, 180]);
  const old = checkRegistry(mini([{ ...saas, checked: '2026-04-02' }]), ASOF);
  assert.deepEqual(old, { ok: false, count: 1, problems: ['x-suite was checked 181 days ago (limit 180) — re-check it at its source'], stale: ['x-suite'] });
  assert.deepEqual(checkRegistry(mini([{ ...saas, checked: '2026-09-20' }], 10), ASOF).ok, true);
  assert.deepEqual(checkRegistry(mini([{ ...saas, checked: '2026-09-19' }], 10), ASOF).stale, ['x-suite']);
  for (const [reg, re] of [[null, /a registry with entries/], [{ entries: {} }, /a registry with entries/], [{ entries: [] }, /maxAgeDays/], [{ entries: [], maxAgeDays: 0 }, /maxAgeDays/], [{ entries: [], maxAgeDays: '9' }, /maxAgeDays/]]) assert.match(checkRegistry(reg, ASOF).why, re);
  assert.match(checkRegistry(mini([]), '30-09-2026').why, /asOf must be a date/);
});

test('lookup and canon', () => {
  assert.equal(lookup(mini([saas]), 'x-suite'), saas);
  assert.equal(lookup(mini([null, saas]), 'x-suite'), saas);
  assert.equal(lookup(mini([saas]), 'y'), null);
  assert.equal(lookup(null, 'x-suite'), null);
  assert.equal(lookup({ entries: {} }, 'x-suite'), null);
  assert.equal(lookup(mini([saas]), ''), null);
  assert.equal(canon({ b: 1, a: [2, { d: undefined, c: 'x' }] }), '{"a":[2,{"c":"x","d":null}],"b":1}');
  assert.equal(canon({ a: 1, b: 2 }), canon({ b: 2, a: 1 }));
  assert.notEqual(canon({ a: 1 }), canon({ a: '1' }));
});

test('pull and checkLock: the lock must say exactly what the registry says, and nothing stale', () => {
  const reg = mini([saas, { ...saas, id: 'y-suite', price: 10 }]);
  const p = pull(reg, ['x-suite', 'y-suite', 'x-suite']);
  assert.deepEqual(p, { ok: true, lock: { registry: 'sjgant80-hub/fallstack', entries: [saas, { ...saas, id: 'y-suite', price: 10 }] } });
  assert.notEqual(p.lock.entries[0], saas);   // a copy, never the registry's own object
  assert.match(pull(reg, ['z']).why, /no entry z/);
  assert.match(pull(reg, []).why, /the ids the build uses/);
  assert.match(pull(reg, 'x-suite').why, /the ids the build uses/);
  assert.deepEqual(checkLock(p.lock, reg, ASOF), { ok: true, problems: [], locked: 2 });
  const edited = { entries: [{ ...saas, price: 79 }] };
  assert.deepEqual(checkLock(edited, reg, ASOF).problems, ['x-suite differs from the registry — pull it again']);
  assert.deepEqual(checkLock({ entries: [{ ...saas, id: 'z' }] }, reg, ASOF).problems, ['z is not in the registry — a price the registry does not hold is a typed price']);
  assert.deepEqual(checkLock({ entries: [saas, saas] }, reg, ASOF).problems, ['x-suite is locked twice']);
  assert.deepEqual(checkLock({ entries: [{ price: 1 }] }, reg, ASOF).problems, ['a locked entry without an id']);
  const staleReg = mini([{ ...saas, checked: '2026-01-01' }]);
  assert.deepEqual(checkLock({ entries: [{ ...saas, checked: '2026-01-01' }] }, staleReg, ASOF).problems, ['x-suite is stale in the registry (checked 2026-01-01) — re-check it at its source, then pull']);
  assert.equal(checkLock({ entries: [{ ...saas, id: 'y-suite', price: 10 }] }, mini([saas, { ...saas, id: 'y-suite', price: 10 }, { ...saas, id: 'old', checked: '2026-01-01' }]), ASOF).ok, true);   // a stale entry the build does not use is not the build's problem
  for (const lock of [null, {}, { entries: [] }, { entries: {} }]) assert.match(checkLock(lock, reg, ASOF).why, /a lock with entries/);
  assert.match(checkLock(p.lock, null, ASOF).why, /a registry with entries/);
});

test('exVat and toGbp', () => {
  assert.equal(exVat(120, 'included', 0.2), 100);
  assert.equal(exVat(100, 'excluded', 0.2), 100);
  assert.equal(exVat(100, 'not stated', 0.2), 100);
  assert.equal(exVat(100, 'included', 0), 100);
  for (const args of [['1', 'excluded', 0.2], [100, 'maybe', 0.2], [100, 'included', -0.1], [100, 'included', '0.2']]) assert.equal(exVat(...args), null);
  assert.equal(toGbp(10, 'GBP', 0.75), 10);
  assert.equal(toGbp(10, 'USD', 0.75), 7.5);
  for (const args of [[10, 'EUR', 0.75], ['10', 'GBP', 0.75], [10, 'USD', 0], [10, 'USD', -1], [10, 'GBP', null]]) assert.equal(toGbp(...args), null);
});

test('pricedObjects and agrees: every stated price is found, and a labelled price must match its entry', () => {
  const data = { seats: [{ price: 23.1, currency: 'GBP' }, { registry: 'x-suite', price: 80, currency: 'GBP' }], api: [{ id: 'm', kind: 'api', inPerM: 1, outPerM: 2, currency: 'USD' }], other: { amount: 5, currency: 'USD' }, fine: { price: 3 }, eur: { price: 3, currency: 'EUR' }, text: 'GBP 5', bad: { outPerM: 'x', currency: 'USD' } };
  const found = pricedObjects(data, 'f.json');
  assert.deepEqual(found.map((o) => [o.path, o.id, o.entry]), [['f.json.seats[0]', null, false], ['f.json.seats[1]', 'x-suite', false], ['f.json.api[0]', 'm', true], ['f.json.other', null, false]]);
  assert.equal(found[1].value, data.seats[1]);
  assert.deepEqual(pricedObjects({ id: 'z', kind: 'fee', price: 1, currency: 'GBP' }).map((o) => [o.path, o.id, o.entry]), [['$', null, false]]);
  assert.deepEqual(pricedObjects({ registry: 'z', id: 'q', kind: 'saas', price: 1, currency: 'GBP' })[0].id, 'z');
  assert.deepEqual(pricedObjects({ nested: { deeper: [{ inPerM: 0, currency: 'GBP' }] } }).map((o) => o.path), ['$.nested.deeper[0]']);
  assert.deepEqual(pricedObjects(null), []);
  assert.deepEqual(pricedObjects('x'), []);
  assert.deepEqual(agrees({ registry: 'x-suite', price: 80, product: 'X Suite', extra: 1 }, saas), []);
  assert.deepEqual(agrees({ registry: 'x-suite', price: 79, currency: 'GBP' }, saas), ['price']);
  assert.deepEqual(agrees({ price: 80, checked: '2026-01-01' }, saas), ['checked']);
  assert.deepEqual(agrees(null, saas), ['not an object']);
  assert.deepEqual(agrees({}, undefined), ['not an object']);
});

test('fuzz: garbage in, a refusal or an empty answer out — never a throw', () => {
  const junk = [undefined, null, 0, NaN, '', 'x', [], {}, [null], { entries: [null, 1, 'x'] }, { maxAgeDays: 9, entries: [{}] }, () => 1];
  for (const a of junk) for (const b of junk) assert.doesNotThrow(() => { days(a, b); checkEntry(a); checkRegistry(a, b); checkRegistry(a, ASOF); lookup(a, b); canon(a); pull(a, b); checkLock(a, b, ASOF); checkLock(a, REG, b); exVat(a, b, a); toGbp(a, b, a); pricedObjects(a, b); agrees(a, b); });
});
