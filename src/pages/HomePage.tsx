import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getTopAnime } from '../services/animeService.ts'
import { getPersonalizedHomeRecommendations, regeneratePersonalizedHomeRecommendations, CACHE_TTL_SECONDS } from '../services/recommendations/recommendationEngine'
import type { AnimeRecommendation } from '../services/recommendations/recommendationTypes'
import { useAuth } from '../context/AuthContext.tsx'
import type { Anime } from '../types/anime.ts'
import '../anime.css'
import '../home.css'
import '../home-overrides.css'

export default function HomePage() {
  const { user } = useAuth()
  const [top, setTop] = useState<Anime[]>([])
  const [topStatus, setTopStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [featuredIndex, setFeaturedIndex] = useState(0)

  // personalized recommendations
  const [saikoRecs, setSaikoRecs] = useState<AnimeRecommendation[]>([])
  const [saikoStatus, setSaikoStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  const loadSaikoRecs = useCallback(async () => {
    if (!user) return
    setSaikoStatus('loading')
    try {
      const results = await getPersonalizedHomeRecommendations(user.id, { limit: 5 })
      setSaikoRecs(results)
      setSaikoStatus('success')
    } catch (e) {
      setSaikoStatus('error')
    }
  }, [user])

  // Periodically refresh recommendations in background to match TTL
  useEffect(() => {
    if (!user) return
    const interval = window.setInterval(() => {
      void (async () => {
        try {
          const results = await regeneratePersonalizedHomeRecommendations(user.id, { limit: 5 })
          setSaikoRecs(results)
          setSaikoStatus('success')
        } catch {
          // keep previous state on failure
        }
      })()
    }, CACHE_TTL_SECONDS * 1000)
    return () => window.clearInterval(interval)
  }, [user])

  useEffect(() => {
    getTopAnime(6).then((items) => { setTop(items); setTopStatus('success') }).catch(() => setTopStatus('error'))
  }, [])

  useEffect(() => {
    if (top.length < 2) return
    const interval = window.setInterval(() => setFeaturedIndex((i) => (i + 1) % top.length), 30_000)
    return () => window.clearInterval(interval)
  }, [top.length])

  useEffect(() => { void loadSaikoRecs() }, [loadSaikoRecs])

  const featured = top[featuredIndex % Math.max(top.length, 1)]

  return (
    <section className="home-page">
      {topStatus === 'loading' ? (
        <div className="home-hero hero-skeleton" />
      ) : featured ? (
        <div className="home-hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(9,9,13,.96) 0%, rgba(9,9,13,.68) 48%, rgba(9,9,13,.15)), url(${featured.imageUrl})` }}>
          <div className="hero-copy">
            <p className="eyebrow">Featured discovery</p>
            <h1>{featured.title}</h1>
            <p>{featured.synopsis ?? 'A standout story waiting to be discovered.'}</p>
            <div className="hero-actions">
              <Link className="primary-action" to={`/anime/${featured.id}`}>Explore title</Link>
              <Link className="secondary-action" to="/anime">Browse anime</Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="home-hero hero-unavailable">
          <div className="hero-copy">
            <p className="eyebrow">Welcome to SAIKO</p>
            <h1>Discover something worth watching.</h1>
            <p>Live recommendations are temporarily unavailable. Explore the catalog or search for a title.</p>
            <div className="hero-actions">
              <Link className="primary-action" to="/anime">Browse anime</Link>
              <Link className="secondary-action" to="/search">Search titles</Link>
            </div>
          </div>
        </div>
      )}

      {/* Personalized recommendations section */}
      {/* <section className="home-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">SAIKO THINKS YOU'LL LOVE THIS</p>
            <h2>Hand-picked discoveries</h2>
          </div>
          {user ? <Link className="section-link" to="/recommendations">View all</Link> : <Link className="section-link" to="/onboarding">Create your Anime DNA</Link>}
        </div>

        {user ? (
          saikoStatus === 'loading' ? (
            <div className="anime-grid">
                  {Array.from({ length: 5 }).map((_, i) => <div className="anime-card skeleton" key={i} />)}
            </div>
          ) : saikoStatus === 'error' ? (
            <div className="state-panel">
              <h2>SAIKO couldn't find your next obsession right now.</h2>
              <p>Try again or come back later.</p>
              <div style={{ marginTop: 12 }}><button className="primary-action" onClick={() => void loadSaikoRecs()}>Retry</button></div>
            </div>
            ) : saikoRecs.length === 0 ? (
            <div className="state-panel"><h2>SAIKO is still searching for your next hidden gem.</h2><p>Try adding favorites to your profile to improve results.</p></div>
          ) : (
            <div className="anime-grid">
              {saikoRecs.map((rec) => (
                <Link className="anime-card" to={`/anime/${rec.anime.id}`} key={rec.anime.id}>
                  {rec.anime.imageUrl && <img src={rec.anime.imageUrl} alt={`${rec.anime.title} cover`} loading="lazy" />}
                  <div className="anime-card-body">
                    <h3>{rec.anime.title}</h3>
                    <p className="anime-meta">{rec.anime.type ?? 'Anime'} · {rec.anime.score ? rec.anime.score.toFixed(1) : '—'}</p>
                    <p className="anime-genres">{rec.reason}</p>
                    <p className="anime-meta">{rec.matchPercent}% DNA MATCH</p>
                  </div>
                </Link>
              ))}
            </div>
          )
        ) : (
          <div className="state-panel">
            <h2>Create your Anime DNA to unlock recommendations built around your taste.</h2>
            <div style={{ marginTop: 12 }}><Link className="primary-action" to="/onboarding">Create Anime DNA</Link></div>
          </div>
        )}
      </section> */}

      {/* Trending section (existing) */}
      <section className="home-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Popular right now</p>
            <h2>Trending anime</h2>
          </div>
          <Link className="section-link" to="/anime">View all</Link>
        </div>

        {topStatus === 'loading' ? (
          <div className="anime-grid">{Array.from({ length: 6 }, (_, index) => <div className="anime-card skeleton" key={index} />)}</div>
        ) : top.length > 0 ? (
          <div className="anime-grid">{top.map((item) => (
            <Link className="anime-card" to={`/anime/${item.id}`} key={item.id}>
              {item.imageUrl && <img src={item.imageUrl} alt={`${item.title} cover`} loading="lazy" />}
              <div className="anime-card-body">
                <p className="anime-rank">#{item.id}</p>
                <h3>{item.title}</h3>
                <p className="anime-meta">{item.type ?? 'Anime'} {item.score ? `· ${item.score.toFixed(1)}` : ''}</p>
              </div>
            </Link>
          ))}</div>
        ) : (
          <div className="state-panel"><h2>Trending is temporarily unavailable.</h2><p>We will bring this back shortly.</p></div>
        )}
      </section>
    </section>
  )
}
