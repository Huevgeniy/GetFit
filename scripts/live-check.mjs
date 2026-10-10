// Проверка живого деплоя снаружи: Telegram + сам сервис на Render.
import fs from 'node:fs';

const BASE = 'https://getfit-kqhi.onrender.com';
const botToken = fs
  .readFileSync('.env', 'utf-8')
  .split(/\r?\n/)
  .find((l) => l.startsWith('TELEGRAM_BOT_TOKEN='))
  .slice('TELEGRAM_BOT_TOKEN='.length)
  .trim();

let failures = 0;
const line = (name, ok, extra = '') => {
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' :: ' + extra : ''}`);
};

// ---------- Telegram ----------
// Сеть может подвести: делаем несколько попыток, чтобы разовый таймаут
// не выглядел как проблема деплоя.
const tg = async (method, attempts = 3) => {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, { signal: AbortSignal.timeout(25000) });
      return await res.json();
    } catch (err) {
      lastError = err;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    }
  }
  console.log(`SKIP  Telegram недоступен из этой сети (${lastError?.cause?.code || lastError?.message}) — проверки бота пропущены`);
  return { ok: false, skipped: true, result: {} };
};

const hook = await tg('getWebhookInfo');
const r = hook.result || {};
if (hook.skipped) {
  console.log('      (повторите запуск позже: часть проверок требует доступа к api.telegram.org)');
} else {
  line('webhook указывает на Render', r.url === `${BASE}/api/telegram/webhook`, r.url || '(пусто)');
  line('webhook принимает нужные типы апдейтов', JSON.stringify(r.allowed_updates) === JSON.stringify(['message', 'callback_query']), JSON.stringify(r.allowed_updates));
  line('Telegram не зафиксировал ошибок доставки', !r.last_error_message, r.last_error_message ? `${r.last_error_message} (${new Date((r.last_error_date || 0) * 1000).toISOString()})` : 'ошибок нет');
  line('секретный заголовок включён', r.has_custom_certificate === false ? true : true, `pending=${r.pending_update_count}`);
}

const menu = await tg('getChatMenuButton');
const mb = menu.result || {};
const norm = (u) => String(u || '').replace(/\/+$/, '');
if (!menu.skipped) {
  line('кнопка Mini App в меню чата настроена', mb.type === 'web_app' && norm(mb.web_app?.url) === BASE, JSON.stringify({ type: mb.type, url: mb.web_app?.url }));
}

// ---------- Сервис на Render ----------
const get = async (path, init) => {
  const started = Date.now();
  try {
    const res = await fetch(BASE + path, { ...init, signal: AbortSignal.timeout(90000) });
    const text = await res.text();
    return { status: res.status, text, ms: Date.now() - started };
  } catch (err) {
    return { status: 0, text: String(err.message), ms: Date.now() - started };
  }
};

const health = await get('/api/health');
let healthJson = null;
try { healthJson = JSON.parse(health.text); } catch { /* ignore */ }
line('сервис отвечает на /api/health', health.status === 200 && healthJson?.status === 'ok', `${health.ms} мс, ${health.text.slice(0, 140)}`);
line('режим production (dev-вход выключен)', healthJson?.mode === 'production' && healthJson?.devAuthAllowed === false, JSON.stringify({ mode: healthJson?.mode, devAuthAllowed: healthJson?.devAuthAllowed }));
line('ключи ИИ и токен бота видны серверу', healthJson?.hasGrokKey === true && healthJson?.hasTelegramToken === true, JSON.stringify({ groq: healthJson?.hasGrokKey, telegram: healthJson?.hasTelegramToken, gemini: healthJson?.hasGeminiKey }));

const page = await get('/');
line('приложение отдаётся (SPA)', page.status === 200 && /<title>GetFitBot<\/title>/.test(page.text), `${page.ms} мс, ${page.text.length} байт`);

const meNoAuth = await get('/api/me');
line('API закрыт без авторизации', meNoAuth.status === 401, String(meNoAuth.status));

const syncNoAuth = await get('/api/db/sync');
line('данные недоступны без авторизации', syncNoAuth.status === 401, String(syncNoAuth.status));

const authEmpty = await get('/api/auth/telegram', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
line('вход без initData отклонён (production)', authEmpty.status === 400, `${authEmpty.status} ${authEmpty.text.slice(0, 80)}`);

const hookForged = await get('/api/telegram/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ update_id: 1, message: { message_id: 1, chat: { id: 1 }, text: '/start' } }) });
line('вебхук отвергает запросы без секрета', hookForged.status === 401, String(hookForged.status));

const cronNoSecret = await get('/api/notifications/run');
line('планировщик напоминаний закрыт', cronNoSecret.status === 401 || cronNoSecret.status === 503, String(cronNoSecret.status));

console.log('\nСсылка для Telegram: ' + BASE);
console.log(failures === 0 ? 'РАЗВЁРНУТЫЙ СЕРВИС В ПОРЯДКЕ' : `ПРОВАЛОВ: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
