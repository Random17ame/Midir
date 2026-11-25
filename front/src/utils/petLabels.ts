/** Display-only labels for synthetic pet damage skill 9999.
 *
 * The combined damage category and the per-hit fallback are deliberately
 * different: a recorded pet Race ID may identify a scatter hit, but must not
 * split the existing player damage category or imply a debuff application.
 */
export const PET_DAMAGE_SKILL_ID = 9999;
export const PET_DAMAGE_SKILL_LABEL = 'Pet / Summon Effects';
export const PET_UNIDENTIFIED_EVENT_LABEL = 'Pets';

export function petEventLabel(petName?: string | null): string {
  return petName || PET_UNIDENTIFIED_EVENT_LABEL;
}
