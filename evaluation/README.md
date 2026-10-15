# Synthetic receipt evaluation

This is an offline scoring harness for the assessment/demo, not evidence of Gemini accuracy or production adoption. Six authored PNG receipts, their readable text sources and labels are committed in [fixtures.json](./fixtures.json). They contain no real purchases or personal data. Cases cover tax versus subtotal, a tip, KRW digit grouping, a discount, a missing date and an unreadable total. The deliberately simple images do not represent real-world blur, rotation, handwriting or receipt diversity.

## Reproduce without a model call

```sh
npm run test:eval
npm run eval:receipts
# Optional regeneration of committed PNGs after npm ci:
node evaluation/render.mjs
```

The scorer uses only Node built-ins, reads local JSON and never reads API keys or calls a network service. `mock-predictions.json` contains authored responses, including an intentionally incorrect total. Its scores validate the harness, not a model: 29/30 field matches, 4/5 readable totals, 5/6 exact receipts and 2/6 requiring review. Cost and latency are null because they were not measured. Do not present these mock numbers as extraction quality.

## Score separately recorded results

```sh
node evaluation/score.mjs path/to/recorded-predictions.json > report.json
```

Use the mock JSON as the structural template, replace `mode` with `live-recorded`, and supply `model` and `recordedAt` (ISO date/time). For each fixture ID provide the actual normalized API `data` as `extraction`, or `{ "id": "myr-tax", "error": "timeout" }` for a failed attempt. Never omit a failed case or replace it with its label. Unknown, duplicate and missing IDs fail validation. Capture every receipt once under the same model/prompt/settings; retain prompt revision and provider configuration alongside the run. A rerun should be a separate report, not a selection of best outputs.

Optional per-prediction `latencyMs` and `costUsd` must come from actual recorded observations. Measure latency around the whole extraction request and document that boundary; report cost only if supported by provider usage/billing and the applicable pricing, retaining that evidence with the run. Omit unavailable values; zero means measured zero. Aggregates include measured counts so partial measurement cannot masquerade as full coverage. The harness does not execute live inference, infer prices or estimate costs. No live evaluation results are included.

## Metric definitions

- Field accuracy: exact match for merchant, category, ISO date and currency; totals compare after rounding to hundredths. Explicit null matches an unreadable/missing label. No case folding or fuzzy merchant matching is applied.
- Overall field accuracy: correct fields / (all receipts × 5). Line items, notes and confidence calibration are not scored.
- Total accuracy: correct numeric totals / receipts with a readable numeric total. Separate field accuracy includes null-total agreement.
- Exact receipt accuracy: all five fields correct / all receipts. Failed attempts count as incorrect on every field.
- Review rate: fraction that fail the application's completeness rule (missing required fields, nonpositive total or low confidence), including failed attempts. It measures automatic review routing, not whether review is sufficient; a wrong high-confidence total may still pass. A unit test checks parity with `isExtractionComplete`.
- Latency/cost: arithmetic mean of explicitly measured rows, with coverage count; null if none measured. These are not inferred from scorer runtime.

The existing [live Gemini E2E](../tests/e2e/live-gemini.spec.ts) is a separate connectivity smoke test: it checks a positive amount, not labelled accuracy. It can spend quota and is not run by this evaluation. All live measurement requires a separately authorized run.
