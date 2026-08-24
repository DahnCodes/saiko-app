import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getLatestNews } from '../services/newsService.ts'
import type { NewsArticle } from '../types/news.ts'
import '../news.css'

export default function NewsPage() {
  const [articles, setArticles] = useState<NewsArticle[]>([])
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  useEffect(() => { getLatestNews().then((items) => { setArticles(items); setStatus('success') }).catch(() => setStatus('error')) }, [])
  return <section className="news-page"><p className="eyebrow">From across the anime world</p><h1>Latest news</h1>{status === 'loading' && <div className="news-state">Loading the latest stories...</div>}{status === 'error' && <div className="news-state"><h2>We could not load the latest stories.</h2><p>Please try again shortly.</p></div>}{status === 'success' && articles.length === 0 && <div className="news-state"><h2>Stories are on the way.</h2><p>News will appear here once our sources are connected.</p></div>}{articles.length > 0 && <div className="news-grid">{articles.map((article) => <Link className="news-card" to={`/news/${article.id}`} key={article.id}>{article.imageUrl && <img src={article.imageUrl} alt="" loading="lazy" />}<div className="news-card-body"><p className="news-source">{article.sourceName}</p><h2>{article.title}</h2>{article.summary && <p>{article.summary}</p>}<span className="news-card-link">Read story →</span></div></Link>)}</div>}</section>
}
