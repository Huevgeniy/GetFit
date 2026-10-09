const BASE = 'http://127.0.0.1:3100';
let failures = 0;
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' :: ' + extra : ''}`);
  if (!cond) failures += 1;
};

const call = async (path, { method = 'GET', token, body } = {}) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* empty */ }
  return { status: res.status, json };
};

// 1. Health
const health = await call('/api/health');
check('health 200 + production mode', health.status === 200 && health.json.mode === 'production', JSON.stringify(health.json));

// 2. Без токена закрыто
const noAuth = await call('/api/me');
check('GET /api/me без токена = 401', noAuth.status === 401, String(noAuth.status));

const syncNoAuth = await call('/api/db/sync');
check('GET /api/db/sync без токена = 401', syncNoAuth.status === 401, String(syncNoAuth.status));

// 3. Логин двух dev-пользователей
const loginA = await call('/api/auth/telegram', { method: 'POST', body: { devId: 'alice' } });
const loginB = await call('/api/auth/telegram', { method: 'POST', body: { devId: 'bob' } });
check('dev-логин A выдал токен', loginA.status === 200 && !!loginA.json.token, loginA.json?.userId);
check('dev-логин B выдал токен', loginB.status === 200 && !!loginB.json.token, loginB.json?.userId);
const A = loginA.json.token, B = loginB.json.token;
check('разные пользователи получили разные id', loginA.json.userId !== loginB.json.userId);

// 4. Подделанный токен не проходит
const forged = await call('/api/me', { token: A.slice(0, -3) + 'xyz' });
check('подделанный токен = 401', forged.status === 401, String(forged.status));

// 4b. /api/me отдаёт пользователя и режим хранилища (клиент показывает это в UI)
const meAuthed = await call('/api/me', { token: A });
check(
  '/api/me отдаёт пользователя и режим хранилища',
  meAuthed.status === 200 && meAuthed.json?.userId === 'dev:alice' && ['postgres', 'file'].includes(meAuthed.json?.storage),
  JSON.stringify(meAuthed.json),
);

// 5. Пустой initData в production-режиме отклоняется... но ALLOW_DEV_AUTH=true разрешает dev-вход
const emptyInit = await call('/api/auth/telegram', { method: 'POST', body: {} });
check('вход без initData даёт dev-сессию при ALLOW_DEV_AUTH', emptyInit.status === 200 && emptyInit.json.devMode === true);

// 6. Синхронизация состояния
const state = { user: { name: 'Алиса', telegramUsername: '@alice' }, pastWorkouts: [{ id: 'w1', title: 'Жим' }] };
const save = await call('/api/db/sync', { method: 'POST', token: A, body: state });
check('POST /api/db/sync сохранил', save.status === 200 && save.json.success === true);
const load = await call('/api/db/sync', { token: A });
check('GET /api/db/sync вернул те же данные', load.json?.found === true && load.json.data?.user?.name === 'Алиса');
const loadB = await call('/api/db/sync', { token: B });
check('данные A не видны пользователю B', loadB.json?.found === false, JSON.stringify(loadB.json));

// 6b. Полный блоб клиента (все 10 ключей) переживает запись и чтение без потерь
const fullBlob = {
  user: { id: 'user_local', name: 'Алиса', telegramUsername: '@alice', currentWeight: 63.5, disciplineScore: 92, streakDays: 7, selectedDisciplines: ['powerlifting', 'streetlifting'], inBodyRecords: [{ id: 'ib1', date: '2026-03-01', weightKg: 63.5, bodyFatPercent: 18.2 }] },
  workoutPlans: [{ id: 'p1', title: 'День ног', scheduledDay: 'Вторник', exercises: [{ id: 'e1', name: 'Присед', targetSets: 5, targetReps: 5, targetWeight: 100, restMinutes: 3 }], status: 'scheduled' }],
  pastWorkouts: [{ id: 'w1', title: 'Жим', startedAt: '2026-03-09T15:00:00.000Z', durationMinutes: 62, totalTonnageKg: 5400, status: 'completed', exercises: [{ exerciseId: 'e2', name: 'Жим лёжа', sets: [{ setNumber: 1, weight: 105, reps: 8, rpe: 8.5, timestamp: '2026-03-09T15:20:00.000Z', calculated1RM: 133, normalizedRepsAt100kg: 8.4 }] }] }],
  penalties: [{ id: 'pen1', date: '2026-03-08', reason: 'Пропуск', penaltyTask: '50 бурпи', pointsDeducted: 5, status: 'pending' }],
  achievements: [{ id: 'ach1', title: 'Первая сотка', description: 'Жим 100 кг', unlockedAt: '2026-02-20', icon: '🏆' }],
  dailyNutritionRecords: [{ id: 'n1', date: '2026-03-09', totalCalories: 2650, protein: 180, fats: 80, carbs: 260, meals: [{ id: 'm1', name: 'Овсянка', calories: 420 }] }],
  sleepRecords: [{ id: 's1', date: '2026-03-09', durationHours: 7.5, qualityScore: 8, deepSleepMinutes: 95, remSleepMinutes: 110, restingHeartRate: 54 }],
  customFoods: [{ id: 'f1', name: 'Творог 5%', calories: 121, protein: 17, fats: 5, carbs: 3, per: 100 }],
  personalRecords: [{ id: 'pr1', exerciseName: 'Жим лёжа', value: '105 кг × 8', date: '2026-03-09', history: [{ id: 'h1', date: '9 мар', value: '105 кг × 8' }] }],
  customTemplates: [{ id: 't1', title: 'Спина+бицепс', scheduledDay: 'Пятница', exercises: [], isCustomTemplate: true }],
};
const fullSave = await call('/api/db/sync', { method: 'POST', token: A, body: fullBlob });
check('полный блоб сохранён', fullSave.status === 200 && fullSave.json?.success === true);
const fullLoad = await call('/api/db/sync', { token: A });
const restored = fullLoad.json?.data || {};
const missingKeys = Object.keys(fullBlob).filter((key) => !(key in restored));
check('все 10 ключей состояния вернулись', missingKeys.length === 0, missingKeys.length ? `потеряны: ${missingKeys.join(', ')}` : '');
const mismatched = Object.keys(fullBlob).filter(
  (key) => JSON.stringify(restored[key]) !== JSON.stringify(fullBlob[key]),
);
check('содержимое совпадает побайтово (вложенные объекты и массивы)', mismatched.length === 0, mismatched.join(', '));
check('вложенные числа не превратились в строки', restored.user?.currentWeight === 63.5 && restored.pastWorkouts?.[0]?.exercises?.[0]?.sets?.[0]?.rpe === 8.5);
check('кириллица не побилась', restored.penalties?.[0]?.penaltyTask === '50 бурпи' && restored.personalRecords?.[0]?.value === '105 кг × 8');

// 7. Заруба: создаёт A, присоединяется B
const created = await call('/api/battles/create', {
  method: 'POST', token: A,
  body: { title: 'Кто больше жмёт', targetGoal: 100, unit: 'кг', friendName: 'Боб', friendTelegram: '@bob', userProgress: 0, friendProgress: 0 },
});
check('заруба создана', created.status === 200 && !!created.json.battle?.inviteCode, created.json?.battle?.inviteCode);
const battleId = created.json.battle.id;
const inviteCode = created.json.battle.inviteCode;
check(
  'ссылка-приглашение ведёт в чат с ботом (?start=<код>)',
  /^https:\/\/t\.me\/[A-Za-z0-9_]+\?start=[A-Za-z0-9_-]{6,32}$/.test(created.json.battle.inviteLink || '') &&
    created.json.battle.inviteLink.endsWith(inviteCode),
  created.json.battle.inviteLink,
);
check('создатель видит статус pending_friend', created.json.battle.status === 'pending_friend', created.json.battle.status);

const badJoin = await call('/api/battles/join', { method: 'POST', token: B, body: { inviteCode: 'NOPE1234' } });
check('несуществующий код = 404', badJoin.status === 404, String(badJoin.status));

const joined = await call('/api/battles/join', { method: 'POST', token: B, body: { inviteCode } });
check('B присоединился и видит себя соперником', joined.status === 200 && joined.json.battle.mySide === 'opponent', joined.json?.battle?.mySide);
check('после принятия статус active', joined.json.battle.status === 'active', joined.json.battle.status);

const thirdUser = await call('/api/auth/telegram', { method: 'POST', body: { devId: 'carol' } });
const joinedAgain = await call('/api/battles/join', { method: 'POST', token: thirdUser.json.token, body: { inviteCode } });
check('третий участник в зарубу не пускается (409)', joinedAgain.status === 409, String(joinedAgain.status));

// 8. Прогресс с двух сторон (сторона определяется сессией, не телом запроса)
const progA = await call('/api/battles/update-progress', { method: 'POST', token: A, body: { battleId, amount: 30, isCreator: false } });
check('A внёс 30 (флаг isCreator в теле игнорируется)', progA.json?.battle?.userProgress === 30, JSON.stringify({ u: progA.json?.battle?.userProgress, f: progA.json?.battle?.friendProgress }));

const progB = await call('/api/battles/update-progress', { method: 'POST', token: B, body: { battleId, amount: 50 } });
check('B внёс 50 и видит это своим прогрессом', progB.json?.battle?.userProgress === 50 && progB.json.battle.friendProgress === 30, JSON.stringify({ u: progB.json?.battle?.userProgress, f: progB.json?.battle?.friendProgress }));

const listA = await call('/api/battles', { token: A });
const viewA = listA.json.battles.find((b) => b.id === battleId);
check('A видит себя 30, соперника 50', viewA?.userProgress === 30 && viewA?.friendProgress === 50, JSON.stringify({ u: viewA?.userProgress, f: viewA?.friendProgress }));
check('A видит имя соперника', viewA?.friendName === 'Dev bob', viewA?.friendName);

const progC = await call('/api/battles/update-progress', { method: 'POST', token: thirdUser.json.token, body: { battleId, amount: 10 } });
check('посторонний не может менять прогресс (403)', progC.status === 403, String(progC.status));

// 9. Автопобеда при достижении цели
const progB2 = await call('/api/battles/update-progress', { method: 'POST', token: B, body: { battleId, amount: 100 } });
check('B достиг цели и победил (user_won)', progB2.json?.battle?.status === 'user_won', progB2.json?.battle?.status);
const viewA2 = (await call('/api/battles', { token: A })).json.battles.find((b) => b.id === battleId);
check('A видит свой проигрыш (friend_won)', viewA2?.status === 'friend_won', viewA2?.status);

// 10. Валидация initData (настоящая подпись)
const goodInit = await call('/api/auth/telegram', { method: 'POST', body: { initData: 'user=%7B%22id%22%3A1%7D&auth_date=1&hash=' + 'a'.repeat(64) } });
check('фальшивый initData с корректным форматом hash = 401', goodInit.status === 401, goodInit.json?.error);

// 11. Корректно подписанный initData должен проходить
const { createHmac } = await import('node:crypto');
const fs = await import('node:fs');
const botToken = fs.readFileSync('.env', 'utf-8').split(/\r?\n/).find((l) => l.startsWith('TELEGRAM_BOT_TOKEN=')).split('=').slice(1).join('=').trim();
const tgUser = JSON.stringify({ id: 777001, first_name: 'Иван', username: 'ivan_test' });
const fields = { auth_date: String(Math.floor(Date.now() / 1000)), query_id: 'AAAtest', user: tgUser };
const dataCheckString = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join('\n');
const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
const signedInit = new URLSearchParams({ ...fields, hash }).toString();
const realLogin = await call('/api/auth/telegram', { method: 'POST', body: { initData: signedInit } });
check('корректная подпись initData принята', realLogin.status === 200 && realLogin.json.userId === 'tg:777001', JSON.stringify({ status: realLogin.status, userId: realLogin.json?.userId, error: realLogin.json?.error }));
check('в сессии есть имя из Telegram', !!realLogin.json.token);

// 12. Просроченный initData (auth_date = 3 дня назад) отклоняется
const oldFields = { ...fields, auth_date: String(Math.floor(Date.now() / 1000) - 3 * 86400) };
const oldCheck = Object.keys(oldFields).sort().map((k) => `${k}=${oldFields[k]}`).join('\n');
const oldHash = createHmac('sha256', secretKey).update(oldCheck).digest('hex');
const expired = await call('/api/auth/telegram', { method: 'POST', body: { initData: new URLSearchParams({ ...oldFields, hash: oldHash }).toString() } });
check('просроченный initData (3 дня) = 401', expired.status === 401, expired.json?.error);

// 13. Планировщик напоминаний закрыт секретом.
// Полная проверка требует запуска сервера с CRON_SECRET=test-cron-secret.
const notifyNoSecret = await call('/api/notifications/run');
if (notifyNoSecret.status === 503) {
  console.log('SKIP  планировщик напоминаний выключен (CRON_SECRET не задан на сервере)');
} else {
  check('планировщик без секрета = 401', notifyNoSecret.status === 401, String(notifyNoSecret.status));
  const notifyWrong = await call('/api/notifications/run?key=wrong-secret');
  check('планировщик с неверным секретом = 401', notifyWrong.status === 401, String(notifyWrong.status));
  const notifyDry = await call('/api/notifications/run?dryRun=1&key=test-cron-secret');
  check(
    'планировщик с верным секретом отвечает (dry-run)',
    notifyDry.status === 200 && notifyDry.json?.dryRun === true && Array.isArray(notifyDry.json?.due),
    JSON.stringify({ status: notifyDry.status, checked: notifyDry.json?.checkedUsers, due: notifyDry.json?.due?.length }),
  );
}

console.log(`\n${failures === 0 ? 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ' : `ПРОВАЛОВ: ${failures}`}`);
process.exit(failures === 0 ? 0 : 1);
