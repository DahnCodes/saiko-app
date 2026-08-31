import type { SaikoTrait, TraitCategory } from './types';

/**
 * SAIKO Trait Vocabulary V1
 *
 * Canonical, controlled vocabulary for the recommendation engine.
 * NOT generated dynamically. Maintained as source of truth.
 *
 * Every trait has:
 * - id: snake_case canonical identifier
 * - label: human-readable display name
 * - category: one of genre, story, character, relationship, conflict, world, tone
 * - description: what the trait means
 * - specificity: 0.1 (broad) to 1.0 (very specific)
 *
 * No duplicates. Each concept lives in exactly one category.
 */

export const TRAIT_VOCABULARY: readonly SaikoTrait[] = [
  // ========== GENRE TRAITS ==========
  // Broad official genres, lower specificity
  { id: 'action', label: 'Action', category: 'genre', description: 'Fast-paced sequences of combat, fighting, or physical conflict driving the story.', specificity: 0.3 },
  { id: 'adventure', label: 'Adventure', category: 'genre', description: 'A journey or quest where characters explore new places and face challenges.', specificity: 0.3 },
  { id: 'comedy', label: 'Comedy', category: 'genre', description: 'Humorous situations and dialogue intended to entertain and amuse.', specificity: 0.3 },
  { id: 'drama', label: 'Drama', category: 'genre', description: 'Serious, emotional storytelling focused on character and conflict.', specificity: 0.3 },
  { id: 'fantasy', label: 'Fantasy', category: 'genre', description: 'Stories set in magical or supernatural worlds with impossible elements.', specificity: 0.3 },
  { id: 'romance', label: 'Romance', category: 'genre', description: 'Central focus on love stories and romantic relationships.', specificity: 0.4 },
  { id: 'mystery', label: 'Mystery', category: 'genre', description: 'Stories centered on solving puzzles, crimes, or uncovering hidden truths.', specificity: 0.4 },
  { id: 'sci_fi', label: 'Sci-Fi', category: 'genre', description: 'Speculative fiction involving advanced technology, space, or science.', specificity: 0.4 },
  { id: 'horror', label: 'Horror', category: 'genre', description: 'Intended to frighten, shock, or create a sense of dread.', specificity: 0.4 },
  { id: 'sports', label: 'Sports', category: 'genre', description: 'Stories centered on athletic competition and training.', specificity: 0.5 },
  { id: 'thriller', label: 'Thriller', category: 'genre', description: 'High-tension narratives with suspense, danger, and constant stakes.', specificity: 0.4 },
  { id: 'slice_of_life', label: 'Slice of Life', category: 'genre', description: 'Realistic depiction of everyday experiences and relationships.', specificity: 0.4 },

  // ========== STORY TRAITS ==========
  { id: 'coming_of_age', label: 'Coming of Age', category: 'story', description: 'A young protagonist grows from adolescence to maturity through formative experiences.', specificity: 0.7 },
  { id: 'character_growth', label: 'Character Growth', category: 'story', description: 'A central character undergoes meaningful psychological or moral development.', specificity: 0.8 },
  { id: 'power_progression', label: 'Power Progression', category: 'story', description: 'Characters steadily grow stronger, unlock new abilities, or level up over time.', specificity: 0.7 },
  { id: 'underdog', label: 'Underdog', category: 'story', description: 'A protagonist overcomes significant disadvantages or outmatched odds.', specificity: 0.8 },
  { id: 'redemption', label: 'Redemption', category: 'story', description: 'A character seeks to atone for past wrongs and earn forgiveness or salvation.', specificity: 0.8 },
  { id: 'revenge', label: 'Revenge', category: 'story', description: 'A protagonist pursues vengeance against those who wronged them or someone they love.', specificity: 0.8 },
  { id: 'survival', label: 'Survival', category: 'story', description: 'Characters must endure hostile conditions and stay alive against overwhelming odds.', specificity: 0.7 },
  { id: 'investigation', label: 'Investigation', category: 'story', description: 'A methodical search for truth, evidence, or hidden information drives the plot.', specificity: 0.7 },
  { id: 'journey', label: 'Journey', category: 'story', description: 'A long physical or metaphorical voyage forms the backbone of the narrative.', specificity: 0.6 },
  { id: 'quest', label: 'Quest', category: 'story', description: 'Characters pursue a specific goal, artifact, or objective with clear stakes.', specificity: 0.6 },
  { id: 'competition', label: 'Competition', category: 'story', description: 'Characters compete against rivals in structured contests to prove themselves.', specificity: 0.7 },
  { id: 'tournament', label: 'Tournament', category: 'story', description: 'A formal bracket or series of matches determines a champion.', specificity: 0.8 },
  { id: 'training', label: 'Training', category: 'story', description: 'Significant narrative focus on preparation, practice, and self-improvement.', specificity: 0.7 },
  { id: 'self_discovery', label: 'Self Discovery', category: 'story', description: 'A character uncovers who they truly are and what they stand for.', specificity: 0.8 },
  { id: 'identity', label: 'Identity', category: 'story', description: 'Questions of who a character is, their origins, or their place in the world.', specificity: 0.7 },
  { id: 'ambition', label: 'Ambition', category: 'story', description: 'A driving desire to achieve greatness or reach a lofty goal.', specificity: 0.7 },
  { id: 'destiny', label: 'Destiny', category: 'story', description: 'A character is bound by fate or prophecy to fulfill a particular role.', specificity: 0.7 },
  { id: 'prophecy', label: 'Prophecy', category: 'story', description: 'A foretold event or chosen figure shapes the trajectory of the story.', specificity: 0.8 },
  { id: 'betrayal', label: 'Betrayal', category: 'story', description: 'Trust is broken by someone close, often with devastating consequences.', specificity: 0.8 },
  { id: 'political_intrigue', label: 'Political Intrigue', category: 'story', description: 'Schemes, alliances, and power plays within courts, governments, or factions.', specificity: 0.9 },
  { id: 'strategic_conflict', label: 'Strategic Conflict', category: 'story', description: 'Winners are decided by tactics, planning, and clever maneuvering.', specificity: 0.8 },
  { id: 'psychological_conflict', label: 'Psychological Conflict', category: 'story', description: 'The central tension is internal, mental, or emotional rather than physical.', specificity: 0.8 },
  { id: 'time_travel', label: 'Time Travel', category: 'story', description: 'Characters move between different points in time, altering past or future.', specificity: 0.9 },
  { id: 'parallel_worlds', label: 'Parallel Worlds', category: 'story', description: 'Multiple versions of reality exist and characters move between them.', specificity: 0.9 },
  { id: 'rebirth', label: 'Rebirth', category: 'story', description: 'A character is given a second life, often in a new body or world.', specificity: 0.8 },
  { id: 'second_chance', label: 'Second Chance', category: 'story', description: 'A character gets an opportunity to redo or rewrite their fate.', specificity: 0.8 },
  { id: 'rise_to_power', label: 'Rise to Power', category: 'story', description: 'A protagonist climbs from obscurity to authority or dominance.', specificity: 0.8 },

  // ========== CHARACTER TRAITS ==========
  { id: 'antihero', label: 'Antihero', category: 'character', description: 'A protagonist who lacks traditional heroic qualities or operates outside moral norms.', specificity: 0.8 },
  { id: 'morally_gray', label: 'Morally Gray', category: 'character', description: 'A character who cannot be easily classified as good or evil.', specificity: 0.8 },
  { id: 'chosen_one', label: 'Chosen One', category: 'character', description: 'A character singled out by fate, prophecy, or power to fulfill a unique role.', specificity: 0.7 },
  { id: 'reluctant_hero', label: 'Reluctant Hero', category: 'character', description: 'A protagonist who resists their heroic calling before accepting it.', specificity: 0.8 },
  { id: 'weak_to_strong', label: 'Weak to Strong', category: 'character', description: 'A character begins powerless or unskilled and grows formidable over time.', specificity: 0.8 },
  { id: 'hidden_power', label: 'Hidden Power', category: 'character', description: 'A character possesses an untapped or secret ability waiting to be unleashed.', specificity: 0.7 },
  { id: 'double_life', label: 'Double Life', category: 'character', description: 'A character maintains a secret identity or hidden existence from those around them.', specificity: 0.7 },
  { id: 'loner', label: 'Loner', category: 'character', description: 'A character who operates alone, distanced from groups or society.', specificity: 0.7 },
  { id: 'leader', label: 'Leader', category: 'character', description: 'A character who takes charge, inspires others, and bears responsibility for a group.', specificity: 0.6 },
  { id: 'mastermind', label: 'Mastermind', category: 'character', description: 'A character who orchestrates complex plans or schemes from the shadows.', specificity: 0.8 },
  { id: 'strategist', label: 'Strategist', category: 'character', description: 'A character who excels at reading situations and devising winning plans.', specificity: 0.8 },

  // ========== RELATIONSHIP TRAITS ==========
  { id: 'friendship', label: 'Friendship', category: 'relationship', description: 'Bonds of camaraderie and loyalty between characters are central to the story.', specificity: 0.6 },
  { id: 'teamwork', label: 'Teamwork', category: 'relationship', description: 'Characters succeed by combining their strengths and coordinating as a group.', specificity: 0.6 },
  { id: 'rivalry', label: 'Rivalry', category: 'relationship', description: 'A competitive relationship between characters pushes both to greater heights.', specificity: 0.7 },
  { id: 'slow_burn_romance', label: 'Slow Burn Romance', category: 'relationship', description: 'A romantic relationship that develops gradually over extended time.', specificity: 0.8 },
  { id: 'forbidden_love', label: 'Forbidden Love', category: 'relationship', description: 'A romance hindered by social rules, family, duty, or circumstance.', specificity: 0.8 },
  { id: 'found_family', label: 'Found Family', category: 'relationship', description: 'Unrelated characters form deep familial bonds and become each other’s family.', specificity: 0.8 },
  { id: 'family_bond', label: 'Family Bond', category: 'relationship', description: 'The relationships between blood relatives drive the emotional core.', specificity: 0.7 },
  { id: 'sibling_bond', label: 'Sibling Bond', category: 'relationship', description: 'Brothers and sisters navigate loyalty, conflict, and love.', specificity: 0.7 },
  { id: 'brotherhood', label: 'Brotherhood', category: 'relationship', description: 'A deep, sworn bond between comrades who treat each other as brothers.', specificity: 0.7 },
  { id: 'mentor_student', label: 'Mentor Student', category: 'relationship', description: 'A guiding relationship where one character teaches and shapes another.', specificity: 0.7 },
  { id: 'loyalty', label: 'Loyalty', category: 'relationship', description: 'Unwavering devotion to friends, cause, or master defines characters.', specificity: 0.7 },
  { id: 'sacrifice', label: 'Sacrifice', category: 'relationship', description: 'Characters give up something precious for the sake of others.', specificity: 0.7 },

  // ========== CONFLICT TRAITS ==========
  { id: 'war', label: 'War', category: 'conflict', description: 'Large-scale organized violence between nations, factions, or armies.', specificity: 0.7 },
  { id: 'battle', label: 'Battle', category: 'conflict', description: 'Focused combat encounters between individuals or small groups.', specificity: 0.5 },
  { id: 'military_conflict', label: 'Military Conflict', category: 'conflict', description: 'Organized armed forces clash in strategic operations and campaigns.', specificity: 0.8 },
  { id: 'political_conflict', label: 'Political Conflict', category: 'conflict', description: 'Power struggles between factions, leaders, or ideologies without open warfare.', specificity: 0.8 },
  { id: 'human_vs_monster', label: 'Human vs Monster', category: 'conflict', description: 'Humanity faces terrifying creatures or supernatural threats.', specificity: 0.8 },
  { id: 'human_vs_human', label: 'Human vs Human', category: 'conflict', description: 'The central conflict is between people with opposing goals or beliefs.', specificity: 0.7 },
  { id: 'good_vs_evil', label: 'Good vs Evil', category: 'conflict', description: 'A clear moral struggle between virtuous and villainous forces.', specificity: 0.6 },
  { id: 'moral_conflict', label: 'Moral Conflict', category: 'conflict', description: 'Characters face difficult choices with no clearly right answer.', specificity: 0.8 },
  { id: 'power_struggle', label: 'Power Struggle', category: 'conflict', description: 'Competing parties vie for control, authority, or dominance.', specificity: 0.7 },
  { id: 'rebellion', label: 'Rebellion', category: 'conflict', description: 'Outsiders rise up against an established order or authority.', specificity: 0.8 },
  { id: 'revolution', label: 'Revolution', category: 'conflict', description: 'A sweeping overthrow of an existing system or government.', specificity: 0.8 },
  { id: 'invasion', label: 'Invasion', category: 'conflict', description: 'A hostile force enters and attempts to conquer territory or people.', specificity: 0.8 },
  { id: 'apocalypse', label: 'Apocalypse', category: 'conflict', description: 'Civilization collapses or faces an end-of-the-world threat.', specificity: 0.8 },
  { id: 'death_game', label: 'Death Game', category: 'conflict', description: 'Characters are forced into lethal games or survival scenarios.', specificity: 0.9 },
  { id: 'crime', label: 'Crime', category: 'conflict', description: 'Criminal activity, investigations, or underworld dealings drive the plot.', specificity: 0.7 },

  // ========== WORLD TRAITS ==========
  { id: 'fantasy_world', label: 'Fantasy World', category: 'world', description: 'A fully realized setting with its own geography, cultures, and history.', specificity: 0.7 },
  { id: 'dark_fantasy', label: 'Dark Fantasy', category: 'world', description: 'A fantasy setting with grim, horror-tinged, or morally bleak elements.', specificity: 0.8 },
  { id: 'urban_fantasy', label: 'Urban Fantasy', category: 'world', description: 'Magical or supernatural events occur within a modern city setting.', specificity: 0.8 },
  { id: 'supernatural', label: 'Supernatural', category: 'world', description: 'The world contains forces, beings, or phenomena beyond natural law.', specificity: 0.5 },
  { id: 'magic', label: 'Magic', category: 'world', description: 'Characters wield supernatural forces through spells, rituals, or innate power.', specificity: 0.6 },
  { id: 'demons', label: 'Demons', category: 'world', description: 'Demonic entities are a significant part of the setting or conflict.', specificity: 0.8 },
  { id: 'spirits', label: 'Spirits', category: 'world', description: 'Spiritual beings, yokai, or otherworldly entities inhabit the world.', specificity: 0.8 },
  { id: 'monsters', label: 'Monsters', category: 'world', description: 'Dangerous creatures threaten characters throughout the story.', specificity: 0.6 },
  { id: 'ninja', label: 'Ninja', category: 'world', description: 'Stealth warriors, shinobi, and covert operations are central.', specificity: 0.9 },
  { id: 'samurai', label: 'Samurai', category: 'world', description: 'Sword-bearing warriors bound by honor and the way of the blade.', specificity: 0.9 },
  { id: 'martial_arts', label: 'Martial Arts', category: 'world', description: 'Hand-to-hand combat styles, disciplines, and tournaments are featured.', specificity: 0.8 },
  { id: 'sword_fighting', label: 'Sword Fighting', category: 'world', description: 'Combat with bladed weapons is a defining element of the world.', specificity: 0.8 },
  { id: 'military', label: 'Military', category: 'world', description: 'The setting is grounded in or dominated by armed forces and hierarchy.', specificity: 0.7 },
  { id: 'historical', label: 'Historical', category: 'world', description: 'The story is set in a recognizable past period with real-world influences.', specificity: 0.7 },
  { id: 'feudal', label: 'Feudal', category: 'world', description: 'A hierarchical social order ruled by lords, vassals, and warrior codes.', specificity: 0.8 },
  { id: 'modern', label: 'Modern', category: 'world', description: 'The setting is contemporary or near-contemporary real-world Japan.', specificity: 0.5 },
  { id: 'school', label: 'School', category: 'world', description: 'A school environment serves as a primary setting for the story.', specificity: 0.7 },
  { id: 'academy', label: 'Academy', category: 'world', description: 'A specialized training institution structures the characters’ lives.', specificity: 0.8 },
  { id: 'workplace', label: 'Workplace', category: 'world', description: 'Professional or office environments drive the narrative.', specificity: 0.8 },
  { id: 'space', label: 'Space', category: 'world', description: 'The story takes place in outer space or among the stars.', specificity: 0.8 },
  { id: 'cyberpunk', label: 'Cyberpunk', category: 'world', description: 'A high-tech, low-life future with corporate power and digital augmentation.', specificity: 0.9 },
  { id: 'post_apocalyptic', label: 'Post Apocalyptic', category: 'world', description: 'The world exists in the ruins after a catastrophic collapse.', specificity: 0.9 },
  { id: 'dystopian', label: 'Dystopian', category: 'world', description: 'Society is organized around oppressive, controlled, or unjust systems.', specificity: 0.8 },
  { id: 'alternate_world', label: 'Alternate World', category: 'world', description: 'A version of reality diverging from our own in significant ways.', specificity: 0.8 },
  { id: 'isekai', label: 'Isekai', category: 'world', description: 'Characters are transported from one world to another, often a fantasy realm.', specificity: 0.9 },
  { id: 'virtual_world', label: 'Virtual World', category: 'world', description: 'A significant portion of the story takes place inside a digital or simulated reality.', specificity: 0.9 },

  // ========== TONE TRAITS ==========
  { id: 'dark', label: 'Dark', category: 'tone', description: 'A bleak, grim, or morally heavy atmosphere pervades the story.', specificity: 0.6 },
  { id: 'lighthearted', label: 'Lighthearted', category: 'tone', description: 'A cheerful, easygoing mood with little sustained darkness.', specificity: 0.6 },
  { id: 'emotional', label: 'Emotional', category: 'tone', description: 'Stories prioritize deep feeling, sentiment, and heartfelt moments.', specificity: 0.5 },
  { id: 'tragic', label: 'Tragic', category: 'tone', description: 'A somber tone where loss, suffering, or downfall shape the narrative.', specificity: 0.7 },
  { id: 'hopeful', label: 'Hopeful', category: 'tone', description: 'An optimistic outlook where better futures feel possible.', specificity: 0.6 },
  { id: 'intense', label: 'Intense', category: 'tone', description: 'Sustained high stakes and relentless pressure drive the energy.', specificity: 0.6 },
  { id: 'violent', label: 'Violent', category: 'tone', description: 'Gore, brutality, and physical harm are depicted without flinching.', specificity: 0.7 },
  { id: 'comedic', label: 'Comedic', category: 'tone', description: 'Humor and wit are a primary emotional register throughout.', specificity: 0.6 },
  { id: 'wholesome', label: 'Wholesome', category: 'tone', description: 'Kind, sincere, and uplifting moments define the experience.', specificity: 0.7 },
  { id: 'heartwarming', label: 'Heartwarming', category: 'tone', description: 'Moments of warmth and tenderness leave a lasting emotional impact.', specificity: 0.7 },
  { id: 'suspenseful', label: 'Suspenseful', category: 'tone', description: 'A feeling of uncertainty and anticipation keeps audiences on edge.', specificity: 0.7 },
  { id: 'mysterious', label: 'Mysterious', category: 'tone', description: 'An aura of secrets, hidden truths, and unknown forces pervades.', specificity: 0.7 },
  { id: 'psychological', label: 'Psychological', category: 'tone', description: 'The focus is on minds, motives, and the inner workings of characters.', specificity: 0.7 },
  { id: 'melancholic', label: 'Melancholic', category: 'tone', description: 'A reflective sadness colors the narrative and character arcs.', specificity: 0.7 },
  { id: 'inspiring', label: 'Inspiring', category: 'tone', description: 'The story motivates viewers to pursue their own growth or dreams.', specificity: 0.6 },
  { id: 'epic', label: 'Epic', category: 'tone', description: 'Grand in scope, with sweeping stakes and monumental conflicts.', specificity: 0.6 },
  { id: 'gritty', label: 'Gritty', category: 'tone', description: 'A raw, realistic, and unpolished texture defines the experience.', specificity: 0.7 },
  { id: 'serious', label: 'Serious', category: 'tone', description: 'The narrative treats its subject matter with weight and gravitas.', specificity: 0.5 },
  { id: 'relaxing', label: 'Relaxing', category: 'tone', description: 'A calm, low-pressure atmosphere invites easy viewing.', specificity: 0.7 },
  { id: 'chaotic', label: 'Chaotic', category: 'tone', description: 'Energy is unpredictable, frantic, and constantly shifting.', specificity: 0.7 },
];

/**
 * Set of all valid trait IDs for O(1) lookup.
 */
export const TRAIT_IDS: ReadonlySet<string> = new Set(TRAIT_VOCABULARY.map((t) => t.id));

/**
 * Trait ID → Trait index for fast lookup.
 */
export const TRAITS_BY_ID: ReadonlyMap<string, SaikoTrait> = new Map(
  TRAIT_VOCABULARY.map((t) => [t.id, t]),
);

/**
 * Grouped traits by category for batch lookups.
 */
export const TRAITS_BY_CATEGORY: ReadonlyMap<TraitCategory, readonly SaikoTrait[]> = (() => {
  const map = new Map<TraitCategory, SaikoTrait[]>();
  for (const trait of TRAIT_VOCABULARY) {
    const list = map.get(trait.category) ?? [];
    list.push(trait);
    map.set(trait.category, list);
  }
  return map;
})();
