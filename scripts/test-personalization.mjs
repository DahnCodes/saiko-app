import assert from 'node:assert/strict'
import { loadModule } from './test-module-loader.mjs'
const { buildUserTasteProfile } = loadModule('src/services/tasteProfile.ts', { mocks: { '../lib/supabase.ts': { supabase: null } } })
const anime = (id, title, genres, synopsis) => ({ id, anilistId: Number(id), malId: null, title, nativeTitle: null, romajiTitle: null, englishTitle: title, synonyms: [], type: 'TV', episodes: 12, score: 8, synopsis, imageUrl: '', year: 2024, bannerImage: null, status: 'FINISHED', season: null, popularity: 1000, genres })
const core = [anime('20', 'Naruto', ['Action', 'Adventure'], 'A determined ninja grows through rivalry.'), anime('269', 'Bleach', ['Action', 'Supernatural'], 'A protector battles spirits.'), anime('101922', 'Demon Slayer', ['Action', 'Fantasy'], 'A determined family survives demons.')]
const userA = buildUserTasteProfile('a', core, [anime('100', 'Hunter x Hunter', ['Action', 'Adventure'], 'A young underdog enters a dangerous competition and explores the world.')], [{ characterId: 1, traits: [{ trait: 'strategist', confidence: 0.86, source: 'description' }], version: 1, generatedAt: '2026-01-01' }])
const userB = buildUserTasteProfile('b', core, [anime('101', 'Vinland Saga', ['Action', 'Drama', 'Historical'], 'A warrior seeks revenge amid political conflict and tragedy.')], [{ characterId: 2, traits: [{ trait: 'morally_gray', confidence: 0.86, source: 'description' }], version: 1, generatedAt: '2026-01-01' }])
assert.notDeepEqual(userA, userB)
assert.notEqual(userA.characterTraits[0]?.id, userB.characterTraits[0]?.id)
assert.notDeepEqual(userA.narrativeTraits.slice(0, 8).map(t => t.id), userB.narrativeTraits.slice(0, 8).map(t => t.id))
console.log('PASS same Core 3 profiles diverge on explicit anime and character favorites')

const characterEdges = {
  1: [{ role: 'MAIN', node: { id: 11, name: { full: 'Strategist' }, description: 'A brilliant strategist who plans every move.' } }],
  2: [{ role: 'MAIN', node: { id: 22, name: { full: 'Warrior' }, description: 'A morally gray anti-hero seeking revenge.' } }],
}
const affinity = loadModule('src/services/recommendations/v35/characterAffinity.ts', { mocks: {
  '../../characterProvider': { getNormalizedCharacters: async anime => ({ characters: (characterEdges[anime.anilistId] ?? []).map(edge => ({ id: `anilist:${edge.node.id}`, providerIds: { anilist: edge.node.id }, name: edge.node.name.full, description: edge.node.description, role: edge.role, source: 'anilist' })), provider: 'anilist', diagnostics: [] }) },
  '../../tasteProfile': { extractCharacterTraits: character => character.description.includes('strategist') ? [{ trait: 'strategist', confidence: 0.86, source: 'description' }] : [{ trait: 'morally_gray', confidence: 0.86, source: 'description' }], MIN_CHARACTER_TRAIT_CONFIDENCE: 0.7 },
} })
const candidate = id => ({ id: String(id), anilistId: id, title: String(id), genres: [], synopsis: null })
const strategistUser = [{ id: 'strategist', score: 1, confidence: 1, evidenceCount: 1 }]
const grayUser = [{ id: 'morally_gray', score: 1, confidence: 1, evidenceCount: 1 }]
const strategistScores = await Promise.all([1, 2].map(id => affinity.scoreCharacterAffinity(candidate(id), strategistUser)))
const grayScores = await Promise.all([1, 2].map(id => affinity.scoreCharacterAffinity(candidate(id), grayUser)))
assert(strategistScores[0].score > strategistScores[1].score)
assert(grayScores[1].score > grayScores[0].score)
console.log('PASS character affinity reranks the same candidate pool for different character preferences')

let jikanCalls = 0
const provider = loadModule('src/services/characterProvider.ts', {
  mocks: { './aniListService.ts': { getAnimeCharacters: async () => [{ role: 'MAIN', node: { id: 7, name: { full: 'A' }, image: { large: 'a' }, description: 'A strategist plans carefully.', favourites: 2 } }] } },
  globals: { fetch: async () => { jikanCalls += 1; return Response.json({ data: [] }) } },
})
const providerAnime = { id: 'anime', anilistId: 1, malId: 2, title: 'A', genres: [] }
const primary = await provider.getNormalizedCharacters(providerAnime)
assert.equal(primary.provider, 'anilist')
assert.equal(jikanCalls, 0)
const fallback = loadModule('src/services/characterProvider.ts', {
  mocks: { './aniListService.ts': { getAnimeCharacters: async () => { throw new Error('AniList down') } } },
  globals: { fetch: async url => { jikanCalls += 1; if (String(url).endsWith('/characters/7/full')) return Response.json({ data: { mal_id: 7, name: 'A', about: 'A strategist plans carefully.', favorites: 3 } }); return Response.json({ data: [{ character: { mal_id: 7, name: 'A', images: { jpg: { image_url: 'a' } } }, role: 'Main' }] }) } },
})
const secondary = await fallback.getNormalizedCharacters(providerAnime)
assert.equal(secondary.provider, 'jikan')
assert.equal(secondary.characters[0].providerIds.mal, 7)
assert.equal(provider.normalizeRole('supporting'), 'SUPPORTING')
const mergedProvider = loadModule('src/services/characterProvider.ts', {
  mocks: { './aniListService.ts': { getAnimeCharacters: async () => [{ role: 'MAIN', node: { id: 7, name: { full: 'A' }, description: undefined } }] } },
  globals: { fetch: async url => String(url).endsWith('/characters/7/full') ? Response.json({ data: { mal_id: 7, name: 'A', about: 'A strategist plans carefully.' } }) : Response.json({ data: [{ character: { mal_id: 7, name: 'A' }, role: 'Main' }] }) },
})
const merged = await mergedProvider.getNormalizedCharacters(providerAnime)
assert.equal(merged.characters.length, 1)
assert.equal(merged.provider, 'mixed')
console.log('PASS AniList primary and Jikan fallback provider behavior')

const negative = loadModule('src/services/negativeTasteProfile.ts', { mocks: {
  '../lib/supabase.ts': { supabase: null },
  './animeService.ts': {},
  './recommendations/v35/traitExtractor.ts': { extractAnimeTraitVector: ({ synopsis }) => synopsis?.includes('tragic') ? { tragic: 1 } : { action: 1 } },
} })
const rejected = id => ({ id: String(id), genres: [], synopsis: 'tragic story' })
const negativeProfile = negative.buildNegativeTasteProfile([rejected(1), rejected(2), rejected(3)])
assert(negativeProfile.narrativeTraits.some(trait => trait.id === 'tragic' && trait.evidenceCount === 3))
assert(negative.calculateNegativePenalty(rejected(4), negativeProfile) <= negative.MAX_NEGATIVE_PENALTY)
const single = negative.buildNegativeTasteProfile([rejected(1)])
assert.equal(negative.calculateNegativePenalty(rejected(4), single), 0)
console.log('PASS negative profile requires repeated evidence and caps candidate penalties')
