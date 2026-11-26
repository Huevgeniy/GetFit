/**
 * Числовые проверки геометрии онбординг-тура.
 * Запуск: npm run test:tour
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';

let failures = 0;
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' :: ' + extra : ''}`);
  if (!cond) failures += 1;
};

const root = process.cwd();
const outDir = path.join(root, '.tmp-tour');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
const outfile = path.join(outDir, 'tourGeometry.cjs');
buildSync({
  entryPoints: [path.join(root, 'src', 'lib', 'tourGeometry.ts')],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  outfile,
  logLevel: 'silent',
});

const require_ = createRequire(import.meta.url);
const {
  buildFocusRect,
  buildPanelRects,
  computeCardLayout,
  computeScrollTarget,
  FOCUS_PAD,
  CARD_GAP,
  SCREEN_MARGIN,
} = require_(outfile);

const vp = { width: 390, height: 740 };
const rect = (left, top, width, height) => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});
const approx = (value, expected, tolerance = 0.5) => Math.abs(value - expected) <= tolerance;

// 1. Рамка повторяет элемент + 6 px без кэпа высоты
const focus = buildFocusRect(rect(40, 100, 200, 300), vp);
check(
  'рамка = rect + 6 px',
  focus &&
    approx(focus.left, 34) &&
    approx(focus.top, 94) &&
    approx(focus.right, 246) &&
    approx(focus.bottom, 406) &&
    approx(focus.width, 212) &&
    approx(focus.height, 312),
  focus ? JSON.stringify(focus) : 'null',
);
check('отступ рамки равен 6 px', FOCUS_PAD === 6);

// 2. Высокая цель не обрезается «полоской»
const tall = buildFocusRect(rect(20, 10, 350, 700), vp);
check(
  'высокая цель: рамка по всей высоте, без кэпа',
  tall && approx(tall.top, 4) && approx(tall.bottom, 716) && approx(tall.height, 712),
  tall ? `${tall.top}..${tall.bottom} (${tall.height})` : 'null',
);

// 3. Клиппинг по краям вьюпорта
const clipped = buildFocusRect(rect(-20, -30, 500, 900), vp);
check(
  'рамка клиппится по краям экрана',
  clipped &&
    approx(clipped.left, 0) &&
    approx(clipped.top, 0) &&
    approx(clipped.right, 390) &&
    approx(clipped.bottom, 740),
  clipped ? JSON.stringify(clipped) : 'null',
);

// 4. Невалидные цели
check('нулевая цель не подсвечивается', buildFocusRect(rect(10, 10, 0, 20), vp) === null);
check(
  'цель за экраном не подсвечивается',
  buildFocusRect(rect(-200, 10, 50, 50), vp) === null,
);

// 5. Четыре панели примыкают к рамке без ореола
const panels = buildPanelRects(focus, vp);
check(
  'верхняя панель заканчивается на рамке',
  panels.top.top === 0 && approx(panels.top.height, focus.top),
);
check(
  'нижняя панель начинается от рамки',
  approx(panels.bottom.top, focus.bottom) &&
    approx(panels.bottom.height, vp.height - focus.bottom),
);
check(
  'левая панель занимает ровно левую полосу',
  approx(panels.left.width, focus.left) && approx(panels.left.height, focus.height),
);
check(
  'правая панель начинается от правого края рамки',
  approx(panels.right.left, focus.right) &&
    approx(panels.right.width, vp.width - focus.right),
);
check(
  'панели не перекрывают «дырку»',
  panels.top.height <= focus.top &&
    panels.bottom.top >= focus.bottom &&
    panels.left.width <= focus.left &&
    panels.right.left >= focus.right,
);

// 6. Карточка снизу, если есть место
const below = computeCardLayout({
  focus,
  viewport: vp,
  cardWidth: 336,
  cardHeight: 240,
  bottomInset: 60,
});
check(
  'карточка встаёт снизу от рамки',
  below.placement === 'below' &&
    approx(below.top, focus.bottom + CARD_GAP) &&
    below.top + below.height <= vp.height - 60 - SCREEN_MARGIN,
  JSON.stringify(below),
);
check('стрелка снизу смотрит вверх', below.arrow && below.arrow.side === 'top', below.arrow ? JSON.stringify(below.arrow) : 'null');

// 7. Карточка сверху, если снизу не влезает
const focusLow = buildFocusRect(rect(40, 520, 300, 120), vp);
const above = computeCardLayout({
  focus: focusLow,
  viewport: vp,
  cardWidth: 336,
  cardHeight: 240,
  bottomInset: 60,
});
check(
  'карточка встаёт сверху, если снизу мало места',
  above.placement === 'above' &&
    approx(above.top, focusLow.top - CARD_GAP - above.height),
  JSON.stringify(above),
);
check('стрелка сверху смотрит вниз', above.arrow && above.arrow.side === 'bottom');

// 8. Компактный режим, когда не влезает ни снизу, ни сверху
const focusTall = { left: 34, top: 100, right: 356, bottom: 640, width: 322, height: 540 };
const compact = computeCardLayout({
  focus: focusTall,
  viewport: vp,
  cardWidth: 336,
  cardHeight: 400,
  bottomInset: 60,
});
check('при нехватке места запрашивается компактная карточка', compact.needsCompact === true);
check(
  'краевая карточка не выходит за экран',
  compact.top >= SCREEN_MARGIN && compact.top + compact.height <= vp.height - 60 - SCREEN_MARGIN,
  JSON.stringify(compact),
);
const compactAgain = computeCardLayout({
  focus: focusTall,
  viewport: vp,
  cardWidth: 336,
  cardHeight: 260,
  bottomInset: 60,
  compact: true,
});
check('в компактном режиме повторного сжатия нет', compactAgain.needsCompact === false);

// 9. Центрирование без цели
const centered = computeCardLayout({
  focus: null,
  viewport: vp,
  cardWidth: 336,
  cardHeight: 240,
});
check(
  'без цели карточка по центру',
  centered.placement === 'center' &&
    approx(centered.left, (vp.width - 336) / 2) &&
    approx(centered.top, (vp.height - 240) / 2) &&
    centered.arrow === null,
);

// 10. Горизонтальный клампинг
const narrow = computeCardLayout({
  focus: { left: 0, top: 300, right: 20, bottom: 360, width: 20, height: 60 },
  viewport: vp,
  cardWidth: 336,
  cardHeight: 200,
});
check('карточка не вылезает влево', narrow.left >= SCREEN_MARGIN, String(narrow.left));
const narrowRight = computeCardLayout({
  focus: { left: 370, top: 300, right: 390, bottom: 360, width: 20, height: 60 },
  viewport: vp,
  cardWidth: 336,
  cardHeight: 200,
});
check(
  'карточка не вылезает вправо',
  narrowRight.left + narrowRight.width <= vp.width - SCREEN_MARGIN,
  `${narrowRight.left}+${narrowRight.width}`,
);

// 11. Прокрутка: цель под шапкой
const scrollBelow = computeScrollTarget({
  rect: { top: 300, height: 100 },
  viewport: vp,
  headerHeight: 82,
  bottomInset: 60,
  cardHeight: 220,
  scrollY: 0,
  scrollHeight: 2000,
});
check(
  'цель ставится под шапку, когда это достижимо',
  scrollBelow && scrollBelow.mode === 'below' && scrollBelow.scrollTop === 208,
  scrollBelow ? JSON.stringify(scrollBelow) : 'null',
);

// 12. Конец документа: выбирается «сверху», а не недостижимое «под шапкой»
const scrollAbove = computeScrollTarget({
  rect: { top: 620, height: 100 },
  viewport: vp,
  headerHeight: 82,
  bottomInset: 60,
  cardHeight: 220,
  scrollY: 1260,
  scrollHeight: 2200,
});
check(
  'в конце документа переключается на карточку сверху',
  scrollAbove && scrollAbove.mode === 'above' && scrollAbove.scrollTop === 1310,
  scrollAbove ? JSON.stringify(scrollAbove) : 'null',
);

// 13. Недостижимое положение не применяется
const unreachable = computeScrollTarget({
  rect: { top: 640, height: 180 },
  viewport: vp,
  headerHeight: 82,
  bottomInset: 60,
  cardHeight: 260,
  scrollY: 1400,
  scrollHeight: 2200,
});
check('недостижимая прокрутка не выполняется', unreachable === null, JSON.stringify(unreachable));

// 14. Небольшой сдвиг не дёргает страницу
const noScroll = computeScrollTarget({
  rect: { top: 92, height: 100 },
  viewport: vp,
  headerHeight: 82,
  bottomInset: 60,
  cardHeight: 220,
  scrollY: 0,
  scrollHeight: 2000,
});
check('сдвиг меньше 3 px игнорируется', noScroll === null);

// 15. Маленький экран 320×568
const small = { width: 320, height: 568 };
const smallFocus = buildFocusRect(rect(8, 120, 304, 200), small);
const smallCard = computeCardLayout({
  focus: smallFocus,
  viewport: small,
  cardWidth: 300,
  cardHeight: 260,
  bottomInset: 58,
});
check(
  '320×568: карточка целиком в экране',
  smallCard.left >= SCREEN_MARGIN &&
    smallCard.left + smallCard.width <= small.width - SCREEN_MARGIN &&
    smallCard.top >= SCREEN_MARGIN &&
    smallCard.top + smallCard.height <= small.height - 58 - SCREEN_MARGIN,
  JSON.stringify(smallCard),
);

// 16. Конфигурация туров: размещение разделов и существование целей
const toursOutfile = path.join(outDir, 'tours.cjs');
buildSync({
  entryPoints: [path.join(root, 'src', 'lib', 'tours.ts')],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  outfile: toursOutfile,
  logLevel: 'silent',
});
const {
  buildMainTourSteps,
  buildSectionTour,
  SECTION_TOUR_IDS,
} = require_(toursOutfile);

const flags = (enabled = []) => ({
  marathons: enabled.includes('marathons'),
  battles: enabled.includes('battles'),
  discipline: enabled.includes('discipline'),
  ranks: enabled.includes('ranks'),
  lab: enabled.includes('lab'),
  periodization: enabled.includes('periodization'),
  body: enabled.includes('body'),
});
const placementOf = (steps) =>
  steps.find((step) => step.id === 'optional-sections' || step.id === 'optional-off');

const noSections = placementOf(buildMainTourSteps(flags()));
check(
  'без дополнительных разделов тур ведёт в настройки профиля',
  noSections && noSections.id === 'optional-off' && noSections.tab === 'profile' &&
    noSections.target === '#feature-settings',
  JSON.stringify(noSections),
);

const onlyMarathons = placementOf(buildMainTourSteps(flags(['marathons'])));
check(
  'только марафоны: подсвечивается вкладка «Тренировки»',
  onlyMarathons && onlyMarathons.tab === 'workouts' &&
    onlyMarathons.target === '#tour-tab-workouts',
  JSON.stringify(onlyMarathons),
);

const onlyBattlePlacement = placementOf(buildMainTourSteps(flags(['battles'])));
check(
  'только зарубы: подсвечивается их вкладка внизу',
  onlyBattlePlacement && onlyBattlePlacement.tab === 'battles' &&
    onlyBattlePlacement.target === '#tour-tab-battles',
  JSON.stringify(onlyBattlePlacement),
);

const marathonsAndBattles = placementOf(buildMainTourSteps(flags(['marathons', 'battles'])));
check(
  'марафоны + зарубы: подсвечивается вкладка заруб',
  marathonsAndBattles && marathonsAndBattles.target === '#tour-tab-battles' &&
    marathonsAndBattles.bullets.some((line) => line.includes('Марафоны целей')),
  JSON.stringify(marathonsAndBattles),
);

const marathonsAndDiscipline = placementOf(buildMainTourSteps(flags(['marathons', 'discipline'])));
check(
  'марафоны + дисциплина: подсвечивается вкладка дисциплины',
  marathonsAndDiscipline && marathonsAndDiscipline.tab === 'discipline' &&
    marathonsAndDiscipline.target === '#tour-tab-discipline' &&
    marathonsAndDiscipline.bullets.some((line) => line.includes('Марафоны целей')),
  JSON.stringify(marathonsAndDiscipline),
);

const manySections = placementOf(
  buildMainTourSteps(flags(['marathons', 'battles', 'discipline', 'lab'])),
);
check(
  'несколько разделов: подсвечивается кнопка «Ещё»',
  manySections && manySections.target === '#tour-tab-more' && !manySections.tab &&
    manySections.bullets.some((line) => line.includes('Лаборатория')) &&
    manySections.bullets.some((line) => line.includes('Зарубы')),
  JSON.stringify(manySections),
);

const onlyBody = placementOf(buildMainTourSteps(flags(['body'])));
check(
  'только тело: раздел уходит под «Ещё»',
  onlyBody && onlyBody.target === '#tour-tab-more' && !onlyBody.tab &&
    onlyBody.bullets.some((line) => line.includes('Тело и биомеханика') && line.includes('«Ещё»')),
  JSON.stringify(onlyBody),
);

const bodyAndLab = placementOf(buildMainTourSteps(flags(['body', 'lab'])));
check(
  'тело и лаборатория: оба раздела под «Ещё»',
  bodyAndLab && bodyAndLab.target === '#tour-tab-more' &&
    bodyAndLab.bullets.some((line) => line.includes('Тело и биомеханика')) &&
    bodyAndLab.bullets.some((line) => line.includes('Лаборатория')),
  JSON.stringify(bodyAndLab),
);

const allSteps = SECTION_TOUR_IDS.flatMap((id) => buildSectionTour(id));
const sectionIds = allSteps.map((step) => step.id);
check(
  'у каждого дополнительного раздела есть свой тур из трёх шагов',
  SECTION_TOUR_IDS.every((id) => buildSectionTour(id).length >= 3),
  JSON.stringify(SECTION_TOUR_IDS.map((id) => [id, buildSectionTour(id).length])),
);
check(
  'шаги всех туров имеют уникальные id',
  new Set([...buildMainTourSteps(flags()).map((step) => step.id), ...sectionIds]).size ===
    buildMainTourSteps(flags()).length + sectionIds.length,
);

const sourceFiles = fs
  .readdirSync(path.join(root, 'src'), { recursive: true })
  .filter((file) => typeof file === 'string' && file.endsWith('.tsx'))
  .map((file) => fs.readFileSync(path.join(root, 'src', file), 'utf-8'))
  .join('\n');
const allTours = [
  buildMainTourSteps(flags()),
  buildMainTourSteps(flags(['marathons', 'battles', 'discipline', 'ranks', 'lab', 'periodization'])),
  ...SECTION_TOUR_IDS.map((id) => buildSectionTour(id)),
];
const selectors = new Set();
for (const step of allTours.flat()) {
  if (typeof step.target === 'string' && step.target.startsWith('#')) {
    selectors.add(step.target);
  }
  if (step.prepare) {
    const text = step.prepare.toString();
    for (const match of text.matchAll(/#[a-zA-Z0-9_-]+/g)) selectors.add(match[0]);
  }
}
const missing = [...selectors].filter((selector) => !sourceFiles.includes(selector.slice(1)));
check(
  'все цели и кнопки туров существуют в разметке',
  missing.length === 0,
  missing.join(', '),
);

fs.rmSync(outDir, { recursive: true, force: true });
console.log(`\n${failures === 0 ? 'ГЕОМЕТРИЯ ТУРА ПРОХОДИТ' : `ПРОВАЛОВ: ${failures}`}`);
process.exit(failures === 0 ? 0 : 1);
