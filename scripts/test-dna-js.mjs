// JS test runner for the DNA system using anilist IDs
// Order: 20 < 21 < 269 < 16498 < 21459 < 101922

const COMBINATION_TO_DNA = {
  // C(6,3) = 20 combinations
  '20-21-269': { name: 'The Shonen Soul', traits: 6 },
  '20-21-16498': { name: 'The Freedom Seeker', traits: 6 },
  '20-21-21459': { name: 'The Rising Hero', traits: 6 },
  '20-21-101922': { name: 'The Unbreakable Heart', traits: 6 },
  '20-269-16498': { name: 'The Dark Warrior', traits: 6 },
  '20-269-21459': { name: 'The Relentless Protector', traits: 6 },
  '20-269-101922': { name: 'The Spirit Warrior', traits: 6 },
  '20-16498-21459': { name: 'The Revolutionary Hero', traits: 6 },
  '20-16498-101922': { name: 'The Survivor', traits: 6 },
  '20-21459-101922': { name: 'The Hope Bringer', traits: 6 },
  '21-269-16498': { name: 'The World Explorer', traits: 6 },
  '21-269-21459': { name: 'The Power Chaser', traits: 6 },
  '21-269-101922': { name: 'The Stylish Warrior', traits: 6 },
  '21-16498-21459': { name: 'The Rebel Dreamer', traits: 6 },
  '21-16498-101922': { name: 'The Epic Wanderer', traits: 6 },
  '21-21459-101922': { name: 'The Adventure Hero', traits: 6 },
  '269-16498-21459': { name: 'The Burdened Hero', traits: 6 },
  '269-16498-101922': { name: 'The Tragic Warrior', traits: 6 },
  '269-21459-101922': { name: 'The Determined Guardian', traits: 6 },
  '16498-21459-101922': { name: 'The Last Hope', traits: 6 },
}

const STARTER_ANILIST_IDS = [20, 269, 21, 101922, 16498, 21459]

function combinations(arr, k) {
  if (k === 0) return [[]]
  if (k > arr.length) return []
  return arr.flatMap((v, i) =>
    combinations(arr.slice(i + 1), k - 1).map((rest) => [v, ...rest])
  )
}

function calculateDNA(favorites) {
  const ids = favorites.map(a => a.anilistId).filter(id => typeof id === 'number' && id > 0)
  const sorted = [...ids].sort((a, b) => a - b)
  const key = sorted.join('-')
  return COMBINATION_TO_DNA[key] ?? null
}

let passed = 0
let failed = 0
let total = 0

function log(msg, ok) {
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

const allCombos = combinations(STARTER_ANILIST_IDS, 3)
log(`C(6,3) = ${allCombos.length} combinations`, allCombos.length === 20)

const mapKeys = Object.keys(COMBINATION_TO_DNA).sort()
const comboKeys = allCombos.map(c => [...c].sort((a,b) => a-b).join('-')).sort()

let matchCount = 0
for (const k of comboKeys) {
  if (mapKeys.includes(k)) matchCount++
}
log(`All 20 COMBINATION_TO_DNA keys match the C(6,3) combos`, matchCount === 20)

for (const combo of allCombos) {
  const sorted = [...combo].sort((a, b) => a - b).join('-')
  const exists = COMBINATION_TO_DNA[sorted] !== undefined
  if (!exists) console.log(`  Missing key: ${sorted}`)
  log(`Combination "${sorted}" is defined`, exists)
}

for (const combo of allCombos) {
  const anime1 = combo.map(id => ({ anilistId: id }))
  const shuffled = [...combo].reverse()
  const anime2 = shuffled.map(id => ({ anilistId: id }))
  const result1 = calculateDNA(anime1)
  const result2 = calculateDNA(anime2)
  const ok = result1 !== null && result1.name === result2.name
  if (!ok) console.log(`  Order fail: ${combo.join('+')} -> ${result1?.name ?? 'null'}, ${shuffled.join('+')} -> ${result2?.name ?? 'null'}`)
  log(`Order-independent: ${combo.join('+')}`, ok)
}

const seenNames = new Set()
for (const combo of allCombos) {
  const anime = combo.map(id => ({ anilistId: id }))
  const dna = calculateDNA(anime)
  const ok1 = dna !== null
  const ok2 = dna?.traits === 6
  const ok3 = dna && !seenNames.has(dna.name)
  if (!ok1 || !ok2 || !ok3) console.log(`  DNA fail for ${combo.join('+')}: ${JSON.stringify(dna)}`)
  log(`DNA for ${combo.join('+')} is not null`, ok1)
  log(`DNA for ${combo.join('+')} has exactly 6 traits`, ok2)
  log(`DNA name "${dna?.name}" is unique`, ok3)
  if (dna) seenNames.add(dna.name)
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
