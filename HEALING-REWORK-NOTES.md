# PvE healing / overshield source changes

This source archive contains the current Midir changes for review and local testing.

## What changed

- Adds a dedicated parser for Mabinogi's healing packet variants on opcode `0x9093`, keeping this path separate from hostile-target combat damage filtering.
- Tracks the most recently identified healer/caster and turns single-heal result packets into healing totals and per-target breakdowns.
- Keeps healing events separate from offensive damage charting and summary rebuilding.
- Adds short-window attribution of positive AdditionalHP (stat 31) increases to the three known overshield skills: Hands of Restoration (59001), Echoes of Salvation (59002), and Resonant Litany (59003).
- Retains the existing scatter-chart and encounter/stat changes present in this fork.

## Important limitations

- I could not compile or run the Go tests in this environment. The repository requests Go 1.24.4, and the Go toolchain download was blocked by unavailable network access. This archive is therefore **not build-verified**.
- The dedicated healing packet layout is ported from the public Mabinogi Damage Tracker parser's field offsets and subtype handling. It still needs a live PvE capture to confirm that Midir receives these packets under the user's ExitLag setup and that caster/recipient sequencing matches the observed traffic.
- The reference parser associates a healing result with the most recently seen caster packet; that association is necessarily heuristic because the single-heal result packet does not itself contain a skill ID or caster ID.
- Overshield attribution relies on AdditionalHP stat 31 increasing shortly after one of the three allowlisted skills. It needs in-game validation.

## Local test

From the repository root, with Go 1.24.4 available and dependencies downloadable:

```sh
go test ./...
go build ./...
```

If healing still records zero in PvE, please capture a short session with healing and share the resulting Midir session/log. The most useful evidence is whether the parser sees opcode `0x9093` packets with subtypes `0x19`, `0x0A`, or `0x28`.
