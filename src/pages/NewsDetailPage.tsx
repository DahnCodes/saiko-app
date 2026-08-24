import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getNewsById } from '../services/newsService.ts'
import type { NewsArticle } from '../types/news.ts'
import '../news.css'

export default function NewsDetailPage() {
  const { id } = useParams()
  const [article, setArticle] = useState<NewsArticle | null>(null)
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  useEffect(() => { if (!id) return; getNewsById(id).then((item) => { setArticle(item); setStatus('success') }).catch(() => setStatus('error')) }, [id])
  if (status === 'loading') return <section className="news-detail-state"><p className="eyebrow">Loading story</p><h1>Finding the latest...</h1></section>
  if (status === 'error' || !article) return <section className="news-detail-state"><p className="eyebrow">Something went wrong</p><h1>Story unavailable</h1><p>We could not load this story right now.</p><Link className="back-link" to="/news">← Back to news</Link></section>
  return <article className="news-detail"><Link className="back-link" to="/news">← Back to news</Link>{article.imageUrl && <img className="news-detail-image" src={article.imageUrl} alt="" />}<p className="news-source">{article.sourceName}</p><h1>{article.title}</h1><p className="news-detail-date">{new Date(article.publishedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}</p>{article.summary && <p className="news-detail-summary">{article.summary}</p>}<a className="primary-action" href={article.sourceUrl} target="_blank" rel="noreferrer">Read original story ↗</a></article>
}
