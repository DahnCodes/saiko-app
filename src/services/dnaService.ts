import { supabase } from '../lib/supabase.ts'
import { calculateAnimeDNA, type AnimeDNA } from './animeDNA.ts'
import { getAnimeById } from './animeService.ts'
import { getUserTasteProfile } from './tasteProfile.ts'

export async function getAnimeDNA(userId: string): Promise<AnimeDNA> {
  if (!supabase) throw new Error('DNA service is not configured')
  
  const { data, error } = await supabase
    .from('user_favorite_anime')
    .select('anime_id')
    .eq('user_id', userId)
  
  if (error) throw error
  
  const favorites = await Promise.all((data ?? []).map((r) => getAnimeById(r.anime_id)))
  const profile = await getUserTasteProfile(userId)
  const coreThree = favorites.filter(anime => [20, 21, 269, 16498, 21459, 101922].includes(anime.anilistId)).slice(0, 3)
  const dna = calculateAnimeDNA(userId, coreThree)
  const confidenceCopy = profile.confidence < 0.45 ? 'Based on your Core 3.' : profile.confidence < 0.7 ? 'Your taste seems to lean toward the traits you favorite.' : 'Your taste strongly leans toward these traits.'
  return { ...dna, description: `${dna.description} ${confidenceCopy}`, favoriteAnime: coreThree, tasteProfile: profile }
}
