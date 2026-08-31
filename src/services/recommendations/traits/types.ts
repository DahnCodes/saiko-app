// Trait categories for SAIKO recommendation engine
export type TraitCategory =
  | 'genre'
  | 'story'
  | 'character'
  | 'relationship'
  | 'conflict'
  | 'world'
  | 'tone';

export interface SaikoTrait {
  id: string;
  label: string;
  category: TraitCategory;
  description: string;
  specificity: number; // 0.1 to 1.0 - how informative the trait is for personalization
}
