// Re-exports for the traits module
export type { SaikoTrait, TraitCategory } from './types';
export type { AnimeTraitProfile, AnimeTraitProfileEntry, ExtractTraitsOptions } from './traitExtractor';
export { TRAIT_VOCABULARY, TRAIT_IDS, TRAITS_BY_ID, TRAITS_BY_CATEGORY } from './vocabulary';
export {
  normalizeTraitId,
  getTraitById,
  getTraitsByCategory,
  isValidTrait,
  filterValidTraitIds,
  getAllTraits,
} from './utils';
export { mapGenresToTraits, mapThemesToTraits, mapMetadataToTraits } from './metadataMapping';
export { extractTraitProfile, extractTraits } from './traitExtractor';
export {
  getCachedTraitProfile,
  getCachedTraitProfiles,
  getCachedTraitProfilesByAnilistIds,
  cacheTraitProfiles,
  getOrExtractTraitProfile,
  getOrExtractTraitProfiles,
} from './traitCache';
