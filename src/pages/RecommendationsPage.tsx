import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.tsx'
import {
  getV35Recommendations,
  groupByCategory,
  CATEGORY_LABELS,
  type ScoredRecommendation,
  type RecommendationCategory,
} from '../services/recommendations/v35/engine.ts'
import { V35_TRAIT_BY_ID } from '../services/recommendations/v35/vocabulary.ts'
import './recommendations.css'

// ============ V35 RECOMMENDATION CARD ============

function V35RecommendationCard({ rec }: { rec: ScoredRecommendation }) {
  const label = CATEGORY_LABELS[rec.category]
  const anime = rec.anime
  const traitLabels = rec.matchedTraits
    .map(t => V35_TRAIT_BY_ID.get(t)?.label)
    .filter(Boolean) as string[]

  return (
    <Link className="anime-card" to={`/anime/${anime.id}`}>
      {anime.imageUrl && (
        <img
          src={anime.imageUrl}
          alt={`${anime.title} cover`}
          loading="lazy"
        />
      )}
      <div className="anime-card-body">
        <p className="anime-category-label">{label}</p>
        <h2>{anime.title}</h2>
        <p className="anime-meta">
          {anime.year ? `${anime.year}` : ''}
          {anime.score ? ` · ★ ${anime.score.toFixed(1)}` : ''}
          {anime.genres && anime.genres.length > 0 ? ` · ${anime.genres.slice(0, 2).join(', ')}` : ''}
        </p>
        <p className="anime-match-badge">
          {rec.finalScore.toFixed(0)}% match
        </p>
        <p className="anime-reason">{rec.reason}</p>
        {traitLabels.length > 0 && (
          <div className="anime-trait-tags">
            {traitLabels.slice(0, 3).map(t => (
              <span key={t} className="trait-tag">{t}</span>
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}

// ============ V35 SECTION ============

function V35Section({ recommendations }: { recommendations: ScoredRecommendation[] }) {
  const groups = groupByCategory(recommendations)
  const categoryOrder: RecommendationCategory[] = [
    'perfect_match',
    'hidden_gem',
    'fresh_pick',
    'unexpected_match',
    'genre_expansion',
    'romance_pick',
  ]

  const nonEmpty = categoryOrder.filter(cat => groups[cat].length > 0)

  return (
    <div className="v35-recommendations">
      {nonEmpty.map(cat => (
        <section key={cat} className={`v35-category v35-category-${cat}`}>
          <div className="v35-category-header">
            <h2>{CATEGORY_LABELS[cat]}</h2>
            <span className="v35-category-count">{groups[cat].length} picks</span>
          </div>
          <div className="anime-grid">
            {groups[cat].slice(0, 4).map(rec => (
              <V35RecommendationCard key={rec.anime.id} rec={rec} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

// ============ MAIN PAGE ============

export default function RecommendationsPage() {
  const { user, profile } = useAuth()
  const [recommendations, setRecommendations] = useState<ScoredRecommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user || !profile) return

    let cancelled = false
    const load = async () => {
      if (cancelled) return
      setLoading(true)
      setError('')
      try {
        const recs = await getV35Recommendations(user.id)
        if (!cancelled) setRecommendations(recs)
      } catch (err) {
        console.error('[RecommendationsPage] Failed to load recommendations', err)
        if (!cancelled) setError('Could not load recommendations. Please try again.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [user, profile])

  if (!user || !profile) {
    return <div className="state-panel">Loading account...</div>
  }

  if (!profile.onboardingCompleted) {
    return (
      <div className="state-panel">
        <p className="eyebrow">Personalize SAIKO</p>
        <h2>Complete your profile first</h2>
        <p>Pick your Core 3 anime to unlock personalized recommendations.</p>
        <Link to="/onboarding" className="primary-action">Get Started</Link>
      </div>
    )
  }

  return (
    <section className="anime-page recommendations-page">
      <div className="recommendations-header">
        <p className="eyebrow">Saiko thinks you'll love this</p>
        <h1>Your Recommendations</h1>
        <p className="lead">
          Anime selected based on your core anime DNA.
        </p>
      </div>

      {loading && (
        <div className="recommendations-loading">
          <div className="anime-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div className="skeleton-card" key={i} />
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="state-panel">
          <p className="auth-error" role="alert">{error}</p>
        </div>
      )}

      {!loading && !error && recommendations.length > 0 && (
        <V35Section recommendations={recommendations} />
      )}

      {!loading && !error && recommendations.length === 0 && (
        <div className="state-panel">
          <p className="eyebrow">No recommendations yet</p>
          <h2>Not enough data</h2>
          <p>
            The recommendation engine needs anime released from 2023 onward in the database.
            Check back later as more anime are added.
          </p>
        </div>
      )}
    </section>
  )
}
