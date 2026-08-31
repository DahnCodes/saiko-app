import { supabase } from '../../../lib/supabase';
import { getAnimeById, getStarterAnimeById, mapAnime } from '../../animeService';
import { getOrExtractTraitProfiles, getOrExtractTraitProfile } from '../traits/traitCache';
import { buildUserTraitProfile } from '../taste/userTraitProfile';
import { scoreAnimeAgainstProfile, type CandidateScore } from './scoreAnimeAgainstProfile';
import { generateExplanation, shortReasonFromMatches } from './generateExplanation';
import { extractTraitProfile } from '../traits/traitExtractor';
import type { Anime } from '../../../types/anime';

export interface TraitRecommendation {
  anime: Anime;
  matchScore: number;
  matchPercent: number;
  meaningfulMatchCount: number;
  shortReason: string;
  fullExplanation: string;
  topMatchingTraits: Array<{ trait: string; label: string; userWeight: number; animeStrength: number }>;
}

export interface TraitRecOptions {
  limit?: number;
  minMatchScore?: number;
  forceRefresh?: boolean;
}

function clamp(v: number, min = 0, max = 1) { return Math.max(min, Math.min(max, v)); }

function computeQuality(anime: Anime): number {
  return clamp((anime.score ?? 0) / 10, 0, 1);
}

function computeFreshness(anime: Anime): number {
  const currentYear = new Date().getFullYear();
  if (anime.status === 'RELEASING') return 1.0;
  if (!anime.year) return 0.4;
  const age = currentYear - anime.year;
  if (age === 0) return 0.9;
  if (age === 1) return 0.7;
  if (age === 2) return 0.5;
  if (age <= 4) return 0.3;
  return 0.1;
}

function computeDiscovery(anime: Anime): number {
  const pop = anime.popularity ?? 50000;
  if (pop < 5000) return 1.0;
  if (pop < 20000) return 0.8;
  if (pop < 50000) return 0.6;
  if (pop < 100000) return 0.4;
  if (pop < 200000) return 0.2;
  return 0.05;
}

async function fetchCandidatesLean(limit = 300): Promise<Anime[]> {
  if (!supabase) throw new Error('Supabase not configured');

  // Focus on recent anime (2024+) to keep recommendations fresh and relevant.
  // Year filter is applied first, then quality/popularity gate.
  const { data, error } = await supabase
    .from('anime')
    .select('*')
    .gte('season_year', 2024)
    .or('average_score.gte.60,popularity.gte.10000')
    .order('average_score', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) throw error;
  if (!data?.length) return [];

  return (data as any[]).map(mapAnime);
}

export async function getTraitBasedRecommendations(
  userId: string,
  options: TraitRecOptions = {},
): Promise<TraitRecommendation[]> {
  const { limit = 12 } = options;

  if (!supabase) throw new Error('Recommendation service not configured');

  // 1. Load user's favorite anime (3 selected from the 6 onboarding options)
  //    These are the anime the user explicitly chose to define their taste.
  const { data: favoriteRows, error: favError } = await supabase
    .from('user_favorite_anime')
    .select('anime_id')
    .eq('user_id', userId);

  if (favError) throw favError;
  if (!favoriteRows?.length) return [];

  const favoriteIds: string[] = (favoriteRows as Array<{ anime_id: string }>).map((r) => r.anime_id);

  const coreAnime = await Promise.all(
    favoriteIds.map((id: string) => getAnimeById(id).catch(() => null))
  );
  const validCoreAnime = coreAnime.filter((a): a is Anime => a !== null);

  if (!validCoreAnime.length) return [];

  console.log('[getTraitBasedRecommendations] userId:', userId);
  console.log('[getTraitBasedRecommendations] Core 3:', validCoreAnime.map((a) => a.title));

  // 2. Extract trait profiles for Core 3
  const coreTraitProfiles = await Promise.all(
    validCoreAnime.map((anime) => getOrExtractTraitProfile(anime))
  );

  for (let i = 0; i < validCoreAnime.length; i++) {
    console.log(`  ${validCoreAnime[i].title}: ${coreTraitProfiles[i].length} traits`);
  }

  // 3. Build User Trait Profile
  const userProfile = buildUserTraitProfile({
    coreAnimeTraitProfiles: coreTraitProfiles,
  });

  console.log('[getTraitBasedRecommendations] User profile:', userProfile.uniqueTraitCount, 'unique traits');
  console.log('  Top 5 traits:', userProfile.topTraits.slice(0, 5).map((t) => `${t.trait.label}(${t.weight.toFixed(2)})`).join(', '));

  // 4. Build the exclusion set:
  //    - userFavorites: the 3 anime the user picked during onboarding
  //    - onboardingIds: ALL 6 starter anime (Naruto, Bleach, One Piece,
  //      Demon Slayer, Attack on Titan, My Hero Academia), including the 3
  //      the user didn't pick. We exclude the full set so users never see
  //      the onboarding options repeated in their recommendations.
  const starterAnime = await getStarterAnimeById();
  const onboardingIds = new Set(starterAnime.map((a) => a.id));
  const userFavoriteIds = new Set(validCoreAnime.map((a) => a.id));
  const allExcluded = new Set([...userFavoriteIds, ...onboardingIds]);
  console.log('[getTraitBasedRecommendations] Excluding', allExcluded.size, 'anime (', userFavoriteIds.size, 'user picks +', onboardingIds.size, 'onboarding options)');

  // 5. Fetch candidates
  let candidates = await fetchCandidatesLean(300);
  console.log('[getTraitBasedRecommendations] Candidates fetched:', candidates.length);

  // 6. Exclude Core 3 + onboarding
  candidates = candidates.filter((a) => !allExcluded.has(a.id));
  console.log('[getTraitBasedRecommendations] After exclusion:', candidates.length, 'candidates');

  if (!candidates.length) return [];

  // 7 & 8. Extract trait profiles and score ALL candidates
  // Key fix: extract ALL profiles first, then score. Don't skip scoring.
  const traitProfiles = await getOrExtractTraitProfiles(candidates);
  console.log('[getTraitBasedRecommendations] Trait profiles extracted:', traitProfiles.size);

  const scored: Array<{
    anime: Anime;
    candidateScore: CandidateScore;
    compositeScore: number;
    traitScore: number;      // raw trait contribution (user-specific)
    qualityScore: number;    // quality 0-1
    freshnessScore: number; // freshness 0-1
    discoveryScore: number; // discovery 0-1
  }> = [];

  for (const anime of candidates) {
    let profile = traitProfiles.get(anime.id);

    // If no profile cached, extract on the spot
    if (!profile || profile.length === 0) {
      profile = extractTraitProfile({
        genres: anime.genres ?? [],
        synopsis: anime.synopsis,
        skipSynopsis: false,
      });
    }

    // Skip candidates with zero traits
    if (!profile || profile.length === 0) continue;

    // Score against the user profile
    const candidateScoreRaw = scoreAnimeAgainstProfile(profile, userProfile);
    const candidateScore = { ...candidateScoreRaw, animeId: anime.id };

    // SAIKO TIER-BASED RANKING
    //
    // Problem with blended scoring: quality/freshness are global signals that swamp
    // user-specific trait match. Action fans all get the same top-scoring action anime.
    //
    // New approach:
    //   1. tierScore = trait match signal (primary gate, dominant weight)
    //   2. subTierScore = quality + freshness (secondary tiebreaker only)
    //   3. discoveryBonus = rewards less-popular anime (keeps things fresh)
    //
    // traitScore is Σ(userWeight × animeStrength). This is user-specific:
    // User A who loves "isekai + tournament + power_progression" gets high traitScore
    // on "Mushoku Tensei". User B who loves "slice_of_life + romance + wholesome"
    // gets low traitScore on the same anime. Quality score is identical for both.
    //
    const traitScore = candidateScoreRaw.weightedScore; // raw sum, user-specific
    const qualityScore = computeQuality(anime);
    const freshnessScore = computeFreshness(anime);
    const discoveryScore = computeDiscovery(anime);

    // SAIKO TRAIT-DOMINANT SCORING
    //
    // Trait match is THE primary signal. Quality/freshness are small tiebreakers
    // that only matter when trait scores are within 10% of each other.
    //
    // Why this matters: a User A who loves tournament+power_progression+rivalry
    // should get a completely different top-12 than User B who loves isekai+reincarnation,
    // even if both picked "action" as their core genre. Old scoring blended equally
    // with quality, so both users got the same top-rated action anime.
    //
    // New weights:
    //   traitScore  × 1.0    (dominant, scales with user-specific overlap)
    //   quality     × 0.05   (5% weight — pure tiebreaker, never elevates low-trait anime)
    //   freshness   × 0.02   (2% weight — slight recency preference)
    //   discovery   × 0.02   (2% weight — slight preference for less-popular)
    //
    // A typical top trait-matched candidate scores ~3-4 in trait points.
    // 0.05 * quality_max (1.0) = 0.05, so a perfect-quality match can only contribute
    // ~1.5% of what a single strong trait match contributes. Quality can NEVER push
    // a low-trait anime into the top tier.
    const compositeScore =
      traitScore * 1.0 +
      qualityScore * 0.05 +
      freshnessScore * 0.02 +
      discoveryScore * 0.02;

    scored.push({
      anime,
      candidateScore,
      compositeScore,
      traitScore,
      qualityScore,
      freshnessScore,
      discoveryScore,
    });
  }

  console.log('[getTraitBasedRecommendations] Scored candidates:', scored.length);
  if (scored.length > 0) {
    const top3 = scored.slice(0, 3);
    console.log('  Top 3 by raw score:', top3.map(s =>
      `${s.anime.title}: trait=${s.traitScore.toFixed(2)}, composite=${s.compositeScore.toFixed(2)}`
    ).join(' | '));
  }
  console.log('  Genre buckets:', Array.from(new Set(scored.slice(0, 30).map(s => s.anime.genres?.[0] ?? '?')).values()).join(', '));

  if (scored.length === 0) {
    // True fallback — don't just sort by quality, shuffle a bit per user
    const shuffled = [...candidates].sort(() => {
      const seed = userId.charCodeAt(0) + userId.charCodeAt(userId.length - 1);
      return (seed % 5) - 2;
    });
    const fallback = shuffled
      .filter((a) => (a.score ?? 0) >= 7.0)
      .slice(0, limit);

    return fallback.map((anime) => ({
      anime,
      matchScore: 0,
      matchPercent: 0,
      meaningfulMatchCount: 0,
      shortReason: 'A highly rated discovery worth exploring',
      fullExplanation: `${anime.title} is a strong-rated anime that may align with your tastes.`,
      topMatchingTraits: [],
    }));
  }

  // Sort by composite score descending (trait score is dominant component)
  scored.sort((a, b) => b.compositeScore - a.compositeScore);

  // DIVERSITY-ENFORCED SELECTION
  //
  // After sorting, the top items will cluster around the same sub-genre (e.g., all
  // action+adventure+shonen for an action fan). We use a round-robin "genre bucket"
  // selection to ensure variety: each user gets a mix of trait-aligned anime across
  // different primary genres instead of 12 nearly-identical top-rated action shows.
  //
  // HARD THRESHOLD: candidates with trait score < 20% of the best trait score are
  // excluded entirely. This prevents low-match but high-quality anime (e.g., a 9.0
  // action show) from being chosen just because it's popular. SAIKO only recommends
  // anime that actually align with the user's deep trait profile.
  const maxTrait = Math.max(...scored.map(s => s.traitScore), 0.0001);
  const traitThreshold = maxTrait * 0.20; // candidates below 20% of best are excluded
  const traitEligible = scored.filter(s => s.traitScore >= traitThreshold);

  const topPool = traitEligible.slice(0, Math.max(limit * 3, 50));

  // Group by primary genre
  const buckets = new Map<string, typeof scored>();
  for (const s of topPool) {
    const primaryGenre = (s.anime.genres?.[0] ?? 'Unknown');
    const list = buckets.get(primaryGenre) ?? [];
    list.push(s);
    buckets.set(primaryGenre, list);
  }

  // Sort buckets by their best candidate's composite score (strongest first)
  const sortedBuckets = Array.from(buckets.entries())
    .map(([genre, items]) => ({
      genre,
      items: items.sort((a, b) => b.compositeScore - a.compositeScore),
    }))
    .sort((a, b) => b.items[0].compositeScore - a.items[0].compositeScore);

  // Round-robin pick: take one from each bucket in order
  const diverselySelected: typeof scored = [];
  let bucketIndex = 0;
  while (diverselySelected.length < limit) {
    let addedThisRound = 0;
    for (const bucket of sortedBuckets) {
      if (diverselySelected.length >= limit) break;
      if (bucket.items.length > 0) {
        diverselySelected.push(bucket.items.shift()!);
        addedThisRound++;
      }
    }
    if (addedThisRound === 0) break; // all buckets empty
    bucketIndex++;
  }

  // If we still have room, fill from the trait-eligible pool (NOT all candidates)
  if (diverselySelected.length < limit) {
    const selectedIds = new Set(diverselySelected.map(s => s.anime.id));
    for (const s of traitEligible) {
      if (diverselySelected.length >= limit) break;
      if (!selectedIds.has(s.anime.id)) diverselySelected.push(s);
    }
  }

  // Use user-specific normalization: divide by sum of all user trait weights
  // (the max possible contribution), so each user gets a meaningful spread
  // rather than all users compressed to 0-100% from the same global max.
  const recommendations: TraitRecommendation[] = diverselySelected.slice(0, limit).map(({ anime, candidateScore }) => {
    // matchScore is already normalized against maxPossible in scoreAnimeAgainstProfile
    // Blend it with the raw top-3 contribution for better differentiation
    const topTraitContrib = candidateScore.topMatchingTraits
      .slice(0, 3)
      .reduce((s, t) => s + t.contribution, 0);
    const matchPercent = Math.round(clamp(candidateScore.matchScore * 0.7 + clamp(topTraitContrib, 0, 1) * 0.3, 0, 1) * 100);
    const explanation = generateExplanation(candidateScore, anime.title);
    const shortReason = shortReasonFromMatches(candidateScore.topMatchingTraits, explanation.shortReason);

    return {
      anime,
      matchScore: candidateScore.matchScore,
      matchPercent,
      meaningfulMatchCount: candidateScore.meaningfulMatchCount,
      shortReason,
      fullExplanation: explanation.fullExplanation,
      topMatchingTraits: explanation.topMatchingTraits.map((t) => ({
        trait: t.trait.id,
        label: t.trait.label,
        userWeight: t.userWeight,
        animeStrength: t.animeStrength,
      })),
    };
  });

  console.log('[getTraitBasedRecommendations] Returning:', recommendations.length);
  console.log('  Top rec:', recommendations[0]?.anime.title, '- match:', recommendations[0]?.matchPercent, '%');
  return recommendations;
}

export async function debugTraitRecommendations(userId: string) {
  if (!supabase) throw new Error('Supabase not configured');

  const { data: favoriteRows } = await supabase
    .from('user_favorite_anime')
    .select('anime_id')
    .eq('user_id', userId);

  const favoriteIds: string[] = ((favoriteRows as Array<{ anime_id: string }>) ?? []).map((r) => r.anime_id);

  const coreAnime = await Promise.all(
    favoriteIds.map((id: string) => getAnimeById(id).catch(() => null))
  );
  const validCoreAnime = coreAnime.filter((a): a is Anime => a !== null);

  const coreTraitProfiles = await Promise.all(
    validCoreAnime.map((anime) => getOrExtractTraitProfile(anime))
  );

  const userProfile = buildUserTraitProfile({
    coreAnimeTraitProfiles: coreTraitProfiles,
  });

  return {
    userId,
    coreAnime: validCoreAnime.map((a, i) => ({
      id: a.id,
      title: a.title,
      genres: a.genres,
      synopsis: a.synopsis?.slice(0, 100),
      traitProfile: coreTraitProfiles[i],
    })),
    userProfile: {
      coreCount: userProfile.coreCount,
      uniqueTraitCount: userProfile.uniqueTraitCount,
      topTraits: userProfile.topTraits.map((t) => ({
        traitId: t.traitId,
        label: t.trait.label,
        weight: t.weight,
        occurrences: t.occurrenceCount,
      })),
    },
  };
}
