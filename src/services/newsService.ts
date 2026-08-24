import { supabase } from '../lib/supabase.ts'
import type { NewsArticle } from '../types/news.ts'
import { cleanText } from '../lib/text.ts'

type NewsRow = { id: string; title: string; summary: string | null; image_url: string | null; source_name: string; source_url: string; published_at: string }

export async function getLatestNews(limit = 12): Promise<NewsArticle[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('news').select('id,title,summary,image_url,source_name,source_url,published_at').order('published_at', { ascending: false }).limit(limit)
  if (error) throw error
  return ((data ?? []) as NewsRow[]).map((item) => ({ id: item.id, title: cleanText(item.title), summary: cleanText(item.summary) || null, imageUrl: item.image_url, sourceName: cleanText(item.source_name), sourceUrl: item.source_url, publishedAt: item.published_at }))
}

export async function getNewsById(id: string): Promise<NewsArticle> {
  if (!supabase) throw new Error('News service is not configured')
  const { data, error } = await supabase.from('news').select('id,title,summary,image_url,source_name,source_url,published_at').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) throw new Error('News article was not found')
  const item = data as NewsRow
  return { id: item.id, title: cleanText(item.title), summary: cleanText(item.summary) || null, imageUrl: item.image_url, sourceName: cleanText(item.source_name), sourceUrl: item.source_url, publishedAt: item.published_at }
}
