# Midir-16: Healing Done / Veil of Life rework

Based on Midir-14 (the last release before broad Veil packet sampling). The save verification and large-summary reader safeguards remain.

## Source of shield statistics

* Veil of Life is tentatively identified as CharacterCondition `999` from actual gameplay captures.
* `SBBV` is treated as observed Veil capacity, not necessarily total new shielding. Positive capacity changes are counted as **observed capacity increases**; repeated identical updates are not counted again. Consumption or expiry contributes zero new capacity. Refresh/replacement and overlapping Litany stacks still need validation.
* `SBBDDR` is shown as a damage mitigation rate, interpreted as a 0–1 fraction. Reported as percent; never sum DMR percentages. Peak and last observed DMR are kept separately.
* The old stat `31` / `AdditionalHP` measurement is **not used for overshield generation**. Earlier saved-session overshield values are historical estimates, not validated Veil data.
* Condition updates may not identify the caster. Use explicit source where available, otherwise the existing sole-known-Harmonic-Saint / recent qualifying skill fallback. Unknown caster capacity is not added to player totals.
* Skill attribution requires matching target and recent known skill evidence. Otherwise Veil is credited only to the caster (if identified), not to a fabricated skill.

## Healing recipient filtering

* Healing opcode `0x9093` subtype `0x0A` is accepted only when the recipient resolves to a known player. This avoids counting spawned Shard of Solace / other enemy HP initialization as party healing.
* Values above one million are quarantined pending protocol validation, not counted as ordinary player healing.
* Healing results without a reliable skill mapping appear as **Uncategorized Healing (skill 0)** under their caster. Unresolved caster amounts remain under **Misc. Anonymous Healing**.
* A fresh, targeted candidate skill can label a healing result. This is still heuristic; exact per-skill **effective healing** is not yet established and concurrent support casts may be ambiguous.
* Raw positive player-directed healing packets are NOT proven effective healing. Overhealing and revival require additional work.

## Verification and limitations

1. Build frontend and backend. Test a solo Harmonic Saint: cast Hands on self, damage Veil, then refresh it. Check that repeated condition-999 updates do not increase totals without a capacity increase.
2. Save, reopen, and compare gained capacity, peak capacity, DMR, and per-skill rows.
3. Test a Shard of Solace encounter: enemy initialization packets must not appear under Healing Done.
4. Test two Saints and overlapping Resonant Litany. Multi-source attribution and stacked shield semantics are not yet validated.
5. Reopen legacy sessions: previous overshield numbers are unverified and should not be represented as newly decoded Veil capacities.

No general packet tracing is installed in this build. Healing diagnostics from Midir-14 are retained as an opt-in source of additional validation.
