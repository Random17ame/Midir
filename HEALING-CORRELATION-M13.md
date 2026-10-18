# Midir-13: healing correlation diagnostics

This build intentionally **does not rewrite existing Healing Done totals or overshield attribution**. The current healing packet's caster and skill linkage is still unverified.

## New diagnostic fields

Enable **Settings → Experimental → Record healing diagnostics**. In the resulting `healing-diagnostics-*.ndjson` file:

- `healing_packet` events with positive raw amounts now include `classification` and `candidates` (`caster_id`, `skill_id`, `age_ms`). A single match is **`single_candidate_unverified`**, not proof. Multiple possibilities are **`ambiguous_multiple_candidates`**. No possibility is `unattributed`.
- HP observations now include `entity_type` (`player`, `enemy`, or `unknown`), `additional_before/after` and a preliminary `ordinary_hp_candidate_before/after` derived from `CurrentHP - AdditionalHP`, limited by BaseHP. These estimates need controlled verification.
- `enemy_recovery_candidate` is logged separately for combat-target ordinary-health increases. It is not counted as a player heal, nor as a confirmed boss-regeneration total. Use observed enemy recovery in diagnostics before publishing a live/saved Enemy Regeneration row.

## Correlation windows (experimental)

- Voice of Vitality (`59002`): 300 seconds, accepts 75-point tick candidates only.
- Pulse of Purification (`59004`): provisional 35-second window (duration still unverified).
- Resonant Litany (`59003`): provisional 4-second window to accommodate overlapping casts and moving projectiles.
- Other healing-capable skills: 3-second diagnostic window; target filtering only for single-target abilities with explicitly known targets.

Healing skill activations are still logged even if no damage was recorded. Healing amplification from Spirit Wand Awakening and Pulse of Purification is contextual and **never counted as a second heal**. AdditionalHP (`31`) remains shield-only.

## How to validate

Perform one isolated skill use with a known injured recipient; then repeat with full HP, another caster, an overshield conversion and an equipment/max-HP swap. Check that candidate lists and HP changes are reasonable before trusting inferred sources. In particular, the game's CurrentHP can track shield changes; even the adjusted ordinary-HP calculation requires controlled verification.

## Limitations

No reliable entity-level regeneration total is exposed on the Healing Done page yet. A session can include enemy HP increases caused by mechanics or max-HP changes. The new diagnostic classification is groundwork to avoid presenting an inaccurate number as an established fact.
