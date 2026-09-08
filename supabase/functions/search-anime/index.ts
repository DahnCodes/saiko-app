import { corsHeaders, json, log } from '../_shared/http.ts'
import { starterAnime } from '../_shared/starter-anime.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.3'

const ANILIST_URL = 'https://graphql.anilist.co'
const query = `query SearchAnime($search: String!, $page: Int!, $perPage: Int!) { Page(page: $page, perPage: $perPage) { media(search: $search, type: ANIME, sort: SEARCH_MATCH, isAdult: false) { id idMal title { native romaji english userPreferred } synonyms description(asHtml: false) coverImage { extraLarge large } bannerImage episodes duration format status season seasonYear averageScore popularity genres startDate { year month day } endDate { year month day } } } }`
type Media = { id: number; idMal: number | null; title: { native: string | null; romaji: string | null; english: string | null; userPreferred: string | null }; synonyms: string[]; description: string | null; coverImage?: { extraLarge?: string | null; large?: string | null }; bannerImage: string | null; episodes: number | null; duration: number | null; format: string | null; status: string | null; season: string | null; seasonYear: number | null; averageScore: number | null; popularity: number | null; genres: string[] }
type Row = { id: string; anilist_id: number; mal_id: number | null; title: string; title_native: string | null; title_romaji: string | null; title_english: string | null; synonyms: string[]; description: string | null; cover_image: string | null; banner_image: string | null; episodes: number | null; format: string | null; status: string | null; season_year: number | null; average_score: number | null; popularity: number | null; genres: string[] }
const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim()
const cleanText = (value: string | null) => value?.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '').replace(/\s*\(Source:\s*[^)]+\)\s*/gi, ' ').replace(/\s+/g, ' ').trim() || null
const score = (row: Row, q: string) => { const n = normalize(q); const fields = [row.title, row.title_english, row.title_romaji, row.title_native, ...(row.synonyms ?? [])].filter((value): value is string => typeof value === 'string').map(normalize); return fields.reduce((best, field) => Math.max(best, field === n ? 100 : field.startsWith(n) ? 70 : field.includes(n) ? 50 : n.split(' ').every((token) => field.includes(token)) ? 30 : 0), 0) + Math.min((row.popularity ?? 0) / 10000, 1) }
function mapMedia(item: Media) { return { anilist_id: item.id, mal_id: item.idMal, title: item.title.userPreferred ?? item.title.english ?? item.title.romaji ?? item.title.native ?? 'Untitled', title_native: item.title.native, title_romaji: item.title.romaji, title_english: item.title.english, synonyms: item.synonyms ?? [], description: cleanText(item.description), cover_image: item.coverImage?.extraLarge ?? item.coverImage?.large ?? null, banner_image: item.bannerImage, episodes: item.episodes, duration: item.duration, format: item.format, status: item.status, season: item.season, season_year: item.seasonYear, average_score: item.averageScore, popularity: item.popularity, genres: item.genres ?? [], source: 'anilist' } }
export async function handler(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID()
  const trace = (event: string, fields: Record<string, unknown> = {}) => log('search-anime', event, { requestId, ...fields })
  try {
    trace('request_received', { method: request.method })
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (request.method !== 'POST') return json({ error: 'Method not allowed', requestId }, 405)
    let body: unknown
    try { body = await request.json() } catch { return json({ error: 'Request body must be valid JSON', requestId }, 400) }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Request body must be an object', requestId }, 400)
    const { query: rawQuery, limit: rawLimit = 12 } = body as { query?: unknown; limit?: unknown }
    if (typeof rawQuery !== 'string' || !normalize(rawQuery) || rawQuery.length > 200) {
      return json({ error: 'query must be a non-empty string of at most 200 characters', requestId }, 400)
    }
    if (typeof rawLimit !== 'number' || !Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 30) {
      return json({ error: 'limit must be an integer from 1 to 30', requestId }, 400)
    }
    // Older deployed clients strip punctuation. Restore known starter titles so
    // their existing database records remain searchable during the rollout.
    const starter = starterAnime.find(item => [item.title, item.title_english, item.title_romaji]
      .some(title => title && normalize(title) === normalize(rawQuery)))
    const search = starter?.title_english ?? rawQuery.trim()
    const limit = rawLimit
    trace('query_validated', { queryLength: search.length, limit })
    const url = Deno.env.get('SUPABASE_URL')
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !key) {
      trace('configuration_missing', { hasUrl: Boolean(url), hasServiceKey: Boolean(key) })
      return json({ error: 'Search service is not configured', requestId }, 500)
    }
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data, error: readError } = await db.rpc('search_anime_local', { query_text: search, result_limit: limit * 2 }).abortSignal(AbortSignal.timeout(5000))
    if (readError) trace('cache_read_failed', { code: readError.code })
    let rows = (Array.isArray(data) ? data : []) as Row[]
    rows.sort((a, b) => score(b, search) - score(a, search))
    trace('cache_results', { count: rows.length })
    // Any cached match is useful. Do not call AniList just to fill five slots.
    if (!rows.length) {
      let media: Media[]
      try {
        trace('provider_request', { provider: 'anilist' })
        const response = await fetch(ANILIST_URL, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ query, variables: { search, page: 1, perPage: limit } }),
          signal: AbortSignal.timeout(10000),
        })
        trace('provider_response', { status: response.status })
        if (!response.ok) return json({ error: 'Anime data provider temporarily unavailable', requestId }, 502)
        const payload = await response.json()
        if (payload?.errors?.length || !Array.isArray(payload?.data?.Page?.media)) throw new Error('Invalid provider response')
        media = payload.data.Page.media
        if (media.some(item => !item || !Number.isInteger(item.id) || !item.title ||
          Object.values(item.title).some(value => value !== null && typeof value !== 'string') ||
          (item.description != null && typeof item.description !== 'string') ||
          (item.synonyms != null && (!Array.isArray(item.synonyms) || item.synonyms.some(value => typeof value !== 'string'))) ||
          (item.genres != null && (!Array.isArray(item.genres) || item.genres.some(value => typeof value !== 'string'))))) {
          throw new Error('Invalid provider media')
        }
      } catch (error) {
        const timeout = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
        trace('provider_failed', { errorType: error instanceof Error ? error.name : 'UnknownError', timeout })
        return json({ error: timeout ? 'Anime data provider timed out' : 'Anime data provider returned an invalid response', requestId }, timeout ? 504 : 502)
      }
      if (media.length) {
        const { data: cached, error: writeError } = await db.from('anime').upsert(media.map(mapMedia), { onConflict: 'anilist_id' }).select('*').abortSignal(AbortSignal.timeout(5000))
        if (writeError || !Array.isArray(cached) || !cached.length) {
          trace('cache_write_failed', { code: writeError?.code })
          return json({ error: 'Anime results could not be saved', requestId }, 500)
        }
        rows = cached as Row[]
      } else if (readError) {
        return json({ error: 'Anime catalog temporarily unavailable', requestId }, 500)
      }
    }
    const results = [...new Map(rows.map(row => [row.anilist_id, row])).values()]
      .sort((a, b) => score(b, search) - score(a, search)).slice(0, limit)
    trace('request_completed', { count: results.length })
    return json({ results, requestId })
  } catch (error) {
    trace('unexpected_error', { errorType: error instanceof Error ? error.name : 'UnknownError' })
    return json({ error: 'Unable to search anime', requestId }, 500)
  }
}

Deno.serve(handler)
