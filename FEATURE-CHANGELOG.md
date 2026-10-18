# Midir — final feature changelog against Marcentus/Midir

**Pinned comparison basis:** `Marcentus/Midir` at commit [`6f264b407dbd842fbafeef8d14cc1cff5f505af4`](https://github.com/Marcentus/Midir/commit/6f264b407dbd842fbafeef8d14cc1cff5f505af4), using the original GitHub source ZIP uploaded by the project owner, compared file-by-file with `Midir-07.zip`. Both ZIPs passed archive integrity checks. The comparison excludes ZIP top-level folder names and directory entries. This is a content-based source comparison, **not** a `git diff` with full repository history. Midir-08 changes documentation only; application source is byte-for-byte identical to Midir-07 (whose application logic was unchanged from the user-compiled Midir-06).

## Verified source comparison against pinned upstream commit

- **14 modified existing files**, **9 added files** (5 source/test and 4 documentation), **0 removed files**, and **1,326 identical files**; 1,349 files in Midir-07 versus 1,340 original files in the pinned snapshot.
- No file-level changes in `go.mod`, `go.sum`, root `README.md`, `README-macOS.md`, `LICENSE`, `build.bat`, or `build.sh`.
- The comparison confirms *which files differ* and what features the changed code contains; it does not establish authorship of features across other forks or historical commits.
- See `PINNED-UPSTREAM-DIFF.md` for the exact modified/added file list and comparison method.

## Added functionality (relative to pinned original upstream commit)

### 1. Scatter timeline for damage and skill rotation
- Added `front/src/components/DamageScatterChart.vue`, displaying recorded skill-hit events as points on a timeline, including hit/critical cues and per-player toggles.
- Added horizontal panning and zoom to navigate later hits; constrained tooltip positioning and overflow for hard-to-reach points.
- Captured and restored skill-hit event data for saved sessions, including a reconstruction fallback from damage events for older saves.
- Linked scatter visibility to the rolling Damage Graph: one eye button hides a player's scatter points, rolling DPS, Ghost Runner line and death markers; **Damage Dealt rankings remain unaffected**.

### 2. Ghost Runner comparison
- Added a typical productive-DPS reference based on the median damage-per-second of 15-second buckets with nonzero damage.
- Added a Ghost Runner toggle/reference line to the Damage Graph.
- Added a separate saved-session-only toggle on Damage Dealt, with darker comparison fills in overall and per-skill DPS bars, plus ghost-icon hover values. The ordinary damage bars stay in place.
- Ghost Runner uses saved event history; live capture does not show the Damage Dealt comparison.

### 3. Death Flags and historical death metrics
- Added staggered death-marker annotation lanes on the graph for closely spaced deaths, with death-time DPS derived from the nearest available graph sample.
- Added numbered Death 1, Death 2, … controls in expanded Damage Dealt player sections. Their scrollable responsive popovers show overall and individual skill DPS and hits per minute reconstructed from events recorded before each death.
- **Limit:** these are event-derived estimates, not guaranteed exact at-death snapshots. Simultaneous chart lines can still share an x-coordinate even when their labels are staggered.

### 4. Personal Best Progress — per skill only
- Added green upward-arrow celebrations beside individual skill rows in expanded Damage Dealt views, **never beside player-level DPS**.
- Calculates per-skill DPS and compares it to historical saved sessions for the same player and target, considering only earlier sessions and skills previously used; no green arrow for decreases, ties or missing comparisons.
- Excludes Harmonic Saint performances. The historical search can continue in groups of five through Harmonic Saint-only appearances; absence and user-configured lookback rules are detailed in implementation comments.
- Added Settings controls for a 5–200 session lookback and an optional alternate read-only `.ndjson` history folder. Added backend listing/reading and Windows folder picker endpoints. The selected directory **does not change where new sessions are saved**.
- Historical sessions can be used without rewriting their original files.

### 5. Session recovery and saved-event compatibility
- Updated saved-session loading and summary reconstruction, including skill grouping, skill-hit events, graph and death-related data, damage-taken data, and preservation of selected saved healing/overshield summary information.
- Added regression-oriented tests for reconstructed skill groups and packet decoding, along with aggregator test updates.
- Older save compatibility should be preserved; test against actual prefeature `.ndjson` samples before upstream submission.

### 6. Experimental healing and overshield data
- Added a dedicated healing-packet decoder and test, new healing view, player/recipient healing summary fields, and heuristic caster/skill association where the log supports it.
- Grouped unresolved healing under **Misc. Anonymous Healing** rather than presenting raw numeric IDs as character names.
- Added short-window caster hints for increases to the AdditionalHP shield pool for a limited set of skills; this remains a heuristic and **is not validated full overshield generation/consumption accounting**.
- Added Settings → Experimental → **Show Healing Done tab** (off by default for new installations). This hides the UI tab only; it does not disable capture or remove saved records.
- **Known gap:** effective healing versus overheal versus shields is not yet reliably determined and should not be presented upstream as a validated statistic.

### 7. Documentation and maintainability
- Added explanatory code comments by feature and the files `CONTRIBUTING-CHANGES.md`, `REVIEW-NOTES.md`, `HEALING-REWORK-NOTES.md` and this feature changelog.
- Documented known uncertainties and recommended upstream pull-request divisions.

## Changed source file inventory

**New frontend:** `front/src/components/DamageScatterChart.vue`, `front/src/components/applyHealingBySkill.vue`.

**Modified frontend:** `front/src/components/DamageGraph.vue`, `front/src/components/DamageMeterView.vue`, `front/src/components/SettingsView.vue`, `front/src/components/applyDamageBySkill.vue`, `front/src/store.ts`, `front/src/apicall.ts`, `front/src/types.ts`, `front/src/protocols.ts`.

**New backend/packet/tests:** `packet/healingPacket.go`, `packet/healingPacket_test.go`, `cmd/dilmeterapi/skill_group_rebuild_test.go`.

**Modified backend/tests:** `cmd/dilmeterapi/aggregator.go`, `cmd/dilmeterapi/aggregator_test.go`, `cmd/dilmeterapi/eventPublisher.go`, `cmd/dilmeterapi/httpHandlerSession.go`, `cmd/dilmeterapi/sessionManager.go`, `cmd/dilmeterapi/summary.go`.

**New notes:** `CONTRIBUTING-CHANGES.md`, `HEALING-REWORK-NOTES.md`, `REVIEW-NOTES.md`, `FEATURE-CHANGELOG.md`.

No differences were found against the pinned upstream commit for `go.mod`, `go.sum`, the root README files, license, build scripts or data files. This describes the two compared source archives, not all GitHub history.

## Recommended upstream PR sequence

1. **Saved-session schema and reconstruction:** event capture, compatibility, packet fixture and summary tests.
2. **Scatter chart + shared graph visibility:** UI and interaction changes without healing code.
3. **Ghost Runner and Death Flags:** include calculations and visual components, clarify approximation limits.
4. **Personal Best Progress:** history endpoints, opt-in comparisons and settings, Harmonic Saint filtering and comparison tests.
5. **Experimental healing:** healing decoder and attribution with explicit experimental status and fixture-based tests; keep shield accounting separate until validated.
6. **Documentation:** contributor guide, maintenance comments, and user-facing changes.

## Verification and attribution

- User reported `Midir-06` compiled successfully. This is **user-reported**, not a locally reproduced complete build or passing test suite.
- This release is a **documentation-only** update (`Midir-08`, following the documentation-only `Midir-07`); runtime behavior is unchanged from the successfully user-compiled `Midir-06`.
- The repository itself credits earlier KR meter work. This changelog describes **source differences**, not who originally conceived every feature or whether any feature existed in another branch/fork.
- Upstream commit is now pinned. Before publishing, run a Git-history-aware `git diff` against that commit, frontend build, Go tests, save/reopen regression checks and packet fixture checks. A source-tree comparison alone cannot prove upstream origin or dead-code absence.
