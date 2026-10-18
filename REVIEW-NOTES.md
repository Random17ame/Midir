# Redundancy / residual-code review

Reviewed this working tree against Midir-05 and compared file inventory against a locally available pre-feature Midir source archive. Changes were intentionally kept minimal; no speculative deletions were made.

- The graph and Damage Dealt each calculate Ghost Runner separately for their respective presentations. This is a candidate for a shared utility, **not** safe to remove in a documentation-only update.
- Death Flags on the graph are based on saved DPS samples; Damage Dealt computes per-skill event history. These are distinct features rather than redundant dead code. Their differing precision should be documented for contributors.
- Chart visibility and Damage Dealt ranking have different responsibilities by design. Do not apply hidden-player filters to Damage Dealt.
- Healing remains partly heuristic; both dedicated healing packet decoding and AdditionalHP overshield hints are retained for future validation. No code was removed merely because the UI is disabled by default.
- Older Personal Best commentary described a fixed five-session scan even though configurable lookback is supported; comment updated.
- No obsolete feature files were confidently identified for deletion from the inspected changed-file set. A complete upstream dead-code audit requires a reproducible build, tests, and commit-aware comparison.

This is a source review, not evidence that the project is free of unused code.
