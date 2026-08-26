import { StrictMode } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './index.css'
import AppShell from './App.tsx'
import PagePlaceholder from './pages/PagePlaceholder.tsx'
import AuthPage from './pages/AuthPage.tsx'
import ProfilePage from './pages/ProfilePage.tsx'
import AnimeDNAPage from './pages/AnimeDNAPage.tsx'
import PublicDNAPage from './pages/PublicDNAPage.tsx'
import { AuthProvider, useAuth } from './context/AuthContext.tsx'
/* eslint-disable react-refresh/only-export-components */
import AnimePage from './pages/AnimePage.tsx'
import AnimeDetailPage from './pages/AnimeDetailPage.tsx'
import SearchPage from './pages/SearchPage.tsx'
import HomePage from './pages/HomePage.tsx'
import NewsPage from './pages/NewsPage.tsx'
import NewsDetailPage from './pages/NewsDetailPage.tsx'
import TrailersPage from './pages/TrailersPage.tsx'
import RecommendationsPage from './pages/RecommendationsPage.tsx'

function Protected({ children }: { children: ReactNode }) { const { loading, profileLoading, isAuthenticated, onboardingState } = useAuth(); if (loading || profileLoading || onboardingState === 'loading') return <div className="state-panel">Loading your account...</div>; if (!isAuthenticated) return <Navigate to="/auth" replace />; if (onboardingState !== 'complete') return <Navigate to="/" replace />; return children }
function OnboardingRoute() { const { loading, profileLoading, isAuthenticated } = useAuth(); if (loading || profileLoading) return <div className="state-panel">Preparing your SAIKO setup...</div>; if (!isAuthenticated) return <Navigate to="/auth" replace />; return <Navigate to="/" replace /> }
createRoot(document.getElementById('root')!).render(<StrictMode><AuthProvider><BrowserRouter><Routes><Route element={<AppShell />}>
  <Route path="/" element={<HomePage />} />
  <Route path="/anime" element={<AnimePage />} />
  <Route path="/anime/:id" element={<AnimeDetailPage />} />
  <Route path="/news" element={<NewsPage />} />
  <Route path="/news/:id" element={<NewsDetailPage />} />
  <Route path="/trailers" element={<TrailersPage />} />
  <Route path="/recommendations" element={<Protected><RecommendationsPage /></Protected>} />
  <Route path="/auth" element={<AuthPage />} />
  <Route path="/onboarding" element={<OnboardingRoute />} />
  <Route path="/search" element={<SearchPage />} />
  <Route path="/profile" element={<ProfilePage />} />
  <Route path="/anime-dna" element={<Protected><AnimeDNAPage /></Protected>} />
  <Route path="/dna/:username" element={<PublicDNAPage />} />
  <Route path="*" element={<Navigate to="/" replace />} />
</Route></Routes></BrowserRouter></AuthProvider></StrictMode>)
