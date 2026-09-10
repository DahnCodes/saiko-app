import { getAnimeCharacters, type AniListCharacterEdge } from './aniListService.ts'
import type { Anime } from '../types/anime.ts'

export type CharacterRole = 'MAIN' | 'SUPPORTING' | 'BACKGROUND' | 'UNKNOWN'
export type NormalizedCharacter = {
  id: string
  providerIds: { anilist?: number; mal?: number }
  name: string
  imageUrl?: string
  description?: string
  role: CharacterRole
  favourites?: number
  source: 'anilist' | 'jikan' | 'mixed'
}
export type CharacterProviderResult = { characters: NormalizedCharacter[]; provider: 'anilist' | 'jikan' | 'mixed'; diagnostics: string[] }

const jikanCache = new Map<number, NormalizedCharacter[]>()
const JIKAN_BASE = 'https://api.jikan.moe/v4'

export function normalizeRole(role: string | undefined): CharacterRole {
  const normalized = role?.trim().toUpperCase()
  if (normalized === 'MAIN' || normalized === 'SUPPORTING' || normalized === 'BACKGROUND') return normalized
  return 'UNKNOWN'
}

export function normalizeAniListCharacter(edge: AniListCharacterEdge): NormalizedCharacter {
  return { id: `anilist:${edge.node.id}`, providerIds: { anilist: edge.node.id }, name: edge.node.name.full ?? 'Unknown character', imageUrl: edge.node.image?.large ?? edge.node.image?.medium, description: edge.node.description ?? undefined, role: normalizeRole(edge.role), favourites: edge.node.favourites, source: 'anilist' }
}

type JikanCharacterRow = { character?: { mal_id?: number; name?: string; images?: { jpg?: { image_url?: string } } }; role?: string }
type JikanCharacterDetail = { data?: { mal_id?: number; name?: string; about?: string | null; images?: { jpg?: { image_url?: string } }; favorites?: number } }

async function jikanRequest<T>(path: string): Promise<T> {
  const response = await fetch(`${JIKAN_BASE}${path}`, { signal: AbortSignal.timeout(8000), headers: { accept: 'application/json' } })
  if (!response.ok) throw new Error(`Jikan request failed (${response.status})`)
  return response.json() as Promise<T>
}

async function getJikanCharacters(anime: Anime): Promise<NormalizedCharacter[]> {
  if (!anime.malId) return []
  const cached = jikanCache.get(anime.malId)
  if (cached) return cached
  const listing = await jikanRequest<{ data?: JikanCharacterRow[] }>(`/anime/${anime.malId}/characters`)
  const rows = (listing.data ?? []).slice(0, 12)
  const characters: NormalizedCharacter[] = []
  // Sequential detail requests respect Jikan's public rate limits.
  for (const row of rows) {
    const malId = row.character?.mal_id
    const name = row.character?.name
    if (!malId || !name) continue
    let detail: JikanCharacterDetail = {}
    try { detail = await jikanRequest<JikanCharacterDetail>(`/characters/${malId}/full`) } catch { /* Listing data remains usable. */ }
    const data = detail.data
    characters.push({ id: `mal:${malId}`, providerIds: { mal: malId }, name, imageUrl: row.character?.images?.jpg?.image_url ?? data?.images?.jpg?.image_url, description: data?.about ?? undefined, role: normalizeRole(row.role), favourites: data?.favorites, source: 'jikan' })
  }
  jikanCache.set(anime.malId, characters)
  return characters
}

function nameKey(name: string): string { return name.toLowerCase().replace(/[^a-z0-9]/g, '') }

export async function getNormalizedCharacters(anime: Anime): Promise<CharacterProviderResult> {
  const diagnostics: string[] = []
  let aniList: NormalizedCharacter[] = []
  try { aniList = (await getAnimeCharacters(anime.anilistId, 12)).map(normalizeAniListCharacter) } catch { diagnostics.push('anilist_unavailable') }
  const allHaveUsableDescriptions = aniList.length > 0 && aniList.every(character => Boolean(character.description?.trim()))
  if (allHaveUsableDescriptions) return { characters: aniList, provider: 'anilist', diagnostics }
  if (!anime.malId) { diagnostics.push('jikan_mapping_unavailable'); return { characters: aniList, provider: 'anilist', diagnostics } }
  let jikan: NormalizedCharacter[] = []
  try { jikan = await getJikanCharacters(anime) } catch { diagnostics.push('jikan_unavailable') }
  if (!jikan.length) return { characters: aniList, provider: aniList.length ? 'anilist' : 'jikan', diagnostics }
  if (!aniList.length) return { characters: jikan, provider: 'jikan', diagnostics }
  const byName = new Map(jikan.map(character => [nameKey(character.name), character]))
  const merged = aniList.map(character => {
    const fallback = byName.get(nameKey(character.name))
    if (!fallback) return character
    const source: NormalizedCharacter['source'] = character.description ? 'anilist' : 'mixed'
    return { ...character, description: character.description ?? fallback.description, providerIds: { ...character.providerIds, mal: fallback.providerIds.mal }, favourites: character.favourites ?? fallback.favourites, source }
  })
  return { characters: merged, provider: 'mixed', diagnostics }
}
