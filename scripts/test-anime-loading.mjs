import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'

// Execute the actual TS modules with network/DB boundaries injected. No source copies.
function loadModule(entry, { fetch, db, env = {}, storage, publicRequest } = {}) {
  const cache = new Map()
  const logs = []
  const context = vm.createContext({
    Response, Request, Headers, URLSearchParams, AbortSignal, crypto, Error, DOMException, setTimeout, clearTimeout,
    fetch: fetch ?? (() => { throw new Error('Unexpected network request') }),
    Deno: { serve() {}, env: { get: key => env[key] } },
    localStorage: storage ?? { getItem: () => null, setItem() {} },
    __env: { VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_ANON_KEY: 'public-anon-key' },
    console: { log: (...args) => logs.push(args), error: (...args) => logs.push(args) },
  })
  function load(file) {
    file = path.resolve(file)
    if (cache.has(file)) return cache.get(file).exports
    const module = { exports: {} }
    cache.set(file, module)
    const source = fs.readFileSync(file, 'utf8').replaceAll('import.meta.env', 'globalThis.__env')
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText
    const require = specifier => {
      if (specifier.startsWith('https://esm.sh/')) return { createClient: () => db }
      if (specifier.includes('lib/supabase')) return { supabase: { auth: { getSession() { throw new Error('Auth must not be consulted') } } } }
      if (publicRequest && specifier.endsWith('publicAnimeRequest.ts')) return { publicAnimeRequest: publicRequest }
      return load(path.resolve(path.dirname(file), specifier))
    }
    vm.runInContext(`(function(require,module,exports){${code}\n})`, context, { filename: file })(require, module, module.exports)
    return module.exports
  }
  return { ...load(entry), logs }
}
const snapshot = loadModule('supabase/functions/_shared/starter-anime.ts').starterAnime
const config = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'secret-do-not-log', SUPABASE_ANON_KEY: 'anon' }
const post = (body = { query: 'Naruto' }) => new Request('https://example.test', { method: 'POST', body: JSON.stringify(body) })
function database({ rows = [], readError = null, cached = snapshot, writeError = null, crash = false } = {}) {
  return {
    rpc() { if (crash) throw new Error('secret-do-not-log'); return { abortSignal: async signal => { assert.ok(signal); return { data: rows, error: readError } } } },
    from() { return { upsert() { return { select() { return { abortSignal: async () => ({ data: cached, error: writeError }) } } } } } },
  }
}
function search(options = {}) { return loadModule('supabase/functions/search-anime/index.ts', { env: config, db: database(), ...options }) }
function starters(options = {}) { return loadModule('supabase/functions/get-starter-anime/index.ts', { env: config, ...options }) }
async function check(response, status) {
  assert.equal(response.status, status)
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*')
  return response.json()
}
const media = { id: 20, title: { english: 'Naruto' }, synonyms: [], genres: [] }
for (const item of snapshot) {
  test(`${item.title}: cached search and public starter response preserve UUID and image`, async () => {
    const result = await check(await search({ db: database({ rows: [item] }) }).handler(post({ query: item.title })), 200)
    assert.equal(result.results[0].id, item.id)
    assert.ok(result.results[0].cover_image.startsWith('https://'))
    const batch = await check(await starters({ fetch: async () => Response.json(snapshot) }).handler(post({})), 200)
    assert.equal(batch.results.find(a => a.anilist_id === item.anilist_id).id, item.id)
    assert.equal(batch.results.length, 6)
  })
}
test('all six load in one DB call without auth headers from caller or an upstream API', async () => {
  let calls = 0
  const { handler } = starters({ fetch: async (url, options) => {
    calls++; assert.ok(url.includes('/rest/v1/anime?')); assert.ok(options.signal)
    return Response.json(snapshot)
  } })
  const result = await check(await handler(post({})), 200)
  assert.equal(calls, 1); assert.equal(result.fallbackCount, 0); assert.equal(result.results.length, 6)
})
test('one missing starter preserves five successful records and fills the sixth', async () => {
  const rows = snapshot.slice(1).map(row => ({ ...row, description: 'live record' }))
  const result = await check(await starters({ fetch: async () => Response.json(rows) }).handler(post({})), 200)
  assert.equal(result.fallbackCount, 1)
  assert.equal(result.results.length, 6)
  assert.equal(result.results[1].description, 'live record')
})
for (const failure of ['timeout', 'http', 'malformed', 'configuration']) {
  test(`starter ${failure} uses all six fallbacks`, async () => {
    const { handler } = starters({ env: failure === 'configuration' ? {} : config, fetch: async () => {
      if (failure === 'timeout') throw new DOMException('timed out', 'TimeoutError')
      return failure === 'http' ? new Response('unavailable', { status: 503 }) : Response.json(null)
    } })
    const result = await check(await handler(post({})), 200)
    assert.equal(result.results.length, 6); assert.equal(result.fallbackCount, 6)
  })
}
for (const body of [null, [], {}, { query: '' }, { query: 42 }, { query: '   ' }, { query: 'Naruto', limit: -1 }, { query: 'Naruto', limit: '12' }]) {
  test(`invalid request ${JSON.stringify(body)} returns 400`, async () => { await check(await search().handler(post(body)), 400) })
}
test('malformed JSON returns 400', async () => { await check(await search().handler(new Request('https://example.test', { method: 'POST', body: '{' })), 400) })
test('OPTIONS and disallowed methods include CORS on both handlers', async () => {
  for (const { handler } of [search(), starters()]) {
    const response = await handler(new Request('https://example.test', { method: 'OPTIONS' }))
    assert.equal(response.status, 200); assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'POST, OPTIONS')
    await check(await handler(new Request('https://example.test')), 405)
  }
})
for (const status of [429, 403, 500, 503]) {
  test(`AniList HTTP ${status} becomes controlled 502`, async () => { await check(await search({ fetch: async () => new Response('upstream secret', { status }) }).handler(post()), 502) })
}
for (const payload of [null, {}, { errors: [{ message: 'provider error' }] }, { data: { Page: { media: {} } } }, { data: { Page: { media: [null] } } }]) {
  test(`invalid AniList payload ${JSON.stringify(payload)} returns 502`, async () => { await check(await search({ fetch: async () => Response.json(payload) }).handler(post()), 502) })
}
test('provider timeout becomes 504', async () => { await check(await search({ fetch: async () => { throw new DOMException('timeout', 'TimeoutError') } }).handler(post()), 504) })
test('empty provider results are a valid empty search', async () => {
  const result = await check(await search({ fetch: async () => Response.json({ data: { Page: { media: [] } } }) }).handler(post()), 200)
  assert.equal(result.results.length, 0)
})
test('provider success is cached and returned; cache write failure is explicit', async () => {
  const fetch = async () => Response.json({ data: { Page: { media: [media] } } })
  const result = await check(await search({ fetch }).handler(post()), 200)
  assert.equal(result.results.length, 6)
  await check(await search({ fetch, db: database({ writeError: { code: '42501' } }) }).handler(post()), 500)
})
test('DB crash and missing config are handled without secret leakage', async () => {
  const crashed = search({ db: database({ crash: true }) })
  const result = await check(await crashed.handler(post()), 500)
  assert.ok(result.requestId)
  assert.ok(!JSON.stringify(crashed.logs).includes('secret-do-not-log'))
  await check(await search({ env: {} }).handler(post()), 500)
})
test('DB read failure is logged and provider recovery works', async () => {
  const module = search({ db: database({ readError: { code: '42501' } }), fetch: async () => Response.json({ data: { Page: { media: [media] } } }) })
  await check(await module.handler(post()), 200)
  assert.ok(JSON.stringify(module.logs).includes('42501'))
})
test('frontend deduplicates concurrent loads, caches results and never consults auth', async () => {
  let calls = 0
  const module = loadModule('src/services/animeService.ts', { publicRequest: async name => { calls++; assert.equal(name, 'get-starter-anime'); return { results: snapshot, fallbackCount: 0 } } })
  const results = await Promise.all([module.getStarterAnime(), module.getStarterAnime(), module.getStarterAnimeResult()])
  assert.equal(calls, 1); assert.equal(results[0].length, 6); assert.equal(results[2].status, 'success')
  await module.getStarterAnime(); assert.equal(calls, 1)
})
test('frontend partial failure retains good rows; complete outage remains usable', async () => {
  const partial = loadModule('src/services/animeService.ts', { publicRequest: async () => ({ results: [snapshot[0], { broken: true }] }) })
  const result = await partial.getStarterAnimeResult()
  assert.equal(result.status, 'partial'); assert.equal(result.anime.length, 6)
  const offline = loadModule('src/services/animeService.ts', { publicRequest: async () => { throw new Error('503') }, storage: { getItem() { throw new Error('Storage blocked') } } })
  const fallback = await offline.getStarterAnimeResult()
  assert.equal(fallback.status, 'fallback'); assert.equal(fallback.anime.length, 6)
  for (const row of fallback.anime) assert.ok(row.id && row.title && row.imageUrl)
})
test('frontend persistent cache avoids network; stale data survives outage', async () => {
  for (const expires of [Date.now() + 60000, 1]) {
    const module = loadModule('src/services/animeService.ts', {
      storage: { getItem: () => JSON.stringify({ expires, rows: snapshot }), setItem() {} },
      publicRequest: async () => { assert.equal(expires, 1); throw new Error('offline') },
    })
    assert.equal((await module.getStarterAnime()).length, 6)
  }
})
test('public transport uses anon credentials and timeout, reports safe error body', async () => {
  const module = loadModule('src/services/publicAnimeRequest.ts', { fetch: async (_url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer public-anon-key'); assert.ok(options.signal)
    return Response.json({ code: 'BOOT_ERROR', message: 'Function failed to start', secret: 'secret-do-not-log' }, { status: 503 })
  } })
  await assert.rejects(module.publicAnimeRequest('search-anime', { query: 'Naruto' }), /HTTP 503.*Function failed to start/)
  assert.ok(JSON.stringify(module.logs).includes('BOOT_ERROR')); assert.ok(!JSON.stringify(module.logs).includes('secret-do-not-log'))
})

test('regression: search preserves the colon in the onboarding Demon Slayer title', async () => {
  const module = loadModule('src/services/animeService.ts', { publicRequest: async (name, body) => {
    assert.equal(name, 'search-anime')
    assert.equal(body.query, 'Demon Slayer: Kimetsu no Yaiba')
    return { results: [snapshot.find(row => row.anilist_id === 101922)] }
  } })
  const result = await module.searchAnime('  Demon Slayer: Kimetsu no Yaiba  ')
  assert.equal(result[0].anilistId, 101922)
})

test('missing images and malformed UUIDs use per-card fallback and report partial status', async () => {
  const rows = snapshot.map((row, index) => index === 0 ? { ...row, cover_image: null } : index === 1 ? { ...row, id: 'aaaaaaaa---------------------------' } : row)
  const module = loadModule('src/services/animeService.ts', { publicRequest: async () => ({ results: rows }) })
  const result = await module.getStarterAnimeResult()
  assert.equal(result.status, 'partial')
  assert.equal(result.anime[0].imageUrl, snapshot[0].cover_image)
  assert.equal(result.anime[1].id, snapshot[1].id)
})

test('deployed legacy clients: punctuation-stripped Demon Slayer query uses the cached canonical title', async () => {
  const row = snapshot.find(item => item.anilist_id === 101922)
  const db = {
    rpc(name, args) {
      assert.equal(name, 'search_anime_local')
      assert.equal(args.query_text, 'Demon Slayer: Kimetsu no Yaiba')
      return { abortSignal: async () => ({ data: [row], error: null }) }
    },
  }
  const result = await check(await search({ db }).handler(post({ query: 'Demon Slayer Kimetsu no Yaiba', limit: 12 })), 200)
  assert.equal(result.results[0].id, row.id)
})
