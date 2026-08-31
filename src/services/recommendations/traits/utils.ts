import {
  TRAIT_IDS,
  TRAITS_BY_ID,
  TRAITS_BY_CATEGORY,
  TRAIT_VOCABULARY,
} from './vocabulary';
import type { SaikoTrait, TraitCategory } from './types';

/**
 * Normalize a trait ID to canonical snake_case form.
 * - lowercase
 * - replace spaces and hyphens with underscores
 * - collapse multiple underscores
 * - trim leading/trailing underscores
 */
export function normalizeTraitId(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Look up a trait by its canonical ID.
 * Returns undefined if no trait with that ID exists.
 */
export function getTraitById(id: string): SaikoTrait | undefined {
  const normalized = normalizeTraitId(id);
  return TRAITS_BY_ID.get(normalized);
}

/**
 * Get all traits belonging to a specific category.
 */
export function getTraitsByCategory(category: TraitCategory): readonly SaikoTrait[] {
  return TRAITS_BY_CATEGORY.get(category) ?? [];
}

/**
 * Check whether a given ID (or normalized form) refers to a valid trait.
 */
export function isValidTrait(id: string): boolean {
  return TRAIT_IDS.has(normalizeTraitId(id));
}

/**
 * Filter an array of candidate trait IDs to only those that are valid canonical traits.
 * Invalid IDs are silently dropped.
 */
export function filterValidTraitIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of ids) {
    const normalized = normalizeTraitId(raw);
    if (!normalized) continue;
    if (!TRAIT_IDS.has(normalized)) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

/**
 * Return the full vocabulary as a readonly list.
 */
export function getAllTraits(): readonly SaikoTrait[] {
  return TRAIT_VOCABULARY;
}
