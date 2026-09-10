import { createClient } from '@supabase/supabase-js'

// Vite replaces only public configuration in the browser build.
const env = import.meta.env
const serverEnv = typeof window === 'undefined' ? process.env : undefined
const supabaseUrl = env?.VITE_SUPABASE_URL || serverEnv?.SUPABASE_URL || serverEnv?.VITE_SUPABASE_URL
const supabaseKey = serverEnv?.SUPABASE_SERVICE_ROLE_KEY || env?.VITE_SUPABASE_ANON_KEY || serverEnv?.SUPABASE_ANON_KEY || serverEnv?.VITE_SUPABASE_ANON_KEY
export const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null
