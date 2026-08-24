import type { AnimeDNA } from './animeDNA.ts'
import { resolveFeaturedDNACharacter, type FeaturedDNACharacter } from './dnaCharacter.ts'

export type AnimeDNAShareCardData = { username: string; publicUrl: string; dna: AnimeDNA; featuredCharacter: FeaturedDNACharacter | null; accent: string }
const accents: Record<string, string> = { 'battle-explorer': '#ffb000', 'master-strategist': '#7f8cff', 'emotional-traveler': '#ff6d9e', 'world-builder': '#67e8b3' }
export async function buildAnimeDNAShareCardData(dna: AnimeDNA, username: string, publicUrl: string): Promise<AnimeDNAShareCardData> { return { username, publicUrl, dna, featuredCharacter: await resolveFeaturedDNACharacter(dna), accent: accents[dna.archetype.id] ?? '#d8ff55' } }
