export const SITE_URL = 'https://saiko-app.pxxl.click'
export const HOME_TITLE = 'SAIKO | Discover Anime, News & Your Anime DNA'
export const HOME_DESCRIPTION = 'Discover anime, explore trending titles, read anime news, and watch trailers. Create your Anime DNA for recommendations based on your taste.'

// Used by React Router and sitemap generation. Account-only routes stay out.
export const publicRoutes = {
  home: '/',
  anime: '/anime',
  news: '/news',
  trailers: '/trailers',
  search: '/search',
  onboarding: '/onboarding',
} as const

export function canonicalUrl(pathname: string) {
  const path = pathname.split(/[?#]/, 1)[0].replace(/\/+/g, '/').replace(/\/index\.html$/, '/').replace(/\/+$/, '')
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}` || `${SITE_URL}/`
}

export function sitemapXml() {
  const urls = Object.values(publicRoutes).map(path =>
    `  <url><loc>${SITE_URL}${path}</loc></url>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}
