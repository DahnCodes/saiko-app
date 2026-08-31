import { supabase } from '../../../lib/supabase';
import { extractTraitProfile } from './traitExtractor';
import type { Anime } from '../../../types/anime';
import type { AnimeTraitProfile } from './traitExtractor';

type TraitCacheRow = {
  id: string;
  anilist_id: number;
  mal_id: number | null;
  trait_profiles: AnimeTraitProfile;
  created_at: string;
  updated_at: string;
};

/**
 * In-memory fallback cache.
 * Used when the Supabase anime_traits table is unavailable or not yet migrated.
 * Survives across multiple async calls within the same page load.
 */
const sessionCache = new Map<string, AnimeTraitProfile>();

/**
 * Get a cached trait profile from the in-memory session cache.
 */
function getSessionCache(animeId: string): AnimeTraitProfile | undefined {
  return sessionCache.get(animeId);
}

/**
 * Store a trait profile in the session cache.
 */
function setSessionCache(animeId: string, profile: AnimeTraitProfile): void {
  sessionCache.set(animeId, profile);
}

/**
 * Get cached trait profile for a single anime by its DB id.
 * Returns null if not yet cached.
 */
export async function getCachedTraitProfile(animeId: string): Promise<AnimeTraitProfile | null> {
  // Check in-memory session cache first
  const sessionProfile = getSessionCache(animeId);
  if (sessionProfile) return sessionProfile;

  if (!supabase) return null;
  const { data, error } = await supabase
    .from('anime_traits')
    .select('trait_profiles')
    .eq('id', animeId)
    .maybeSingle();
  if (error) {
    // 404 (table not found) is expected during initial setup — use session cache only
    if (error.code === 'PGRST204' || error.code === '42P01') return null;
    console.warn('[traitCache] Failed to read from anime_traits cache', error);
    return null;
  }
  if (!data) return null;
  const profile = (data as TraitCacheRow).trait_profiles;
  setSessionCache(animeId, profile);
  return profile;
}

/**
 * Get cached trait profiles for multiple anime by their DB ids.
 */
export async function getCachedTraitProfiles(animeIds: string[]): Promise<Map<string, AnimeTraitProfile>> {
  const result = new Map<string, AnimeTraitProfile>();
  if (!animeIds.length) return result;

  // Check session cache first
  const uncachedIds: string[] = [];
  for (const id of animeIds) {
    const session = getSessionCache(id);
    if (session) {
      result.set(id, session);
    } else {
      uncachedIds.push(id);
    }
  }

  if (!uncachedIds.length || !supabase) return result;

  const { data, error } = await supabase
    .from('anime_traits')
    .select('id, trait_profiles')
    .in('id', uncachedIds);

  if (error) {
    if (error.code === 'PGRST204' || error.code === '42P01') return result;
    console.warn('[traitCache] Failed to batch read anime_traits cache', error);
    return result;
  }

  if (!data) return result;
  for (const row of data as TraitCacheRow[]) {
    result.set(row.id, row.trait_profiles);
    setSessionCache(row.id, row.trait_profiles);
  }
  return result;
}

/**
 * Get cached trait profiles by AniList IDs.
 */
export async function getCachedTraitProfilesByAnilistIds(
  anilistIds: number[],
): Promise<Map<number, AnimeTraitProfile>> {
  const result = new Map<number, AnimeTraitProfile>();
  if (!anilistIds.length || !supabase) return result;

  const { data, error } = await supabase
    .from('anime_traits')
    .select('anilist_id, trait_profiles')
    .in('anilist_id', anilistIds);

  if (error) {
    if (error.code === 'PGRST204' || error.code === '42P01') return result;
    console.warn('[traitCache] Failed to read anime_traits by anilist_id', error);
    return result;
  }

  if (!data) return result;
  for (const row of data as TraitCacheRow[]) {
    result.set(row.anilist_id, row.trait_profiles);
  }
  return result;
}

/**
 * Save or update trait profiles in the Supabase cache.
 * Gracefully handles when the anime_traits table does not exist yet.
 */
export async function cacheTraitProfiles(
  animeWithTraits: Array<{ anilistId: number; malId: number | null; traitProfile: AnimeTraitProfile }>,
): Promise<void> {
  if (!animeWithTraits.length) return;
  if (!supabase) return;

  const rows = animeWithTraits.map(({ anilistId, malId, traitProfile }) => ({
    anilist_id: anilistId,
    mal_id: malId,
    trait_profiles: traitProfile,
    updated_at: new Date().toISOString(),
  }));

  try {
    const { error } = await supabase
      .from('anime_traits')
      .upsert(rows, { onConflict: 'anilist_id' });

    if (error) {
      // 404 (table missing) or 42P01 (table not found) — migration not applied yet
      if (error.code === 'PGRST204' || error.code === '42P01' || (error as any).status === 404) {
        // Silently skip caching — session cache is still active
        return;
      }
      console.warn('[traitCache] Failed to cache anime trait profiles', error);
    }
  } catch (e) {
    // Network errors or other unexpected failures — caching is best-effort
  }
}

/**
 * Extract and cache trait profiles for anime that don't have them yet.
 * Uses session cache as primary, Supabase as secondary.
 */
export async function getOrExtractTraitProfiles(animeList: Anime[]): Promise<Map<string, AnimeTraitProfile>> {
  const profiles = new Map<string, AnimeTraitProfile>();
  if (!animeList.length) return profiles;

  // Batch fetch from cache (Supabase + session)
  const cached = await getCachedTraitProfiles(animeList.map((a) => a.id));

  const uncached: Anime[] = [];
  for (const anime of animeList) {
    const cachedProfile = cached.get(anime.id);
    if (cachedProfile) {
      profiles.set(anime.id, cachedProfile);
    } else {
      uncached.push(anime);
    }
  }

  // Extract traits for uncached anime
  const toCache: Array<{ anilistId: number; malId: number | null; traitProfile: AnimeTraitProfile }> = [];

  for (const anime of uncached) {
    const traitProfile = extractTraitProfile({
      genres: anime.genres ?? [],
      synopsis: anime.synopsis,
      skipSynopsis: false,
    });

    profiles.set(anime.id, traitProfile);
    setSessionCache(anime.id, traitProfile);
    toCache.push({
      anilistId: anime.anilistId,
      malId: anime.malId,
      traitProfile,
    });
  }

  // Async write to Supabase cache (best-effort, fire-and-forget)
  if (toCache.length > 0) {
    cacheTraitProfiles(toCache).catch(() => {});
  }

  return profiles;
}

/**
 * Get or extract trait profile for a single anime.
 */
export async function getOrExtractTraitProfile(anime: Anime): Promise<AnimeTraitProfile> {
  const cached = await getCachedTraitProfile(anime.id);
  if (cached) return cached;

  const profile = extractTraitProfile({
    genres: anime.genres ?? [],
    synopsis: anime.synopsis,
    skipSynopsis: false,
  });

  setSessionCache(anime.id, profile);

  cacheTraitProfiles([{
    anilistId: anime.anilistId,
    malId: anime.malId,
    traitProfile: profile,
  }]).catch(() => {});

  return profile;
}
