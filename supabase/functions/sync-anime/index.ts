import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ANILIST_URL = 'https://graphql.anilist.co'
const MAX_PAGE_SIZE = 50
const query = `query SyncAnime($page: Int!, $perPage: Int!, $sort: [MediaSort], $maxPopularity: Int, $minScore: Int) { Page(page: $page, perPage: $perPage) { media(type: ANIME, sort: $sort, isAdult: false, popularity_lesser: $maxPopularity, averageScore_greater: $minScore) { id idMal title { native romaji english userPreferred } synonyms description(asHtml: false) coverImage { extraLarge large } bannerImage episodes duration format status season seasonYear averageScore popularity genres startDate { year month day } endDate { year month day } } } }`

type FuzzyDate = { year: number | null; month: number | null; day: number | null }
type Media = { id: number; idMal: number | null; title: { native: string | null; romaji: string | null; english: string | null; userPreferred: string | null }; synonyms: string[]; description: string | null; coverImage?: { extraLarge?: string | null; large?: string | null }; bannerImage: string | null; episodes: number | null; duration: number | null; format: string | null; status: string | null; season: string | null; seasonYear: number | null; averageScore: number | null; popularity: number | null; genres: string[]; startDate?: FuzzyDate; endDate?: FuzzyDate }
type AniListResponse = { data?: { Page?: { media?: Media[] } }; errors?: Array<{ message?: string }> }

function toDate(value?: FuzzyDate): string | null { if (!value?.year || !value.month || !value.day) return null; return `${value.year}-${String(value.month).padStart(2, '0')}-${String(value.day).padStart(2, '0')}` }
function positiveInteger(value: unknown, fallback: number, maximum?: number): number { const number = Number(value); if (!Number.isInteger(number) || number < 1) return fallback; return maximum ? Math.min(number, maximum) : number }
const cleanText = (value: string | null) => value?.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '').replace(/\s*\(Source:\s*[^)]+\)\s*/gi, ' ').replace(/\s+/g, ' ').trim() || null

Deno.serve(async (request) => {
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: { allow: 'POST' } })
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) { console.error('sync-anime: missing server credentials'); return Response.json({ error: 'Sync service is not configured' }, { status: 500 }) }

  const body = await request.json().catch(() => ({})) as { page?: unknown; perPage?: unknown; mode?: unknown }
  const page = positiveInteger(body.page, 1)
  const hiddenGems = body.mode === 'hidden_gems'
  const perPage = positiveInteger(body.perPage, hiddenGems ? MAX_PAGE_SIZE : 20, MAX_PAGE_SIZE)
  const sort = hiddenGems ? 'SCORE_DESC' : 'POPULARITY_DESC'
  const maxPopularity = hiddenGems ? 25001 : null
  const minScore = hiddenGems ? 64 : null

  try {
    const response = await fetch(ANILIST_URL, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ query, variables: { page, perPage, sort, maxPopularity, minScore } }), signal: AbortSignal.timeout(15_000) })
    if (response.status === 429) { console.warn('sync-anime: AniList rate limit reached', { page, perPage }); return Response.json({ error: 'Anime source rate limit reached', retryable: true }, { status: 503 }) }
    if (!response.ok) { console.error('sync-anime: AniList request failed', { status: response.status, page, perPage }); return Response.json({ error: 'Anime source unavailable', retryable: response.status >= 500 }, { status: 502 }) }

    const payload = await response.json() as AniListResponse
    if (payload.errors?.length || !Array.isArray(payload.data?.Page?.media)) { console.error('sync-anime: invalid AniList response', { errors: payload.errors }); return Response.json({ error: 'Anime source returned invalid data' }, { status: 502 }) }
    const syncedAt = new Date().toISOString()
    const selected = hiddenGems ? payload.data.Page.media.filter((item) => (item.averageScore ?? 0) >= 65 && (item.popularity ?? Number.MAX_SAFE_INTEGER) <= 25000) : payload.data.Page.media
    const rows = selected.map((item) => ({ anilist_id: item.id, mal_id: item.idMal, title: item.title.userPreferred ?? item.title.english ?? item.title.romaji ?? item.title.native ?? 'Untitled', title_native: item.title.native, title_romaji: item.title.romaji, title_english: item.title.english, synonyms: item.synonyms ?? [], description: cleanText(item.description), cover_image: item.coverImage?.extraLarge ?? item.coverImage?.large ?? null, banner_image: item.bannerImage, episodes: item.episodes, duration: item.duration, format: item.format, status: item.status, season: item.season, season_year: item.seasonYear, average_score: item.averageScore, popularity: item.popularity, genres: item.genres ?? [], start_date: toDate(item.startDate), end_date: toDate(item.endDate), source: 'anilist', is_hidden_gem: hiddenGems, updated_at: syncedAt }))
    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const { error } = await supabase.from('anime').upsert(rows, { onConflict: 'anilist_id' })
    if (error) { console.error('sync-anime: database upsert failed', { code: error.code, message: error.message }); return Response.json({ error: 'Anime could not be saved', retryable: true }, { status: 500 }) }
    console.info('sync-anime: sync completed', { mode: hiddenGems ? 'hidden_gems' : 'popular', page, perPage, synced: rows.length })
    return Response.json({ data: { synced: rows.length, page, perPage, mode: hiddenGems ? 'hidden_gems' : 'popular' }, error: null })
  } catch (error) {
    console.error('sync-anime: unexpected failure', error)
    return Response.json({ error: 'Anime synchronization failed', retryable: true }, { status: 500 })
  }
})
