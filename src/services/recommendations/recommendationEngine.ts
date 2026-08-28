import { supabase } from '../../lib/supabase'
import type { Anime } from '../../types/anime'
import type { AnimeRecommendation, RecommendationOptions, RecommendationScore } from './recommendationTypes'
import { getAnimeDNA } from '../dnaService'
import { getStarterAnime, getAnimeByAnilistId, mapAnime } from '../animeService'
import * as aniList from '../../services/aniListService'

export const CACHE_TTL_SECONDS = 60 * 60 * 4 // 4 hours

function clamp(v: number, a = 0, b = 1) { return Math.max(a, Math.min(b, v)) }

function scoreToPercent(score: number, min = -10, max = 40) {
  // Normalize deterministic score into 0-100 range using expected min/max
  const normalized = (score - min) / (max - min)
  return Math.round(clamp(normalized, 0, 1) * 100)
}

async function fetchCandidatesBroad(limit = 1000): Promise<Anime[]> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase
    .from('anime')
    .select('*')
    .limit(limit)
  if (error) throw error
  return ((data ?? []) as any[]).map(mapAnime)
}

async function fetchCandidatesRecent(limit = 300): Promise<Anime[]> {
  if (!supabase) throw new Error('Supabase not configured')
  const currentYear = new Date().getFullYear()
  const { data, error } = await supabase
    .from('anime')
    .select('*')
    .or(`status.eq.RELEASING,season_year.gte.${currentYear - 1}`)
    .limit(limit)
  if (error) throw error
  return ((data ?? []) as any[]).map(mapAnime)
}

function computeRecencyBonus(anime: Anime) {
  const currentYear = new Date().getFullYear()
  if (anime.status === 'RELEASING') return 1.0
  if (!anime.year) return 0
  const age = currentYear - anime.year
  if (age <= 0) return 0.9
  if (age === 1) return 0.6
  if (age === 2) return 0.3
  return 0
}

function computePopularityPenalty(anime: Anime) {
  const pop = anime.popularity ?? 0
  const normalized = clamp(pop / 200000, 0, 1)
  return normalized
}

function computeDNAMatchNormalized(anime: Anime, dnaTraits: { name: string; score: number }[]) {
  if (!dnaTraits || !dnaTraits.length) return 0
  const traitMap = new Map(dnaTraits.map((t) => [t.name, t.score / 100]))
  const genreScores = (anime.genres ?? []).map((g) => traitMap.get(g) ?? 0)
  const overlap = genreScores.reduce((s, v) => s + v, 0)
  const maxPossible = Math.min(dnaTraits.length, 5)
  return clamp(overlap / Math.max(maxPossible, 1), 0, 1)
}

function reasonFromComponents(anime: Anime, significantGenres: string[]) {
  const parts: string[] = []
  if (significantGenres.length) parts.push(`Matches your interest in ${significantGenres.slice(0, 2).join(' and ')}`)
  if (anime.score) parts.push(`Rated ${anime.score.toFixed(1)}`)
  return parts.join(' · ')
}

// FIRE weights (centralized)
const WEIGHTS = {
  dnaMatch: 0.35, // Core 3 similarity
  quality: 0.25, // quality (score)
  discovery: 0.15, // discovery / hidden-gem bonus
  recency: 0.10, // recency preference
  genre: 0.10, // genre/theme compatibility
  freshness: 0.05, // freshness / season proximity
}

const POPULARITY_PENALTY_WEIGHT = 0.20

export async function getPersonalizedHomeRecommendations(userId: string, options?: RecommendationOptions): Promise<AnimeRecommendation[]> {
  const limit = options?.limit ?? 5
  if (!supabase) throw new Error('Recommendation service not configured')

  // try cache
  try {
    const { data: cached, error: cacheErr } = await supabase.from('user_recommendations').select('recommendations,updated_at').eq('user_id', userId).maybeSingle()
    if (!cacheErr && cached?.updated_at) {
      const updated = new Date(cached.updated_at).getTime()
      if ((Date.now() - updated) / 1000 < CACHE_TTL_SECONDS) {
        return cached.recommendations as AnimeRecommendation[]
      }
    }
  } catch {
    // ignore cache errors
  }

  // load signals
  const [dna, favoritesResp, starterAnime] = await Promise.all([
    getAnimeDNA(userId),
    supabase.from('user_favorite_anime').select('anime_id').eq('user_id', userId),
    getStarterAnime(),
  ])
  const favoriteRows = (favoritesResp.data ?? []) as { anime_id: string }[]
  const favoriteIds = new Set(favoriteRows.map((r) => r.anime_id))
  // also collect favorite Anilist IDs to exclude AniList candidates
  const favoriteAnilistIds = new Set<number>()
  try {
    if (favoriteRows.length) {
      const { data: favAnimeRows } = await supabase.from('anime').select('anilist_id').in('id', favoriteRows.map((r) => r.anime_id))
      for (const row of (favAnimeRows ?? [])) if (row.anilist_id) favoriteAnilistIds.add(row.anilist_id)
    }
  } catch {}
  const onboardingIds = new Set((starterAnime ?? []).map((a) => a.id))

  // build fingerprint from DNA traits (weighted by score)
  const fingerprint = dna.traits.slice(0, 8)
  const fingerprintNames = fingerprint.map((t) => t.name)

  // candidate discovery: combine recent pool and genre-driven pools
  const [recentPool, broadPool] = await Promise.all([fetchCandidatesRecent(400), fetchCandidatesBroad(800)])
  const genrePools: Anime[] = []
  for (const trait of fingerprint.slice(0, 5)) {
    try {
      const { data } = await supabase.from('anime').select('*').contains('genres', [trait.name]).limit(200)
      if (data) genrePools.push(...((data as any[]).map(mapAnime)))
    } catch {
      // ignore per-genre failures
    }
  }

  const merged = [...recentPool, ...genrePools, ...broadPool]
  // merged is recent + genre-targeted + broad pool
  const seen = new Set<string>()
  const candidates: Anime[] = []
  for (const a of merged) {
    if (!a || !a.id) continue
    if (seen.has(a.id)) continue
    seen.add(a.id)
    // Exclusions: user's favorites (Core 3), onboarding starter titles (calibration), and any favorites
    if (favoriteIds.has(a.id)) continue
    if (onboardingIds.has(a.id)) continue
    candidates.push(a)
  }

  // Integrate AniList candidates (ensure only Japanese anime)
  try {
    const dnaMap: Record<string, number> = {}
    for (const t of fingerprint) dnaMap[t.name] = t.score
    const excludeNums = Array.from(new Set([...favoriteIds].map((id) => parseInt(id, 10)).filter(Boolean)))
    const aniCandidates = await aniList.findCandidates(dnaMap, excludeNums, 50)
    // build onboarding Anilist id set to ensure exclusion across systems
    const onboardingAnilistIds = new Set((starterAnime ?? []).map((a) => a.anilistId).filter(Boolean))
    for (const c of aniCandidates) {
      if (c.countryOfOrigin && c.countryOfOrigin !== 'JP') continue
      if (onboardingAnilistIds.has(c.id)) continue
      if (favoriteAnilistIds.has(c.id)) continue
      // try to find a matching DB row by anilist_id
      try {
        const dbRow = await getAnimeByAnilistId(c.id)
        if (dbRow) {
          if (seen.has(dbRow.id)) continue
          seen.add(dbRow.id)
          if (favoriteIds.has(dbRow.id)) continue
          if (onboardingIds.has(dbRow.id)) continue
          candidates.push(dbRow)
          continue
        }
      } catch {}

      // upsert AniList candidate into local DB so we can treat it as a first-class anime
      try {
        const upsertObj: any = {
          anilist_id: c.id,
          title: c.title?.romaji ?? c.title?.english ?? `Anime ${c.id}`,
          title_romaji: c.title?.romaji ?? null,
          title_english: c.title?.english ?? null,
          cover_image: c.coverImage?.large ?? null,
          average_score: c.averageScore ?? null,
          popularity: c.popularity ?? null,
          genres: c.genres ?? [],
          season_year: c.seasonYear ?? null,
        }
        await supabase.from('anime').upsert(upsertObj, { onConflict: 'anilist_id' })
        const dbAnime = await getAnimeByAnilistId(c.id)
        if (dbAnime) {
          if (seen.has(dbAnime.id)) continue
          seen.add(dbAnime.id)
          if (favoriteIds.has(dbAnime.id)) continue
          if (onboardingIds.has(dbAnime.id)) continue
          candidates.push(dbAnime)
          continue
        }
      } catch (e) {
        // fallback: if upsert fails, skip candidate
        continue
      }
    }
  } catch (e) {
    // ignore AniList failures — continue with DB candidates
    console.warn('AniList integration failed', e)
  }

  // score each candidate
  const scored = candidates.map((anime) => {
    const dnaMatch = computeDNAMatchNormalized(anime, fingerprint)
    const genreOverlap = (anime.genres ?? []).filter((g) => fingerprintNames.includes(g)).length
    const genreScore = clamp(genreOverlap / Math.max(fingerprint.length, 1), 0, 1)
    const quality = clamp(((anime.score ?? 0) / 10), 0, 1)
    const recency = computeRecencyBonus(anime)
    const freshness = (() => {
      const currentYear = new Date().getFullYear()
      if (!anime.year) return 0
      return currentYear - anime.year <= 1 ? 1 : 0
    })()
    const discovery = ((anime as any).is_hidden_gem ? 1 : 0)
    const popularityPenalty = computePopularityPenalty(anime)

    // romance bonus (only awarded when romance aligns with fingerprint)
    const romanceBonus = ((anime.genres ?? []).includes('Romance') && dnaMatch >= 0.25) ? 0.03 : 0

    const total = (
      dnaMatch * WEIGHTS.dnaMatch +
      quality * WEIGHTS.quality +
      discovery * WEIGHTS.discovery +
      recency * WEIGHTS.recency +
      genreScore * WEIGHTS.genre +
      freshness * WEIGHTS.freshness +
      romanceBonus -
      popularityPenalty * POPULARITY_PENALTY_WEIGHT
    )

    const compScore: RecommendationScore = {
      total,
      dnaMatch,
      quality: quality * 10,
      recency,
      discovery,
      popularityPenalty,
    }

    const significantGenres = (anime.genres ?? []).filter((g) => fingerprintNames.includes(g))
    const reason = reasonFromComponents(anime, significantGenres)
    return { anime, score: compScore, matchPercent: scoreToPercent(total, -1, 1.2), reason }
  })

  // prefer higher-scored and prefer Tier 1 (score >= 8.0) when filling
  scored.sort((a, b) => b.score.total - a.score.total)


  // build final list preferring high-quality tiers but allowing fallback
  const tier1: typeof scored = []
  const tier2: typeof scored = []
  const tier3: typeof scored = []
  for (const s of scored) {
    const sc = s.anime.score ?? 0
    if (sc >= 8.0) tier1.push(s)
    else if (sc >= 7.5) tier2.push(s)
    else if (sc >= 7.0) tier3.push(s)
  }

  const selection: typeof scored = []
  for (const pool of [tier1, tier2, tier3]) {
    for (const item of pool) {
      if (selection.length >= limit) break
      selection.push(item)
    }
    if (selection.length >= limit) break
  }

  // if still short, fill from remaining scored
  if (selection.length < limit) {
    for (const s of scored) {
      if (selection.length >= limit) break
      if (!selection.includes(s)) selection.push(s)
    }
  }

  // romance is handled as a small scoring bonus earlier; do not force inclusion

  const final = selection.slice(0, limit).map((r) => ({ ...r, matchPercent: clamp(r.matchPercent, 0, 100) }))

  // cache best-effort
  try {
    await supabase.from('user_recommendations').upsert({ user_id: userId, recommendations: final, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  } catch {
    // ignore
  }

  return final
}

// Invalidate and regenerate recommendations for a user (client-safe upsert)
export async function regeneratePersonalizedHomeRecommendations(userId: string, options?: RecommendationOptions): Promise<AnimeRecommendation[]> {
  if (!supabase) throw new Error('Recommendation service not configured')
  try {
    // Mark cache stale by writing an old updated_at; security policies allow upsert by the authenticated user
    await supabase.from('user_recommendations').upsert({ user_id: userId, recommendations: [], updated_at: new Date(0).toISOString() }, { onConflict: 'user_id' })
  } catch {
    // ignore cache invalidation failures
  }
  // Now compute fresh recommendations which will upsert the new row
  return await getPersonalizedHomeRecommendations(userId, options)
}

// Dev-only debug helper to inspect pipeline for a user
export async function debugRecommendationPipeline(userId: string) {
  const isDev = ((globalThis as any).process?.env?.NODE_ENV === 'development') || false
  if (!isDev) throw new Error('Debug helper only available in development')
  if (!supabase) throw new Error('Supabase not configured')
  const dna = await getAnimeDNA(userId)
  const starter = await getStarterAnime()
  const favoriteResp = await supabase.from('user_favorite_anime').select('anime_id').eq('user_id', userId)
  const favoriteIds = (favoriteResp.data ?? []).map((r: any) => r.anime_id)
  const fingerprint = dna.traits?.slice(0, 8) ?? []
  const anaMap: Record<string, number> = {}
  for (const t of fingerprint) anaMap[t.name] = t.score
  const candidates = await aniList.findCandidates(anaMap, favoriteIds.map((id: any) => parseInt(id, 10)), 50)
  const counts = { recentPool: 0, genrePool: fingerprint.slice(0, 5).length, broadPool: 0, aniListCandidates: candidates.length }
  return {
    core3: dna.favoriteAnime.map((a) => ({ id: a.id, anilistId: a.anilistId, title: a.title })),
    fingerprint,
    onboarding: starter.map((s) => ({ id: s.id, anilistId: s.anilistId, title: s.title })),
    excludedFavorites: favoriteIds,
    candidateCounts: counts,
    sampleAniListCandidates: candidates.slice(0, 10),
  }
}
