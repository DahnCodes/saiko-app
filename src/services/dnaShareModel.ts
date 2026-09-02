import type { AnimeDNA } from './animeDNA.ts'
import { resolveFeaturedDNACharacter, type FeaturedDNACharacter } from './dnaCharacter.ts'

export type AnimeDNAShareCardData = { username: string; publicUrl: string; dna: AnimeDNA; featuredCharacter: FeaturedDNACharacter | null; accent: string }

const accents: Record<string, string> = { 
  shonen_soul: '#ffb000', 
  unbreakable_heart: '#ff6d9e', 
  rising_hero: '#67e8b3',
  freedom_seeker: '#7f8cff',
  spirit_warrior: '#a78bfa',
  relentless_protector: '#fbbf24',
  dark_warrior: '#1e293b',
  hope_bringer: '#fde68a',
  survivor: '#ef4444',
  revolutionary_hero: '#dc2626',
  stylish_warrior: '#ec4899',
  power_chaser: '#f97316',
  world_explorer: '#06b6d4',
  adventure_hero: '#22c55e',
  epic_wanderer: '#3b82f6',
  rebel_dreamer: '#8b5cf6',
  determined_guardian: '#14b8a6',
  tragic_warrior: '#64748b',
  burdened_hero: '#6366f1',
  last_hope: '#fbbf24',
} as const

export async function buildAnimeDNAShareCardData(dna: AnimeDNA, username: string, publicUrl: string): Promise<AnimeDNAShareCardData> { 
  return { 
    username, 
    publicUrl, 
    dna, 
    featuredCharacter: await resolveFeaturedDNACharacter(dna), 
    accent: accents[dna.id] ?? '#d8ff55' 
  } 
}
