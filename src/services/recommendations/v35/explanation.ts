/**
 * Deterministic Recommendation Explanation Generator
 */

import { V35_TRAIT_BY_ID } from './vocabulary';

interface ExplanationResult {
  shortReason: string;
  fullReason: string;
  topTraits: string[];
}

const TRAIT_TEMPLATES: Record<string, { high: string[]; medium: string[] }> = {
  freedom: {
    high: [
      "Your DNA leans heavily toward {trait} and {t2} — this anime speaks the same language.",
      "Breaking free from chains, cages, or duty is in your blood.",
    ],
    medium: ["A sense of {trait} runs through this one."],
  },
  rebellion: {
    high: [
      "You love stories about {trait} and fighting against the system — this delivers.",
    ],
    medium: ["A rebellious spirit runs through this anime."],
  },
  adventure: {
    high: [
      "You crave {trait}, {t2}, and discovery — this one's a journey worth taking.",
    ],
    medium: ["A sense of {trait} and exploration here."],
  },
  determination: {
    high: [
      "You love characters who {trait} and never give up — this anime has that in spades.",
    ],
    medium: ["A {trait} theme that resonates with your taste."],
  },
  sacrifice: {
    high: [
      "Stories about {trait} and courage in the face of impossible odds hit differently for you.",
    ],
    medium: ["Moments of {trait} here will likely move you."],
  },
  growth: {
    high: [
      "You love watching characters grow and discover who they are — this one has that in abundance.",
    ],
    medium: ["A satisfying journey of {trait} here."],
  },
  friendship: {
    high: [
      "Strong bonds and {trait} are at the heart of what you love — this anime has that warmth.",
    ],
    medium: ["Some warm {trait} moments here."],
  },
  hope: {
    high: [
      "You love stories that balance darkness with {trait} — this one finds that balance.",
    ],
    medium: ["A hopeful note that resonates with your taste."],
  },
  strategy: {
    high: [
      "Clever tactics and {trait} — this one rewards viewers who think.",
    ],
    medium: ["Some tactical thinking here."],
  },
  darkness: {
    high: [
      "You appreciate stories with real weight and {trait} — this one has it.",
    ],
    medium: ["A {trait} undercurrent here."],
  },
  mystery: {
    high: [
      "Hidden truths and {trait} — you love uncovering the unknown.",
    ],
    medium: ["Some intriguing {trait} elements here."],
  },
  exploration: {
    high: [
      "Discovering new worlds and {t2} — this is right in your wheelhouse.",
    ],
    medium: ["A sense of {trait} and discovery here."],
  },
  loyalty: {
    high: [
      "Characters who stay true to their bonds and {trait} — this one has that.",
    ],
    medium: ["A note of {trait} here."],
  },
  competition: {
    high: [
      "Proving yourself against rivals with {trait} — this anime is built for that.",
    ],
    medium: ["Some {trait} elements here."],
  },
  resilience: {
    high: [
      "Characters who endure, break, and rebuild — your DNA loves this.",
    ],
    medium: ["A note of {trait} here."],
  },
  self_discovery: {
    high: [
      "Learning who you truly are — your DNA connects with this deeply.",
    ],
    medium: ["Some {trait} elements here."],
  },
  world_building: {
    high: [
      "Rich worlds with depth and {trait} — your DNA loves this.",
    ],
    medium: ["An interesting world here."],
  },
  creativity: {
    high: [
      "Inventive, original storytelling — your DNA loves this.",
    ],
    medium: ["Some creative elements here."],
  },
  intensity: {
    high: [
      "High stakes and relentless energy — your DNA craves this.",
    ],
    medium: ["Some intense moments here."],
  },
  leadership: {
    high: [
      "Characters who inspire and command — this resonates with your DNA.",
    ],
    medium: ["A note of {trait} here."],
  },
};

const GENERIC_TEMPLATES = [
  "This anime shares meaningful traits with your favorites.",
  "A strong match for your anime DNA.",
  "You'll likely appreciate what this one has to offer.",
  "An anime that aligns well with your taste.",
];

function getLabel(traitId: string): string {
  return V35_TRAIT_BY_ID.get(traitId)?.label ?? traitId;
}

function pickTemplate(traitId: string, isHighScore: boolean): string {
  const templates = TRAIT_TEMPLATES[traitId];
  if (templates) {
    const pool = isHighScore ? templates.high : templates.medium;
    return pool[traitId.length % pool.length];
  }
  return GENERIC_TEMPLATES[traitId.length % GENERIC_TEMPLATES.length];
}

export function generateExplanation(params: {
  matchedTraits: string[];
  traitScore: number;
  genreScore: number;
}): ExplanationResult {
  const { matchedTraits, traitScore, genreScore } = params;

  const topTraits = matchedTraits.slice(0, 4);

  if (topTraits.length === 0) {
    return {
      shortReason: "An anime that aligns with your taste.",
      fullReason: "This one shares meaningful traits with the anime you love.",
      topTraits: [],
    };
  }

  const isHighMatch = traitScore >= 65;
  const primaryTrait = topTraits[0];
  const secondaryTrait = topTraits[1];

  let template = pickTemplate(primaryTrait, isHighMatch);

  const t1Label = getLabel(primaryTrait);
  const t2Label = secondaryTrait ? getLabel(secondaryTrait) : t1Label;

  template = template
    .replace('{trait}', t1Label)
    .replace('{t2}', t2Label);

  let fullReason = template;
  if (isHighMatch && genreScore < 40) {
    fullReason += " It's not an obvious genre match, but its themes strongly align with your DNA.";
  } else if (isHighMatch) {
    fullReason += " This is a strong match for your anime DNA.";
  } else {
    fullReason += " A solid choice that fits your taste profile.";
  }

  return {
    shortReason: template,
    fullReason,
    topTraits,
  };
}
