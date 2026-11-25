# Session bundle verification — Midir 49.a

Cumulative baseline: Midir 49. The current release removes the data-only producer option and adds lossless ZIP compression. Fixtures are fictional nonempty synthetic combat summaries passed through the actual production exporter, not live captures. The legacy NDJSON is a separate identity algorithm vector.

| Check | Result |
|---|---|
| All eleven frontend regression suites | Passed (`npm test`, using available TypeScript 5.8.3) |
| Single/multiple/128-session ZIPs, 6,000-hit entry, identical titles and timestamps, Unicode, large string IDs, distinct Arcana, historical missing streams | Passed |
| Repeated/overlapping exports, scope variants, revision detection, stable IDs, hash-unavailable branch | Passed |
| Native raw DEFLATE, STORE fallback without API or raw format support, STORE for non-beneficial compression | Passed in Node 22.16 native CompressionStream |
| ZIP local/central methods and sizes; independent raw inflation; exact compressed vs STORE entries | Passed |
| Single ZIP report vs individual HTML, byte-for-byte | Passed |
| Comparison with original Midir 49 fixture HTML and JSON | Passed: every payload field equal except exporterVersion 49 → 49.a, viewer byte-for-byte equal |
| Independent Python zipfile CRC, manifest JSON Schema, entry membership, SHA-256 and identity/scope validation | Passed for nine fixtures (eight manifested including the historical 49 JSON bundle) |
| Offline Chromium extracted report content | Rendered exact HTML bytes via content injection; title, controls, Unicode player, encounter and damage totals present; no page errors or HTTP(S) requests. Direct file:// navigation blocked by environment policy. |
| Targeted strict TypeScript export module check and modified Vue script syntax | Passed; not a complete Vue template typecheck |
| Full production build | Blocked by unchanged Node security gate: local 22.16.0; required patched 24.22.1 or 26.12.1 |
| Integrated Go suite / saved-session lifecycle | Not rerun: no Go source changes; required Go 1.24.4 unavailable (toolchain download fails) |
| Installed Midir UI, real game recordings and Companion 0.3.13 importer/viewer | Not tested; separate supported-toolchain and Companion validation required |

## Measured archive sizes

Identical HTML reports, manifests, hashes and entry paths, using the same inputs and exporter version. Compression is applied at export time only.

| Sample | STORE bytes | DEFLATE bytes | Reduction |
|---|---:|---:|---:|
| Three sessions | 206,128 | 60,085 | 70.9% |
| 128 sessions (including 6,000 hits in one) | 10,040,895 | 2,622,211 | 73.9% |

These are synthetic archive results, not measured compression CPU cost or expected performance for every recording. Independent extraction verifies no viewer or evidence bytes are lost. No dependency or build security gate changed. No backend or combat analysis changes in 49.a. The 49 baseline's isolated Go identity/header tests passed, but integrated lifecycle verification remains outstanding. The original 49 JSON fixture is provided only for explicit legacy support/rejection testing.
