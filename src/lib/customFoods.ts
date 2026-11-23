import type { FoodItem } from '../types';

const FOOD_CATEGORIES = new Set<FoodItem['category']>([
  'meat',
  'dairy',
  'grains',
  'fruits',
  'vegetables',
  'oils_nuts',
  'custom',
]);

const normalizeFoodName = (value: string): string =>
  String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .trim();

const positive = (value: unknown, fallback = 0): number => {
  const parsed = typeof value === 'number' ? value : Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/**
 * Приводит список своих продуктов к безопасному виду.
 *
 * Раньше `customFoods` по умолчанию заполнялся базой продуктов, из-за чего
 * база попадала в облако и затем склеивалась с базой ещё раз. Дубли одинаковых
 * id ломали React-список: фильтр по категориям визуально «не срабатывал».
 * Здесь убираем базовые продукты, повторы по id/названию и мусор из старых версий.
 */
export function sanitizeCustomFoods(
  raw: unknown,
  baseFoods: readonly FoodItem[] = [],
): FoodItem[] {
  if (!Array.isArray(raw)) return [];

  const baseIds = new Set(baseFoods.map((food) => food.id));
  const baseNames = new Set(baseFoods.map((food) => normalizeFoodName(food.name)));
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const result: FoodItem[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;

    const item = entry as Partial<FoodItem>;
    const name = String(item.name || '').trim().slice(0, 120);
    if (!name) continue;

    const nameKey = normalizeFoodName(name);
    if (!nameKey || baseNames.has(nameKey)) continue;

    const id = String(item.id || '').trim() || `custom_${nameKey.replace(/\s+/g, '_')}`;
    if (baseIds.has(id) || seenIds.has(id) || seenNames.has(nameKey)) continue;

    const category = FOOD_CATEGORIES.has(item.category as FoodItem['category'])
      ? (item.category as FoodItem['category'])
      : 'custom';
    const defaultGrams = positive(item.defaultGrams, 0);

    seenIds.add(id);
    seenNames.add(nameKey);
    result.push({
      id,
      name,
      category,
      caloriesPer100g: positive(item.caloriesPer100g),
      proteinPer100g: Math.round(positive(item.proteinPer100g) * 10) / 10,
      fatPer100g: Math.round(positive(item.fatPer100g) * 10) / 10,
      carbsPer100g: Math.round(positive(item.carbsPer100g) * 10) / 10,
      fiberPer100g: Math.round(positive(item.fiberPer100g) * 10) / 10,
      userAdded: true,
      ...(positive(item.timesLogged, 0) > 0
        ? { timesLogged: Math.round(positive(item.timesLogged, 1)) }
        : {}),
      ...(defaultGrams > 0 ? { defaultGrams: Math.min(5000, Math.round(defaultGrams)) } : {}),
    });
  }

  return result;
}
