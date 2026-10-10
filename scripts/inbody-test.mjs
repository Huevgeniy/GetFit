/**
 * Проверка разбора чисел InBody: явно указанные значения должны возвращаться
 * ровно как в тексте, без «досчитывания».
 * Запуск: npm run test:inbody
 */
const { extractInBodyNumbers } = await import('../server/inbody.ts');

let failures = 0;
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' :: ' + extra : ''}`);
  if (!cond) failures += 1;
};

// Именно этот случай сломался на живом сервере: жир 15.1 записался как 18.8
const userCase = extractInBodyNumbers('Вес 80.5, скелетная мускулатура 37.2, жир 15.1');
check('вес взят как есть', userCase.weightKg === 80.5, String(userCase.weightKg));
check('скелетная мускулатура как есть', userCase.skeletalMuscleMassKg === 37.2, String(userCase.skeletalMuscleMassKg));
check('процент жира НЕ пересчитывается', userCase.bodyFatPercent === 15.1, String(userCase.bodyFatPercent));

const full = extractInBodyNumbers(
  'InBody 770 от 12.03. Вес 82.4 кг, SMM 38.1 кг, масса жира 11.7 кг, процент жира 14.2 %, общая вода 53.5 л, белок 15.2 кг, минералы 3.4 кг, висцеральный жир 4, BMR 1850 ккал, оценка 85',
);
check('вес', full.weightKg === 82.4, String(full.weightKg));
check('SMM', full.skeletalMuscleMassKg === 38.1, String(full.skeletalMuscleMassKg));
check('масса жира', full.bodyFatMassKg === 11.7, String(full.bodyFatMassKg));
check('процент жира', full.bodyFatPercent === 14.2, String(full.bodyFatPercent));
check('вода', full.totalBodyWaterL === 53.5, String(full.totalBodyWaterL));
check('белок', full.proteinKg === 15.2, String(full.proteinKg));
check('минералы', full.mineralsKg === 3.4, String(full.mineralsKg));
check('висцеральный жир', full.visceralFatLevel === 4, String(full.visceralFatLevel));
check('BMR', full.bmrKcal === 1850, String(full.bmrKcal));
check('оценка', full.inBodyScore === 85, String(full.inBodyScore));

const commas = extractInBodyNumbers('вес 78,4; жир 12,5%; мышцы 36,8 кг');
check('запятая как десятичный разделитель', commas.weightKg === 78.4 && commas.bodyFatPercent === 12.5 && commas.skeletalMuscleMassKg === 36.8, JSON.stringify(commas));

const english = extractInBodyNumbers('Weight 90.2 kg, body fat 22%, SMM 35.4 kg, BMR 1900 kcal');
check('английские подписи', english.weightKg === 90.2 && english.bodyFatPercent === 22 && english.skeletalMuscleMassKg === 35.4, JSON.stringify(english));

const nothing = extractInBodyNumbers('просто заметка без чисел');
check('без чисел ничего не выдумывается', Object.keys(nothing).length === 0, JSON.stringify(nothing));

const impossible = extractInBodyNumbers('вес 999 кг, жир 150 %');
check('невозможные значения отброшены', impossible.weightKg === undefined && impossible.bodyFatPercent === undefined, JSON.stringify(impossible));

const abbreviations = extractInBodyNumbers('вес 82.4 кг, смм 38.1, процент жира 14.2 %');
check('сокращение «смм» распознано', abbreviations.skeletalMuscleMassKg === 38.1, JSON.stringify(abbreviations));

const proteinOnly = extractInBodyNumbers('белок 15.2');
check('частичные данные возвращаются частично', proteinOnly.proteinKg === 15.2 && proteinOnly.weightKg === undefined, JSON.stringify(proteinOnly));

console.log(`\n${failures === 0 ? 'РАЗБОР ЧИСЕЛ КОРРЕКТЕН' : `ПРОВАЛОВ: ${failures}`}`);
process.exit(failures === 0 ? 0 : 1);
