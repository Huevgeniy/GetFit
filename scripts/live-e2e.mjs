/**
 * Сквозная проверка живого деплоя: работаем с ним так же, как это делает Mini App —
 * с настоящей подписью initData (её можно вычислить, зная токен бота).
 * После прогона тестовые записи удаляются из базы.
 * Запуск: npm run test:live
 */
import fs from 'node:fs';
import { createHmac } from 'node:crypto';
import pg from 'pg';

const BASE = process.env.LIVE_BASE || 'https://getfit-kqhi.onrender.com';
const envFile = fs.readFileSync('.env', 'utf-8').split(/\r?\n/);
const envValue = (key) => envFile.find((l) => l.startsWith(`${key}=`))?.slice(key.length + 1).trim() || '';
const botToken = envValue('TELEGRAM_BOT_TOKEN');

const TEST_USERS = [900001, 900002, 900003];

let failures = 0;
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' :: ' + extra : ''}`);
  if (!cond) failures += 1;
};

/** Подпись initData ровно по алгоритму Telegram: секрет выводится из токена бота. */
const signedInitData = (id, firstName = 'Тест') => {
  const fields = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: `AAA${id}`,
    user: JSON.stringify({ id, first_name: firstName, username: `test_${id}` }),
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
    signal: AbortSignal.timeout(90000),
  });
  let json = null;
  try { json = await res.json(); } catch { /* ignore */ }
  return { status: res.status, json };
};

console.log(`Живой сервер: ${BASE}\n`);

// 1. Вход по настоящей подписи — тот же путь, что использует Mini App
const loginA = await call('/api/auth/telegram', { method: 'POST', body: { initData: signedInitData(TEST_USERS[0], 'Алиса') } });
check('вход по подписи initData принят', loginA.status === 200 && loginA.json?.userId === `tg:${TEST_USERS[0]}`, JSON.stringify({ status: loginA.status, userId: loginA.json?.userId, error: loginA.json?.error }));
const A = loginA.json?.token;
check('выдан сессионный токен', typeof A === 'string' && A.split('.').length === 2);

const me = await call('/api/me', { token: A });
check('сервер сообщает режим postgres', me.json?.storage === 'postgres', JSON.stringify(me.json));

// 2. Состояние: запись и чтение
const blob = {
  user: { name: 'Алиса', telegramUsername: '@test_900001', currentWeight: 61.2, notificationsEnabled: true },
  workoutPlans: [{ id: 'p1', title: 'Жим', scheduledDay: 'Вторник', exercises: [{ id: 'e1', name: 'Жим лёжа', targetSets: 5, targetReps: 5, targetWeight: 90, restMinutes: 3 }] }],
  pastWorkouts: [{ id: 'w1', title: 'Жим', startedAt: new Date().toISOString(), durationMinutes: 55, totalTonnageKg: 4000, status: 'completed', exercises: [] }],
  penalties: [], achievements: [], dailyNutritionRecords: [], sleepRecords: [], customFoods: [], personalRecords: [], customTemplates: [],
};
const saved = await call('/api/db/sync', { method: 'POST', token: A, body: blob });
check('состояние сохранено в облако', saved.status === 200 && saved.json?.success === true, JSON.stringify(saved.json));
const loaded = await call('/api/db/sync', { token: A });
check('состояние прочитано обратно', loaded.json?.found === true && loaded.json?.data?.user?.name === 'Алиса', JSON.stringify(loaded.json?.data?.user));
check('кириллица и вложенность целы', loaded.json?.data?.workoutPlans?.[0]?.exercises?.[0]?.name === 'Жим лёжа');

// 3. Заруба между двумя реальными пользователями
const created = await call('/api/battles/create', {
  method: 'POST', token: A,
  body: { title: 'Жим на максимум', targetGoal: 60, unit: 'кг', userProgress: 0, friendProgress: 0, friendName: 'Боб' },
});
check('заруба создана на сервере', created.status === 200 && Boolean(created.json?.battle?.inviteCode), JSON.stringify({ id: created.json?.battle?.id, code: created.json?.battle?.inviteCode }));
const battleId = created.json?.battle?.id;
const inviteCode = created.json?.battle?.inviteCode;
check('ссылка-приглашение через бота', /^https:\/\/t\.me\/[A-Za-z0-9_]+\?start=[A-Za-z0-9]+$/.test(created.json?.battle?.inviteLink || ''), created.json?.battle?.inviteLink);

const loginB = await call('/api/auth/telegram', { method: 'POST', body: { initData: signedInitData(TEST_USERS[1], 'Боб') } });
const B = loginB.json?.token;
const joined = await call('/api/battles/join', { method: 'POST', token: B, body: { inviteCode } });
check('второй пользователь принял зарубу', joined.status === 200 && joined.json?.battle?.mySide === 'opponent', JSON.stringify({ status: joined.status, side: joined.json?.battle?.mySide }));

const loginC = await call('/api/auth/telegram', { method: 'POST', body: { initData: signedInitData(TEST_USERS[2], 'Кэрол') } });
const blocked = await call('/api/battles/join', { method: 'POST', token: loginC.json?.token, body: { inviteCode } });
check('третий в занятую зарубу не пускается', blocked.status === 409, String(blocked.status));

const progA = await call('/api/battles/update-progress', { method: 'POST', token: A, body: { battleId, amount: 25 } });
const progB = await call('/api/battles/update-progress', { method: 'POST', token: B, body: { battleId, amount: 40 } });
check('прогресс A сохранён', progA.json?.battle?.userProgress === 25, JSON.stringify({ u: progA.json?.battle?.userProgress }));
check('B видит свой прогресс, а не чужой', progB.json?.battle?.userProgress === 40 && progB.json?.battle?.friendProgress === 25, JSON.stringify({ u: progB.json?.battle?.userProgress, f: progB.json?.battle?.friendProgress }));
const listA = await call('/api/battles', { token: A });
check('A видит зарубу со стороны соперника', listA.json?.battles?.[0]?.friendName === 'Боб' && listA.json?.battles?.[0]?.userProgress === 25, JSON.stringify(listA.json?.battles?.[0]));

// 4. Попытка отправки уведомления реальному (несуществующему) чату — проверка пути в Telegram
const notifyTest = await call('/api/notifications/test', { method: 'POST', token: A });
check('проверка уведомлений отвечает причиной недоставки', notifyTest.status === 502 && /Telegram/i.test(notifyTest.json?.error || ''), JSON.stringify(notifyTest.json));

// 5. Чужой токен не даёт доступа к данным A
const foreign = await call('/api/db/sync', { token: B });
check('B не видит состояние A', foreign.json?.found === false || foreign.json?.data?.user?.name !== 'Алиса', JSON.stringify(foreign.json?.data?.user?.name));

// ---------- уборка ----------
const pool = new pg.Pool({ connectionString: envValue('DATABASE_URL'), max: 1, ssl: { rejectUnauthorized: false } });
const ids = TEST_USERS.map((id) => `tg:${id}`);
await pool.query('delete from user_state where user_id = any($1)', [ids]);
await pool.query('delete from battles where creator_id = any($1) or opponent_id = any($1)', [ids]);
for (const table of ['experiments', 'cycles', 'custom_metrics', 'notifications']) {
  await pool.query(`delete from ${table} where user_id = any($1)`, [ids]);
}
const left = await pool.query('select count(*)::int as n from user_state');
const leftBattles = await pool.query('select count(*)::int as n from battles');
await pool.end();
console.log(`\nУборка: в базе осталось записей состояния ${left.rows[0].n}, заруб ${leftBattles.rows[0].n}`);
console.log(`${failures === 0 ? 'ЖИВОЙ СЕРВЕР РАБОТАЕТ ПОЛНОСТЬЮ' : `ПРОВАЛОВ: ${failures}`}`);
process.exit(failures === 0 ? 0 : 1);
