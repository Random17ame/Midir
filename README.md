# Midir — Mabinogi Damage Meter (NA)

Midir is a Mabinogi combat parser and damage meter with a Go packet-processing
backend and a Vue/TypeScript frontend. It is based on the
[KR damage meter](https://gitlab.com/prilus/mabidilmeter).

## Features

- Live and recorded damage, DPS, healing, skill breakdowns, and combat charts.
- Target-, boss-, and dungeon-run selections with evidence-based encounter grouping.
- Boss HP views, Ghost Runner comparisons, death flags, and Personal Best history.
- Separate **Personal Bests** tab with ten Arcana 30-second burst leaderboards.
  Select **Update Leaderboards** to index new saved sessions with a progress bar;
  simply opening the page does not scan recordings or affect live capture.
  Each username occupies one place per Arcana, using their strongest recorded burst.
  Select up to eight players (top five selected by default) and use **Export Comparison**
  to save a self-contained HTML report of their winning 30-second windows,
  including per-skill scatter hits and distinct observed skill-use markers.
- Encounter-scoped Arcana identification, customized colors, and multi-Arcana gradients.
- Pet-attributed damage under one category, with individual pet names on scatter
  events when recorded Race ID evidence supports them.
- Saved NDJSON sessions and self-contained HTML reports with embedded Companion data.

Recognition of some dungeon runs and boss mechanics is **provisional**. Midir
retains recorded entity/skill evidence and does not infer missing hits, casts,
clears, or status-effect applications.

### Companion-compatible session bundles (Midir 49.a)

Batch Export Sessions produces one ZIP of complete standalone HTML reports with a root manifest, stable recording identity, scope, evidence schema versions, timestamps and optional SHA-256 integrity hashes. Open extracted reports independently or import the ZIP directly into Companion when its importer is available. Lossless native DEFLATE compresses entries where supported and beneficial, otherwise STORE is used. No viewer resources or combat evidence are removed. Existing individual exports and historical recordings remain supported. See the [bundle specification](SESSION-BUNDLE-SPEC.md), [Companion handoff](COMPANION-HANDOFF.md), and [verification results](SESSION-BUNDLE-VERIFICATION.md).

### Session naming and Group Run Scheduler (Midir 48)

Open **Settings → Appearance → Session Naming**. Recording date and time are enabled by default; run count is independently optional. General numbering counts distinct saved recordings across encounters in the selected local calendar day, week (custom reset day/time), or rolling window (1–168 hours). The scheduled-groups option falls back to daily outside group windows.

Add recurring group schedules with any literal label (Friends Group, Company Team, Sports Club, etc.), selected start weekdays, local start/end times, a custom template and an independent counting period. For example, Friday/Saturday 19:00–02:00 can use `{encounter} {label} {run} {date}` to suggest `Bri 4p Friends Group 2 1/15/27`. Overnight windows belong to their starting weekday; equal times mean 24 hours. The first matching enabled rule wins; use the priority arrows for overlaps. Group numbering counts only recordings assigned to that group under the current rules. The scheduled-window count resets each window; weekly counting can span multiple evenings. A 47.b custom weekday template remains available as the fallback when no group matches. Templates use their own tokens independently of the default switches: `{encounter}`, `{label}`, `{weekday}`, `{run}`, `{date}`, `{time}`.

The recording start determines the match and actual date/time tokens. Count only saved session metadata; cancellations do not reserve numbers, deletion can reuse them, rolling counts can decrease, and editing schedules can reclassify historical starts for counting. Existing session titles, combat evidence, and report filenames remain unchanged. All suggestions are editable.

### Minimalist Mode (Midir 47)

Enable **Settings → Capture → Minimalist Mode** to pause live charts during combat and reduce repeated hit-history updates. The setting is off by default and persists across restarts. The live meter keeps its one-second updates; charts resume when tracked targets are no longer active or after 15 seconds of combat inactivity. Scatter and detailed reconstructed graphs are available in saved sessions. Full damage evidence remains recorded for saved analysis, Personal Bests and HTML/Companion exports. Healing Done and shield attribution are disabled while enabled; any affected recording is marked as incomplete for healing, even if you later turn the mode off. Start a new normal recording to collect complete healing again. Resource savings depend on combat, view and hardware; no game FPS benchmark is claimed. Existing capture and security safeguards are unchanged.

## Capture setup and caution

Midir is primarily developed and tested with a **dedicated capture computer**
receiving mirrored traffic from a switch. Select the mirrored network adapter
in the UI. Promiscuous capture is **off by default** and should only be enabled
when the network configuration requires it (such as a mirrored port).

Running packet-capture software on the same PC as Mabinogi may trigger Nexon
Game Security (NGS) or account enforcement. Non-promiscuous capture is not a
guarantee of game compatibility, and same-PC operation has not been validated
by this project. The in-app warning should be heeded.

## Build from source

Requires Go 1.24.4, Node.js compatible with `scripts/check-node-security.cjs`,
`npm`, and a working packet-capture library (Npcap on Windows, libpcap on Unix).

| Platform | Build command | Output |
| --- | --- | --- |
| Windows | `build.bat` | `build/Midir.exe` |
| Linux | `./build.sh` | `build/Midir-linux-<architecture>` |
| macOS | `./build.sh` | `build/Midir-darwin-<architecture>` |

The build scripts install the frontend dependencies, build the UI, and embed it
in the Go executable. macOS app packaging and secondary-Mac setup are covered
in [README-macOS.md](README-macOS.md).

Frontend checks from the `front` directory (after `npm install`):

```sh
npm test
npm run typecheck
npm run build
```

The Go regression suite is run with `go test ./...` from the project root.
GitHub Actions runs both frontend and Go checks.

## Documentation

- [CHANGELOG.md](CHANGELOG.md) — cumulative feature and maintenance summary,
  with numbered source references.
- [SKILL-AND-EXPORT-REFERENCE.md](SKILL-AND-EXPORT-REFERENCE.md) — packet,
  skill-observation, encounter, and Companion export contracts.
- [README-macOS.md](README-macOS.md) — dedicated macOS capture and packaging.

Community: [Discord](https://discord.gg/4SbwPEC8Hh).
