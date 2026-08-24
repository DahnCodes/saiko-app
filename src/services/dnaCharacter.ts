import { supabase } from '../lib/supabase.ts'
import type { AnimeDNA } from './animeDNA.ts'

export type FeaturedDNACharacter = { name: string; imageUrl: string; animeId: string; animeTitle: string; source: 'character' | 'cover' | 'banner' }

const cache = new Map<string, FeaturedDNACharacter | null>()

function fallback(dna: AnimeDNA): FeaturedDNACharacter | null {
  for (const anime of dna.favoriteAnime) if (anime.imageUrl) return { name: anime.title, imageUrl: anime.imageUrl, animeId: anime.id, animeTitle: anime.title, source: 'cover' }
  for (const anime of dna.favoriteAnime) if (anime.bannerImage) return { name: anime.title, imageUrl: anime.bannerImage, animeId: anime.id, animeTitle: anime.title, source: 'banner' }
  return null
}

export async function resolveFeaturedDNACharacter(dna: AnimeDNA): Promise<FeaturedDNACharacter | null> {
  const key = `${dna.version}:${dna.favoriteAnime.map((anime) => anime.anilistId).join('-')}`
  if (cache.has(key)) return cache.get(key) ?? null
  try {
    if (!supabase) throw new Error('Character resolver is unavailable')
    const { data, error } = await supabase.functions.invoke('resolve-dna-character', { body: { anime: dna.favoriteAnime.map(({ id, anilistId, title, imageUrl, bannerImage }) => ({ id, anilistId, title, imageUrl, bannerImage })) } })
    if (error) throw error
    const character = data?.character as FeaturedDNACharacter | undefined
    if (character?.imageUrl) { cache.set(key, character); return character }
  } catch (error) { console.warn('Using Core 3 artwork for DNA card:', error) }
  const result = fallback(dna); cache.set(key, result); return result
}
