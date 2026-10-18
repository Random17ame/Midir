# Overshield attribution (experimental)

This change applies **only** to overshield (`AdditionalHP`, public stat 31). It does not change ordinary healing, overhealing or the Healing Done tab.

When an entity's AdditionalHP increases, the parser uses this precedence:

1. **Recent target-specific qualifying cast:** attribute to its Harmonic Saint caster if the cast is within two seconds of the stat update.
2. **One identified, present Harmonic Saint:** attribute the increase to that player, even when the skill activation was not observed.
3. **Multiple identified, present Harmonic Saints:** use the most recent qualifying skill activation observed within two seconds. When two distinct casters have the same recorded second, the result remains unassigned unless there is a target-specific match.
4. **No reliable candidate:** keep the change unassigned rather than guessing.

The existing skill allowlist (59001 / 59002 / 59003) is **provisional**; validate against controlled packet captures. Non-damaging Party Healing, Healing and untargeted Battle Astrology actions may not produce a recognized combat-action packet. A single-Saint fallback accommodates that; in a multiple-Saint party, these casts can remain unattributed.

**Limitations:** A recognized Harmonic Saint is identified by arcana skill observations; an unrecognized Saint can cause the one-Saint fallback to be overconfident. The entity cache reflects observed entities, not a guaranteed complete party roster. The two-second window uses one-second timestamp resolution and is not conclusive evidence of source. Net increases in AdditionalHP may hide refresh, overwrite or expiration behavior. Do not treat generated overshield as absorbed damage.

For reliable accuracy, test one Saint, two Saints, targeted skills, non-damaging heals and untargeted astrology with raw stat transitions and precise timestamps. Future work should consider direct party-role tracking and a dedicated uncertainty/unassigned counter.
