// Read-only deployed checks. Uses only the public Supabase key; prints no credentials or records.
import assert from 'node:assert/strict'
try { process.loadEnvFile('.env') } catch { /* CI environment */ }
const base = process.env.VITE_SUPABASE_URL
const anon = process.env.VITE_SUPABASE_ANON_KEY
assert.ok(base && anon, 'Public Supabase configuration is required')
let failures = 0
async function check(name, path, options, validate) {
  try {
    const response = await fetch(base + path, { headers: { apikey: anon, Authorization: `Bearer ${anon}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20000), ...options })
    await validate(response)
    console.log(`PASS ${name}`)
  } catch (error) { failures++; console.log(`FAIL ${name}: ${error.message}`) }
}
for (const table of ['anime', 'news', 'trailers']) await check(`public ${table} read`, `/rest/v1/${table}?select=id&limit=1`, {}, async r => {
  assert.equal(r.status, 200); assert.ok(Array.isArray(await r.json()))
})
for (const table of ['profiles', 'user_favorite_anime', 'user_recommendations']) await check(`anonymous ${table} isolation`, `/rest/v1/${table}?select=*&limit=1`, {}, async r => {
  if ([401,403].includes(r.status)) return
  assert.equal(r.status, 200); assert.deepEqual(await r.json(), [])
})
await check('public starter endpoint returns six anime', '/functions/v1/get-starter-anime', { method: 'POST', body: '{}' }, async r => {
  assert.equal(r.status, 200); const data = await r.json(); assert.equal(data.results.length, 6)
})
for (const [name, id] of [['Demon Slayer: Kimetsu no Yaiba',101922],['My Hero Academia',21459],['Attack on Titan',16498]]) {
  // Search the local DB via read-only RPC, without invoking provider cache writes.
  await check(`${name} local search`, '/rest/v1/rpc/search_anime_local', { method: 'POST', body: JSON.stringify({ query_text: name, result_limit: 12 }) }, async r => {
    assert.equal(r.status,200); assert.ok((await r.json()).some(row=>row.anilist_id===id))
  })
}
await check('anonymous onboarding RPC denied', '/rest/v1/rpc/get_my_onboarding_state', { method: 'POST', body: '{}' }, async r => assert.ok([401,403].includes(r.status)))
process.exitCode = failures ? 1 : 0
