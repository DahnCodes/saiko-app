import { supabase } from '../lib/supabase.ts'
import type { Profile } from '../types/auth.ts'
export function requireSupabase() { if (!supabase) throw new Error('Authentication is not configured'); return supabase }
export async function getOnboardingSnapshot(): Promise<{ profile: Profile | null; favoriteCount: number }> { const { data, error } = await requireSupabase().rpc('get_my_onboarding_state'); if (error) throw new Error(`Profile synchronization failed (${error.code}): ${error.message}`); const value = data as { profile?: { id: string; username: string; avatar_url: string | null; onboarding_completed: boolean } | null; favorite_count?: number } | null; const row = value?.profile; return { profile: row ? { id: row.id, username: row.username, avatarUrl: row.avatar_url, onboardingCompleted: row.onboarding_completed } : null, favoriteCount: Number(value?.favorite_count ?? 0) } }
export async function getProfile(userId: string): Promise<Profile | null> { const client = requireSupabase(); const { data, error } = await client.from('profiles').select('id,username,avatar_url,onboarding_completed').eq('id', userId).maybeSingle(); if (error) throw error; return data ? { id: data.id, username: data.username, avatarUrl: data.avatar_url, onboardingCompleted: data.onboarding_completed } : null }
export async function signUp(email: string, password: string, username: string) { const client = requireSupabase(); const normalizedEmail = email.trim().toLowerCase(); const normalizedUsername = username.trim().toLowerCase(); const { data, error } = await client.auth.signUp({ email: normalizedEmail, password, options: { data: { username: normalizedUsername } } }); if (error) throw error; if (data.user && data.session) await createProfile(data.user.id, normalizedUsername); return { ...data, confirmationRequired: Boolean(data.user && !data.session) } }
export async function signIn(email: string, password: string) { const { data, error } = await requireSupabase().auth.signInWithPassword({ email, password }); if (error) throw error; return data }
export async function signInWithGoogle() { const { error } = await requireSupabase().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } }); if (error) { if (error.code === 'validation_failed' || error.message.toLowerCase().includes('unsupported provider')) throw new Error('Google sign-in is not enabled yet. Enable Google under Supabase Auth > Providers, then try again.'); throw error } }
export async function createProfile(id: string, username: string) {
  const client = requireSupabase()
  const normalizedUsername = username.trim().toLowerCase()
  const existing = await getProfile(id)
  if (existing) {
    const currentUsername = existing.username?.trim() ?? ''
    const currentIsValid = /^[a-z0-9_]{3,24}$/i.test(currentUsername) && !currentUsername.includes('@')
    // Repair legacy OAuth profiles that were incorrectly populated with an
    // email/provider identity. Never overwrite a genuine SAIKO username.
    if (!currentIsValid) return updateProfile(id, { username: normalizedUsername })
    return existing
  }
  const { data, error } = await client.from('profiles').insert({ id, username: normalizedUsername }).select('id,username,avatar_url,onboarding_completed').single()
  if (!error && data) return { id: data.id, username: data.username, avatarUrl: data.avatar_url, onboardingCompleted: data.onboarding_completed } as Profile
  // Auth synchronization may create the row between the read and insert.
  // Resolve that race without retrying an insert or overwriting another user.
  if (error?.code === '23505') {
    const profile = await getProfile(id)
    if (profile) return profile
  }
  throw error ?? new Error('Could not create your profile.')
}
export async function updateProfile(id: string, values: Partial<{ username: string; onboarding_completed: boolean }>) { const { data, error } = await requireSupabase().from('profiles').update(values).eq('id', id).select('id,username,avatar_url,onboarding_completed').single(); if (error) throw error; return { id: data.id, username: data.username, avatarUrl: data.avatar_url, onboardingCompleted: data.onboarding_completed } as Profile }
