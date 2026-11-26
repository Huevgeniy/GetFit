import type { UserProfile } from '../types';

export interface NutritionTargets {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
  waterMl: number;
  waterFromFoodPercent: number;
  proteinPerKg: number;
  bmr: number;
  maintenanceCalories: number;
  activityFactor: number;
  activityLabel: string;
  goalMultiplier: number;
  goalLabel: string;
  customCalories: boolean;
  customProtein: boolean;
  customFat: boolean;
  customCarbs: boolean;
  customWater: boolean;
}

export type ActivityLevel = NonNullable<UserProfile['activityLevel']>;

export interface ActivityLevelMeta {
  id: ActivityLevel;
  label: string;
  factor: number;
  short: string;
  description: string;
  examples: string;
}

export const ACTIVITY_LEVELS: Record<ActivityLevel, ActivityLevelMeta> = {
  sedentary: {
    id: 'sedentary',
    label: 'Сидячий',
    factor: 1.2,
    short: 'мало движения',
    description:
      'Сидячая работа, меньше 5–7 тысяч шагов в день, тренировок нет или они редкие. Множитель 1,2.',
    examples: 'Офис/учёба, дорога на транспорте, вечером диван.',
  },
  moderate: {
    id: 'moderate',
    label: 'Умеренный',
    factor: 1.375,
    short: '3–4 тренировки в неделю',
    description:
      'Сидячая работа, но 3–4 тренировки в неделю или 7–10 тысяч шагов в день. Множитель 1,375.',
    examples: 'Зал 3–4 раза в неделю, обычная бытовая активность.',
  },
  active: {
    id: 'active',
    label: 'Высокий',
    factor: 1.55,
    short: '5–6 тренировок или физическая работа',
    description:
      '5–6 тренировок в неделю, физическая работа или 10–14 тысяч шагов в день. Множитель 1,55.',
    examples: 'Зал 5–6 раз, стройка/склад/курьерская работа.',
  },
  very_active: {
    id: 'very_active',
    label: 'Сверхвысокий',
    factor: 1.725,
    short: 'тяжёлые тренировки почти каждый день',
    description:
      'Тяжёлые тренировки 6–7 раз в неделю, две тренировки в день или очень тяжёлая физическая работа. Множитель 1,725.',
    examples: 'Спортсмен на сборах, работа грузчиком + зал, две тренировки в день.',
  },
};

const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: ACTIVITY_LEVELS.sedentary.factor,
  moderate: ACTIVITY_LEVELS.moderate.factor,
  active: ACTIVITY_LEVELS.active.factor,
  very_active: ACTIVITY_LEVELS.very_active.factor,
};

/**
 * Вода: ориентир по напиткам. Наука считает общую воду (напитки + еда),
 * поэтому цель в трекере ниже общей нормы примерно на 20%.
 * Считаются все безалкогольные напитки: вода, чай, кофе, молоко, соки,
 * спортивные напитки, супы. Алкоголь как гидратацию не засчитываем.
 */
function calculateWaterTarget(weight: number, activity: ActivityLevel): number {
  const base = weight * 30;
  const activityBonus =
    activity === 'active' ? 500 : activity === 'very_active' ? 750 : activity === 'moderate' ? 250 : 0;
  return Math.round(Math.max(1500, Math.min(4000, base + activityBonus)) / 50) * 50;
}


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

  const activity = user.activityLevel || 'moderate';
  const activityFactor = ACTIVITY_FACTORS[activity] ?? ACTIVITY_LEVELS.moderate.factor;
  const activityLabel = ACTIVITY_LEVELS[activity]?.label || ACTIVITY_LEVELS.moderate.label;
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
    waterMl: user.customWaterTarget || calculateWaterTarget(weight, activity),
    waterFromFoodPercent: 20,
    proteinPerKg,
    bmr: Math.round(baseMetabolism),
    maintenanceCalories,
    activityFactor,
    activityLabel,
    goalMultiplier,
    goalLabel,
    customCalories: Boolean(user.customCalorieTarget),
    customProtein: Boolean(user.customProteinTarget),
    customFat: Boolean(user.customFatTarget),
    customCarbs: Boolean(user.customCarbsTarget),
    customWater: Boolean(user.customWaterTarget),
  };
}
