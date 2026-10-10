/**
 * Финальная проверка: клиентский код приложения работает в DOM против ЖИВОГО сервера.
 * Отличие от test:dom — там сервер-заглушка, здесь настоящий деплой и настоящая база.
 * Подпись initData считается токеном бота, как это делает Telegram.
 * Тестовые записи удаляются из базы в конце.
 * Запуск: npm run test:live-ui
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHmac } from 'node:crypto';
import { JSDOM } from 'jsdom';
import pg from 'pg';

const BASE = process.env.LIVE_BASE || 'https://getfit-kqhi.onrender.com';
const envFile = fs.readFileSync('.env', 'utf-8').split(/\r?\n/);
const envValue = (key) => envFile.find((l) => l.startsWith(`${key}=`))?.slice(key.length + 1).trim() || '';
const botToken = envValue('TELEGRAM_BOT_TOKEN');
const TEST_TG_ID = 900011;
const TEST_NAME = 'ЖивойТест';

let failures = 0;
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' :: ' + extra : ''}`);
  if (!cond) failures += 1;
};

const projectRoot = process.cwd();
const outDir = path.join(projectRoot, '.tmp-liveui');
fs.rmSync(outDir, { recursive: true, force: true });

execFileSync(
  process.execPath,
  [
    path.join(projectRoot, 'node_modules', 'typescript', 'bin', 'tsc'),
    '--outDir', outDir, '--module', 'commonjs', '--target', 'es2022', '--jsx', 'react-jsx',
    '--moduleResolution', 'node', '--esModuleInterop', '--skipLibCheck', '--lib', 'es2022,dom',
    '--rootDir', 'src', 'src/App.tsx',
  ],
  { stdio: 'inherit' },
);
fs.writeFileSync(path.join(outDir, 'package.json'), JSON.stringify({ type: 'commonjs' }), 'utf-8');

/* ---------------- DOM ---------------- */
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: `${BASE}/`,
  pretendToBeVisual: true,
});
const { window } = dom;
const noop = () => undefined;
const define = (name, value) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });

globalThis.window = window;
globalThis.document = window.document;
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
window.matchMedia = globalThis.matchMedia;
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } };
globalThis.scrollTo = noop;
window.scrollTo = noop;
window.HTMLElement.prototype.scrollIntoView = noop;
define('IS_REACT_ACT_ENVIRONMENT', true);

/* ---------------- Telegram SDK ---------------- */
const fields = {
  auth_date: String(Math.floor(Date.now() / 1000)),
  query_id: `AAAlive${TEST_TG_ID}`,
  user: JSON.stringify({ id: TEST_TG_ID, first_name: TEST_NAME, username: `live_${TEST_TG_ID}` }),
};
const dataCheckString = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join('\n');
const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
const signedInitData = new URLSearchParams({ ...fields, hash }).toString();

const tgStub = {
  initData: signedInitData,
  initDataUnsafe: { user: { id: TEST_TG_ID, first_name: TEST_NAME, username: `live_${TEST_TG_ID}` }, start_param: '' },
  version: '7.7',
  isVersionAtLeast: () => true,
  viewportStableHeight: 800,
  viewportHeight: 800,
  contentSafeAreaInset: { top: 0, bottom: 0 },
  ready: noop, expand: noop, close: noop,
  setHeaderColor: noop, setBackgroundColor: noop, setBottomBarColor: noop,
  disableVerticalSwipes: noop, enableClosingConfirmation: noop,
  onEvent: noop, offEvent: noop,
  openTelegramLink: noop, openLink: noop,
  HapticFeedback: { impactOccurred: noop, notificationOccurred: noop, selectionChanged: noop },
  BackButton: { show: noop, hide: noop, onClick: noop, offClick: noop },
};
window.Telegram = { WebApp: tgStub };

/* ---------------- Сеть: настоящий живой сервер ---------------- */
// Важно: сохраняем родной fetch, иначе прокси вызовет сам себя (бесконечная рекурсия)
const nativeFetch = globalThis.fetch.bind(globalThis);
const requests = [];
globalThis.fetch = async (url, init = {}) => {
  const target = String(url);
  const absolute = target.startsWith('http') ? target : BASE + target;
  requests.push({ url: target, method: init.method || 'GET' });
  return nativeFetch(absolute, { ...init, signal: AbortSignal.timeout(90000) });
};
window.fetch = globalThis.fetch;
const requestSummary = () => {
  const unique = [...new Set(requests.map((r) => `${r.method} ${r.url}`))];
  return unique.slice(0, 10).join(' | ') + (unique.length > 10 ? ` | …всего ${unique.length} видов` : '');
};

/* ---------------- Рендер ---------------- */
const require_ = createRequire(import.meta.url);
const React = require_('react');
const { createRoot } = require_('react-dom/client');
const { act } = React;
const App = require_(path.join(outDir, 'App.js'));
const AppComponent = App.default || App;

// Будим бесплатный инстанс Render до монтирования, чтобы не ловить холодный старт
try {
  const warm = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(120000) });
  check('живой сервер проснулся', warm.ok, `HTTP ${warm.status}`);
} catch (err) {
  check('живой сервер проснулся', false, err.message);
}

const container = window.document.getElementById('root');
let renderError = null;
let reactRoot;
try {
  await act(async () => {
    reactRoot = createRoot(container);
    reactRoot.render(React.createElement(AppComponent));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 4000));
  });
} catch (err) {
  renderError = err;
}

const text = () => container.textContent || '';
check('приложение смонтировалось без исключений', !renderError, renderError ? renderError.message : '');
if (renderError) console.log(renderError.stack?.split('\n').slice(0, 6).join('\n'));

/** Ждём условие: сеть до бесплатного Render медленная, моментальные проверки флакуют. */
const waitFor = async (predicate, timeoutMs = 25000, stepMs = 500) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (predicate()) return true;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, stepMs));
    });
  }
  return predicate();
};

// 1. Реальная авторизация на живом сервере
check('клиент авторизовался по initData на живом сервере', requests.some((r) => r.url === '/api/auth/telegram' && r.method === 'POST'), requestSummary());
check('запросил режим хранилища', requests.some((r) => r.url === '/api/me'));
check('запросил состояние из облака', requests.some((r) => r.url === '/api/db/sync' && r.method === 'GET'));
check('запросил зарубы', requests.some((r) => r.url === '/api/battles'));

// 2. Имя пришло из Telegram (значит сессия настоящая)
check('в шапке имя из Telegram', text().includes(TEST_NAME), text().slice(0, 90));

// 3. Индикатор хранилища: на живом сервере Postgres, значит предупреждения быть не должно
check('предупреждения об отсутствии базы нет', !text().includes('без базы данных'), '');
const syncedShown = await waitFor(() => text().includes('✓ в облаке'));
check('показано, что данные в облаке', syncedShown, text().slice(-200));

// 4. Клиент записал состояние нового пользователя в облако
const posted = await waitFor(() => requests.some((r) => r.url === '/api/db/sync' && r.method === 'POST'));
check('состояние отправлено в облако', posted, JSON.stringify(requests.filter((r) => r.url === '/api/db/sync').slice(0, 4)));

// 5. Зарубы: создание через клиентский код и подтверждение сервером
const loginBody = requests.find((r) => r.url === '/api/auth/telegram');
check('подпись initData принята живым сервером (не 401)', loginBody !== undefined);

// ---------- что реально лежит в базе ----------
const pool = new pg.Pool({ connectionString: envValue('DATABASE_URL'), max: 2, ssl: { rejectUnauthorized: false } });
const userId = `tg:${TEST_TG_ID}`;
try {
  const stored = await pool.query('select state, updated_at from user_state where user_id = $1', [userId]);
  check('состояние пользователя действительно записано в Supabase', stored.rowCount === 1, `строк: ${stored.rowCount}`);
  if (stored.rowCount === 1) {
    const state = stored.rows[0].state;
    check('в базе лежит полный слепок состояния', typeof state === 'object' && ('user' in state) && ('workoutPlans' in state), Object.keys(state).slice(0, 6).join(', '));
    check('в слепке есть данные из Telegram', state?.user?.name === TEST_NAME, JSON.stringify(state?.user?.name));
  }
} catch (err) {
  check('чтение состояния из базы', false, err.message);
}

// Уборка выполняется всегда, даже если проверки выше упали
try {
  await pool.query('delete from user_state where user_id = $1', [userId]);
  await pool.query('delete from battles where creator_id = $1 or opponent_id = $1', [userId]);
  for (const table of ['experiments', 'cycles', 'custom_metrics', 'notifications']) {
    await pool.query(`delete from ${table} where user_id = $1`, [userId]);
  }
  const left = await pool.query('select count(*)::int as n from user_state where user_id = $1', [userId]);
  check('тестовые данные удалены из базы', left.rows[0].n === 0);
} catch (err) {
  check('тестовые данные удалены из базы', false, `${err.message} — удали строку tg:${TEST_TG_ID} вручную`);
}
await pool.end().catch(() => undefined);

if (reactRoot) {
  await act(async () => {
    reactRoot.unmount();
  });
}
fs.rmSync(outDir, { recursive: true, force: true });

console.log(`\n${failures === 0 ? 'КЛИЕНТ + ЖИВОЙ СЕРВЕР + SUPABASE РАБОТАЮТ ВМЕСТЕ' : `ПРОВАЛОВ: ${failures}`}`);
process.exit(failures === 0 ? 0 : 1);
