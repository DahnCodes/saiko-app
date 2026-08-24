import { supabase } from '../lib/supabase.ts'
import { calculateAnimeDNA, type AnimeDNA } from './animeDNA.ts'
import { getAnimeById } from './animeService.ts'
export async function getAnimeDNA(userId: string): Promise<AnimeDNA> { if (!supabase) throw new Error('DNA service is not configured'); const {data,error}=await supabase.from('user_favorite_anime').select('anime_id').eq('user_id',userId); if(error)throw error; const favorites=await Promise.all((data??[]).map((r)=>getAnimeById(r.anime_id))); return calculateAnimeDNA(userId,favorites) }
