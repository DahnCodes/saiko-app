/**
 * Anime Trait Vector Extractor for SAIKO V35 Vocabulary
 */

import { V35_TRAIT_IDS } from './vocabulary';

export interface AnimeTraitVector {
  [traitId: string]: number;
}

const SYNOPSIS_KEYWORD_MAP: Record<string, string> = {
  'never give up': 'determination',
  'never backs down': 'determination',
  'refuses to give up': 'determination',
  'determined to': 'determination',
  'determined not to': 'determination',
  'willpower': 'determination',
  'ambition': 'ambition',
  'ambitious': 'ambition',
  'dreams of': 'ambition',
  'grow stronger': 'growth',
  'becomes stronger': 'growth',
  'power up': 'growth',
  'training arc': 'growth',
  'overcomes their': 'growth',
  'bravely': 'courage',
  'brave': 'courage',
  'faces fear': 'courage',
  'standing up to': 'courage',
  'refuses to be defeated': 'resilience',
  'never breaks': 'resilience',
  'stands back up': 'resilience',
  'endures': 'resilience',
  'keeps going': 'resilience',
  'painful past': 'resilience',
  'discovers the truth': 'self_discovery',
  'learns the truth': 'self_discovery',
  'finding himself': 'self_discovery',
  'true identity': 'self_discovery',
  'best friends': 'friendship',
  'unbreakable bond': 'friendship',
  'lifelong friend': 'friendship',
  'brotherhood': 'friendship',
  'friendship': 'friendship',
  'comrade': 'friendship',
  'teammates': 'friendship',
  'protect his friends': 'friendship',
  'family': 'family',
  'siblings': 'family',
  'brother': 'family',
  'sister': 'family',
  'parents': 'family',
  'stays by his side': 'loyalty',
  'sworn to': 'loyalty',
  'devoted': 'loyalty',
  'keeps his promise': 'loyalty',
  'will protect': 'loyalty',
  'mercy': 'compassion',
  'shows compassion': 'compassion',
  'feels sorry': 'compassion',
  'falls in love': 'love',
  'romance': 'love',
  'romantic': 'love',
  'love interest': 'love',
  'longing': 'love',
  'hope': 'hope',
  'never lose hope': 'hope',
  'optimistic': 'hope',
  'bright future': 'hope',
  'sacrifice': 'sacrifice',
  'sacrifices': 'sacrifice',
  'sacrificed': 'sacrifice',
  'give up everything': 'sacrifice',
  'gave his life': 'sacrifice',
  'survive': 'survival',
  'survival': 'survival',
  'surviving': 'survival',
  'life or death': 'survival',
  'stay alive': 'survival',
  'fight for survival': 'survival',
  'rebel': 'rebellion',
  'rebels': 'rebellion',
  'rebellion': 'rebellion',
  'defy': 'rebellion',
  'defies': 'rebellion',
  'overthrow': 'rebellion',
  'fight against the': 'rebellion',
  'justice': 'justice',
  'unjust': 'justice',
  'fight for justice': 'justice',
  'injustice': 'justice',
  'right and wrong': 'morality',
  'gray morality': 'morality',
  'morally gray': 'morality',
  'shades of gray': 'morality',
  'power': 'power',
  'ultimate power': 'power',
  'great power': 'power',
  'powerful being': 'power',
  'thirst for power': 'power',
  'adventure': 'adventure',
  'journey': 'adventure',
  'quest': 'adventure',
  'explore': 'exploration',
  'explores': 'exploration',
  'exploring': 'exploration',
  'discovers': 'discovery',
  'discovery': 'discovery',
  'uncover': 'discovery',
  'hidden truth': 'mystery',
  'mystery': 'mystery',
  'mysterious': 'mystery',
  'secret': 'mystery',
  'clue': 'mystery',
  'break free': 'freedom',
  'freedom': 'freedom',
  'free themselves': 'freedom',
  'liberate': 'freedom',
  'chains': 'freedom',
  'world': 'world_building',
  'history': 'world_building',
  'legend': 'world_building',
  'lore': 'world_building',
  'strategy': 'strategy',
  'strategic': 'strategy',
  'outsmart': 'strategy',
  'tactical': 'strategy',
  'plan': 'strategy',
  'competition': 'competition',
  'rival': 'competition',
  'rivals': 'competition',
  'tournament': 'competition',
  'champion': 'competition',
  'contest': 'competition',
  'leader': 'leadership',
  'lead': 'leadership',
  'commands': 'leadership',
  'takes charge': 'leadership',
  'becomes captain': 'leadership',
  'becomes leader': 'leadership',
  'identity': 'identity',
  'who is she': 'identity',
  'who am i': 'identity',
  'tragedy': 'tragedy',
  'tragic': 'tragedy',
  'devastating': 'tragedy',
  'dark': 'darkness',
  'gloomy': 'darkness',
  'bleak': 'darkness',
  'gritty': 'darkness',
  'grim': 'darkness',
  'cruel world': 'darkness',
  'creative': 'creativity',
  'unique': 'creativity',
  'innovative': 'creativity',
  'original': 'creativity',
  'wonder': 'wonder',
  'awe': 'wonder',
  'amazing': 'wonder',
  'breathtaking': 'wonder',
  'magical': 'wonder',
  'comedy': 'humor',
  'comedic': 'humor',
  'funny': 'humor',
  'hilarious': 'humor',
  'laugh': 'humor',
  'intense': 'intensity',
  'action-packed': 'intensity',
  'high stakes': 'intensity',
  'explosive': 'intensity',
  'non-stop': 'intensity',
};

const GENRE_SCORES: Record<string, Record<string, number>> = {
  'Action': { intensity: 0.90, power: 0.85, courage: 0.75 },
  'Adventure': { adventure: 0.90, exploration: 0.80, discovery: 0.70 },
  'Comedy': { humor: 0.90, growth: 0.50, friendship: 0.40 },
  'Drama': { family: 0.60, identity: 0.55, sacrifice: 0.50 },
  'Fantasy': { wonder: 0.85, world_building: 0.80, adventure: 0.70 },
  'Horror': { darkness: 0.85, survival: 0.70, intensity: 0.65 },
  'Mystery': { mystery: 0.90, discovery: 0.80, strategy: 0.55 },
  'Romance': { love: 0.90, compassion: 0.60, hope: 0.55 },
  'Sci-Fi': { world_building: 0.85, strategy: 0.60, exploration: 0.55 },
  'Slice of Life': { hope: 0.60, family: 0.55, growth: 0.50 },
  'Sports': { determination: 0.85, competition: 0.80, growth: 0.70 },
  'Supernatural': { darkness: 0.70, mystery: 0.60, self_discovery: 0.55 },
  'Thriller': { intensity: 0.85, survival: 0.70, mystery: 0.55 },
};

const THEME_SCORES: Record<string, Record<string, number>> = {
  'Survival': { survival: 0.90, resilience: 0.80, determination: 0.75 },
  'Revenge': { ambition: 0.80, darkness: 0.70, determination: 0.65 },
  'Isekai': { adventure: 0.85, self_discovery: 0.75, freedom: 0.70 },
  'Fantasy': { world_building: 0.85, adventure: 0.70, wonder: 0.65 },
  'Mecha': { strategy: 0.75, world_building: 0.70, power: 0.65 },
  'Sports': { determination: 0.90, competition: 0.85, growth: 0.70 },
  'Horror': { darkness: 0.85, survival: 0.70, intensity: 0.65 },
  'Mystery': { mystery: 0.90, discovery: 0.80, strategy: 0.60 },
  'School': { growth: 0.75, friendship: 0.65, identity: 0.55 },
  'Military': { loyalty: 0.80, sacrifice: 0.75, justice: 0.65 },
  'Super Power': { power: 0.85, ambition: 0.75, justice: 0.65 },
  'Police': { justice: 0.85, morality: 0.70, loyalty: 0.65 },
  'Space': { exploration: 0.85, adventure: 0.80, world_building: 0.75 },
  'Martial Arts': { determination: 0.80, courage: 0.75, growth: 0.70 },
};

const SYNOPSIS_KEYWORDS_SORTED = Object.keys(SYNOPSIS_KEYWORD_MAP).sort(
  (a, b) => b.length - a.length
);

export function extractAnimeTraitVector(params: {
  genres?: readonly string[];
  themes?: readonly string[];
  synopsis?: string | null;
  existingTraits?: AnimeTraitVector;
}): AnimeTraitVector {
  const { genres = [], themes = [], synopsis, existingTraits } = params;

  const vector: AnimeTraitVector = existingTraits ? { ...existingTraits } : {};

  const setTrait = (traitId: string, score: number, source: 'genre' | 'theme' | 'synopsis') => {
    if (!V35_TRAIT_IDS.has(traitId)) return;
    const multiplier = source === 'genre' ? 1.0 : source === 'theme' ? 0.85 : 0.75;
    const adjusted = Math.min(score * multiplier, 1.0);
    vector[traitId] = Math.max(vector[traitId] ?? 0, adjusted);
  };

  for (const genre of genres) {
    const genreScores = GENRE_SCORES[genre];
    if (genreScores) {
      for (const [traitId, score] of Object.entries(genreScores)) {
        setTrait(traitId, score, 'genre');
      }
    }
  }

  for (const theme of themes) {
    const themeScores = THEME_SCORES[theme];
    if (themeScores) {
      for (const [traitId, score] of Object.entries(themeScores)) {
        setTrait(traitId, score, 'theme');
      }
    }
  }

  if (synopsis && synopsis.length > 20) {
    const clean = synopsis
      .replace(/<[^>]*>/g, ' ')
      .replace(/\(Source:[^)]*\)/gi, ' ')
      .replace(/\s+/g, ' ')
      .toLowerCase();

    const seen = new Set<string>();
    for (const keyword of SYNOPSIS_KEYWORDS_SORTED) {
      if (seen.has(keyword)) continue;
      if (clean.includes(keyword)) {
        const traitId = SYNOPSIS_KEYWORD_MAP[keyword];
        if (V35_TRAIT_IDS.has(traitId)) {
          seen.add(keyword);
          setTrait(traitId, 0.60, 'synopsis');
        }
      }
    }
  }

  for (const traitId of V35_TRAIT_IDS) {
    if (!(traitId in vector)) {
      vector[traitId] = 0;
    }
  }

  return vector;
}

export function scoreTrait(value: number): number {
  return Math.round(Math.min(1, Math.max(0, value)) * 100) / 100;
}

export function getTopTraits(vector: AnimeTraitVector, n = 6): Array<{ id: string; score: number }> {
  return Object.entries(vector)
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([id, score]) => ({ id, score: scoreTrait(score) }));
}
