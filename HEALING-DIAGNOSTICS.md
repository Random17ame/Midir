# Midir-11: experimental healing diagnostics

The recorder is **off by default**. Open **Settings → Experimental → Record healing diagnostics** to start; turn it off after your test. Files are written as `healing-diagnostics-YYYYMMDD-HHMMSS.ndjson` in the backend process working directory, restricted to the local user where supported. Do not share raw logs publicly without checking entity identifiers and timing data.

This version **does not alter healing totals, skill attribution, or overshield accounting**. It collects metadata only, never packet payloads.

Records:
- `healing_skill_activation`: caster/possible target and the 14 candidate skill IDs, including non-damaging skill activations.
- `healing_packet`: subtype, recipient/caster entity ID, reported amount, and *unverified* last-caster candidate.
- `hp_state_change` / `missing_hp_reduction_candidate`: independent CurrentHP/BaseHP snapshots, their deltas and missing-HP change, observed before regular graph throttling.

**Stat 31 / AdditionalHP is intentionally excluded** from the healing diagnostic calculations; overshields are tracked separately.

## Suggested experiments
1. One healer, one injured recipient; cast Healing 30006 once. Turn recording off.
2. Repeat at full health to distinguish raw vs effective healing.
3. Test Party Healing 30008 alone.
4. Test Hands of Restoration 59000 separately.
5. Swap equipment that increases CurrentHP and BaseHP equally; confirm missing-HP change is zero.
6. Test potion and passive healing without skill activation.
7. Run separate captures with two healers to test ambiguous caster attribution.

**Interpretation:** Missing HP reduction is a candidate, not confirmed healing; simultaneous damage, max HP reductions, and buffs can confound it. Reported amount offset, subtype mapping, and caster attribution remain experimental. Entity IDs are identifiers, not names. This recorder does not infer potions from round numbers. Activation candidates do not imply effective healing.

Healing candidate registry reference: https://github.com/MabiPrograms/Mabinogi-Damage-Tracker/blob/main/Mabinogi_Damage_Tracker.Server/skill_ids.cs (some names/IDs may need live validation).
