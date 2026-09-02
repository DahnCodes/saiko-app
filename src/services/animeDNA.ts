import type { Anime } from '../types/anime.ts'

export type AnimeDNATrait = { name: string; score: number; icon: string }

export type AnimeDNA = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  traits: AnimeDNATrait[];
  favoriteAnime: Anime[];
  version: number;
  generatedAt: string;
}

// Canonical anilist IDs for the 6 starter anime.
// Sort order: 20 < 21 < 269 < 16498 < 21459 < 101922
export const STARTER_ANILIST_IDS = {
  NARUTO: 20,
  BLEACH: 269,
  ONE_PIECE: 21,
  DEMON_SLAYER: 101922,
  ATTACK_ON_TITAN: 16498,
  MHA: 21459,
} as const

// Icon mapping for each DNA archetype
const DNA_ICONS: Record<string, string> = {
  shonen_soul: '⚔️',
  unbreakable_heart: '💖',
  rising_hero: '🌟',
  freedom_seeker: '🦅',
  spirit_warrior: '👻',
  relentless_protector: '🛡️',
  dark_warrior: '🌑',
  hope_bringer: '✨',
  survivor: '🔥',
  revolutionary_hero: '⚡',
  stylish_warrior: '🎭',
  power_chaser: '💪',
  world_explorer: '🌍',
  adventure_hero: '🚀',
  epic_wanderer: '🌊',
  rebel_dreamer: '💭',
  determined_guardian: '🤝',
  tragic_warrior: '😢',
  burdened_hero: '⚖️',
  last_hope: '🌅',
}

/**
 * Maps sorted anilist IDs to their DNA archetype.
 * Keys are anilist IDs sorted ascending (numerically) and joined with "-".
 * Sort order: 20 < 21 < 269 < 16498 < 21459 < 101922
 */
const COMBINATION_TO_DNA: Record<string, { id: string; name: string; tagline: string; description: string; traits: string[] }> = {
  // Naruto(20) + One Piece(21) + Bleach(269) -> The Shonen Soul
  '20-21-269': {
    id: 'shonen_soul',
    name: 'THE SHONEN SOUL',
    tagline: 'The Shonen Soul',
    description: 'You love the classic shonen formula at its best — friendship, rivalry, ambition, loyalty, training arcs, powerful transformations and characters who refuse to stay down.',
    traits: ['Loyalty', 'Ambition', 'Rivalry', 'Friendship', 'Perseverance', 'Growth']
  },
  // Naruto(20) + One Piece(21) + AoT(16498) -> The Freedom Seeker
  '20-21-16498': {
    id: 'freedom_seeker',
    name: 'THE FREEDOM SEEKER',
    tagline: 'The Freedom Seeker',
    description: 'You love adventure, but beneath the action you crave stories about freedom, sacrifice, rebellion and the price of pursuing your ideals.',
    traits: ['Freedom', 'Rebellion', 'Adventure', 'Sacrifice', 'Ideals', 'Determination']
  },
  // Naruto(20) + One Piece(21) + MHA(21459) -> The Rising Hero
  '20-21-21459': {
    id: 'rising_hero',
    name: 'THE RISING HERO',
    tagline: 'The Rising Hero',
    description: 'You love watching characters start with limitations and fight their way toward becoming something greater.',
    traits: ['Growth', 'Heroism', 'Ambition', 'Teamwork', 'Determination', 'Self-improvement']
  },
  // Naruto(20) + One Piece(21) + Demon Slayer(101922) -> The Unbreakable Heart
  '20-21-101922': {
    id: 'unbreakable_heart',
    name: 'THE UNBREAKABLE HEART',
    tagline: 'The Unbreakable Heart',
    description: 'You are drawn to emotional journeys where determination and compassion matter just as much as strength.',
    traits: ['Compassion', 'Determination', 'Family', 'Emotional storytelling', 'Courage', 'Perseverance']
  },
  // Naruto(20) + Bleach(269) + AoT(16498) -> The Dark Warrior
  '20-269-16498': {
    id: 'dark_warrior',
    name: 'THE DARK WARRIOR',
    tagline: 'The Dark Warrior',
    description: 'You prefer intense worlds where survival, identity, morality and the consequences of power matter as much as the battles.',
    traits: ['Darkness', 'Survival', 'Identity', 'Morality', 'Power', 'Sacrifice']
  },
  // Naruto(20) + Bleach(269) + MHA(21459) -> The Relentless Protector
  '20-269-21459': {
    id: 'relentless_protector',
    name: 'THE RELENTLESS PROTECTOR',
    tagline: 'The Relentless Protector',
    description: 'You connect with characters who grow stronger because they have people worth protecting.',
    traits: ['Protection', 'Responsibility', 'Loyalty', 'Growth', 'Heroism', 'Determination']
  },
  // Naruto(20) + Bleach(269) + Demon Slayer(101922) -> The Spirit Warrior
  '20-269-101922': {
    id: 'spirit_warrior',
    name: 'THE SPIRIT WARRIOR',
    tagline: 'The Spirit Warrior',
    description: 'You gravitate toward supernatural battles, disciplined warriors, emotional character arcs and worlds where strength comes with a heavy personal cost.',
    traits: ['Spirituality', 'Discipline', 'Courage', 'Emotional depth', 'Combat', 'Sacrifice']
  },
  // Naruto(20) + AoT(16498) + MHA(21459) -> The Revolutionary Hero
  '20-16498-21459': {
    id: 'revolutionary_hero',
    name: 'THE REVOLUTIONARY HERO',
    tagline: 'The Revolutionary Hero',
    description: 'You enjoy heroic stories, but you also question the systems that define who gets to be called a hero.',
    traits: ['Heroism', 'Rebellion', 'Justice', 'Leadership', 'Freedom', 'Morality']
  },
  // Naruto(20) + AoT(16498) + Demon Slayer(101922) -> The Survivor
  '20-16498-101922': {
    id: 'survivor',
    name: 'THE SURVIVOR',
    tagline: 'The Survivor',
    description: 'You are drawn to characters who keep moving forward despite trauma, loss and impossible circumstances.',
    traits: ['Survival', 'Resilience', 'Trauma', 'Sacrifice', 'Determination', 'Emotional depth']
  },
  // Naruto(20) + MHA(21459) + Demon Slayer(101922) -> The Hope Bringer
  '20-21459-101922': {
    id: 'hope_bringer',
    name: 'THE HOPE BRINGER',
    tagline: 'The Hope Bringer',
    description: 'Even when the world gets brutal, you believe stories should have heart. You gravitate toward characters who inspire others through courage and kindness.',
    traits: ['Hope', 'Kindness', 'Heroism', 'Courage', 'Growth', 'Inspiration']
  },
  // One Piece(21) + Bleach(269) + AoT(16498) -> The World Explorer
  '21-269-16498': {
    id: 'world_explorer',
    name: 'THE WORLD EXPLORER',
    tagline: 'The World Explorer',
    description: 'You love mysteries, massive worlds, hidden truths and stories that constantly make you question what you thought you knew.',
    traits: ['Mystery', 'Exploration', 'World-building', 'Discovery', 'Adventure', 'Curiosity']
  },
  // One Piece(21) + Bleach(269) + MHA(21459) -> The Power Chaser
  '21-269-21459': {
    id: 'power_chaser',
    name: 'THE POWER CHASER',
    tagline: 'The Power Chaser',
    description: 'You love discovering unique abilities and watching characters push their powers beyond their limits.',
    traits: ['Power', 'Creativity', 'Growth', 'Competition', 'Teamwork', 'Ambition']
  },
  // One Piece(21) + Bleach(269) + Demon Slayer(101922) -> The Stylish Warrior
  '21-269-101922': {
    id: 'stylish_warrior',
    name: 'THE STYLISH WARRIOR',
    tagline: 'The Stylish Warrior',
    description: 'You want your action to have personality. You love memorable characters, distinct abilities, emotional stakes and worlds overflowing with style.',
    traits: ['Style', 'Combat', 'Personality', 'Adventure', 'Emotion', 'Creativity']
  },
  // One Piece(21) + AoT(16498) + MHA(21459) -> The Rebel Dreamer
  '21-16498-21459': {
    id: 'rebel_dreamer',
    name: 'THE REBEL DREAMER',
    tagline: 'The Rebel Dreamer',
    description: 'You are fascinated by characters who dream of changing the world, even when the world fights back.',
    traits: ['Dreams', 'Freedom', 'Rebellion', 'Leadership', 'Justice', 'Ambition']
  },
  // One Piece(21) + AoT(16498) + Demon Slayer(101922) -> The Epic Wanderer
  '21-16498-101922': {
    id: 'epic_wanderer',
    name: 'THE EPIC WANDERER',
    tagline: 'The Epic Wanderer',
    description: 'You love enormous worlds where adventure and discovery collide with danger, tragedy and unforgettable journeys.',
    traits: ['Adventure', 'Exploration', 'Mystery', 'Tragedy', 'Discovery', 'Freedom']
  },
  // One Piece(21) + MHA(21459) + Demon Slayer(101922) -> The Adventure Hero
  '21-21459-101922': {
    id: 'adventure_hero',
    name: 'THE ADVENTURE HERO',
    tagline: 'The Adventure Hero',
    description: 'You want anime to make you feel something — excitement, friendship, wonder, laughter and the desire to keep moving forward.',
    traits: ['Adventure', 'Friendship', 'Optimism', 'Heroism', 'Emotion', 'Wonder']
  },
  // Bleach(269) + AoT(16498) + MHA(21459) -> The Burdened Hero
  '269-16498-21459': {
    id: 'burdened_hero',
    name: 'THE BURDENED HERO',
    tagline: 'The Burdened Hero',
    description: 'You are drawn to characters who carry enormous responsibility while questioning whether they are truly capable of changing the world.',
    traits: ['Responsibility', 'Morality', 'Heroism', 'Identity', 'Power', 'Sacrifice']
  },
  // Bleach(269) + AoT(16498) + Demon Slayer(101922) -> The Tragic Warrior
  '269-16498-101922': {
    id: 'tragic_warrior',
    name: 'THE TRAGIC WARRIOR',
    tagline: 'The Tragic Warrior',
    description: 'You appreciate beautiful but brutal stories where characters are shaped by loss, duty and the harsh realities of their world.',
    traits: ['Tragedy', 'Sacrifice', 'Duty', 'Darkness', 'Survival', 'Emotional depth']
  },
  // Bleach(269) + MHA(21459) + Demon Slayer(101922) -> The Determined Guardian
  '269-21459-101922': {
    id: 'determined_guardian',
    name: 'THE DETERMINED GUARDIAN',
    tagline: 'The Determined Guardian',
    description: 'You love characters who carry responsibility on their shoulders while still trying to become better versions of themselves.',
    traits: ['Responsibility', 'Protection', 'Discipline', 'Growth', 'Courage', 'Empathy']
  },
  // AoT(16498) + MHA(21459) + Demon Slayer(101922) -> The Last Hope
  '16498-21459-101922': {
    id: 'last_hope',
    name: 'THE LAST HOPE',
    tagline: 'The Last Hope',
    description: 'You love stories where humanity is pushed to its limits and ordinary people have to find the courage to become something extraordinary.',
    traits: ['Hope', 'Survival', 'Courage', 'Sacrifice', 'Heroism', 'Resilience']
  }
}

/**
 * Calculates Anime DNA based on user's favorite anime selection.
 * Uses deterministic numeric sorting of anilist IDs to ensure order-independent matching.
 */
export function calculateAnimeDNA(_userId: string, favorites: Anime[]): AnimeDNA {
  // Get the anilist IDs from favorites
  const anilistIds = favorites
    .map(a => a.anilistId)
    .filter((id): id is number => typeof id === 'number' && id > 0)
  
  // Sort the IDs numerically to ensure order-independent matching
  const sortedIds = [...anilistIds].sort((a, b) => a - b)
  
  // Create the combination key
  const combinationKey = sortedIds.join('-')
  
  // Look up the corresponding DNA archetype
  const dnaData = COMBINATION_TO_DNA[combinationKey]
  
  if (!dnaData) {
    // Fallback: should not happen with valid 3-anime combinations from the 6 options
    console.warn(`No DNA mapping found for anilist combination: ${combinationKey}`)
    // Use a default
    const fallback = COMBINATION_TO_DNA['20-21-269']!
    return {
      id: fallback.id,
      name: fallback.name,
      tagline: fallback.tagline,
      description: fallback.description,
      traits: fallback.traits.map((t, i) => ({ name: t, score: 100 - i * 5, icon: DNA_ICONS[fallback.id] ?? '⚔️' })),
      favoriteAnime: favorites,
      version: 3,
      generatedAt: new Date().toISOString()
    }
  }

  // Build the DNA object with the required structure
  return {
    id: dnaData.id,
    name: dnaData.name,
    tagline: dnaData.tagline,
    description: dnaData.description,
    traits: dnaData.traits.map((t, i) => ({ name: t, score: 100 - i * 5, icon: DNA_ICONS[dnaData.id] ?? '⚔️' })),
    favoriteAnime: favorites,
    version: 3,
    generatedAt: new Date().toISOString()
  }
}

// Export the combination map for testing purposes
export { COMBINATION_TO_DNA, DNA_ICONS }
