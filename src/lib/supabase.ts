import { createClient } from '@supabase/supabase-js'
const supabaseUrl = (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_SUPABASE_URL) || (globalThis as any).process?.env?.VITE_SUPABASE_URL || (globalThis as any).process?.env?.SUPABASE_URL
const supabaseAnonKey = (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_SUPABASE_ANON_KEY) || (globalThis as any).process?.env?.VITE_SUPABASE_ANON_KEY || (globalThis as any).process?.env?.SUPABASE_ANON_KEY || (globalThis as any).process?.env?.SUPABASE_SERVICE_ROLE_KEY
export const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null
