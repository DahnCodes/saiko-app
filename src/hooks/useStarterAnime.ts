import { useEffect, useState } from 'react'
import { getStarterAnimeResult } from '../services/animeService.ts'
import type { StarterAnimeResult } from '../services/animeService.ts'
import type { Anime } from '../types/anime.ts'

export function useStarterAnime(enabled = true) {
  const [anime, setAnime] = useState<Anime[]>([])
  const [status, setStatus] = useState<StarterAnimeResult['status'] | 'loading' | 'error'>('loading')
  useEffect(() => {
    if (!enabled) return
    let active = true
    getStarterAnimeResult().then(result => {
      if (active) { setAnime(result.anime); setStatus(result.status) }
    }).catch(() => { if (active) setStatus('error') })
    return () => { active = false }
  }, [enabled])
  const message = status === 'partial' ? 'Some picks are using saved anime details.'
    : status === 'fallback' ? 'Live details are unavailable. You can still choose from these saved starter picks.'
    : status === 'error' ? 'We could not load the starter anime. Please reload to try again.' : ''
  return { anime, status, message }
}
