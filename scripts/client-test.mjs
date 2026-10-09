/**
 * Проверка клиентской логики сессии (src/lib/api.ts) без браузера:
 * localStorage/window/fetch подменяются заглушками.
 * Запуск: npm run test:client
 */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const root = process.cwd();
const outDir = path.join(root, '.tmp-libtest');

execFileSync(
  process.execPath,
  [
    path.join(root, 'node_modules', 'typescript', 'bin', 'tsc'),
    'src/lib/api.ts',
    'src/lib/telegram.ts',
    '--outDir', outDir,
    '--module', 'commonjs',
    '--target', 'es2022',
    '--moduleResolution', 'node',
    '--esModuleInterop',
    '--skipLibCheck',
    '--lib', 'es2022,dom',
  ],
  { stdio: 'inherit' },
);

// Корневой package.json помечен как "type": "module" — для require() нужен свой маркер
fs.writeFileSync(path.join(outDir, 'package.json'), JSON.stringify({ type: 'commonjs' }), 'utf-8');

// --- заглушки браузерного окружения ---
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.window = { location: { search: '' }, Telegram: undefined };

let failures = 0;
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' :: ' + extra : ''}`);
  if (!cond) failures += 1;
};

const requests = [];
let authResponder = () => ({ status: 200, body: { valid: true, userId: 'dev:test', token: 'token-1', devMode: true, user: { first_name: 'Dev' } } });
let forceUnauthorizedOnce = false;

globalThis.fetch = async (url, init = {}) => {
  requests.push({ url: String(url), method: init.method || 'GET', headers: init.headers, body: init.body });
  if (String(url) === '/api/auth/telegram') {
    const r = authResponder();
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'Content-Type': 'application/json' } });
  }
  if (forceUnauthorizedOnce) {
    forceUnauthorizedOnce = false;
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

const require_ = createRequire(import.meta.url);
const api = require_(path.join(outDir, 'api.js'));

// 1. Первичная сессия вне Telegram -> dev-режим
const session = await api.ensureSession();
check('вне Telegram поднимается dev-сессия', session.authorized === true && session.devMode === true, JSON.stringify(session));
check('токен сохранён в localStorage', Boolean(store.get('getfit_session_token')));
const authReq = requests.find((r) => r.url === '/api/auth/telegram');
check('в запросе авторизации передан devId', /"devId"/.test(String(authReq?.body)), String(authReq?.body));

// 2. Авторизованный запрос несёт Bearer
requests.length = 0;
await api.apiFetch('/api/me');
const authHeader = requests[0]?.headers?.get?.('Authorization');
check('apiFetch добавляет заголовок Authorization', authHeader === 'Bearer token-1', String(authHeader));

// 3. 401 -> переавторизация и один повтор
requests.length = 0;
forceUnauthorizedOnce = true;
authResponder = () => ({ status: 200, body: { valid: true, userId: 'dev:test', token: 'token-2', devMode: true } });
const retried = await api.apiFetch('/api/db/sync');
check('после 401 запрос повторяется с новым токеном', retried.status === 200 && store.get('getfit_session_token') === 'token-2', `status=${retried.status} token=${store.get('getfit_session_token')}`);

// 4. Сохранение и чтение состояния
requests.length = 0;
await api.saveCloudState({ user: { name: 'Тест' } });
check('saveCloudState делает POST /api/db/sync', requests[0]?.url === '/api/db/sync' && requests[0]?.method === 'POST');
check('в теле есть данные пользователя', /Тест/.test(String(requests[0]?.body)));
await api.loadCloudState();
check('loadCloudState делает GET /api/db/sync', requests[1]?.url === '/api/db/sync' && requests[1]?.method === 'GET');

// 5. При наличии initData Telegram используется он, а не devId
store.clear();
delete require_.cache[require_.resolve(path.join(outDir, 'api.js'))];
const api2 = require_(path.join(outDir, 'api.js'));
window.Telegram = { WebApp: { initData: 'query_id=AAA&user=%7B%22id%22%3A42%7D&auth_date=1&hash=deadbeef' } };
authResponder = () => ({ status: 200, body: { valid: true, userId: 'tg:42', token: 'token-tg', devMode: false, user: { first_name: 'Иван' } } });
requests.length = 0;
const session2 = await api2.ensureSession();
const body2 = String(requests.find((r) => r.url === '/api/auth/telegram')?.body);
check('внутри Telegram отправляется initData', /"initData"/.test(body2) && !/"devId"/.test(body2), body2.slice(0, 80));
check('сессия из Telegram помечена как не-dev', session2.authorized === true && session2.devMode === false, JSON.stringify(session2));

// 6. Отказ сервера -> неавторизованное состояние и токен не сохраняется
store.clear();
delete require_.cache[require_.resolve(path.join(outDir, 'api.js'))];
const api3 = require_(path.join(outDir, 'api.js'));
authResponder = () => ({ status: 400, body: { valid: false, error: 'initData is required' } });
const session3 = await api3.ensureSession();
check('при отказе сервера сессия неавторизована', session3.authorized === false && session3.error === 'initData is required', JSON.stringify(session3));
check('токен не сохранён при отказе', !localStorage.getItem('getfit_session_token'));

fs.rmSync(outDir, { recursive: true, force: true });
console.log(`\n${failures === 0 ? 'ВСЕ ПРОВЕРКИ КЛИЕНТА ПРОЙДЕНЫ' : `ПРОВАЛОВ: ${failures}`}`);
process.exit(failures === 0 ? 0 : 1);
