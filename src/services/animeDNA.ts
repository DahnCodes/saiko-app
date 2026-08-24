import type { Anime } from '../types/anime.ts'
export type AnimeDNATrait = { name: string; score: number; icon: string }
export type AnimeDNA = { userId: string; archetype: { id: string; name: string; description: string; icon: string }; description: string; traits: AnimeDNATrait[]; favoriteAnime: Anime[]; version: number; generatedAt: string }
const traits = [['Action','⚔️'],['Adventure','🌍'],['Comedy','☀️'],['Romance','💞'],['Drama','🎭'],['Fantasy','✨'],['Sci-Fi','🚀'],['Supernatural','🌑'],['Psychological','🧠'],['Horror','🕯️'],['Sports','🏆'],['Mystery','🔎'],['Thriller','⚡'],['Slice of Life','🌿']] as const
const archetypes = [
  { id: 'battle-explorer', name: 'THE BATTLE-HARDENED EXPLORER', icon: '⚔️', description: 'You love intense battles, massive adventures and characters who grow through impossible challenges.' },
  { id: 'blade-wielder', name: 'THE DEMON-SLAYING BLADE', icon: '⚔️', description: 'You gravitate toward disciplined heroes, fierce rivalries and emotional battles against impossible odds.' },
  { id: 'master-strategist', name: 'THE MASTER STRATEGIST', icon: '🧠', description: 'You are drawn to layered mysteries, psychological tension and stories that reward close attention.' },
  { id: 'emotional-traveler', name: 'THE EMOTIONAL TRAVELER', icon: '💞', description: 'You connect with heartfelt relationships, human growth and stories that stay with you.' },
  { id: 'world-builder', name: 'THE WORLD BUILDER', icon: '✨', description: 'You love imaginative worlds, rich mythology and stories that invite deep exploration.' },
]
export function calculateAnimeDNA(userId: string, favorites: Anime[]): AnimeDNA {
  const counts = new Map<string, number>(); favorites.forEach((a) => a.genres.forEach((g) => counts.set(g, (counts.get(g) ?? 0) + 1)))
  const max = Math.max(...counts.values(), 1)
  const dnaTraits = traits.map(([name, icon]) => ({ name, icon, score: Math.round(((counts.get(name) ?? 0) / max) * 100) })).filter((t) => t.score > 0).sort((a, b) => b.score - a.score).slice(0, 8)
  const weights: Record<string, string[]> = { 'battle-explorer': ['Action', 'Adventure'], 'blade-wielder': ['Action', 'Drama', 'Supernatural'], 'master-strategist': ['Psychological', 'Mystery', 'Thriller'], 'emotional-traveler': ['Drama', 'Romance', 'Slice of Life'], 'world-builder': ['Fantasy', 'Sci-Fi', 'Supernatural'] }
  const score = (a: typeof archetypes[number]) => dnaTraits.reduce((sum, trait) => sum + (weights[a.id]?.includes(trait.name) ? trait.score : 0), 0)
  const archetype = [...archetypes].sort((a, b) => score(b) - score(a))[0] ?? archetypes[0]
  return { userId, archetype, description: archetype.description, traits: dnaTraits, favoriteAnime: favorites, version: 1, generatedAt: new Date().toISOString() }
}
