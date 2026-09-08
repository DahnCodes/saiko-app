import { corsHeaders, json, log } from '../_shared/http.ts'
import { starterAnime } from '../_shared/starter-anime.ts'

export async function handler(request: Request): Promise<Response> {
  try {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
    log('get-starter-anime', 'request_received')
    const url = Deno.env.get('SUPABASE_URL')
    const key = Deno.env.get('SUPABASE_ANON_KEY')
    if (!url || !key) throw new Error('configuration_missing')
    // One public read of the persistent cache; never perform six live searches.
    const params = new URLSearchParams({ select: '*', anilist_id: `in.(${starterAnime.map(a => a.anilist_id).join(',')})` })
    const response = await fetch(`${url}/rest/v1/anime?${params}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5000),
    })
    log('get-starter-anime', 'database_response', { status: response.status })
    if (!response.ok) throw new Error('database_unavailable')
    const rows = await response.json()
    if (!Array.isArray(rows)) throw new Error('invalid_database_response')
    let fallbackCount = 0
    const results = starterAnime.map(fallback => {
      const row = rows.find(row => row?.anilist_id === fallback.anilist_id &&
        typeof row.id === 'string' && typeof row.title === 'string' &&
        typeof row.cover_image === 'string' && Array.isArray(row.genres))
      if (!row) fallbackCount++
      return row ? { ...fallback, ...row, title: fallback.title } : fallback
    })
    return json({ results, fallbackCount })
  } catch (error) {
    log('get-starter-anime', 'fallback', { errorType: error instanceof Error ? error.name : 'UnknownError' })
    return json({ results: starterAnime, fallbackCount: starterAnime.length })
  }
}

Deno.serve(handler)
