/**
 * Test utility for the Anime DNA system.
 * Verifies that:
 *  - All 20 valid 3-anime combinations are mapped.
 *  - No combination produces undefined.
 *  - Selection order does not matter.
 *  - Every DNA has exactly 6 traits.
 *  - Every DNA has a unique ID and unique name.
 *  - Selected anime are attached to the generated DNA.
 */

import { calculateAnimeDNA, COMBINATION_TO_DNA, STARTER_ANILIST_IDS } from './animeDNA.ts'
import type { Anime } from '../types/anime.ts'

const STARTER_ANILIST_ID_LIST = [
  STARTER_ANILIST_IDS.NARUTO,
  STARTER_ANILIST_IDS.ONE_PIECE,
  STARTER_ANILIST_IDS.BLEACH,
  STARTER_ANILIST_IDS.DEMON_SLAYER,
  STARTER_ANILIST_IDS.MHA,
  STARTER_ANILIST_IDS.ATTACK_ON_TITAN,
]

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

function makeAnime(anilistId: number): Anime {
  return {
    id: `anime-${anilistId}`,
    anilistId,
    malId: null,
    title: `Anime ${anilistId}`,
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

export interface TestReport {
  total: number
  passed: number
  failed: number
  details: string[]
}

export function runDNATests(): TestReport {
  const report: TestReport = { total: 0, passed: 0, failed: 0, details: [] }
  const log = (msg: string, ok: boolean) => {
    report.total += 1
    if (ok) {
      report.passed += 1
    } else {
      report.failed += 1
    }
    report.details.push(`${ok ? '✓' : '✗'} ${msg}`)
  }

  // 1. Verify all 20 combinations exist in the map
  const allCombos = combinations(STARTER_ANILIST_ID_LIST, 3)
  log(`20 valid 3-anime combinations exist (C(6,3) = ${allCombos.length})`, allCombos.length === 20)
  
  let mapCount = 0
  for (const combo of allCombos) {
    const sorted = [...combo].sort((a, b) => a - b).join('-')
    if (COMBINATION_TO_DNA[sorted]) mapCount += 1
  }
  log(`All 20 combinations mapped in COMBINATION_TO_DNA`, mapCount === 20)

  // 2. Verify no combination produces undefined
  for (const combo of allCombos) {
    const sorted = [...combo].sort((a, b) => a - b).join('-')
    const exists = COMBINATION_TO_DNA[sorted] !== undefined
    log(`Combination "${sorted}" is defined`, exists)
  }

  // 3. Verify order-independence: calculateAnimeDNA gives same result regardless of input order
  for (const combo of allCombos) {
    const anime1 = combo.map(makeAnime)
    const shuffled = [...combo].reverse()
    const anime2 = shuffled.map(makeAnime)
    const result1 = calculateAnimeDNA('user1', anime1)
    const result2 = calculateAnimeDNA('user2', anime2)
    log(`Order-independent: ${combo.join('+')} === ${shuffled.join('+')}`, result1.id === result2.id)
  }

  // 4. Every DNA has exactly 6 traits
  const seenIds = new Set<string>()
  const seenNames = new Set<string>()
  for (const combo of allCombos) {
    const anime = combo.map(makeAnime)
    const dna = calculateAnimeDNA('user', anime)
    log(`DNA for ${combo.join('+')} has exactly 6 traits`, dna.traits.length === 6)
    
    // 5. Every DNA has a unique ID
    log(`DNA ID "${dna.id}" is unique`, !seenIds.has(dna.id))
    seenIds.add(dna.id)

    // 6. Every DNA has a unique name
    log(`DNA name "${dna.name}" is unique`, !seenNames.has(dna.name))
    seenNames.add(dna.name)
  }

  // 7. Selected anime are attached to the generated DNA
  for (const combo of allCombos) {
    const anime = combo.map(makeAnime)
    const dna = calculateAnimeDNA('user', anime)
    const ids = dna.favoriteAnime.map((a) => a.anilistId).sort((a, b) => (a ?? 0) - (b ?? 0))
    const expected = [...combo].sort((a, b) => a - b)
    log(`Selected anime attached to DNA: ${combo.join('+')}`, JSON.stringify(ids) === JSON.stringify(expected))
  }

  // 8. Each DNA archetype has a non-empty tagline
  for (const combo of allCombos) {
    const anime = combo.map(makeAnime)
    const dna = calculateAnimeDNA('user', anime)
    log(`DNA "${dna.name}" has a tagline`, dna.tagline.length > 0)
  }

  // 9. Verify all 20 expected archetype names are represented
  for (const expectedName of EXPECTED_NAMES) {
    const found = [...seenNames].some((name) => name === expectedName.toUpperCase())
    log(`Expected archetype "${expectedName}" is present`, found)
  }

  return report
}

export function printTestReport(): void {
  const report = runDNATests()
  console.log('='.repeat(60))
  console.log('SAIKO Anime DNA Test Report')
  console.log('='.repeat(60))
  console.log(`Total assertions: ${report.total}`)
  console.log(`Passed: ${report.passed}`)
  console.log(`Failed: ${report.failed}`)
  console.log('='.repeat(60))
  for (const line of report.details) {
    console.log(line)
  }
  if (report.failed === 0) {
    console.log('\n✅ All DNA tests passed!')
  } else {
    console.log(`\n❌ ${report.failed} test(s) failed.`)
  }
}
