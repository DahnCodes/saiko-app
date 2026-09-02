/**
 * SAIKO Recommendation Engine V1 — 35-Canonical Trait Vocabulary
 *
 * Every trait maps to a human-understandable concept that can be scored
 * from anime metadata (genres, themes, synopsis keywords).
 *
 * Traits are scored 0.0 to 1.0:
 *   0.00 = completely absent
 *   0.15 = trace presence
 *   0.30 = minor element
 *   0.45 = noticeable but secondary
 *   0.60 = important
 *   0.75 = strong
 *   0.90 = core characteristic
 *   1.00 = defining characteristic
 */

export interface V35Trait {
  id: string;       // snake_case, e.g. "determination"
  label: string;     // Human readable, e.g. "Determination"
  category: 'drive' | 'emotion' | 'conflict' | 'world' | 'narrative' | 'style';
  description: string;
}

export const V35_TRAITS: readonly V35Trait[] = [
  // ========== DRIVE & CHARACTER ==========
  {
    id: 'determination',
    label: 'Determination',
    category: 'drive',
    description: 'Characters pursue goals with relentless focus and refusal to give up.',
  },
  {
    id: 'ambition',
    label: 'Ambition',
    category: 'drive',
    description: 'Characters have goals that drive them to surpass their limits.',
  },
  {
    id: 'growth',
    label: 'Growth',
    category: 'drive',
    description: 'Central focus on characters becoming stronger, wiser, or more capable.',
  },
  {
    id: 'courage',
    label: 'Courage',
    category: 'drive',
    description: 'Characters face fear and danger despite the odds against them.',
  },
  {
    id: 'resilience',
    label: 'Resilience',
    category: 'drive',
    description: 'Characters endure suffering, setbacks, or trauma and keep moving forward.',
  },
  {
    id: 'self_discovery',
    label: 'Self-Discovery',
    category: 'drive',
    description: 'Characters learn who they truly are, their identity, or their purpose.',
  },

  // ========== EMOTIONAL CORE ==========
  {
    id: 'friendship',
    label: 'Friendship',
    category: 'emotion',
    description: 'Deep bonds between characters that drive loyalty and mutual support.',
  },
  {
    id: 'family',
    label: 'Family',
    category: 'emotion',
    description: 'Family relationships, bonds, or conflicts shape the narrative.',
  },
  {
    id: 'loyalty',
    label: 'Loyalty',
    category: 'emotion',
    description: 'Characters remain steadfastly devoted to people, causes, or promises.',
  },
  {
    id: 'compassion',
    label: 'Compassion',
    category: 'emotion',
    description: 'Characters show empathy and care for others even at personal cost.',
  },
  {
    id: 'love',
    label: 'Love',
    category: 'emotion',
    description: 'Romantic or deep emotional connection between characters.',
  },
  {
    id: 'hope',
    label: 'Hope',
    category: 'emotion',
    description: 'An optimistic outlook persists despite dark circumstances.',
  },

  // ========== CONFLICT & STAKES ==========
  {
    id: 'sacrifice',
    label: 'Sacrifice',
    category: 'conflict',
    description: 'Characters give up something precious for others or for a greater cause.',
  },
  {
    id: 'survival',
    label: 'Survival',
    category: 'conflict',
    description: 'Characters must endure hostile conditions or life-threatening danger.',
  },
  {
    id: 'rebellion',
    label: 'Rebellion',
    category: 'conflict',
    description: 'Characters resist or overthrow oppressive systems or authority.',
  },
  {
    id: 'justice',
    label: 'Justice',
    category: 'conflict',
    description: 'Characters fight for what is right against corruption or wrongdoing.',
  },
  {
    id: 'morality',
    label: 'Morality',
    category: 'conflict',
    description: 'Complex ethical dilemmas where right and wrong are not clear-cut.',
  },
  {
    id: 'power',
    label: 'Power',
    category: 'conflict',
    description: 'Struggles over strength, authority, or the corrupting influence of power.',
  },

  // ========== WORLD & EXPLORATION ==========
  {
    id: 'adventure',
    label: 'Adventure',
    category: 'world',
    description: 'A journey with excitement, exploration, and discovery of new places.',
  },
  {
    id: 'exploration',
    label: 'Exploration',
    category: 'world',
    description: 'Characters discover new places, cultures, or knowledge.',
  },
  {
    id: 'mystery',
    label: 'Mystery',
    category: 'world',
    description: 'Hidden truths, puzzles, or secrets drive the narrative.',
  },
  {
    id: 'discovery',
    label: 'Discovery',
    category: 'world',
    description: 'Characters uncover something important — a truth, ability, or world.',
  },
  {
    id: 'freedom',
    label: 'Freedom',
    category: 'world',
    description: 'Breaking free from chains, cages, duty, or oppressive systems.',
  },
  {
    id: 'world_building',
    label: 'World-Building',
    category: 'world',
    description: 'A rich, detailed world with its own history, rules, and depth.',
  },

  // ========== NARRATIVE EXPERIENCE ==========
  {
    id: 'strategy',
    label: 'Strategy',
    category: 'narrative',
    description: 'Outsmarting opponents through tactics, plans, and clever thinking.',
  },
  {
    id: 'competition',
    label: 'Competition',
    category: 'narrative',
    description: 'Structured contests where characters prove themselves against rivals.',
  },
  {
    id: 'leadership',
    label: 'Leadership',
    category: 'narrative',
    description: 'Characters command, inspire, or guide groups toward goals.',
  },
  {
    id: 'identity',
    label: 'Identity',
    category: 'narrative',
    description: 'Characters question or redefine who they are.',
  },
  {
    id: 'tragedy',
    label: 'Tragedy',
    category: 'narrative',
    description: 'Loss, suffering, or downfall shapes the narrative arc.',
  },
  {
    id: 'darkness',
    label: 'Darkness',
    category: 'narrative',
    description: 'A grim, bleak, or morally heavy atmosphere pervades the story.',
  },

  // ========== STYLE & EXPERIENCE ==========
  {
    id: 'creativity',
    label: 'Creativity',
    category: 'style',
    description: 'Original, inventive, or artistically expressive storytelling.',
  },
  {
    id: 'wonder',
    label: 'Wonder',
    category: 'style',
    description: 'A sense of awe, amazement, or magical inspiration.',
  },
  {
    id: 'humor',
    label: 'Humor',
    category: 'style',
    description: 'Comedy, wit, or lighthearted moments balance the tone.',
  },
  {
    id: 'intensity',
    label: 'Intensity',
    category: 'style',
    description: 'Sustained high stakes, action, or emotional energy.',
  },
];

export const V35_TRAIT_IDS: ReadonlySet<string> = new Set(V35_TRAITS.map(t => t.id));
export const V35_TRAIT_BY_ID: ReadonlyMap<string, V35Trait> = new Map(V35_TRAITS.map(t => [t.id, t]));

/** All trait IDs as an array */
export const V35_TRAIT_ID_LIST: readonly string[] = V35_TRAITS.map(t => t.id);
