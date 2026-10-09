/**
 * Проверка окружения перед деплоем: npm run doctor
 * Ничего не меняет, только читает .env и переменные окружения.
 */
import fs from 'node:fs';
import path from 'node:path';

const problems = [];
const warnings = [];
const notes = [];

const ok = (name, detail = '') => console.log(`✅ ${name}${detail ? ' — ' + detail : ''}`);
const warn = (name, detail = '') => {
  warnings.push(name);
  console.log(`⚠️  ${name}${detail ? ' — ' + detail : ''}`);
};
const fail = (name, detail = '') => {
  problems.push(name);
  console.log(`❌ ${name}${detail ? ' — ' + detail : ''}`);
};

// --- .env ---
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line.trim());
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
  }
  ok('.env найден');
} else {
  warn('.env не найден', 'переменные окружения должны быть заданы снаружи (Render → Environment)');
}

const env = (key) => (process.env[key] || '').trim();

// --- Node ---
const major = Number(process.versions.node.split('.')[0]);
if (major >= 20) ok(`Node.js ${process.versions.node}`);
else fail(`Node.js ${process.versions.node}`, 'нужен Node 20 или новее');

// --- Telegram ---
const botToken = env('TELEGRAM_BOT_TOKEN');
if (!botToken) {
  fail('TELEGRAM_BOT_TOKEN не задан', 'без него не работает вход в Mini App');
} else if (!/^\d{5,}:[A-Za-z0-9_-]{30,}$/.test(botToken)) {
  fail('TELEGRAM_BOT_TOKEN выглядит некорректно', 'ожидается формат 123456:AA...');
} else {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const data = await res.json();
    if (data.ok) {
      ok('бот отвечает', `@${data.result.username} (${data.result.first_name})`);
      const webhook = await (await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`)).json();
      if (webhook.result?.url) notes.push(`webhook уже установлен: ${webhook.result.url}`);
      else notes.push('webhook не установлен — сервер поставит его сам при старте, если задан APP_URL');
    } else {
      fail('бот не принимает токен', data.description);
    }
  } catch (err) {
    warn('не удалось проверить бота', `${err.message} (нет сети из этой среды?)`);
  }
}

// --- ИИ ---
const groq = env('GROQ_API_KEY');
if (!groq) warn('GROQ_API_KEY не задан', 'ИИ-ответы будут шаблонными (провайдер heuristic)');
else if (!groq.startsWith('gsk_')) warn('GROQ_API_KEY не похож на ключ Groq', 'обычно начинается с gsk_');
else {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', { headers: { Authorization: `Bearer ${groq}` } });
    if (res.ok) {
      const data = await res.json();
      const ids = (data.data || []).map((m) => m.id);
      const model = env('GROQ_MODEL') || 'qwen/qwen3.8-27b';
      if (ids.includes(model)) ok('Groq-ключ рабочий', `модель ${model} доступна`);
      else fail('модель Groq недоступна для ключа', `${model}; доступны: ${ids.filter((i) => !/whisper|tts|guard|orpheus|embed/i.test(i)).slice(0, 5).join(', ')}`);
    } else {
      fail('Groq-ключ отклонён', `HTTP ${res.status}`);
    }
  } catch (err) {
    warn('не удалось проверить Groq', err.message);
  }
}
if (env('GEMINI_API_KEY')) {
  notes.push('GEMINI_API_KEY задан: из России и с датацентр-IP Gemini API недоступен, он остаётся резервом');
}

// --- Публичный адрес ---
const appUrl = env('APP_URL');
if (!appUrl) {
  fail('APP_URL не задан', 'без него бот не поставит webhook, а ссылки-приглашения в зарубы будут нерабочими');
} else if (!appUrl.startsWith('https://')) {
  fail('APP_URL должен быть https', `сейчас: ${appUrl}`);
} else if (/localhost|127\.0\.0\.1/.test(appUrl)) {
  fail('APP_URL указывает на localhost', 'Telegram не сможет открыть такое приложение');
} else if (appUrl.endsWith('/')) {
  warn('APP_URL заканчивается слэшем', 'лучше без него: https://example.com');
} else {
  ok('APP_URL задан', appUrl);
}

// --- База данных ---
const dbUrl = env('DATABASE_URL');
if (!dbUrl) {
  warn(
    'DATABASE_URL не задан',
    'данные будут писаться в файл — на Render он стирается при каждом деплое. Для локальной разработки это нормально',
  );
} else {
  let parsed;
  try {
    parsed = new URL(dbUrl);
  } catch {
    fail('DATABASE_URL не разбирается как URL', 'проверь строку подключения целиком, вместе с паролем');
  }
  if (parsed) {
    const host = parsed.hostname;
    const port = parsed.port || '5432';
    if (/^db\..*\.supabase\.co$/.test(host)) {
      fail(
        'DATABASE_URL — это Direct connection Supabase (IPv6-only)',
        'на Render не подключится. Нужна строка Session pooler: ...pooler.supabase.com:5432',
      );
    } else if (/pooler\.supabase\.com$/.test(host)) {
      if (port === '5432') ok('DATABASE_URL — Session pooler Supabase', `${host}:${port} (рекомендуемый вариант)`);
      else if (port === '6543') warn('DATABASE_URL — Transaction pooler (6543)', 'работает, но Session pooler (5432) надёжнее');
      else warn('Необычный порт Supabase', port);
    } else {
      ok('DATABASE_URL задан', `${host}:${port}`);
    }

    if (!/sslmode=require/.test(dbUrl) && !/pooler\.supabase\.com/.test(host) && !/localhost|127\.0\.0\.1/.test(host)) {
      notes.push('SSL включается автоматически для не-localhost хостов');
    }

    // Реальная проверка соединения и миграций
    try {
      const pg = await import('pg');
      const isLocal = /@(localhost|127\.0\.0\.1)/.test(dbUrl);
      const pool = new pg.default.Pool({
        connectionString: dbUrl,
        max: 1,
        ssl: isLocal ? undefined : { rejectUnauthorized: false },
        connectionTimeoutMillis: 15000,
      });
      const started = Date.now();
      const tables = await pool.query(
        `select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
      );
      const names = tables.rows.map((r) => r.table_name);
      const expected = ['user_state', 'battles', 'experiments', 'cycles', 'custom_metrics', 'notifications'];
      const missing = expected.filter((t) => !names.includes(t));
      ok('подключение к Postgres работает', `${Date.now() - started} мс, таблиц: ${names.length}`);
      if (missing.length) {
        notes.push(`таблицы ${missing.join(', ')} появятся при первом старте сервера (миграции выполняются автоматически)`);
      } else {
        ok('все таблицы на месте');
      }
      await pool.end();
    } catch (err) {
      fail('не удалось подключиться к базе', err.message);
    }
  }
}

// --- Секреты ---
for (const [key, why] of [
  ['SESSION_SECRET', 'если пусто — выводится из токена бота (при смене токена все перелогинятся)'],
  ['TELEGRAM_WEBHOOK_SECRET', 'без него вебхук принимает любые запросы'],
  ['CRON_SECRET', 'без него выключены напоминания от бота'],
]) {
  if (env(key)) ok(`${key} задан`);
  else warn(`${key} не задан`, why);
}

// --- Итог ---
console.log('\n' + '─'.repeat(60));
for (const note of notes) console.log(`ℹ️  ${note}`);
if (problems.length === 0 && warnings.length === 0) {
  console.log('🎉 Конфигурация готова к деплою.');
} else {
  if (warnings.length) console.log(`⚠️  Предупреждений: ${warnings.length} — приложение запустится, но с ограничениями.`);
  if (problems.length) console.log(`❌ Проблем: ${problems.length} — это сломает работу, исправь до деплоя.`);
}
process.exit(problems.length === 0 ? 0 : 1);
