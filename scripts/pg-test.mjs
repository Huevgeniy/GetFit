/**
 * Проверка Postgres-ветки хранилища на настоящем SQL-движке (pg-mem, in-memory).
 * Внешняя база не нужна: проверяются миграции и все запросы server/storage.ts.
 * Запуск: npm run test:pg
 */
import { newDb } from 'pg-mem';

let failures = 0;
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' :: ' + extra : ''}`);
  if (!cond) failures += 1;
};

const db = newDb();
const { Pool } = db.adapters.createPg();
const pool = new Pool();

delete process.env.DATABASE_URL;
const storage = await import('../server/storage.ts');

let mode;
try {
  mode = await storage.initStorage({ pool });
} catch (err) {
  console.log('FAIL  миграции Postgres не выполнились ::', err.message);
  process.exit(1);
}
check('миграции выполнились, режим postgres', mode === 'postgres', String(mode));

const A = 'tg:111';
const B = 'tg:222';

// 1. Состояние пользователя (jsonb)
check('новый пользователь не найден', (await storage.getUserState(A)) === null);
const savedAt = await storage.saveUserState(A, { user: { name: 'Иван' }, pastWorkouts: [{ id: 'w1' }] });
check('saveUserState вернул отметку времени', typeof savedAt === 'string' && savedAt.length > 10, savedAt);
const loaded = await storage.getUserState(A);
check(
  'jsonb прочитан обратно без потерь',
  loaded?.state?.user?.name === 'Иван' && loaded?.state?.pastWorkouts?.[0]?.id === 'w1',
  JSON.stringify(loaded?.state),
);
check('состояния разных пользователей не смешиваются', (await storage.getUserState(B)) === null);

// 2. Повторная запись = upsert, а не ошибка дубликата
let upsertOk = true;
try {
  await storage.saveUserState(A, { user: { name: 'Иван', weight: 82 } });
} catch (err) {
  upsertOk = false;
  console.log('      ошибка upsert:', err.message);
}
const reloaded = await storage.getUserState(A);
check('повторное сохранение обновляет строку', upsertOk && reloaded?.state?.user?.weight === 82, JSON.stringify(reloaded?.state?.user));

// 3. Зарубы: создание, поиск по коду, присоединение
check('у нового пользователя нет заруб', (await storage.listUserBattles(A)).length === 0);
const invite = storage.generateInviteCode();
const created = await storage.saveBattle({
  id: 'battle_1',
  creatorId: A,
  opponentId: null,
  inviteCode: invite,
  payload: { title: 'Кто больше жмёт', targetGoal: 100, creatorProgress: 0 },
  status: 'pending',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});
check('заруба создана и прочитана обратно', created.id === 'battle_1' && created.inviteCode === invite, JSON.stringify(created.inviteCode));
check('поиск по коду приглашения работает', (await storage.getBattleByInvite(invite))?.id === 'battle_1');
check('код приглашения не зависит от регистра', (await storage.getBattleByInvite(invite.toLowerCase()))?.id === 'battle_1');
check('создатель видит зарубу', (await storage.listUserBattles(A)).length === 1);
check('посторонний зарубу не видит', (await storage.listUserBattles(B)).length === 0);

const joined = await storage.saveBattle({ ...created, opponentId: B, status: 'active', payload: { ...created.payload, opponentProgress: 0 } });
check('присоединение сохранилось', joined.opponentId === B && joined.status === 'active', JSON.stringify({ opp: joined.opponentId, status: joined.status }));
check('после присоединения зарубу видят оба', (await storage.listUserBattles(B)).length === 1);

// 4. Прогресс: обновление payload (jsonb) без потери остальных полей
await storage.saveBattle({ ...joined, payload: { ...joined.payload, creatorProgress: 30, opponentProgress: 50 } });
const progressed = await storage.getBattleById('battle_1');
check(
  'прогресс обеих сторон сохранён',
  progressed?.payload?.creatorProgress === 30 && progressed?.payload?.opponentProgress === 50 && progressed?.payload?.title === 'Кто больше жмёт',
  JSON.stringify(progressed?.payload),
);

// 5. Коллекции: upsert по составному ключу (user_id, id)
await storage.upsertCollectionItem('experiments', A, { id: 'e1', title: 'Креатин' });
await storage.upsertCollectionItem('experiments', A, { id: 'e1', title: 'Креатин 5г' });
const experimentsA = await storage.listCollection('experiments', A);
check('повторный upsert обновляет, а не дублирует', experimentsA.length === 1 && experimentsA[0].title === 'Креатин 5г', JSON.stringify(experimentsA));
await storage.upsertCollectionItem('experiments', B, { id: 'e1', title: 'Свой эксперимент' });
check('одинаковый id у разных пользователей не конфликтует', (await storage.listCollection('experiments', A)).length === 1 && (await storage.listCollection('experiments', B)).length === 1);
check('эксперименты разных пользователей изолированы', (await storage.listCollection('experiments', B))[0].title === 'Свой эксперимент');

await storage.upsertCollectionItem('cycles', A, { id: 'c1', title: 'Силовой блок' });
check('таблица cycles работает', (await storage.listCollection('cycles', A))[0].title === 'Силовой блок');
await storage.upsertCollectionItem('custom_metrics', A, { id: 'm1', name: 'Обхват бедра' });
check('таблица custom_metrics работает', (await storage.listCollection('custom_metrics', A))[0].name === 'Обхват бедра');

// 6. Уникальность кода приглашения на уровне схемы
let duplicateRejected = false;
try {
  await storage.saveBattle({ ...created, id: 'battle_2', inviteCode: invite });
} catch {
  duplicateRejected = true;
}
check('дубликат кода приглашения отклонён базой', duplicateRejected);

await storage.closeStorage();
console.log(`\n${failures === 0 ? 'ВСЕ ПРОВЕРКИ POSTGRES ПРОЙДЕНЫ' : `ПРОВАЛОВ: ${failures}`}`);
process.exit(failures === 0 ? 0 : 1);
