import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const FEED_URL = 'https://www.animenewsnetwork.com/all/rss.xml?ann-edition=us'
const SOURCE_NAME = 'Anime News Network'

type NewsRecord = { title: string; summary: string | null; source_name: string; source_url: string; published_at: string }
function decodeXml(value: string): string { return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim() }
function tagValue(item: string, tag: string): string | null { const match = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')); return match ? decodeXml(match[1]) : null }

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const feedResponse = await fetch(FEED_URL, { headers: { accept: 'application/rss+xml, application/xml' } })
  if (!feedResponse.ok) return Response.json({ error: 'Source feed unavailable' }, { status: 502 })
  const xml = await feedResponse.text()
  const records: NewsRecord[] = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)).flatMap((match) => {
    const item = match[1]
    const category = tagValue(item, 'category')?.toLowerCase()
    const title = tagValue(item, 'title')
    const sourceUrl = tagValue(item, 'link')
    const publishedAt = tagValue(item, 'pubDate')
    if (category !== 'anime' || !title || !sourceUrl || !publishedAt) return []
    const date = new Date(publishedAt)
    if (Number.isNaN(date.getTime())) return []
    return [{ title, summary: tagValue(item, 'description'), source_name: SOURCE_NAME, source_url: sourceUrl, published_at: date.toISOString() }]
  }).slice(0, 30)

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { error } = await supabase.from('news').upsert(records, { onConflict: 'source_url', ignoreDuplicates: false })
  if (error) return Response.json({ error: 'News could not be saved' }, { status: 500 })
  return Response.json({ inserted: records.length })
})
