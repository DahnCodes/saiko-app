// Simple test runner for the DNA system
// Run with: npx tsx scripts/test-dna.ts

import { calculateAnimeDNA, COMBINATION_TO_DNA, type AnimeDNA } from '../src/services/animeDNA.ts'
import type { Anime } from '../src/types/anime.ts'

const STARTER_IDS = ['naruto', 'one-piece', 'bleach', 'demon-slayer', 'mha', 'attack-on-titan']

const EXPECTED_NAMES: string[] = [
  'The Shonen Soul',
  'The Unbreakable Heart',
  'The Rising Hero',
  'The Freedom Seeker',
  'The Spirit Warrior',
  'The Relentless Protector',
  'The Dark Warrior',
  'The Hope Bringer',
  'The Survivor',
  'The Revolutionary Hero',
  'The Stylish Warrior',
  'The Power Chaser',
  'The World Explorer',
  'The Adventure Hero',
  'The Epic Wanderer',
  'The Rebel Dreamer',
  'The Determined Guardian',
  'The Tragic Warrior',
  'The Burdened Hero',
  'The Last Hope',
]

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]]
  if (k > arr.length) return []
  return arr.flatMap((v, i) =>
    combinations(arr.slice(i + 1), k - 1).map((rest) => [v, ...rest])
  )
}

function makeAnime(id: string): Anime {
  return {
    id,
    anilistId: 0,
    malId: null,
    title: id,
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
  }
}

let passed = 0
let failed = 0
let total = 0

function log(msg: string, ok: boolean) {
  total += 1
  if (ok) {
    passed += 1
  } else {
    failed += 1
  }
  console.log(`${ok ? '✓' : '✗'} ${msg}`)
}

console.log('='.repeat(60))
console.log('SAIKO Anime DNA Test Suite')
console.log('='.repeat(60))

const allCombos = combinations(STARTER_IDS, 3)
log(`20 valid 3-anime combinations exist (C(6,3) = ${allCombos.length})`, allCombos.length === 20)

let mapCount = 0
for (const combo of allCombos) {
  const sorted = [...combo].sort((a, b) => a.localeCompare(b)).join('-')
  if (COMBINATION_TO_DNA[sorted]) mapCount += 1
}
log(`All 20 combinations mapped in COMBINATION_TO_DNA`, mapCount === 20)

for (const combo of allCombos) {
  const sorted = [...combo].sort((a, b) => a.localeCompare(b)).join('-')
  const exists = COMBINATION_TO_DNA[sorted] !== undefined
  log(`Combination "${sorted}" is defined`, exists)
}

for (const combo of allCombos) {
  const anime1 = combo.map(makeAnime)
  const shuffled = [...combo].reverse()
  const anime2 = shuffled.map(makeAnime)
  const result1 = calculateAnimeDNA('user1', anime1)
  const result2 = calculateAnimeDNA('user2', anime2)
  log(`Order-independent: ${combo.join('+')} === ${shuffled.join('+')}`, result1.id === result2.id)
}

const seenIds = new Set<string>()
const seenNames = new Set<string>()
for (const combo of allCombos) {
  const anime = combo.map(makeAnime)
  const dna = calculateAnimeDNA('user', anime)
  log(`DNA for ${combo.join('+')} has exactly 6 traits`, dna.traits.length === 6)
  log(`DNA ID "${dna.id}" is unique`, !seenIds.has(dna.id))
  seenIds.add(dna.id)
  log(`DNA name "${dna.name}" is unique`, !seenNames.has(dna.name))
  seenNames.add(dna.name)
}

for (const combo of allCombos) {
  const anime = combo.map(makeAnime)
  const dna = calculateAnimeDNA('user', anime)
  const titles = dna.favoriteAnime.map((a) => a.id).sort()
  const expected = [...combo].sort()
  log(`Selected anime attached to DNA: ${combo.join('+')}`, JSON.stringify(titles) === JSON.stringify(expected))
}

for (const combo of allCombos) {
  const anime = combo.map(makeAnime)
  const dna = calculateAnimeDNA('user', anime)
  log(`DNA "${dna.name}" has a tagline`, dna.tagline.length > 0)
}

for (const expectedName of EXPECTED_NAMES) {
  const found = [...seenNames].some((name) => name === expectedName.toUpperCase())
  log(`Expected archetype "${expectedName}" is present`, found)
}

console.log('='.repeat(60))
console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed}`)
console.log('='.repeat(60))
if (failed === 0) {
  console.log('\n✅ All DNA tests passed!')
} else {
  console.log(`\n❌ ${failed} test(s) failed.`)
  process.exit(1)
}
