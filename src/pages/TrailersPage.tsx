import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getTrailers } from '../services/trailerService.ts'
import type { Trailer } from '../types/trailer.ts'
import '../trailers.css'

export default function TrailersPage() {
  const [trailers, setTrailers] = useState<Trailer[]>([])
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  useEffect(() => { getTrailers().then((items) => { setTrailers(items); setStatus('success') }).catch(() => setStatus('error')) }, [])
  return <section className="trailers-page"><p className="eyebrow">Watch before you discover</p><h1>Anime trailers</h1><p className="trailers-intro">Official YouTube trailers for standout titles and hidden gems.</p>{status === 'loading' && <div className="trailer-grid">{Array.from({ length: 6 }, (_, index) => <div className="trailer-card trailer-skeleton" key={index} />)}</div>}{status === 'error' && <div className="state-panel"><h2>Trailers are unavailable right now.</h2><p>Please try again in a moment.</p></div>}{status === 'success' && trailers.length === 0 && <div className="state-panel"><h2>No trailers yet</h2><p>Official trailers will appear after the next trailer synchronization.</p></div>}{trailers.length > 0 && <div className="trailer-grid">{trailers.map((trailer) => <article className="trailer-card" key={trailer.id}><div className="trailer-frame"><iframe src={`https://www.youtube-nocookie.com/embed/${trailer.youtubeVideoId}`} title={trailer.title} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div><div className="trailer-copy"><p className="eyebrow">Official trailer</p><h2>{trailer.animeTitle}</h2><div className="trailer-links"><Link to={`/anime/${trailer.animeId}`}>View anime</Link><a href={trailer.youtubeUrl} target="_blank" rel="noreferrer">YouTube ↗</a></div></div></article>)}</div>}</section>
}
