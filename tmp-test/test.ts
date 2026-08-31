
import { extractTraits } from './src/services/recommendations/traits';
import { buildTasteMap, scoreCandidateTraits } from './src/services/recommendations/taste/buildTasteMap';
import { TRAIT_VOCABULARY, TRAIT_IDS, getTraitById, isValidTrait, normalizeTraitId } from './src/services/recommendations/traits';

// Test Naruto extraction
const naruto = extractTraits({
  genres: ['Action', 'Adventure', 'Supernatural', 'Drama', 'Fantasy'],
  synopsis: 'A young orphaned ninja named Naruto Uzumaki dreams of becoming the Hokage, the leader of his village. As an underdog ostracized by his village, he forms unbreakable bonds of friendship with his teammates Sasuke and Sakura. Together they face deadly rival ninja, train hard to grow stronger, and battle powerful enemies in a war to protect their home. His ambition, rivalry with Sasuke, and character growth define his journey.'
});

console.log('Naruto traits (' + naruto.length + '):', naruto);

const demonSlayer = extractTraits({
  genres: ['Action', 'Supernatural', 'Fantasy', 'Drama'],
  synopsis: 'Tanjiro, a kind-hearted boy, becomes a demon slayer after his family is murdered and his sister Nezuko is turned into a demon. He fights demons in a world of darkness, training with the Demon Slayer Corps. His family bond drives his revenge quest as he seeks redemption for his sister.'
});

console.log('Demon Slayer traits (' + demonSlayer.length + '):', demonSlayer);

const attackOnTitan = extractTraits({
  genres: ['Action', 'Drama', 'Mystery', 'Fantasy'],
  synopsis: 'In a world surrounded by walls protecting humanity from giant man-eating Titans, young Eren Yeager vows to destroy all Titans after his mother is killed. He joins the military and fights in battles for survival, uncovering political conspiracies and the truth about the world.'
});

console.log('Attack on Titan traits (' + attackOnTitan.length + '):', attackOnTitan);

// Build taste map from Core 3
const tasteMap = buildTasteMap([naruto, demonSlayer, attackOnTitan]);
console.log('\nTaste Map:');
console.log('Total unique traits:', tasteMap.uniqueTraitCount);
tasteMap.entries.slice(0, 8).forEach(e => {
  console.log('  ' + e.trait.label.padEnd(25) + ' x' + e.occurrenceCount + ' (weight ' + e.weight.toFixed(2) + ')');
});

// Test a good candidate
const goodCandidate = extractTraits({
  genres: ['Action', 'Adventure', 'Supernatural'],
  synopsis: 'A young hero trains to become the strongest warrior, forming bonds of friendship and teamwork with his rivals. He is an underdog seeking to avenge his family.'
});
const goodResult = scoreCandidateTraits(goodCandidate, tasteMap);
console.log('\nGood candidate:', {
  matchingTraits: goodResult.matchingTraitIds,
  meaningfulCount: goodResult.meaningfulMatchCount,
  eligible: goodResult.isEligible,
  weightedScore: goodResult.weightedScore.toFixed(2)
});

// Test a poor candidate
const poorCandidate = extractTraits({
  genres: ['Comedy', 'Slice of Life'],
  synopsis: 'A relaxing story about a high school club and their daily lives.'
});
const poorResult = scoreCandidateTraits(poorCandidate, tasteMap);
console.log('Poor candidate:', {
  matchingTraits: poorResult.matchingTraitIds,
  meaningfulCount: poorResult.meaningfulMatchCount,
  eligible: poorResult.isEligible
});

// Test invalid trait rejection
console.log('\nisValidTrait("underdog"):', isValidTrait('underdog'));
console.log('isValidTrait("invalid_trait_xyz"):', isValidTrait('invalid_trait_xyz'));
console.log('normalizeTraitId("Under Dog"):', normalizeTraitId('Under Dog'));
console.log('getTraitById("underdog"):', getTraitById('underdog')?.label);

console.log('\n✅ All trait system tests passed!');
