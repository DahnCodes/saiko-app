import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { searchAnime } from '../services/animeService.ts'
import type { Anime } from '../types/anime.ts'
import '../anime.css'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Anime[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const requestId = useRef(0)

  useEffect(() => {
    const term = query.trim()
    if (!term) return
    const currentRequest = ++requestId.current
    const timer = window.setTimeout(async () => {
      setStatus('loading')
      try { const items = await searchAnime(term); if (currentRequest === requestId.current) { setResults(items); setStatus('success') } }
      catch { if (currentRequest === requestId.current) setStatus('error') }
    }, 350)
    return () => window.clearTimeout(timer)
  }, [query])

  function clearSearch() { requestId.current += 1; setQuery(''); setResults([]); setStatus('idle') }
  function handleQueryChange(value: string) { setQuery(value); if (!value.trim()) { requestId.current += 1; setResults([]); setStatus('idle') } }

  return <section className="search-page">
  <p className="eyebrow">Find your next watch</p>
  
  <h1>Search anime</h1><div className="search-form"><label htmlFor="anime-search">Search titles</label><div><input id="anime-search" type="search" value={query} onChange={(event) => handleQueryChange(event.target.value)} placeholder="Try English, Romaji, or a native title" autoComplete="off" />{query && <button className="clear-search" type="button" onClick={clearSearch}>Clear</button>}</div></div>{status === 'loading' && <div className="state-panel" aria-live="polite">Searching anime...</div>}{status === 'error' && <div className="state-panel"><h2>We couldn't complete that search right now.</h2><p>Please try again in a moment.</p></div>}{status === 'success' && results.length === 0 && <div className="state-panel"><h2>No anime found</h2><p>Try another title, spelling, or native title.</p></div>}{status === 'success' && results.length > 0 && <div className="anime-grid">{results.map((item) => <Link className="anime-card" to={`/anime/${item.id}`} key={item.id}>{item.imageUrl && <img src={item.imageUrl} alt={`${item.title} cover`} loading="lazy" />}<div className="anime-card-body"><h2>{item.title}</h2>{item.nativeTitle && item.nativeTitle !== item.title && <p className="anime-alt-title">{item.nativeTitle}</p>}<p className="anime-meta">{[item.type, item.year].filter(Boolean).join(' · ') || 'Anime'} {item.score ? `· ★ ${item.score.toFixed(1)}` : ''}</p>{item.genres.length > 0 && <p className="anime-genres">{item.genres.slice(0, 3).join(' · ')}</p>}</div></Link>)}</div>}</section>
}
