// Read-only verification after deploying both Edge Functions. Requires Node 24+.
// Optional SAIKO_TEST_USER_JWT enables a real signed-in request check.
import assert from 'node:assert/strict'
try { process.loadEnvFile('.env') } catch { /* CI can supply environment variables. */ }
const url = process.env.VITE_SUPABASE_URL
const anon = process.env.VITE_SUPABASE_ANON_KEY
assert.equal(url, 'https://ljkwhsnetasrcpsoqtab.supabase.co', 'Verify the intended production project')
assert.ok(anon, 'VITE_SUPABASE_ANON_KEY is required')
const titles = [
  ['Naruto', 20], ['One Piece', 21], ['Bleach', 269],
  ['Demon Slayer: Kimetsu no Yaiba', 101922], ['My Hero Academia', 21459], ['Attack on Titan', 16498],
]
async function invoke(name, body, token = anon) {
  const response = await fetch(`${url}/functions/v1/${name}`, {
    method: 'POST', headers: { apikey: anon, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(25000),
  })
  const payload = await response.json()
  return { status: response.status, payload }
}
for (const [title, anilistId] of titles) {
  const { status, payload } = await invoke('search-anime', { query: title, limit: 12 })
  assert.equal(status, 200, `${title}: expected HTTP 200, received ${status}`)
  const row = payload.results.find(row => row.anilist_id === anilistId)
  assert.ok(row?.id && row?.cover_image, `${title}: missing expected anime/image`)
  const image = await fetch(row.cover_image, { method: 'HEAD', signal: AbortSignal.timeout(15000) })
  assert.equal(image.status, 200, `${title}: image unavailable`)
  console.log(`${title}: search 200, correct anime, image 200`)
}
const legacy = await invoke('search-anime', { query: 'Demon Slayer Kimetsu no Yaiba', limit: 12 })
assert.equal(legacy.status, 200, 'The original production request must no longer return 503')
assert.ok(legacy.payload.results.some(row => row.anilist_id === 101922))
console.log('Original punctuation-stripped Demon Slayer request: 200, correct anime')
for (const [caller, headers] of [['no credentials', {}], ['invalid user session', { Authorization: 'Bearer intentionally-invalid-session' }]]) {
  const response = await fetch(`${url}/functions/v1/get-starter-anime`, {
    method: 'POST', headers, body: '{}', signal: AbortSignal.timeout(15000),
  })
  const payload = await response.json()
  assert.equal(response.status, 200, `Public starter data (${caller}) must not depend on authentication`)
  assert.equal(payload.results.length, 6)
  console.log(`Public starter endpoint (${caller}): 200, six records`)
}
for (const [caller, token] of [['signed out', anon], ...(process.env.SAIKO_TEST_USER_JWT ? [['signed in', process.env.SAIKO_TEST_USER_JWT]] : [])]) {
  const { status, payload } = await invoke('get-starter-anime', {}, token)
  assert.equal(status, 200, `Starter endpoint (${caller}) must be deployed and return 200`)
  assert.equal(payload.results.length, 6)
  for (const [, id] of titles) assert.ok(payload.results.some(row => row.anilist_id === id && row.id && row.cover_image))
  console.log(`All six (${caller}): 200, fallbackCount=${payload.fallbackCount}`)
}
assert.equal((await invoke('search-anime', { query: '' })).status, 400)
for (const name of ['search-anime', 'get-starter-anime']) {
  const response = await fetch(`${url}/functions/v1/${name}`, { method: 'OPTIONS', signal: AbortSignal.timeout(10000) })
  assert.ok(response.ok)
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*')
  assert.ok(response.headers.get('Access-Control-Allow-Methods')?.includes('POST'))
}
if (!process.env.SAIKO_TEST_USER_JWT) console.log('Real signed-in session check: NOT RUN (SAIKO_TEST_USER_JWT not supplied)')
