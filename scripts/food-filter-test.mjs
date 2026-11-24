/**
 * Проверка фильтра категорий в списке продуктов.
 * Запуск: npm run test:foods
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';

let failures = 0;
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' :: ' + extra : ''}`);
  if (!cond) failures += 1;
};

const projectRoot = process.cwd();
const outDir = path.join(projectRoot, '.tmp-foodfilter');
fs.rmSync(outDir, { recursive: true, force: true });

execFileSync(
  process.execPath,
  [
    path.join(projectRoot, 'node_modules', 'typescript', 'bin', 'tsc'),
    '--outDir', outDir,
    '--module', 'commonjs',
    '--target', 'es2022',
    '--jsx', 'react-jsx',
    '--moduleResolution', 'node',
    '--esModuleInterop',
    '--skipLibCheck',
    '--lib', 'es2022,dom',
    '--rootDir', 'src',
    'src/components/NutritionSleepTracker.tsx',
  ],
  { stdio: 'inherit' },
);
fs.writeFileSync(path.join(outDir, 'package.json'), JSON.stringify({ type: 'commonjs' }), 'utf-8');

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'https://getfitbot.example.com/',
  pretendToBeVisual: true,
});
const { window } = dom;

const noop = () => undefined;
const define = (name, value) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
define('window', window);
define('document', window.document);
define('navigator', window.navigator);
define('localStorage', window.localStorage);
define('location', window.location);
globalThis.HTMLElement = window.HTMLElement;
globalThis.Element = window.Element;
globalThis.Node = window.Node;
globalThis.Event = window.Event;
globalThis.MouseEvent = window.MouseEvent;
globalThis.getComputedStyle = window.getComputedStyle.bind(window);
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
globalThis.matchMedia = () => ({ matches: false, addListener: noop, removeListener: noop, addEventListener: noop, removeEventListener: noop });
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } };
globalThis.scrollTo = noop;
globalThis.fetch = async () => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const require_ = createRequire(import.meta.url);
const React = require_('react');
const { createRoot } = require_('react-dom/client');
const { act } = React;
const Nutrition = require_(path.join(outDir, 'components', 'NutritionSleepTracker.js'));
const NutritionComponent = Nutrition.NutritionSleepTracker || Nutrition.default;

const user = {
  id: 'test',
  name: 'Тест',
  currentWeight: 80,
  targetWeight: 75,
  weightGoalType: 'maintain',
  dailyStepGoal: 10000,
  dailySteps: {},
  disciplineScore: 90,
  streakDays: 0,
  longestStreak: 0,
  selectedDisciplines: [],
  inBodyRecords: [],
};

const container = window.document.getElementById('root');
let renderError = null;
let root;
let dailyRecords = [];

const renderApp = () =>
  React.createElement(NutritionComponent, {
    user,
    dailyRecords,
    onUpdateDailyRecords: (records) => {
      dailyRecords = records;
    },
    sleepRecords: [],
    onUpdateSleepRecords: noop,
    pastWorkouts: [],
    onUpdateUser: noop,
    customFoods: [
      // Старые облачные данные могли содержать базовый продукт внутри customFoods.
      // Компонент обязан схлопнуть его по id/названию, иначе React-ключи ломают список.
      {
        id: 'food_chicken_breast',
        name: 'Куриное филе (грудка сырая)',
        category: 'meat',
        caloriesPer100g: 113,
        proteinPer100g: 23.6,
        fatPer100g: 1.9,
        carbsPer100g: 0.4,
        fiberPer100g: 0,
      },
      {
        id: 'custom_test_dish',
        name: 'Завтрак стандартный',
        category: 'custom',
        caloriesPer100g: 120,
        proteinPer100g: 7,
        fatPer100g: 4,
        carbsPer100g: 12,
        fiberPer100g: 1.6,
        defaultGrams: 500,
      },
    ],
    onSaveCustomFood: noop,
  });

try {
  await act(async () => {
    root = createRoot(container);
    root.render(renderApp());
  });
} catch (error) {
  renderError = error;
}
check('компонент питания рендерится', !renderError, renderError ? renderError.message : '');

const clickByText = async (text) => {
  const button = [...container.querySelectorAll('button')].find((el) => (el.textContent || '').includes(text));
  if (!button) return false;
  await act(async () => {
    button.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 60));
  });
  return true;
};

const opened = await clickByText('Внести блюдо или продукт в дневник');
check('окно добавления блюда открывается', opened && container.textContent.includes('Добавить блюдо в дневник'));

const setInputValue = async (input, value) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  await act(async () => {
    setter.call(input, String(value));
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
};

const findInput = (placeholderPart) =>
  [...container.querySelectorAll('input')].find((el) => (el.placeholder || '').includes(placeholderPart));

const clickFoodRow = async (name) => {
  const row = [...container.querySelectorAll('div.cursor-pointer')].find((el) =>
    (el.textContent || '').includes(name),
  );
  if (!row) return false;
  await act(async () => {
    row.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
  return true;
};

const productNames = () =>
  [...container.querySelectorAll('.font-bold')]
    .filter((el) => {
      const own = (el.textContent || '').trim();
      const parent = (el.parentElement?.textContent || '').trim();
      return own && !own.includes('ккал') && parent.includes('ккал • Б:');
    })
    .map((el) => (el.textContent || '').trim());

const initial = productNames();
check('в режиме «Все» видны продукты из разных категорий', initial.some((name) => name.includes('Куриное филе')) && initial.some((name) => name.includes('Творог')), JSON.stringify(initial.slice(0, 6)));
check('базовый продукт из старых customFoods не дублируется', initial.filter((name) => name.includes('Куриное филе')).length === 1, JSON.stringify(initial.filter((name) => name.includes('Куриное филе'))));
check('все названия в списке уникальны', initial.length === new Set(initial).size, `count=${initial.length}, unique=${new Set(initial).size}`);
check('сохранённое блюдо видно в «Все»', initial.some((name) => name.includes('Завтрак стандартный')), JSON.stringify(initial.slice(-4)));

await clickByText('Мясо/Птица/Яйца');
const meat = productNames();
check('категория «Мясо» показывает только мясо и яйца', meat.length > 0 && meat.every((name) => !name.includes('Творог') && !name.includes('Рис')), JSON.stringify(meat));

await clickByText('Молочка/Творог');
const dairy = productNames();
check('категория «Молочка» показывает только молочные продукты', dairy.length > 0 && dairy.every((name) => !name.includes('Куриное филе') && !name.includes('Говядина')), JSON.stringify(dairy));

await clickByText('Фрукты/Ягоды');
const fruits = productNames();
check('категория «Фрукты» показывает только фрукты', fruits.length > 0 && fruits.every((name) => !name.includes('Куриное филе') && !name.includes('Творог')), JSON.stringify(fruits));

await clickByText('Все');
const allAgain = productNames();
check('возврат в «Все» снова показывает все категории', allAgain.length === initial.length && allAgain.some((name) => name.includes('Куриное филе')) && allAgain.some((name) => name.includes('Творог')), JSON.stringify(allAgain.slice(0, 6)));

await clickByText('Мои продукты');
const customOnly = productNames();
check('категория «Мои продукты» показывает сохранённое блюдо', customOnly.some((name) => name.includes('Завтрак стандартный')) && customOnly.every((name) => !name.includes('Куриное филе') && !name.includes('Творог')), JSON.stringify(customOnly));

// --- Составной приём пищи: 100 г овсянки + 300 г молока + 150 г яиц ---
await clickByText('Собрать приём пищи');
check('режим сборки приёма пищи включается', container.textContent.includes('Состав (0)') || container.textContent.includes('итоговое КБЖУ посчитается автоматически'));

// После проверки категорий активна «Мои продукты» — для ингредиентов нужен общий список.
await clickByText('Все');

const nameInput = findInput('Например: Завтрак');
check('поле названия приёма пищи есть', Boolean(nameInput));
if (nameInput) await setInputValue(nameInput, 'Завтрак');

const ingredient = async (search, rowName) => {
  const searchInput = findInput('Найти ингредиент');
  if (!searchInput) return false;
  await setInputValue(searchInput, search);
  return clickFoodRow(rowName);
};

check('овсянка добавляется в состав', await ingredient('Овсяная', 'Овсяная каша'));
check('молоко добавляется в состав', await ingredient('Молоко коровье 2.5', 'Молоко коровье 2.5%'));
check('яйца добавляются в состав', await ingredient('Яйцо куриное', 'Яйцо куриное'));

const gramsInput = (name) =>
  [...container.querySelectorAll('input[aria-label]')].find(
    (el) => (el.getAttribute('aria-label') || '') === `Граммы: ${name}`,
  );

const milkGrams = gramsInput('Молоко коровье 2.5%');
const eggGrams = gramsInput('Яйцо куриное (C1 цельное)');
if (milkGrams) await setInputValue(milkGrams, 300);
if (eggGrams) await setInputValue(eggGrams, 150);

const totalsText = container.textContent;
check('состав показывает три ингредиента', container.textContent.includes('Состав (3)'));
check(
  'итоговое КБЖУ составного приёма считается верно',
  totalsText.includes('744 ккал') && totalsText.includes('Б 39.8 / Ж 31 / У 77') && totalsText.includes('клетчатка 10.6 г'),
);

await clickByText('Добавить приём в дневник');
const day = dailyRecords[0];
const meal = day?.meals?.[0];
check('составной приём добавлен одной записью', Boolean(day) && day.meals.length === 1, JSON.stringify(day?.meals?.map((m) => m.name)));
check('у записи три компонента', meal?.components?.length === 3, JSON.stringify(meal?.components?.map((c) => c.name)));
check(
  'КБЖУ приёма просуммировано в дневной итог',
  day?.totalCalories === 744 && day?.totalProtein === 39.8 && day?.totalFat === 31 && day?.totalCarbs === 77 && day?.totalFiber === 10.6,
  day ? `ккал=${day.totalCalories}, Б=${day.totalProtein}, Ж=${day.totalFat}, У=${day.totalCarbs}, клетчатка=${day.totalFiber}` : 'нет дня',
);

await act(async () => {
  root.render(renderApp());
});
await clickByText('Приемы пищи');
check('в дневнике появилась одна строка «Завтрак»', container.textContent.includes('Завтрак') && container.textContent.includes('744 ккал'));

const breakdownButton = [...container.querySelectorAll('button')].find((el) =>
  (el.textContent || '').includes('Состав (3)'),
);
check('у записи есть раскрываемый состав', Boolean(breakdownButton));
if (breakdownButton && breakdownButton.getAttribute('aria-expanded') !== 'true') {
  await act(async () => {
    breakdownButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
}
const diaryText = container.textContent;
check(
  'состав раскрывается с граммовками и БЖУ ингредиентов',
  diaryText.includes('Овсяная каша') && diaryText.includes('— 100 г') &&
    diaryText.includes('Молоко коровье 2.5%') && diaryText.includes('— 300 г') &&
    diaryText.includes('Яйцо куриное (C1 цельное)') && diaryText.includes('— 150 г'),
);

console.log(failures === 0 ? '\nФИЛЬТР ПРОДУКТОВ И СОСТАВНОЙ ПРИЁМ РАБОТАЮТ' : `\nПРОВАЛОВ: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
