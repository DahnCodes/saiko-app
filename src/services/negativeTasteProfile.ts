import { supabase } from '../lib/supabase.ts'
import { getAnimeById } from './animeService.ts'
import { extractAnimeTraitVector, type AnimeTraitVector } from './recommendations/v35/traitExtractor.ts'
import type { Anime } from '../types/anime.ts'

export const NEGATIVE_PROFILE_VERSION = 1
export const NOT_FOR_ME_TRAIT_WEIGHT = 0.3
export const MIN_NEGATIVE_TRAIT_EVIDENCE = 2
export const MAX_NEGATIVE_PENALTY = 15
export type NegativeTasteTrait = { id: string; score: number; evidenceCount: number }
export type NegativeTasteProfile = { contentTraits: NegativeTasteTrait[]; narrativeTraits: NegativeTasteTrait[]; characterTraits: NegativeTasteTrait[]; evidenceCount: number; version: number; updatedAt: string }

type Accumulator = { raw: number; evidence: number }
const CONTENT = new Set(['action', 'adventure', 'comedy', 'drama', 'fantasy', 'horror', 'mystery', 'romance', 'sci_fi', 'slice_of_life', 'sports', 'supernatural', 'thriller'])
const NARRATIVE = new Set(['character_growth', 'rivalry', 'found_family', 'survival', 'political_intrigue', 'strategic_conflict', 'revenge', 'underdog', 'exploration', 'tragic', 'coming_of_age', 'mentorship', 'competition', 'redemption'])

function add(map: Map<string, Accumulator>, id: string, strength: number): void {
  const current = map.get(id) ?? { raw: 0, evidence: 0 }
  current.raw += NOT_FOR_ME_TRAIT_WEIGHT * strength / Math.sqrt(current.evidence + 1)
  current.evidence += 1
  map.set(id, current)
}
function normalize(map: Map<string, Accumulator>): NegativeTasteTrait[] {
  const eligible = Array.from(map.entries()).filter(([, value]) => value.evidence >= MIN_NEGATIVE_TRAIT_EVIDENCE)
  const max = Math.max(...eligible.map(([, value]) => value.raw), 0.0001)
  return eligible.map(([id, value]) => ({ id, score: Math.min(1, value.raw / max), evidenceCount: value.evidence })).sort((a, b) => b.score - a.score)
}

export function buildNegativeTasteProfile(rejectedAnime: Anime[]): NegativeTasteProfile {
  const content = new Map<string, Accumulator>(); const narrative = new Map<string, Accumulator>()
  rejectedAnime.forEach(anime => { const vector = extractAnimeTraitVector({ genres: anime.genres, synopsis: anime.synopsis }); Object.entries(vector).forEach(([id, strength]) => { if (CONTENT.has(id)) add(content, id, strength); if (NARRATIVE.has(id)) add(narrative, id, strength) }) })
  return { contentTraits: normalize(content), narrativeTraits: normalize(narrative), characterTraits: [], evidenceCount: rejectedAnime.length, version: NEGATIVE_PROFILE_VERSION, updatedAt: new Date().toISOString() }
}

export async function getNegativeTasteProfile(userId: string): Promise<NegativeTasteProfile> {
  if (!supabase) throw new Error('Negative taste profile service is not configured')
  const { data, error } = await supabase.from('user_anime_feedback').select('anime_id').eq('user_id', userId).eq('feedback_type', 'not_for_me')
  // The feedback migration is additive; older deployments should continue to
  // serve recommendations until it is applied.
  if (error) return buildNegativeTasteProfile([])
  const anime = (await Promise.all((data ?? []).map(row => getAnimeById(String((row as { anime_id: string }).anime_id)).catch(() => null)))).filter((item): item is Anime => item !== null)
  return buildNegativeTasteProfile(anime)
}

export function calculateNegativePenalty(anime: Anime, profile: NegativeTasteProfile): number {
  if (!profile.contentTraits.length && !profile.narrativeTraits.length) return 0
  const vector: AnimeTraitVector = extractAnimeTraitVector({ genres: anime.genres, synopsis: anime.synopsis })
  const negative = new Map([...profile.contentTraits, ...profile.narrativeTraits].map(trait => [trait.id, trait.score]))
  const raw = Object.entries(vector).reduce((sum, [id, strength]) => sum + (negative.get(id) ?? 0) * strength, 0)
  return Math.min(MAX_NEGATIVE_PENALTY, raw * MAX_NEGATIVE_PENALTY)
}

export async function hasNegativeFeedback(userId: string, animeId: string): Promise<boolean> {
  if (!supabase) return false
  const { data, error } = await supabase.from('user_anime_feedback').select('id').eq('user_id', userId).eq('anime_id', animeId).eq('feedback_type', 'not_for_me').maybeSingle()
  if (error) throw error
  return Boolean(data)
}
export async function setNegativeFeedback(userId: string, animeId: string, enabled: boolean): Promise<void> {
  if (!supabase) throw new Error('Feedback is unavailable')
  if (enabled) { const { error } = await supabase.from('user_anime_feedback').insert({ user_id: userId, anime_id: animeId, feedback_type: 'not_for_me' }); if (error && error.code !== '23505') throw error }
  else { const { error } = await supabase.from('user_anime_feedback').delete().eq('user_id', userId).eq('anime_id', animeId).eq('feedback_type', 'not_for_me'); if (error) throw error }
}
