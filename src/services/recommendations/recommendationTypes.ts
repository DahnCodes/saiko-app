import type { Anime } from '../../types/anime'

export type AnimeCandidate = Anime

export type AnimeTasteProfile = {
  archetypeId: string
  traits: { name: string; score: number }[]
}

export type RecommendationScore = {
  total: number
  dnaMatch: number
  quality: number
  recency: number
  discovery: number
  popularityPenalty: number
}

export type RecommendationReason = string

export type AnimeRecommendation = {
  anime: AnimeCandidate
  score: RecommendationScore
  matchPercent: number
  reason: RecommendationReason
}

export type RecommendationOptions = {
  limit?: number
  forceRefresh?: boolean
}

export default null
