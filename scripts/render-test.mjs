/**
 * Рендер-проверка клиента: компилируем src через tsc (без спавна esbuild)
 * и отрисовываем приложение в react-dom/server. Ловит падения в разметке,
 * которые не видны ни типам, ни бандлеру.
 * Запуск: npm run test:render
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

let failures = 0;
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' :: ' + extra : ''}`);
  if (!cond) failures += 1;
};

const root = process.cwd();
const outDir = path.join(root, '.tmp-render');
fs.rmSync(outDir, { recursive: true, force: true });

execFileSync(
  process.execPath,
  [
    path.join(root, 'node_modules', 'typescript', 'bin', 'tsc'),
    '--outDir', outDir,
    '--module', 'commonjs',
    '--target', 'es2022',
    '--jsx', 'react-jsx',
    '--moduleResolution', 'node',
    '--esModuleInterop',
    '--skipLibCheck',
    '--lib', 'es2022,dom',
    '--rootDir', 'src',
    'src/App.tsx',
  ],
  { stdio: 'inherit' },
);
fs.writeFileSync(path.join(outDir, 'package.json'), JSON.stringify({ type: 'commonjs' }), 'utf-8');

// --- минимальные заглушки браузера ---
const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear(),
};

const noop = () => undefined;
const elementStub = () => ({
  style: {},
  setAttribute: noop,
  appendChild: noop,
  removeChild: noop,
  addEventListener: noop,
  removeEventListener: noop,
  getContext: () => null,
  select: noop,
  focus: noop,
});

globalThis.document = {
  createElement: elementStub,
  createElementNS: elementStub,
  createTextNode: () => ({}),
  documentElement: { style: { setProperty: noop, removeProperty: noop } },
  body: { appendChild: noop, removeChild: noop, style: {} },
  head: { appendChild: noop },
  addEventListener: noop,
  removeEventListener: noop,
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementById: () => null,
  hidden: false,
  visibilityState: 'visible',
};

// В Node 24 navigator/location объявлены только для чтения — задаём через defineProperty
const define = (name, value) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });

define('navigator', {
  userAgent: 'node-render-test',
  language: 'ru-RU',
  clipboard: { writeText: async () => undefined },
  vibrate: noop,
});
globalThis.window = globalThis;
define('location', { search: '', href: 'https://example.com/', hash: '', pathname: '/' });
globalThis.matchMedia = () => ({ matches: false, addListener: noop, removeListener: noop, addEventListener: noop, removeEventListener: noop });
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } };
globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });
globalThis.fetch = async () => new Response(JSON.stringify({ found: false }), { status: 200, headers: { 'Content-Type': 'application/json' } });

const require_ = createRequire(import.meta.url);
const React = require_('react');
const { renderToString } = require_(path.join(root, 'node_modules', 'react-dom', 'server.js'));

let html = '';
let renderError = null;
try {
  const App = require_(path.join(outDir, 'App.js'));
  const AppComponent = App.default || App;
  html = renderToString(React.createElement(AppComponent));
} catch (err) {
  renderError = err;
}

check('приложение рендерится без исключений', !renderError, renderError ? `${renderError.message}` : `${(html.length / 1024).toFixed(1)} КБ HTML`);
if (renderError) {
  console.log(renderError.stack?.split('\n').slice(0, 8).join('\n'));
}

if (html) {
  // Проверяем, что отрисовался настоящий интерфейс, а не пустой каркас
  for (const [name, needle] of [
    ['заголовок GetFitBot', 'GetFitBot'],
    ['вкладка «Тренировки»', 'Тренировки'],
    ['вкладка «Питание/Сон»', 'Питание'],
    ['вкладка «Профиль»', 'Профиль'],
    ['индикатор дисциплины', 'Дисциплина'],
    ['MINI APP бейдж', 'MINI APP'],
  ]) {
    check(`в разметке есть ${name}`, html.includes(needle));
  }
  check('нет незакрытых React-ошибок в разметке', !/data-reactroot.*error/i.test(html));
}

// --- Каждый экран по отдельности: ловим падения на вкладках, которые не открывались ---
const userStub = {
  id: 'u1',
  name: 'Тест',
  telegramUsername: '@test',
  currentWeight: 80,
  targetWeight: 78,
  weightGoalType: 'maintain',
  stepGoalEnabled: true,
  dailyStepGoal: 10000,
  disciplineScore: 90,
  streakDays: 3,
  longestStreak: 10,
  selectedDisciplines: ['powerlifting'],
  inBodyRecords: [],
};

const baseProps = {
  user: userStub,
  pastWorkouts: [],
  workoutPlans: [],
  plans: [],
  templates: [],
  battles: [],
  penalties: [],
  achievements: [],
  personalRecords: [],
  dailyNutritionRecords: [],
  dailyRecords: [],
  sleepRecords: [],
  customFoods: [],
  customMetrics: [],
  experiments: [],
  cycles: [],
  trainingBlocks: [],
  friends: [],
  bets: [],
  foodsDatabase: [],
  // WorkoutsHub ждёт null, а не объект: иначе падает на activeWorkoutPlan.exercises[0]
  activeWorkoutPlan: null,
  // AiWorkoutLive требует план целиком
  plan: { id: 'plan_test', title: 'Тестовая тренировка', scheduledDay: 'Понедельник', exercises: [] },
  isOpen: true,
};

/** Любой незаданный проп получает массив, обработчик или безопасную заглушку. */
const propsFor = () =>
  new Proxy(
    { ...baseProps },
    {
      get: (target, key) => {
        if (key in target) return target[key];
        return noop;
      },
      has: () => true,
    },
  );

const screens = [
  'WorkoutsHub',
  'NutritionSleepTracker',
  'ProgressCharts',
  'ResearchLabView',
  'PeriodizationView',
  'SportsRanks',
  'DisciplineTracker',
  'ProfileView',
  'FriendBattles',
  'FriendsAndBattlesView',
  'AiWorkoutLive',
  'GlobalAiChatModal',
  'AiSettingsModal',
  'InteractiveTour',
  'WorkoutTemplateModal',
  'SavedTemplatesModal',
  'DailyReadinessModal',
];

const broken = [];
for (const name of screens) {
  const file = path.join(outDir, 'components', `${name}.js`);
  if (!fs.existsSync(file)) {
    check(`экран ${name} найден`, false, 'нет скомпилированного файла');
    continue;
  }
  const mod = require_(file);
  const Component = Object.values(mod).find((value) => typeof value === 'function');
  if (!Component) {
    check(`экран ${name} экспортирует компонент`, false);
    continue;
  }
  try {
    const markup = renderToString(React.createElement(Component, propsFor()));
    check(`экран ${name} рендерится`, markup.length > 50, `${(markup.length / 1024).toFixed(1)} КБ`);
  } catch (err) {
    broken.push({ name, message: err.message });
    check(`экран ${name} рендерится`, false, err.message.split('\n')[0]);
  }
}

if (broken.length > 0) {
  console.log('\nТребуют ручного разбора:');
  for (const item of broken) console.log(`  • ${item.name}: ${item.message.split('\n')[0]}`);
}

fs.rmSync(outDir, { recursive: true, force: true });
console.log(`\n${failures === 0 ? 'РЕНДЕР ПРОХОДИТ' : `ПРОВАЛОВ: ${failures}`}`);
process.exit(failures === 0 ? 0 : 1);
