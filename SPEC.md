# fallstack — specification

## Purpose

The estate's price registry and SaaS audit · MIT · @ai-native-solutions

## Contract

- **agrees** — part of the fallstack public surface; deterministic, total (never throws).
- **canon** — part of the fallstack public surface; deterministic, total (never throws).
- **checkEntry** — part of the fallstack public surface; deterministic, total (never throws).
- **checkLock** — part of the fallstack public surface; deterministic, total (never throws).
- **checkRegistry** — part of the fallstack public surface; deterministic, total (never throws).
- **days** — part of the fallstack public surface; deterministic, total (never throws).
- **exVat** — part of the fallstack public surface; deterministic, total (never throws).
- **lookup** — part of the fallstack public surface; deterministic, total (never throws).
- **pricedObjects** — part of the fallstack public surface; deterministic, total (never throws).
- **pull** — part of the fallstack public surface; deterministic, total (never throws).
- **toGbp** — part of the fallstack public surface; deterministic, total (never throws).

## Guarantees

- **Deterministic** — the same input yields the same output on any machine, any run.
- **Total** — hostile or malformed input returns a defined value, never an exception.
- **Zero-dependency** — no third-party runtime code inside the trust boundary.

## Verification

The suite exercises the public surface directly and is mutation-checked: a change to any guarded line makes a
test fail. konomify admits fallstack only when both the structure rubric (acg-assessor) and the behaviour gate
(witness) pass.
