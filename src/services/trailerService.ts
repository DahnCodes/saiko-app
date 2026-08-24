import { supabase } from '../lib/supabase.ts'
import type { Trailer } from '../types/trailer.ts'

type TrailerRow = { id: string; anime_id: string; youtube_video_id: string; title: string; thumbnail: string | null; channel_name: string | null; published_at: string | null; duration: string | null; youtube_url: string; anime: { title: string } | { title: string }[] | null }
export async function getTrailers(limit = 24): Promise<Trailer[]> {
  if (!supabase) throw new Error('Trailer service is not configured')
  const { data, error } = await supabase.from('trailers').select('id,anime_id,youtube_video_id,title,thumbnail,channel_name,published_at,duration,youtube_url,anime(title)').order('created_at', { ascending: false }).limit(limit)
  if (error) throw error
  return ((data ?? []) as TrailerRow[]).map((item) => ({ id: item.id, animeId: item.anime_id, animeTitle: Array.isArray(item.anime) ? item.anime[0]?.title ?? 'Anime' : item.anime?.title ?? 'Anime', youtubeVideoId: item.youtube_video_id, title: item.title, thumbnail: item.thumbnail, channelName: item.channel_name, publishedAt: item.published_at, duration: item.duration, youtubeUrl: item.youtube_url }))
}
