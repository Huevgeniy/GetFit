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

// Онбординг не должен попадать в базовую разметку: проверяем именно четыре вкладки
storage.set('getfit_tour_completed', 'true');

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
    ['заголовок GetFit', 'GetFit'],
    ['вкладка «Тренировки»', 'Тренировки'],
    ['вкладка «Питание»', 'Питание'],
    ['вкладка «Прогресс»', 'Прогресс'],
    ['вкладка «Профиль»', 'Профиль'],
    ['MINI APP бейдж', 'MINI APP'],
  ]) {
    check(`в разметке есть ${name}`, html.includes(needle));
  }
  check('базовый режим: нет вкладки «Отчёты»', !html.includes('Отчёты'));
  check('базовый режим: индикатор дисциплины скрыт', !html.includes('Дисциплина'));
  check(
    'базовый режим: нет дополнительных вкладок',
    !['Лаборатория', 'Циклы', 'Разряды', 'Зарубы'].some((label) => html.includes(label)),
  );
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
  bodyProfile: {
    heightCm: 178,
    sex: 'male',
    measurements: [
      {
        id: 'bm_render_1',
        date: '2026-01-10',
        createdAt: '2026-01-10T08:00:00.000Z',
        weightKg: 81,
        waistCm: 84,
        chestCm: 104,
        shouldersCm: 122,
        bicepLCm: 38,
        bicepRCm: 37.5,
      },
      {
        id: 'bm_render_2',
        date: '2026-02-10',
        createdAt: '2026-02-10T08:00:00.000Z',
        weightKg: 80,
        waistCm: 82,
        chestCm: 105,
        shouldersCm: 123,
        bicepLCm: 38.5,
        bicepRCm: 38,
      },
    ],
  },
};

const nowDate = new Date();
const todayKey = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}-${String(nowDate.getDate()).padStart(2, '0')}`;

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
const propsFor = (overrides = {}) =>
  new Proxy(
    { ...baseProps, ...overrides },
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
  'StatsView',
  'ResearchLabView',
  'PeriodizationView',
  'BodyBiomechanicsView',
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

// --- Режимы и точки входа в дополнительные функции ---
const ProgressChartsMod = require_(path.join(outDir, 'components', 'ProgressCharts.js'));
const progressHtml = renderToString(
  React.createElement(ProgressChartsMod.ProgressCharts, propsFor({ onOpenStats: noop })),
);
check('в «Прогрессе» есть кнопка отчёта за период', progressHtml.includes('Отчёт за период'));

const ProfileViewMod = require_(path.join(outDir, 'components', 'ProfileView.js'));
const basicProfileHtml = renderToString(
  React.createElement(ProfileViewMod.ProfileView, propsFor()),
);
check('в базовом профиле есть переключатель режима', basicProfileHtml.includes('Базовый режим'));
check(
  'в базовом профиле описано, что остаётся',
  basicProfileHtml.includes('Что остаётся в базовом режиме'),
);
check(
  'в базовом профиле нет вкладки «Друзья и зарубы»',
  !basicProfileHtml.includes('Друзья и зарубы'),
);
const stepsProfileHtml = renderToString(
  React.createElement(
    ProfileViewMod.ProfileView,
    propsFor({ user: { ...userStub, dailySteps: { [todayKey]: 12345 } } }),
  ),
);
check(
  'профиль показывает шаги из синхронизированного журнала',
  stepsProfileHtml.includes('12\u00A0345'),
  stepsProfileHtml.slice(0, 160),
);

const advancedUser = {
  ...userStub,
  uiMode: 'advanced',
  enabledFeatures: {
    marathons: true,
    battles: true,
    discipline: true,
    ranks: true,
    lab: true,
    periodization: true,
    body: true,
  },
};
const advancedProfileHtml = renderToString(
  React.createElement(ProfileViewMod.ProfileView, propsFor({ user: advancedUser })),
);
check(
  'расширенный профиль показывает все тумблеры',
  [
    'Марафоны целей',
    'Зарубы с друзьями',
    'Дисциплина и штрафы',
    'Спортивные разряды',
    'Тело и биомеханика',
    'Лаборатория привычек',
    'Циклы тренировок',
  ].every((label) => advancedProfileHtml.includes(label)),
);
check(
  'расширенный профиль объясняет тумблеры',
  advancedProfileHtml.includes('Серии дней с шагами') &&
    advancedProfileHtml.includes('Нормативы по пауэрлифтингу') &&
    advancedProfileHtml.includes('Блоки роста мышц'),
);
check(
  'расширенный профиль возвращает вкладки «Друзья и зарубы» и «Награды»',
  advancedProfileHtml.includes('Друзья и зарубы') && advancedProfileHtml.includes('Награды'),
);

// --- Экран «Тело и биомеханика» ---
const BodyViewMod = require_(path.join(outDir, 'components', 'BodyBiomechanicsView.js'));
const bodyHtml = renderToString(
  React.createElement(BodyViewMod.BodyBiomechanicsView, propsFor()),
);
check(
  'экран «Тело» показывает замеры и модель',
  ['Тело и биомеханика', 'Замеры', 'Упражнения', 'Техника', 'Анализ'].every((label) =>
    bodyHtml.includes(label),
  ),
  bodyHtml.slice(0, 200),
);
check(
  'экран «Тело» подставляет последний замер',
  bodyHtml.includes('10.02.2026') && bodyHtml.includes('Все замеры'),
  bodyHtml.slice(0, 240),
);
check(
  'экран «Тело» показывает динамику и историю',
  bodyHtml.includes('Динамика') && bodyHtml.includes('История замеров'),
);

const WorkoutsHubMod = require_(path.join(outDir, 'components', 'WorkoutsHub.js'));
const basicWorkoutsHtml = renderToString(
  React.createElement(WorkoutsHubMod.WorkoutsHub, propsFor()),
);
check('в базовых тренировках нет марафонов', !basicWorkoutsHtml.includes('Марафоны целей'));
const advancedWorkoutsHtml = renderToString(
  React.createElement(WorkoutsHubMod.WorkoutsHub, propsFor({
    features: {
      marathons: true,
      battles: false,
      discipline: false,
      ranks: false,
      lab: false,
      periodization: false,
      body: false,
    },
  })),
);
check('при включении марафонов появляется вкладка', advancedWorkoutsHtml.includes('Марафоны целей'));

const StatsMod = require_(path.join(outDir, 'components', 'StatsView.js'));
const nowIso = new Date().toISOString();
const statsWorkout = {
  id: 'w_stats',
  title: 'Тестовая тренировка',
  startedAt: nowIso,
  completedAt: nowIso,
  durationMinutes: 60,
  totalTonnageKg: 1500,
  status: 'completed',
  exercises: [
    {
      exerciseId: 'e1',
      name: 'Жим лёжа',
      sets: [
        {
          id: 's1',
          setNumber: 1,
          weight: 100,
          reps: 5,
          rpe: 8,
          timestamp: nowIso,
          calculated1RM: 116,
          normalizedRepsAt100kg: 5,
        },
      ],
    },
  ],
};
const statsFood = {
  date: todayKey,
  meals: [],
  morningWeightKg: 80,
  totalCalories: 2200,
  totalProtein: 150,
  totalFat: 70,
  totalCarbs: 250,
  totalFiber: 30,
  targetCalories: 2500,
  targetProtein: 180,
  targetFat: 80,
  targetCarbs: 280,
  targetFiber: 35,
  status: 'open',
};
const statsSleep = {
  id: 'sleep_stats',
  date: todayKey,
  bedtime: '23:00',
  wakeTime: '07:00',
  durationHours: 8,
  qualityScore: 8,
  feeling: 'rested',
};
const statsHtml = renderToString(
  React.createElement(
    StatsMod.StatsView,
    propsFor({
      user: { ...userStub, dailySteps: { [todayKey]: 12345 } },
      pastWorkouts: [statsWorkout],
      dailyNutritionRecords: [statsFood],
      sleepRecords: [statsSleep],
      showBattles: false,
    }),
  ),
);
check(
  'отчёт за период содержит метрики',
  ['Тренировок', 'Общий вес', 'Подходов', 'Средний сон', 'Калории', 'Шаги', 'Вес'].every((label) =>
    statsHtml.includes(label),
  ),
  statsHtml.slice(0, 200),
);
check('в базовом отчёте нет блока заруб', !statsHtml.includes('Зарубы'));
check('отчёт берёт шаги из синхронизированного профиля', statsHtml.includes('12\u00A0345'), statsHtml.slice(0, 200));

if (broken.length > 0) {
  console.log('\nТребуют ручного разбора:');
  for (const item of broken) console.log(`  • ${item.name}: ${item.message.split('\n')[0]}`);
}

fs.rmSync(outDir, { recursive: true, force: true });
console.log(`\n${failures === 0 ? 'РЕНДЕР ПРОХОДИТ' : `ПРОВАЛОВ: ${failures}`}`);
process.exit(failures === 0 ? 0 : 1);
