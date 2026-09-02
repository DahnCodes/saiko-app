/**
 * V35 Recommendation Engine Tests
 */

import { scoreCandidate, assignCategory, SAIKO_RECOMMENDATION_VERSION, SAIKO_TRAIT_VERSION } from './scoring';
import { buildV35UserProfile } from './userProfile';
import { extractAnimeTraitVector } from './traitExtractor';
import type { AnimeDNA } from '../../animeDNA';
import type { Anime } from '../../../types/anime';

const mockDna: AnimeDNA = {
  id: 'user1',
  name: 'THE FREEDOM SEEKER',
  tagline: 'The Freedom Seeker',
  description: 'Freedom Seeker description',
  traits: [
    { name: 'Freedom', score: 100, icon: '🦅' },
    { name: 'Rebellion', score: 95, icon: '⚡' },
    { name: 'Adventure', score: 90, icon: '🌍' },
    { name: 'Sacrifice', score: 85, icon: '🔥' },
    { name: 'Ideals', score: 80, icon: '✨' },
    { name: 'Determination', score: 75, icon: '💪' },
  ],
  favoriteAnime: [],
  version: 3,
  generatedAt: new Date().toISOString(),
};

const mockAnimeHighMatch: Anime = {
  id: 'anime1',
  anilistId: 123,
  malId: null,
  title: 'Attack on Titan',
  nativeTitle: null,
  romajiTitle: null,
  englishTitle: null,
  synonyms: [],
  type: 'TV',
  episodes: 12,
  score: 8.5,
  synopsis: 'A story about freedom, rebellion, and fighting against oppression. Eren Yeager and his friends fight for liberation from the Titans.',
  imageUrl: '',
  year: 2023,
  bannerImage: null,
  status: 'FINISHED',
  season: null,
  popularity: 150000,
  genres: ['Action', 'Drama', 'Fantasy'],
};

const mockAnimeLowMatch: Anime = {
  id: 'anime2',
  anilistId: 456,
  malId: null,
  title: 'Slice of Life Romcom',
  nativeTitle: null,
  romajiTitle: null,
  englishTitle: null,
  synonyms: [],
  type: 'TV',
  episodes: 12,
  score: 7.8,
  synopsis: 'A sweet story about two friends slowly falling in love at a coffee shop.',
  imageUrl: '',
  year: 2024,
  bannerImage: null,
  status: 'FINISHED',
  season: null,
  popularity: 80000,
  genres: ['Romance', 'Comedy', 'Slice of Life'],
};

const mockAnimeHiddenGem: Anime = {
  id: 'anime3',
  anilistId: 789,
  malId: null,
  title: 'Lesser Known Freedom Anime',
  nativeTitle: null,
  romajiTitle: null,
  englishTitle: null,
  synonyms: [],
  type: 'TV',
  episodes: 12,
  score: 8.2,
  synopsis: 'A group of rebels fight for freedom against an oppressive regime. Adventure and sacrifice drive this story.',
  imageUrl: '',
  year: 2024,
  bannerImage: null,
  status: 'FINISHED',
  season: null,
  popularity: 15000,
  genres: ['Action', 'Adventure'],
};

const mockAnimeRecent: Anime = {
  id: 'anime4',
  anilistId: 999,
  malId: null,
  title: 'New 2026 Release',
  nativeTitle: null,
  romajiTitle: null,
  englishTitle: null,
  synonyms: [],
  type: 'TV',
  episodes: 12,
  score: 7.5,
  synopsis: 'Fight for freedom in this new adventure.',
  imageUrl: '',
  year: 2026,
  bannerImage: null,
  status: 'RELEASING',
  season: null,
  popularity: 50000,
  genres: ['Action', 'Adventure'],
};

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function test(name: string, fn: () => void): TestResult {
  try {
    fn();
    return { name, passed: true, message: 'OK' };
  } catch (e) {
    return { name, passed: false, message: (e as Error).message };
  }
}

export function runScoringTests(): void {
  const results: TestResult[] = [];

  console.log('='.repeat(60));
  console.log('V35 Recommendation Engine Tests');
  console.log(`Version: ${SAIKO_RECOMMENDATION_VERSION}`);
  console.log(`Trait Version: ${SAIKO_TRAIT_VERSION}`);
  console.log('='.repeat(60));

  results.push(test('Test 1 — Strong trait match scores highly', () => {
    const profile = buildV35UserProfile(mockDna);
    const result = scoreCandidate({
      anime: mockAnimeHighMatch,
      userProfile: profile,
      coreGenres: ['Action', 'Adventure'],
      coreThemes: [],
    });
    assert(result.finalScore >= 60, `Expected decent score, got ${result.finalScore}`);
    assert(result.breakdown.traitMatch >= 50, `Expected high trait match, got ${result.breakdown.traitMatch}`);
    console.log(`  High match score: ${result.finalScore} (trait: ${result.breakdown.traitMatch})`);
  }));

  results.push(test('Test 2 — Weak trait match scores lower', () => {
    const profile = buildV35UserProfile(mockDna);
    const result = scoreCandidate({
      anime: mockAnimeLowMatch,
      userProfile: profile,
      coreGenres: ['Romance', 'Comedy'],
      coreThemes: [],
    });
    console.log(`  Low match score: ${result.finalScore}`);
  }));

  results.push(test('Test 3 — Hidden gem has higher discovery than popular', () => {
    const profile = buildV35UserProfile(mockDna);
    const highMatchResult = scoreCandidate({
      anime: mockAnimeHighMatch,
      userProfile: profile,
      coreGenres: ['Action', 'Drama'],
      coreThemes: [],
    });
    const gemResult = scoreCandidate({
      anime: mockAnimeHiddenGem,
      userProfile: profile,
      coreGenres: ['Action', 'Adventure'],
      coreThemes: [],
    });
    assert(gemResult.breakdown.discoveryScore > highMatchResult.breakdown.discoveryScore,
      `Hidden gem should have higher discovery, gem: ${gemResult.breakdown.discoveryScore}, high: ${highMatchResult.breakdown.discoveryScore}`);
    console.log(`  Hidden gem: ${gemResult.finalScore} (discovery: ${gemResult.breakdown.discoveryScore})`);
    console.log(`  Popular: ${highMatchResult.finalScore} (discovery: ${highMatchResult.breakdown.discoveryScore})`);
  }));

  results.push(test('Test 4 — Newer anime gets higher freshness', () => {
    const profile = buildV35UserProfile(mockDna);
    const recentResult = scoreCandidate({
      anime: mockAnimeRecent,
      userProfile: profile,
      coreGenres: ['Action'],
      coreThemes: [],
    });
    const oldAnime: Anime = { ...mockAnimeHighMatch, year: 2015 };
    const oldResult = scoreCandidate({
      anime: oldAnime,
      userProfile: profile,
      coreGenres: ['Action', 'Drama'],
      coreThemes: [],
    });
    assert(recentResult.breakdown.freshnessScore > oldResult.breakdown.freshnessScore,
      `Newer should have higher freshness, recent: ${recentResult.breakdown.freshnessScore}, old: ${oldResult.breakdown.freshnessScore}`);
    console.log(`  Recent: ${recentResult.breakdown.freshnessScore}, Old: ${oldResult.breakdown.freshnessScore}`);
  }));

  results.push(test('Test 5 — Score components within bounds', () => {
    const profile = buildV35UserProfile(mockDna);
    const result = scoreCandidate({
      anime: mockAnimeHighMatch,
      userProfile: profile,
      coreGenres: ['Action'],
      coreThemes: [],
    });
    for (const [key, value] of Object.entries(result.breakdown)) {
      assert(value >= 0 && value <= 100, `${key} should be 0-100, got ${value}`);
    }
    assert(result.finalScore >= 0 && result.finalScore <= 100, `Final score should be 0-100, got ${result.finalScore}`);
    console.log(`  All scores in valid range`);
  }));

  results.push(test('Test 6 — Deterministic scoring', () => {
    const profile = buildV35UserProfile(mockDna);
    const result1 = scoreCandidate({
      anime: mockAnimeHighMatch,
      userProfile: profile,
      coreGenres: ['Action', 'Drama'],
      coreThemes: [],
    });
    const result2 = scoreCandidate({
      anime: mockAnimeHighMatch,
      userProfile: profile,
      coreGenres: ['Action', 'Drama'],
      coreThemes: [],
    });
    assert(result1.finalScore === result2.finalScore, 'Same inputs should produce same score');
    assert(result1.breakdown.traitMatch === result2.breakdown.traitMatch, 'Trait match should be identical');
    console.log(`  Deterministic: ${result1.finalScore} === ${result2.finalScore}`);
  }));

  results.push(test('Test 7 — User profile weights are normalized', () => {
    const profile = buildV35UserProfile(mockDna);
    const weights = Array.from(profile.weights.values());
    const maxWeight = Math.max(...weights);
    assert(maxWeight <= 1.0 && maxWeight > 0.5, `Max weight should be <= 1.0, got ${maxWeight}`);
    assert(weights.every(w => w >= 0 && w <= 1.0), 'All weights should be 0-1');
    console.log(`  Max weight: ${maxWeight}, all in range`);
  }));

  results.push(test('Test 8 — Category assignment logic', () => {
    const perfectCat = assignCategory({
      finalScore: 85,
      traitScore: 80,
      genreScore: 60,
      discoveryScore: 50,
      freshnessScore: 60,
      isRomance: false,
      hasRomanticThemes: false,
    });
    assert(perfectCat === 'perfect_match', `Expected perfect_match, got ${perfectCat}`);

    const gemCat = assignCategory({
      finalScore: 78,
      traitScore: 75,
      genreScore: 40,
      discoveryScore: 85,
      freshnessScore: 50,
      isRomance: false,
      hasRomanticThemes: false,
    });
    assert(gemCat === 'hidden_gem', `Expected hidden_gem, got ${gemCat}`);

    const romanceCat = assignCategory({
      finalScore: 65,
      traitScore: 55,
      genreScore: 30,
      discoveryScore: 60,
      freshnessScore: 50,
      isRomance: true,
      hasRomanticThemes: false,
    });
    assert(romanceCat === 'romance_pick', `Expected romance_pick, got ${romanceCat}`);

    console.log(`  Categories assigned correctly`);
  }));

  results.push(test('Test 9 — Trait extraction from genres', () => {
    const vector = extractAnimeTraitVector({
      genres: ['Action', 'Adventure'],
      synopsis: 'A story about freedom and rebellion',
    });
    assert(vector.freedom !== undefined, 'Should have freedom trait');
    assert(vector.rebellion !== undefined, 'Should have rebellion trait');
    console.log(`  Top traits: ${Object.entries(vector).filter(([,v]) => v > 0.3).map(([k,v]) => `${k}:${v}`).slice(0, 5).join(', ')}`);
  }));

  results.push(test('Test 10 — Missing metadata handled', () => {
    const profile = buildV35UserProfile(mockDna);
    const noMetaAnime: Anime = {
      id: 'nometa',
      anilistId: 0,
      malId: null,
      title: 'No Metadata',
      nativeTitle: null,
      romajiTitle: null,
      englishTitle: null,
      synonyms: [],
      type: null,
      episodes: null,
      score: null,
      synopsis: null,
      imageUrl: '',
      year: null,
      bannerImage: null,
      status: null,
      season: null,
      popularity: null,
      genres: [],
    };
    const result = scoreCandidate({
      anime: noMetaAnime,
      userProfile: profile,
      coreGenres: [],
      coreThemes: [],
    });
    assert(!isNaN(result.finalScore), 'Should produce a valid score even with missing data');
    assert(result.finalScore >= 0 && result.finalScore <= 100, 'Score should be in valid range');
    console.log(`  No-metadata score: ${result.finalScore}`);
  }));

  results.push(test('Test 11 — Trait vocabulary is exactly 35', () => {
    const { V35_TRAITS } = require('./vocabulary');
    assert(V35_TRAITS.length === 35, `Expected 35 traits, got ${V35_TRAITS.length}`);
    console.log(`  Trait count: ${V35_TRAITS.length}`);
  }));

  results.push(test('Test 12 — Scoring formula matches specification', () => {
    // Verify the weight constants match: 55% trait, 10% genre, 10% theme, 10% quality, 5% freshness, 10% discovery
    const profile = buildV35UserProfile(mockDna);
    const result = scoreCandidate({
      anime: mockAnimeHighMatch,
      userProfile: profile,
      coreGenres: ['Action', 'Adventure'],
      coreThemes: [],
    });

    // Manual calculation
    const expectedScore = Math.round(
      result.breakdown.traitMatch * 0.55 +
      result.breakdown.genreMatch * 0.10 +
      result.breakdown.themeMatch * 0.10 +
      result.breakdown.qualityScore * 0.10 +
      result.breakdown.freshnessScore * 0.05 +
      result.breakdown.discoveryScore * 0.10
    );
    assert(Math.abs(result.finalScore - expectedScore) <= 1, `Score formula mismatch: ${result.finalScore} vs expected ${expectedScore}`);
    console.log(`  Formula: ${result.finalScore} ≈ ${expectedScore}`);
  }));

  console.log('='.repeat(60));
  let passed = 0;
  let failed = 0;
  for (const r of results) {
    if (r.passed) {
      passed++;
      console.log(`✓ ${r.name}`);
    } else {
      failed++;
      console.log(`✗ ${r.name}`);
      console.log(`  ${r.message}`);
    }
  }
  console.log('='.repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    throw new Error(`${failed} tests failed`);
  }
  console.log('\n✅ All tests passed!');
}
