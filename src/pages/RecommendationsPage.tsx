import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.tsx'
import { getPersonalizedRecommendations } from '../services/recommendationService.ts'
import type { PersonalizedRecommendation } from '../services/recommendationService.ts'

export default function RecommendationsPage() {
  const { user, profile } = useAuth()
  const [items, setItems] = useState<PersonalizedRecommendation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    if (!user) return
    getPersonalizedRecommendations(user.id, 48)
      .then((res) => mounted && setItems(res))
      .catch(() => mounted && setItems([]))
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }, [user])

  if (!user || !profile) return <div className="state-panel">Loading account...</div>
  if (loading) return <div className="state-panel">Finding your picks...</div>
  if (!items.length) return <div className="state-panel">We couldn't find recommendations yet. Try adding favorites in your profile.</div>

  return (
    <section className="anime-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Personalized</p>
          <h1>Recommendations for you</h1>
        </div>
        <p className="section-intro">Thoughtful picks based on your favorites.</p>
      </div>

      <div className="anime-grid">
        {items.map(({ anime, reason }) => (
          <Link className="anime-card" to={`/anime/${anime.id}`} key={anime.id}>
            {anime.imageUrl && <img src={anime.imageUrl} alt={`${anime.title} cover`} loading="lazy" />}
            <div className="anime-card-body">
              <h2>{anime.title}</h2>
              <p className="anime-meta">{anime.type ?? 'Anime'} {anime.score ? `· ${anime.score.toFixed(1)}` : ''}</p>
              <p className="anime-genres">{reason}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
