import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ANILIST_URL = 'https://graphql.anilist.co'
const query = `query Trailers($ids: [Int]) { Page(perPage: 50) { media(id_in: $ids, type: ANIME, isAdult: false) { id title { userPreferred english romaji } trailer { id site thumbnail } } } }`
type Media = { id: number; title: { userPreferred: string | null; english: string | null; romaji: string | null }; trailer: { id: string; site: string; thumbnail: string | null } | null }

Deno.serve(async (request) => {
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 })
  const url = Deno.env.get('SUPABASE_URL'); const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return Response.json({ error: 'Trailer sync is not configured' }, { status: 500 })
  const body = await request.json().catch(() => ({})) as { hiddenGems?: unknown; limit?: unknown }
  const limit = Math.min(Math.max(Number(body.limit) || 30, 1), 50)
  const db = createClient(url, key)
  let animeQuery = db.from('anime').select('id,anilist_id,title').not('anilist_id', 'is', null).limit(limit)
  if (body.hiddenGems !== false) animeQuery = animeQuery.eq('is_hidden_gem', true).order('average_score', { ascending: false })
  else animeQuery = animeQuery.order('popularity', { ascending: false })
  const { data: anime, error: animeError } = await animeQuery
  if (animeError) return Response.json({ error: 'Anime records could not be loaded' }, { status: 500 })
  if (!anime?.length) return Response.json({ data: { synced: 0, checked: 0 }, error: null })

  const response = await fetch(ANILIST_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query, variables: { ids: anime.map((item) => item.anilist_id) } }), signal: AbortSignal.timeout(15_000) })
  if (!response.ok) return Response.json({ error: 'Trailer source unavailable' }, { status: 502 })
  const payload = await response.json() as { data?: { Page?: { media?: Media[] } }; errors?: unknown[] }
  if (payload.errors?.length || !Array.isArray(payload.data?.Page?.media)) return Response.json({ error: 'Trailer source returned invalid data' }, { status: 502 })
  const animeByAniListId = new Map(anime.map((item) => [item.anilist_id, item]))
  const rows = payload.data.Page.media.flatMap((item) => {
    const local = animeByAniListId.get(item.id)
    if (!local || item.trailer?.site?.toLowerCase() !== 'youtube' || !item.trailer.id) return []
    const title = item.title.userPreferred ?? item.title.english ?? item.title.romaji ?? local.title
    return [{ anime_id: local.id, youtube_video_id: item.trailer.id, title: `${title} — Official Trailer`, thumbnail: item.trailer.thumbnail ?? `https://i.ytimg.com/vi/${item.trailer.id}/hqdefault.jpg`, youtube_url: `https://www.youtube.com/watch?v=${item.trailer.id}` }]
  })
  if (!rows.length) return Response.json({ data: { synced: 0, checked: anime.length }, error: null })
  const { error } = await db.from('trailers').upsert(rows, { onConflict: 'youtube_video_id' })
  if (error) return Response.json({ error: 'Trailers could not be saved' }, { status: 500 })
  return Response.json({ data: { synced: rows.length, checked: anime.length }, error: null })
})
