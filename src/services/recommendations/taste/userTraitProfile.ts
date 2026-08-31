import type { AnimeTraitProfile } from '../traits/traitExtractor';
import { getTraitById } from '../traits';
import type { SaikoTrait } from '../traits/types';

export interface UserTraitProfile {
  weights: Map<string, number>;
  /** Per-trait map of traits that came from synopsis (not just genres). */
  isSynopsisTrait: Map<string, boolean>;
  coreCount: number;
  uniqueTraitCount: number;
  topTraits: Array<{
    traitId: string;
    trait: SaikoTrait;
    weight: number;
    occurrenceCount: number;
    isSynopsisTrait: boolean;
  }>;
}

export interface BuildProfileOptions {
  /** Trait profiles from each Core 3 anime. Each is an array of {trait, strength, source}. */
  coreAnimeTraitProfiles: AnimeTraitProfile[];
}

/**
 * Build a User Trait Profile from the Core 3 anime trait profiles.
 *
 * For each trait across Core 3:
 * 1. Count how many Core 3 anime contain it (max 3)
 * 2. Average the strength across appearances
 * 3. Apply specificity bonus (more specific traits count more)
 * 4. Normalize to 0-1 range
 *
 * A trait present in 3/3 Core 3 anime with high strength and high specificity
 * will have the highest weight. A trait present in 1/3 with low strength and
 * broad specificity will have a low weight.
 */
export function buildUserTraitProfile(options: BuildProfileOptions): UserTraitProfile {
  const { coreAnimeTraitProfiles } = options;

  if (!coreAnimeTraitProfiles.length) {
    return {
      weights: new Map(),
      isSynopsisTrait: new Map(),
      coreCount: 0,
      uniqueTraitCount: 0,
      topTraits: [],
    };
  }

  interface TraitAccumulator {
    distinctCoreCount: number;
    maxStrength: number;
    strengthSum: number;
    appearances: number;
    isFromSynopsis: boolean;
  }
  const accumulator = new Map<string, TraitAccumulator>();

  for (const profile of coreAnimeTraitProfiles) {
    const seenInThisAnime = new Set<string>();
    for (const entry of profile) {
      if (seenInThisAnime.has(entry.trait)) continue;
      seenInThisAnime.add(entry.trait);

      const acc = accumulator.get(entry.trait) ?? {
        distinctCoreCount: 0,
        maxStrength: 0,
        strengthSum: 0,
        appearances: 0,
        isFromSynopsis: false,
      };
      acc.distinctCoreCount += 1;
      acc.strengthSum += entry.strength;
      acc.appearances += 1;
      acc.maxStrength = Math.max(acc.maxStrength, entry.strength);
      // If ANY source for this trait was synopsis, mark it
      if (entry.source === 'synopsis') acc.isFromSynopsis = true;
      accumulator.set(entry.trait, acc);
    }
  }

  const weighted: Array<{
    traitId: string;
    trait: SaikoTrait;
    weight: number;
    occurrenceCount: number;
    isFromSynopsis: boolean;
  }> = [];

  for (const [traitId, acc] of accumulator.entries()) {
    const trait = getTraitById(traitId);
    if (!trait) continue;

    const occurrenceRatio = acc.distinctCoreCount / coreAnimeTraitProfiles.length;
    const meanStrength = acc.strengthSum / acc.appearances;
    const specificityBonus = 0.4 + trait.specificity * 0.6;

    // Weight = how often it appears × average strength × how specific it is
    const rawWeight = occurrenceRatio * meanStrength * specificityBonus;

    weighted.push({
      traitId,
      trait,
      weight: rawWeight,
      occurrenceCount: acc.distinctCoreCount,
      isFromSynopsis: acc.isFromSynopsis,
    });
  }

  // Normalize to 0-1
  const maxWeight = Math.max(0.0001, ...weighted.map((w) => w.weight));
  for (const w of weighted) w.weight = w.weight / maxWeight;

  weighted.sort((a, b) => b.weight - a.weight);

  const weights = new Map<string, number>();
  const isSynopsisTrait = new Map<string, boolean>();
  for (const w of weighted) {
    weights.set(w.traitId, w.weight);
    isSynopsisTrait.set(w.traitId, w.isFromSynopsis);
  }

  return {
    weights,
    isSynopsisTrait,
    coreCount: coreAnimeTraitProfiles.length,
    uniqueTraitCount: weighted.length,
    topTraits: weighted.slice(0, 20).map((w) => ({
      traitId: w.traitId,
      trait: w.trait,
      weight: w.weight,
      occurrenceCount: w.occurrenceCount,
      isSynopsisTrait: w.isFromSynopsis,
    })),
  };
}

export function getUserTraitWeight(profile: UserTraitProfile, traitId: string): number {
  return profile.weights.get(traitId) ?? 0;
}

export function isUserTraitFromSynopsis(profile: UserTraitProfile, traitId: string): boolean {
  return profile.isSynopsisTrait.get(traitId) ?? false;
}

export function serializeUserTraitProfile(profile: UserTraitProfile): {
  weights: Record<string, number>;
  synopsisTraits: Record<string, boolean>;
  coreCount: number;
  uniqueTraitCount: number;
  topTraitIds: string[];
} {
  const weights: Record<string, number> = {};
  const synopsisTraits: Record<string, boolean> = {};
  for (const [k, v] of profile.weights.entries()) weights[k] = v;
  for (const [k, v] of profile.isSynopsisTrait.entries()) synopsisTraits[k] = v;
  return {
    weights,
    synopsisTraits,
    coreCount: profile.coreCount,
    uniqueTraitCount: profile.uniqueTraitCount,
    topTraitIds: profile.topTraits.map((t) => t.traitId),
  };
}
