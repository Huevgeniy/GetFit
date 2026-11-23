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
try {
  await act(async () => {
    root = createRoot(container);
    root.render(
      React.createElement(NutritionComponent, {
        user,
        dailyRecords: [],
        onUpdateDailyRecords: noop,
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
      }),
    );
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

console.log(failures === 0 ? '\nФИЛЬТР ПРОДУКТОВ РАБОТАЕТ' : `\nПРОВАЛОВ: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
