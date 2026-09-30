# fallstack

The estate's price registry and SaaS audit · MIT · @ai-native-solutions

**Live page: https://sjgant80-hub.github.io/fallstack/** — a company's rented back office priced from vendor list prices, set against the estate organ that replaces each subscription, with that organ's maturity read from what GitHub's runners did. The same page shows the estate's price registry, every entry sourced, dated and checked for freshness in your browser.

Beside fall-euaiact's compliance map, this is the other half of every estate build's basis: **the one place a price comes from.**

## What it is

- **The price registry** — `registry/prices.json`: every vendor list price and public rate the estate's cost cases use. AI seats (Microsoft 365 Copilot, ChatGPT Business, Claude), business SaaS (Salesforce, Dynamics 365 Finance and Human Resources), API token prices, ONS CPI, the National Living Wage, the ONS median wage, the Bank of England target, DESNZ and Ofgem electricity, laptop power, ONS salaries, FX and VAT, and the vendor price rises that show the corporate bill climbing. Each entry quotes its figure as the source states it, links the page and gives the date it was checked. An entry older than 180 days is stale.
- **`prices.mjs`** (mutation-gated) — `checkEntry`, `checkRegistry` (well formed, unique, fresh), `pull` (a build's `prices.lock.json`), `checkLock` (the lock must equal the registry and lean on nothing stale), `pricedObjects` and `agrees` (find every price a build states, and make sure it names a locked entry and says the same thing).
- **The SaaS audit** — `stack.mjs` (mutation-gated) with `tier.mjs` (the ladder, vendored verbatim from fallworld with its tests). `registry/organs.json` maps each business function to the estate organ that replaces the rented SaaS, with what the organ covers and what it does not:
  - CRM → **fallforce** (FallCRM Elite): contacts, companies, deals and pipeline, activities, the sales forecast.
  - Finance ledger → **fallledger** (FallLedger): double-entry journals, trial balance, P&L, balance sheet, cash flow, VAT, period close.
  - HR → **fallhr** (FallHR): employee records, contracts, absence, holiday, performance.
  - Not replaced, said plainly: customer-service ticketing, an e-signature ceremony, payroll — no estate organ covers them yet.
- **Maturity from GitHub, never typed** — `tools/tiers.mjs` reads each organ's workflows from GitHub's API into `registry/tier-evidence.json`; the ladder turns that into Prototype, Works or Proven. All three organs are Proven today, and the page names the files each gate mutates. Each organ ships an optional bring-your-own-key route to a cloud model, off by default; a deployment that keeps every record in the building leaves it off.

## In every build

No estate build types a price. It pulls one:

```
node tools/price-check.mjs pull <repo> salesforce-pro-suite uk-vat fx-gbp-usd   # write <repo>/prices.lock.json
node tools/price-check.mjs <repo>                                                # the check
```

konomify's basis gate runs the check on every build the machine seals, alongside fall-euaiact's compliance-map check. A build fails when a locked entry differs from the registry, is missing from it, or is stale — or when any object in its JSON data states a price in a currency without naming a locked entry, or names one and states a different figure.

## Check it yourself

```
npm test                                   # prices, stack and the ladder
node tools/witness.mjs mutate prices.mjs --timeout 60000 --cap 900 --test node --test prices.test.mjs
node tools/witness.mjs mutate stack.mjs --timeout 60000 --cap 900 --test node --test stack.test.mjs
node tools/tiers.mjs                        # re-read the organs' evidence from GitHub
node tools/make-page.mjs && git diff --exit-code index.html
node tools/price-check.mjs .
```

CI runs the tests, the three mutation gates, the registry's freshness on the day it runs, the page fixpoint, and this repository's own compliance map ([compliance.html](compliance.html)).

## Credits

AI-Native Solutions · MIT. The ladder is fallworld's tier kernel, vendored verbatim. Powered by the Konomi architecture, created by Thomas Frumkin.
