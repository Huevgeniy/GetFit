import type { UserProfile } from '../types';

export interface NutritionTargets {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
  proteinPerKg: number;
  bmr: number;
  maintenanceCalories: number;
  activityFactor: number;
  goalMultiplier: number;
  goalLabel: string;
  customCalories: boolean;
  customProtein: boolean;
  customFat: boolean;
  customCarbs: boolean;
}

const ACTIVITY_FACTORS: Record<NonNullable<UserProfile['activityLevel']>, number> = {
  sedentary: 1.2,
  moderate: 1.375,
  active: 1.55,
  very_active: 1.725,
};

/**
 * Норма питания: BMR по Миффлину — Сан Жеору, поправка на активность,
 * затем цель по весу. Ручные цели важнее расчётных.
 */
export function calculateNutritionTargets(user: UserProfile): NutritionTargets {
  const weight = user.currentWeight > 0 ? user.currentWeight : 75;
  const height = user.heightCm && user.heightCm > 0 ? user.heightCm : 175;
  const age = user.age && user.age > 0 ? user.age : 30;
  const goal = user.weightGoalType || 'maintain';

  const baseMetabolism =
    10 * weight + 6.25 * height - 5 * age + (user.gender === 'female' ? -161 : 5);

  const activityFactor = ACTIVITY_FACTORS[user.activityLevel || 'moderate'] ?? 1.375;
  const maintenanceCalories = Math.round(baseMetabolism * activityFactor);

  let calories = maintenanceCalories;
  let proteinPerKg = 1.8;
  let fatPerKg = 1.0;
  let fiberTarget = 30;

  if (goal === 'gain') {
    calories = Math.round(maintenanceCalories * 1.12);
    proteinPerKg = 1.8;
    fatPerKg = 1.1;
    fiberTarget = 28;
  } else if (goal === 'lose') {
    calories = Math.round(maintenanceCalories * 0.82);
    proteinPerKg = 2.2;
    fatPerKg = 0.8;
    fiberTarget = 35;
  } else if (goal === 'recomp') {
    calories = Math.round(maintenanceCalories * 0.95);
    proteinPerKg = 2.4;
    fatPerKg = 0.9;
    fiberTarget = 32;
  }

  const targetProtein = user.customProteinTarget || Math.round(weight * proteinPerKg);
  const targetFat = user.customFatTarget || Math.round(weight * fatPerKg);
  // Свои калории тоже должны сходиться с БЖУ: остаток считаем от итоговой цели.
  const effectiveCalories = user.customCalorieTarget || calories;
  const remainingCalories = effectiveCalories - (targetProtein * 4 + targetFat * 9);
  const targetCarbs =
    user.customCarbsTarget || Math.max(80, Math.round(remainingCalories / 4));

  const goalMultiplier =
    goal === 'gain' ? 1.12 : goal === 'lose' ? 0.82 : goal === 'recomp' ? 0.95 : 1;
  const goalLabel =
    goal === 'gain'
      ? 'Набор веса'
      : goal === 'lose'
        ? 'Снижение веса'
        : goal === 'recomp'
          ? 'Перестройка тела'
          : 'Поддержание веса';

  return {
    calories: effectiveCalories,
    protein: targetProtein,
    fat: targetFat,
    carbs: targetCarbs,
    fiber: user.customFiberTarget || fiberTarget,
    proteinPerKg,
    bmr: Math.round(baseMetabolism),
    maintenanceCalories,
    activityFactor,
    goalMultiplier,
    goalLabel,
    customCalories: Boolean(user.customCalorieTarget),
    customProtein: Boolean(user.customProteinTarget),
    customFat: Boolean(user.customFatTarget),
    customCarbs: Boolean(user.customCarbsTarget),
  };
}
