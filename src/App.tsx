import { NavLink, Outlet } from 'react-router-dom'
import './App.css'
import OnboardingManager from './components/OnboardingManager.tsx'
import { useAuth } from './context/AuthContext.tsx'

const navigation = [
  { label: 'Home', to: '/' }, { label: 'Anime', to: '/anime' }, { label: 'News', to: '/news' },
  { label: 'Trailers', to: '/trailers' }, { label: 'Recommendations', to: '/recommendations' },
]

function AppShell() {
  const { isAuthenticated, profile } = useAuth()
  return <div className="app-shell"><OnboardingManager /><header className="site-header">
    <NavLink className="brand" to="/" aria-label="SAIKO home"><span className="brand-mark" aria-hidden="true">S</span><span>SAIKO</span></NavLink>
    <nav className="main-nav" aria-label="Main navigation">{navigation.map((item) => <NavLink key={item.to} to={item.to} end={item.to === '/'}>{item.label}</NavLink>)}</nav>
    <div className="header-actions"><NavLink className="icon-button" to="/search" aria-label="Search">⌕</NavLink><NavLink className="profile-link" to="/profile">{isAuthenticated && profile?.username ? `@${profile.username}` : 'Sign in'}</NavLink></div>
  </header><main className="page-content"><Outlet /></main><footer className="site-footer"><span>SAIKO</span><span>Your anime taste, decoded.</span></footer></div>
}
export default AppShell
