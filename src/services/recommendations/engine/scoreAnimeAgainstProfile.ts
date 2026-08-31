import type { AnimeTraitProfile } from '../traits/traitExtractor';
import type { UserTraitProfile } from '../taste/userTraitProfile';
import { getTraitById } from '../traits';
import type { SaikoTrait } from '../traits/types';

export interface CandidateScore {
  animeId: string;
  traitProfile: AnimeTraitProfile;
  matchScore: number;
  weightedScore: number;
  topMatchingTraits: Array<{
    traitId: string;
    trait: SaikoTrait;
    userWeight: number;
    animeStrength: number;
    contribution: number;
    isSynopsisTrait: boolean;
    evidence?: string;
  }>;
  meaningfulMatchCount: number;
  signatureMatchCount: number;
  isEligible: boolean;
}

/**
 * Score a candidate anime against a user's trait profile.
 *
 * ELIGIBILITY GATE (both required):
 *   1. meaningfulMatchCount >= 3: at least 3 overlapping traits with
 *      specificity >= 0.35 (excludes the most generic genres like
 *      action/adventure/fantasy/drama)
 *   2. signatureMatchCount >= 1: at least 1 overlapping trait that:
 *      - The candidate has from its synopsis (not just genre)
 *      - AND the user has from their Core 3 synopses (not just shared genre)
 *      - AND user weight is >= 0.5
 *
 * Why this matters:
 *   Genre traits (action, adventure) are in 80%+ of anime. They cause
 *   everyone to get the same candidates. The signature gate ensures we
 *   only recommend candidates that share SPECIFIC THEMATIC content with
 *   the user's Core 3.
 *
 * Example:
 *   User's Core 3 all have "isekai" from their synopses (userWeight ~1.0, isSynopsisTrait=true)
 *   A candidate with "isekai" from its synopsis matches the signature gate
 *   A candidate with "isekai" only as a genre tag does NOT match (not isSynopsisTrait)
 */
export function scoreAnimeAgainstProfile(
  candidateProfile: AnimeTraitProfile,
  userProfile: UserTraitProfile,
  minUserWeight: number = 0.05,
): Omit<CandidateScore, 'animeId'> {
  if (!userProfile.coreCount || !candidateProfile.length) {
    return {
      traitProfile: candidateProfile,
      matchScore: 0,
      weightedScore: 0,
      topMatchingTraits: [],
      meaningfulMatchCount: 0,
      signatureMatchCount: 0,
      isEligible: false,
    };
  }

  const userWeights = userProfile.weights;
  const userIsSynopsis = userProfile.isSynopsisTrait;
  const topMatchingTraits: CandidateScore['topMatchingTraits'] = [];
  let totalContribution = 0;
  let meaningfulMatchCount = 0;
  let signatureMatchCount = 0;

  for (const entry of candidateProfile) {
    const userWeight = userWeights.get(entry.trait) ?? 0;
    if (userWeight < minUserWeight) continue;

    const trait = getTraitById(entry.trait);
    if (!trait) continue;

    const contribution = userWeight * entry.strength;
    totalContribution += contribution;

    // A trait is "synopsis-derived" if either the user's profile or the
    // candidate's profile extracted it from synopsis (not just genre).
    const isSynopsisTrait = entry.source === 'synopsis' || userIsSynopsis.get(entry.trait) === true;

    topMatchingTraits.push({
      traitId: entry.trait,
      trait,
      userWeight,
      animeStrength: entry.strength,
      contribution,
      isSynopsisTrait,
      evidence: entry.evidence,
    });

    // Meaningful: real weight AND not ultra-broad (specificity >= 0.35)
    // excludes action/adventure/fantasy/drama (0.3) but keeps supernatural,
    // sports, mystery, slice of life, etc.
    if (userWeight >= 0.1 && trait.specificity >= 0.35) {
      meaningfulMatchCount++;
    }

    // Signature: synopsis-derived AND user has strong weight for it
    if (isSynopsisTrait && userWeight >= 0.5) {
      signatureMatchCount++;
    }
  }

  topMatchingTraits.sort((a, b) => b.contribution - a.contribution);

  // Relaxed eligibility: 2+ meaningful matches (no signature gate).
  // Signature gate was too strict - almost no candidates passed, forcing
  // everyone into the fallback path. With 100+ synopsis keywords now
  // available, meaningfulMatchCount >= 2 is sufficient differentiation.
  const isEligible = meaningfulMatchCount >= 2;

  const maxPossible = Array.from(userWeights.values()).reduce((s, w) => s + w, 0);
  const matchScore = maxPossible > 0 ? totalContribution / maxPossible : 0;

  return {
    traitProfile: candidateProfile,
    matchScore: Math.max(0, Math.min(1, matchScore)),
    weightedScore: totalContribution,
    topMatchingTraits,
    meaningfulMatchCount,
    signatureMatchCount,
    isEligible,
  };
}
