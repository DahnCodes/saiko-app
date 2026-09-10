import type { Plugin } from 'vite'
import { HOME_DESCRIPTION, HOME_TITLE, sitemapXml } from '../src/seo/site.ts'

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
}

function metadataHtml() {
  return `<!-- saiko:metadata:start -->
    <title>${escapeHtml(HOME_TITLE)}</title>
    <meta name="description" content="${escapeHtml(HOME_DESCRIPTION)}" />
    <!-- saiko:metadata:end -->`
}

// Vite has no built-in sitemap generator; emit it through its existing plugin API.
export function discoverability(): Plugin {
  return {
    name: 'saiko-discoverability',
    transformIndexHtml(html) {
      return html.replace('<!-- saiko:metadata -->', metadataHtml())
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.split('?')[0] !== '/sitemap.xml') return next()
        response.setHeader('Content-Type', 'application/xml; charset=utf-8')
        response.end(sitemapXml())
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemapXml() })
    },
  }
}
