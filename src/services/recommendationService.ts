import { supabase } from '../lib/supabase.ts'
import type { Anime } from '../types/anime.ts'
import { cleanText } from '../lib/text.ts'
import { getTraitBasedRecommendations } from './recommendations/engine/getTraitBasedRecommendations.ts'

type AnimeRow = {
  id: string; anilist_id: number; mal_id: number | null; title: string;
  title_native: string | null; title_romaji: string | null; title_english: string | null;
  synonyms: string[] | null; description: string | null; cover_image: string | null;
  banner_image: string | null; episodes: number | null; format: string | null;
  season_year: number | null; average_score: number | null; popularity: number | null;
  genres: string[] | null; status: string | null; season: string | null
}

function mapAnime(item: AnimeRow): Anime {
  return {
    id: item.id, anilistId: item.anilist_id, malId: item.mal_id,
    title: cleanText(item.title),
    nativeTitle: cleanText(item.title_native) || null,
    romajiTitle: cleanText(item.title_romaji) || null,
    englishTitle: cleanText(item.title_english) || null,
    synonyms: (item.synonyms ?? []).map(cleanText).filter(Boolean),
    type: item.format, episodes: item.episodes,
    score: item.average_score ? item.average_score / 10 : null,
    synopsis: cleanText(item.description) || null,
    imageUrl: item.cover_image ?? '', year: item.season_year,
    bannerImage: item.banner_image, status: item.status, season: item.season,
    popularity: item.popularity, genres: item.genres ?? [],
  }
}

export type PersonalizedRecommendation = {
  anime: Anime;
  score: number;
  reason: string;
  matchPercent?: number;
  topMatchingTraits?: Array<{ trait: string; label: string }>;
}

/**
 * Get personalized recommendations for a user.
 *
 * This function first attempts to use the SAIKO trait-based recommendation engine.
 * If the trait system fails (e.g., anime_traits table not yet migrated), it falls
 * back to the legacy genre-overlap approach.
 *
 * The trait-based engine:
 * 1. Analyzes the user's Core 3 anime to build a trait profile.
 * 2. Extracts traits from candidate anime (synopsis + metadata).
 * 3. Scores candidates by weighted trait overlap.
 * 4. Applies quality, freshness, and discovery filters.
 * 5. Generates explainable reasons from matching traits.
 *
 * @param userId - The authenticated user's ID.
 * @param limit - Maximum recommendations to return (default 12).
 */
export async function getPersonalizedRecommendations(
  userId: string,
  limit = 12,
): Promise<PersonalizedRecommendation[]> {
  if (!supabase) throw new Error('Recommendation service is not configured')

  // Primary: use SAIKO trait-based engine
  try {
    const traitRecs = await getTraitBasedRecommendations(userId, { limit })

    if (traitRecs.length > 0) {
      return traitRecs.map((rec): PersonalizedRecommendation => ({
        anime: rec.anime,
        score: rec.matchScore,
        reason: rec.shortReason,
        matchPercent: rec.matchPercent,
        topMatchingTraits: rec.topMatchingTraits,
      }))
    }
  } catch (traitError) {
    // If trait engine fails, log and fall back to legacy approach
    console.warn('Trait-based recommendations failed, falling back to genre matching', traitError)
  }

  // Fallback: legacy genre-overlap recommendation
  const { data: favorites, error: favoriteError } = await supabase
    .from('user_favorite_anime')
    .select('anime_id,anime(*)')
    .eq('user_id', userId)

  if (favoriteError) throw favoriteError

  const favoriteRows = (favorites ?? [])
    .map((x) => (Array.isArray(x.anime) ? x.anime[0] : x.anime))
    .filter(Boolean) as AnimeRow[]

  if (!favoriteRows.length) return []

  const excluded = new Set(favoriteRows.map((x) => x.id))
  const genreWeights = new Map<string, number>()
  favoriteRows.forEach((anime) =>
    (anime.genres ?? []).forEach((genre) =>
      genreWeights.set(genre, (genreWeights.get(genre) ?? 0) + 1)
    )
  )

  const { data, error } = await supabase
    .from('anime')
    .select('*')
    .not('id', 'in', `(${Array.from(excluded).join(',')})`)
    .limit(500)

  if (error) throw error

  return (data as AnimeRow[])
    .map(mapAnime)
    .map((anime) => {
      const overlap = anime.genres.reduce(
        (sum, genre) => sum + (genreWeights.get(genre) ?? 0), 0
      )
      const popularityTie = Math.min((anime.popularity ?? 0) / 100000, 1)
      const score = overlap * 20 + (anime.score ?? 0) * 2 + popularityTie
      const matched = anime.genres
        .filter((genre) => genreWeights.has(genre))
        .slice(0, 2)
      return {
        anime,
        score,
        reason: matched.length
          ? `Matches your interest in ${matched.join(' and ')}`
          : 'A highly rated discovery for your watchlist',
      }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}
