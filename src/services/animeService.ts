import { supabase } from '../lib/supabase.ts'
import type { Anime } from '../types/anime.ts'
import { cleanText } from '../lib/text.ts'
import { starterAnime } from '../../supabase/functions/_shared/starter-anime.ts'
import { publicAnimeRequest } from './publicAnimeRequest.ts'
export type AnimeRow = { id: string; anilist_id: number; mal_id: number | null; title: string; title_native: string | null; title_romaji: string | null; title_english: string | null; synonyms: string[] | null; description: string | null; cover_image: string | null; banner_image: string | null; episodes: number | null; format: string | null; season_year: number | null; average_score: number | null; popularity: number | null; genres: string[] | null; status: string | null; season: string | null }
export function mapAnime(item: AnimeRow): Anime { return { id: item.id, anilistId: item.anilist_id, malId: item.mal_id, title: cleanText(item.title), nativeTitle: cleanText(item.title_native) || null, romajiTitle: cleanText(item.title_romaji) || null, englishTitle: cleanText(item.title_english) || null, synonyms: (item.synonyms ?? []).map(cleanText).filter(Boolean), type: item.format, episodes: item.episodes, score: item.average_score ? item.average_score / 10 : null, synopsis: cleanText(item.description) || null, imageUrl: item.cover_image ?? '', year: item.season_year, bannerImage: item.banner_image, status: item.status, season: item.season, popularity: item.popularity, genres: item.genres ?? [] } }
function ensureClient() { if (!supabase) throw new Error('Anime service is not configured'); return supabase }
export async function getTopAnime(limit = 12): Promise<Anime[]> { const { data, error } = await ensureClient().from('anime').select('*').order('popularity', { ascending: false, nullsFirst: false }).limit(limit); if (error) throw error; return (data as AnimeRow[]).map(mapAnime) }
export async function getAnimeById(id: string): Promise<Anime> { const { data, error } = await ensureClient().from('anime').select('*').eq('id', id).maybeSingle(); if (error) throw error; if (!data) throw new Error('Anime was not found'); return mapAnime(data as AnimeRow) }
export async function searchAnime(query: string, limit = 12): Promise<Anime[]> {
  // Keep punctuation: the database matches titles such as Demon Slayer: Kimetsu no Yaiba.
  const normalized = query.normalize('NFKC').replace(/\s+/g, ' ').trim()
  if (!normalized) return []
  const data = await publicAnimeRequest('search-anime', { query: normalized, limit })
  if (!Array.isArray(data.results) || !data.results.every(isAnimeRow)) throw new Error('Search returned invalid anime data')
  return data.results.map(mapAnime)
}
export const STARTER_ANILIST_IDS = [20, 269, 21, 101922, 16498, 21459] as const

export async function getStarterAnimeById(): Promise<Anime[]> {
  const { data, error } = await ensureClient()
    .from('anime')
    .select('*')
    .in('anilist_id', [...STARTER_ANILIST_IDS]);
  if (error) throw error;
  return ((data ?? []) as AnimeRow[]).map(mapAnime);
}

export type StarterAnimeResult = { anime: Anime[]; status: 'success' | 'partial' | 'fallback' }
const starterCacheKey = 'saiko:starter-anime:ljkwhsnetasrcpsoqtab:v1'
const cacheTtl = 60 * 60 * 1000
let starterInFlight: Promise<StarterAnimeResult> | undefined
let starterCache: { expires: number; result: StarterAnimeResult } | undefined

function isAnimeRow(value: unknown): value is AnimeRow {
  if (!value || typeof value !== 'object') return false
  const row = value as AnimeRow
  return typeof row.id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.id) &&
    Number.isInteger(row.anilist_id) && typeof row.title === 'string' &&
    (row.cover_image === null || typeof row.cover_image === 'string') &&
    ['title_native', 'title_romaji', 'title_english', 'description'].every(key =>
      row[key as keyof AnimeRow] == null || typeof row[key as keyof AnimeRow] === 'string') &&
    [row.genres, row.synonyms].every(values => values == null || (Array.isArray(values) && values.every(value => typeof value === 'string')))
}

export async function getStarterAnimeResult(): Promise<StarterAnimeResult> {
  if (starterCache && starterCache.expires > Date.now()) return starterCache.result
  if (starterInFlight) return starterInFlight
  starterInFlight = (async () => {
    let stored: { expires: number; rows: AnimeRow[] } | undefined
    try {
      const parsed = JSON.parse(localStorage.getItem(starterCacheKey) ?? 'null')
      if (Number.isFinite(parsed?.expires) && Array.isArray(parsed?.rows) && parsed.rows.every(isAnimeRow) &&
        starterAnime.every(item => parsed.rows.some((row: AnimeRow) => row.anilist_id === item.anilist_id))) stored = parsed
    } catch { /* Private browsing and corrupt storage cannot break onboarding. */ }
    let rows: AnimeRow[] = []
    let fallbackCount = 0
    if (stored && stored.expires > Date.now()) rows = stored.rows
    else {
      try {
        const data = await publicAnimeRequest('get-starter-anime', {})
        if (!Array.isArray(data.results)) throw new Error('Starter endpoint returned invalid data')
        rows = data.results.filter(isAnimeRow)
        fallbackCount = typeof data.fallbackCount === 'number' ? data.fallbackCount : 0
      } catch {
        rows = stored?.rows ?? []
        fallbackCount = 6
      }
    }
    const merged = starterAnime.map(fallback => {
      const row = rows.find(row => row.anilist_id === fallback.anilist_id)
      if (!row || !row.cover_image) fallbackCount++
      return row ? { ...fallback, ...row, title: fallback.title, cover_image: row.cover_image || fallback.cover_image } : fallback
    })
    const status = fallbackCount === 0 ? 'success' : fallbackCount >= 6 ? 'fallback' : 'partial'
    const expires = Date.now() + (status === 'success' ? cacheTtl : 30_000)
    const result: StarterAnimeResult = { anime: merged.map(mapAnime), status }
    starterCache = { expires, result }
    if (status === 'success') {
      try { localStorage.setItem(starterCacheKey, JSON.stringify({ expires, rows: merged })) } catch { /* Memory cache remains available. */ }
    }
    return result
  })()
  try { return await starterInFlight } finally { starterInFlight = undefined }
}

// Keep the existing return type used by recommendation consumers.
export async function getStarterAnime(): Promise<Anime[]> {
  return (await getStarterAnimeResult()).anime
}
export async function getAiringAnime(limit = 6): Promise<Anime[]> { const { data, error } = await ensureClient().from('anime').select('*').in('status', ['RELEASING', 'NOT_YET_RELEASED']).order('popularity', { ascending: false, nullsFirst: false }).limit(limit); if (error) throw error; return (data as AnimeRow[]).map(mapAnime) }

export async function getAnimeByAnilistId(anilistId: number): Promise<Anime | null> {
	const { data, error } = await ensureClient().from('anime').select('*').eq('anilist_id', anilistId).maybeSingle()
	if (error) throw error
	if (!data) return null
	return mapAnime(data as AnimeRow)
}
