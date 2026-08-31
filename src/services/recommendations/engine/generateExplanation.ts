import type { SaikoTrait } from '../traits/types';
import type { CandidateScore } from './scoreAnimeAgainstProfile';

/**
 * The explanation of why a recommendation was made.
 */
export interface RecommendationExplanation {
  /** One-line summary shown on the recommendation card. */
  shortReason: string;
  /** Multi-sentence explanation shown on the detail page. */
  fullExplanation: string;
  /** Top matching traits driving the recommendation. */
  topMatchingTraits: Array<{ trait: SaikoTrait; userWeight: number; animeStrength: number }>;
}

/**
 * Generate a human-readable explanation for a recommendation.
 *
 * The explanation is built from the actual matching traits between the
 * candidate and the user's trait profile. It does not use templates
 * or generic strings — every word of explanation comes from real trait data.
 */
export function generateExplanation(
  candidateScore: CandidateScore,
  candidateTitle: string,
): RecommendationExplanation {
  const { topMatchingTraits, matchScore } = candidateScore;

  if (!topMatchingTraits.length) {
    return {
      shortReason: 'A highly rated discovery worth exploring',
      fullExplanation: `${candidateTitle} has earned strong ratings and stands out as a quality pick worth your time.`,
      topMatchingTraits: [],
    };
  }

  // Top 3 matching traits by contribution
  const top3 = topMatchingTraits.slice(0, 3);

  // Build trait labels
  const topLabels = top3.map((m: { trait: SaikoTrait }) => m.trait.label.toLowerCase());

  let shortReason: string;
  if (topLabels.length === 1) {
    shortReason = `Strong match for ${topLabels[0]}`;
  } else if (topLabels.length === 2) {
    shortReason = `Combines ${topLabels[0]} and ${topLabels[1]}`;
  } else {
    shortReason = `Blends ${topLabels.slice(0, 2).join(', ')} and ${topLabels[2]}`;
  }

  // Build full explanation
  const matchPercent = Math.round(matchScore * 100);
  const topMatchLabels = top3.map((m: { trait: SaikoTrait }) => m.trait.label);

  let fullExplanation = `Saiko thinks you'll love this because it matches your taste for ${topMatchLabels.join(', ')}.`;
  if (matchPercent >= 75) {
    fullExplanation += ` This is a very strong match (${matchPercent}% trait alignment) with your anime DNA.`;
  } else if (matchPercent >= 50) {
    fullExplanation += ` It aligns well with the traits present in your core anime.`;
  } else {
    fullExplanation += ` It shares meaningful traits with your favorites while offering something fresh.`;
  }

  // Add evidence from synopsis if available
  const evidenceEntry = topMatchingTraits.find((m: { evidence?: string }) => m.evidence);
  if (evidenceEntry?.evidence) {
    const evidenceSnippet = evidenceEntry.evidence;
    if (evidenceSnippet.length > 20) {
      fullExplanation += ` ${evidenceSnippet}`;
    }
  }

  return {
    shortReason,
    fullExplanation,
    topMatchingTraits: top3.map((m: { trait: SaikoTrait; userWeight: number; animeStrength: number }) => ({
      trait: m.trait,
      userWeight: m.userWeight,
      animeStrength: m.animeStrength,
    })),
  };
}

/**
 * Generate a short reason for the recommendation card.
 * This is the one-liner shown in the anime grid.
 */
export function shortReasonFromMatches(
  matchingTraits: CandidateScore['topMatchingTraits'],
  fallback: string,
): string {
  if (!matchingTraits.length) return fallback;

  const top3 = matchingTraits.slice(0, 3);
  const labels = top3.map((m: { trait: SaikoTrait }) => m.trait.label.toLowerCase());

  if (labels.length === 1) return `Matches your love of ${labels[0]}`;
  if (labels.length === 2) return `For fans of ${labels[0]} and ${labels[1]}`;
  return `For fans of ${labels[0]}, ${labels[1]} and more`;
}
