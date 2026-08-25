import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAiringAnime, getTopAnime } from '../services/animeService.ts'
import type { Anime } from '../types/anime.ts'
import '../anime.css'
import '../home.css'
import '../home-overrides.css'

export default function HomePage() {
  const [top, setTop] = useState<Anime[]>([])
  const [airing, setAiring] = useState<Anime[]>([])
  const [topStatus, setTopStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [airingStatus, setAiringStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [featuredIndex, setFeaturedIndex] = useState(0)
  useEffect(() => {
    getTopAnime(6).then((items) => { setTop(items); setTopStatus('success') }).catch(() => setTopStatus('error'))
    getAiringAnime(6).then((items) => { setAiring(items); setAiringStatus('success') }).catch(() => setAiringStatus('error'))
  }, [])
  useEffect(() => {
    if (top.length < 2) return
    const interval = window.setInterval(() => {
      setFeaturedIndex((index) => (index + 1) % top.length)
    }, 30_000)
    return () => window.clearInterval(interval)
  }, [top.length])
  const featured = top[featuredIndex % Math.max(top.length, 1)]
  return <section className="home-page">{topStatus === 'loading' ? <div className="home-hero hero-skeleton" /> : featured ? <div className="home-hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(9,9,13,.96) 0%, rgba(9,9,13,.68) 48%, rgba(9,9,13,.15)), url(${featured.imageUrl})` }}><div className="hero-copy"><p className="eyebrow">Featured discovery</p><h1>{featured.title}</h1><p>{featured.synopsis ?? 'A standout story waiting to be discovered.'}</p><div className="hero-actions"><Link className="primary-action" to={`/anime/${featured.id}`}>Explore title</Link><Link className="secondary-action" to="/anime">Browse anime</Link></div></div></div> : <div className="home-hero hero-unavailable"><div className="hero-copy"><p className="eyebrow">Welcome to SAIKO</p><h1>Discover something worth watching.</h1><p>Live recommendations are temporarily unavailable. Explore the catalog or search for a title.</p><div className="hero-actions"><Link className="primary-action" to="/anime">Browse anime</Link><Link className="secondary-action" to="/search">Search titles</Link></div></div></div>}<section className="home-section"><div className="section-heading"><div><p className="eyebrow">Popular right now</p><h2>Trending anime</h2></div><Link className="section-link" to="/anime">View all</Link></div>{topStatus === 'loading' ? <div className="anime-grid">{Array.from({ length: 6 }, (_, index) => <div className="anime-card skeleton" key={index} />)}</div> : top.length > 0 ? <div className="anime-grid">{top.map((item) => <Link className="anime-card" to={`/anime/${item.id}`} key={item.id}>{item.imageUrl && <img src={item.imageUrl} alt={`${item.title} cover`} loading="lazy" />}<div className="anime-card-body"><p className="anime-rank">#{item.id}</p><h3>{item.title}</h3><p className="anime-meta">{item.type ?? 'Anime'} {item.score ? `· ${item.score.toFixed(1)}` : ''}</p></div></Link>)}</div> : <div className="state-panel"><h2>Trending is temporarily unavailable.</h2><p>We will bring the latest titles back as soon as the catalog responds.</p></div>}</section><section className="home-section"><div className="section-heading"><div><p className="eyebrow">In season</p><h2>Currently airing</h2></div></div>{airingStatus === 'loading' ? <div className="airing-placeholder" /> : airing.length > 0 ? <div className="airing-rail">{airing.map((item) => <Link className="airing-item" to={`/anime/${item.id}`} key={item.id}><img src={item.imageUrl} alt={`${item.title} cover`} loading="lazy" /><span>{item.title}</span></Link>)}</div> : <div className="state-panel"><h2>Currently airing is temporarily unavailable.</h2><p>Check back soon for the latest seasonal lineup.</p></div>}</section></section>
}
