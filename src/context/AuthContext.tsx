/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { AuthState, OnboardingState } from '../types/auth.ts'
import { createProfile, getOnboardingSnapshot, requireSupabase } from '../services/authService.ts'

const noop = async () => {}
const initial: AuthState = { user: null, session: null, profile: null, favoriteCount: 0, loading: true, profileLoading: false, error: null, isAuthenticated: false, onboardingState: 'loading', refreshUserState: noop }
const AuthContext = createContext<AuthState>(initial)
function derive(session: Session | null, username: string | undefined, favorites: number): OnboardingState { if (!session) return 'signed_out'; if (!username?.trim()) return 'needs_username'; if (favorites !== 3) return 'needs_favorites'; return 'complete' }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(initial)
  const sessionRef = useRef<Session | null>(null)
  const requestRef = useRef(0)
  const synchronize = useCallback(async (session: Session | null) => {
    const request = ++requestRef.current
    sessionRef.current = session
    if (!session) { setState({ ...initial, loading: false, onboardingState: 'signed_out' }); return }
    setState((current) => ({ ...current, user: session.user, session, loading: false, profileLoading: true, isAuthenticated: true, error: null, onboardingState: 'loading' }))
    try {
      let snapshot = await getOnboardingSnapshot()
      // Email signups can return a user before a session exists. Once the address
      // is confirmed, the username stored in auth metadata completes the profile.
      const metadataUsername = typeof session.user.user_metadata?.username === 'string' ? session.user.user_metadata.username.trim().toLowerCase() : ''
      if (!snapshot.profile && /^[a-z0-9_]{3,24}$/.test(metadataUsername)) {
        try { await createProfile(session.user.id, metadataUsername); snapshot = await getOnboardingSnapshot() } catch (profileError) {
          const code = (profileError as { code?: string })?.code
          if (code !== '23505') throw profileError
          snapshot = await getOnboardingSnapshot()
        }
      }
      if (request !== requestRef.current) return
      // A provider email is not a SAIKO username. OAuth users remain in the
      // username step until a real profile username has been saved.
      const username = snapshot.profile?.username?.trim() ?? ''
      setState({ user: session.user, session, profile: snapshot.profile, favoriteCount: snapshot.favoriteCount, loading: false, profileLoading: false, error: null, isAuthenticated: true, onboardingState: derive(session, username, snapshot.favoriteCount), refreshUserState: noop })
    } catch (error) {
      if (request !== requestRef.current) return
      const message = error instanceof Error ? error.message : 'Could not load your SAIKO profile.'
      console.error(message)
      setState((current) => ({ ...current, profileLoading: false, error: message, onboardingState: 'loading' }))
    }
  }, [])
  const refreshUserState = useCallback(() => synchronize(sessionRef.current), [synchronize])
  useEffect(() => {
    const client = requireSupabase(); let mounted = true; let initialHandled = false
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      if (event === 'INITIAL_SESSION') initialHandled = true
      if (event === 'SIGNED_OUT') { void synchronize(null); return }
      if (['INITIAL_SESSION','SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED'].includes(event)) queueMicrotask(() => { if (mounted) void synchronize(session) })
    })
    client.auth.getSession().then(({ data: sessionData, error }) => {
      if (!mounted || initialHandled) return
      if (error) setState({ ...initial, loading: false, error: error.message, onboardingState: 'signed_out' })
      else void synchronize(sessionData.session)
    })
    return () => { mounted = false; requestRef.current += 1; data.subscription.unsubscribe() }
  }, [synchronize])
  return <AuthContext.Provider value={{ ...state, refreshUserState }}>{children}</AuthContext.Provider>
}
export const useAuth = () => useContext(AuthContext)
