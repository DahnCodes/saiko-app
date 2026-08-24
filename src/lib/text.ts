const entities: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'" }
export function cleanText(value: string | null | undefined): string {
  if (!value) return ''
  const cleaned = value.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '').replace(/&(?:amp|lt|gt|quot|#39|apos);/gi, (match) => entities[match.toLowerCase()] ?? match).replace(/\s*\(Source:\s*[^)]+\)\s*/gi, ' ').replace(/\s+/g, ' ').trim()
  return cleaned.length > 280 ? `${cleaned.slice(0, 277).trimEnd()}...` : cleaned
}
