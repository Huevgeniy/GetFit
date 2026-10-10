// Что реально работает на живом сервере: версия кода, провайдер ИИ, тексты в интерфейсе.
import fs from 'node:fs';
import { createHmac } from 'node:crypto';

const BASE = process.env.LIVE_BASE || 'https://getfit-kqhi.onrender.com';
const botToken = fs
  .readFileSync('.env', 'utf-8')
  .split(/\r?\n/)
  .find((l) => l.startsWith('TELEGRAM_BOT_TOKEN='))
  .slice('TELEGRAM_BOT_TOKEN='.length)
  .trim();

const signedInitData = (id) => {
  const fields = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: `AAAai${id}`,
    user: JSON.stringify({ id, first_name: 'Проверка', username: `ai_${id}` }),
  };
  const dataCheckString = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
};

const call = async (path, { method = 'GET', token, body } = {}) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(120000),
  });
  let json = null;
  try { json = await res.json(); } catch { /* ignore */ }
  return { status: res.status, json };
};

// 1. Какая версия кода развёрнута
const health = await call('/api/health');
console.log('HEALTH:', health.status, JSON.stringify(health.json));
console.log('версия с правками (поле storage):', health.json?.storage ? 'ДА — задеплоен свежий код' : 'НЕТ — на Render старый коммит');

// 2. Вход и проверка ИИ
const login = await call('/api/auth/telegram', { method: 'POST', body: { initData: signedInitData(900021) } });
const token = login.json?.token;
console.log('вход:', login.status, login.json?.userId);

const chat = await call('/api/ai/chat', {
  method: 'POST', token,
  body: { message: 'Пожал 100 кг на 5, что посоветуешь дальше?', activeWorkout: { title: 'Жим' }, userProfile: { name: 'Проверка', currentWeight: 80 } },
});
console.log('\nAI-ЛОГГЕР (/api/ai/chat):', chat.status, '| провайдер:', chat.json?.aiProvider);
console.log('  ответ:', JSON.stringify(chat.json?.reply || chat.json?.error || chat.json).slice(0, 220));

const concierge = await call('/api/ai/concierge', {
  method: 'POST', token,
  body: { message: 'спал 6 часов, вес 80.5', userProfile: { name: 'Проверка' } },
});
console.log('\nИИ-КОНСЬЕРЖ (/api/ai/concierge):', concierge.status, '| провайдер:', concierge.json?.aiProvider);
console.log('  ответ:', JSON.stringify(concierge.json?.reply || concierge.json?.error || concierge.json).slice(0, 220));

const inbody = await call('/api/ai/parse-inbody', {
  method: 'POST', token,
  body: { text: 'Вес 80.5, скелетная мускулатура 37.2, жир 15.1', userProfile: { name: 'Проверка' } },
});
console.log('\nРАЗБОР INBODY: провайдер:', inbody.json?.aiProvider ?? '(не указан)', '| вес:', inbody.json?.record?.weightKg, '| жир:', inbody.json?.record?.bodyFatPercent);
