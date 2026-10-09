/**
 * Проверка логики напоминаний (server/notifications.ts).
 * Работает на файловом хранилище во временном каталоге, внешняя база не нужна.
 * Запуск: npm run test:notify
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let failures = 0;
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' :: ' + extra : ''}`);
  if (!cond) failures += 1;
};

// --- изолированное хранилище ---
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'getfit-notify-'));
process.env.DATA_DIR = dataDir;
process.env.NOTIFY_TZ_OFFSET_HOURS = '3'; // Москва
delete process.env.DATABASE_URL;

const dayMs = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-03-10T16:30:00Z'); // 19:30 по Москве: окно тренировки и эксперимента
const todayKey = '2026-03-10';
const yesterdayKey = '2026-03-09';

const planUser = {
  user: { name: 'Тест' },
  workoutPlans: [{ id: 'p1', title: 'День ног', scheduledDay: 'Вторник', status: 'scheduled' }],
  pastWorkouts: [],
  sleepRecords: [],
  dailyNutritionRecords: [],
  experiments: [],
};

const seed = {
  users: {
    'tg:1001': planUser,
    'dev:local': planUser,
  },
  battles: [],
  experiments: [],
  cycles: [],
  customMetrics: [],
  notifications: [],
};
fs.writeFileSync(path.join(dataDir, 'cloud_db.json'), JSON.stringify(seed, null, 2), 'utf-8');

const storage = await import('../server/storage.ts');
const notify = await import('../server/notifications.ts');
await storage.initStorage();

const typesFor = (state, now) => notify.decideReminders('tg:1001', state, now).map((d) => d.type).sort();

// 1. Вечер в окне тренировки: план есть, тренировки нет
const evening = typesFor(planUser, NOW);
check('вечером напоминание о тренировке', evening.includes('workout'), JSON.stringify(evening));

// 2. Ночь/день вне окна — тишина
const atNoon = new Date('2026-03-10T09:00:00Z'); // 12:00 МСК
check('днём напоминаний нет', typesFor(planUser, atNoon).length === 0, JSON.stringify(typesFor(planUser, atNoon)));

// 3. Утро: нет записей о сне и питании за вчера
const morning = new Date('2026-03-10T06:30:00Z'); // 09:30 МСК
check('утром просит внести сон и питание', typesFor(planUser, morning).join() === 'morning_log', JSON.stringify(typesFor(planUser, morning)));

// 4. Если сон вчера внесён — утреннего напоминания нет
const slept = { ...planUser, sleepRecords: [{ id: 's1', date: yesterdayKey, durationHours: 7 }] };
check('после внесения сна утром не беспокоит', typesFor(slept, morning).length === 0, JSON.stringify(typesFor(slept, morning)));

// 5. Тренировка уже отмечена сегодня — вечером не напоминаем
const trained = { ...planUser, pastWorkouts: [{ id: 'w1', completedAt: '2026-03-10T12:00:00Z' }] };
check('после тренировки вечером не напоминаем', !typesFor(trained, NOW).includes('workout'), JSON.stringify(typesFor(trained, NOW)));

// 6. Активный эксперимент без отметки за сегодня
const withExperiment = {
  ...planUser,
  experiments: [{ id: 'e1', title: 'Креатин', status: 'active', dailyLogs: {} }],
};
check('вечером напоминает про эксперимент', typesFor(withExperiment, NOW).includes('experiment'), JSON.stringify(typesFor(withExperiment, NOW)));
const loggedExperiment = {
  ...planUser,
  experiments: [{ id: 'e1', title: 'Креатин', status: 'active', dailyLogs: { [todayKey]: { note: 'ок' } } }],
};
check('отмеченный день эксперимента не напоминает', !typesFor(loggedExperiment, NOW).includes('experiment'), JSON.stringify(typesFor(loggedExperiment, NOW)));

// 7. Цикл отправки: dry-run ничего не отправляет и не ставит отметку
const sentCalls = [];
const send = async (userId, text) => {
  sentCalls.push({ userId, text });
};

const dry = await notify.runNotificationCycle(send, { dryRun: true, now: NOW });
check('dry-run формирует список к отправке', dry.due.length === 1 && dry.sent.length === 0, JSON.stringify(dry.due.map((d) => d.type)));
check('dry-run не отправляет сообщения', sentCalls.length === 0);
check('dry-run не оставляет отметку', (await storage.getLastNotification('tg:1001', 'workout')) === null);

// 8. Реальный проход отправляет и запоминает
const real = await notify.runNotificationCycle(send, { now: NOW });
check('сообщение отправлено', real.sent.length === 1 && sentCalls.length === 1 && sentCalls[0].userId === 'tg:1001', JSON.stringify(sentCalls));
check('в тексте есть название тренировки', /День ног/.test(sentCalls[0]?.text || ''), (sentCalls[0]?.text || '').slice(0, 60));
check('отметка об отправке сохранена', (await storage.getLastNotification('tg:1001', 'workout')) !== null);

// 9. Повторный проход в тот же вечер не спамит
const repeat = await notify.runNotificationCycle(send, { now: NOW });
check('повторная отправка заблокирована (cooldown)', repeat.sent.length === 0 && repeat.skippedByCooldown >= 1 && sentCalls.length === 1, JSON.stringify({ sent: repeat.sent.length, skipped: repeat.skippedByCooldown }));

// 10. На следующий день напоминание снова уместно.
// Отметку об отправке хранилище пишет по реальным часам, поэтому проверяем
// решение, а не цикл: смешивать симулированное и настоящее время нельзя.
const tomorrow = new Date(NOW.getTime() + dayMs);
check('на следующий день напоминание снова уместно', typesFor(planUser, tomorrow).includes('workout'), JSON.stringify(typesFor(planUser, tomorrow)));

// 11. Пользователи без Telegram пропускаются
check('dev-пользователю не пишем', !real.due.some((d) => d.userId === 'dev:local') && !dry.due.some((d) => d.userId === 'dev:local'));check('состояние пользователя не перетёрто напоминаниями', (await storage.getUserState('tg:1001'))?.state?.workoutPlans?.length === 1);

// 12. Пользователь отключил напоминания в профиле
const disabledUser = { ...planUser, user: { ...planUser.user, notificationsEnabled: false } };
check('при notificationsEnabled=false напоминаний нет', typesFor(disabledUser, NOW).length === 0, JSON.stringify(typesFor(disabledUser, NOW)));

// 13. Неудачная доставка: отметка не ставится, попытка повторится
const dataDir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'getfit-notify2-'));
fs.writeFileSync(
  path.join(dataDir2, 'cloud_db.json'),
  JSON.stringify({ users: { 'tg:2002': planUser }, battles: [], experiments: [], cycles: [], customMetrics: [], notifications: [] }, null, 2),
  'utf-8',
);
process.env.DATA_DIR = dataDir2;
await storage.initStorage(); // переключаем файловое хранилище на новый каталог

const failedCycle = await notify.runNotificationCycle(async () => false, { now: NOW });
check('недоставленное попадает в failed, а не в sent', failedCycle.failed.length === 1 && failedCycle.sent.length === 0, JSON.stringify({ sent: failedCycle.sent.length, failed: failedCycle.failed.length }));
check('при неудаче отметка не ставится (напоминание не «сгорает»)', (await storage.getLastNotification('tg:2002', 'workout')) === null);
const retryCycle = await notify.runNotificationCycle(async () => true, { now: NOW });
check('повторный проход доставляет то же напоминание', retryCycle.sent.length === 1, JSON.stringify(retryCycle.sent.map((d) => d.type)));

fs.rmSync(dataDir2, { recursive: true, force: true });

fs.rmSync(dataDir, { recursive: true, force: true });
console.log(`\n${failures === 0 ? 'ВСЕ ПРОВЕРКИ НАПОМИНАНИЙ ПРОЙДЕНЫ' : `ПРОВАЛОВ: ${failures}`}`);
process.exit(failures === 0 ? 0 : 1);
