# Midir — Consolidated Changelog

**Source audited:** `Midir-41.zip` (the latest Midir package supplied in this project). This file replaces the 26 historical `RELEASE-*.md` notes and older `FEATURE-CHANGELOG.md` bundled in that package; the older release files are removed from this source archive. It is an **audited description of the latest source**, not a claim that all features passed a complete production build. The program's source code, assets, and report logic are unchanged in this tidy-up.

## Current functionality, by area

### Early fork features (relative to pinned upstream snapshot)
- The earlier source comparison (`FEATURE-CHANGELOG.md`, pinned upstream commit `6f264b407dbd842fbafeef8d14cc1cff5f505af4` versus Midir-07) documented the in-app **Damage Scatter Chart**, linked player visibility controls, and saved-session hit reconstruction. These are distinct from the later standalone HTML scatter exporter. The old comparison was **source-based, not a verified Git-history diff**.
- **Ghost Runner**: a typical productive-DPS reference computed from the median of 15-second nonzero-damage buckets, graphed as a reference and optionally shown as comparative fills for saved-session Damage Dealt. It is not an observed player's perfect rotation.
- **Death Flags**: staggered death markers and at-death skill/DPS approximations reconstructed from the recorded history, not guaranteed exact snapshots.
- **Personal Best Progress**: per-skill (not per-player) improvement indicators based on earlier sessions for the same player/target; Harmonic Saint excluded, configurable lookback (5–200 sessions) and optional read-only historical session folder. Historical comparisons cannot be assumed available for every past file.
- An **experimental Healing Done** UI was introduced with packet decoder tests, unknown/anonymous source handling and optional Settings visibility. Attribution/shield estimation remained explicitly heuristic; later work improved presentation and capture safeguards rather than solving skill-level packet attribution.

### Combat parsing, healing, and saved sessions
- Combat target, player, skills, damage and healing summaries use recorded packet data; multi-hit damage packets are **not** proof of individual skill casts. Healing packets may remain unattributed (`Unknown Caster` or anonymous); skill-level healing attribution is not considered reliably solvable with the currently available packet information. [18, 20–21]
- Displays largest heal in Healing Done; preserves existing split presentation and recipient / ordinary-HP sanity checks. Harmonic Saint identified-caster priority for recognized skills and Veil of Life condition 999 shield contributions is represented in backend source; it is heuristic rather than per-packet proof. [18, 20]
- Saved-session readers accept 32 MiB NDJSON lines, avoiding the former 64 KiB scanner-limit failure. Recording avoids indefinitely capturing background events outside active target presence, uses incremental counters, buffered writes, synchronization and temp-file publication. [20–21]
- Diagnostic healing recorder and its UI/settings endpoints were **removed**, not a current feature. Existing external diagnostic files are not automatically deleted. [21 diagnostic cleanup]
- Saved-session actions include opening the exact `.ndjson` in the file manager and batch deleting selected sessions (with confirmation and per-file failure reporting). [32]
- Windows build script is intended to stop on errors, reject stale outputs and report failures honestly. [33]

### Offline HTML reporting
- Standalone self-contained HTML with player/party selection, damage scatter, player toggles, pan/zoom and hover details, boss HP timeline/search, skill summary and Arcana-colored collapsible/reorderable player panels. The scatter and HP controls appear above the player breakdown; sortable handles support pointer and keyboard movements. [20–26]
- Excludes anonymous healing/numeric-only empty contributor panels from human-facing HTML displays where appropriate; this does **not** remove underlying healing data. [22–23]
- Embedded `midir-companion` v1 metadata includes player death times, condition intervals, damage-hit groups, original target entity IDs and their raw HP samples, logical encounter metadata, provenance, and conservative clear evidence. The **separate companion JSON download button was later removed**; embedded HTML metadata remains supported. [27, 31]
- A selected Combat Target export filters to boss target member IDs and excludes adds. Target-scoped scatter may be omitted because aggregated skill-hit scatter does not reliably retain target identity. Unfiltered all-target reports retain full scatter. [29–30]
- Can batch-export multiple saved sessions to an HTML-report ZIP; the batch action does not inherit another session's selected target. [31]

### Boss groupings and export interpretation
- **Bri Leitt Gate 1 — Vertrag of the Deep Roots:** attempt-safe 7600 → 7601 association (at most one replacement, bounded by the next 7600, up to 30 seconds of transition tolerance and 2 seconds timestamp skew); an expandable boss row retains each original form. Group damageable HP is the combined damageable halves, but the **mechanic timeline is 100→50→0**. Gate 1 Ancient Giants at 70% and 25% are expandable and remain distinct from the boss damage; miscellaneous adds are collapsed. [28–30, 35, 39–40]
- **Gate 1 HTML correction:** All Targets and selected logical boss exports retain both form HP histories as `boss.phases` and `logicalEncounters[].phaseHp` while the main graph follows the continuous phase scale. Prior All Targets selection of highest-max-HP 7601 alone is a **superseded defect**, not expected current behavior. The paired attempt / clear remains evidence-bound. [41]
- **Bri Leitt Gate 3:** Shards of Solace grouped using recorded HP families (~38.3M for 80%/40%, ~63.8M for 60%, ~23.5M ambient), timestamp alignment with the boss, and approximate threshold crossings. Ambiguous entities are kept outside named wave groups. These are visual UI groups, not invented Companion mechanic intervals. [28, 35, 38]
- **Glenn Bearna: Primeval Winter:** attempt-aware 7585→7586→7587 grouping; individual identities stay raw, nominal group damageable HP uses 90%/40%/60% of the settled form maxima, and boss-only reports exclude mobs. [36–37]
- **Rabbie Phantasm: Temptation's Path:** Succubus Queen 195012 per attempt, with the four named succubi shown as supporting enemies but excluded from boss-only damage. [37]
- **Crom Bas Normal:** Irusan 193364 and Giga Glas Ghaibhleann 193359 separately selectable; distinct from Crom Bas Abyss. [37]

## Superseded changes removed from the running history
- Early versions lacked HTML export entirely [18] or companion data / logical encounter merges [20, 27]; later versions added them. Those gaps do not describe Midir-41.
- Mouse-native drag-and-drop was replaced by pointer-based and keyboard-enabled panel sorting [25→26].
- First-pass Gate 1 phase matching, generic single-entity HP selection and interim nesting issues were revised through releases 28–41. Do not interpret the sequence of hotfix release notes as multiple independent features.
- Gate 3 early spawn-placeholder HP assumptions were replaced by recorded HP-family identification and aligned timestamps [28→38].
- The temporary player-facing companion JSON control is not part of the latest intended HTML-only workflow [27→31].
- Debug healing recording was removed [21 cleanup].

## Source verification and known limitations
This consolidation was compared against all **26 bundled historical release notes** and the latest archive's source inventory. It preserves the distinction between a feature documented in source, a verified sample result, and an actual compiled/runtime result. The previously supplied three Gate 1 HTML reports supported the split-phase fix and observed replacement zero-HP evidence; they do not prove correctness for every recording. Historical notes repeatedly document TypeScript transpile/syntax checks and ZIP validation, **not** a full Vue/Vite compile, Go test suite, Windows build, or live combat regression. Such verification remains necessary after the user's next local build. Exact target-scoped scatter/hit identification and inferred mechanic intervals remain constrained by saved data; absent timestamps cannot be manufactured.

## Release trace (consolidated, no duplicate feature entries)
| Historical source notes | Current outcome |
|---|---|
| Pinned upstream comparison (old FEATURE-CHANGELOG) | In-app scatter, Ghost Runner, death markers, per-skill personal best, experimental healing foundation |
| 18; 20 and its HS/save patches; 21 and diagnostic cleanup | Healing display/heuristic ownership, recording safeguards, larger saved-session scans; diagnostic recorder removed |
| 20–26 | Single offline report, interactive scatter and HP chart, collapsible/reorderable player breakdown |
| 27–31 | Structured Companion data embedded in HTML, target filtering and batch HTML exports; separate JSON button removed |
| 28–30, 35, 39–41 | Gate 1 attempt pairing, nested UI, effective HP, correct two-form export |
| 28, 35, 38–39 | Gate 3 halo groups by HP family and approximate timing |
| 32–34 | Session management, fail-fast Windows build, frontend TypeScript hotfix |
| 36–37 | Glenn and additional encounter registry entries |

## Legacy-note reconciliation (Midir-41 authoritative; 2026-10-20)

Seven old, standalone documentation files were reviewed against the Midir-41 package and removed from this distribution. The following are **current principles or historical context**, not new implementation claims:

- **Healing and shield attribution:** The currently retained healing parser may have unknown casters and unattributed skills. Veil of Life condition 999 uses observed `SBBV` capacity-change evidence and `SBBDDR` mitigation-rate observations, not proof of all shielding created, absorbed damage, or verified effective healing. Recipient filtering and suspicious-value quarantine are safeguards; overlapping casts and skill attribution still require controlled evidence. Early experimental inference from stat 31 (`AdditionalHP`) is superseded and must not be presented as verified Veil generation. Historical saved estimates are not retroactively upgraded.
- **Removed diagnostic workflow:** Historical Midir-13/Midir-16 directions to enable a 'Record healing diagnostics' setting and capture `healing-diagnostics-*.ndjson` are **obsolete**. Midir-41 removed the diagnostic recorder and related UI/endpoints. The former windows for matching skills to healing packets (including 59002/59003/59004) were unverified experiments; do not treat them as present features or definitive evidence.
- **Graph versus Damage Dealt:** The two Ghost Runner presentations are separate; chart-only hide controls must not alter Damage Dealt rankings. Graph death markers from saved DPS samples and damage-detail per-skill history provide different levels of granularity and are not duplicate dead code. Per-skill Personal Best has configurable historical lookback, not a fixed five-session scan.
- **Source comparison history:** An early archive-to-archive comparison of a pinned upstream source snapshot (`6f264b407dbd842fbafeef8d14cc1cff5f505af4`) and Midir-07 reported 1,326 byte-identical paths, 14 changed paths, nine added paths, and none removed. This was a ZIP content comparison, not a verified Git ancestry or claim about current Midir-41 upstream differences.
- **Verification still required:** `go test ./...`, `go build ./...`, and `front` build (`npm ci`, `npm run build`) are recommended for a reproducible local build; saved-session compatibility, charts, damage history, and ambiguous multi-healer cases require runtime tests. Their mention here does **not** mean they passed during this documentation cleanup. No source-code removal or dead-code audit is implied.

The removed files were `REVIEW-NOTES.md`, `CONTRIBUTING-CHANGES.md`, `HEALING-CORRELATION-M13.md`, `HEALING-REWORK-M16.md`, `HEALING-REWORK-NOTES.md`, `OVERSHIELD-ATTRIBUTION-NOTES.md`, and `PINNED-UPSTREAM-DIFF.md`. Historical details incompatible with the current implementation were deliberately **not** preserved as operational guidance.
