/**
 * Проверка входа в Mini App, когда SDK с telegram.org не загрузился.
 * Telegram кладёт initData в hash — приложение должно прочитать его оттуда.
 * Запуск: npm run test:telegram
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
const outDir = path.join(projectRoot, '.tmp-telegram');
fs.rmSync(outDir, { recursive: true, force: true });

execFileSync(
  process.execPath,
  [
    path.join(projectRoot, 'node_modules', 'typescript', 'bin', 'tsc'),
    '--outDir', outDir,
    '--module', 'commonjs',
    '--target', 'es2022',
    '--moduleResolution', 'node',
    '--esModuleInterop',
    '--skipLibCheck',
    '--lib', 'es2022,dom',
    'src/lib/telegram.ts',
  ],
  { stdio: 'inherit' },
);
fs.writeFileSync(path.join(outDir, 'package.json'), JSON.stringify({ type: 'commonjs' }), 'utf-8');

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://getfit-kqhi.onrender.com/',
});
const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
// В Node 24 navigator объявлен только для чтения
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });

const require_ = createRequire(import.meta.url);
const telegram = require_(path.join(outDir, 'telegram.js'));

const setUrl = (url) => window.history.replaceState({}, '', url);
const initData = [
  'auth_date=1700000000',
  'query_id=AAH-test',
  'user=' + encodeURIComponent(JSON.stringify({ id: 777, first_name: 'Иван', username: 'ivan' })),
  'start_param=invite42',
  'hash=deadbeef',
].join('&');

/* 1. SDK нет — читаем hash */
setUrl('/#' + new URLSearchParams({ tgWebAppData: initData, tgWebAppVersion: '8.0' }).toString());
check('SDK не загрузился — initData берётся из hash', telegram.getInitData() === initData, telegram.getInitData().slice(0, 40));
check('вход считается доступным', telegram.isTelegram() === true);
check('пользователь разобран из initData', telegram.getTelegramUser()?.id === 777 && telegram.getTelegramUser()?.first_name === 'Иван', JSON.stringify(telegram.getTelegramUser()));
check('start_param разобран из initData', telegram.getStartParam() === 'invite42', telegram.getStartParam());

/* 2. SDK появился позже — он главнее hash */
window.Telegram = {
  WebApp: {
    initData: 'auth_date=1&user=%7B%22id%22%3A1%7D',
    initDataUnsafe: { start_param: 'fromsdk', user: { id: 1, first_name: 'SDK' } },
  },
};
check('SDK имеет приоритет над hash', telegram.getInitData().startsWith('auth_date=1'), telegram.getInitData());
check('пользователь берётся из SDK', telegram.getTelegramUser()?.first_name === 'SDK');
check('start_param берётся из SDK', telegram.getStartParam() === 'fromsdk');

/* 3. Нет ни SDK, ни hash — приложение не падает */
delete window.Telegram;
setUrl('/');
check('без данных initData пустой', telegram.getInitData() === '');
check('без данных вход не считается телеграмным', telegram.isTelegram() === false);
check('без данных пользователь не выдумывается', telegram.getTelegramUser() === null);
check('без данных start_param пустой', telegram.getStartParam() === '');

/* 4. Обычная ссылка ?startapp=... в браузере */
setUrl('/?startapp=promo7');
check('startapp из query работает без Telegram', telegram.getStartParam() === 'promo7', telegram.getStartParam());

/* 5. UI-настройка вне Telegram не бросает исключение */
let uiError = null;
try {
  telegram.applyTelegramUi();
} catch (err) {
  uiError = err;
}
check('настройка интерфейса вне Telegram безопасна', uiError === null, uiError ? uiError.message : '');
check('высота вьюпорта записана', Boolean(window.document.documentElement.style.getPropertyValue('--app-height')));

console.log(failures === 0 ? '\nВХОД БЕЗ SDK РАБОТАЕТ' : `\nПРОВАЛОВ: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
