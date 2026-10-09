/**
 * Интеграционная проверка клиента в настоящем DOM (jsdom):
 * эффекты, гидратация состояния из облака, переключение вкладок.
 * Запуск: npm run test:dom
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
const outDir = path.join(projectRoot, '.tmp-dom');
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
    'src/App.tsx',
  ],
  { stdio: 'inherit' },
);
fs.writeFileSync(path.join(outDir, 'package.json'), JSON.stringify({ type: 'commonjs' }), 'utf-8');

/* ---------------- DOM ---------------- */
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'https://getfitbot.example.com/',
  pretendToBeVisual: true,
});
const { window } = dom;

const noop = () => undefined;
// В Node 24 часть глобалов (navigator, localStorage) объявлена только для чтения
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
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/* ---------------- Сервер-заглушка ---------------- */
const CLOUD_USER = 'ИзОблака';
const requests = [];
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

globalThis.fetch = async (url, init = {}) => {
  const target = String(url);
  requests.push({ url: target, method: init.method || 'GET', body: init.body });
  if (target === '/api/auth/telegram') {
    return json({ valid: true, userId: 'tg:555', token: 'dom-token', devMode: false, user: { first_name: CLOUD_USER } });
  }
  if (target === '/api/me') return json({ userId: 'tg:555', storage: 'file' });
  if (target === '/api/db/sync' && (init.method || 'GET') === 'GET') {
    return json({ found: true, data: { user: { name: CLOUD_USER, currentWeight: 77, telegramUsername: '@fromcloud' } } });
  }
  if (target === '/api/db/sync') return json({ success: true, lastSyncedAt: new Date().toISOString() });
  if (target === '/api/battles') {
    return json({
      battles: [
        {
          id: 'b1', title: 'Заруба из облака', friendName: 'Боб', friendTelegram: '@bob', avatarBg: '',
          challengeType: 'steps', duration: '1 неделя', startDate: '2026-03-01', endDate: '2026-03-08',
          userProgress: 10, friendProgress: 20, targetGoal: 100, unit: 'шагов',
          wagerTerms: { condition: 'кто больше', penaltyLoser: 'кофе', rewardWinner: '+250' },
          status: 'active', inviteLink: 'https://t.me/get_fitbot?start=ABCD1234', mySide: 'creator',
        },
      ],
    });
  }
  if (target === '/api/notifications/test') return json({ delivered: true });
  return json({});
};
window.fetch = globalThis.fetch;

/* ---------------- Рендер в DOM ---------------- */
const require_ = createRequire(import.meta.url);
const React = require_('react');
const { createRoot } = require_('react-dom/client');
const { act } = React;

const App = require_(path.join(outDir, 'App.js'));
const AppComponent = App.default || App;

const container = window.document.getElementById('root');
let reactRoot;
let renderError = null;
try {
  await act(async () => {
    reactRoot = createRoot(container);
    reactRoot.render(React.createElement(AppComponent));
  });
  // Даём завершиться цепочке асинхронных эффектов (сессия -> состояние -> зарубы)
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 400));
  });
} catch (err) {
  renderError = err;
}

check('приложение монтируется в DOM без исключений', !renderError, renderError ? renderError.message : '');
if (renderError) console.log(renderError.stack?.split('\n').slice(0, 6).join('\n'));

const text = () => container.textContent || '';
const buttons = () => [...container.querySelectorAll('button')];
const labels = () => buttons().map((el) => (el.textContent || '').trim().slice(0, 20));

// 1. Сессия и цепочка запросов
check('выполнен вход по initData', requests.some((r) => r.url === '/api/auth/telegram'));
check('запрошен режим хранилища', requests.some((r) => r.url === '/api/me'));
check('состояние загружено из облака', requests.some((r) => r.url === '/api/db/sync' && r.method === 'GET'));
check('зарубы запрошены с сервера', requests.some((r) => r.url === '/api/battles'));

// 2. Данные из облака попали в интерфейс
check('имя пользователя подставлено из облака', text().includes(CLOUD_USER));
check('вес из облака отображается в шапке', text().includes('77'));
check('телеграм-ник из облака отображается', text().includes('@fromcloud'));

// 3. Индикатор хранилища: сервер сообщил file -> предупреждение
check('показано предупреждение об отсутствии базы (storage=file)', text().includes('без базы данных'));

// 4. Переключение вкладок в реальном DOM
const clickByText = async (label) => {
  const button = buttons().find((el) => (el.textContent || '').includes(label));
  if (!button) return false;
  await act(async () => {
    button.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 80));
  });
  return true;
};

if (process.env.DOM_DEBUG === '1') {
  console.log('  кнопок:', labels().length, JSON.stringify(labels()));
  console.log('  nav есть:', Boolean(container.querySelector('nav')));
}

check('в навигации есть все экраны', ['Тренировки', 'Питание/Сон', 'Прогресс', 'Лаборатория', 'Циклы', 'Разряды', 'Дисциплина', 'Зарубы', 'Профиль'].every((label) => labels().some((l) => l.includes(label.split('/')[0]))), JSON.stringify(labels()));

const switched = await clickByText('Зарубы');
check('переключение на вкладку «Зарубы» не падает', switched && !renderError);
check('на вкладке видны зарубы с сервера', text().includes('Заруба из облака') || text().includes('Боб'), text().slice(0, 100));

const profileSwitched = await clickByText('Профиль');
check('переключение на «Профиль» не падает', profileSwitched && !renderError);
check('в профиле видны данные из облака', text().includes(CLOUD_USER));

// 4b. Напоминания: переключатель и проверка доставки
const toggle = container.querySelector('#notifications-toggle');
check('в профиле есть переключатель напоминаний', Boolean(toggle));
if (toggle) {
  await act(async () => {
    toggle.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 80));
  });
  check('переключатель отключает напоминания', text().includes('Отключены'), text().slice(-160));
  await act(async () => {
    toggle.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 80));
  });
  check('переключатель включает напоминания обратно', text().includes('Тренировка вечером'), text().slice(-160));
}

const testButton = container.querySelector('#notifications-test');
check('кнопка проверки уведомлений доступна', Boolean(testButton) && testButton.disabled === false);
if (testButton) {
  await act(async () => {
    testButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 120));
  });
  check('запрос проверки уведомлений ушёл на сервер', requests.some((r) => r.url === '/api/notifications/test' && r.method === 'POST'));
  check('пользователю показан успешный результат', text().includes('Отправлено'), text().slice(-160));
}

// 5. Ещё раз возвращаемся на тренировки — проверяем, что состояние не потерялось
const backToWorkouts = await clickByText('Тренировки');
check('возврат на «Тренировки» работает', backToWorkouts && !renderError);
check('данные из облака остались в шапке', text().includes(CLOUD_USER) && text().includes('@fromcloud'));

if (reactRoot) {
  await act(async () => {
    reactRoot.unmount();
  });
}

/* ---------------- Сценарий 2: приглашение в зарубу по deep-link ---------------- */
const INVITE_CODE = 'ABC123XY';
window.history.replaceState({}, '', `/?startapp=${INVITE_CODE}`);
container.innerHTML = '';
requests.length = 0;
// Сервер после принятия приглашения отдаёт зарубу в списке — как в реальности
let joined = false;
const JOINED_BATTLE = {
  id: 'joined-battle', title: 'Заруба по приглашению', friendName: 'Аня', friendTelegram: '@anya', avatarBg: '',
  challengeType: 'steps', duration: '1 неделя', startDate: '2026-03-01', endDate: '2026-03-08',
  userProgress: 0, friendProgress: 0, targetGoal: 50, unit: 'км',
  wagerTerms: { condition: 'кто больше', penaltyLoser: 'кофе', rewardWinner: '+250' },
  status: 'active', mySide: 'opponent',
};

globalThis.fetch = async (url, init = {}) => {
  const target = String(url);
  requests.push({ url: target, method: init.method || 'GET', body: init.body });
  if (target === '/api/auth/telegram') return json({ valid: true, userId: 'tg:777', token: 'dom-token-2', devMode: false });
  if (target === '/api/me') return json({ userId: 'tg:777', storage: 'postgres' });
  if (target === '/api/db/sync' && (init.method || 'GET') === 'GET') return json({ found: false });
  if (target === '/api/db/sync') return json({ success: true, lastSyncedAt: new Date().toISOString() });
  if (target === '/api/battles/join') {
    joined = true;
    return json({ success: true, battle: JOINED_BATTLE });
  }
  if (target === '/api/battles') return json({ battles: joined ? [JOINED_BATTLE] : [] });
  return json({});
};
window.fetch = globalThis.fetch;

let inviteError = null;
try {
  await act(async () => {
    reactRoot = createRoot(container);
    reactRoot.render(React.createElement(AppComponent));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 400));
  });
} catch (err) {
  inviteError = err;
}

const joinCall = requests.find((r) => r.url === '/api/battles/join');
check('сценарий приглашения: приложение монтируется', !inviteError, inviteError ? inviteError.message : '');
check('приглашение принято автоматически (POST /api/battles/join)', Boolean(joinCall), JSON.stringify(requests.map((r) => r.url)));
check('в запрос ушёл код из ссылки', String(joinCall?.body || '').includes(INVITE_CODE), String(joinCall?.body));
check('показано уведомление о принятой зарубе', text().includes('принял зарубу'), text().slice(0, 120));
check('принятая заруба видна в списке (её не перетёр устаревший список)', text().includes('Аня') && text().includes('Заруба по приглашению'), text().slice(0, 160));
check('повторный запрос приглашения не уходит', requests.filter((r) => r.url === '/api/battles/join').length === 1);

if (reactRoot) {
  await act(async () => {
    reactRoot.unmount();
  });
}

fs.rmSync(outDir, { recursive: true, force: true });
console.log(`\n${failures === 0 ? 'DOM-ПРОВЕРКИ ПРОЙДЕНЫ' : `ПРОВАЛОВ: ${failures}`}`);
process.exit(failures === 0 ? 0 : 1);
