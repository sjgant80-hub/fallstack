import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkOrgans, replacement, audit } from './stack.mjs';

const J = (f) => JSON.parse(readFileSync(new URL('./' + f, import.meta.url), 'utf8'));
const REG = J('registry/prices.json'), MAP = J('registry/organs.json'), EV = J('registry/tier-evidence.json').organs;
const gate = (o) => ({ name: 'gate', conclusion: 'success', mutation: true, pinned: true, sha: 'abc1234', at: '2026-09-30', mutates: ['k.mjs'], ...o });
const map1 = { functions: [{ fn: 'crm', label: 'CRM', organ: 'o', covers: ['a'], gaps: [], byok: false }, { fn: 'desk', label: 'Desk', organ: null, why: 'none yet' }] };
const BANK = [{ fn: 'crm', rent: 'salesforce-pro-suite', users: 100 }, { fn: 'finance', rent: 'dynamics-365-finance', users: 20 }, { fn: 'hr', rent: 'dynamics-365-human-resources', users: 12 }];

test('the organ map as committed: every function stated, every replacement with its cover and gaps', () => {
  assert.deepEqual(checkOrgans(MAP), { ok: true, problems: [], functions: 6 });
  assert.deepEqual(MAP.functions.filter((f) => f.organ).map((f) => [f.fn, f.organ]), [['crm', 'fallforce'], ['finance', 'fallledger'], ['hr', 'fallhr']]);
  assert.deepEqual(MAP.functions.filter((f) => !f.organ).map((f) => f.fn), ['helpdesk', 'esign', 'payroll']);
});

test('checkOrgans: what a map must say', () => {
  assert.deepEqual(checkOrgans(map1), { ok: true, problems: [], functions: 2 });
  const f0 = map1.functions[0];
  const bad = (o) => checkOrgans({ functions: [{ ...f0, ...o }] }).problems;
  assert.deepEqual(bad({ label: '' }), ['crm needs a label']);
  assert.deepEqual(bad({ organ: '' }), ['crm needs an organ, or organ: null with why']);
  assert.deepEqual(bad({ organ: undefined }), ['crm needs an organ, or organ: null with why']);
  assert.deepEqual(bad({ covers: [] }), ['crm needs what the organ covers']);
  assert.deepEqual(bad({ covers: ['a', 1] }), ['crm needs what the organ covers']);
  assert.deepEqual(bad({ covers: 'a' }), ['crm needs what the organ covers']);
  assert.deepEqual(bad({ gaps: undefined }), ['crm needs what the organ does not cover (gaps: [] if none)']);
  assert.deepEqual(bad({ gaps: [''] }), ['crm needs what the organ does not cover (gaps: [] if none)']);
  assert.deepEqual(bad({ byok: 'no' }), ['crm must say whether the organ carries a bring-your-own-key cloud route (byok)']);
  assert.deepEqual(bad({ byok: true }), []);
  assert.deepEqual(checkOrgans({ functions: [{ fn: 'x', label: 'X', organ: null }] }).problems, ['x is kept: say why no organ replaces it']);
  assert.deepEqual(checkOrgans({ functions: [f0, f0] }).problems, ['crm appears twice']);
  assert.deepEqual(checkOrgans({ functions: [{ label: 'x' }, null] }).problems, ['a function without its id (fn)', 'a function without its id (fn)']);
  for (const m of [null, {}, { functions: [] }, { functions: {} }]) assert.match(checkOrgans(m).why, /an organ map with functions/);
});

test('replacement: the organ and its rung, read from what GitHub ran', () => {
  const proven = replacement('crm', map1, { o: [gate({}), gate({ name: 'pages build and deployment', mutation: false, mutates: [] })] });
  assert.deepEqual(proven, { ok: true, fn: 'crm', replaced: true, organ: 'o', label: 'CRM', tier: 'proven', tierWhy: 'a mutation gate ran on GitHub\'s hardware and every mutant died, against a pinned checker', workflow: 'gate', sha: 'abc1234', gated: ['k.mjs'], covers: ['a'], gaps: [], byok: false });
  assert.equal(replacement('crm', map1, { o: [gate({ mutation: false })] }).tier, 'works');
  assert.deepEqual(replacement('crm', map1, { o: [gate({ mutation: false })] }).gated, []);
  assert.equal(replacement('crm', map1, { o: [gate({ conclusion: 'failure' })] }).tier, 'prototype');
  assert.deepEqual(replacement('crm', map1, { o: [gate({ conclusion: 'failure' })] }).gated, []);
  assert.equal(replacement('crm', map1, {}).tier, 'prototype');
  assert.equal(replacement('crm', map1, null).tier, 'prototype');
  assert.equal(replacement('crm', map1, { o: 'x' }).tier, 'prototype');
  assert.deepEqual(replacement('crm', map1, { o: [gate({ mutates: 'k.mjs' }), gate({ mutates: ['k.mjs', 'j.mjs'] }), null] }).gated, ['k.mjs', 'j.mjs']);
  assert.deepEqual(replacement('desk', map1, {}), { ok: true, fn: 'desk', replaced: false, why: 'none yet' });
  assert.deepEqual(replacement('x', { functions: [{ fn: 'x', organ: null }] }, {}), { ok: true, fn: 'x', replaced: false, why: '' });
  assert.match(replacement('nope', map1, {}).why, /no function nope/);
  assert.match(replacement('crm', null, {}).why, /an organ map/);
  assert.match(replacement('crm', { functions: 'x' }, {}).why, /an organ map/);
  assert.match(replacement('crm', { functions: [null] }, {}).why, /no function crm/);
  // the committed evidence: all three organs Proven, and the page says exactly which files the gate mutates
  for (const [fn, gated] of [['crm', ['forecast.mjs', 'catalogue.mjs']], ['finance', ['ledger.mjs']], ['hr', ['audit-chain.mjs', 'audit.mjs']]]) {
    const r = replacement(fn, MAP, EV);
    assert.deepEqual([r.tier, r.byok], ['proven', true], fn);
    assert.deepEqual([...r.gated].sort(), [...gated].sort(), fn);
  }
});

test('audit: the modelled bank\'s rented back office, priced from the registry', () => {
  const a = audit(BANK, REG, MAP, EV);
  assert.equal(a.ok, true);
  assert.deepEqual(a.lines.map((l) => [l.fn, l.product, l.users, l.perUserMonth, l.perYear, l.replacement.organ, l.replacement.tier]), [
    ['crm', 'Salesforce Pro Suite', 100, 80, 96000, 'fallforce', 'proven'],
    ['finance', 'Dynamics 365 Finance', 20, 161.5, 38760, 'fallledger', 'proven'],
    ['hr', 'Dynamics 365 Human Resources', 12, 103.8, 14947.2, 'fallhr', 'proven'],
  ]);
  assert.deepEqual([a.rentPerYear, a.replaceablePerYear, a.provenPerYear, a.keptPerYear], [149707.2, 149707.2, 149707.2, 0]);
  assert.equal(a.lines[0].source, 'https://www.salesforce.com/uk/sales/pricing/');
  // a kept function, a works-rung organ, a seat priced in dollars with VAT included
  const reg = { maxAgeDays: 180, entries: [...REG.entries, { id: 'usd-seat', kind: 'seat', product: 'U', price: 12, currency: 'USD', per: 'm', vat: 'included', quote: 'q', source: 'https://u.example', checked: '2026-09-30' }] };
  const mixed = audit([{ fn: 'crm', rent: 'usd-seat', users: 10 }, { fn: 'desk', rent: 'salesforce-pro-suite', users: 1 }], reg, map1, { o: [gate({ mutation: false })] });
  assert.deepEqual(mixed.lines.map((l) => [l.perUserMonth, l.perYear, l.replacement.replaced]), [[7.54, 904.75, true], [80, 960, false]]);
  assert.deepEqual([mixed.rentPerYear, mixed.replaceablePerYear, mixed.provenPerYear, mixed.keptPerYear], [1864.75, 904.75, 0, 960]);
  assert.equal(audit([{ fn: 'crm', rent: 'salesforce-pro-suite', users: 0 }], REG, map1, {}).rentPerYear, 0);
  // refusals
  for (const [stack, re] of [[[], /the rented stack/], ['x', /the rented stack/], [[null], /needs fn and rent/], [[{ fn: 'crm' }], /needs fn and rent/], [[{ fn: 'crm', rent: 'salesforce-pro-suite', users: 1.5 }], /users must be a whole number/], [[{ fn: 'crm', rent: 'salesforce-pro-suite', users: -1 }], /users must be a whole number/], [[{ fn: 'crm', rent: 'ons-cpi', users: 1 }], /no subscription ons-cpi/], [[{ fn: 'crm', rent: 'nope', users: 1 }], /no subscription nope/], [[{ fn: 'zz', rent: 'salesforce-pro-suite', users: 1 }], /no function zz/]])
    assert.match(audit(stack, REG, map1, {}).why, re);
  assert.match(audit(BANK, { maxAgeDays: 1, entries: REG.entries.filter((e) => e.id !== 'uk-vat') }, MAP, EV).why, /uk-vat and fx-gbp-usd/);
  assert.match(audit(BANK, { maxAgeDays: 1, entries: REG.entries.filter((e) => e.id !== 'fx-gbp-usd') }, MAP, EV).why, /uk-vat and fx-gbp-usd/);
  assert.match(audit(BANK, { maxAgeDays: 1, entries: REG.entries.map((e) => (e.id === 'uk-vat' ? { ...e, value: 'x' } : e)) }, MAP, EV).why, /uk-vat and fx-gbp-usd/);
  assert.match(audit(BANK, { maxAgeDays: 1, entries: REG.entries.map((e) => (e.id === 'fx-gbp-usd' ? { ...e, gbpPerUsd: null } : e)) }, MAP, EV).why, /uk-vat and fx-gbp-usd/);
  assert.match(audit(BANK, { maxAgeDays: 1, entries: REG.entries.map((e) => (e.id === 'uk-vat' ? { ...e, value: NaN } : e)) }, MAP, EV).why, /uk-vat and fx-gbp-usd/);
  assert.match(audit(BANK, { maxAgeDays: 1, entries: REG.entries.map((e) => (e.id === 'fx-gbp-usd' ? { ...e, gbpPerUsd: Infinity } : e)) }, MAP, EV).why, /uk-vat and fx-gbp-usd/);
  const eur = { maxAgeDays: 180, entries: [...REG.entries, { id: 'eur-seat', kind: 'saas', product: 'E', price: 1, currency: 'EUR', per: 'm', vat: 'excluded', quote: 'q', source: 'https://e.example', checked: '2026-09-30' }] };
  assert.match(audit([{ fn: 'crm', rent: 'eur-seat', users: 1 }], eur, map1, {}).why, /cannot be priced in pounds/);
});

test('fuzz: never a throw', () => {
  const junk = [undefined, null, 0, '', 'x', [], {}, [null], { functions: [null, {}] }, () => 1];
  for (const a of junk) for (const b of junk) assert.doesNotThrow(() => { checkOrgans(a); replacement(a, b, a); replacement('crm', a, b); audit(a, b, a, b); audit(BANK, a, b, a); });
});
