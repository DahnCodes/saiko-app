// AniList service helper and recommendation primitives (TypeScript)
// Implements: getAnimeDNA, findCandidates, scoreCandidates, getHiddenGems

const API_URL = 'https://graphql.anilist.co'

type AniListTag = { name: string; rank: number; isMediaSpoiler?: boolean }
type AniListTitle = { romaji?: string; english?: string; native?: string }
type AniListMedia = {
  id: number
  title: AniListTitle
  genres: string[]
  tags: AniListTag[]
  averageScore?: number | null
  popularity?: number | null
  coverImage?: { large?: string }
  seasonYear?: number | null
  countryOfOrigin?: string | null
}

export type { AniListMedia }

// GraphQL queries exported as constants so they can be reused
export const GET_MEDIA_BY_IDS = `query ($ids: [Int]) { Page(perPage: 50) { media(id_in: $ids, type: ANIME) { id title { romaji } genres tags { name rank isMediaSpoiler } averageScore popularity coverImage { large } } } }`

export const FIND_CANDIDATES_QUERY = `query ($tags: [String], $exclude: [Int], $perPage: Int) { Page(perPage: $perPage) { media(tag_in: $tags, type: ANIME, format_in: [TV], averageScore_greater: 75, id_not_in: $exclude, sort: SCORE_DESC) { id title { romaji } tags { name rank } averageScore popularity coverImage { large } genres countryOfOrigin seasonYear } } }`

export const HIDDEN_GEMS_QUERY = `query ($perPage: Int, $seasonYear_greater: Int, $seasonYear_lesser: Int) { Page(perPage: $perPage) { media(type: ANIME, format_in: [TV], countryOfOrigin: "JP", averageScore_greater: 80, popularity_lesser: 40000, sort: SCORE_DESC, seasonYear_greater: $seasonYear_greater, seasonYear_lesser: $seasonYear_lesser) { id title { romaji } averageScore popularity tags(sort: RANK_DESC) { name rank } genres coverImage { large } seasonYear } } }`

// lightweight in-memory cache and localStorage fallback
const memCache = new Map<string, { ttl: number; value: any }>()
function cacheGet(key: string) {
  const entry = memCache.get(key)
  if (entry && entry.ttl > Date.now()) return entry.value
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed.ttl > Date.now()) return parsed.value
    }
  } catch {}
  return null
}
function cacheSet(key: string, value: any, seconds = 60) {
  const ttl = Date.now() + seconds * 1000
  memCache.set(key, { ttl, value })
  try { localStorage.setItem(key, JSON.stringify({ ttl, value })) } catch {}
}

async function fetchGraphQL(query: string, variables: Record<string, any> = {}, retries = 1) {
  const cacheKey = `ali:${query}:${JSON.stringify(variables)}`
  const cached = cacheGet(cacheKey)
  if (cached) return cached

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    })
    if (res.status === 429 && retries > 0) {
      // simple backoff
      await new Promise((r) => setTimeout(r, 500))
      return fetchGraphQL(query, variables, retries - 1)
    }
    if (!res.ok) throw new Error(`AniList error: ${res.status}`)
    const json = await res.json()
    if (json.errors) throw new Error(json.errors.map((e: any) => e.message).join(', '))
    cacheSet(cacheKey, json.data, 30) // short cache
    return json.data
  } catch (err) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, 500))
      return fetchGraphQL(query, variables, retries - 1)
    }
    throw err
  }
}

// 1) getAnimeDNA
export async function getAnimeDNA(animeIds: number[]): Promise<Record<string, number>> {
  if (!Array.isArray(animeIds) || animeIds.length === 0) return {}
  const data = await fetchGraphQL(GET_MEDIA_BY_IDS, { ids: animeIds })
  const media: AniListMedia[] = (data?.Page?.media ?? [])

  const tagSums = new Map<string, { sum: number; count: number }>()
  for (const m of media) {
    const tags = (m.tags ?? []).filter((t) => (t.rank ?? 0) >= 60 && !t.isMediaSpoiler)
    for (const t of tags) {
      const cur = tagSums.get(t.name) ?? { sum: 0, count: 0 }
      cur.sum += t.rank ?? 0
      cur.count += 1
      tagSums.set(t.name, cur)
    }
  }

  const dna: Record<string, number> = {}
  for (const [name, { sum, count }] of tagSums.entries()) {
    dna[name] = sum / Math.max(1, count) // average rank across shows it appeared in
  }
  return dna
}

// 2) findCandidates
export async function findCandidates(dna: Record<string, number>, excludeIds: number[] = [], perPage = 50) {
  const tags = Object.entries(dna).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k]) => k)
  if (!tags.length) return []
  const data = await fetchGraphQL(FIND_CANDIDATES_QUERY, { tags, exclude: excludeIds, perPage })
  const candidates: AniListMedia[] = data?.Page?.media ?? []
  return candidates
}

// helper: cosine similarity
function cosineSimilarity(a: number[], b: number[]) {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

// 3) scoreCandidates
export function scoreCandidates(dna: Record<string, number>, candidates: AniListMedia[]) {
  const topTags = Object.keys(dna)
  // build index of all tags (use union of dna tags and candidate tags)
  const tagSet = new Set<string>(topTags)
  for (const c of candidates) for (const t of (c.tags ?? [])) tagSet.add(t.name)
  const tagsArr = Array.from(tagSet)

  // user vector
  const userVec = tagsArr.map((t) => (dna[t] ?? 0) / 100) // normalize by 100

  const scored = candidates.map((c) => {
    const candTagMap = new Map<string, number>()
    for (const t of (c.tags ?? [])) candTagMap.set(t.name, (t.rank ?? 0) / 100)
    const vec = tagsArr.map((t) => candTagMap.get(t) ?? 0)
    const sim = cosineSimilarity(userVec, vec)
    return { candidate: c, similarity: sim }
  })

  scored.sort((a, b) => b.similarity - a.similarity)
  return scored
}

// 4) getHiddenGems
export async function getHiddenGems(perPage = 25, seasonYearGreater?: number, seasonYearLesser?: number) {
  const data = await fetchGraphQL(HIDDEN_GEMS_QUERY, { perPage, seasonYear_greater: seasonYearGreater ?? null, seasonYear_lesser: seasonYearLesser ?? null })
  return data?.Page?.media ?? []
}

export default null
