import { getNormalizedCharacters, type NormalizedCharacter } from '../../characterProvider'
import { extractCharacterTraits, MIN_CHARACTER_TRAIT_CONFIDENCE, type TasteTrait } from '../../tasteProfile'
import type { Anime } from '../../../types/anime'

export type CharacterAffinityResult = {
  score: number | null
  matchedTraits: string[]
  characterCount: number
}

const characterCache = new Map<number, NormalizedCharacter[]>()
const MAIN_WEIGHT = 1
const SUPPORTING_WEIGHT = 0.45

async function getCachedCharacters(anime: Anime): Promise<NormalizedCharacter[]> {
  const cached = characterCache.get(anime.anilistId)
  if (cached) return cached
  const result = await getNormalizedCharacters(anime)
  characterCache.set(anime.anilistId, result.characters)
  return result.characters
}

function roleWeight(role: NormalizedCharacter['role']): number {
  if (role === 'MAIN') return MAIN_WEIGHT
  if (role === 'SUPPORTING') return SUPPORTING_WEIGHT
  return 0
}

export async function scoreCharacterAffinity(anime: Anime, userTraits: TasteTrait[]): Promise<CharacterAffinityResult> {
  if (!userTraits.length || !anime.anilistId) return { score: null, matchedTraits: [], characterCount: 0 }
  let edges: NormalizedCharacter[]
  try { edges = await getCachedCharacters(anime) } catch { return { score: null, matchedTraits: [], characterCount: 0 } }
  const meaningful = edges.filter(edge => roleWeight(edge.role) > 0)
  if (!meaningful.length) return { score: null, matchedTraits: [], characterCount: 0 }
  const user = new Map(userTraits.filter(trait => trait.confidence >= MIN_CHARACTER_TRAIT_CONFIDENCE).map(trait => [trait.id, trait.score]))
  if (!user.size) return { score: null, matchedTraits: [], characterCount: meaningful.length }
  let weightedTotal = 0
  let weightTotal = 0
  const matches = new Map<string, number>()
  meaningful.forEach(edge => {
    const weight = roleWeight(edge.role)
    const traits = extractCharacterTraits(edge)
    const seen = new Set<string>()
    traits.forEach(trait => {
      if (seen.has(trait.trait)) return
      seen.add(trait.trait)
      const userScore = user.get(trait.trait) ?? 0
      if (userScore > 0) {
        weightedTotal += userScore * (trait.confidence * weight)
        matches.set(trait.trait, Math.max(matches.get(trait.trait) ?? 0, userScore * trait.confidence))
      }
    })
    weightTotal += weight
  })
  if (!weightedTotal) return { score: 0, matchedTraits: [], characterCount: meaningful.length }
  const maxPossible = Array.from(user.values()).reduce((sum, score) => sum + score, 0) * MAIN_WEIGHT
  const score = maxPossible > 0 ? Math.min(100, (weightedTotal / (maxPossible * Math.max(weightTotal / MAIN_WEIGHT, 1))) * 100) : 0
  return { score, matchedTraits: Array.from(matches.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => id), characterCount: meaningful.length }
}

export async function enrichShortlist(shortlist: Anime[], userTraits: TasteTrait[]): Promise<Map<string, CharacterAffinityResult>> {
  const results: Array<readonly [string, CharacterAffinityResult]> = []
  let cursor = 0
  const worker = async () => {
    while (cursor < shortlist.length) {
      const anime = shortlist[cursor++]
      results.push([anime.id, await scoreCharacterAffinity(anime, userTraits)])
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, shortlist.length) }, () => worker()))
  return new Map(results)
}
