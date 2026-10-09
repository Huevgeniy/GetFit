/**
 * Слой хранения данных GetFitBot.
 *
 * Два режима:
 *  - `postgres` — если задан DATABASE_URL (Supabase/Neon/любой Postgres). Основной режим.
 *  - `file`     — JSON-файл data/cloud_db.json. Только для локальной разработки:
 *                 на Render файловая система эфемерная и данные теряются при деплое.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Pool } from 'pg';

export type StorageMode = 'postgres' | 'file';

export interface BattleRecord {
  id: string;
  creatorId: string;
  opponentId: string | null;
  inviteCode: string;
  payload: Record<string, any>;
  status: string;
  createdAt: string;
  updatedAt: string;
}

type CollectionName = 'experiments' | 'cycles' | 'custom_metrics';
const COLLECTION_TABLES: Record<CollectionName, string> = {
  experiments: 'experiments',
  cycles: 'cycles',
  custom_metrics: 'custom_metrics',
};

let mode: StorageMode = 'file';
let pool: Pool | null = null;
let dbFile = '';
let writeChain: Promise<unknown> = Promise.resolve();

export function storageMode(): StorageMode {
  return mode;
}

export function generateInviteCode(): string {
  return crypto.randomBytes(6).toString('base64url').replace(/[-_]/g, '').slice(0, 8).toUpperCase();
}

/* ------------------------------------------------------------------ */
/* Инициализация                                                       */
/* ------------------------------------------------------------------ */

export async function initStorage(): Promise<StorageMode> {
  const url = process.env.DATABASE_URL?.trim();
  dbFile = path.join(process.env.DATA_DIR || path.join(process.cwd(), 'data'), 'cloud_db.json');

  if (url) {
    const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])/.test(url);
    pool = new Pool({
      connectionString: url,
      max: Number(process.env.PG_POOL_MAX) || 4,
      ssl: isLocal ? undefined : { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000,
    });
    pool.on('error', (err) => console.error('[storage] ошибка пула Postgres:', err.message));
    await migratePostgres();
    mode = 'postgres';
    console.log('[storage] режим: postgres');
    return mode;
  }

  mode = 'file';
  ensureFileDb();
  console.warn(
    `[storage] режим: file (${dbFile}). DATABASE_URL не задан — данные не переживут деплой/рестарт хостинга.`,
  );
  return mode;
}

async function migratePostgres(): Promise<void> {
  if (!pool) return;
  await pool.query(`
    create table if not exists user_state (
      user_id    text primary key,
      state      jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    );
    create table if not exists battles (
      id          text primary key,
      creator_id  text not null,
      opponent_id text,
      invite_code text unique not null,
      payload     jsonb not null default '{}'::jsonb,
      status      text not null default 'pending',
      created_at  timestamptz not null default now(),
      updated_at  timestamptz not null default now()
    );
    create index if not exists battles_creator_idx  on battles (creator_id);
    create index if not exists battles_opponent_idx on battles (opponent_id);
    create index if not exists battles_invite_idx   on battles (invite_code);
    create table if not exists experiments (
      user_id    text not null,
      id         text not null,
      payload    jsonb not null,
      updated_at timestamptz not null default now(),
      primary key (user_id, id)
    );
    create table if not exists cycles (
      user_id    text not null,
      id         text not null,
      payload    jsonb not null,
      updated_at timestamptz not null default now(),
      primary key (user_id, id)
    );
    create table if not exists custom_metrics (
      user_id    text not null,
      id         text not null,
      payload    jsonb not null,
      updated_at timestamptz not null default now(),
      primary key (user_id, id)
    );
  `);
}

export async function closeStorage(): Promise<void> {
  if (pool) {
    await pool.end().catch(() => undefined);
    pool = null;
  }
}

/* ------------------------------------------------------------------ */
/* Файловый режим (локальная разработка)                               */
/* ------------------------------------------------------------------ */

interface FileDb {
  users: Record<string, any>;
  battles: BattleRecord[];
  experiments: any[];
  cycles: any[];
  customMetrics: any[];
}

const EMPTY_DB: FileDb = { users: {}, battles: [], experiments: [], cycles: [], customMetrics: [] };

function ensureFileDb(): void {
  const dir = path.dirname(dbFile);
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(dbFile)) fs.writeFileSync(dbFile, JSON.stringify(EMPTY_DB, null, 2), 'utf-8');
  } catch (err) {
    console.error('[storage] не удалось создать файл БД:', err);
  }
}

function readFileDb(): FileDb {
  try {
    if (!fs.existsSync(dbFile)) return { ...EMPTY_DB };
    const parsed = JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
    return {
      users: parsed.users || {},
      battles: parsed.battles || [],
      experiments: parsed.experiments || [],
      cycles: parsed.cycles || [],
      customMetrics: parsed.customMetrics || [],
    };
  } catch {
    return { ...EMPTY_DB };
  }
}

/** Последовательная запись в файл: исключает перетирание при параллельных запросах. */
function writeFileDb(mutator: (db: FileDb) => void): Promise<void> {
  writeChain = writeChain.then(() => {
    const db = readFileDb();
    mutator(db);
    ensureFileDb();
    fs.writeFileSync(dbFile, JSON.stringify(db, null, 2), 'utf-8');
  });
  return writeChain as Promise<void>;
}

const fileKey = (name: CollectionName): keyof FileDb =>
  ({ experiments: 'experiments', cycles: 'cycles', custom_metrics: 'customMetrics' } as const)[name];

/* ------------------------------------------------------------------ */
/* Состояние пользователя                                              */
/* ------------------------------------------------------------------ */

export async function getUserState(userId: string): Promise<{ state: any; updatedAt: string } | null> {
  if (mode === 'postgres' && pool) {
    const { rows } = await pool.query('select state, updated_at from user_state where user_id = $1', [userId]);
    if (!rows.length) return null;
    return { state: rows[0].state, updatedAt: new Date(rows[0].updated_at).toISOString() };
  }
  const db = readFileDb();
  const state = db.users[userId];
  if (!state) return null;
  return { state, updatedAt: state.lastSyncedAt || new Date().toISOString() };
}

export async function saveUserState(userId: string, state: unknown): Promise<string> {
  const payload = { ...(state as Record<string, any>), lastSyncedAt: new Date().toISOString() };
  if (mode === 'postgres' && pool) {
    await pool.query(
      `insert into user_state (user_id, state, updated_at) values ($1, $2, now())
       on conflict (user_id) do update set state = excluded.state, updated_at = now()`,
      [userId, payload],
    );
    return payload.lastSyncedAt;
  }
  await writeFileDb((db) => {
    db.users[userId] = payload;
  });
  return payload.lastSyncedAt;
}

/* ------------------------------------------------------------------ */
/* Зарубы                                                              */
/* ------------------------------------------------------------------ */

function rowToBattle(row: any): BattleRecord {
  return {
    id: row.id,
    creatorId: row.creator_id,
    opponentId: row.opponent_id ?? null,
    inviteCode: row.invite_code,
    payload: row.payload ?? {},
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function listUserBattles(userId: string): Promise<BattleRecord[]> {
  if (mode === 'postgres' && pool) {
    const { rows } = await pool.query(
      `select * from battles where creator_id = $1 or opponent_id = $1 order by created_at desc limit 200`,
      [userId],
    );
    return rows.map(rowToBattle);
  }
  const db = readFileDb();
  return db.battles.filter((b) => b.creatorId === userId || b.opponentId === userId);
}

export async function getBattleByInvite(inviteCode: string): Promise<BattleRecord | null> {
  if (mode === 'postgres' && pool) {
    const { rows } = await pool.query('select * from battles where invite_code = $1', [
      inviteCode.trim().toUpperCase(),
    ]);
    return rows.length ? rowToBattle(rows[0]) : null;
  }
  const db = readFileDb();
  return db.battles.find((b) => b.inviteCode?.toUpperCase() === inviteCode.trim().toUpperCase()) || null;
}

export async function getBattleById(id: string): Promise<BattleRecord | null> {
  if (mode === 'postgres' && pool) {
    const { rows } = await pool.query('select * from battles where id = $1', [id]);
    return rows.length ? rowToBattle(rows[0]) : null;
  }
  const db = readFileDb();
  return db.battles.find((b) => b.id === id) || null;
}

export async function saveBattle(battle: BattleRecord): Promise<BattleRecord> {
  if (mode === 'postgres' && pool) {
    const { rows } = await pool.query(
      `insert into battles (id, creator_id, opponent_id, invite_code, payload, status)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (id) do update
         set opponent_id = excluded.opponent_id,
             payload     = excluded.payload,
             status      = excluded.status,
             updated_at  = now()
       returning *`,
      [
        battle.id,
        battle.creatorId,
        battle.opponentId,
        battle.inviteCode,
        battle.payload,
        battle.status,
      ],
    );
    return rowToBattle(rows[0]);
  }
  await writeFileDb((db) => {
    const idx = db.battles.findIndex((b) => b.id === battle.id);
    const record = { ...battle, updatedAt: new Date().toISOString() };
    if (idx >= 0) db.battles[idx] = { ...db.battles[idx], ...record };
    else db.battles.unshift(record);
  });
  return battle;
}

/* ------------------------------------------------------------------ */
/* Коллекции пользователя: эксперименты, циклы, кастомные метрики       */
/* ------------------------------------------------------------------ */

export async function listCollection(name: CollectionName, userId: string): Promise<any[]> {
  if (mode === 'postgres' && pool) {
    const { rows } = await pool.query(
      `select payload from ${COLLECTION_TABLES[name]} where user_id = $1 order by updated_at desc limit 500`,
      [userId],
    );
    return rows.map((r) => r.payload);
  }
  const key = fileKey(name);
  return (readFileDb()[key] as any[]).filter((item) => item.userId === userId);
}

export async function upsertCollectionItem(name: CollectionName, userId: string, item: any): Promise<any> {
  const record = { ...item, userId };
  if (mode === 'postgres' && pool) {
    await pool.query(
      `insert into ${COLLECTION_TABLES[name]} (user_id, id, payload) values ($1, $2, $3)
       on conflict (user_id, id) do update set payload = excluded.payload, updated_at = now()`,
      [userId, String(item.id), record],
    );
    return record;
  }
  const key = fileKey(name);
  await writeFileDb((db) => {
    const list = db[key] as any[];
    const idx = list.findIndex((entry) => entry.id === item.id && entry.userId === userId);
    if (idx >= 0) list[idx] = { ...list[idx], ...record };
    else list.unshift(record);
  });
  return record;
}
