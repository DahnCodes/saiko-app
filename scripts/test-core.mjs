import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadModule } from './test-module-loader.mjs'

test('production V35 scoring suite', () => {
  const suite = loadModule('src/services/recommendations/v35/test.ts', { globals: { console } })
  suite.runScoringTests()
})

function fakeDb(resolve) {
  return { from(table) {
    const calls = []
    const query = new Proxy({}, { get(_, method) {
      if (method === 'then') return (ok, fail) => Promise.resolve(resolve(table, calls)).then(ok, fail)
      return (...args) => { calls.push([method, ...args]); return query }
    } })
    return query
  } }
}
const dbMock = db => ({ '../lib/supabase.ts': { supabase: db }, '../../../lib/supabase': { supabase: db }, '../../lib/supabase': { supabase: db } })

for (const name of ['ingest-news', 'sync-anime', 'sync-trailers']) {
  test(`${name}: denies absent, public and user credentials before network or writes`, async () => {
    let handler
    loadModule(`supabase/functions/${name}/index.ts`, {
      globals: { Deno: { serve(fn) { handler = fn }, env: { get: key => key === 'SUPABASE_SERVICE_ROLE_KEY' ? 'admin-test-key' : undefined } } },
    })
    for (const token of ['', 'anon-test-key', 'user-test-jwt']) {
      const response = await handler(new Request('https://example.test', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }))
      assert.equal(response.status, 401)
      assert.equal((await response.json()).error, 'Unauthorized')
    }
  })
}
test('admin authorization accepts only configured server key and fails closed without config', () => {
  for (const env of [{}, { SUPABASE_SERVICE_ROLE_KEY: 'admin' }]) {
    const { authorizeAdmin } = loadModule('supabase/functions/_shared/admin.ts', { env })
    const result = authorizeAdmin(new Request('https://example.test', { headers: { Authorization: 'Bearer admin' } }))
    assert.equal(result?.status ?? 200, env.SUPABASE_SERVICE_ROLE_KEY ? 200 : 500)
  }
})

test('trait cache joins anime UUIDs through AniList IDs, including batch and memory reads', async () => {
  const profile = [{ trait: 'courage', strength: 0.8, source: 'genre' }]
  let reads = 0
  const db = fakeDb((table, calls) => {
    reads++
    if (table === 'anime') return { data: calls.some(c => c[0] === 'in') ? [{ id: 'anime-uuid', anilist_id: 20 }] : { anilist_id: 20 }, error: null }
    assert.ok(calls.some(c => ['eq', 'in'].includes(c[0]) && c[1] === 'anilist_id'))
    return { data: calls.some(c => c[0] === 'in') ? [{ anilist_id: 20, trait_profiles: profile }] : { trait_profiles: profile }, error: null }
  })
  for (const batch of [false, true]) {
    const cache = loadModule('src/services/recommendations/traits/traitCache.ts', { mocks: dbMock(db) })
    const result = batch ? (await cache.getCachedTraitProfiles(['anime-uuid'])).get('anime-uuid') : await cache.getCachedTraitProfile('anime-uuid')
    assert.deepEqual(result, profile)
    const before = reads
    assert.deepEqual(await cache.getCachedTraitProfile('anime-uuid'), profile)
    assert.equal(reads, before)
  }
})
test('browser trait extraction never writes to shared metadata', async () => {
  const cache = loadModule('src/services/recommendations/traits/traitCache.ts', { globals: { window: {} }, mocks: dbMock({ from() { throw new Error('Unexpected write') } }) })
  await cache.cacheTraitProfiles([{ anilistId: 20, malId: null, traitProfile: [] }])
})

test('signup requiring confirmation normalizes identity and avoids unauthorized profile writes', async () => {
  const db = { auth: { signUp: async args => {
    assert.equal(args.email, 'user@example.test')
    assert.equal(args.options.data.username, 'anime_fan')
    return { data: { user: { id: 'user' }, session: null }, error: null }
  } }, from() { throw new Error('Profile write before confirmation') } }
  const auth = loadModule('src/services/authService.ts', { mocks: dbMock(db) })
  assert.equal((await auth.signUp(' User@Example.test ', 'test-password', ' Anime_Fan ')).confirmationRequired, true)
})
test('profile creation preserves an existing valid username', async () => {
  const db = fakeDb((_, calls) => {
    assert.ok(!calls.some(c => ['insert', 'update'].includes(c[0])))
    return { data: { id: 'user', username: 'existing_user', onboarding_completed: true }, error: null }
  })
  const auth = loadModule('src/services/authService.ts', { mocks: dbMock(db) })
  assert.equal((await auth.createProfile('user', 'replacement')).username, 'existing_user')
})
test('profile creation repairs a legacy email username', async () => {
  const db = fakeDb((_, calls) => {
    const update = calls.find(c => c[0] === 'update')
    if (update) assert.equal(update[1].username, 'anime_fan')
    return { data: { id: 'user', username: update ? 'anime_fan' : 'user@example.test' }, error: null }
  })
  const auth = loadModule('src/services/authService.ts', { mocks: dbMock(db) })
  assert.equal((await auth.createProfile('user', ' Anime_Fan ')).username, 'anime_fan')
})
test('news and trailer services handle empty, missing and database failure responses', async () => {
  let response = { data: [], error: null }
  const db = fakeDb(() => response)
  const news = loadModule('src/services/newsService.ts', { mocks: dbMock(db) })
  const trailers = loadModule('src/services/trailerService.ts', { mocks: dbMock(db) })
  assert.equal((await news.getLatestNews()).length, 0)
  assert.equal((await trailers.getTrailers()).length, 0)
  response = { data: null, error: null }
  await assert.rejects(news.getNewsById('missing'), /not found/)
  response = { data: null, error: new Error('Database unavailable') }
  await assert.rejects(news.getLatestNews(), /Database unavailable/)
  await assert.rejects(trailers.getTrailers(), /Database unavailable/)
})
test('AniList handles blocked storage and rejects malformed provider payloads', async () => {
  const service = loadModule('src/services/aniListService.ts', {
    fetch: async () => Response.json({ data: { Page: { media: {} } } }),
    storage: { getItem() { throw new Error('blocked') } },
    globals: { setTimeout: fn => { fn(); return 0 } },
  })
  await assert.rejects(service.findCandidates({ Courage: 90 }), /invalid media data/)
})

function recommendationModule({ cached = null, favoriteError = null } = {}) {
  let reads = 0
  let pauses = 0
  let writes = 0
  const db = fakeDb((table, calls) => {
    if (table === 'user_recommendations') {
      if (calls.some(c => c[0] === 'upsert')) { writes++; return { error: null } }
      reads++; return { data: cached, error: null }
    }
    if (table === 'user_favorite_anime') return { data: [], error: favoriteError }
    return { data: [], error: null }
  })
  const module = loadModule('src/services/recommendations/recommendationEngine.ts', {
    mocks: { ...dbMock(db), '../dnaService': { getAnimeDNA: async () => ({ traits: [] }) }, '../animeService': { getStarterAnime: async () => [], mapAnime: row => row }, '../../services/aniListService': { findCandidates: async () => [] } },
    globals: { window: {}, setTimeout(fn) { pauses++; fn(); return 0 } },
  })
  return { ...module, counts: () => ({ reads, pauses, writes }) }
}
test('recommendation cache misses compute immediately and deduplicate concurrent work', async () => {
  const engine = recommendationModule()
  await Promise.all([engine.getPersonalizedHomeRecommendations('u'), engine.getPersonalizedHomeRecommendations('u')])
  assert.deepEqual(engine.counts(), { reads: 1, pauses: 0, writes: 1 })
})
test('recommendation refresh bypasses cache and cached results respect requested limits', async () => {
  const engine = recommendationModule({ cached: { fingerprint: '[]', updated_at: new Date().toISOString(), recommendations: [1, 2, 3, 4, 5] } })
  assert.equal((await engine.getPersonalizedHomeRecommendations('u', { limit: 2 })).length, 2)
  assert.equal(engine.counts().writes, 0)
  assert.equal((await engine.regeneratePersonalizedHomeRecommendations('u')).length, 0)
  assert.equal(engine.counts().writes, 1)
})
test('recommendation cache with too few results recomputes; favorite failures are propagated', async () => {
  const engine = recommendationModule({ cached: { fingerprint: '[]', updated_at: new Date().toISOString(), recommendations: [1] } })
  await engine.getPersonalizedHomeRecommendations('u', { limit: 5 })
  assert.equal(engine.counts().writes, 1)
  const failed = recommendationModule({ favoriteError: new Error('Favorites unavailable') })
  await assert.rejects(failed.getPersonalizedHomeRecommendations('u'), /Favorites unavailable/)
  await assert.rejects(failed.getPersonalizedHomeRecommendations('u'), /Favorites unavailable/)
  assert.equal(failed.counts().reads, 2, 'Rejected in-flight work must be cleared')
})

test('browser Supabase client ignores server credentials even if process is polyfilled', () => {
  let key
  loadModule('src/lib/supabase.ts', { globals: { window: {}, process: { env: { SUPABASE_SERVICE_ROLE_KEY: 'server-test-key' } } }, mocks: { '@supabase/supabase-js': { createClient(_url, value) { key = value; return {} } } } })
  assert.equal(key, 'public-anon-key')
})
test('server precompute uses server credentials ahead of public config', () => {
  let key
  loadModule('src/lib/supabase.ts', { globals: { process: { env: { SUPABASE_SERVICE_ROLE_KEY: 'server-test-key' } } }, mocks: { '@supabase/supabase-js': { createClient(_url, value) { key = value; return {} } } } })
  assert.equal(key, 'server-test-key')
})
test('browser Redis helpers return safely without accessing server dependencies', async () => {
  const locks = loadModule('src/lib/redisLock.ts', { globals: { window: {} } })
  assert.equal(await locks.acquireLock('test'), null)
  assert.equal(await locks.releaseLock('test', 'token'), false)
  assert.equal(await locks.isLocked('test'), false)
})
