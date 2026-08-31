import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.tsx'
import { getTraitBasedRecommendations, debugTraitRecommendations } from '../services/recommendations/engine/getTraitBasedRecommendations.ts'
import type { TraitRecommendation } from '../services/recommendations/engine/getTraitBasedRecommendations.ts'
import './recommendations.css'

type DebugInfo = {
  userId: string;
  coreAnime: Array<{
    id: string;
    title: string;
    genres: string[];
    synopsis?: string;
    traitProfile: Array<{ trait: string; strength: number; evidence?: string }>;
  }>;
  userProfile: {
    coreCount: number;
    uniqueTraitCount: number;
    topTraits: Array<{ traitId: string; label: string; weight: number; occurrences: number }>;
  };
};

function RecommendationCard({ rec }: { rec: TraitRecommendation }) {
  return (
    <Link className="anime-card" to={`/anime/${rec.anime.id}`}>
      {rec.anime.imageUrl && (
        <img
          src={rec.anime.imageUrl}
          alt={`${rec.anime.title} cover`}
          loading="lazy"
        />
      )}
      <div className="anime-card-body">
        <h2>{rec.anime.title}</h2>
        <p className="anime-meta">
          {rec.anime.type ?? 'Anime'}
          {rec.anime.year ? ` · ${rec.anime.year}` : ''}
          {rec.anime.score ? ` · ★ ${rec.anime.score.toFixed(1)}` : ''}
        </p>
        <p className="anime-match-badge">
          {rec.matchPercent}% match
        </p>
        <p className="anime-reason">{rec.shortReason}</p>
        {rec.topMatchingTraits.length > 0 && (
          <div className="anime-trait-tags">
            {rec.topMatchingTraits.slice(0, 4).map((t) => (
              <span key={t.trait} className="trait-tag">{t.label}</span>
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}

function TraitProfileCard({ label, weight }: { label: string; weight: number }) {
  const pct = Math.round(weight * 100)
  return (
    <div className="trait-profile-entry">
      <span className="trait-profile-name">{label}</span>
      <div className="trait-bar-wrap">
        <div className="trait-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="trait-profile-pct">{pct}%</span>
    </div>
  )
}

export default function RecommendationsPage() {
  const { user, profile } = useAuth()
  const [recommendations, setRecommendations] = useState<TraitRecommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null)

  useEffect(() => {
    if (!user || !profile) return

    let cancelled = false
    const load = async () => {
      if (cancelled) return
      setLoading(true)
      setError('')
      try {
        const recs = await getTraitBasedRecommendations(user.id, { limit: 18 })
        if (!cancelled) setRecommendations(recs)
      } catch (err) {
        if (!cancelled) {
          console.error('[RecommendationsPage] Failed to load recommendations', err)
          setError('Could not load recommendations. Please try again.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }

      if (!cancelled) {
        try {
          const info = await debugTraitRecommendations(user.id)
          if (!cancelled) setDebugInfo(info as DebugInfo)
        } catch {}
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
          Anime selected based on your core anime DNA — traits you love, matched with what you have not yet seen.
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

      {!loading && !error && recommendations.length === 0 && debugInfo && (
        <div className="empty-debug">
          <div className="state-panel">
            <p className="eyebrow">Trait profile</p>
            <h2>Your Anime DNA</h2>
            <p className="lead">Core anime loaded: {debugInfo.coreAnime.length} / 3</p>
          </div>

          {debugInfo.coreAnime.length > 0 && (
            <div className="core-anime-debug">
              <h3>Your Core Anime</h3>
              {debugInfo.coreAnime.map((a) => (
                <div key={a.id} className="core-anime-item">
                  <strong>{a.title}</strong>
                  <p className="anime-meta">Genres: {(a.genres ?? []).join(', ')}</p>
                  <p className="trait-count">{a.traitProfile?.length ?? 0} traits extracted</p>
                  <div className="trait-tags">
                    {(a.traitProfile ?? []).slice(0, 8).map((t) => (
                      <span key={t.trait} className="trait-tag">{t.trait}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {debugInfo.userProfile && (
            <div className="user-profile-debug">
              <h3>Your Trait Profile ({debugInfo.userProfile.uniqueTraitCount} unique traits)</h3>
              <div className="trait-profile-grid">
                {debugInfo.userProfile.topTraits.map((t) => (
                  <TraitProfileCard
                    key={t.traitId}
                    label={t.label}
                    weight={t.weight}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && recommendations.length > 0 && (
        <div className="anime-grid">
          {recommendations.map((rec) => (
            <RecommendationCard key={rec.anime.id} rec={rec} />
          ))}
        </div>
      )}
    </section>
  )
}
