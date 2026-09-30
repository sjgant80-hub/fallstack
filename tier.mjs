// tier.mjs — HOW FINISHED IS IT? Answered from evidence, never from a claim.
//
// The estate's problem was not that things were unfinished. It was that a rough prototype and a
// properly tested build looked identical on every surface, so everything read as equally solid —
// which means nothing did. This is the ladder that separates them.
//
//   PROTOTYPE  it exists. Maybe it opens. Nobody has checked the code.
//   WORKS      a machine ran its tests, on hardware we do not own, and they passed.
//   PROVEN     that machine also tried to BREAK the tests — a mutation gate — and failed.
//
// ⚑ THERE IS NO SETTER. tierOf() reads GitHub's own record of what ran on GitHub's own hardware.
// A repo cannot describe itself upward, and neither can its author. This is the same rule that makes
// rarity mean something in fallworld: the label is a measurement, not a badge.
//
// ⚑ AND GITHUB'S PAGES DEPLOY IS NOT A TEST. "pages build and deployment" runs on almost every repo
// here and proves only that a file was copied to a web server. Counting it as evidence would hand
// 36 repos a tier they never earned, which is precisely the lie this kernel exists to stop.
//
// Pure: no I/O, no clock, no network. The caller gathers the evidence and passes it in.

export const TIERS = ['prototype', 'works', 'proven'];

/** Where a tier sits on the ladder. Unknown names are -1, NOT 0 — 0 is a real rung, and an unknown
 *  string ranking as a real rung is how a typo silently becomes a grade. */
export function rank(tier) {
  const i = TIERS.indexOf(String(tier));
  return i;
}

/** GitHub's automatic deploy jobs. They publish; they do not check. */
const AUTOMATIC = /^(pages build and deployment|deploy static content to pages|pages-build-deployment)$/i;

export function isAutomatic(name) {
  return AUTOMATIC.test(String(name == null ? '' : name).trim());
}

/**
 * Evidence for one repo: an array of workflow records, each
 *   { name, conclusion, mutation, pinned, sha, at }
 * `mutation` says the workflow file actually invokes a mutation gate. `conclusion` is GitHub's.
 */
export function tierOf(evidence, opts) {
  // A default parameter does not fire on an explicit null, and null is exactly what a caller reading
  // a missing key hands you. Normalise first, then destructure.
  const { live = false } = (opts && typeof opts === 'object') ? opts : {};
  const flows = (Array.isArray(evidence) ? evidence : [])
    .filter(f => f && typeof f === 'object' && !isAutomatic(f.name));

  const green = flows.filter(f => f.conclusion === 'success');
  const gate = green.find(f => f.mutation === true);

  if (gate) {
    return {
      tier: 'proven',
      why: `a mutation gate ran on GitHub's hardware and every mutant died`
         + (gate.pinned ? `, against a pinned checker` : ``),
      workflow: gate.name || null,
      sha: gate.sha || null,
    };
  }
  if (green.length) {
    return {
      tier: 'works',
      why: `tests ran on GitHub's hardware and passed, but nothing tried to break the tests themselves`,
      workflow: green[0].name || null,
      sha: green[0].sha || null,
    };
  }
  // Everything else. The distinction that remains is only whether a person can open it.
  return {
    tier: 'prototype',
    why: flows.length
      ? `it has a workflow, but the last run did not pass`
      : (live ? `it opens, and no machine has ever checked the code` : `nothing runs it and nothing opens it`),
    workflow: flows.length ? (flows[0].name || null) : null,
    sha: null,
  };
}

/**
 * Count a set of builds by tier. Returns every tier as a key even when zero — a missing key reads as
 * "not measured" and a zero reads as "measured, none", and only one of those is the truth.
 */
export function tally(rows) {
  const out = { prototype: 0, works: 0, proven: 0 };
  for (const r of (Array.isArray(rows) ? rows : [])) {
    const t = r && r.tier;
    if (rank(t) >= 0) out[t]++;
  }
  return out;
}

/**
 * THE PRIMARY OF A CLUSTER — move 2. When several builds do one job, the one to send people to is the
 * one furthest up the ladder; ties break on most recently touched, then name, so the answer is
 * deterministic rather than whichever happened to be first in the list.
 *
 * ⚑ It picks a FIRST CHOICE, it does not delete the others. A cluster that quietly loses its members
 * is indistinguishable from one that was finished, and the estate has been bitten by exactly that.
 */
export function primaryOf(rows) {
  const list = (Array.isArray(rows) ? rows : []).filter(r => r && r.name);
  if (!list.length) return null;
  const sorted = [...list].sort((a, b) =>
    rank(b.tier) - rank(a.tier)
    || String(b.pushed || '').localeCompare(String(a.pushed || ''))
    || String(a.name).localeCompare(String(b.name)));
  return { primary: sorted[0], rest: sorted.slice(1) };
}

export default { TIERS, rank, isAutomatic, tierOf, tally, primaryOf };
