# Midir — Changelog

A concise record of **what changed and why**. Features are grouped by purpose rather than by individual hotfix. Source references appear as numbered notes at the end. For current packet layouts, skill-observation rules, and HTML data contracts, see [Skill and Export Reference](SKILL-AND-EXPORT-REFERENCE.md).

## Build and dependency maintenance

- **Burst comparison consistency:** Use the same selected 30-second boss-hit window for leaderboard scoring and HTML export rather than independently reselecting export hits. Detect repeatable verification failures without looping through repeated session refreshes. Preserve the existing cache format and on-demand processing. [^37]

- **Personal Bests comparison reliability:** Track actual saved-file size and modification time as well as filename; identify the winning player by recorded entity ID; on export mismatch refresh only the affected recording and require a new explicit export. Existing evidence remains unchanged. [^36]

- **Leaderboard export typing:** Import the existing `AssignedHit` type into the comparison exporter to restore strict frontend compilation without changing burst indexing, exported data, or report behavior. [^35]
- **Code and documentation cleanup:** Reuse the same evidence resolver for in-app target Arcana and boss-only exports; centralize pet category/event labels, standardize formatting, and add frontend behavior tests to CI. Update the project guide and technical contracts without changing recorded events, capture settings, or damage totals. [^28]
- **Frontend typing:** Keep optional paired-boss Race IDs typed consistently in the merged encounter definitions. [^19]
- **Build safeguards:** Run Node-version checks and automated Go/frontend validation to catch regressions. [^12]
- **Documentation:** Maintain one functional changelog and a separate skill/export technical reference.

- **CI Go regression fixtures:** Align soft-clear tests with session-scoped Arcana reset, and validate multi-Saint overshield attribution using allowlisted casts while explicitly rejecting ordinary healing-only skills. No production attribution behavior changed. [^23]

- **Capture-mode safety:** CLI capture now honors the saved Npcap promiscuous-mode opt-in instead of forcing it on; absent preferences default off, and offline playback stays non-promiscuous. UI capture, restart, and autodetection retain their existing setting propagation. Added startup regression coverage. [^22]

- **Frontend dependency maintenance:** Raise Vue and Vite to patched compatible release ranges; require patched transitive dependency families identified by the npm audit, and approve only the reviewed `esbuild` installation script version. Build scripts synchronize the frontend lockfile during installation. Replace two ineffective dynamic imports with static imports, keeping loading state and condition-combination behavior unchanged. [^21]

## Combat analysis and player progress

- **Companion-compatible session bundles (Midir 49):** Add a versioned root manifest to bulk HTML ZIPs. Consolidate to one universal standalone HTML bundle in 49.a, with lossless DEFLATE compression and STORE fallback, retaining the complete interactive reports for direct Companion ZIP import or independent viewing. Persist new recording IDs, derive stable historical IDs from original event streams, and include scope, schema versions, timestamps and optional SHA-256 hashes for offline deduplication and revision checks. Preserve existing report viewers and evidence contracts; harden session header migration and archive collision/size handling. [^45]

- **Group Run Scheduler (Midir 48):** Move Session Naming to Appearance; add independently optional run counts, daily/weekly/rolling counting periods, and recurring group rules with editable labels, time windows, overnight support, priority order, custom templates and group-scoped numbering. Preserve 47.b preferences as fallback and retain editable save suggestions without changing recorded evidence or report names. [^44]

- **Custom session naming (47.b):** Include local recording date and time by default, with independent switches in Capture settings. Add optional custom templates, editable labels for each weekday, live example previews and daily saved-recording numbering. Preserve encounter-based suggestions, manual edits, and existing export filenames. [^43]

- **Minimalist Mode (Midir 47):** Add a persistent default-off setting under Settings → Capture (moved from Performance in 47.a) that suspends live graph rendering during combat, reduces repeated live hit-history transmission, and bypasses dedicated healing and shield attribution. Retain full saved damage evidence, skill observations, encounter analysis and export contracts; mark incomplete healing explicitly. Exclude healing from reconstructed damage clocks and DPS graphs. Keep scatter plots saved-session-only. [^42]

- **Export inspection and burst comparison:** Make skill-row selections reliably highlight each recorded skill hit independently of a second selected highest/lowest hit; provide separate clear controls. Add an overlaid 30-second leaderboard chart alongside the existing side-by-side comparison, with enlarged dots, player visibility controls, skill and hit highlighting, and a common damage scale. Show each source recording's start date in Personal Bests and comparison HTML (with a legacy-cache fallback) to aid game-patch context. Preserve manual scanning, boss-only scoring, and original evidence. [^39]


- **Portable report skill inspection:** Add average individual hit between top-five and lowest hover values. Clicking or tapping a skill overlays its exact recorded hits on the scatter chart; selecting a top/lowest hit highlights the single indexed event and focuses its timestamp. Keep encounter and target filtering, underlying damage totals and Companion evidence unchanged. [^38]

- **Boss-only Arcana burst records:** Restrict manually updated 30-second personal-best leaderboards and comparison scatter to positively recognized boss targets, including linked boss forms within one window. Assign earlier shared-skill boss damage from Arcana evidence anywhere in its recognized encounter; allow different Arcanas in later encounters. Invalidate previously indexed all-target records without changing saved sessions or live capture. [^34]

- **Leaderboard comparison export:** Select up to eight players from one Arcana board (top five preselected) and export a self-contained side-by-side HTML comparison of their best recorded 30-second windows. Charts show timestamped individual hits and separate observed skill-use markers, with per-skill filtering, touch inspection, and synchronized zoom. Saved recordings are read only when Export is clicked; stale cached records are rejected rather than misrepresented. Rankings, live capture, and Companion v1 exports are unaffected. [^33]

- **Arcana burst leaderboards:** Added a separate Personal Bests view for best observed 30-second damage bursts across saved sessions, one ranked entry per normalized username on each of the ten Arcana boards. Opening the view never reads recordings. An explicit **Update Leaderboards** action checks for new/replaced saved sessions, shows a per-session progress bar, and incrementally caches results; Rebuild deliberately reindexes all. Precise hit evidence and observed Arcana skill IDs determine bursts without changing capture or live processing. [^32]

- **Damage Dealt dual DPS:** Show primary DPS with a subdued boss-only value in parentheses for selected run/encounter groups containing both recognized boss entities and other targets, in List and Cards. Single-target or boss-only selections retain their existing display. Player ordering, bar widths, damage totals, and DPS calculations are unchanged. [^30]

- **Encounter-scoped death flags:** Damage Dealt now displays saved death flags only within the selected target or grouped encounter’s observed time bounds; the complete-session view retains every flag. Missing time evidence does not borrow unrelated session deaths. The Damage Graph is unchanged. [^26]

- **Pet Race ID context:** Preserve verified pet Race IDs and race names on pet-attributed hit evidence. Scatter and portable HTML event labels identify the pet type when known, falling back to **Pets**; overall pet damage stays combined under skill `9999`. No buff/debuff conclusions are inferred from damage. [^25]

- **Pet damage labeling:** Display synthetic category `9999` as **Pet / Summon Effects** in aggregate skill tables and Companion metadata; individual scatter events retain the verified pet name or generic **Pets** fallback. Attribution and recorded IDs are unchanged. [^24]

- **Arcana appearance consistency:** Respect customized Appearance Settings colors in multi-Arcana gradients and encounter views. Use each recognized skill’s Arcana color for its damage bar, while shared skills inherit the player’s scoped solid color or mixed gradient in the application and HTML report; keep damage lengths unchanged. [^20]

- **Damage analysis:** Added interactive damage scatter, boss HP timelines, per-player skill breakdowns, and collapsible, reorderable player panels to make damage patterns easier to compare. [^1]
- **Ghost Runner:** Added a reference pace based on the median of nonzero 15-second damage buckets, shown on the graph and optionally as comparison fills in Damage Dealt. It represents a typical productive stretch, not an ideal rotation. [^1]
- **Death markers:** Added timeline markers and approximate damage/skill context around deaths. Values reconstructed from saved samples are estimates, not exact death-time snapshots. [^1]
- **Personal Best Progress:** Added per-skill comparisons against previous sessions for the same player and target, with a 5–200-session lookback and an optional read-only history folder. Comparisons are not an overall DPS ranking. [^1] [^13]
- **Healing Done:** Added healing summaries, largest-heal display, and defensive-effect estimates, including recognized Harmonic Saint caster handling and Veil of Life condition `999`. Suspicious values are screened; caster, skill, and shield attribution can remain uncertain. [^2]

- **Encounter-scoped Arcana:** Detect distinct Arcanas used during a session from observed skill evidence; resolve each selectable encounter independently. Full-session multi-Arcana views no longer retain the first Arcana label, and uncertain scopes stay unassigned rather than borrowing a different encounter’s identity. [^20]

- **Multi-Arcana presentation:** Load the backend Arcana registry through Vite raw JSON with explicit TypeScript types. Display all observed icons and smooth, customized-color gradients in full-session bars and portable reports, including three or more Arcanas in first-observed order when known. Individual encounters use their scoped icon/solid color; optional character-name coloring is preserved. Gradients do not represent damage or playtime proportions. [^20]

## Recording and saved sessions

- **Visible session saving:** Show a temporary **Saving Session…** entry and indeterminate progress indicator immediately after submission. Publish the completed session directly from the save response rather than scanning the entire history before and after saving. Keep the full NDJSON summary intact; send only compact sidebar metadata and preserve atomic temporary-file publication. [^27]

- **More reliable recordings:** Improved buffered NDJSON writes, capture boundaries, session counters, large-record reading (up to 32 MiB per line), and temporary-file publication to reduce incomplete saved sessions. [^3]
- **Session management:** Added opening a recording in the file manager, batch deletion with confirmation, and batch HTML export without leaking target selection between sessions. [^3]
- **Skill and hit evidence:** Recorded explicit local uses and remote observations with millisecond timestamps, plus damage-hit timing and target IDs where available. Older session records remain readable; multi-hit packets and effect cues do **not** automatically represent completed casts. [^4]
- **Pre-combat skill buffer:** Added an optional 0–30-second window (off by default) that carries up to 512 recent skill-use events into a new combat encounter, capturing preparation without continuously recording inactive combat. [^14]
- **Pet and puppet damage:** Attributed recognized pets and puppets to their owners so their damage contributes to the appropriate player totals; pet damage uses a dedicated skill category. [^15]
- **Enemy attack separation:** Named recognized boss attacks and exact-entity-matched minor-enemy sources (including numerically named Glenn Gwyllgi), with corroborated Race ID fallbacks; kept enemy attacks outside player DPS and Companion damage records. [^16]
- **Removed temporary diagnostics:** Retired the experimental healing diagnostic recorder and its UI. Historical diagnostic recordings remain independent files. [^2]

- **Suggested live session names:** Prefill editable dungeon names from recognized encounters, use verified Crom clears or observed unfinished attempts, and add reduced observed-player counts for Glenn/Bri (8) and Crom/Phantasm (4). Group Bri gates as one family; name partial clears by recorded cleared gate numbers, reserve `Bri` for Gates 1–3, and use `Bri Attempt` when no clear is verified. Use `Variety` with an observed participant count of one to eight for recordings with distinct recognized dungeon families; retain the timestamp fallback for unidentified recordings and preserve atomic save behavior. [^41]

## Portable HTML export and Companion data

- **Report filenames and halo labels:** Name single HTML downloads and batch ZIPs by the earliest included recording date and recognized encounter family, with generic fallbacks for mixed or unidentified encounters. Restore stacked contributor names and percentages on top-positioned Gate 3 halo tags without changing hover details or evidence. [^40]

- **Touch-friendly export and compact halo field:** Add two-finger chart zoom, touch pan and tap-to-inspect for recorded scatter points. Replace native single-line skill-stat hover text with dark report-styled popovers that support mouse, keyboard, and tap. Compress Gate 3's 80/60/40 fields into markers with small adjacent contributor summaries and contextual details; remove redundant guidance and the center label. Shrink wasted SVG space on narrow screens without changing the embedded evidence. [^31]

- **Exporter interaction and Gate 3 halo field:** Persist manually arranged player order across encounter selections (initially descending DPS), allow player reports to be fully minimized and individually restored, and add total-hit/highest-five/lowest-hit hover details from recorded evidence. Encounter All targets shows primary DPS with a subdued boss-only DPS value; boss-only selections retain their existing DPS. Gate 3 adds a collapsible three-phase halo field beneath player reports with zero-HP-confirmed halos, spawn-batch round colors, individual contribution leaderboards, and marker-local tooltips. Exclude positively identified off-phase Shards from Gate 3's all-target view without altering raw Companion evidence. [^29]

- **Self-contained reports:** Added portable HTML reports with damage scatter, boss HP search, Arcana-colored player panels, drag and keyboard reordering, and embedded Companion-compatible data. The separate JSON download control was retired; its data remains in the HTML. [^5]
- **Target-aware reporting:** Added boss-only and all-target scopes using recorded entity IDs, with separate damage and HP calculations. Gate 1 exports preserve both Vertrag forms’ raw HP histories as well as the continuous logical timeline. Missing historical target details cannot be reconstructed. [^5] [^6]
- **Skill evidence export:** Added distinct streams for explicit skill uses, damage hits, and typed skill observations (`0x6988`, `0x7926`, `0x9093`, `0x9095`), allowing the Companion to correlate evidence without inventing cast counts. [^4]
- **Clearer report controls:** Replaced duplicate encounter entries with an encounter selector and a separate target-scope selector; labeled outcomes **Cleared** or **Attempted**; removed the visible Skill Use Timeline and redundant boss chart checkboxes while retaining the underlying data. [^5]
- **Encounter compatibility:** Embedded logical boss encounters, phase HP, death/revival evidence, entity provenance, per-encounter Arcana evidence, mixed-color/multi-icon Arcana summaries, and conservative clear evidence without removing older Companion fields. [^5] [^20]

## Dungeon encounters and target grouping

- **Bri Leith — Gate 1:** Associated Vertrag's two forms (`7600` → `7601`) within each attempt, displaying a continuous 100%→50%→0 HP progression. The combined Vertrag row and each form are selectable; Ancient Giants and other mechanics stay outside boss-only HP. [^6]
- **Bri Leith — Gate 3:** Grouped Shards of Solace using observed HP families and timing near boss thresholds, keeping ambiguous entities outside named wave groups. [^7]
- **Glenn Bearna:** Separated Unfinished Reverie (`7585`, 100%→10%) from the shared 100%→0% boss encounter comprising Reverie (`7586`, 100%→60%) and The Winter Tyrant (`7587`, 60%→0%). Kept all-boss and individual views. Cailleach (`7575`, 100%→90%) and her entrance barriers belong to the opening encounter; Icicle Sprites belong with minor enemies. [^8]
- **Crom Bas:** Grouped Irusan (`193364`) with the recorded Glas variant—Completed (`193358`) or Giga (`193359`). Merch Diafol and all colored Disciples are selectable mechanics, excluded from boss HP. [^9]
- **High-tier dungeon grouping:** Kept Crom Bas Abyss Folamh (`193810`) and Bri Leith Gate 4 Midir the Lost (`7615`) as boss-only, attempt-bounded selections. Grouped known associated enemies by name and approximate run segment under provisional Minor Enemies folders, without asserting HP phases or mechanics. Additional possible boss forms remain unassigned. [^7] [^19]
- **Unified dungeon runs:** Combined each Crom Bas or Glenn Bearna run's bosses, opening encounters (where present), and minor enemies into a numbered run folder while retaining individual selections. Run assignment follows recorded entities and timing rather than assuming every similarly named enemy belongs to one attempt. Shared-race Phantasm Wraiths no longer create false Crom Bas combat segments. [^10]
- **Fahmes Ruin:** Organized independently enterable stages into selectable stage and sequential level views. Each level aggregates its recorded enemies, including overlapping waves, without imposing an invented boss or stage-clear packet. Complete 150-enemy stages retain all five level selections even when delayed spawns defeat the initial timing heuristic. [^18]
- **Alby Shineseeker:** Organized enemies into five waves, from rats and bats through Cichol's Followers, with individual-wave and complete-run views. The final-wave status reflects the defeat of recorded Followers, not a separate dungeon-clear packet. [^11]
- **Rabbie Phantasm:** Grouped each recorded run with selectable Queen boss and minor-enemy sections. The four named Succubi appearing with the Queen form one boss-mechanics selection, separate from boss-only damage and HP; earlier colored Succubi remain minor enemies. Confirmed Normal and Temptation's Path Queens are recognized separately; other Queen race IDs require supporting dungeon context and remain unverified. Queen-only runs omit the named-Succubi mechanics group; Fiends and Wraiths summoned in the Normal Queen room remain selectable under Boss-room Enemies. [^17]

## Source references

References identify relevant files in the Midir source, not specific commits. The historical feature descriptions were also reconciled with the earlier Midir-41 changelog; older `RELEASE-*.md` and `FEATURE-CHANGELOG.md` notes are not treated as independently current documentation.

[^1]: Combat UI, graph, and player comparisons: [`DamageMeterView.vue`](front/src/components/DamageMeterView.vue), [`DamageGraph.vue`](front/src/components/DamageGraph.vue), [`applyDamageBySkill.vue`](front/src/components/applyDamageBySkill.vue). Earlier development notes also document Ghost Runner, death markers, and Personal Best Progress.
[^2]: Healing and defensive-effect handling: [`healingPacket.go`](packet/healingPacket.go), [`aggregator.go`](cmd/dilmeterapi/aggregator.go), [`applyHealingBySkill.vue`](front/src/components/applyHealingBySkill.vue).
[^3]: Saved sessions: [`sessionManager.go`](cmd/dilmeterapi/sessionManager.go), [`httpHandlerSession.go`](cmd/dilmeterapi/httpHandlerSession.go), [`SessionPanel.vue`](front/src/components/SessionPanel.vue).
[^4]: Skill recording, timestamps, and observations: [`eventPublisher.go`](cmd/dilmeterapi/eventPublisher.go), [`event.go`](cmd/dilmeterapi/event.go), [`portableReport.ts`](front/src/utils/portableReport.ts).
[^5]: HTML reporting and Companion metadata: [`portableReport.ts`](front/src/utils/portableReport.ts), [`companionExport.ts`](front/src/utils/companionExport.ts).
[^6]: Gate 1: [`gate1Encounter.ts`](front/src/utils/gate1Encounter.ts), [`targetGrouping.ts`](front/src/utils/targetGrouping.ts).
[^7]: Earlier encounter recognition: [`reportEncounters.ts`](front/src/utils/reportEncounters.ts), [`targetGrouping.ts`](front/src/utils/targetGrouping.ts).
[^8]: Glenn Bearna: [`glennEncounter.ts`](front/src/utils/glennEncounter.ts), [`glennOpening.ts`](front/src/utils/glennOpening.ts), [`glennMinorEnemies.ts`](front/src/utils/glennMinorEnemies.ts).
[^9]: Crom Bas: [`cromEncounter.ts`](front/src/utils/cromEncounter.ts), [`mechanicGroups.ts`](front/src/utils/mechanicGroups.ts).
[^10]: Run association: [`dungeonRunFolders.ts`](front/src/utils/dungeonRunFolders.ts), [`instanceMinorGrouping.ts`](front/src/utils/instanceMinorGrouping.ts), [`targetGrouping.ts`](front/src/utils/targetGrouping.ts).
[^11]: Alby Shineseeker: [`albyShineseeker.ts`](front/src/utils/albyShineseeker.ts).
[^12]: Build automation: [`.github/workflows/build-validation.yml`](.github/workflows/build-validation.yml), [`scripts/check-node-security.cjs`](scripts/check-node-security.cjs).
[^13]: Personal Best history controls: [`SettingsView.vue`](front/src/components/SettingsView.vue), [`store.ts`](front/src/store.ts), [`httpHandlerSession.go`](cmd/dilmeterapi/httpHandlerSession.go).
[^14]: Pre-combat buffer and configuration: [`eventPublisher.go`](cmd/dilmeterapi/eventPublisher.go), [`api_setup.go`](cmd/dilmeterapi/api_setup.go), [`SettingsView.vue`](front/src/components/SettingsView.vue).
[^15]: Pet and puppet attribution: [`aggregator.go`](cmd/dilmeterapi/aggregator.go), [`aggregator_test.go`](cmd/dilmeterapi/aggregator_test.go).
[^16]: Enemy attack separation: [`DamageScatterChart.vue`](front/src/components/DamageScatterChart.vue), [`enemyScatter.ts`](front/src/utils/enemyScatter.ts), [`companionExport.ts`](front/src/utils/companionExport.ts).

[^17]: Rabbie Phantasm run grouping: [`phantasmEncounter.ts`](front/src/utils/phantasmEncounter.ts), [`targetGrouping.ts`](front/src/utils/targetGrouping.ts), [`DamageMeterView.vue`](front/src/components/DamageMeterView.vue).

[^18]: Fahmes Ruin stage and level reconstruction: [`fahmesRuin.ts`](front/src/utils/fahmesRuin.ts), [`targetGrouping.ts`](front/src/utils/targetGrouping.ts), [`DamageMeterView.vue`](front/src/components/DamageMeterView.vue).

[^19]: Conservative Abyss and Gate 4 grouping: [`targetGrouping.ts`](front/src/utils/targetGrouping.ts), [`DamageMeterView.vue`](front/src/components/DamageMeterView.vue), [`reportEncounters.ts`](front/src/utils/reportEncounters.ts), [`highTierMinorGrouping.ts`](front/src/utils/highTierMinorGrouping.ts), and bundled [`races.json`](cmd/dilmeterapi/static_data/races.json).
[^20]: Encounter Arcana resolution: [`arcanaEncounter.ts`](front/src/utils/arcanaEncounter.ts), [`applyDamageBySkill.vue`](front/src/components/applyDamageBySkill.vue), [`DamageGraph.vue`](front/src/components/DamageGraph.vue), [`portableReport.ts`](front/src/utils/portableReport.ts), [`companionExport.ts`](front/src/utils/companionExport.ts), and [`talents.json`](cmd/dilmeterapi/static_data/talents.json).
[^21]: Frontend build configuration: [`front/package.json`](front/package.json), [`front/src/apicall.ts`](front/src/apicall.ts), [`front/src/App.vue`](front/src/App.vue), [`build.bat`](build.bat), and [`build.sh`](build.sh).

[^22]: Npcap capture-mode preference: [`cmd/dilmeterapi/main.go`](cmd/dilmeterapi/main.go), [`cmd/dilmeterapi/api_setup.go`](cmd/dilmeterapi/api_setup.go), [`cmd/dilmeterapi/capture_promiscuous_test.go`](cmd/dilmeterapi/capture_promiscuous_test.go), and [`packet/gamePacketReader.go`](packet/gamePacketReader.go).

[^23]: Go test expectations: [`aggregator_test.go`](cmd/dilmeterapi/aggregator_test.go), [`overshield_attribution_test.go`](cmd/dilmeterapi/overshield_attribution_test.go); implementation in [`aggregator.go`](cmd/dilmeterapi/aggregator.go).

[^24]: Pet category display: [`App.vue`](front/src/App.vue), [`DamageScatterChart.vue`](front/src/components/DamageScatterChart.vue), [`applyDamageBySkill.vue`](front/src/components/applyDamageBySkill.vue), [`applyHealingBySkill.vue`](front/src/components/applyHealingBySkill.vue), [`DamageTakenBySource.vue`](front/src/components/DamageTakenBySource.vue), [`portableReport.ts`](front/src/utils/portableReport.ts), [`companionExport.ts`](front/src/utils/companionExport.ts).

[^25]: Pet Race ID source evidence: [`aggregator.go`](cmd/dilmeterapi/aggregator.go), [`httpHandlerSession.go`](cmd/dilmeterapi/httpHandlerSession.go), [`summary.go`](cmd/dilmeterapi/summary.go), [`scatterTargets.ts`](front/src/utils/scatterTargets.ts), [`DamageScatterChart.vue`](front/src/components/DamageScatterChart.vue), [`portableReport.ts`](front/src/utils/portableReport.ts), and bundled [`races.json`](cmd/dilmeterapi/static_data/races.json).

[^26]: Damage Dealt death-flag selection: [`applyDamageBySkill.vue`](front/src/components/applyDamageBySkill.vue), [`deathScope.ts`](front/src/utils/deathScope.ts), [`targetGrouping.ts`](front/src/utils/targetGrouping.ts), and [`death-scope.test.cjs`](front/tests/death-scope.test.cjs).

[^27]: Live-session saving and pending UI: [`sessionManager.go`](cmd/dilmeterapi/sessionManager.go), [`session_save_result_test.go`](cmd/dilmeterapi/session_save_result_test.go), [`httpHandlerSession.go`](cmd/dilmeterapi/httpHandlerSession.go), [`apicall.ts`](front/src/apicall.ts), [`App.vue`](front/src/App.vue), [`SessionPanel.vue`](front/src/components/SessionPanel.vue), and [`store.ts`](front/src/store.ts).

[^28]: Maintenance-only refactor and regression coverage: [`arcanaEncounter.ts`](front/src/utils/arcanaEncounter.ts), [`petLabels.ts`](front/src/utils/petLabels.ts), [`front/tests/arcana-scopes.test.cjs`](front/tests/arcana-scopes.test.cjs), [`front/tests/pet-labels.test.cjs`](front/tests/pet-labels.test.cjs), [`front/package.json`](front/package.json), [`.github/workflows/build-validation.yml`](.github/workflows/build-validation.yml), and [`README.md`](README.md).

[^29]: Portable exporter controls and hover statistics: [`portableReport.ts`](front/src/utils/portableReport.ts); Gate 3 zero-HP halos and spawn-batch grouping: [`gate3HaloReport.ts`](front/src/utils/gate3HaloReport.ts), [`mechanicGroups.ts`](front/src/utils/mechanicGroups.ts); exporter scope regression: [`exporter-scopes.test.cjs`](front/tests/exporter-scopes.test.cjs).

[^30]: Damage Dealt dual DPS display: [`bossDpsDisplay.ts`](front/src/utils/bossDpsDisplay.ts), [`applyDamageBySkill.vue`](front/src/components/applyDamageBySkill.vue), and [`boss-dps-display.test.cjs`](front/tests/boss-dps-display.test.cjs); existing encounter recognition in [`reportEncounters.ts`](front/src/utils/reportEncounters.ts).

[^31]: Portable HTML touch and compact halo presentation: [`portableReport.ts`](front/src/utils/portableReport.ts), [`exporter-scopes.test.cjs`](front/tests/exporter-scopes.test.cjs).

[^32]: Midir 46 Arcana 30-second burst indexes: [`burstLeaderboard.ts`](front/src/utils/burstLeaderboard.ts), [`PersonalBestsView.vue`](front/src/components/PersonalBestsView.vue), [`App.vue`](front/src/App.vue), [`burst-leaderboard.test.cjs`](front/tests/burst-leaderboard.test.cjs), [`arcanaEncounter.ts`](front/src/utils/arcanaEncounter.ts).

[^33]: Arcana burst comparison: [`burstComparisonExport.ts`](front/src/utils/burstComparisonExport.ts), [`burstLeaderboard.ts`](front/src/utils/burstLeaderboard.ts), [`PersonalBestsView.vue`](front/src/components/PersonalBestsView.vue), and [`burst-comparison.test.cjs`](front/tests/burst-comparison.test.cjs).

[^34]: Boss-only burst indexing and encounter-wide Arcana attribution: [`burstLeaderboard.ts`](front/src/utils/burstLeaderboard.ts), [`reportEncounters.ts`](front/src/utils/reportEncounters.ts), [`burstComparisonExport.ts`](front/src/utils/burstComparisonExport.ts), [`PersonalBestsView.vue`](front/src/components/PersonalBestsView.vue), [`burst-leaderboard.test.cjs`](front/tests/burst-leaderboard.test.cjs), [`burst-comparison.test.cjs`](front/tests/burst-comparison.test.cjs).

[^35]: Leaderboard comparison TypeScript import: [`burstComparisonExport.ts`](front/src/utils/burstComparisonExport.ts), with the shared type defined in [`burstLeaderboard.ts`](front/src/utils/burstLeaderboard.ts).

[^36]: Leaderboard cache and source matching: [`sessionManager.go`](cmd/dilmeterapi/sessionManager.go), [`burstLeaderboard.ts`](front/src/utils/burstLeaderboard.ts), [`burstComparisonExport.ts`](front/src/utils/burstComparisonExport.ts), [`PersonalBestsView.vue`](front/src/components/PersonalBestsView.vue), and their regression tests.

[^37]: Shared leaderboard-window selection and export verification: [`burstLeaderboard.ts`](front/src/utils/burstLeaderboard.ts), [`burstComparisonExport.ts`](front/src/utils/burstComparisonExport.ts), [`PersonalBestsView.vue`](front/src/components/PersonalBestsView.vue), [`burst-comparison.test.cjs`](front/tests/burst-comparison.test.cjs).

[^38]: Portable report skill inspection: [`portableReport.ts`](front/src/utils/portableReport.ts), [`exporter-scopes.test.cjs`](front/tests/exporter-scopes.test.cjs).

[^39]: Session-export highlighting, 30-second burst overlay, and recording dates: [`portableReport.ts`](front/src/utils/portableReport.ts), [`burstComparisonExport.ts`](front/src/utils/burstComparisonExport.ts), [`burstLeaderboard.ts`](front/src/utils/burstLeaderboard.ts), [`PersonalBestsView.vue`](front/src/components/PersonalBestsView.vue), [`exporter-scopes.test.cjs`](front/tests/exporter-scopes.test.cjs), and [`burst-comparison.test.cjs`](front/tests/burst-comparison.test.cjs).

[^40]: Portable report download naming and halo presentation: [`reportExportNaming.ts`](front/src/utils/reportExportNaming.ts), [`SessionPanel.vue`](front/src/components/SessionPanel.vue), [`portableReport.ts`](front/src/utils/portableReport.ts), [`report-export-naming.test.cjs`](front/tests/report-export-naming.test.cjs), and [`exporter-scopes.test.cjs`](front/tests/exporter-scopes.test.cjs).

[^41]: Live session naming: [`sessionSaveNaming.ts`](front/src/utils/sessionSaveNaming.ts), [`App.vue`](front/src/App.vue), [`session-save-naming.test.cjs`](front/tests/session-save-naming.test.cjs), and the existing [`reportEncounters.ts`](front/src/utils/reportEncounters.ts) clear classifier.

[^42]: Minimalist Mode: [`minimalist.go`](cmd/dilmeterapi/minimalist.go), [`aggregator.go`](cmd/dilmeterapi/aggregator.go), [`eventPublisher.go`](cmd/dilmeterapi/eventPublisher.go), [`sessionManager.go`](cmd/dilmeterapi/sessionManager.go), [`httpHandlerState.go`](cmd/dilmeterapi/httpHandlerState.go), [`httpHandlerSession.go`](cmd/dilmeterapi/httpHandlerSession.go), [`SettingsView.vue`](front/src/components/SettingsView.vue), [`DamageMeterView.vue`](front/src/components/DamageMeterView.vue), [`DamageGraph.vue`](front/src/components/DamageGraph.vue), [`minimalistMode.ts`](front/src/utils/minimalistMode.ts), [`minimalist_test.go`](cmd/dilmeterapi/minimalist_test.go), [`minimalist_integration_test.go`](cmd/dilmeterapi/minimalist_integration_test.go), and [`minimalist-mode.test.cjs`](front/tests/minimalist-mode.test.cjs).

[^43]: Session name formatting and preferences: [`sessionNameFormat.ts`](front/src/utils/sessionNameFormat.ts), [`store.ts`](front/src/store.ts), [`SettingsView.vue`](front/src/components/SettingsView.vue), [`App.vue`](front/src/App.vue), [`session-save-naming.test.cjs`](front/tests/session-save-naming.test.cjs).

[^44]: Group Run Scheduler: [`sessionNameFormat.ts`](front/src/utils/sessionNameFormat.ts), [`RunCountSettings.vue`](front/src/components/RunCountSettings.vue), [`SettingsView.vue`](front/src/components/SettingsView.vue), [`App.vue`](front/src/App.vue), and [`session-save-naming.test.cjs`](front/tests/session-save-naming.test.cjs).

[^45]: Session bundles: [`sessionBundle.ts`](front/src/utils/sessionBundle.ts), [`batchZip.ts`](front/src/utils/batchZip.ts), [`portableReport.ts`](front/src/utils/portableReport.ts), [`recordingIdentity.go`](cmd/dilmeterapi/recordingIdentity.go), [`sessionHeader.go`](cmd/dilmeterapi/sessionHeader.go), [`sessionManager.go`](cmd/dilmeterapi/sessionManager.go), [`session-bundle.test.cjs`](front/tests/session-bundle.test.cjs), and [bundle specification](SESSION-BUNDLE-SPEC.md).
