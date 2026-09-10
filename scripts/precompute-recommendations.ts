#!/usr/bin/env ts-node
// Lightweight precompute script that uses SERVICE_ROLE credentials to precompute recommendations
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ts-node scripts/precompute-recommendations.ts

// Supply credentials through the process environment.
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment')
  process.exit(1)
}
const supabase = createClient(url, key)

async function main() {
  // collect candidate users to precompute for (users with favorites)
  const { data, error } = await supabase.from('user_favorite_anime').select('user_id')
  if (error) throw error
  const userIds = Array.from(new Set((data ?? []).map((r: { user_id: string }) => r.user_id))).slice(0, 1000)
  console.log(`Precomputing for ${userIds.length} users`)

  // dynamically import the recommendation engine after env is set so lib/supabase picks up env vars
  const engine = await import('../src/services/recommendations/recommendationEngine')

  for (const userId of userIds) {
    try {
      console.log('Computing for', userId)
      await engine.getPersonalizedHomeRecommendations(userId, { forceRefresh: true, limit: 5 })
      console.log('Done', userId)
    } catch (e) {
      console.warn('Failed for', userId, e)
    }
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
