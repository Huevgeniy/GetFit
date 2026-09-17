/**
 * 1RM (One Rep Max) and Repetition Equivalency Engine
 */

export interface OneRepMaxCalculations {
  weight: number;
  reps: number;
  epley: number;
  brzycki: number;
  lander: number;
  lombardi: number;
  oconner: number;
  honestConsensus: number;
  percentages: {
    percentage: number;
    weight: number;
    targetReps: number;
  }[];
}

/**
 * Calculates 1RM across standard strength equations and honest consensus
 */
export function calculateOneRepMax(weight: number, reps: number): OneRepMaxCalculations {
  if (weight <= 0 || reps <= 0) {
    return {
      weight: 0,
      reps: 0,
      epley: 0,
      brzycki: 0,
      lander: 0,
      lombardi: 0,
      oconner: 0,
      honestConsensus: 0,
      percentages: [],
    };
  }

  if (reps === 1) {
    const percentages = generatePercentages(weight);
    return {
      weight,
      reps,
      epley: weight,
      brzycki: weight,
      lander: weight,
      lombardi: weight,
      oconner: weight,
      honestConsensus: weight,
      percentages,
    };
  }

  // Standard Epley formula
  const epley = weight * (1 + reps / 30);

  // Brzycki formula (clamped for reps >= 37 to avoid division by zero)
  const brzycki = reps < 37 ? weight * (36 / (37 - reps)) : epley;

  // Lander formula
  const lander = (100 * weight) / (101.3 - 2.67123 * reps);

  // Lombardi formula
  const lombardi = weight * Math.pow(reps, 0.1);

  // O'Conner formula
  const oconner = weight * (1 + 0.025 * reps);

  // Honest consensus:
  // For powerlifters, Brzycki and Epley are most accurate under 10 reps.
  // For higher reps (10-20), we damp slightly to prevent unrealistic 1RM inflation.
  let honestConsensus: number;
  if (reps <= 5) {
    honestConsensus = (epley * 0.45 + brzycki * 0.45 + lander * 0.1);
  } else if (reps <= 10) {
    honestConsensus = (epley * 0.5 + brzycki * 0.35 + lander * 0.15);
  } else {
    // High-rep damping: endurance doesn't linearly translate to 1RM
    const fatigueFactor = Math.max(0.85, 1 - (reps - 10) * 0.015);
    honestConsensus = ((epley + brzycki) / 2) * fatigueFactor;
  }

  const roundedHonest = Math.round(honestConsensus * 10) / 10;
  const percentages = generatePercentages(roundedHonest);

  return {
    weight,
    reps,
    epley: Math.round(epley * 10) / 10,
    brzycki: Math.round(brzycki * 10) / 10,
    lander: Math.round(lander * 10) / 10,
    lombardi: Math.round(lombardi * 10) / 10,
    oconner: Math.round(oconner * 10) / 10,
    honestConsensus: roundedHonest,
    percentages,
  };
}

/**
 * Calculates how many reps the athlete could perform at a normalized target weight
 * based on an achieved weight and reps.
 * e.g., 105 kg x 9 reps -> equivalent reps at 100 kg base = ~10.95 reps
 */
export function calculateNormalizedReps(
  performedWeight: number,
  performedReps: number,
  targetBaseWeight: number = 100
): number {
  if (performedWeight <= 0 || performedReps <= 0 || targetBaseWeight <= 0) return 0;
  
  const estimated1RM = calculateOneRepMax(performedWeight, performedReps).honestConsensus;
  
  if (targetBaseWeight >= estimated1RM) {
    // Can only do 0 or 1 rep if base weight equals or exceeds 1RM
    return targetBaseWeight === estimated1RM ? 1 : 0;
  }

  // Inverted Epley: 1RM = W * (1 + R / 30) => R = 30 * (1RM / W - 1)
  const equivalentReps = 30 * (estimated1RM / targetBaseWeight - 1);
  return Math.max(0, Math.round(equivalentReps * 10) / 10);
}

/**
 * Generate percentage training loads based on 1RM
 */
function generatePercentages(oneRepMax: number) {
  const steps = [
    { percentage: 100, targetReps: 1 },
    { percentage: 95, targetReps: 2 },
    { percentage: 90, targetReps: 4 },
    { percentage: 85, targetReps: 6 },
    { percentage: 80, targetReps: 8 },
    { percentage: 75, targetReps: 10 },
    { percentage: 70, targetReps: 12 },
    { percentage: 65, targetReps: 15 },
  ];

  return steps.map(s => ({
    percentage: s.percentage,
    weight: Math.round((oneRepMax * (s.percentage / 100)) * 2) / 2, // round to 0.5 kg
    targetReps: s.targetReps,
  }));
}
