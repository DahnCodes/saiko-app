import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ANILIST_URL = 'https://graphql.anilist.co'
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'content-type': 'application/json' } }) }
const query = `query SearchAnime($search: String!, $page: Int!, $perPage: Int!) { Page(page: $page, perPage: $perPage) { media(search: $search, type: ANIME, sort: SEARCH_MATCH, isAdult: false) { id idMal title { native romaji english userPreferred } synonyms description(asHtml: false) coverImage { extraLarge large } bannerImage episodes duration format status season seasonYear averageScore popularity genres startDate { year month day } endDate { year month day } } } }`
type Media = { id: number; idMal: number | null; title: { native: string | null; romaji: string | null; english: string | null; userPreferred: string | null }; synonyms: string[]; description: string | null; coverImage?: { extraLarge?: string | null; large?: string | null }; bannerImage: string | null; episodes: number | null; duration: number | null; format: string | null; status: string | null; season: string | null; seasonYear: number | null; averageScore: number | null; popularity: number | null; genres: string[] }
type Row = { id: string; anilist_id: number; mal_id: number | null; title: string; title_native: string | null; title_romaji: string | null; title_english: string | null; synonyms: string[]; description: string | null; cover_image: string | null; banner_image: string | null; episodes: number | null; format: string | null; status: string | null; season_year: number | null; average_score: number | null; popularity: number | null; genres: string[] }
const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim()
const cleanText = (value: string | null) => value?.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '').replace(/\s*\(Source:\s*[^)]+\)\s*/gi, ' ').replace(/\s+/g, ' ').trim() || null
const score = (row: Row, q: string) => { const n = normalize(q); const fields = [row.title, row.title_english, row.title_romaji, row.title_native, ...(row.synonyms ?? [])].filter(Boolean).map(normalize); return fields.reduce((best, field) => Math.max(best, field === n ? 100 : field.startsWith(n) ? 70 : field.includes(n) ? 50 : n.split(' ').every((token) => field.includes(token)) ? 30 : 0), 0) + Math.min((row.popularity ?? 0) / 10000, 1) }
function mapMedia(item: Media) { return { anilist_id: item.id, mal_id: item.idMal, title: item.title.userPreferred ?? item.title.english ?? item.title.romaji ?? item.title.native ?? 'Untitled', title_native: item.title.native, title_romaji: item.title.romaji, title_english: item.title.english, synonyms: item.synonyms ?? [], description: cleanText(item.description), cover_image: item.coverImage?.extraLarge ?? item.coverImage?.large ?? null, banner_image: item.bannerImage, episodes: item.episodes, duration: item.duration, format: item.format, status: item.status, season: item.season, season_year: item.seasonYear, average_score: item.averageScore, popularity: item.popularity, genres: item.genres ?? [], source: 'anilist' } }
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const { query: rawQuery, limit: rawLimit } = await request.json().catch(() => ({})) as { query?: unknown; limit?: unknown }
  const search = typeof rawQuery === 'string' ? rawQuery.trim() : ''
  if (!search) return json({ results: [] })
  const limit = Math.min(Math.max(Number(rawLimit) || 12, 1), 30)
  const url = Deno.env.get('SUPABASE_URL'); const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return json({ error: 'Search service is not configured' }, 500)
  const db = createClient(url, key)
  const { data } = await db.rpc('search_anime_local', { query_text: search, result_limit: limit * 2 })
  let rows = (data ?? []) as Row[]
  rows.sort((a, b) => score(b, search) - score(a, search))
  let providerFailed = false
  if (rows.length < Math.min(5, limit)) {
    const response = await fetch(ANILIST_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query, variables: { search, page: 1, perPage: limit } }), signal: AbortSignal.timeout(10000) })
    if (response.ok) { const payload = await response.json() as { data?: { Page?: { media?: Media[] } } }; const media = payload.data?.Page?.media ?? []; if (media.length) { const { data: cached } = await db.from('anime').upsert(media.map(mapMedia), { onConflict: 'anilist_id' }).select('*'); rows = [...rows, ...((cached ?? []) as Row[])] } }
    else providerFailed = true
  }
  if (providerFailed && rows.length === 0) return json({ error: "We couldn't complete that search right now." }, 503)
  const unique = [...new Map(rows.map((row) => [row.anilist_id, row])).values()].sort((a, b) => score(b, search) - score(a, search)).slice(0, limit)
  return json({ results: unique })
})
