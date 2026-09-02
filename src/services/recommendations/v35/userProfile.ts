/**
 * User Trait Profile Builder for V35 Vocabulary
 */

import type { AnimeDNA } from '../../animeDNA';
import { V35_TRAIT_ID_LIST } from './vocabulary';
import { extractAnimeTraitVector, type AnimeTraitVector } from './traitExtractor';
import type { Anime } from '../../../types/anime';

export interface V35UserTraitProfile {
  weights: Map<string, number>;
  dnaTraitNames: string[];
  dnaName: string;
}

const DNA_TO_V35: Record<string, string[]> = {
  'Loyalty': ['loyalty', 'friendship'],
  'Ambition': ['ambition', 'determination'],
  'Rivalry': ['competition', 'ambition'],
  'Friendship': ['friendship', 'loyalty'],
  'Perseverance': ['resilience', 'determination'],
  'Growth': ['growth', 'self_discovery'],
  'Compassion': ['compassion', 'love'],
  'Determination': ['determination', 'courage'],
  'Family': ['family', 'love'],
  'Emotional storytelling': ['identity', 'compassion'],
  'Courage': ['courage', 'sacrifice'],
  'Heroism': ['leadership', 'justice'],
  'Teamwork': ['friendship', 'loyalty'],
  'Self-improvement': ['growth', 'determination'],
  'Freedom': ['freedom', 'rebellion'],
  'Rebellion': ['rebellion', 'justice'],
  'Adventure': ['adventure', 'exploration'],
  'Sacrifice': ['sacrifice', 'courage'],
  'Ideals': ['justice', 'morality'],
  'Spirituality': ['identity', 'self_discovery'],
  'Discipline': ['strategy', 'determination'],
  'Emotional depth': ['identity', 'compassion'],
  'Combat': ['intensity', 'power'],
  'Protection': ['loyalty', 'sacrifice'],
  'Responsibility': ['leadership', 'morality'],
  'Darkness': ['darkness', 'morality'],
  'Survival': ['survival', 'resilience'],
  'Identity': ['identity', 'self_discovery'],
  'Morality': ['morality', 'sacrifice'],
  'Power': ['power', 'strategy'],
  'Hope': ['hope', 'compassion'],
  'Kindness': ['compassion', 'friendship'],
  'Inspiration': ['growth', 'hope'],
  'Trauma': ['resilience', 'identity'],
  'Justice': ['justice', 'morality'],
  'Leadership': ['leadership', 'strategy'],
  'Style': ['creativity', 'intensity'],
  'Personality': ['identity', 'self_discovery'],
  'Creativity': ['creativity', 'strategy'],
  'Competition': ['competition', 'strategy'],
  'Mystery': ['mystery', 'discovery'],
  'Exploration': ['exploration', 'adventure'],
  'World-building': ['world_building', 'discovery'],
  'Curiosity': ['discovery', 'exploration'],
  'Optimism': ['hope', 'friendship'],
  'Wonder': ['wonder', 'adventure'],
  'Tragedy': ['tragedy', 'darkness'],
  'Discovery': ['discovery', 'exploration'],
  'Dreams': ['self_discovery', 'hope'],
  'Empathy': ['compassion', 'friendship'],
  'Duty': ['loyalty', 'sacrifice'],
  'Resilience': ['resilience', 'hope'],
};

function dnaToV35Traits(dnaTrait: string): string[] {
  if (DNA_TO_V35[dnaTrait]) return DNA_TO_V35[dnaTrait];
  for (const key of Object.keys(DNA_TO_V35)) {
    if (key.toLowerCase() === dnaTrait.toLowerCase()) return DNA_TO_V35[key];
  }
  for (const key of Object.keys(DNA_TO_V35)) {
    if (dnaTrait.toLowerCase().includes(key.toLowerCase())) return DNA_TO_V35[key];
  }
  return [];
}

export function buildV35UserProfile(dna: AnimeDNA): V35UserTraitProfile {
  const weights = new Map<string, number>();
  const dnaTraitNames = dna.traits.map(t => t.name);
  const dnaName = dna.name;

  for (const id of V35_TRAIT_ID_LIST) {
    weights.set(id, 0);
  }

  const primaryWeight = 1 / 6;
  const secondaryWeight = primaryWeight / 2;

  for (const dnaTrait of dna.traits) {
    const v35Traits = dnaToV35Traits(dnaTrait.name);
    if (v35Traits.length === 0) continue;

    const primary = v35Traits[0];
    weights.set(primary, (weights.get(primary) ?? 0) + primaryWeight);

    if (v35Traits[1]) {
      const secondary = v35Traits[1];
      weights.set(secondary, (weights.get(secondary) ?? 0) + secondaryWeight);
    }
  }

  const maxWeight = Math.max(...weights.values(), 0.0001);
  for (const [id, weight] of weights.entries()) {
    weights.set(id, Math.round((weight / maxWeight) * 100) / 100);
  }

  return { weights, dnaTraitNames, dnaName };
}

export function buildV35UserProfileFromAnime(coreAnime: Anime[]): V35UserTraitProfile {
  const weights = new Map<string, number>();

  for (const id of V35_TRAIT_ID_LIST) {
    weights.set(id, 0);
  }

  const aggregate: AnimeTraitVector = {};
  for (const anime of coreAnime) {
    const vector = extractAnimeTraitVector({
      genres: anime.genres ?? [],
      synopsis: anime.synopsis,
    });
    for (const [traitId, score] of Object.entries(vector)) {
      aggregate[traitId] = (aggregate[traitId] ?? 0) + score;
    }
  }

  const maxScore = Math.max(...Object.values(aggregate), 0.0001);
  for (const [traitId, score] of Object.entries(aggregate)) {
    weights.set(traitId, Math.round((score / maxScore) * 100) / 100);
  }

  return { weights, dnaTraitNames: [], dnaName: 'Derived from Core 3' };
}
