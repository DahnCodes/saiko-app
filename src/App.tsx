import { NavLink, Outlet } from 'react-router-dom'
import './App.css'
import OnboardingManager from './components/OnboardingManager.tsx'
import { useAuth } from './context/AuthContext.tsx'
import { FiHome, FiFileText, FiGrid, FiHeart, FiPlay } from 'react-icons/fi'
import { GiDna1 } from 'react-icons/gi'

const navigation = [
  { label: 'Home', to: '/' }, { label: 'Anime', to: '/anime' }, { label: 'News', to: '/news' },
  { label: 'Trailers', to: '/trailers' }, { label: 'Recommendations', to: '/recommendations' },
]
const mobileNavigation = [
  { label: 'Home', to: '/', icon: <FiHome /> },
  { label: 'News', to: '/news', icon: <FiFileText /> },
  { label: 'Explore', to: '/anime', icon: <FiGrid /> },
  { label: 'For You', to: '/recommendations', icon: <FiHeart /> },
  { label: 'DNA', to: '/anime-dna', icon: <GiDna1 /> },
]
function Avatar({ username, avatarUrl }: { username?: string; avatarUrl?: string | null }) { const initials = (username?.slice(0, 2) || 'S').toUpperCase(); return avatarUrl ? <img className="profile-avatar" src={avatarUrl} alt="" /> : <span className="profile-avatar profile-avatar-fallback" aria-hidden="true">{initials}</span> }
function AppShell() {
  const { isAuthenticated, profile } = useAuth()
  return <div className="app-shell"><OnboardingManager /><header className="site-header">
    <NavLink className="brand" to="/" aria-label="SAIKO home"><span className="brand-mark" aria-hidden="true">S</span><span>SAIKO</span></NavLink>
    <nav className="main-nav" aria-label="Main navigation">{navigation.map((item) => <NavLink key={item.to} to={item.to} end={item.to === '/'}>{item.label}</NavLink>)}</nav>
    <div className="header-actions"><NavLink className="icon-button" to="/search" aria-label="Search">⌕</NavLink><NavLink className="desktop-profile-link" to={isAuthenticated ? '/profile' : '/auth'} aria-label={isAuthenticated ? 'Open profile' : 'Sign in'}>{isAuthenticated ? <Avatar username={profile?.username} avatarUrl={profile?.avatarUrl} /> : 'Sign in'}</NavLink></div>
  </header><main className="page-content"><Outlet /></main><footer className="site-footer"><span>SAIKO</span><span>Your anime taste, decoded.</span></footer>
  <nav className="mobile-bottom-nav" aria-label="Mobile navigation">{mobileNavigation.map((item) => <NavLink key={item.to} to={item.to} end={item.to === '/'}><span className="mobile-nav-icon" aria-hidden="true">{item.icon}</span><span>{item.label}</span></NavLink>)}<NavLink to="/trailers"><span className="mobile-nav-icon" aria-hidden="true"><FiPlay /></span><span>Trailers</span></NavLink></nav>
  </div>
}
export default AppShell
