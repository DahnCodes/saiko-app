const ANILIST_URL = 'https://graphql.anilist.co'
const query = `query DNACharacters($ids: [Int]) { Page(perPage: 50) { media(type: ANIME, id_in: $ids) { id characters(sort: [ROLE, FAVOURITES_DESC], perPage: 12) { edges { role node { name { full } image { large medium } favourites } } } } } }`
type InputAnime = { id: string; anilistId: number; title: string; imageUrl?: string; bannerImage?: string | null }
type Edge = { role?: string; node?: { name?: { full?: string }; image?: { large?: string; medium?: string }; favourites?: number } }
Deno.serve(async (request) => {
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 })
  const body = await request.json().catch(() => ({})) as { anime?: InputAnime[] }
  const anime = (body.anime ?? []).filter((item) => Number.isInteger(item.anilistId)).slice(0, 3)
  if (!anime.length) return Response.json({ character: null })
  try {
    const response = await fetch(ANILIST_URL, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ query, variables: { ids: anime.map((item) => item.anilistId) } }), signal: AbortSignal.timeout(10_000) })
    if (!response.ok) return Response.json({ character: null })
    const payload = await response.json() as { data?: { Page?: { media?: Array<{ id: number; characters?: { edges?: Edge[] } }> } } }
    const media = payload.data?.Page?.media ?? []
    const candidates = media.flatMap((item) => { const coreIndex = anime.findIndex((entry) => entry.anilistId === item.id); return (item.characters?.edges ?? []).map((edge, index) => ({ edge, coreIndex, index })) }).filter(({ edge }) => edge.node?.image?.large || edge.node?.image?.medium).sort((a, b) => { const score = (item: typeof a) => (item.edge.role === 'MAIN' ? 1_000_000 : 0) + (item.edge.node?.favourites ?? 0) * 10 - item.coreIndex * 100 - item.index; return score(b) - score(a) })
    const chosen = candidates[0]; if (!chosen) return Response.json({ character: null })
    const source = anime[chosen.coreIndex]
    return Response.json({ character: { name: chosen.edge.node?.name?.full ?? source.title, imageUrl: chosen.edge.node?.image?.large ?? chosen.edge.node?.image?.medium, animeId: source.id, animeTitle: source.title, source: 'character' } })
  } catch { return Response.json({ character: null }) }
})
