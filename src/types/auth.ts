import type { Session, User } from '@supabase/supabase-js'
export type Profile = { id: string; username: string; avatarUrl: string | null; onboardingCompleted: boolean }
export type OnboardingState = 'loading' | 'signed_out' | 'needs_username' | 'needs_favorites' | 'complete'
export type AuthState = { user: User | null; session: Session | null; profile: Profile | null; favoriteCount: number; loading: boolean; profileLoading: boolean; error: string | null; isAuthenticated: boolean; onboardingState: OnboardingState; refreshUserState: () => Promise<void> }
