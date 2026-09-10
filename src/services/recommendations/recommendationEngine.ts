import { supabase } from '../../lib/supabase'
import type { Anime } from '../../types/anime'
import type { AnimeRecommendation, RecommendationOptions, RecommendationScore } from './recommendationTypes'
import { getAnimeDNA } from '../dnaService'
import { getStarterAnime, getAnimeByAnilistId, mapAnime, getAnimeById, type AnimeRow } from '../animeService'
import * as aniList from '../../services/aniListService'
import { mapGenresToTraits } from './traits/metadataMapping'
import { extractTraits, getTraitById } from './traits'
import { buildTasteMap, scoreCandidateTraits, type TasteMap } from './taste/buildTasteMap'

export const CACHE_TTL_SECONDS = 60 * 60 * 4 // 4 hours
const inFlightComputations = new Map<string, Promise<AnimeRecommendation[]>>()

function clamp(v: number, a = 0, b = 1) { return Math.max(a, Math.min(b, v)) }

async function fetchCandidatesBroad(limit = 1000): Promise<Anime[]> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase
    .from('anime')
    .select('*')
    .limit(limit)
  if (error) throw error
  return ((data ?? []) as AnimeRow[]).map(mapAnime)
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
  return ((data ?? []) as AnimeRow[]).map(mapAnime)
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

// ============================================================
// SAIKO Trait-Based Recommendation Engine
// ============================================================

/**
 * Extract SAIKO trait IDs from an anime object using its metadata.
 * Falls back gracefully if extraction fails.
 */
function extractAnimeTraits(anime: Anime): string[] {
  try {
    return extractTraits({
      genres: anime.genres ?? [],
      synopsis: anime.synopsis,
      skipSynopsis: false,
    })
  } catch {
    // Fallback: map genres directly if trait extraction fails
    return mapGenresToTraits(anime.genres ?? [])
  }
}

/**
 * Build a SAIKO Taste Map from the user's Core 3 anime selections.
 * Returns null if building fails (fallback to genre-based matching).
 */
async function buildSaikoTasteMap(favoriteAnimeObjs: Anime[]): Promise<TasteMap | null> {
  if (!favoriteAnimeObjs.length) return null
  try {
    const traitArrays = favoriteAnimeObjs.map((anime) => extractAnimeTraits(anime))
    return buildTasteMap(traitArrays)
  } catch (e) {
    console.warn('Failed to build SAIKO Taste Map, falling back to genre matching', e)
    return null
  }
}

/**
 * Compute trait-based match score for a candidate anime against the user's Taste Map.
 * Returns a normalized 0-1 match score, or 0 if the candidate is ineligible.
 */
function computeTraitMatch(
  anime: Anime,
  tasteMap: TasteMap,
): { normalizedMatch: number; meaningfulCount: number; isEligible: boolean } {
  const traitIds = extractAnimeTraits(anime)
  const result = scoreCandidateTraits(traitIds, tasteMap)

  if (!result.isEligible) {
    return { normalizedMatch: 0, meaningfulCount: result.meaningfulMatchCount, isEligible: false }
  }

  // Normalize match score: divide by max possible score
  // Max possible = sum of all taste map weights
  const maxPossible = tasteMap.entries.reduce((sum, e) => sum + e.weight, 0)
  const normalizedMatch = maxPossible > 0 ? clamp(result.weightedScore / maxPossible, 0, 1) : 0

  return { normalizedMatch, meaningfulCount: result.meaningfulMatchCount, isEligible: true }
}

// Legacy DNA match for fallback
function computeDNAMatchNormalized(anime: Anime, dnaTraits: { name: string; score: number }[]) {
  if (!dnaTraits || !dnaTraits.length) return 0
  const traitMap = new Map(dnaTraits.map((t) => [t.name, t.score / 100]))
  const genreScores = (anime.genres ?? []).map((g) => traitMap.get(g) ?? 0)
  const overlap = genreScores.reduce((s, v) => s + v, 0)
  const maxPossible = Math.min(dnaTraits.length, 5)
  return clamp(overlap / Math.max(maxPossible, 1), 0, 1)
}

function reasonFromComponents(anime: Anime, significantGenres: string[], matchingTraits?: string[]) {
  const parts: string[] = []
  if (significantGenres.length) parts.push(`Matches your interest in ${significantGenres.slice(0, 2).join(' and ')}`)
  else if (matchingTraits?.length) {
    const labels = matchingTraits.slice(0, 2).map((id: string) => getTraitById(id)?.label ?? id)
    if (labels.length) parts.push(`Matches ${labels.join(' and ')}`)
  }
  if (anime.score) parts.push(`Rated ${anime.score.toFixed(1)}`)
  return parts.join(' · ')
}

// FIRE weights (centralized)
const WEIGHTS = {
  dnaMatch: 0.35, // Core 3 similarity (legacy genre-based)
  traitMatch: 0.40, // SAIKO trait-based matching (primary)
  quality: 0.20, // quality (score)
  discovery: 0.10, // hidden-gem bonus
  recency: 0.08, // recency preference
  freshness: 0.05, // freshness / season proximity
}

const POPULARITY_PENALTY_WEIGHT = 0.20

// ============================================================
// Main Recommendation Function
// ============================================================

export async function getPersonalizedHomeRecommendations(userId: string, options?: RecommendationOptions): Promise<AnimeRecommendation[]> {
  const limit = options?.limit ?? 5
  if (!supabase) throw new Error('Recommendation service not configured')

  // load DNA early for fingerprint
  const dna = await getAnimeDNA(userId)
  const fingerprint = dna.traits.slice(0, 8)
  const fingerprintNames = fingerprint.map((t) => t.name)
  const fingerprintString = dna.tasteProfile
    ? JSON.stringify({ traits: fingerprint.map((t) => ({ n: t.name, s: t.score })), profile: { confidence: dna.tasteProfile.confidence, counts: dna.tasteProfile.sourceCounts, characters: dna.tasteProfile.characterTraits.slice(0, 8).map(t => [t.id, t.score]) } })
    : JSON.stringify(fingerprint.map((t) => ({ n: t.name, s: t.score })))

  const computationKey = JSON.stringify([userId, fingerprintString, limit, Boolean(options?.forceRefresh)])
  const pending = inFlightComputations.get(computationKey)
  if (pending) return pending

  const work = (async () => {

  // Distributed lock
  const lockKey = `recompute:${userId}`
  let lockToken: string | null = null
  let redisHelpers: typeof import('../../lib/redisLock') | null = null
  let lockContended = false
  try {
    const isServer = typeof window === 'undefined'
    if (isServer && process.env.REDIS_URL) {
      redisHelpers = await import('../../lib/redisLock')
      lockToken = await redisHelpers.acquireLock(lockKey, 60_000)
      lockContended = !lockToken
    }
  } catch {
    lockToken = null
    redisHelpers = null
  }

  try {
  if (!options?.forceRefresh) {
    const start = Date.now()
    do {
      try {
        const { data: cached } = await supabase.from('user_recommendations').select('recommendations,updated_at,fingerprint').eq('user_id', userId).maybeSingle()
        if (cached && cached.fingerprint === fingerprintString) {
          const updated = new Date(cached.updated_at).getTime()
          if (Array.isArray(cached.recommendations) && cached.recommendations.length >= limit && (Date.now() - updated) / 1000 < CACHE_TTL_SECONDS) {
            return (cached.recommendations as AnimeRecommendation[]).slice(0, limit)
          }
        }
      } catch {
        // ignore
      }
      if (lockContended) await new Promise((res) => setTimeout(res, 250))
    } while (lockContended && Date.now() - start < 5000)
  }

  const computePromise = (async (): Promise<AnimeRecommendation[]> => {
    // Load favorites and starter anime
    const [favoritesResp, starterAnime] = await Promise.all([
      supabase.from('user_favorite_anime').select('anime_id').eq('user_id', userId),
      getStarterAnime(),
    ])

    if (favoritesResp.error) throw favoritesResp.error
    const favoriteRows = (favoritesResp.data ?? []) as { anime_id: string }[]
    const favoriteAnimeObjs = await Promise.all(
      favoriteRows.map((r: { anime_id: string }) => getAnimeById(r.anime_id).catch(() => null))
    )
    const validFavorites = favoriteAnimeObjs.filter(Boolean) as Anime[]
    const favoriteIds = new Set<string>(validFavorites.map((a) => String(a.id)))
    const favoriteAnilistIds = new Set<number>(validFavorites.map((a) => a.anilistId).filter(Boolean) as number[])
    const favoriteTitles = new Set<string>(validFavorites.map((a) => (a.title ?? '').toLowerCase()))
    const onboardingIds = new Set<string>((starterAnime ?? []).map((a) => a.id))

    // ============================================================
    // Build SAIKO Taste Map from Core 3 anime
    // ============================================================
    const tasteMap = await buildSaikoTasteMap(validFavorites)

    // Candidate discovery
    const [recentPool, broadPool] = await Promise.all([fetchCandidatesRecent(400), fetchCandidatesBroad(800)])
    const genrePools: Anime[] = []
    for (const trait of fingerprint.slice(0, 5)) {
      try {
        const { data } = await supabase.from('anime').select('*').contains('genres', [trait.name]).limit(200)
        if (data) genrePools.push(...((data as AnimeRow[]).map(mapAnime)))
      } catch {
        // ignore per-genre failures
      }
    }

    const merged = [...recentPool, ...genrePools, ...broadPool]
    const seen = new Set<string>()
    const candidates: Anime[] = []
    for (const a of merged) {
      if (!a || !a.id) continue
      const aid = String(a.id)
      if (seen.has(aid)) continue
      seen.add(aid)
      // Exclusions: Core 3 (by DB id, AniList id, title) + onboarding anime
      if (favoriteIds.has(aid)) continue
      if (a.anilistId && favoriteAnilistIds.has(a.anilistId)) continue
      if (favoriteTitles.has((a.title ?? '').toLowerCase())) continue
      if (onboardingIds.has(aid)) continue
      candidates.push(a)
    }

    // Integrate AniList candidates
    try {
      const dnaMap: Record<string, number> = {}
      for (const t of fingerprint) dnaMap[t.name] = t.score
      const excludeNums = Array.from(new Set([...favoriteIds].map((id) => parseInt(id, 10)).filter(Boolean)))
      const aniCandidates = await aniList.findCandidates(dnaMap, excludeNums, 50)
      const onboardingAnilistIds = new Set<number>((starterAnime ?? []).map((a) => a.anilistId).filter(Boolean) as number[])

      for (const c of aniCandidates) {
        if (c.countryOfOrigin && c.countryOfOrigin !== 'JP') continue
        if (onboardingAnilistIds.has(c.id)) continue
        if (favoriteAnilistIds.has(c.id)) continue
        try {
          const dbRow = await getAnimeByAnilistId(c.id)
          if (dbRow) {
            const dbId = String(dbRow.id)
            if (seen.has(dbId)) continue
            seen.add(dbId)
            if (favoriteIds.has(dbId)) continue
            if (favoriteAnilistIds.has(dbRow.anilistId)) continue
            if (favoriteTitles.has((dbRow.title ?? '').toLowerCase())) continue
            if (onboardingIds.has(dbRow.id)) continue
            candidates.push(dbRow)
            continue
          }
        } catch { /* Continue with provider metadata. */ }

        try {
          const upsertObj = {
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
            const dbId = String(dbAnime.id)
            if (seen.has(dbId)) continue
            seen.add(dbId)
            if (favoriteIds.has(dbId)) continue
            if (favoriteAnilistIds.has(dbAnime.anilistId)) continue
            if (favoriteTitles.has((dbAnime.title ?? '').toLowerCase())) continue
            if (onboardingIds.has(dbAnime.id)) continue
            candidates.push(dbAnime)
          }
        } catch {
          continue
        }
      }
    } catch (e) {
      console.warn('AniList integration failed', e)
    }

    // ============================================================
    // Score Each Candidate
    // ============================================================
    const scored = candidates.map((anime) => {
      // Primary: SAIKO trait-based matching
      let traitMatchNormalized = 0
      let meaningfulMatchCount = 0
      let matchingTraitIds: string[] = []
      let result: ReturnType<typeof scoreCandidateTraits> | null = null

      if (tasteMap) {
        const traitResult = computeTraitMatch(anime, tasteMap)
        traitMatchNormalized = traitResult.normalizedMatch
        meaningfulMatchCount = traitResult.meaningfulCount

        if (traitResult.isEligible) {
          const candidateTraitIds = extractAnimeTraits(anime)
          result = scoreCandidateTraits(candidateTraitIds, tasteMap)
          matchingTraitIds = result.matchingTraitIds
        }
      }

      // Fallback: legacy DNA genre match if no taste map
      const dnaMatch = tasteMap ? 0 : computeDNAMatchNormalized(anime, fingerprint)

      const genreOverlap = (anime.genres ?? []).filter((g) => fingerprintNames.includes(g)).length
      const genreScore = clamp(genreOverlap / Math.max(fingerprint.length, 1), 0, 1)
      const quality = clamp(((anime.score ?? 0) / 10), 0, 1)
      const recency = computeRecencyBonus(anime)
      const freshness = (() => {
        const currentYear = new Date().getFullYear()
        if (!anime.year) return 0
        return currentYear - anime.year <= 1 ? 1 : 0
      })()
      const discovery = ((anime.popularity ?? Infinity) <= 25000 && (anime.score ?? 0) >= 6.5 ? 1 : 0)
      const popularityPenalty = computePopularityPenalty(anime)

      // Romance bonus: only when romance aligns with matching
      const romanceBonus = ((anime.genres ?? []).includes('Romance') && (traitMatchNormalized >= 0.25 || dnaMatch >= 0.25)) ? 0.03 : 0

      // Compose total score
      const total = (
        traitMatchNormalized * WEIGHTS.traitMatch +
        dnaMatch * WEIGHTS.dnaMatch +
        quality * WEIGHTS.quality +
        discovery * WEIGHTS.discovery +
        recency * WEIGHTS.recency +
        genreScore * WEIGHTS.dnaMatch * 0.5 + // reduced genre weight since traitMatch is primary
        freshness * WEIGHTS.freshness +
        romanceBonus -
        popularityPenalty * POPULARITY_PENALTY_WEIGHT
      )

      const compScore: RecommendationScore = {
        total,
        dnaMatch: Math.max(traitMatchNormalized, dnaMatch),
        quality: quality * 10,
        recency,
        discovery,
        popularityPenalty,
      }

      const significantGenres = (anime.genres ?? []).filter((g) => fingerprintNames.includes(g))
      const reason = reasonFromComponents(anime, significantGenres, matchingTraitIds)

      return {
        anime,
        score: compScore,
        matchPercent: Math.round(clamp(traitMatchNormalized * 0.85 + Math.min(meaningfulMatchCount / Math.max(tasteMap?.entries.length ?? 3, 3), 1) * 0.15, 0, 1) * 100),
        reason,
        _traitMatch: traitMatchNormalized,
        _meaningfulCount: meaningfulMatchCount,
        _topMatchingTraits: result?.topMatchingTraits ?? [],
      }
    })

    // ============================================================
    // Eligibility Filter: candidates must have >= 3 meaningful trait matches
    // If no taste map, fall back to all candidates being eligible
    // ============================================================
    const eligibleScored = scored.filter((s) => {
      if (!tasteMap) return true
      return s._meaningfulCount >= 2
    })

    // Sort by total score
    eligibleScored.sort((a, b) => b.score.total - a.score.total)

    // Tier selection
    const tier1: typeof eligibleScored = []
    const tier2: typeof eligibleScored = []
    const tier3: typeof eligibleScored = []

    for (const s of eligibleScored) {
      const sc = s.anime.score ?? 0
      if (sc >= 8.0) tier1.push(s)
      else if (sc >= 7.5) tier2.push(s)
      else if (sc >= 7.0) tier3.push(s)
    }

    const selection: typeof eligibleScored = []
    for (const pool of [tier1, tier2, tier3]) {
      for (const item of pool) {
        if (selection.length >= limit) break
        selection.push(item)
      }
      if (selection.length >= limit) break
    }

    if (selection.length < limit) {
      for (const s of eligibleScored) {
        if (selection.length >= limit) break
        if (!selection.includes(s)) selection.push(s)
      }
    }

    const final = selection.slice(0, limit).map((r) => ({
      anime: r.anime,
      score: r.score,
      matchPercent: clamp(r.matchPercent, 0, 100),
      reason: r.reason,
    }))

    // Cache
    try {
      await supabase.from('user_recommendations').upsert(
        { user_id: userId, recommendations: final, updated_at: new Date().toISOString(), fingerprint: fingerprintString },
        { onConflict: 'user_id' }
      )
    } catch {
      // ignore cache write errors
    }

    return final
  })()

  return await computePromise
  } finally {
    if (lockToken && redisHelpers) {
      await redisHelpers.releaseLock(lockKey, lockToken).catch(() => false)
    }
  }
  })()
  inFlightComputations.set(computationKey, work)
  try {
    return await work
  } finally {
    inFlightComputations.delete(computationKey)
  }
}

export async function regeneratePersonalizedHomeRecommendations(userId: string, options?: RecommendationOptions): Promise<AnimeRecommendation[]> {
  return await getPersonalizedHomeRecommendations(userId, { ...(options ?? {}), forceRefresh: true })
}

export async function debugRecommendationPipeline(userId: string) {
  const isDev = (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') || false
  if (!isDev) throw new Error('Debug helper only available in development')
  if (!supabase) throw new Error('Supabase not configured')

  const dna = await getAnimeDNA(userId)
  const starter = await getStarterAnime()
  const favoriteResp = await supabase.from('user_favorite_anime').select('anime_id').eq('user_id', userId)
  const favoriteIds = (favoriteResp.data ?? []).map((r: { anime_id: string }) => r.anime_id)
  const fingerprint = dna.traits?.slice(0, 8) ?? []

  const favoriteAnimeObjs = await Promise.all(
    favoriteIds.map((id: string) => getAnimeById(id).catch(() => null))
  )
  const validFavorites = favoriteAnimeObjs.filter(Boolean) as Anime[]
  const tasteMap = await buildSaikoTasteMap(validFavorites)

  const anaMap: Record<string, number> = {}
  for (const t of fingerprint) anaMap[t.name] = t.score
  const candidates = await aniList.findCandidates(anaMap, favoriteIds.map((id: string) => parseInt(id, 10)), 50)

  return {
    core3: dna.favoriteAnime.map((a) => ({ id: a.id, anilistId: a.anilistId, title: a.title })),
    core3Traits: validFavorites.map((a) => ({
      title: a.title,
      traits: extractAnimeTraits(a),
    })),
    tasteMap: tasteMap ? {
      entries: tasteMap.entries.map((e) => ({ traitId: e.traitId, label: e.trait.label, weight: e.weight, occurrences: e.occurrenceCount })),
    } : null,
    fingerprint,
    onboarding: starter.map((s) => ({ id: s.id, anilistId: s.anilistId, title: s.title })),
    excludedFavorites: favoriteIds,
    sampleAniListCandidates: candidates.slice(0, 10),
  }
}
