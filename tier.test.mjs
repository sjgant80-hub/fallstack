// tier.test.mjs — PROOF-OF-PLAY for the ladder.
//
// The failure this kernel exists to prevent is a build wearing a tier it did not earn. So most of
// these tests are about what must NOT count as evidence.
import { TIERS, rank, isAutomatic, tierOf, tally, primaryOf } from './tier.mjs';

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ FAIL ') + m); };
const wf = (o) => ({ name: 'gate', conclusion: 'success', mutation: false, pinned: false, sha: 'abc', ...o });

console.log('\n=== §1 · ⚑ THE PAGES DEPLOY IS NOT A TEST ===');
{
  ok(isAutomatic('pages build and deployment'), "GitHub's deploy job is recognised as automatic");
  ok(isAutomatic('  Pages Build And Deployment  '), 'and recognised whatever the case or padding');
  ok(isAutomatic('Deploy static content to Pages'), 'so is the static-content deploy');
  ok(!isAutomatic('gate') && !isAutomatic('ci'), 'a real workflow is not automatic');
  ok(!isAutomatic(null) && !isAutomatic(undefined), 'garbage is not automatic');

  const t = tierOf([wf({ name: 'pages build and deployment' })], { live: true });
  ok(t.tier === 'prototype',
     '⚑ a repo whose ONLY green run is the Pages deploy stays PROTOTYPE — publishing is not checking');
  ok(/no machine has ever checked/.test(t.why), 'and it says so plainly');
}

console.log('\n=== §2 · the three rungs ===');
{
  ok(tierOf([wf({ mutation: true })]).tier === 'proven', 'a green mutation gate is PROVEN');
  ok(tierOf([wf({ mutation: false })]).tier === 'works', 'green tests with no mutation gate are WORKS');
  ok(tierOf([wf({ conclusion: 'failure', mutation: true })]).tier === 'prototype',
     '⚑ a mutation gate that FAILED earns nothing — a red gate is not a badge');
  ok(tierOf([]).tier === 'prototype', 'no workflows at all is PROTOTYPE');
  ok(tierOf([], { live: true }).why !== tierOf([], { live: false }).why,
     'and opening in a browser changes the reason, not the rung');
}

console.log('\n=== §3 · the reason is always a sentence ===');
{
  for (const ev of [[], [wf({})], [wf({ mutation: true })], [wf({ conclusion: 'failure' })]]) {
    const t = tierOf(ev);
    ok(typeof t.why === 'string' && t.why.length > 25, `"${t.tier}" carries a real explanation`);
  }
  ok(/pinned/.test(tierOf([wf({ mutation: true, pinned: true })]).why),
     'a pinned checker is mentioned, because an unpinned gate can change under you');
  ok(!/pinned/.test(tierOf([wf({ mutation: true, pinned: false })]).why),
     'and is NOT mentioned when it is not pinned — the reason must not overclaim');
}

console.log('\n=== §4 · ⚑ NOTHING CAN CLAIM A TIER ===');
{
  const liar = [{ name: 'gate', conclusion: 'success', mutation: false, tier: 'proven', proven: true }];
  ok(tierOf(liar).tier === 'works', '⚑ a `tier` field on the evidence is NOT READ — the claim is ignored, not rejected');
  ok(tierOf([{ name: 'x', conclusion: 'success', mutation: 'yes' }]).tier === 'works',
     'mutation must be exactly true — a truthy string does not promote it');
  ok(tierOf([{ name: 'x', conclusion: 'SUCCESS', mutation: true }]).tier === 'prototype',
     "and the conclusion must be GitHub's exact 'success', not a lookalike");
}

console.log('\n=== §5 · rank has no accidental rung ===');
{
  ok(rank('prototype') === 0 && rank('works') === 1 && rank('proven') === 2, 'the ladder is ordered');
  ok(rank('banana') === -1, '⚑ an unknown tier is -1, NOT 0 — a typo must not rank as a real rung');
  ok(rank(null) === -1 && rank(undefined) === -1, 'and garbage does not rank');
  ok(TIERS.length === 3, 'there are exactly three rungs');
}

console.log('\n=== §6 · tally reports zeros, not gaps ===');
{
  const t = tally([{ tier: 'proven' }, { tier: 'proven' }, { tier: 'prototype' }]);
  ok(t.proven === 2 && t.prototype === 1, 'it counts what is there');
  ok(t.works === 0, '⚑ and reports an EMPTY rung as 0 — a missing key reads as "not measured"');
  ok(tally([{ tier: 'banana' }]).proven === 0, 'an unknown tier is counted nowhere');
  ok(Object.keys(tally(null)).length === 3, 'garbage still returns all three rungs');
}

console.log('\n=== §7 · the primary is the one furthest along ===');
{
  const rows = [
    { name: 'b-old-proven', tier: 'proven', pushed: '2026-01-01' },
    { name: 'a-new-works', tier: 'works', pushed: '2026-08-01' },
    { name: 'c-proto', tier: 'prototype', pushed: '2026-08-12' },
  ];
  const p = primaryOf(rows);
  ok(p.primary.name === 'b-old-proven', '⚑ tier beats recency — proven-and-old leads newer-but-unproven');
  ok(p.rest.length === 2, 'and the rest are KEPT, not dropped');
  const tie = primaryOf([
    { name: 'x', tier: 'works', pushed: '2026-01-01' },
    { name: 'y', tier: 'works', pushed: '2026-08-01' },
  ]);
  ok(tie.primary.name === 'y', 'a tie on tier breaks on most recently touched');
  const same = primaryOf([{ name: 'b', tier: 'works', pushed: '1' }, { name: 'a', tier: 'works', pushed: '1' }]);
  ok(same.primary.name === 'a', 'and a full tie breaks alphabetically, so the answer is deterministic');
  ok(primaryOf([]) === null && primaryOf(null) === null, 'an empty cluster has no primary');
}

console.log('\n=== §9 · it reports WHICH workflow, and null when there is none ===');
{
  const p = tierOf([wf({ name: 'gate', sha: 'deadbee', mutation: true })]);
  ok(p.workflow === 'gate' && p.sha === 'deadbee', 'proven names the gate that ran and the commit it ran on');
  const pn = tierOf([{ conclusion: 'success', mutation: true }]);
  ok(pn.workflow === null && pn.sha === null,
     '⚑ and reports null when the record has no name or sha — never undefined, which JSON drops silently');

  const w = tierOf([wf({ name: 'ci', sha: 'c0ffee' })]);
  ok(w.workflow === 'ci' && w.sha === 'c0ffee', 'works names its workflow and commit too');
  const wn = tierOf([{ conclusion: 'success' }]);
  ok(wn.workflow === null && wn.sha === null, 'and nulls them when absent');

  const f = tierOf([wf({ name: 'gate', conclusion: 'failure' })]);
  ok(f.tier === 'prototype' && f.workflow === 'gate',
     'a failed run still names the workflow, so you can go and look at it');
  ok(f.sha === null, 'but carries no sha — there is no passing commit to point at');
  const fn = tierOf([{ conclusion: 'failure' }]);
  ok(fn.workflow === null, 'and nulls the name when the failed record has none');
  ok(tierOf([]).workflow === null, 'no workflows at all reports null');
}

console.log('\n=== §10 · the primary does not depend on input order ===');
{
  // Both orderings must give the same answer. Without this, a comparator that mangles only ONE side
  // of the date compare still looks correct whenever the list happens to arrive oldest-first.
  const older = { name: 'b-old', tier: 'works', pushed: '2026-01-01' };
  const newer = { name: 'a-new', tier: 'works', pushed: '2026-08-01' };
  ok(primaryOf([older, newer]).primary.name === 'a-new', 'newest wins when it is listed second');
  ok(primaryOf([newer, older]).primary.name === 'a-new', '⚑ and when it is listed FIRST — order must not decide it');

  const noDate = primaryOf([{ name: 'z', tier: 'works' }, { name: 'a', tier: 'works' }]);
  ok(noDate.primary.name === 'a', 'with no dates at all it still settles, alphabetically');
}

console.log('\n=== §8 · pure under garbage ===');
{
  const junk = [null, undefined, '', 0, [], {}, NaN, [null], [{}], [{ conclusion: 1 }]];
  let threw = null;
  for (const j of junk) {
    try { tierOf(j); tierOf(j, j); tally(j); primaryOf(j); rank(j); isAutomatic(j); }
    catch (e) { threw = `${JSON.stringify(j)} → ${e.message}`; }
  }
  ok(threw === null, 'no input throws' + (threw ? ' — ' + threw : ''));
}

console.log(`\n${fail === 0 ? '✓ ALL PASS' : '✗ FAILURES'} — ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
