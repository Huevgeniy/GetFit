/**
 * Извлечение числовых показателей InBody из текста.
 *
 * Зачем отдельный модуль: языковая модель склонна «досчитывать» правдоподобные
 * значения (в проверке «жир 15.1» превращался в 18.8%). Числа, которые человек
 * указал явно, разбираем детерминированно и перекрываем ими ответ модели.
 *
 * Важно: \w в JavaScript не матчит кириллицу, поэтому везде [\p{L}] с флагом u.
 */

export interface InBodyNumbers {
  weightKg?: number;
  skeletalMuscleMassKg?: number;
  bodyFatMassKg?: number;
  bodyFatPercent?: number;
  totalBodyWaterL?: number;
  proteinKg?: number;
  mineralsKg?: number;
  visceralFatLevel?: number;
  bmrKcal?: number;
  inBodyScore?: number;
}

const NUM = '(\\d{1,4}(?:[.,]\\d{1,2})?)';
const GAP = '[^\\d]{0,16}';
const UNIT_AFTER = /^\s*(?:кг|kg|%|процент)/i;

const toNumber = (raw: string | undefined): number | undefined => {
  if (!raw) return undefined;
  const value = Number(raw.replace(',', '.'));
  return Number.isFinite(value) ? value : undefined;
};

const inRange = (value: number | undefined, min: number, max: number): number | undefined =>
  value !== undefined && value >= min && value <= max ? value : undefined;

/** Первое число после ключевого слова. */
function afterKeyword(text: string, keyword: string, min: number, max: number): number | undefined {
  const re = new RegExp(`(?:${keyword})${GAP}${NUM}`, 'iu');
  return inRange(toNumber(re.exec(text)?.[1]), min, max);
}

/** Число, после которого стоит единица измерения (кг / % / л). */
function withUnit(text: string, keyword: string, unitPattern: string, min: number, max: number): number | undefined {
  const re = new RegExp(`(?:${keyword})${GAP}${NUM}\\s*(?:${unitPattern})`, 'iu');
  return inRange(toNumber(re.exec(text)?.[1]), min, max);
}

/** Процент жира и масса жира — их легко перепутать, поэтому разбираем вместе. */
function resolveFat(text: string): { percent?: number; mass?: number } {
  const percentByWord = inRange(
    toNumber(new RegExp(`(?:процент[\\p{L}]*\\s*жира|pbf|body\\s*fat(?:\\s*percent)?|%\\s*жира)${GAP}${NUM}`, 'iu').exec(text)?.[1]),
    3,
    60,
  );

  const massByWord =
    withUnit(text, 'масса\\s*жира|жирова[\\p{L}]*\\s*масса|масс[\\p{L}]*\\s*жира|fat\\s*mass', 'кг|kg', 1, 120) ??
    afterKeyword(text, 'масса\\s*жира|fat\\s*mass', 1, 120);

  // Все упоминания «жир …»: единица измерения подсказывает, процент это или масса
  const bare = new RegExp(`(?:^|[^\\p{L}])жир[\\p{L}]*${GAP}${NUM}(\\s*(?:кг|kg|%|процент))?`, 'giu');
  let barePercent: number | undefined;
  let bareMass: number | undefined;
  for (const match of text.matchAll(bare)) {
    const value = toNumber(match[1]);
    if (value === undefined) continue;
    const unit = (match[2] || '').toLowerCase();
    if (unit.includes('%') || unit.includes('процент')) {
      if (barePercent === undefined && value >= 3 && value <= 60) barePercent = value;
    } else if (unit.includes('кг') || unit.includes('kg')) {
      if (bareMass === undefined && value >= 1 && value <= 120) bareMass = value;
    } else if (barePercent === undefined && value >= 3 && value <= 60) {
      barePercent = value;
    } else if (bareMass === undefined && value > 60 && value <= 120) {
      bareMass = value;
    }
  }

  const result: { percent?: number; mass?: number } = {};
  const percent = percentByWord ?? barePercent;
  if (percent !== undefined) result.percent = percent;
  const mass = massByWord ?? bareMass;
  if (mass !== undefined) result.mass = mass;
  return result;
}

export function extractInBodyNumbers(text: string): InBodyNumbers {
  if (!text || typeof text !== 'string') return {};
  const t = text.replace(/\u00a0/g, ' ');

  const fat = resolveFat(t);

  const result: InBodyNumbers = {
    weightKg: inRange(
      withUnit(t, 'вес(?:\\s*тела)?|масса\\s*тела|weight', 'кг|kg', 25, 300) ??
        afterKeyword(t, 'вес(?:\\s*тела)?|масса\\s*тела|weight', 25, 300),
      25,
      300,
    ),
    skeletalMuscleMassKg: inRange(
      withUnit(
        t,
        'скелетн[\\p{L}]*\\s*(?:мышечн[\\p{L}]*|мускулатур[\\p{L}]*)\\s*масс[\\p{L}]*|скелетн[\\p{L}]*\\s*мускулатур[\\p{L}]*|смм|smm|skeletal\\s*muscle\\s*mass',
        'кг|kg',
        5,
        90,
      ) ??
        afterKeyword(
          t,
          'скелетн[\\p{L}]*\\s*(?:мышечн[\\p{L}]*|мускулатур[\\p{L}]*)\\s*масс[\\p{L}]*|скелетн[\\p{L}]*\\s*мускулатур[\\p{L}]*|смм|smm|мускулатур[\\p{L}]*|мышц[\\p{L}]*|skeletal\\s*muscle\\s*mass',
          5,
          90,
        ),
      5,
      90,
    ),
    bodyFatPercent: fat.percent,
    bodyFatMassKg: fat.mass,
    totalBodyWaterL: inRange(
      afterKeyword(t, 'общ[\\p{L}]*\\s*вод[\\p{L}]*|вод[\\p{L}]*\\s*в\\s*организме|tbw|total\\s*body\\s*water', 10, 80),
      10,
      80,
    ),
    proteinKg: inRange(afterKeyword(t, 'белок|протеин|protein', 1, 40), 1, 40),
    mineralsKg: inRange(afterKeyword(t, 'минерал[\\p{L}]*|minerals?', 0.5, 15), 0.5, 15),
    visceralFatLevel: inRange(
      afterKeyword(t, 'висцеральн[\\p{L}]*\\s*жир[\\p{L}]*|visceral\\s*fat', 1, 20),
      1,
      20,
    ),
    bmrKcal: inRange(afterKeyword(t, 'базальн[\\p{L}]*\\s*метаболизм[\\p{L}]*|bmr|brm', 600, 5000), 600, 5000),
    inBodyScore: inRange(afterKeyword(t, 'оценка\\s*(?:inbody|тела)?|inbody\\s*score|балл[\\p{L}]*', 1, 100), 1, 100),
  };

  for (const key of Object.keys(result) as (keyof InBodyNumbers)[]) {
    if (result[key] === undefined || Number.isNaN(result[key] as number)) delete result[key];
  }
  return result;
}
