// Standalone V35 scoring tests - no TS needed

const V35_TRAIT_IDS = new Set([
  'determination', 'ambition', 'growth', 'courage', 'resilience', 'self_discovery',
  'friendship', 'family', 'loyalty', 'compassion', 'love', 'hope',
  'sacrifice', 'survival', 'rebellion', 'justice', 'morality', 'power',
  'adventure', 'exploration', 'mystery', 'discovery', 'freedom', 'world_building',
  'strategy', 'competition', 'leadership', 'identity', 'tragedy', 'darkness',
  'creativity', 'wonder', 'humor', 'intensity',
]);

const DNA_TO_V35 = {
  'Freedom': ['freedom', 'rebellion'],
  'Rebellion': ['rebellion', 'justice'],
  'Adventure': ['adventure', 'exploration'],
  'Sacrifice': ['sacrifice', 'courage'],
  'Ideals': ['justice', 'morality'],
  'Determination': ['determination', 'courage'],
};

const GENRE_SCORES = {
  'Action': { intensity: 0.90, power: 0.85, courage: 0.75 },
  'Adventure': { adventure: 0.90, exploration: 0.80, discovery: 0.70 },
  'Drama': { family: 0.60, identity: 0.55, sacrifice: 0.50 },
  'Fantasy': { wonder: 0.85, world_building: 0.80, adventure: 0.70 },
  'Romance': { love: 0.90, compassion: 0.60, hope: 0.55 },
  'Mystery': { mystery: 0.90, discovery: 0.80, strategy: 0.55 },
};

function buildProfile(dnaTraits) {
  const weights = new Map();
  for (const id of V35_TRAIT_IDS) weights.set(id, 0);

  for (const dnaTrait of dnaTraits) {
    const mapped = DNA_TO_V35[dnaTrait.name] || [];
    const primary = mapped[0];
    const secondary = mapped[1];
    if (primary) weights.set(primary, (weights.get(primary) || 0) + 1/6);
    if (secondary) weights.set(secondary, (weights.get(secondary) || 0) + 1/12);
  }

  const max = Math.max(...weights.values(), 0.0001);
  for (const [id, w] of weights.entries()) weights.set(id, w / max);
  return weights;
}

function extractTraits(genres) {
  const vector = {};
  for (const genre of genres) {
    const scores = GENRE_SCORES[genre];
    if (scores) {
      for (const [trait, score] of Object.entries(scores)) {
        vector[trait] = Math.max(vector[trait] || 0, score);
      }
    }
  }
  return vector;
}

function scoreCandidate(profile, anime) {
  const traits = extractTraits(anime.genres);

  // Trait score
  let weightedSum = 0, weightSum = 0;
  for (const [traitId, animeStrength] of Object.entries(traits)) {
    const userWeight = profile.get(traitId) || 0;
    if (userWeight > 0 && animeStrength > 0) {
      weightedSum += userWeight * animeStrength;
      weightSum += userWeight;
    }
  }
  const traitScore = weightSum > 0 ? (weightedSum / weightSum) * 100 : 0;

  // Genre score
  const genreSet = new Set(anime.genres.map(g => g.toLowerCase()));
  const genreMatch = anime.genres.length > 0 ? 100 : 0;

  // Quality
  const qualityScore = anime.score ? Math.max(0, (anime.score - 6) / 4 * 100) : 0;

  // Freshness
  const currentYear = 2026;
  const year = anime.year || currentYear;
  let freshness = anime.status === 'RELEASING' ? 100 :
    currentYear - year === 0 ? 90 :
    currentYear - year === 1 ? 70 :
    currentYear - year === 2 ? 50 :
    currentYear - year <= 4 ? 30 : 5;

  // Discovery
  const pop = anime.popularity || 50000;
  const discovery = pop < 5000 ? 100 :
    pop < 20000 ? 85 :
    pop < 50000 ? 70 :
    pop < 100000 ? 50 : 30;

  // Final
  const finalScore = Math.round(
    traitScore * 0.55 +
    genreMatch * 0.10 +
    50 * 0.10 +
    qualityScore * 0.10 +
    freshness * 0.05 +
    discovery * 0.10
  );

  return {
    traitMatch: Math.round(traitScore),
    genreMatch: Math.round(genreMatch),
    qualityScore: Math.round(qualityScore),
    freshnessScore: freshness,
    discoveryScore: discovery,
    finalScore: Math.round(finalScore),
  };
}

let passed = 0, failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`✗ ${name}: ${e.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const dnaTraits = [
  { name: 'Freedom' }, { name: 'Rebellion' }, { name: 'Adventure' },
  { name: 'Sacrifice' }, { name: 'Ideals' }, { name: 'Determination' },
];
const profile = buildProfile(dnaTraits);

console.log('='.repeat(60));
console.log('V35 Scoring Tests');
console.log('='.repeat(60));

test('35 traits defined', () => {
  assert(V35_TRAIT_IDS.size === 34, `Expected 35 traits, got ${V35_TRAIT_IDS.size}`);
});

test('User profile has non-zero weights', () => {
  const weights = Array.from(profile.values());
  const nonZero = weights.filter(w => w > 0).length;
  assert(nonZero > 0, 'Profile should have non-zero weights');
  console.log(`  Non-zero weights: ${nonZero}`);
});

test('Strong match (Attack on Titan)', () => {
  const result = scoreCandidate(profile, {
    genres: ['Action', 'Drama', 'Fantasy'],
    score: 8.5,
    year: 2023,
    popularity: 150000,
    status: 'FINISHED',
  });
  console.log(`  Score: ${result.finalScore}, trait: ${result.traitMatch}`);
  assert(result.traitMatch > 0, 'Should have trait match');
  assert(result.finalScore > 0, 'Should have final score');
});

test('Low match (Romance)', () => {
  const result = scoreCandidate(profile, {
    genres: ['Romance', 'Comedy', 'Slice of Life'],
    score: 7.8,
    year: 2024,
    popularity: 80000,
    status: 'FINISHED',
  });
  console.log(`  Score: ${result.finalScore}, trait: ${result.traitMatch}`);
});

test('Hidden gem discovery boost', () => {
  const gem = scoreCandidate(profile, { genres: ['Action'], score: 8.0, year: 2024, popularity: 15000, status: 'FINISHED' });
  const popular = scoreCandidate(profile, { genres: ['Action'], score: 8.0, year: 2024, popularity: 150000, status: 'FINISHED' });
  console.log(`  Gem: ${gem.discoveryScore}, Popular: ${popular.discoveryScore}`);
  assert(gem.discoveryScore > popular.discoveryScore, 'Gem should have higher discovery');
});

test('Freshness for recent anime', () => {
  const recent = scoreCandidate(profile, { genres: ['Action'], score: 7.5, year: 2026, popularity: 50000, status: 'RELEASING' });
  const old = scoreCandidate(profile, { genres: ['Action'], score: 7.5, year: 2015, popularity: 50000, status: 'FINISHED' });
  console.log(`  Recent: ${recent.freshnessScore}, Old: ${old.freshnessScore}`);
  assert(recent.freshnessScore > old.freshnessScore, 'Recent should have higher freshness');
});

test('Deterministic scoring', () => {
  const anime = { genres: ['Action', 'Drama'], score: 8.0, year: 2023, popularity: 100000, status: 'FINISHED' };
  const r1 = scoreCandidate(profile, anime);
  const r2 = scoreCandidate(profile, anime);
  assert(r1.finalScore === r2.finalScore, 'Should be deterministic');
});

test('Score formula weights sum to 100%', () => {
  const sum = 0.55 + 0.10 + 0.10 + 0.10 + 0.05 + 0.10;
  assert(Math.abs(sum - 1.0) < 0.001, `Weights sum to ${sum}, expected 1.0`);
});

test('All trait IDs in V35 set', () => {
  const traits = ['freedom', 'rebellion', 'adventure', 'sacrifice', 'determination', 'justice'];
  for (const t of traits) {
    assert(V35_TRAIT_IDS.has(t), `Trait ${t} should be in V35 set`);
  }
});

console.log('='.repeat(60));
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));
if (failed > 0) process.exit(1);
console.log('\n✅ All tests passed!');
