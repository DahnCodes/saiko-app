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
import { enrichShortlist } from './characterAffinity';
import { calculateNegativePenalty, getNegativeTasteProfile } from '../../negativeTasteProfile';

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
  if (!supabase) throw new Error('Supabase not configured');
  const dna = await getAnimeDNA(userId);
  if (!dna) throw new Error('User DNA not found');

  const userProfile = buildV35UserProfile(dna);
  // Feedback is an optional extension; an unapplied migration or transient
  // failure must never prevent the existing recommendation flow from loading.
  const negativeProfile = await getNegativeTasteProfile(userId).catch(() => ({
    contentTraits: [], narrativeTraits: [], characterTraits: [], evidenceCount: 0,
    version: 1, updatedAt: new Date().toISOString(),
  }));

  const coreAnime = await getUserCoreAnime(userId);
  const coreGenres = [...new Set(coreAnime.flatMap(a => a.genres ?? []))];

  const onboardingIds = await getOnboardingIds();
  const userFavoriteIds = new Set(coreAnime.map(a => a.id));
  const { data: feedbackRows } = await supabase.from('user_anime_feedback').select('anime_id').eq('user_id', userId).eq('feedback_type', 'not_for_me').then(result => result.error ? { data: [] } : result);
  const rejectedIds = new Set((feedbackRows ?? []).map(row => String((row as { anime_id: string }).anime_id)));
  const excludedIds = new Set([...userFavoriteIds, ...onboardingIds, ...rejectedIds]);

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
  const characterShortlist = scored.slice(0, 20);
  const characterResults = await enrichShortlist(characterShortlist.map(item => item.anime), dna.tasteProfile?.characterTraits ?? []);
  characterShortlist.forEach(item => {
    const result = characterResults.get(item.anime.id);
    if (!result || result.score === null) return;
    item.finalScore = Math.round((item.finalScore * 0.8 + result.score * 0.2) * 10) / 10;
    item.characterAffinity = result.score;
    item.characterDataAvailable = true;
    item.characterMatchedTraits = result.matchedTraits;
    if (result.matchedTraits.length) item.reason = `${item.reason} · Strong character match: ${result.matchedTraits.slice(0, 2).join(' and ')}`;
  });
  scored.forEach(item => {
    const penalty = calculateNegativePenalty(item.anime, negativeProfile);
    item.finalScore = Math.max(0, Math.round((item.finalScore - penalty) * 10) / 10);
    item.scoreBreakdown.negativePreferencePenalty = penalty;
    if (penalty > 0) item.reason = `${item.reason} · Adjusted for repeated preferences`;
  });
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
