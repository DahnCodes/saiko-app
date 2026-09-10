// Run against pnpm dev. Install Playwright separately or set PLAYWRIGHT_MODULE.
import assert from 'node:assert/strict'
import { loadModule } from './test-module-loader.mjs'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const rows = loadModule('supabase/functions/_shared/starter-anime.ts').starterAnime
try { process.loadEnvFile('.env') } catch { /* CI may supply config. */ }
const projectRef = new URL(process.env.VITE_SUPABASE_URL).hostname.split('.')[0]
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173'
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', headless: true, args: ['--no-sandbox'] })
let checks = 0
async function check(name, fn) { await fn(); checks++; console.log(`PASS ${name}`) }
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    let profile = null
    let favorites = []
    let publicDNA = null
    const user = { id: '11111111-1111-4111-8111-111111111111', email: 'test@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() }
    const crashes = []
    page.on('pageerror', e => crashes.push(e.message))
    await page.route('**/*', async route => {
      const url = new URL(route.request().url())
      if (url.origin === base) return route.continue()
      if (url.hostname.endsWith('supabase.co')) {
        const path = url.pathname
        let data = []
        let status = 200
        if (path.endsWith('/get_my_onboarding_state')) data = { profile, favorite_count: favorites.length }
        else if (path.endsWith('/save_my_favorites')) { favorites = route.request().postDataJSON().anime_ids.map(anime_id => ({ user_id: user.id, anime_id })); data = null }
        else if (path.endsWith('/profiles')) {
          if (['POST', 'PATCH'].includes(route.request().method())) profile = { id: user.id, ...profile, ...route.request().postDataJSON() }
          data = profile
        } else if (path.endsWith('/user_favorite_anime')) {
          if (route.request().method() === 'DELETE') favorites = []
          if (route.request().method() === 'POST') favorites = route.request().postDataJSON()
          data = favorites
        } else if (path.endsWith('/user')) data = user
        else if (path.endsWith('/get-starter-anime')) data = { results: rows, fallbackCount: 0 }
        else if (path.endsWith('/search-anime')) {
          const body = route.request().postDataJSON()
          if (body.query === 'outage') { data = { message: 'Service unavailable' }; status = 503 }
          else data = { results: body.query === 'zzzz' ? [] : [rows[0]] }
        } else if (path.endsWith('/anime')) {
          const id = url.searchParams.get('id')?.replace('eq.', '')
          data = id ? rows.find(row => row.id === id) ?? null : rows
        } else if (path.endsWith('/news')) {
          const row = { id: 'news-1', title: 'Anime announcement', summary: 'A new season is coming.', source_name: 'News source', source_url: 'https://example.test/news', published_at: '2026-09-09T00:00:00Z', image_url: null }
          data = url.searchParams.has('id') ? (url.searchParams.get('id') === 'eq.news-1' ? row : null) : [row]
        } else if (path.endsWith('/trailers')) data = [{ id: 'trailer-1', anime_id: rows[0].id, youtube_video_id: 'abcdefghijk', title: 'Official trailer', thumbnail: null, anime: { title: 'Naruto' }, youtube_url: 'https://www.youtube.com/watch?v=abcdefghijk' }]
        else if (path.endsWith('/public_anime_dna')) {
          if (route.request().method() === 'POST') publicDNA = route.request().postDataJSON()
          data = publicDNA
        }
        return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data), headers: { 'access-control-allow-origin': '*' } })
      }
      // Deterministic image fallback, no analytics/OAuth/external side effects.
      return route.abort()
    })
    for (const path of ['/', '/anime', '/news', '/trailers', '/search', '/onboarding', '/profile', '/auth', '/dna/missing', '/anime/'+rows[0].id, '/anime/missing', '/news/news-1', '/news/missing']) {
      await check(`${viewport.width}px route ${path}`, async () => {
        await page.goto(base + path)
        await page.locator('h1').first().waitFor()
        assert.ok(await page.locator('main').innerText())
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false, 'Horizontal overflow')
      })
    }
    for (const path of ['/recommendations', '/anime-dna']) await check(`${viewport.width}px signed-out protection ${path}`, async () => {
      await page.goto(base+path)
      await page.waitForURL('**/auth')
    })
    await check(`${viewport.width}px search success, empty, failure, clear`, async () => {
      await page.goto(base+'/search')
      const input = page.getByLabel('Search titles')
      await input.fill('Naruto')
      await page.getByRole('heading', { name: 'Naruto', exact: true }).waitFor()
      await page.getByRole('button', { name: 'Clear', exact: true }).click()
      assert.equal(await input.inputValue(), '')
      await input.fill('zzzz')
      await page.getByRole('heading', { name: 'No anime found' }).waitFor()
      await input.fill('outage')
      await page.getByRole('heading', { name: "We couldn't complete that search right now." }).waitFor()
    })
    await check(`${viewport.width}px signed-in onboarding, DNA reveal, profile and public share`, async () => {
      const encoded = value => Buffer.from(JSON.stringify(value)).toString('base64url')
      const token = `${encoded({ alg: 'HS256', typ: 'JWT' })}.${encoded({ sub: user.id, exp: Math.floor(Date.now()/1000)+3600, role: 'authenticated' })}.test-signature`
      await page.evaluate(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), {
        key: `sb-${projectRef}-auth-token`, session: { access_token: token, refresh_token: 'test-refresh', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now()/1000)+3600, user },
      })
      await page.goto(base+'/')
      await page.getByRole('heading', { name: 'Choose your SAIKO username' }).waitFor()
      await page.getByLabel('Username', { exact: true }).fill('anime_fan')
      await page.getByRole('button', { name: 'Continue', exact: true }).click()
      await page.getByRole('heading', { name: 'Choose your all-time favorites' }).waitFor()
      const cards = page.locator('.favorite-card')
      await cards.nth(5).waitFor()
      for (let i = 0; i < 3; i++) await cards.nth(i).click()
      await cards.nth(3).click()
      assert.equal(await page.locator('.favorite-card[aria-pressed="true"]').count(), 3)
      await page.getByRole('button', { name: 'Decode my Anime DNA' }).click()
      await page.locator('.dna-reveal').waitFor()
      assert.equal(favorites.length, 3)
      assert.equal(publicDNA.username, 'anime_fan')
      await page.getByRole('button', { name: 'Explore SAIKO' }).click()
      await page.goto(base+'/profile')
      await page.getByRole('heading', { name: '@anime_fan' }).waitFor()
      await page.goto(base+'/dna/anime_fan')
      await page.getByRole('heading', { name: "anime_fan's Anime DNA" }).waitFor()
      await page.goto(base+'/anime-dna')
      await page.getByRole('heading', { name: 'Share your DNA', exact: true }).waitFor()
      await page.locator('.dna-card-preview img').waitFor()
      await page.goto(base+'/recommendations')
      await page.locator('h1').first().waitFor()
      assert.equal(new URL(page.url()).pathname, '/recommendations')
    })
    await check(`${viewport.width}px no uncaught JavaScript errors`, async () => assert.deepEqual(crashes, []))
    await context.close()
  }
  console.log(`${checks} browser checks passed (mocked API boundaries)`)
} finally { await browser.close() }
