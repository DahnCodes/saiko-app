import { getTraitById, filterValidTraitIds } from '../traits';
import type { SaikoTrait } from '../traits/types';

/**
 * A single trait entry in the user's Taste Map.
 */
export interface TasteMapEntry {
  traitId: string;
  trait: SaikoTrait;
  /** How many of the user's Core 3 anime contain this trait. */
  occurrenceCount: number;
  /**
   * Weighted importance score for recommendation matching.
   * Incorporates occurrence count and trait specificity.
   * Higher = more important for matching.
   *
   * Formula: occurrenceCount * specificityBonus
   * specificityBonus = 0.4 + specificity * 0.6 (range 0.4 to 1.0)
   * This rewards specific traits appearing multiple times over broad traits appearing once.
   */
  weight: number;
}

/**
 * The complete taste profile derived from a user's Core 3 anime selections.
 */
export interface TasteMap {
  /** Ordered entries, most important first. */
  entries: TasteMapEntry[];
  /** Total number of unique traits across all Core 3 anime. */
  uniqueTraitCount: number;
}

/**
 * Build a Taste Map from an array of trait ID arrays.
 * Each array represents the traits extracted from one Core 3 anime.
 *
 * Example:
 *   buildTasteMap([
 *     ['action', 'adventure', 'underdog', 'friendship'], // Naruto
 *     ['action', 'supernatural', 'sword_fighting'],      // Bleach
 *     ['action', 'dark_fantasy', 'sword_fighting'],       // Demon Slayer
 *   ])
 *
 * Output:
 *   action: 3 occurrences
 *   sword_fighting: 2 occurrences
 *   adventure: 1, underdog: 1, friendship: 1, supernatural: 1, dark_fantasy: 1
 */
export function buildTasteMap(animeTraitArrays: readonly (readonly string[])[]): TasteMap {
  const counts = new Map<string, number>();

  for (const traitIds of animeTraitArrays) {
    const unique = filterValidTraitIds(traitIds);
    // Count each trait once per anime (not per occurrence within same anime)
    const seen = new Set<string>();
    for (const id of unique) {
      if (!seen.has(id)) {
        seen.add(id);
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
  }

  const entries: TasteMapEntry[] = [];

  for (const [traitId, occurrenceCount] of counts.entries()) {
    const trait = getTraitById(traitId);
    if (!trait) continue;

    // Weight: specific traits appearing multiple times are more valuable
    // than broad traits appearing once.
    const specificityBonus = 0.4 + trait.specificity * 0.6; // 0.4 to 1.0 range
    const weight = occurrenceCount * specificityBonus;

    entries.push({ traitId, trait, occurrenceCount, weight });
  }

  // Sort: highest weight first
  entries.sort((a, b) => b.weight - a.weight);

  return {
    entries,
    uniqueTraitCount: entries.length,
  };
}

/**
 * Score a candidate anime's trait overlap against a user's Taste Map.
 * Returns a match score and the matching trait IDs.
 */
export interface CandidateMatchResult {
  /** All matching trait IDs. */
  matchingTraitIds: string[];
  /** Weighted score: specificity-weighted overlap. */
  weightedScore: number;
  /**
   * Binary flag: candidate meets the minimum eligibility threshold.
   * A candidate needs at least 2 meaningful matching traits to qualify.
   * Meaningful = occurrenceCount >= 1 AND specificity > 0.3
   */
  isEligible: boolean;
  /**
   * Number of "meaningful" matches used for eligibility.
   */
  meaningfulMatchCount: number;
  /**
   * Top matching trait entries sorted by weight (most important first).
   * Used for explanation generation and per-trait match percent contribution.
   */
  topMatchingTraits: { traitId: string; weight: number; specificity: number; occurrenceCount: number }[];
}

export function scoreCandidateTraits(
  candidateTraitIds: readonly string[],
  tasteMap: TasteMap,
): CandidateMatchResult {
  const candidateSet = new Set(filterValidTraitIds(candidateTraitIds));

  let weightedScore = 0;
  let meaningfulMatchCount = 0;
  const matchingTraitIds: string[] = [];
  const topMatchingTraits: { traitId: string; weight: number; specificity: number; occurrenceCount: number }[] = [];

  for (const entry of tasteMap.entries) {
    if (candidateSet.has(entry.traitId)) {
      matchingTraitIds.push(entry.traitId);
      weightedScore += entry.weight;
      topMatchingTraits.push({
        traitId: entry.traitId,
        weight: entry.weight,
        specificity: entry.trait.specificity,
        occurrenceCount: entry.occurrenceCount,
      });

      if (entry.occurrenceCount >= 1 && entry.trait.specificity > 0.3) {
        meaningfulMatchCount++;
      }
    }
  }

  // Sort top matching traits by weight (descending)
  topMatchingTraits.sort((a, b) => b.weight - a.weight);

  return {
    matchingTraitIds,
    weightedScore,
    meaningfulMatchCount,
    isEligible: meaningfulMatchCount >= 2,
    topMatchingTraits,
  };
}
