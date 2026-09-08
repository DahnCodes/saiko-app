// Public catalog requests intentionally never read or refresh a user session.
export async function publicAnimeRequest(name: 'search-anime' | 'get-starter-anime', body: object) {
  let status: number | undefined
  let safeResponse: Record<string, string> | undefined
  try {
    const url = import.meta.env.VITE_SUPABASE_URL
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY
    if (!url || !key) throw new Error('Anime service is not configured')
    const response = await fetch(`${url}/functions/v1/${name}`, {
      method: 'POST',
      // The public anon key also supports the current deployment's legacy JWT gate.
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(name === 'get-starter-anime' ? 8000 : 25000),
    })
    status = response.status
    const data = await response.json().catch(() => null)
    if (data && typeof data === 'object') {
      safeResponse = Object.fromEntries(['error', 'code', 'message', 'requestId']
        .filter(key => typeof data[key] === 'string')
        .map(key => [key, data[key].replace(/Bearer\s+\S+|eyJ[\w.-]+|sb_(?:secret|publishable)_[\w-]+/gi, '[redacted]').slice(0, 240)]))
    }
    if (!response.ok || data?.error) throw new Error(`Anime request failed (HTTP ${status}): ${safeResponse?.error ?? safeResponse?.message ?? 'Service unavailable'}`)
    if (!data || typeof data !== 'object') throw new Error(`Anime service returned invalid JSON (HTTP ${status})`)
    return data
  } catch (error) {
    console.error(`[animeService] ${name} failed`, {
      status, response: safeResponse, errorType: error instanceof Error ? error.name : 'UnknownError',
    })
    throw error instanceof Error ? error : new Error('Anime request failed')
  }
}
