# ◊ FallStack

> **Drop your accounting bill. We map every SaaS sub to a free sovereign replacement.**
> The savings dashboard. The migration plan. The cancellation letters. Konomi-signed audit envelope.

[**Live tool →**](https://sjgant80-hub.github.io/fallstack/) · [Source](https://github.com/sjgant80-hub/fallstack) · [Estate](https://ai-nativesolutions.com)

## What it does

1. Drop your accounting CSV (Xero, QuickBooks, FreeAgent) or a bank statement, or paste vendor names.
2. Pattern engine identifies known SaaS vendors (HubSpot, Mailchimp, Calendly, etc).
3. Maps each one to the corresponding sovereign organ in the AI Native Solutions estate (HubSpot → FallCRM, Mailchimp → FallList, etc).
4. Shows the headline number: annual savings if you migrate the entire stack.
5. Generates a markdown migration plan: which organ to fork first, how to export your data, what to cancel and when.
6. Hands off cancellation-letter generation to FallBack (which already cites the right legislation per jurisdiction).
7. Konomi Ed25519 signs the audit envelope, provable for board reporting.

## Disruption math

A typical 5-person UK SMB pays £20,000-£57,000/year for SaaS subscriptions that are, structurally, wrappers around 3-5 browser APIs each. FallStack maps that bill onto 17 sovereign organs (all MIT, all single-file, all free forever).

At 5% adoption × 5.5M UK SMBs × £30,000 average saving = approximately £8.25B/year returned to small businesses.

## Architecture

- Single HTML file
- PDF.js (lazy load) + CSV parser + paste fallback
- Pattern engine matches normalised vendor strings against a curated catalogue of 80+ known SaaS vendors
- Per-organ replacement map with full/partial coverage flags
- Web Crypto Ed25519 for the audit envelope signature
- nas-shim + audit-shim baked

## Sister organs

- [FallCorp](https://sjgant80-hub.github.io/fallcorp/) - the bundled shell (all 17 organs in one tab)
- [FallBack](https://sjgant80-hub.github.io/fallback/) - sovereign rights & refund engine (cancellation letters)
- [Full estate](https://sjgant80-hub.github.io/fall-registry/) - 140+ tools

## Licence

MIT. Forever. Fork it.

> For the people. Not the few.

*prime 1321 · MianoCube lineage*
