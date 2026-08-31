import { TRAIT_IDS } from './vocabulary';
import { mapGenresToTraits, mapThemesToTraits } from './metadataMapping';

/**
 * A single trait entry in an anime's extracted trait profile.
 * Includes source tracking and optional evidence text from synopsis.
 */
export interface AnimeTraitProfileEntry {
  /** Canonical snake_case trait ID from SAIKO vocabulary. */
  trait: string;
  /** Strength/weight of this trait in this anime (0.0 to 1.0). */
  strength: number;
  /** Where the trait was sourced from. */
  source: 'genre' | 'theme' | 'synopsis';
  /** Optional excerpt from synopsis that triggered this extraction. */
  evidence?: string;
}

/** Full extracted trait profile for a single anime. */
export type AnimeTraitProfile = AnimeTraitProfileEntry[];

/**
 * Configuration for trait extraction.
 */
export interface ExtractTraitsOptions {
  /** Official genres from anime table (AniList genres). */
  genres: readonly string[];
  /** Optional themes/tags from AniList GraphQL API. */
  themes?: readonly string[];
  /** Anime synopsis or description text. */
  synopsis?: string | null;
  /** Skip synopsis-based extraction (only use metadata). */
  skipSynopsis?: boolean;
}

/**
 * Keyword → trait ID mapping for deterministic synopsis-based extraction.
 * Longer, more specific phrases are matched before shorter ones.
 */
const SYNOPSIS_KEYWORD_MAP: Record<string, string> = {
  // ---- Character archetypes ----
  'underdog': 'underdog',
  'overcome': 'underdog',
  'rags to riches': 'underdog',
  'overcome adversity': 'underdog',
  'overcome obstacles': 'underdog',
  'against all odds': 'underdog',
  'from nothing': 'underdog',
  'humble beginnings': 'underdog',
  'hidden ability': 'hidden_power',
  'untapped power': 'hidden_power',
  'secret power': 'hidden_power',
  'awakened power': 'hidden_power',
  'dormant ability': 'hidden_power',
  'latent power': 'hidden_power',
  'true potential': 'hidden_power',
  'reluctant hero': 'reluctant_hero',
  'refuses to fight': 'reluctant_hero',
  "doesn't want to fight": 'reluctant_hero',
  'forced to fight': 'reluctant_hero',
  'anti-hero': 'antihero',
  'morally gray': 'morally_gray',
  'not good or evil': 'morally_gray',
  'neither good nor evil': 'morally_gray',
  'shades of gray': 'morally_gray',
  'gray morality': 'morally_gray',
  'loner': 'loner',
  'solitary': 'loner',
  'antisocial': 'loner',
  'recluse': 'loner',
  'takes charge': 'leader',
  'natural leader': 'leader',
  'leadership': 'leader',
  'commands': 'leader',
  'captain': 'leader',
  'mastermind': 'mastermind',
  'schemer': 'mastermind',
  'scheming': 'strategist',
  'strategist': 'strategist',
  'genius intellect': 'strategist',
  'strategic': 'strategist',
  'tactical': 'strategist',
  'outsmart': 'strategic_conflict',
  'outwits': 'strategic_conflict',
  'chosen one': 'chosen_one',
  'prophecy foretold': 'chosen_one',
  'destined to': 'destiny',
  'marked by fate': 'destiny',
  'bound by fate': 'destiny',
  'fated': 'destiny',
  'orphan': 'orphan',
  'lost his parents': 'orphan',
  'no parents': 'orphan',

  // ---- Relationships ----
  'best friend': 'friendship',
  'best friends': 'friendship',
  'close friends': 'friendship',
  'unbreakable bond': 'friendship',
  'lifelong friend': 'friendship',
  'comrade': 'teamwork',
  'work together': 'teamwork',
  'working together': 'teamwork',
  'team up': 'teamwork',
  'as a team': 'teamwork',
  'their team': 'teamwork',
  'rivals': 'rivalry',
  'rivalry': 'rivalry',
  'bitter rivals': 'rivalry',
  'arch-rival': 'rivalry',
  'arch nemesis': 'rivalry',
  'romance': 'romance',
  'love story': 'romance',
  'love interest': 'romance',
  'romantic': 'romance',
  'falls in love': 'romance',
  'in love': 'romance',
  'slow burn': 'slow_burn_romance',
  'gradually fall in love': 'slow_burn_romance',
  'slowly fall in love': 'slow_burn_romance',
  'forbidden love': 'forbidden_love',
  'star-crossed': 'forbidden_love',
  'cannot be together': 'forbidden_love',
  'forbidden relationship': 'forbidden_love',
  'found family': 'found_family',
  'becomes family': 'found_family',
  'chosen family': 'found_family',
  'family bond': 'family_bond',
  'protecting family': 'family_bond',
  'family ties': 'family_bond',
  'brother': 'sibling_bond',
  'sister': 'sibling_bond',
  'sibling': 'sibling_bond',
  'siblings': 'sibling_bond',
  'sworn brothers': 'brotherhood',
  'blood brothers': 'brotherhood',
  'sensei': 'mentor_student',
  'his mentor': 'mentor_student',
  'mentor': 'mentor_student',
  'apprentice': 'mentor_student',
  'gave up everything': 'sacrifice',
  'sacrifices': 'sacrifice',
  'sacrifice': 'sacrifice',
  'self-sacrifice': 'sacrifice',
  'love triangle': 'love_triangle',
  'caught between': 'love_triangle',

  // ---- Story structure ----
  'coming of age': 'coming_of_age',
  'grows up': 'character_growth',
  'growing up': 'character_growth',
  'character development': 'character_growth',
  'matures': 'character_growth',
  'comes of age': 'coming_of_age',
  'becomes stronger': 'power_progression',
  'gains power': 'power_progression',
  'gets stronger': 'power_progression',
  'level up': 'power_progression',
  'power up': 'power_progression',
  'tournament arc': 'tournament',
  'tournament': 'tournament',
  'contest': 'competition',
  'competition': 'competition',
  'compete': 'competition',
  'championship': 'competition',
  'detective': 'investigation',
  'uncover the truth': 'investigation',
  'solve the mystery': 'investigation',
  'investigate': 'investigation',
  'whodunit': 'investigation',
  'seeks revenge': 'revenge',
  'avenge': 'revenge',
  'vengeful': 'revenge',
  'vengeance': 'revenge',
  'self-discovery': 'self_discovery',
  'discovers himself': 'self_discovery',
  'find himself': 'self_discovery',
  'forgot his past': 'identity',
  'loses his memory': 'amnesia',
  'memory loss': 'amnesia',
  'amnesia': 'amnesia',
  'dreams of becoming': 'ambition',
  'aspires to': 'ambition',
  'dreams of': 'ambition',
  'prophecy': 'prophecy',
  'prophesied': 'prophecy',
  'court politics': 'political_intrigue',
  'political intrigue': 'political_intrigue',
  'scheming nobles': 'political_intrigue',
  'political schemes': 'political_intrigue',
  'mental battle': 'psychological_conflict',
  'inner conflict': 'psychological_conflict',
  'psychological': 'psychological_conflict',
  'mind games': 'psychological_conflict',
  'cat and mouse': 'psychological_conflict',
  'travels back in time': 'time_travel',
  'sent to the past': 'time_travel',
  'time travel': 'time_travel',
  'goes back in time': 'time_travel',
  'alternate dimension': 'parallel_worlds',
  'parallel world': 'parallel_worlds',
  'parallel dimension': 'parallel_worlds',
  'reincarnated': 'rebirth',
  'reincarnation': 'rebirth',
  'gets a second chance': 'second_chance',
  'second chance': 'second_chance',
  'do-over': 'second_chance',
  'climb the ranks': 'rise_to_power',
  'becomes king': 'rise_to_power',
  'rises to power': 'rise_to_power',
  'seizes power': 'rise_to_power',
  "hero's journey": 'journey',
  'long journey': 'journey',
  'epic journey': 'journey',
  'quest': 'quest',
  'on a quest': 'quest',
  'search for': 'quest',
  'training arc': 'training',
  'intense training': 'training',
  'survival': 'survival',
  'survive': 'survival',
  'staying alive': 'survival',
  'redemption': 'redemption',
  'atone': 'redemption',
  'atonement': 'redemption',
  'seeks forgiveness': 'redemption',

  // ---- Conflict ----
  'world war': 'war',
  'declares war': 'war',
  'great war': 'war',
  'civil war': 'war',
  'soldiers': 'military_conflict',
  'military': 'military_conflict',
  'army': 'military_conflict',
  'battlefield': 'military_conflict',
  'man-eating': 'human_vs_monster',
  'monsters': 'human_vs_monster',
  'demons attack': 'human_vs_monster',
  'good vs evil': 'good_vs_evil',
  'save the world': 'good_vs_evil',
  'save humanity': 'good_vs_evil',
  'fate of the world': 'good_vs_evil',
  'no right answer': 'moral_conflict',
  'moral dilemma': 'moral_conflict',
  'impossible choice': 'moral_conflict',
  'deadly game': 'death_game',
  'game to the death': 'death_game',
  'battle royale': 'death_game',
  'survival game': 'death_game',

  // ---- World / Setting ----
  'fantasy world': 'fantasy_world',
  'magical world': 'fantasy_world',
  'mythical realm': 'fantasy_world',
  'gothic': 'dark_fantasy',
  'dark fantasy': 'dark_fantasy',
  'urban fantasy': 'urban_fantasy',
  'spell': 'magic',
  'magic': 'magic',
  'sorcerer': 'magic',
  'sorcery': 'magic',
  'witch': 'magic',
  'wizard': 'magic',
  'mage': 'magic',
  'magical powers': 'magic',
  'sword fighting': 'sword_fighting',
  'swordsmanship': 'sword_fighting',
  'blades': 'sword_fighting',
  'katana': 'sword_fighting',
  'fighting style': 'martial_arts',
  'martial arts': 'martial_arts',
  'kung fu': 'martial_arts',
  'karate': 'martial_arts',
  'feudal japan': 'feudal',
  'feudal era': 'feudal',
  'samurai': 'feudal',
  'shogun': 'feudal',
  'training academy': 'academy',
  'school academy': 'academy',
  'magic academy': 'academy',
  'cybernetic': 'cyberpunk',
  'cyberpunk': 'cyberpunk',
  'wasteland': 'post_apocalyptic',
  'post-apocalyptic': 'post_apocalyptic',
  'apocalypse': 'post_apocalyptic',
  'dystopian': 'dystopian',
  'dystopia': 'dystopian',
  'oppressive regime': 'dystopian',
  'game world': 'virtual_world',
  'virtual reality': 'virtual_world',
  'inside a game': 'virtual_world',
  'trapped in a game': 'virtual_world',
  'isekai': 'isekai',
  'transported to another world': 'isekai',
  'summoned to another world': 'isekai',
  'sent to another world': 'isekai',
  'mecha': 'mecha',
  'giant robot': 'mecha',
  'pilots a robot': 'mecha',
  'space': 'space',
  'outer space': 'space',
  'galaxy': 'space',
  'starship': 'space',
  'high school': 'school',
  'highschool': 'school',
  'middle school': 'school',
  'college': 'school',
  'university': 'school',
  'workplace': 'workplace',
  'office': 'workplace',
  'corporate': 'workplace',

  // ---- Tone / Mood ----
  'tear-jerking': 'emotional',
  'edge of your seat': 'suspenseful',
  'melancholy': 'melancholic',
  'melancholic': 'melancholic',
  'zany': 'chaotic',
  'wholesome': 'wholesome',
  'heartwarming': 'heartwarming',
  'dark': 'dark',
  'gritty': 'gritty',
  'violent': 'violent',
  'gory': 'violent',
  'bloody': 'violent',
  'lighthearted': 'lighthearted',
  'fun': 'lighthearted',
  'epic': 'epic',
  'suspenseful': 'suspenseful',
  'mysterious': 'mysterious',
  'hopeful': 'hopeful',
  'tragic': 'tragic',
  'heartbreaking': 'tragic',
  'inspiring': 'inspiring',
  'motivational': 'inspiring',
  'intense': 'intense',
  'relaxing': 'relaxing',
  'calm': 'relaxing',
  'slice of life': 'slice_of_life',
  'everyday life': 'slice_of_life',
  'daily life': 'slice_of_life',
  'school life': 'slice_of_life',

  // ---- Sports ----
  'soccer': 'sports',
  'football': 'sports',
  'basketball': 'sports',
  'baseball': 'sports',
  'tennis': 'sports',
  'volleyball': 'sports',
  'swimming': 'sports',
  'boxing': 'sports',
  'martial arts tournament': 'martial_arts',
  'mma': 'martial_arts',

  // ---- High-signal differentiation keywords ----
  // These capture nuance that distinguishes anime in the same genre.

  // Persistence / Willpower
  'never give up': 'underdog',
  'never backed down': 'underdog',
  'refuses to give up': 'underdog',
  'push past their limits': 'character_growth',
  'becomes the strongest': 'power_progression',
  'reaches his dream': 'ambition',
  'pursues his dream': 'ambition',

  // Mentor / Teacher dynamics
  'takes him under his wing': 'mentor_student',
  'trains him': 'mentor_student',
  'master and student': 'mentor_student',

  // Rivalry depth
  'bitter adversary': 'rivalry',
  'fated rival': 'rivalry',
  'sworn enemy': 'rivalry',

  // Specific emotional anchors
  'haunted by the past': 'tragic',
  'scarred by': 'tragic',
  'driven by grief': 'revenge',
  'swore to avenge': 'revenge',
  'loses everything': 'loss',
  'nothing left to lose': 'revenge',

  // Family / Blood bonds
  'only family': 'family_bond',
  'last of his kind': 'orphan',
  'protects his family': 'family_bond',
  'older brother': 'sibling_bond',
  'younger sister': 'sibling_bond',
  'younger brother': 'sibling_bond',

  // Humanity stakes
  'survival of humanity': 'human_vs_monster',
  'humanity at stake': 'good_vs_evil',
  'fate of humanity': 'good_vs_evil',

  // Specific power system signals
  'unlocks a power': 'hidden_power',
  'awakens his power': 'hidden_power',
  'unleashes a power': 'hidden_power',
  'secret technique': 'hidden_power',
  'forbidden technique': 'hidden_power',
  'ultimate technique': 'power_progression',
  'signature move': 'power_progression',
  'special ability': 'hidden_power',
  'unique ability': 'hidden_power',
  'supernatural power': 'hidden_power',

  // Growth arcs
  'changes him': 'character_growth',
  'transforms him': 'character_growth',
  'shapes him': 'character_growth',
  'learns the truth': 'self_discovery',

  // Isekai / transported
  'wakes up in another world': 'isekai',
  'summoned to another': 'isekai',
  'trapped in another world': 'isekai',

  // War / Conflict intensity
  'total war': 'war',
  'all-out war': 'war',
  'final battle': 'epic',
  'climactic battle': 'epic',

  // Psychological depth
  'loses his sanity': 'psychological',
  'fights his demons': 'psychological_conflict',
  'battles within himself': 'psychological_conflict',

  // Sacrifice arcs
  'dies for his friends': 'sacrifice',
  'gives his life': 'sacrifice',
  'sacrifices everything': 'sacrifice',

  // Friendship depth
  'best friend since childhood': 'friendship',
  'friends since childhood': 'friendship',
  'unbreakable friendship': 'friendship',
  'forged in battle': 'brotherhood',

  // Additional specific trope signals
  'wields a sword': 'sword_fighting',
  'master swordsman': 'sword_fighting',
  'demon slayer': 'demon_slayer_corps',
  'demon hunter': 'demon_slayer_corps',
  'eating demons': 'demon_slayer_corps',
  'eating monster': 'human_vs_monster',
  'eats monsters': 'human_vs_monster',
  'giant monsters': 'human_vs_monster',
  'ancient evil': 'good_vs_evil',
  'ancient demon': 'good_vs_evil',
  'ultimate power': 'hidden_power',
  'hidden potential': 'hidden_power',
  'unlimited power': 'hidden_power',
  'unimaginable power': 'hidden_power',
  'titan': 'human_vs_monster',
  'giant humanoid': 'human_vs_monster',
  'titan armor': 'mecha',
  'pilot': 'mecha',
  'sentai': 'super_sentai',
  'transforms into': 'super_sentai',
  'power ranger': 'super_sentai',
};
/** Sorted keywords for longest-first matching. */
const SORTED_KEYWORDS = Object.keys(SYNOPSIS_KEYWORD_MAP).sort(
  (a, b) => b.length - a.length,
);

/**
 * Extract a short evidence snippet from the text surrounding a matched keyword.
 * Returns up to 120 chars of context.
 */
function extractEvidence(text: string, keyword: string): string {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(keyword);
  if (idx === -1) return '';
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + keyword.length + 40);
  let excerpt = text.slice(start, end).replace(/\s+/g, ' ').trim();
  if (start > 0) excerpt = '…' + excerpt;
  if (end < text.length) excerpt = excerpt + '…';
  return excerpt;
}

/**
 * Clean synopsis text for keyword matching.
 */
function cleanSynopsisText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/\(Source:[^)]*\)/gi, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

/**
 * Extract traits from a synopsis using keyword matching.
 * Returns entries with strength and optional evidence.
 * Synopsis traits are considered weaker signals than genre metadata.
 */
function extractTraitsFromSynopsis(synopsis: string | null): AnimeTraitProfileEntry[] {
  const text = cleanSynopsisText(synopsis);
  if (!text || text.length < 20) return [];

  const seen = new Set<string>();
  const entries: AnimeTraitProfileEntry[] = [];

  for (const keyword of SORTED_KEYWORDS) {
    if (seen.has(keyword)) continue;
    if (text.includes(keyword)) {
      const traitId = SYNOPSIS_KEYWORD_MAP[keyword];
      if (TRAIT_IDS.has(traitId)) {
        seen.add(keyword);
        entries.push({
          trait: traitId,
          strength: 0.75, // Synopsis-sourced traits are moderately strong
          source: 'synopsis',
          evidence: extractEvidence(text, keyword),
        });
      }
    }
  }

  return entries;
}

/**
 * Convert a genre array to AnimeTraitProfileEntry[].
 * Genre traits are the strongest signals (they're official classifications).
 */
function genresToProfile(genres: readonly string[]): AnimeTraitProfileEntry[] {
  const traitIds = mapGenresToTraits(genres);
  return traitIds.map((trait) => ({
    trait,
    strength: 1.0, // Genres are authoritative
    source: 'genre' as const,
  }));
}

/**
 * Convert a themes array to AnimeTraitProfileEntry[].
 * Theme traits are moderately strong signals.
 */
function themesToProfile(themes: readonly string[]): AnimeTraitProfileEntry[] {
  const traitIds = mapThemesToTraits(themes);
  return traitIds.map((trait) => ({
    trait,
    strength: 0.85, // Themes are strong but not as authoritative as genres
    source: 'theme' as const,
  }));
}

/**
 * Extract SAIKO trait profiles from anime metadata and synopsis.
 *
 * Processing order (strength / authority):
 * 1. Genres → strength 1.0 (authoritative)
 * 2. Themes → strength 0.85 (strong enrichment)
 * 3. Synopsis → strength 0.75 (supplementary context)
 *
 * When the same trait appears from multiple sources, only the highest strength is kept.
 *
 * Architecture: designed to swap synopsis extraction with AI in the future.
 * Both return the same AnimeTraitProfile structure.
 */
export function extractTraitProfile(options: ExtractTraitsOptions): AnimeTraitProfile {
  const { genres, themes, synopsis, skipSynopsis } = options;

  const strengthMap = new Map<string, AnimeTraitProfileEntry>();

  // 1. Genres (highest authority)
  for (const entry of genresToProfile(genres)) {
    strengthMap.set(entry.trait, entry);
  }

  // 2. Themes (enrichment)
  if (themes) {
    for (const entry of themesToProfile(themes)) {
      const existing = strengthMap.get(entry.trait);
      if (!existing || entry.strength > existing.strength) {
        strengthMap.set(entry.trait, entry);
      }
    }
  }

  // 3. Synopsis (supplementary)
  if (!skipSynopsis && synopsis) {
    for (const entry of extractTraitsFromSynopsis(synopsis)) {
      const existing = strengthMap.get(entry.trait);
      if (!existing || entry.strength > existing.strength) {
        strengthMap.set(entry.trait, entry);
      }
    }
  }

  return Array.from(strengthMap.values()).sort((a, b) => b.strength - a.strength);
}

/**
 * Legacy API — returns flat array of trait IDs (for backwards compat).
 * Prefer extractTraitProfile() for new code.
 */
export function extractTraits(opts: ExtractTraitsOptions): string[] {
  return extractTraitProfile(opts).map((e) => e.trait);
}

/**
 * Legacy alias.
 */

