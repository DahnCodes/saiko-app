/**
 * V35 Recommendation Scoring Engine
 */

import type { Anime } from '../../../types/anime';
import { extractAnimeTraitVector, type AnimeTraitVector } from './traitExtractor';
import type { V35UserTraitProfile } from './userProfile';
import { V35_TRAIT_ID_LIST } from './vocabulary';

export const SAIKO_RECOMMENDATION_VERSION = '1.0';
export const SAIKO_TRAIT_VERSION = '1.0';

const WEIGHTS = {
  TRAIT: 0.55,
  GENRE: 0.10,
  THEME: 0.10,
  QUALITY: 0.10,
  FRESHNESS: 0.05,
  DISCOVERY: 0.10,
} as const;

export interface ScoredRecommendation {
  anime: Anime;
  finalScore: number;
  scoreBreakdown: {
    traitMatch: number;
    genreMatch: number;
    themeMatch: number;
    qualityScore: number;
    freshnessScore: number;
    discoveryScore: number;
  };
  matchedTraits: string[];
  category: RecommendationCategory;
  reason: string;
}

export type RecommendationCategory =
  | 'perfect_match'
  | 'hidden_gem'
  | 'unexpected_match'
  | 'fresh_pick'
  | 'genre_expansion'
  | 'romance_pick';

function clamp(v: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, v));
}

function normalizeScore(value: number): number {
  return Math.round(clamp(value, 0, 100) * 10) / 10;
}

function genreSimilarity(genres1: string[], genres2: string[]): number {
  if (!genres1.length || !genres2.length) return 0;
  const set2 = new Set(genres2.map(g => g.toLowerCase()));
  const matches = genres1.filter(g => set2.has(g.toLowerCase())).length;
  return matches / Math.max(genres1.length, genres2.length);
}

function calculateTraitScore(
  userProfile: V35UserTraitProfile,
  candidateVector: AnimeTraitVector,
): { score: number; matchedTraits: string[] } {
  let weightedSum = 0;
  let weightSum = 0;
  const matched: string[] = [];

  for (const traitId of V35_TRAIT_ID_LIST) {
    const userWeight = userProfile.weights.get(traitId) ?? 0;
    const animeStrength = candidateVector[traitId] ?? 0;

    if (userWeight > 0 && animeStrength > 0) {
      weightedSum += userWeight * animeStrength;
      weightSum += userWeight;

      if (userWeight >= 0.3 && animeStrength >= 0.3) {
        matched.push(traitId);
      }
    }
  }

  const normalizedScore = weightSum > 0 ? weightedSum / weightSum : 0;
  return {
    score: normalizeScore(normalizedScore * 100),
    matchedTraits: matched.slice(0, 4),
  };
}

function calculateGenreScore(candidateGenres: string[], coreGenres: string[]): number {
  const similarity = genreSimilarity(candidateGenres, coreGenres);
  return normalizeScore(similarity * 100);
}

function calculateThemeScore(): number {
  // Themes not yet in DB - return neutral
  return 50;
}

function calculateQualityScore(anime: Anime): number {
  const score = anime.score ?? 0;
  if (score === 0) return 0;
  const normalized = clamp((score - 6) / 4, 0, 1);
  return normalizeScore(normalized * 100);
}

function calculateFreshnessScore(anime: Anime): number {
  const currentYear = new Date().getFullYear();
  const year = anime.year ?? currentYear;

  if (anime.status === 'RELEASING') {
    return 100;
  }

  const age = currentYear - year;
  if (age <= 0) return 90;
  if (age === 1) return 70;
  if (age === 2) return 50;
  if (age <= 4) return 30;
  if (age <= 7) return 15;
  return 5;
}

function calculateDiscoveryScore(
  anime: Anime,
  traitScore: number,
  qualityScore: number,
): number {
  const popularity = anime.popularity ?? 50000;

  let discovery = 1.0;
  if (popularity < 5000) discovery = 1.0;
  else if (popularity < 20000) discovery = 0.85;
  else if (popularity < 50000) discovery = 0.70;
  else if (popularity < 100000) discovery = 0.50;
  else if (popularity < 200000) discovery = 0.30;
  else discovery = 0.10;

  if (traitScore > 70 && qualityScore > 70 && popularity < 50000) {
    discovery = Math.min(1.0, discovery + 0.15);
  }

  return normalizeScore(discovery * 100);
}

export interface ScoreCandidateParams {
  anime: Anime;
  userProfile: V35UserTraitProfile;
  coreGenres: string[];
  coreThemes: string[];
  candidateVector?: AnimeTraitVector;
}

export function scoreCandidate(params: ScoreCandidateParams): {
  breakdown: ScoredRecommendation['scoreBreakdown'];
  matchedTraits: string[];
  finalScore: number;
} {
  const { anime, userProfile, coreGenres, candidateVector } = params;

  const traitVector = candidateVector ?? extractAnimeTraitVector({
    genres: anime.genres ?? [],
    synopsis: anime.synopsis,
  });

  const traitResult = calculateTraitScore(userProfile, traitVector);
  const genreScore = calculateGenreScore(anime.genres ?? [], coreGenres);
  const themeScore = calculateThemeScore();
  const qualityScore = calculateQualityScore(anime);
  const freshnessScore = calculateFreshnessScore(anime);
  const discoveryScore = calculateDiscoveryScore(anime, traitResult.score, qualityScore);

  const breakdown = {
    traitMatch: traitResult.score,
    genreMatch: genreScore,
    themeMatch: themeScore,
    qualityScore,
    freshnessScore,
    discoveryScore,
  };

  const finalScore = Math.round(
    breakdown.traitMatch * WEIGHTS.TRAIT +
    breakdown.genreMatch * WEIGHTS.GENRE +
    breakdown.themeMatch * WEIGHTS.THEME +
    breakdown.qualityScore * WEIGHTS.QUALITY +
    breakdown.freshnessScore * WEIGHTS.FRESHNESS +
    breakdown.discoveryScore * WEIGHTS.DISCOVERY
  );

  return {
    breakdown,
    matchedTraits: traitResult.matchedTraits,
    finalScore: Math.round(finalScore * 10) / 10,
  };
}

export function assignCategory(params: {
  finalScore: number;
  traitScore: number;
  genreScore: number;
  discoveryScore: number;
  freshnessScore: number;
  isRomance: boolean;
  hasRomanticThemes: boolean;
}): RecommendationCategory {
  const {
    finalScore,
    traitScore,
    genreScore,
    discoveryScore,
    freshnessScore,
    isRomance,
    hasRomanticThemes,
  } = params;

  if (isRomance || hasRomanticThemes) {
    return 'romance_pick';
  }

  if (freshnessScore >= 70 && traitScore >= 60) {
    return 'fresh_pick';
  }

  if (traitScore >= 70 && discoveryScore >= 70) {
    return 'hidden_gem';
  }

  if (finalScore >= 75) {
    return 'perfect_match';
  }

  if (traitScore >= 65 && genreScore < 40) {
    return 'unexpected_match';
  }

  if (traitScore >= 55 && genreScore < 50) {
    return 'genre_expansion';
  }

  return 'perfect_match';
}

export function rerankForDiversity(
  recommendations: ScoredRecommendation[],
  limit: number,
): ScoredRecommendation[] {
  const selected: ScoredRecommendation[] = [];
  const genreUsage = new Map<string, number>();

  for (const rec of recommendations) {
    if (selected.length >= limit) break;

    const primaryGenre = rec.anime.genres?.[0] ?? 'Other';
    const genreCount = genreUsage.get(primaryGenre) ?? 0;

    const dominatedByExisting = selected.some(existing => {
      if (existing.finalScore > rec.finalScore + 10) {
        const genreOverlap = existing.anime.genres?.some(g => rec.anime.genres?.includes(g));
        if (genreOverlap && genreCount >= 2) return true;
      }
      return false;
    });

    if (!dominatedByExisting) {
      selected.push(rec);
      genreUsage.set(primaryGenre, genreCount + 1);
    }
  }

  if (selected.length < limit) {
    const selectedIds = new Set(selected.map(r => r.anime.id));
    const remaining = recommendations
      .filter(r => !selectedIds.has(r.anime.id))
      .sort((a, b) => b.finalScore - a.finalScore);

    for (const rec of remaining) {
      if (selected.length >= limit) break;
      selected.push(rec);
    }
  }

  return selected;
}
