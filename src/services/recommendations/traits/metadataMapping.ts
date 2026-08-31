import { filterValidTraitIds } from './utils';
import { TRAIT_IDS } from './vocabulary';

/**
 * Mapping from official AniList genre strings to canonical SAIKO trait IDs.
 * Only includes official genres present in the anime table's genres column.
 *
 * Format: "Official Genre Name" → "saiko_trait_id"
 */
const GENRE_TO_TRAIT: Record<string, string> = {
  Action: 'action',
  Adventure: 'adventure',
  'Comedy': 'comedy',
  Drama: 'drama',
  Fantasy: 'fantasy',
  Horror: 'horror',
  Mystery: 'mystery',
  Romance: 'romance',
  'Sci-Fi': 'sci_fi',
  'Slice of Life': 'slice_of_life',
  Sports: 'sports',
  Supernatural: 'supernatural',
  Thriller: 'thriller',
};

/**
 * Mapping from common AniList/media themes to canonical SAIKO trait IDs.
 * Themes are sometimes embedded in genres in our schema,
 * or passed as separate arrays from the AniList GraphQL API.
 *
 * Format: "Theme Name" → "saiko_trait_id"
 */
const THEME_TO_TRAIT: Record<string, string> = {
  // Martial Arts & Combat
  'Martial Arts': 'martial_arts',

  // Historical & Period
  'Samurai': 'samurai',
  Historical: 'historical',
  Feudal: 'feudal',

  // Setting
  Isekai: 'isekai',
  'Virtual World': 'virtual_world',
  Cyberpunk: 'cyberpunk',
  'Post-Apocalyptic': 'post_apocalyptic',
  Dystopian: 'dystopian',
  Space: 'space',
  School: 'school',
  Academy: 'academy',
  Workplace: 'workplace',
  Modern: 'modern',

  // Creature / World
  Demons: 'demons',
  Spirits: 'spirits',
  Monsters: 'monsters',
  Magic: 'magic',
  Supernatural: 'supernatural',

  // Character archetypes
  'Super Power': 'hidden_power',
  Mecha: 'military',
  Crossdressing: 'double_life',

  // Story
  'Time Travel': 'time_travel',
  'Coming of Age': 'coming_of_age',
  'Life Lesson': 'character_growth',
  Crime: 'crime',
  Gore: 'violent',
  Psychological: 'psychological',
  Revenge: 'revenge',
  Survival: 'survival',
  War: 'war',
  Military: 'military_conflict',
  Political: 'political_intrigue',

  // Relationships
  'Mahou Shoujo': 'found_family',
  'Yuri': 'romance',
  'Yaoi': 'romance',
  'Shoujo Ai': 'slow_burn_romance',
  'Shounen Ai': 'slow_burn_romance',
  'Harem': 'rivalry',

  // Tone
  'Comedy': 'comedic',
  'Tragedy': 'tragic',
  Horror: 'dark',
  'Psychological Thriller': 'suspenseful',
};

/**
 * Demographic strings from AniList mapped to their implied world/tone traits.
 * Demographics are NOT directly stored in our anime table,
 * but can be inferred from the AniList API when available.
 */
const DEMOGRAPHIC_TO_TRAITS: Record<string, string[]> = {
  Shounen: ['action', 'adventure'],
  Shoujo: ['romance', 'emotional'],
  Seinen: ['psychological', 'dark'],
  Josei: ['romance', 'drama'],
};

/**
 * Map an array of official AniList genres (from the anime table) to canonical SAIKO trait IDs.
 * Only known official genres are mapped.
 */
export function mapGenresToTraits(genres: readonly string[]): string[] {
  const traitIds: string[] = [];
  for (const genre of genres) {
    const mapped = GENRE_TO_TRAIT[genre];
    if (mapped && TRAIT_IDS.has(mapped)) {
      traitIds.push(mapped);
    }
  }
  return filterValidTraitIds(traitIds);
}

/**
 * Map an array of AniList themes (from the GraphQL API or stored tags)
 * to canonical SAIKO trait IDs.
 */
export function mapThemesToTraits(themes: readonly string[]): string[] {
  const traitIds: string[] = [];
  for (const theme of themes) {
    const mapped = THEME_TO_TRAIT[theme];
    if (mapped && TRAIT_IDS.has(mapped)) {
      traitIds.push(mapped);
    }
  }
  return filterValidTraitIds(traitIds);
}

/**
 * Infer trait IDs from a demographic string (Shounen, Shoujo, Seinen, Josei).
 * Returns an empty array if the demographic is unknown.
 */
export function mapDemographicToTraits(demographic: string): string[] {
  const traits = DEMOGRAPHIC_TO_TRAITS[demographic];
  return traits ? filterValidTraitIds(traits) : [];
}

/**
 * Combine genre and theme trait IDs into a single deduplicated array.
 * Genres are added first, then themes.
 */
export function mapMetadataToTraits(
  genres: readonly string[],
  themes?: readonly string[],
): string[] {
  const ids: string[] = [];
  // Genres first — they are the authoritative baseline
  ids.push(...mapGenresToTraits(genres));
  // Then themes to enrich
  if (themes) {
    ids.push(...mapThemesToTraits(themes));
  }
  return filterValidTraitIds(ids);
}
