import { useAuth } from '../context/AuthContext.tsx'
import './recommendations.css'

export default function RecommendationsPage() {
  const { user, profile } = useAuth()

  if (!user || !profile) return <div className="state-panel">Loading account...</div>

  return (
    <section className="anime-page coming-soon-page">
      <div className="coming-soon-inner">
        <img src="/youngnaruto.jpg" alt="Coming soon" className="coming-soon-art" />

        <div className="coming-soon-copy">
          <p className="eyebrow">Personalized</p>
          <h1>Recommendations — Coming Soon</h1>
          <p className="lead">I'm still fleshing out the recommendation engine. Check back soon for thoughtful picks built just for you.</p>

          {/* <div className="coming-soon-footer">
            <img src="/youngnaruto.jpg" alt="Young Naruto" className="coming-soon-hero" />
            <div>
              <p className="muted">Preview image</p>
            </div>
          </div> */}
        </div>
      </div>
    </section>
  )
}
