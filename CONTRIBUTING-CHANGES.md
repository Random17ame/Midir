# Contributing and review guide

## Suggested upstream review sequence

1. Start from a current upstream commit and separate the changes into reviewable PRs: saved session/event model; scatter+shared visibility; Ghost Runner and Death Flags; Personal Best history; experimental healing parser/UI.
2. Preserve existing `.ndjson` session compatibility. Check both fresh sessions and older saved sessions.
3. Treat healing/overshield attribution as provisional. Avoid presenting estimates as verified effective healing.
4. Keep Damage Dealt ranking independent of chart-only hide controls.
5. Document and test class exclusions, per-skill DPS denominators, and missing-data cases for Personal Best Progress.

## Validation before publishing

From repository root: `go test ./...`; `go build ./...`. From `front`: `npm ci` then `npm run build` (check `package.json` scripts for your branch). Manual checks: session save/reopen, empty-history Personal Best, HS-only history extension, Ghost Runner toggle/legend, stacked death markers, scatter panning, Healing visibility persistence.

## Known uncertainties

Healing packet attribution and shields remain experimental. Event-derived death-time metrics depend on saved event fidelity. Full build/test results are not provided by this documentation.
