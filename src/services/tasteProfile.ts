import { supabase } from '../lib/supabase.ts'
import type { Anime } from '../types/anime.ts'
import { getAnimeById } from './animeService.ts'
import { extractTraitProfile } from './recommendations/traits/traitExtractor.ts'
import { getAnimeCharacters } from './aniListService.ts'
import type { NormalizedCharacter } from './characterProvider.ts'
import type { AnimeTraitProfileEntry } from './recommendations/traits/traitExtractor.ts'

export const TASTE_PROFILE_VERSION = 1
export const TASTE_WEIGHTS = { coreThree: 1, favoriteAnime: 0.75, favoriteCharacter: 0.6 } as const
export const MIN_CHARACTER_TRAIT_CONFIDENCE = 0.7

export type TasteDimension = 'content' | 'narrative' | 'character'
export type TasteTrait = { id: string; score: number; confidence: number; evidenceCount: number }
export type CharacterTraitEvidence = { trait: string; confidence: number; source: 'description' | 'role' | 'curated'; evidence?: string }
export type CharacterTraitProfile = { characterId: number; traits: CharacterTraitEvidence[]; version: number; generatedAt: string }
export type UserTasteProfile = {
  userId: string
  contentTraits: TasteTrait[]
  narrativeTraits: TasteTrait[]
  characterTraits: TasteTrait[]
  confidence: number
  sourceCounts: { coreThree: number; favoriteAnime: number; favoriteCharacters: number }
  version: number
  updatedAt: string
}

const CONTENT = new Set(['action', 'adventure', 'comedy', 'drama', 'fantasy', 'horror', 'mystery', 'romance', 'sci_fi', 'slice_of_life', 'sports', 'supernatural', 'thriller'])
const NARRATIVE = new Set(['character_growth', 'rivalry', 'found_family', 'survival', 'political_intrigue', 'strategic_conflict', 'revenge', 'underdog', 'exploration', 'tragic', 'coming_of_age', 'mentorship', 'competition', 'redemption'])
const CHARACTER = new Set(['strategist', 'protector', 'underdog', 'antihero', 'morally_gray', 'leader', 'loner', 'mastermind', 'optimist', 'ambitious', 'curious', 'determined', 'reserved', 'compassionate', 'competitive'])

function diminishing(base: number, evidence: number): number { return base / Math.sqrt(evidence + 1) }
function normalize(values: Map<string, { score: number; evidence: number }>): TasteTrait[] {
  const max = Math.max(...Array.from(values.values()).map(v => v.score), 0.0001)
  return Array.from(values.entries()).map(([id, v]) => ({ id, score: Math.min(1, v.score / max), confidence: Math.min(1, 0.35 + v.evidence * 0.12), evidenceCount: v.evidence })).sort((a, b) => b.score - a.score)
}
function add(map: Map<string, { score: number; evidence: number }>, id: string, weight: number): void {
  const current = map.get(id) ?? { score: 0, evidence: 0 }
  current.score += diminishing(weight, current.evidence)
  current.evidence += 1
  map.set(id, current)
}

export function buildUserTasteProfile(userId: string, core: Anime[], favoriteAnime: Anime[], characterProfiles: CharacterTraitProfile[]): UserTasteProfile {
  const content = new Map<string, { score: number; evidence: number }>()
  const narrative = new Map<string, { score: number; evidence: number }>()
  const character = new Map<string, { score: number; evidence: number }>()
  const addAnime = (anime: Anime, weight: number) => {
    const entries = extractTraitProfile({ genres: anime.genres, synopsis: anime.synopsis, skipSynopsis: false })
    entries.forEach((entry: AnimeTraitProfileEntry) => {
      if (CONTENT.has(entry.trait)) add(content, entry.trait, weight * entry.strength)
      if (NARRATIVE.has(entry.trait)) add(narrative, entry.trait, weight * entry.strength)
    })
  }
  core.forEach(a => addAnime(a, TASTE_WEIGHTS.coreThree))
  favoriteAnime.forEach(a => addAnime(a, TASTE_WEIGHTS.favoriteAnime))
  characterProfiles.forEach(profile => profile.traits.filter(t => t.confidence >= MIN_CHARACTER_TRAIT_CONFIDENCE).forEach(t => { if (CHARACTER.has(t.trait)) add(character, t.trait, TASTE_WEIGHTS.favoriteCharacter * t.confidence) }))
  const confidence = Math.min(0.95, 0.2 + 0.12 * Math.log1p(core.length) + 0.08 * Math.log1p(favoriteAnime.length) + 0.1 * Math.log1p(characterProfiles.length))
  return { userId, contentTraits: normalize(content), narrativeTraits: normalize(narrative), characterTraits: normalize(character), confidence, sourceCounts: { coreThree: core.length, favoriteAnime: favoriteAnime.length, favoriteCharacters: characterProfiles.length }, version: TASTE_PROFILE_VERSION, updatedAt: new Date().toISOString() }
}

export async function getUserTasteProfile(userId: string): Promise<UserTasteProfile> {
  if (!supabase) throw new Error('Taste profile service is not configured')
  const { data: rows, error } = await supabase.from('user_favorite_anime').select('anime_id,anime(anilist_id)').eq('user_id', userId)
  if (error) throw error
  const raw = (rows ?? []) as Array<{ anime_id: string; anime: { anilist_id: number } | { anilist_id: number }[] | null }>
  const starter = new Set([20, 21, 269, 16498, 21459, 101922])
  const anime = (await Promise.all(raw.map(row => getAnimeById(row.anime_id).catch(() => null)))).filter((a): a is Anime => a !== null)
  const core = anime.filter(a => starter.has(a.anilistId)).slice(0, 3)
  const favorites = anime.filter(a => !starter.has(a.anilistId))
  const { data: characterRows, error: characterError } = await supabase.from('user_character_favorites').select('character_id').eq('user_id', userId)
  // Character favorites are an additive schema feature. Older Supabase
  // deployments may not have the migration yet; positive personalization
  // must continue to load in that case.
  if (characterError) return buildUserTasteProfile(userId, core, favorites, [])
  const selected = (characterRows ?? []).map(row => Number((row as { character_id: number }).character_id))
  const profiles: CharacterTraitProfile[] = []
  for (const characterId of selected) {
    const source = await resolveCharacter(characterId, anime)
    if (source) profiles.push(source)
  }
  return buildUserTasteProfile(userId, core, favorites, profiles)
}

export function extractCharacterTraits(character: NormalizedCharacter): CharacterTraitEvidence[] {
  const description = (character.description ?? '').replace(/<[^>]+>/g, ' ').toLowerCase()
  const evidence: CharacterTraitEvidence[] = []
  const rules: Array<[string, RegExp, number]> = [
    ['strategist', /strateg|tactic|plan(?:s|ning)?|intelligen/, 0.86],
    ['protector', /protect|defend|guard|safeguard/, 0.82],
    ['ambitious', /ambition|determined to|driven to|goal of/, 0.78],
    ['reserved', /quiet|reserved|emotionally distant| stoic|calm and collected/, 0.76],
    ['morally_gray', /morally gray|morally grey|anti[- ]hero|neither good nor evil/, 0.86],
    ['underdog', /underdog|from nothing|overcome adversity|against all odds/, 0.82],
    ['leader', /leader|leads|captain|commander/, 0.78],
    ['determined', /determined|resolute|persever/, 0.76],
    ['compassionate', /kind[- ]hearted|compassion|empathetic|cares deeply/, 0.78],
    ['competitive', /competitive|rival|wants to win|competition/, 0.76],
  ]
  rules.forEach(([trait, pattern, confidence]) => { const match = description.match(pattern); if (match) evidence.push({ trait, confidence, source: 'description', evidence: match[0] }) })
  if (character.role === 'MAIN') evidence.push({ trait: 'determined', confidence: 0.72, source: 'role', evidence: `${character.source} role MAIN` })
  return evidence.filter(item => item.confidence >= MIN_CHARACTER_TRAIT_CONFIDENCE)
}

async function resolveCharacter(characterId: number, anime: Anime[]): Promise<CharacterTraitProfile | null> {
  for (const item of anime) {
    try {
      const edge = (await getAnimeCharacters(item.anilistId, 25)).find(candidate => candidate.node.id === characterId)
      if (edge) {
        const normalized: NormalizedCharacter = { id: `anilist:${edge.node.id}`, providerIds: { anilist: edge.node.id }, name: edge.node.name.full ?? 'Unknown character', imageUrl: edge.node.image?.large ?? edge.node.image?.medium, description: edge.node.description ?? undefined, role: edge.role === 'MAIN' ? 'MAIN' : edge.role === 'SUPPORTING' ? 'SUPPORTING' : 'UNKNOWN', favourites: edge.node.favourites, source: 'anilist' }
        return { characterId, traits: extractCharacterTraits(normalized), version: 1, generatedAt: new Date().toISOString() }
      }
    } catch { /* Missing provider data contributes no character traits. */ }
  }
  return null
}

export async function isAnimeFavorite(userId: string, animeId: string): Promise<boolean> {
  if (!supabase) return false
  const { data, error } = await supabase.from('user_favorite_anime').select('id').eq('user_id', userId).eq('anime_id', animeId).maybeSingle()
  if (error) throw error
  return Boolean(data)
}
export async function setAnimeFavorite(userId: string, animeId: string, favorite: boolean): Promise<void> {
  if (!supabase) throw new Error('Favorites are unavailable')
  if (favorite) { const { error } = await supabase.from('user_favorite_anime').upsert({ user_id: userId, anime_id: animeId }, { onConflict: 'user_id,anime_id' }); if (error) throw error }
  else { const { error } = await supabase.from('user_favorite_anime').delete().eq('user_id', userId).eq('anime_id', animeId); if (error) throw error }
}
export async function getFavoriteCharacterIds(userId: string): Promise<Set<number>> {
  if (!supabase) return new Set()
  const { data, error } = await supabase.from('user_character_favorites').select('character_id').eq('user_id', userId)
  if (error) throw error
  return new Set((data ?? []).map(row => Number((row as { character_id: number }).character_id)))
}
export async function setCharacterFavorite(userId: string, characterId: number, animeId: string, favorite: boolean): Promise<void> {
  if (!supabase) throw new Error('Favorites are unavailable')
  if (favorite) { const { error } = await supabase.from('user_character_favorites').insert({ user_id: userId, character_id: characterId, source_anime_id: animeId }); if (error && error.code !== '23505') throw error }
  else { const { error } = await supabase.from('user_character_favorites').delete().eq('user_id', userId).eq('character_id', characterId); if (error) throw error }
}
