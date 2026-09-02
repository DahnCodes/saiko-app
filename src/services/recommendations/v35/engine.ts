/**
 * SAIKO Recommendation Engine V1
 */

import { supabase } from '../../../lib/supabase';
import type { Anime } from '../../../types/anime';
import { getAnimeDNA } from '../../dnaService';
import { getStarterAnimeById, mapAnime } from '../../animeService';
import { buildV35UserProfile } from './userProfile';
import {
  scoreCandidate,
  assignCategory,
  rerankForDiversity,
  type ScoredRecommendation,
  type RecommendationCategory,
} from './scoring';
import { generateExplanation } from './explanation';

export { SAIKO_RECOMMENDATION_VERSION, SAIKO_TRAIT_VERSION } from './scoring';
export type { ScoredRecommendation, RecommendationCategory } from './scoring';

const MIN_YEAR = 2023;
const CANDIDATE_LIMIT = 300;
const RECOMMENDATION_LIMIT = 12;

type AnimeRow = {
  id: string;
  anilist_id: number;
  mal_id: number | null;
  title: string;
  cover_image: string | null;
  average_score: number | null;
  season_year: number | null;
  genres: string[] | null;
  status: string | null;
};

async function fetchCandidates(excludedIds: Set<string>): Promise<Anime[]> {
  if (!supabase) throw new Error('Supabase not configured');

  const { data, error } = await supabase
    .from('anime')
    .select('*')
    .gte('season_year', MIN_YEAR)
    .order('season_year', { ascending: false })
    .limit(CANDIDATE_LIMIT);

  if (error) throw error;
  if (!data) return [];

  return (data as AnimeRow[])
    .map(row => mapAnime(row as Parameters<typeof mapAnime>[0]))
    .filter(anime => {
      if (excludedIds.has(anime.id)) return false;
      if (!anime.title) return false;
      return true;
    });
}

async function getUserCoreAnime(userId: string): Promise<Anime[]> {
  if (!supabase) throw new Error('Supabase not configured');

  const { data: favRows, error } = await supabase
    .from('user_favorite_anime')
    .select('anime_id')
    .eq('user_id', userId);

  if (error) throw error;
  if (!favRows?.length) return [];

  const { getAnimeById } = await import('../../animeService');
  const animePromises = (favRows as Array<{ anime_id: string }>).map(r =>
    getAnimeById(r.anime_id).catch(() => null)
  );
  const animeList = await Promise.all(animePromises);
  return animeList.filter((a): a is Anime => a !== null);
}

async function getOnboardingIds(): Promise<Set<string>> {
  try {
    const starter = await getStarterAnimeById();
    return new Set(starter.map(a => a.id));
  } catch {
    return new Set();
  }
}

export async function getV35Recommendations(userId: string): Promise<ScoredRecommendation[]> {
  const dna = await getAnimeDNA(userId);
  if (!dna) throw new Error('User DNA not found');

  const userProfile = buildV35UserProfile(dna);

  const coreAnime = await getUserCoreAnime(userId);
  const coreGenres = [...new Set(coreAnime.flatMap(a => a.genres ?? []))];

  const onboardingIds = await getOnboardingIds();
  const userFavoriteIds = new Set(coreAnime.map(a => a.id));
  const excludedIds = new Set([...userFavoriteIds, ...onboardingIds]);

  const candidates = await fetchCandidates(excludedIds);
  if (candidates.length === 0) return [];

  const scored: ScoredRecommendation[] = [];

  for (const anime of candidates) {
    const scoreResult = scoreCandidate({
      anime,
      userProfile,
      coreGenres,
      coreThemes: [],
    });

    const genres = (anime.genres ?? []).map(g => g.toLowerCase());
    const isRomance = genres.includes('romance');

    const category = assignCategory({
      finalScore: scoreResult.finalScore,
      traitScore: scoreResult.breakdown.traitMatch,
      genreScore: scoreResult.breakdown.genreMatch,
      discoveryScore: scoreResult.breakdown.discoveryScore,
      freshnessScore: scoreResult.breakdown.freshnessScore,
      isRomance,
      hasRomanticThemes: false,
    });

    const explanation = generateExplanation({
      matchedTraits: scoreResult.matchedTraits,
      traitScore: scoreResult.breakdown.traitMatch,
      genreScore: scoreResult.breakdown.genreMatch,
    });

    scored.push({
      anime,
      finalScore: scoreResult.finalScore,
      scoreBreakdown: scoreResult.breakdown,
      matchedTraits: scoreResult.matchedTraits,
      category,
      reason: explanation.shortReason,
    });
  }

  scored.sort((a, b) => b.finalScore - a.finalScore);
  const diversified = rerankForDiversity(scored, RECOMMENDATION_LIMIT);

  return diversified;
}

export async function getRecommendationsByCategory(
  userId: string,
  category: RecommendationCategory,
): Promise<ScoredRecommendation[]> {
  const all = await getV35Recommendations(userId);
  const filtered = all.filter(r => r.category === category);
  if (filtered.length > 0) return filtered;
  return all.slice(0, 6);
}

export function groupByCategory(
  recommendations: ScoredRecommendation[],
): Record<RecommendationCategory, ScoredRecommendation[]> {
  const groups: Record<RecommendationCategory, ScoredRecommendation[]> = {
    perfect_match: [],
    hidden_gem: [],
    unexpected_match: [],
    fresh_pick: [],
    genre_expansion: [],
    romance_pick: [],
  };

  for (const rec of recommendations) {
    groups[rec.category].push(rec);
  }

  return groups;
}

export const CATEGORY_LABELS: Record<RecommendationCategory, string> = {
  perfect_match: "Saiko thinks you'll love this",
  hidden_gem: "A hidden gem for your DNA",
  unexpected_match: "You might not expect this one",
  fresh_pick: "Fresh from the anime world",
  genre_expansion: "Step outside your usual anime",
  romance_pick: "Your romance wildcard",
};
