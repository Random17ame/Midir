# Skill Recording & Portable Export — Developer Reference (Midir-49.a)

**Purpose:** Current data contract and best-supported packet interpretations for the Companion. This document describes **what the source does now**, rather than every experiment that led here. Superseded hypotheses are omitted, and unverified dungeon/packet interpretations are marked explicitly. Build success alone does not validate inferred gameplay mechanics.

## 1. Pipeline and source map

1. **Observe packets:** `cmd/dilmeterapi/eventPublisher.go` captures combat-gated player skill uses and bounded remote evidence. `cmd/dilmeterapi/event.go` defines saved NDJSON event IDs and fields.
2. **Reconstruct sessions:** `cmd/dilmeterapi/httpHandlerSession.go` reads saved events into player skill-use, observation, damage, and encounter data (`summary.go`).
3. **Export HTML or session bundle:** `front/src/utils/portableReport.ts` writes one JSON payload into `<script type="application/json" id="data">`; `companionExport.ts` retains the embedded Companion v1 structure. No separate JSON download is required for HTML. Midir 49.a produces one manifested ZIP of complete standalone HTML reports, using lossless DEFLATE or STORE. Companion should preserve the full extracted HTML for its existing report viewer.
4. **Interpret offline:** The Companion should correlate packet evidence, hits, target identities, and phases **without treating every row as a completed cast**.

The report currently displays **Damage Scatter & Boss HP**. It has one encounter selector and a separate Boss only / All targets option, player-only chart filters, and **Cleared / Attempted** labels. The old Skill Use Timeline UI and enemy-origin chart checkboxes were removed; their raw analytical evidence was not intentionally deleted.

**Portable report interactions:** On touch screens, a two-finger pinch changes the chart time window, a one-finger drag pans it, and a tap inspects the closest visible scatter marker. Skill DPS, highest-hit, and hits/min values use dark report-styled detail popovers on hover, keyboard focus or tap; the same popover presents per-halo contribution details. Highest-hit popovers list up to five exact hits, the average of available in-scope individual hits, then the lowest. Selecting a skill highlights every available exact damage-hit event from that player/skill in the currently selected target scope; selecting a top/lowest hit adds a second marker at its exact millisecond timestamp and focuses the scatter window. Each hit carries an optional original per-player `eventIndex` in the report JSON for stable selection, including equal damage values. When individual-hit evidence is absent, skill selection can still outline associated aggregated scatter buckets, but does not invent exact hit values, rankings or timestamps. Gate 3 displays compact halo markers with adjacent top contributors, no center label, and inferred rotation colors. These interactions do not alter recorded damage, boss HP, attribution, saved NDJSON or the separate Companion v1 payload.

**Download naming (46.h):** Standard single HTML reports and batch ZIPs use `MM DD YY Encounter Family` in the same local time zone as the saved-session list. The earliest successfully exported recording supplies the date; a batch of Bri Leith gates uses `Bri Leith` once. Distinct recognized families, or a mix of recognized and unidentified reports, use `Mixed Encounters`; wholly unidentified exports use `Combat Report` / `Combat Reports`. Missing timestamps fall back to saved-session metadata, then omit the date. Classification reuses existing encounter/run recognizers, respects single-report target selection, and never uses editable session titles as evidence. The ZIP member names, embedded titles, Companion payload and Personal Bests exports are unchanged. Top halo tags use a dedicated CSS class rather than the report totals grid, preserving stacked name/share rows and their existing detail popovers.

**Session bundle interoperability (49/49.a):** Bulk export produces one universal ZIP of complete standalone HTML and root `manifest.json`; native raw DEFLATE (method 8) is used when available and smaller, otherwise STORE (method 0). The original 49 data-only option is retired; the v1 manifest schema retains its payload enum for backward compatibility. Manifest v1 is independent of Companion and the existing v1 evidence streams. The exact uncompressed HTML is retained for independent and embedded viewing. Saved recordings have additive stable `recordingId` metadata: random once at new save, or a deterministic normalized original-event SHA-256 for historical recordings. Identity is independent of filenames, export times and scope; scope and payload hash distinguish variants/revisions. Export metadata is additive and does not modify existing Companion fields. SHA-256 hashes are optional when Web Crypto is unavailable; ZIP CRC remains present. No export writes to historical recordings. Explicit migration preserves event bytes and identity. See [bundle specification](SESSION-BUNDLE-SPEC.md) for exact paths, hashing, identity normalization, consumer validation, and legacy limitations; see [verification](SESSION-BUNDLE-VERIFICATION.md) for actual tests and pending integrated checks.

**Live session name suggestions (46.i):** The Save Session dialog prefills an editable name using the same recognized encounter families as report naming. Full observed groups default to `Glenn`, `Phantasm`, or `Bri` (with all three standard gate clears recorded); below eight (Glenn/Bri) or four (normal Crom/Phantasm), append the unique observed participant count (`Glenn 6p`, `Bri 4p`, `Phantasm 3p`, `Crom Clear 3p`). Count real player IDs with positive damage, healing, overshield, damage taken or observed skill activations; deduplicate across streams and exclude anonymous/synthetic rows and nearby-only entities. This is a session-wide observation, not an authoritative party roster. Normal Crom uses `Clear` only when all recognized boss attempts have verified terminal Glas zero HP; `Fail` is an editable shorthand for consistently unfinished attempts with observed positive boss HP, not proof of a wipe. Mixed outcomes or missing HP use `Crom` without an outcome. Two or more distinct recognized dungeon families suggest `Variety Np` when the recording-wide unique observed participant count is one through eight (including eight); otherwise suggest `Variety`. This does not establish a simultaneous party size, and roster changes can inflate the count. Do not rank families by duration or attempt count. Repeated runs of one recognized family retain dungeon-specific naming; unidentified sessions retain the timestamp fallback and Abyss remains separately named. Bri gates are a single family for both naming paths. For Bri-only save suggestions, collect distinct gates with existing observed-zero-HP clear results (Gate 1 requires the linked replacement form). All of Gates 1–3 cleared, with no Gate 4 clear, suggest `Bri`; otherwise list only cleared gate numbers in ascending order (`Gate 1 & 2 4p`, `Gate 2 & 3 6p`, `Gate 4 4p`), including Gate 4 explicitly if cleared. With no verified gate clear, use `Bri Attempt`; this is not proof of failure. Repeated attempts do not remove an earlier recorded clear, and an unrecorded gate is not inferred from a later one. Counts remain recording-wide; full observed eight-player groups omit the suffix for Bri-only names. Report download naming is unchanged. The historical selection is never used to name a live save. No changes to capture, reconstruction, atomic save behavior, existing files, or Companion evidence.

**Session naming and Group Run Scheduler (48):** Settings → Appearance → Session Naming retains the `midir_session_naming_v1` local-storage key. Normalize missing preferences to date/time on, general run count off, daily counting, no schedules; preserve 47.b templates, weekday labels and all-days override as fallback. `sessionNameFormat.ts` defines local recording-start-based presentation rules. Date/time tokens describe the actual recording start (`MM/DD/YY`, `h:mma/p`); missing start falls back to current local time. `GroupSchedule` stores enabled, literal label, selected start weekdays, local start/end clocks, template and independent `CountRule`. Match enabled valid rules in list order with half-open windows `[start,end)`, including previous-day starts for overnight windows. Equal clocks mean 24 hours; use local calendar construction for day/week boundaries, including daylight-saving transitions (native Date semantics). Invalid or disabled rules do not match. First match overrides fallback template and default switches; priorities are editable by moving rows. Templates accept `{encounter}`, `{label}`, `{weekday}`, `{run}`, `{date}`, `{time}`; the weekday token is the actual recording weekday, and group labels are not guild-membership evidence. Date/time and run switches apply to default names only. Preview examples use sample starts and run 1, with group previews evaluated in isolation.

**Run numbering:** Fetch saved-session metadata only when the active template contains `{run}` or the default run switch is enabled; failed metadata requests omit the number with a warning. Count unique non-live saved IDs with valid starts, plus one. Daily and weekly counts use full local calendar periods, with a configurable weekly reset day and time (default Thursday 07:00). Rolling counts include starts from the previous configurable 1–168 elapsed hours through the current start. Scheduled-window counts reset for each start-day occurrence; outside a matching schedule the general scheduled mode falls back to daily. Within a matched group, filter historical metadata through the same current priority rules and count only the same group; weekly or rolling group periods can span multiple occurrences. No saved group membership, persistent sequence counter, or cross-client uniqueness guarantee is implied. Deletions can reuse numbers and changing schedules can change historical membership for subsequent numbering. Legacy 47.b fallback templates use the general counting rule (daily by default). All suggestions are manually editable; no changes to saved filenames, combat data, encounter recognition, exporters or Companion evidence.

### Minimalist Mode — Midir 47

Settings → Capture → Minimalist Mode (moved from Performance in 47.a) enables the persistent, default-off `minimalist-mode.json` preference (`GET`/`PUT /api/state/minimalist`). Mode changes do not restart or alter capture. The normal one-second live meter cadence remains. Live chart rendering is unmounted when a damage-tracked target is active and there has been combat activity within 15 seconds; death/disappearance or inactivity releases it. New combat activity pauses again. This is a UI heuristic, not encounter completion evidence. Chart-only controls may reset when the graph remounts. The scatter chart is saved-session-only in both modes; the live backend does not currently produce the reconstructed saved-session DPS graph.

During suspension, only the periodic live `FightSummary` is marked `liveCompact` and its per-player `damageEvents` contains the first timestamped hit per skill (stable ties), for session Arcana ordering. Exact hits, skill-use groups, explicit activations, target damage, conditions, HP, death evidence and raw skill observations are retained by the original recording paths. Full live REST summaries and save/reconstruction paths do not project the hits; single and batch HTML exports read saved recordings, and exact-hit exporters/indexing reject compact live summaries. `minimalistMode`, `liveChartPaused`, and `liveCompact` are transient optional flags, not saved-session evidence. Saved review is unaffected by the current preference. No Companion v1 or leaderboard cache schema change.

Confirmed dedicated healing packets and healing-only negative damage records are skipped while enabled; mixed signed events with mana damage retain their original raw evidence. Shield attribution is bypassed, not the raw condition stream. The session header has optional `healingIncomplete: true`, sticky for any recording during which the mode was enabled; it survives save/reload, migration, and toggling off. Existing partial healing is not deleted, but the Healing Done view is unavailable and HTML reports show an explicit warning. A new normal recording resets the flag; absent flags on legacy files retain prior behavior. Observed participant counts can miss heal-only participants. Saved damage clocks and rolling/cumulative DPS graphs exclude negative healing events in both modes, including older recordings; this corrects previously healing-dependent timeline values without editing recorded positive damage. Do not interpret the absence of healing as zero healing performed.

Validation: frontend regression suite and isolated Go helpers cover flag isolation, earliest-hit projection, idle/resume behavior, damage-only clocks and export/index guards. Integrated Go fixtures compare saved reconstruction and persistent healing provenance; full Go/build and runtime validation require the supported project toolchains. Actual PC resource savings and game frame rates are unmeasured.

### Personal Bests — independent Arcana burst index (Midir 46)

The **Personal Bests** view is separate from the combat meter, saved-session
comparison tool, portable HTML report and Companion payload. It reads no
session data on opening and performs no monitoring, timer polling, or work
on the live-save/capture paths. The user must select **Update Leaderboards**.
A progress bar then counts newly discovered/replaced sessions as they are
processed; **Rebuild** intentionally discards the cache and reindexes existing
saved recordings. The index is kept in browser-local storage and can be
recreated from the NDJSON recordings; it is not a portable records database.

The burst algorithm uses positive, timestamped `players[].damageEvents` and a
rolling 30,000 ms window. **Only hits with an exact target entity ID belonging
to a positively recognized boss encounter count.** Damage to adds, mechanics,
other enemies or unrecognized targets does not contribute. Linked boss forms
within a recognized encounter can contribute to the same 30-second window;
there is no separate entity-by-entity ranking requirement. A bossless run,
such as Alby Shineseeker, produces no eligible boss burst.

A player cannot change Arcana during a single recognized encounter. Arcana-
specific damage-hit skill IDs and explicit skill activations observed **anywhere
within that encounter's time bounds** establish its Arcana, including for earlier
shared-skill or pet damage to the boss. A different encounter in the same
recording may establish another Arcana. Conflicting or missing Arcana evidence
for a boss encounter is not guessed; in multi-boss report encounters with
conflicting evidence, independently evidenced boss intervals can still qualify.
Timing and boss membership use the existing `findReportEncounters` recognition,
not a new Race-ID-only heuristic. A 30-second burst measures **damage, not uses
or casts**. Older recordings with insufficient target attribution or Arcana
and hit evidence may contribute no eligible burst.

Midir 46.b increments the browser-local index version so cached all-target
results from 46/46.a are discarded. **Update Leaderboards** then explicitly
reindexes saved recordings with the boss-only rule; opening the page still
performs no scan or background work.

Each saved session is cached by its actual `.ndjson` filename, recorded time
bounds, file size and filesystem modification time; a manual update processes
only new/changed signatures. Midir 46.d increments the index version to adopt
this source-file identity, requiring one new manually initiated index pass. Rankings deduplicate normalized
usernames **per Arcana**, keeping the greatest observed 30-second damage
window for each user. Distinct Arcanas have independent leaderboards.
Removing a recording also removes its cached result on the next manual
update. No raw hits, displayed encounter totals, or Companion data are
changed by this feature. Implemented in `front/src/utils/burstLeaderboard.ts`
and `front/src/components/PersonalBestsView.vue`.

### Leaderboard comparison overlay and recording dates (Midir 46.g)

The normal side-by-side burst export is retained. An optional **Overlay**
mode aligns each selected player's independent, recorded 30-second window
at 0–30 s on one scatter chart, with a common hit-damage scale and larger
hit markers. Legend toggles show or hide players. Skill-wide selection and a
specific recorded hit are separate optional highlights, with independent
clear controls; neither changes hit eligibility, rankings, or skill uses.
The standard session HTML report offers the same two-layer selection: clicking
or tapping a skill row highlights all supported recorded hits for that skill;
choosing a highest/lowest event adds a separate exact-hit marker. Historical
sessions without precise hits retain only their available aggregate highlights.

The Personal Bests leaderboard now shows the **original recording start date**,
not the indexing date or selected burst's start. Newly indexed entries may
retain `sessionStartMs`; existing v3 caches derive it from the stored session
signature without rereading the file. Unknown recording dates are shown as
unavailable instead of guessed. The comparison HTML embeds optional
`sessionStartMs` (absolute Unix milliseconds) per player and displays that
date/time. This is contextual patch-era information, not proof of a game
version or patch identifier.

### Personal Bests — on-demand comparison HTML (Midir 46.a)

The leaderboard screen allows up to eight **distinct usernames** to be selected
from a single Arcana (initially the five highest-ranked players). **Export
Comparison** reads only the selected winners' saved-session summaries, one
unique session ID at a time, with a progress indicator. Opening Personal Bests
or changing Arcana never triggers an export or background re-read. Results
remain browser-local until the user saves the self-contained comparison HTML.

The report aligns each player's **own** winning 30,000 ms window to its own
0–30 s x-axis. Each card contains the verified leaderboard rank, damage, DPS,
recorded hit count and session name. Skill rows summarize damage, hit count and
separately observed explicit `skillActivations`; toggling a row filters the
plotted skill markers, not the total damage or ranking. Damage circles are
individual millisecond hits and diamonds are recorded explicit use markers;
no use is synthesized from hits, and no Companion `midir-companion` payload is
inserted into this *comparison-only* HTML. Mouse hover, keyboard focus, touch
tap, wheel zoom, pinch zoom, and a shared reset control operate within the
static exported report without remote dependencies.

The lightweight cache holds only the best-burst reference (player name and
recorded entity ID, Arcana, timestamps, damage, session filename). When exporting, Midir recomputes
that player/Arcana burst from the original session and requires a matching
window start, hit count and damage before showing event details. On a mismatch, Export refreshes **only** that recording
from disk (if it is still available) and prompts the user to review the updated
rank and explicitly export again. It never silently substitutes a new window. Only boss-targeted hits
belonging to the winning recognized encounter appear. Skill-use observations
are limited to that encounter and are never inferred from recorded hits. Multiple
players from one saved recording require only one API fetch. This report does
not alter saved NDJSON or the portable encounter report/Companion contract.

Implementation: `front/src/utils/burstComparisonExport.ts`, shared segment
reconstruction in `burstLeaderboard.ts`, manual selection in
`PersonalBestsView.vue`, `front/tests/burst-comparison.test.cjs`.

## 2. Packet identifiers and how to read them

| Opcode | Observed meaning | Saved representation | Interpretation limit |
|---|---|---|---|
| `0x6988` | Explicit **Skill Use** packet for an identified player | `EventId: 8` with `Id`, `SkillId`, `At`, `AtMs`, optional `TargetId` | A message is evidence of use, **not universally one completed cast**. |
| `0x698c` | **Skill Start** contributes to combat timing | No dedicated saved skill-start event | Do not infer a use event from its absence in NDJSON. |
| `0x7926` | Combat Action subpacket can contain attacker entity ID, skill ID, action type | `EventId: 11`, `actorVerified: true` when attacker is a known player | One skill-bearing subpacket can describe one action stage or hit, not one cast. |
| `0x9093` | General **Effect** messages, including visual/audio/status cues and sometimes typed skill IDs | `EventId: 11` with `fields`, `fieldTypes`, `subtype`; `actorVerified: false` | Message addressed to a player does **not** establish that player cast the effect. Effects can repeat. |
| `0x9095` | Delayed/scheduled effect messages | Same observation stream; `actorVerified: false` | A scheduled or repeated effect is not an activation count. |
| `0xa028` | Status-condition observations in earlier diagnostics | Not introduced as a new Midir-45 skill-observation stream | Correlation with buffs/debuffs is **not** a proven cast or caster identifier. |

**What is actually recorded:** `0x7926` observations require a known player as the parsed **attacker** and a nonzero skill ID. `0x9093`/`0x9095` capture messages addressed to known players during active combat; the recipient may be distinct from the caster. The effect collector stores at most **12 typed fields**, truncates strings to **160 characters**, and omits binary payload bytes. World-object-directed effects can therefore be absent. `eventPublisher.go` intentionally does not deduplicate or guess skill matches live.

### Typed skill-ID candidates recognized by the current exporter

`portableReport.ts` extracts an ID **only if** the field is at the supported index, has the expected protocol type, and exists in the current skill-name table. Array indexes below are **zero-based**; the first field is often the effect subtype.

| Packet / subtype | Candidate skill-ID location | Required type code |
|---|---|---|
| `0x9093`, `304` or `145` | `fields[2]` | `2` (Short) |
| `0x9093`, `419` | `fields[1]` | `3` (Int) |
| `0x9093`, `833`, `660`, or `661` | `fields[1]` | `2` (Short) |
| `0x9095` with `fields[1] == 419` | `fields[2]` | `3` (Int) |
| `0x7926` | Parsed `skillId` | From Combat Action parser, not generic effect fields |

Relevant type codes: Byte `1`, Short `2`, Int `3`, Long `4`. `fieldTypes` preserves the original types; do not search all numerical fields for something that merely resembles a skill ID. A nonzero `candidateSkillId` establishes **possible skill identity**, not correct caster or cast count. For effect records, `skillId` may remain zero even when `candidateSkillId` resolves.

### Named signatures from controlled diagnostic work

These are **correlations** and should be tested against neighboring packet events before generating Companion actions:

- `0x9093` subtype `14`: strings such as `healing_firstaid` and `party_healing` were associated with First Aid / Party Healing; an effect may occur even with no HP restored.
- Subtype `304`: recognized music-skill identifiers during Battlefield Overture, Vivace, Enduring Melody, and March Song testing.
- Subtype `419`: skill-bearing cues for Shield of Trust / Celestial Spike in investigated samples.
- Subtype `833`: skill-bearing cues for Bash, Spinning Uppercut, and Charge; format is reused and requires type checking.
- Subtype `145`: observed Wind Blast cue (`shot`); subtype `400` carried a placement cue (`cook_pot_outline`) near Hydra Transmutation.
- Subtypes `335` / `838`: paired Gravity Well-associated effect activity; **not** a unique cast signature.
- Subtypes `776` / `777` / `778` / `779`: associated in prior tests with Blessing of Protection, Voice of Vitality, Pall of Ruination, and Hand of Restoration respectively. Subtype `836` was observed near Astral Reave.
- `0x9095`: delayed effect sequences were seen around Encore; multiple rows do not imply multiple Encore activations.

This list preserves the **most useful tested identifiers**, not a full catalog or a guarantee of unique one-to-one mappings. If a subtype lacks a typed recognized skill ID, keep its raw fields and uncertainty rather than manufacturing a confirmed skill-use event.

## 3. Saved event and export contract

| Field / stream | Meaning |
|---|---|
| Saved `EventId: 8` | Explicit player skill use. `At` is Unix **seconds**; `AtMs` is Unix **milliseconds**; `TargetId` is a hint when available. |
| Saved `EventId: 11` | Skill observation from Combat Action or Effect. This is independent of explicit uses. |
| Saved damage `EventId: 3` | Damage record retains historical seconds and optional precise `AtMs`. Older records may lack it. |
| `skillUseSchemaVersion: 1`; `skillUseEvents` | Explicit observed-use stream. `skillUseEvidence` warns these are `0x6988` observations, not confirmed cast counts. |
| `damageHitSchemaVersion: 1`; `damageHitEvents` | Positive hit stream: `playerId`, `skillId`, `atMs`, `relativeMs`, `targetId`, `damage`, `critical`, `delayed`. |
| `skillObservationSchemaVersion: 1`; `skillObservations` | Evidence: `playerId`, `playerName`, `atMs`, `relativeMs`, `opcode`, `skillId`, `skillName`, `candidateSkillId`, `subtype`, `actionType`, `actorVerified`, `fields`, `fieldTypes`. |
| `encounterSchemaVersion: 1`; `encounters` | Canonical encounters kept alongside legacy representations, **not separate additional fights**. |
| `companion.version: 1` | Existing Companion-compatible structure retained. |

**Time:** `atMs` is absolute Unix milliseconds; `relativeMs` is relative to the report summary's first-damage time and can be **negative** for pre-pull events. **Entity IDs** are strings in exported streams to avoid 64-bit JavaScript rounding. Each stream appears **once**, at top level, not once per report view. Saved-session `players[].skillActivations` (explicit uses) must not be confused with damage-group `players[].skillUses`.

**Pre-combat buffering:** explicit `0x6988` uses can be buffered for **0–30 seconds** (at most **512 entries**) and replayed into an active combat recording. It is **not** a pre-combat buffer for all remote effect observations.

**Completion:** `completion: "observed-zero-hp"` remains the machine-readable successful-clear value; UI says **Cleared**. Other concluded encounters display **Attempted** if no zero boss HP was captured. Attempted **does not prove a wipe**.

## 4. Damage, boss HP, and mechanic selection

- **Enemy source identity:** the Damage Graph, HTML export and Companion filters distinguish boss and minor-enemy attack sources from party players. Numeric-looking source names alone are insufficient: a non-boss source must match a recorded target **entity ID**, with a non-player race and spawn/HP evidence. Example: Glenn Gwyllgi race `7544`; older logs may use a different numeric entity ID as its display name. Recognized boss Race IDs also support corroborated historical name fallbacks. Unverified IDs remain unclassified. See `enemyScatter.ts`.
- **Boss only** includes damage to the recorded boss entity IDs; **All targets** includes applicable non-boss targets within the encounter window. Never treat all-target damage as boss damage. Incoming enemy-origin attacks are not player damage and must not enter Companion achievements.
- A logical encounter may stitch more than one physical boss phase into a normalized HP track. Preserve raw per-entity and per-phase HP histories as well as combined view data. Missing precise timestamps, recipient IDs, or phases cannot be rebuilt from the display.
- **Gate 1 (Vertrag):** `7600 → 7601` forms one attempt; select both or either form. The 100→50→0 presentation is a normalized boss-HP interpretation. Giants remain outside boss-only damage. See `front/src/utils/gate1Encounter.ts`.
- **Gate 3:** Shard groups use HP-family and timing heuristics; they are not confirmed mechanic timestamps. See `front/src/utils/reportEncounters.ts` and related utilities.
  - Portable Gate 3 halo visualization is an observational aid: group by the existing boss attempt and 80/60/40 HP-family and timing classifier, then show only halo entities with a recorded HP sample `maxHp > 0` and `currentHp <= 0`. Unconfirmed spawns remain in the original data but do not appear as defeated halo markers. The marker round/color is reconstructed from separated spawn-time clusters (currently >=7 seconds), not from a verified rotation packet; do not imply an authoritative wipe/clear event from this. Up to 15 halo spawns may be observed in the 40% phase while a successful mechanic requires five actual zero-HP observations.
  - In the Gate 3 *all-target encounter window* only, exclude Shards positively matched to the Gate 3 attempt but not assigned to the recognized 80/60/40 mechanic groups. Exclusion is per recorded target ID inside target-attributed scatter buckets; un-attributed older buckets cannot be selectively edited and are retained as recorded. Boss-only and full-session totals and the embedded raw Companion hit evidence are not rewritten.
  - Halo contribution leaderboards use recorded per-player/per-halo `damageByTarget` data; percentages use the sum of attributed player damage and are not inferred from halo HP. A halo lacking contribution evidence can still be shown when zero HP is observed.
  - Player ordering is initialized by descending recorded DPS and a manual order persists when selecting other encounters; minimized player reports have compact restore buttons below the visible reports. Skill high/low hit tooltips use precise `damageEvents`, while hit-count tooltips use the aggregation's recorded hit count. Missing precise hit data yields unavailable individual-hit rankings, not reconstructed values. All-target encounter headers show `all-target DPS (boss-only DPS)` on the same attempt duration; boss-only headers show only boss DPS.
- **Glenn Bearna:** Reverie `7585` is a standalone 100%→10% boss encounter. Reverie `7586` (100%→60%) and Winter Tyrant `7587` (60%→0%) share a second, continuous health track. The combined boss-damage view retains all three entity IDs; individual phases remain selectable. See `glennEncounter.ts`, `reportEncounters.ts`, `glennMinorEnemies.ts`.
- **Glenn opening:** Cailleach `7575` is a separate 100%→90% HP checkpoint, **not** a 0-HP defeat. Her entrance barriers (`7546`–`7549`) are opening mechanics; a split-party side may not be captured. Icicle Sprites (`7539`, `7583`) are ordinary minor enemies, not mechanics. See `glennOpening.ts` and `glennMinorEnemies.ts`.
- **Alby Shineseeker:** No final boss. Each run starts with Vampire Bat `195000` / Country Rat `195001`, then Skeletons `195002`–`195004`, Black Wizard/Ghost Armor `195005`–`195006`, Gargoyles `195007`–`195008`, and final Cichol’s Followers `195009`–`195011`. Run boundaries are inferred from fresh first-wave bat spawns. `final-wave-defeated` requires observed zero HP and death flags for **all recorded** final-wave Followers; this is not an authoritative dungeon-clear packet. See `albyShineseeker.ts`.
- **Crom Bas:** Irusan `193364`; final boss Completed Glas `193358` **or** Giga Glas `193359`, whichever was recorded. Merch Diafol `193355` is an Irusan mechanic. Glas Disciples (red `193438/193442`, blue `193439/193443`, white `193440/193444`, yellow `193441/193445`, plus recognized variants) share **one mechanics group**; none contributes to boss HP. Disciples appearing before Glas are not automatically Glas mechanics. See `cromEncounter.ts`, `mechanicGroups.ts`.
- **Run boundaries:** separate observed boss attempts by entity/time. NDJSON does **not** provide a guaranteed dungeon-instance ID; minor-enemy runs or gap-based *combat segments* can be inferred but must not be presented as confirmed instances. See `instanceMinorGrouping.ts`.

## 5. Companion interpretation rules

1. Prefer **explicit use** (`0x6988`) as use evidence, but validate repeat behavior per skill before counting casts.
2. Use `0x7926` as **actor-attributed combat-action evidence**, not automatically a distinct action for each subpacket.
3. Use typed `0x9093`/`0x9095` signatures as **candidate identity / timing clues**, not proof the addressed player cast the skill. Deduplicate repeated effects using contextual evidence, not a global one-row-one-cast rule.
4. Correlate hits by player, skill, target, and time only when those fields are known. A former 30-second matching window was an **experimental visualization heuristic**, not a verified algorithm for Companion cast counts.
5. Do not backfill events missing from older NDJSON logs; an older report lacking `AtMs`, `EventId: 8`, or `EventId: 11` cannot acquire that evidence without new raw capture analysis.

## 6. Verification and outstanding limits

- **Source-based:** typed candidate slots and exported fields above were checked against `portableReport.ts`; recording gates and attribution behavior against `eventPublisher.go`. This documentation pass did **not** run the app or validate new packets in live play.
- **Sample regression:** historical `session-1792643233581.ndjson` distinguished Dynavolt Smash all-target **10,513,142** from known boss damage **3,245,377**. Those figures only describe that fixture; they are not a specification.
- **Regression expectations:** Run frontend logic tests, type-check and build the frontend, run Go tests, then re-export representative new and old sessions when changing the report contracts. Browser interaction, Companion import, clear/attempt status, HP phase reconstruction, and buff/non-damaging skill attribution still require recording-backed validation.
- **Known blind spots:** recipient-versus-caster ambiguity, repeated effect messages, missing world-object-addressed effects, incomplete older timestamps/targets, inferred dungeon segments, and partial encounters.

To inspect an export, open the HTML in a browser and read `JSON.parse(document.getElementById('data').textContent)`. Treat stream counts as **observations** until their event semantics have been tested for the relevant skill.

- **Glenn HP export caveat:** Tyrant may initially report a provisional 100% spawn snapshot before the settled ~60% phase appears. The linked HP chart excludes that artificial reset. Raw per-entity HP observations remain unchanged in Companion metadata.

## 7. Pet-origin evidence and display labels

Pet-attributed damage is still counted under synthetic skill ID `9999` and
credited to the owner for player totals. When an appearance record supplies a
pet entity's Race ID and owner, the live aggregator can preserve `petRaceId`
and `petName` on the recorded hit. Saved-session reconstruction may recover
those fields where the original entity appearance and attacker evidence exist.
Scatter target-hit groups keep the pet identity separate even when multiple
pets contribute to a one-second bucket. See `aggregator.go`,
`httpHandlerSession.go`, `summary.go`, and `scatterTargets.ts`.

The skill breakdown uses the combined label **Pet / Summon Effects**. A
recognizable individual scatter hit may show its recorded pet race name;
otherwise the event label is **Pets**. This is descriptive context, not
proof of a pet summon, an applied debuff, or a stack/refresh count. The
Companion receives available pet identity evidence without a new status-effect
inference. The display-only label definitions are in `petLabels.ts`.

## 8. Saved-session publication and list feedback

The live-session Save action places a temporary, non-clickable
**Saving Session…** row in the session list before requesting the backend
save. The backend writes the full NDJSON using temporary-file publication and
only returns compact session-list metadata after completion. The UI inserts
the completed session directly instead of refreshing the full history before
and after the save; the live view is not cleared until the save is confirmed.
The pending indicator is **indeterminate**, not an invented percent complete.
See `sessionManager.go`, `session_save_result_test.go`, `httpHandlerSession.go`,
`App.vue`, and `SessionPanel.vue`.

## 9. Dungeon wave / Queen recognition

Fahmes Ruin uses recorded `121xxx`–`126xxx` stage-local race families for stages 1–6. Five sequential level spawn groups are inferred per recorded stage. For a complete 150-enemy stage, five chronological groups of 30 prevent delayed enemies from collapsing or suppressing the level selector; partial captures retain timing-based segmentation. This is a stage-specific heuristic supported by the combined recording, not an authoritative level-transition packet. Waves inside a level may overlap, so wave-specific timing is not asserted without packet evidence. Each stage can be entered independently. Normal Phantasm Queen `191681` and Temptation's Path Queen `195012` are confirmed. `191699`, `191724`, `191803`, `193551`, `193709`, and `193723` are unverified candidates and require contextual dungeon evidence; possible outfit replacements are additional raw entities of one logical Queen, not independent clears.

### Cross-dungeon race ownership and Phantasm boss-room summons

In combined sessions, Phantasm Wraiths (`191684`) share a race with Crom Bas minor enemies. The Phantasm run detector owns its recorded Wraith entity IDs before Crom minor combat-segment reconstruction; the Crom folder, UI group, and target-selection resolver consistently exclude those entities. Fahmes Stage 5 remains identified from its own `125xxx` races, not from the coincidental Wraith race.

Normal Phantasm spawns Succubus Fiends (`191698`) and Wraiths (`191684`) after the Queen (`191681`) appears. A bounded post-Queen window (at most 300 seconds, ending sooner at a following Queen or Fahmes stage) includes known boss-room Fiend/Wraith races (`191683`, `191684`, `191698`) under a separate **Boss-room Enemies** selection. Earlier mobs remain **Minor Enemies**. Both selections contribute to the unique run-wide total without changing the Queen-only boss damage/HP. This is a chronological inference; the original export does not encode authoritative room boundaries. The older Temptation's Path four named Succubi remain a separate mechanics selection.

### Recognized boss-originated scatter sources

The portable HTML report keeps enemy outgoing attacks separate from party damage. Boss-source labels resolve from exact encounter entity IDs first, then recorded target entity IDs with verified boss Race IDs. For historical sources with a numeric display label but no retained entity match, the numeric value may be interpreted as a boss Race ID **only if that race is independently observed in the same session**. The fallback labels the boss race, not an invented encounter attempt. Candidate Succubus Queen outfit/event IDs are excluded from standalone recognition unless the Phantasm encounter detector independently accepts them. Numeric entity IDs alone are never evidence of enemy ownership. These rules do not rewrite raw damage packets, the players cache, or Companion source IDs.

### Crom Bas Abyss / Bri Leith Gate 4 — provisional minor-enemy grouping

The bundled `races.json` identifies Midir the Lost (`7615`) and Folamh (`193810`) as recognized bosses. These remain **boss-only, separately selectable** targets, with same-race repeat spawns bounding their numbered attempt labels. Neither encounter has a recorded, verified phase/clear model.

Based on identified dungeon associations supplied by a player familiar with gameplay, the provisional **Minor Enemies** registry groups Gate 4 Shards of Solace (`7616`–`7620`, `7622`) and Abyss Folamh's Apparitions (`193811`–`193813`), Abyssal Barriers (`193814`), Dark Erg Regulators (`193815`), Disciples (`193816`), and Erg Slimes (`193817`). These are not assumed to be boss mechanics or synchronized HP-threshold waves. The possible bosses `193809` (Giga Glas) and `193818` (another Folamh) remain unassigned until evidence clarifies their role.

`highTierMinorGrouping.ts` creates separately selectable minor-enemy scopes by recorded name, partitions segments by observed spawn times using `partitionMinorRuns`, and nests a boss selection and its approximate minor segment under a numbered encounter folder when both exist. If no matching boss is recorded, it still exposes the minor segment independently. The between-boss midpoint and 15-minute gap are **heuristics**, not definitive dungeon boundaries; the UI does not assert a clear, phase, or mechanic sequence. Boss HP/DPS remains isolated from minor enemies; an all-enemies folder sums unique recorded targets without rewriting raw events. Normal Crom Bas's `193816` handling is kept separate so an Abyss Disciple is not absorbed into a normal-Crom trash folder.

Standalone HTML encounter recognition continues to show the observed bosses without declaring unverified mechanics. Full validation of high-tier run segmentation and enemy role attribution requires real recordings.


## 10. Encounter-scoped Arcana evidence

- The legacy `PlayerStats.talentName` and the saved-session summary Arcana are player/session-level hints. A player may use multiple Arcanas between distinct encounters in one recording; these hints must not be treated as authoritative encounter classifications.
- Frontend target selections resolve Arcana from recorded per-target skill breakdowns and explicit skill observations with the selected target ID. Whole-session views enumerate every detected Arcana; if multiple are present, display a neutral mixed classification. Unsupported selections remain unknown.
- Portable HTML report `views[].players[]` now includes `arcana` and `arcanaEvidence`, with view-specific colors. Boss-only views use exact recorded recipient entities. All-target encounter windows use timestamped damage hits and explicitly recorded skill activations, not the full-session talent name. Without timestamp evidence, a window cannot assume an Arcana.
- Companion v1 keeps its existing player `arcana` field (a single identity or null) and adds optional `arcanaEvidence`; `encounters[].playerArcanas[]` supplies the per-player identity for a recognized encounter's boss entities. A mixed or unsupported scope yields null for its single Arcana field. These are identities derived from observed skills, not verified activation counts. The Arcana registry comes from the backend's bundled `talents.json`.
- Encounter boundaries reconstructed from target entities remain inferential; when multiple Arcana families are seen in the same selected scope, report a mixed classification instead of silently selecting the first or last.

- Mixed-Arcana display: full-session player bars and exported report headers use smooth, evenly spaced gradients for two or more observed Arcanas. Timestamped hit/use records establish first-observed ordering where available; older summary-only sessions retain recorded skill ordering. Gradients are not estimates of Arcana damage, time, or activation share. Scoped encounters retain their independently resolved identity and solid color.
