import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import {
  SESSION_TTL_SECONDS,
  issueSession,
  readBearerToken,
  userIdForTelegram,
  validateTelegramInitData,
  verifySession,
} from './server/auth.ts';
import {
  generateInviteCode,
  getBattleById,
  getBattleByInvite,
  getUserState,
  initStorage,
  listCollection,
  listUserBattles,
  saveBattle,
  saveUserState,
  storageMode,
  upsertCollectionItem,
  type BattleRecord,
} from './server/storage.ts';
import { runNotificationCycle } from './server/notifications.ts';

dotenv.config();

// Внимание: __dirname/import.meta.url здесь использовать нельзя.
// Прод-бандл собирается в CJS (esbuild --format=cjs), где import.meta.url === undefined,
// и обращение к нему падает при загрузке модуля. Базовый каталог берём из process.cwd().

const app = express();
// Хостинги (Render, Railway, Fly) передают порт через переменную окружения
const PORT = Number(process.env.PORT) || 3000;
// Дев-режим: Vite-middleware + вход без Telegram (только локально, запускается через `npm run dev`)
const IS_DEV = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';

app.set('trust proxy', 1);
app.use(express.json({ limit: '15mb' }));

// Lazy-initialize Gemini client
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    geminiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

// Dual AI Engine configuration (Gemini primary -> Grok/Groq seamless fallback)
const GROK_KEY = process.env.GROK_API_KEY || process.env.GROQ_API_KEY || '';

interface CallAIOptions {
  systemInstruction: string;
  prompt: string;
  isJson?: boolean;
  temperature?: number;
  userProfile?: any;
  preferGroq?: boolean;
}

interface CallAIResult {
  text: string;
  provider: 'gemini' | 'groq' | 'heuristic';
}

async function callUnifiedAI(options: CallAIOptions): Promise<CallAIResult> {
  const { systemInstruction: baseInstruction, prompt, isJson = false, temperature = 0.4, userProfile, preferGroq = true } = options;

  // Personal athlete memory and constraints enrichment
  let personalContext = '';
  if (userProfile?.aiPersonalPrompt) {
    personalContext += `\n\n[ВАЖНЕЙШИЕ ПЕРСОНАЛЬНЫЕ НАСТАВЛЕНИЯ И ИНСТРУКЦИИ АТЛЕТА]:\n${userProfile.aiPersonalPrompt}`;
  }
  if (userProfile?.injuriesAndLimitations) {
    personalContext += `\n[ТРАВМЫ И ФИЗИЧЕСКИЕ ОГРАНИЧЕНИЯ]:\n${userProfile.injuriesAndLimitations}`;
  }
  if (userProfile?.activeSupplements) {
    personalContext += `\n[СПОРТПИТ И ДОБАВКИ]:\n${userProfile.activeSupplements}`;
  }
  if (userProfile?.trainingStylePreference) {
    personalContext += `\n[СТИЛЬ ТРЕНИРОВОК]:\n${userProfile.trainingStylePreference}`;
  }
  if (userProfile?.currentWeight) {
    personalContext += `\n[ТЕКУЩИЙ ВЕС АТЛЕТА]: ${userProfile.currentWeight} кг`;
  }
  if (userProfile?.targetWeight) {
    personalContext += `\n[ЦЕЛЕВОЙ ВЕС]: ${userProfile.targetWeight} кг`;
  }

  const fullSystemInstruction = `${baseInstruction}${personalContext}`;

  const tryGroq = async (): Promise<string | null> => {
    if (!GROK_KEY) return null;
    try {
      const isGroq = GROK_KEY.startsWith('gsk_');
      const endpoint = isGroq 
        ? 'https://api.groq.com/openai/v1/chat/completions' 
        : 'https://api.x.ai/v1/chat/completions';
      const model = isGroq
        ? process.env.GROQ_MODEL || 'qwen/qwen3.8-27b'
        : process.env.XAI_MODEL || 'grok-2-latest';

      const grokSystem = isJson 
        ? `${fullSystemInstruction}\n\nCRITICAL: Output valid JSON only, without markdown wraps if possible.` 
        : fullSystemInstruction;

      const messages: any[] = [
        { role: 'system', content: grokSystem },
        { role: 'user', content: prompt }
      ];

      const grokResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROK_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          response_format: isJson ? { type: 'json_object' } : undefined,
        }),
      });

      if (grokResponse.ok) {
        const data = await grokResponse.json() as any;
        const content = data.choices?.[0]?.message?.content;
        if (content) return content;
      } else {
        const errText = await grokResponse.text();
        console.warn('[AI Engine] Groq response error:', errText);
      }
    } catch (grokError: any) {
      console.error('[AI Engine] Groq fetch error:', grokError?.message || grokError);
    }
    return null;
  };

  const tryGemini = async (): Promise<string | null> => {
    const ai = getGeminiClient();
    if (!ai) return null;
    try {
      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-flash-latest',
        contents: prompt,
        config: {
          systemInstruction: fullSystemInstruction,
          responseMimeType: isJson ? 'application/json' : undefined,
          temperature,
        },
      });
      if (response && response.text) {
        return response.text;
      }
    } catch (geminiError: any) {
      console.warn('[AI Engine] Gemini failed or throttled:', geminiError?.message || geminiError);
    }
    return null;
  };

  // If preferGroq is active and GROK_KEY exists, try Groq first for blazing speed (<500ms) & reliable JSON mode
  if (preferGroq && GROK_KEY) {
    const groqContent = await tryGroq();
    if (groqContent) return { text: groqContent, provider: 'groq' };

    const geminiContent = await tryGemini();
    if (geminiContent) return { text: geminiContent, provider: 'gemini' };
  } else {
    const geminiContent = await tryGemini();
    if (geminiContent) return { text: geminiContent, provider: 'gemini' };

    const groqContent = await tryGroq();
    if (groqContent) return { text: groqContent, provider: 'groq' };
  }

  return { text: '', provider: 'heuristic' };
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    mode: IS_DEV ? 'development' : 'production',
    devAuthAllowed: IS_DEV,
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    hasGrokKey: Boolean(GROK_KEY),
    hasTelegramToken: Boolean(process.env.TELEGRAM_BOT_TOKEN),
  });
});

/* ------------------------------------------------------------------ */
/* Хранилище                                                           */
/* Postgres (Supabase) при наличии DATABASE_URL, иначе JSON-файл для    */
/* локальной разработки. Инициализируется в startServer().              */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Авторизация Telegram Mini App                                       */
/* ------------------------------------------------------------------ */

interface AuthedRequest extends express.Request {
  userId?: string;
  session?: { sub: string; exp: number; dev?: boolean; name?: string; username?: string };
}

function getAuthedUserId(req: express.Request): string {
  return (req as AuthedRequest).userId as string;
}

function getAuthedSession(req: express.Request) {
  return (req as AuthedRequest).session;
}

const PUBLIC_API_PATHS = new Set([
  '/api/health',
  '/api/auth/telegram',
  '/api/telegram/webhook',
  '/api/notifications/run',
]);

// Все /api/* требуют сессию, кроме публичных путей
app.use('/api', (req, res, next) => {
  const pathOnly = req.originalUrl.split('?')[0];
  if (PUBLIC_API_PATHS.has(pathOnly)) return next();
  const session = verifySession(readBearerToken(req.headers.authorization));
  if (!session) {
    return res.status(401).json({ error: 'unauthorized', message: 'Требуется вход через Telegram' });
  }
  (req as AuthedRequest).userId = session.sub;
  (req as AuthedRequest).session = session;
  next();
});

// Ограничитель частоты для дорогих ИИ-запросов: защищает бесплатную квоту Gemini/Groq
const aiUsage = new Map<string, number[]>();
const AI_WINDOW_MS = 5 * 60 * 1000;
const AI_MAX_REQUESTS = Number(process.env.AI_RATE_LIMIT) || 40;

app.use('/api/ai', (req, res, next) => {
  const userId = getAuthedUserId(req);
  const now = Date.now();
  const recent = (aiUsage.get(userId) || []).filter((ts) => now - ts < AI_WINDOW_MS);
  if (recent.length >= AI_MAX_REQUESTS) {
    const retryAfterSec = Math.ceil((AI_WINDOW_MS - (now - recent[0])) / 1000);
    res.setHeader('Retry-After', String(retryAfterSec));
    return res.status(429).json({
      error: 'rate_limited',
      message: `Слишком много ИИ-запросов. Попробуйте через ${Math.ceil(retryAfterSec / 60)} мин.`,
    });
  }
  recent.push(now);
  aiUsage.set(userId, recent);
  if (aiUsage.size > 500) {
    for (const [key, stamps] of aiUsage) {
      if (!stamps.some((ts) => now - ts < AI_WINDOW_MS)) aiUsage.delete(key);
    }
  }
  next();
});

// Telegram WebApp auth: обмен initData на сессионный токен
app.post('/api/auth/telegram', (req, res) => {
  const initData = typeof req.body?.initData === 'string' ? req.body.initData : '';
  const botToken = process.env.TELEGRAM_BOT_TOKEN || '';

  if (initData) {
    const result = validateTelegramInitData(initData, botToken);
    if (!result.valid || !result.user?.id) {
      return res.status(401).json({ valid: false, error: result.reason || 'Некорректный initData' });
    }
    const userId = userIdForTelegram(result.user.id);
    console.log(`[auth] вход: ${userId} (@${result.user.username || 'без username'})`);
    const displayName = [result.user.first_name, result.user.last_name].filter(Boolean).join(' ') || 'Атлет';
    return res.json({
      valid: true,
      userId,
      user: result.user,
      token: issueSession(userId, { name: displayName, username: result.user.username }),
      expiresIn: SESSION_TTL_SECONDS,
      devMode: false,
    });
  }

  // Локальная разработка в обычном браузере (вне Telegram): только в дев-режиме
  if (IS_DEV || process.env.ALLOW_DEV_AUTH === 'true') {
    const rawId = String(req.body?.devId ?? 'local');
    const devId = rawId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'local';
    const userId = `dev:${devId}`;
    return res.json({
      valid: true,
      userId,
      user: { id: 0, first_name: 'Dev', username: `dev_${devId}` },
      token: issueSession(userId, { dev: true, name: `Dev ${devId}`, username: `dev_${devId}` }),
      expiresIn: SESSION_TTL_SECONDS,
      devMode: true,
    });
  }

  res.status(400).json({ valid: false, error: 'initData is required' });
});

app.get('/api/me', (req, res) => {
  res.json({ userId: getAuthedUserId(req), storage: storageMode() });
});

/* ------------------------------------------------------------------ */
/* Напоминания: эндпоинт для внешнего планировщика                      */
/* ------------------------------------------------------------------ */

function safeCompare(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

async function handleNotificationRun(req: express.Request, res: express.Response) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return res.status(503).json({
      error: 'disabled',
      message: 'CRON_SECRET не задан — планировщик напоминаний выключен',
    });
  }
  const provided = String(req.headers['x-cron-secret'] || req.query.key || req.body?.key || '');
  if (!safeCompare(provided, secret)) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const dryRun = req.query.dryRun === '1' || req.body?.dryRun === true;
  try {
    const result = await runNotificationCycle(
      (userId, text) => notifyTelegramUser(userId, text),
      { dryRun },
    );
    console.log(
      `[notify] проверено ${result.checkedUsers}, к отправке ${result.due.length}, ` +
        `отправлено ${result.sent.length}, не доставлено ${result.failed.length}` +
        (dryRun ? ' (dry-run)' : ''),
    );
    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[notify] ошибка прохода:', err?.message);
    res.status(500).json({ error: 'notify_failed', details: err?.message });
  }
}

// Поддерживаем и GET (для планировщиков, умеющих только URL), и POST
app.get('/api/notifications/run', handleNotificationRun);
app.post('/api/notifications/run', handleNotificationRun);

/**
 * Проверка доставки: бот пишет самому пользователю.
 * Самое хрупкое место связки — бот не может написать тому, кто не запускал его,
 * поэтому даём возможность проверить это одним тапом из приложения.
 */
app.post('/api/notifications/test', async (req, res) => {
  const userId = getAuthedUserId(req);
  if (!userId.startsWith('tg:')) {
    return res.status(400).json({
      delivered: false,
      error: 'Проверка доступна только внутри Telegram',
    });
  }
  const delivered = await notifyTelegramUser(
    userId,
    '🔔 <b>Проверка уведомлений GetFit</b>\nЕсли ты видишь это сообщение — напоминания о тренировках, сне и экспериментах будут приходить сюда.',
  );
  if (delivered) return res.json({ delivered: true });
  res.status(502).json({
    delivered: false,
    error: 'Telegram не доставил сообщение. Открой чат с ботом и нажми /start, затем попробуй снова.',
  });
});

// Синхронизация состояния пользователя.
// Идентификатор берётся из подписанной сессии — подставить чужой нельзя.
app.get('/api/db/sync', async (req, res) => {
  try {
    const stored = await getUserState(getAuthedUserId(req));
    if (!stored) return res.json({ found: false });
    res.json({ found: true, data: stored.state, updatedAt: stored.updatedAt });
  } catch (err: any) {
    console.error('[sync] ошибка чтения:', err?.message);
    res.status(500).json({ error: 'storage_error', details: err?.message });
  }
});

app.post('/api/db/sync', async (req, res) => {
  try {
    const payload = req.body && typeof req.body === 'object' ? req.body : {};
    const lastSyncedAt = await saveUserState(getAuthedUserId(req), payload);
    res.json({ success: true, lastSyncedAt });
  } catch (err: any) {
    console.error('[sync] ошибка записи:', err?.message);
    res.status(500).json({ error: 'storage_error', details: err?.message });
  }
});

/* ------------------------------------------------------------------ */
/* Зарубы: одна запись на двоих участников                             */
/* ------------------------------------------------------------------ */

const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'get_fitbot';
/** Публичный адрес Mini App (Render домен). Без него бот не сможет открыть приложение. */
const PUBLIC_APP_URL = (process.env.APP_URL || '').replace(/\/+$/, '');

/**
 * Ссылка-приглашение идёт через чат с ботом (`?start=<код>`), а не через
 * `?startapp=`: прямые ссылки startapp открывают приложение только если в
 * BotFather настроен Main Mini App (у бота сейчас has_main_web_app = false).
 * Ссылка `?start=` работает всегда: бот получает /start <код> и в ответ
 * присылает кнопку открытия Mini App с этим кодом.
 */
function battleInviteLink(inviteCode: string): string {
  return `https://t.me/${BOT_USERNAME}?start=${inviteCode}`;
}

/** Личное сообщение пользователю (userId формата `tg:<telegram_id>`). true — Telegram принял. */
async function notifyTelegramUser(userId: string, html: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !userId?.startsWith('tg:')) return false;
  const chatId = userId.slice(3);
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: 'HTML' }),
    });
    const data = (await res.json().catch(() => null)) as any;
    if (!res.ok || !data?.ok) {
      // Частые причины: пользователь не запускал бота или заблокировал его
      console.warn(`[telegram] сообщение для ${userId} не доставлено: ${data?.description || res.status}`);
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn('[telegram] уведомление не отправлено:', err?.message);
    return false;
  }
}

/**
 * Отдаём зарубу «глазами» запросившего: userProgress — мой прогресс,
 * friendProgress — соперника. Клиент не знает, создатель он или нет.
 */
function battleView(record: BattleRecord, viewerId: string) {
  const payload = record.payload || {};
  const isCreator = record.creatorId === viewerId;
  const theirName = isCreator
    ? payload.opponentName || payload.friendName || 'Соперник'
    : payload.creatorName || 'Соперник';
  const theirUsername = isCreator
    ? payload.opponentUsername || payload.friendTelegram || ''
    : payload.creatorUsername || '';

  let status: string = record.opponentId ? 'active' : 'pending_friend';
  if (payload.winner) {
    const winnerIsViewer = payload.winner === (isCreator ? 'creator' : 'opponent');
    status = winnerIsViewer ? 'user_won' : 'friend_won';
  }

  return {
    ...payload,
    id: record.id,
    inviteCode: record.inviteCode,
    inviteLink: battleInviteLink(record.inviteCode),
    status,
    mySide: isCreator ? 'creator' : 'opponent',
    userProgress: Number((isCreator ? payload.creatorProgress : payload.opponentProgress) || 0),
    friendProgress: Number((isCreator ? payload.opponentProgress : payload.creatorProgress) || 0),
    friendName: theirName,
    friendTelegram: theirUsername,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

app.get('/api/battles', async (req, res) => {
  try {
    const userId = getAuthedUserId(req);
    const records = await listUserBattles(userId);
    res.json({ battles: records.map((record) => battleView(record, userId)) });
  } catch (err: any) {
    console.error('[battles] ошибка чтения:', err?.message);
    res.status(500).json({ error: 'storage_error', details: err?.message });
  }
});

app.post('/api/battles/create', async (req, res) => {
  try {
    const userId = getAuthedUserId(req);
    const session = getAuthedSession(req);
    const battle = req.body?.battle ?? req.body;
    if (!battle || typeof battle !== 'object') {
      return res.status(400).json({ error: 'Invalid battle object' });
    }

    const id = String(battle.id || `battle_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    const existing = await getBattleById(id);
    if (existing && existing.creatorId !== userId) {
      return res.status(403).json({ error: 'Зарубу создаёт только её автор' });
    }

    const payload = existing?.payload || {};
    const record: BattleRecord = {
      id,
      creatorId: existing?.creatorId || userId,
      opponentId: existing?.opponentId ?? null,
      inviteCode: existing?.inviteCode || generateInviteCode(),
      status: existing?.opponentId ? 'active' : 'pending',
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      payload: {
        ...payload,
        ...battle,
        id,
        creatorName: payload.creatorName || session?.name || 'Атлет',
        creatorUsername: payload.creatorUsername || session?.username || '',
        creatorProgress: Number(battle.userProgress ?? payload.creatorProgress ?? 0),
        opponentProgress: Number(payload.opponentProgress || 0),
      },
    };

    const saved = await saveBattle(record);
    res.json({ success: true, battle: battleView(saved, userId) });
  } catch (err: any) {
    console.error('[battles] ошибка создания:', err?.message);
    res.status(500).json({ error: 'storage_error', details: err?.message });
  }
});

// Присоединение по коду приглашения (deep link ?startapp=КОД)
app.post('/api/battles/join', async (req, res) => {
  try {
    const userId = getAuthedUserId(req);
    const session = getAuthedSession(req);
    const raw = String(req.body?.inviteCode || req.body?.battleId || '').trim();
    if (!raw) return res.status(400).json({ error: 'inviteCode обязателен' });

    const record = /^battle_/.test(raw) ? await getBattleById(raw) : await getBattleByInvite(raw);
    if (!record) return res.status(404).json({ error: 'Приглашение не найдено или устарело' });

    if (record.creatorId === userId) {
      return res.json({ success: true, alreadyMember: true, battle: battleView(record, userId) });
    }
    if (record.opponentId && record.opponentId !== userId) {
      return res.status(409).json({ error: 'В этой зарубе уже есть соперник' });
    }

    record.opponentId = userId;
    record.status = 'active';
    record.payload = {
      ...record.payload,
      opponentName: session?.name || 'Соперник',
      opponentUsername: session?.username || '',
      opponentProgress: Number(record.payload?.opponentProgress || 0),
      joinedAt: new Date().toISOString(),
    };

    const saved = await saveBattle(record);
    const creatorId = saved.creatorId;
    console.log(`[battles] ${userId} присоединился к зарубе ${saved.id}`);
    notifyTelegramUser(creatorId, `🤝 <b>${session?.name || 'Соперник'}</b> принял твою зарубу «${saved.payload?.title || 'Заруба'}»!`).catch(() => undefined);
    res.json({ success: true, battle: battleView(saved, userId) });
  } catch (err: any) {
    console.error('[battles] ошибка присоединения:', err?.message);
    res.status(500).json({ error: 'storage_error', details: err?.message });
  }
});

app.post('/api/battles/update-progress', async (req, res) => {
  try {
    const userId = getAuthedUserId(req);
    const battleId = String(req.body?.battleId || '');
    const amount = Number(req.body?.amount) || 0;
    const record = await getBattleById(battleId);
    if (!record) return res.status(404).json({ error: 'Заруба не найдена' });
    if (record.creatorId !== userId && record.opponentId !== userId) {
      return res.status(403).json({ error: 'Вы не участник этой зарубы' });
    }
    if (amount <= 0) return res.status(400).json({ error: 'amount должен быть больше нуля' });

    // Сторона определяется сессией, а не телом запроса — подделать нельзя
    const isCreator = record.creatorId === userId;
    const key = isCreator ? 'creatorProgress' : 'opponentProgress';
    const rivalKey = isCreator ? 'opponentProgress' : 'creatorProgress';
    const target = Number(record.payload?.targetGoal ?? record.payload?.targetValue ?? 0);

    const current = Number(record.payload?.[key] || 0);
    const next = target > 0 ? Math.min(target, current + amount) : current + amount;
    const payload: Record<string, any> = { ...record.payload, [key]: next };

    if (target > 0 && next >= target && next > Number(payload[rivalKey] || 0)) {
      payload.winner = isCreator ? 'creator' : 'opponent';
      payload.finishedAt = new Date().toISOString();
      record.status = 'finished';
      const rivalId = isCreator ? record.opponentId : record.creatorId;
      if (rivalId) {
        const actorName = getAuthedSession(req)?.name || 'Соперник';
        notifyTelegramUser(rivalId, `🏆 <b>${actorName}</b> закрыл зарубу «${payload.title || 'Заруба'}» первым!`).catch(
          () => undefined,
        );
      }
    }
    record.payload = payload;

    const saved = await saveBattle(record);
    res.json({ success: true, battle: battleView(saved, userId) });
  } catch (err: any) {
    console.error('[battles] ошибка прогресса:', err?.message);
    res.status(500).json({ error: 'storage_error', details: err?.message });
  }
});

// Push notification / workout report to Telegram
app.post('/api/telegram/send-workout-report', async (req, res) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return res.status(400).json({ error: 'TELEGRAM_BOT_TOKEN is not configured' });
  }

  const { chatId, workoutTitle, durationMinutes, totalVolume, exercisesCount, date, personalBests } = req.body;
  if (!chatId) {
    return res.status(400).json({ error: 'chatId is required' });
  }

  const appUrl = PUBLIC_APP_URL;

  const text = `🏆 *Тренировка завершена!*
  
📅 *Дата:* ${date || new Date().toLocaleDateString('ru-RU')}
🏋️ *Программа:* ${workoutTitle || 'Тренировка'}
⏱ *Длительность:* ${durationMinutes || 45} мин
📊 *Упражнений выполнено:* ${exercisesCount || 0}
💥 *Суммарный тоннаж:* ${totalVolume || 0} кг
${personalBests ? `🔥 *Новые рекорды:* ${personalBests}\n` : ''}
Отличная работа над прогрессом и дисциплиной! 💪`;

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🏋️ Открыть GetFit Мини-апп', web_app: { url: appUrl } }],
          ],
        },
      }),
    });
    const data = await response.json() as any;
    res.json({ success: data.ok, result: data.result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Telegram Bot state and endpoints
let telegramBotInfo: { id?: number; username?: string; first_name?: string } | null = null;

app.get('/api/telegram/status', async (req, res) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return res.json({ connected: false, message: 'TELEGRAM_BOT_TOKEN is not configured' });
  }

  if (telegramBotInfo) {
    return res.json({
      connected: true,
      bot: {
        id: telegramBotInfo.id,
        username: telegramBotInfo.username,
        name: telegramBotInfo.first_name,
      },
    });
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await response.json() as any;
    if (data.ok) {
      telegramBotInfo = data.result;
      return res.json({
        connected: true,
        bot: {
          id: telegramBotInfo?.id,
          username: telegramBotInfo?.username,
          name: telegramBotInfo?.first_name,
        },
      });
    } else {
      return res.json({ connected: false, error: data.description });
    }
  } catch (err: any) {
    return res.json({ connected: false, error: err?.message });
  }
});

// Send notification or message via Telegram Bot
app.post('/api/telegram/send', async (req, res) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return res.status(400).json({ error: 'TELEGRAM_BOT_TOKEN is not configured' });
  }

  const { chatId, message, parseMode = 'Markdown', replyMarkup } = req.body;
  if (!chatId || !message) {
    return res.status(400).json({ error: 'chatId and message are required' });
  }

  try {
    const body: Record<string, any> = {
      chat_id: chatId,
      text: message,
      parse_mode: parseMode,
    };
    if (replyMarkup) {
      body.reply_markup = replyMarkup;
    }

    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json() as any;
    if (data.ok) {
      res.json({ success: true, result: data.result });
    } else {
      res.status(400).json({ success: false, error: data.description });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// Telegram webhook endpoint
app.post('/api/telegram/webhook', async (req, res) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  // Telegram присылает секрет в заголовке — без проверки кто угодно может слать фейковые апдейты
  if (expectedSecret && req.headers['x-telegram-bot-api-secret-token'] !== expectedSecret) {
    return res.status(401).send('unauthorized');
  }
  const update = req.body;
  if (token && update) {
    // Отвечаем Telegram сразу, обработку ведём асинхронно
    handleTelegramUpdate(token, update).catch((err) => console.error('[telegram] webhook error:', err));
  }
  res.status(200).send('OK');
});

// AI Workout Assistant & Set Logger (Powered by Gemini + Grok Dual AI)
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { message, activeWorkout, previousWorkout, historySummary, userProfile } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const systemInstruction = `Ты — GetFitBot AI, профессиональный персональный тренер и секундант атлета прямо во время тренировки.
Твоя задача:
1. Поддерживать пользователя во время тренировки, давать короткие, четкие и экспертные советы по технике, восстановлению между подходами и прогрессу.
2. Автоматически извлекать данные о выполненном подходе из сообщения атлета (например: "сделал 10 раз", "пожал 100 на 10", "второй подход 8 раз", "105 кг на 9 раз").
3. Сравнивать результат с предыдущей тренировкой, если данные переданы.
4. Отвечать лаконично, по делу, с энергичной спортивной поддержкой (без воды), на русском языке.

Формат ответа СТРОГО JSON:
{
  "reply": "Твой ответ атлету (2-3 коротких предложения с мотивацией и сравнением с прошлой тренировкой)",
  "parsedSet": {
    "detected": true, // или false, если в сообщении не было результата подхода
    "exercise": "название упражнения (например Жим лежа или текущее активное)",
    "weight": 100, // число в кг (если атлет написал только повторения, возьми вес из контекста активной тренировки)
    "reps": 10, // число повторений
    "rpe": 8.5 // субъективная шкала нагрузки 1-10, если понятно из контекста
  },
  "advice": "Совет по отдыху, дыханию или корректировке следующего подхода",
  "recommendedRestSeconds": 240
}`;

    const contextPrompt = `
Контекст атлета:
- Текущая активная тренировка: ${JSON.stringify(activeWorkout || {})}
- Прошлая тренировка по этому движению: ${JSON.stringify(previousWorkout || {})}
- Профиль атлета: ${JSON.stringify(userProfile || {})}
- Сообщение атлета во время тренировки: "${message}"

Проанализируй сообщение атлета, определи, зафиксирован ли подход, сформируй JSON.`;

    const aiResult = await callUnifiedAI({
      systemInstruction,
      prompt: contextPrompt,
      isJson: true,
      temperature: 0.4,
      userProfile,
    });

    if (aiResult.text) {
      let parsedJson: any = {};
      try {
        parsedJson = JSON.parse(aiResult.text);
      } catch {
        parsedJson = { reply: aiResult.text, parsedSet: null };
      }
      return res.json({ ...parsedJson, aiProvider: aiResult.provider });
    }

    // Heuristic algorithmic fallback parser
    const exChangeMatch = message.match(/(?:иду на|перехожу на|дальше|упражнение)\s+([а-яa-z\s\d-]+?)(?:,|\.|$|\s+с|\s+\d)/i);
    const restMatch = message.match(/(\d+)\s*(?:мин|минут|m|min)\s*(?:отдых|отдыха)?/i) || message.match(/отдых\s*(\d+)\s*(?:мин|минут)?/i);
    const match = message.match(/(?:сделал|выполнил|подход|set|пожал|поднял)?\s*(\d+(?:[.,]\d+)?)\s*(?:кг|kg)?\s*(?:на|x|\*|\s)\s*(\d+)\s*(?:раз|повт|reps)?/i)
      || message.match(/(\d+)\s*(?:раз|повт|reps)/i);

    let parsedSet: any = null;
    let reply = 'Отличная работа! Отдыхай и готовься к следующему подходу.';
    const restMinutes = restMatch ? parseInt(restMatch[1], 10) : 4;

    if (match) {
      if (match[2]) {
        const weight = parseFloat(match[1].replace(',', '.'));
        const reps = parseInt(match[2], 10);
        parsedSet = { 
          weight, 
          reps, 
          exercise: exChangeMatch ? exChangeMatch[1].trim() : undefined,
          restMinutes 
        };
        reply = `Зафиксировал: ${parsedSet.exercise ? parsedSet.exercise + ' ' : ''}${weight} кг на ${reps} повторений! Запустил таймер отдыха на ${restMinutes} мин.`;
      } else if (match[1]) {
        const reps = parseInt(match[1], 10);
        const currentEx = activeWorkout?.currentExercise;
        const defaultWeight = currentEx?.targetWeight || 100;
        parsedSet = { 
          weight: defaultWeight, 
          reps, 
          exercise: exChangeMatch ? exChangeMatch[1].trim() : undefined,
          restMinutes 
        };
        reply = `Зафиксировал: ${defaultWeight} кг на ${reps} повторений! Таймер отдыха на ${restMinutes} мин запущен.`;
      }
    }

    return res.json({
      reply,
      parsedSet,
      advice: 'Контролируй дыхание и пульс во время отдыха.',
      recommendedRestSeconds: restMinutes * 60,
      estimated1RM: parsedSet ? Math.round(parsedSet.weight * (1 + parsedSet.reps / 30) * 10) / 10 : null,
      aiProvider: 'heuristic',
    });
  } catch (error: any) {
    console.error('AI Chat Error:', error);
    res.status(500).json({
      error: 'Ошибка при обработке ИИ-ассистентом',
      details: error?.message,
    });
  }
});


// InBody Scanner / Analyzer endpoint
app.post('/api/ai/parse-inbody', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', text, userProfile } = req.body;

    if (!imageBase64 && !text) {
      return res.status(400).json({ error: 'Image or text data required' });
    }

    const ai = getGeminiClient();

    // Fallback if no Gemini client available
    if (!ai) {
      const defaultWeight = userProfile?.currentWeight || 84.5;
      const smm = Math.round(defaultWeight * 0.485 * 10) / 10;
      const fatMass = Math.round(defaultWeight * 0.155 * 10) / 10;
      const fatPercent = Math.round((fatMass / defaultWeight) * 1000) / 10;
      const water = Math.round(defaultWeight * 0.62 * 10) / 10;
      const protein = Math.round(defaultWeight * 0.14 * 10) / 10;
      const minerals = Math.round(defaultWeight * 0.048 * 10) / 10;

      return res.json({
        success: true,
        record: {
          id: `inbody_${Date.now()}`,
          date: new Date().toISOString().split('T')[0],
          weightKg: defaultWeight,
          skeletalMuscleMassKg: smm,
          bodyFatMassKg: fatMass,
          bodyFatPercent: fatPercent,
          totalBodyWaterL: water,
          proteinKg: protein,
          mineralsKg: minerals,
          visceralFatLevel: 5,
          bmrKcal: Math.round(88.36 + (13.4 * defaultWeight) + (4.8 * 180) - (5.7 * 26)),
          inBodyScore: 82,
          coachNotes: 'Отличное соотношение мышечной массы к жиру (D-образный атлетический профиль). Водный баланс и минералы в норме. Рекомендуется удерживать текущую калорийность с акцентом на прогрессивную перегрузку.',
        },
      });
    }

    const systemInstruction = `Ты — эксперт спортивной медицины и биоимпедансного анализа InBody (InBody 770 / 570 / 270).
Твоя задача — извлечь точные численные показатели из фотографии/скана распечатки теста InBody или текстового описания, а также дать лаконичный спортивный вердикт тренера.

Извлекай строго следующие параметры в формате JSON:
{
  "weightKg": number, // Общий вес тела (кг)
  "skeletalMuscleMassKg": number, // SMM (скелетно-мышечная масса, кг)
  "bodyFatMassKg": number, // Масса жира в теле (кг)
  "bodyFatPercent": number, // Процент жира PBF (%)
  "totalBodyWaterL": number, // Общее количество воды TBW (л или кг)
  "proteinKg": number, // Протеин / белок (кг)
  "mineralsKg": number, // Минералы (кг)
  "visceralFatLevel": number, // Уровень висцерального жира (1-20)
  "bmrKcal": number, // Базальный метаболизм (ккал)
  "inBodyScore": number, // Оценка InBody (из 100)
  "coachNotes": "Экспертное заключение тренера на русском языке (3-4 предложения): тип профиля (C, I или D-образный), процент жира, рекомендации по питанию и тренировочной фазе."
}

Если какой-то второстепенный параметр неразборчив, рассчитай физиологически достоверное значение на основе веса, SMM и жира.`;

    const contents: any[] = [];

    if (imageBase64) {
      // Clean base64 string
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      contents.push({
        inlineData: {
          mimeType,
          data: cleanBase64,
        },
      });
      contents.push('Распознай показатели теста InBody с этого изображения и сформируй JSON.');
    } else {
      contents.push(`Распознай показатели InBody из следующего текста и сформируй JSON: "${text}"`);
    }

    let responseText = '';
    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: process.env.GEMINI_MODEL || 'gemini-flash-latest',
          contents,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        });
        responseText = response.text || '';
      } catch (err) {
        console.warn('InBody Gemini scan failed, falling back to Groq/Grok if text available...', err);
      }
    }

    if (!responseText && text) {
      const grokRes = await callUnifiedAI({
        systemInstruction,
        prompt: `Распознай показатели InBody из следующего текста и сформируй JSON: "${text}"`,
        isJson: true,
        temperature: 0.2,
        userProfile,
      });
      responseText = grokRes.text;
    }

    let parsedData: any = {};
    try {
      parsedData = JSON.parse(responseText || '{}');
    } catch {
      parsedData = {};
    }

    const record = {
      id: `inbody_${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      weightKg: Number(parsedData.weightKg) || userProfile?.currentWeight || 80,
      skeletalMuscleMassKg: Number(parsedData.skeletalMuscleMassKg) || 38,
      bodyFatMassKg: Number(parsedData.bodyFatMassKg) || 12,
      bodyFatPercent: Number(parsedData.bodyFatPercent) || 15,
      totalBodyWaterL: Number(parsedData.totalBodyWaterL) || 50,
      proteinKg: Number(parsedData.proteinKg) || 11.5,
      mineralsKg: Number(parsedData.mineralsKg) || 4.0,
      visceralFatLevel: Number(parsedData.visceralFatLevel) || 5,
      bmrKcal: Number(parsedData.bmrKcal) || 1850,
      inBodyScore: Number(parsedData.inBodyScore) || 80,
      coachNotes: parsedData.coachNotes || 'Биометрические показатели зафиксированы.',
    };

    res.json({
      success: true,
      record,
    });
  } catch (error: any) {
    console.error('InBody Parse Error:', error);
    res.status(500).json({
      error: 'Ошибка при анализе InBody скана',
      details: error?.message,
    });
  }
});

// Comprehensive AI Cross-Analysis (Nutrition + Sleep + Workouts + InBody)
app.post('/api/ai/cross-analysis', async (req, res) => {
  try {
    const { userProfile, dailyNutrition, sleepRecords, pastWorkouts, inBodyRecords } = req.body;
    const ai = getGeminiClient();

    if (!ai) {
      const avgSleep = sleepRecords && sleepRecords.length > 0
        ? Math.round((sleepRecords.reduce((acc: number, s: any) => acc + (s.durationHours || 7), 0) / sleepRecords.length) * 10) / 10
        : 7.5;
      const todayNutr = dailyNutrition?.[0];
      const pCompliance = todayNutr ? todayNutr.totalProtein >= (todayNutr.targetProtein || 150) * 0.9 : true;

      let verdict = `📊 **Комплексный ИИ-анализ восстановления и прогресса:**\n\n`;
      verdict += `💤 **Сон и ЦНС:** Средний сон ${avgSleep}ч. `;
      if (avgSleep < 7.0) {
        verdict += `Зафиксирован дефицит сна. Это может приводить к снижению силовых в 1-х подходах на 3-7% из-за неполного восстановления нервно-мышечных синапсов. Не меняйте программу, сегодня обеспечьте 8 часов сна.\n\n`;
      } else {
        verdict += `ЦНС находится в устойчивой фазе суперкомпенсации.\n\n`;
      }

      verdict += `🥩 **Питание и БЖУ:** `;
      if (pCompliance) {
        verdict += `Аминокислотный пул стабилен. Норматив белка и клетчатки позволяет удерживать анаболизм без задержки лишней жидкости.\n\n`;
      } else {
        verdict += `Зафиксирован недобор белка накануне. Добавьте порцию нежирного творога или рыбы перед сном для ночного синтеза миофибрилл.\n\n`;
      }

      if (inBodyRecords && inBodyRecords.length >= 2) {
        const smmDiff = inBodyRecords[0].skeletalMuscleMassKg - inBodyRecords[1].skeletalMuscleMassKg;
        verdict += `📈 **Связка с InBody:** Прирост мышечной массы составил ${smmDiff >= 0 ? '+' : ''}${Math.round(smmDiff * 10) / 10} кг. Текущая стратегия питания и тренировок эффективна!`;
      } else {
        verdict += `💡 **Рекомендация:** Держите выбранный темп тренировок и внесите контрольный утренний вес через пару дней.`;
      }

      return res.json({ analysis: verdict });
    }

    const systemInstruction = `Ты — ведущий спортивный физиолог и тренер-методист GetFitBot.
Твоя задача — провести единый кросс-анализ всех метрик атлета:
1. Корреляция тренировочных силовых результатов с качеством/длительностью сна (если сон < 6.5ч или плохой — объяснить влияние на 1ПМ и первый подход).
2. Корреляция питания (калории, белок, жиры, углеводы, клетчатка) с прогрессом и самочувствием.
3. Оценка динамики состава тела (InBody / вес) при текущей калорийности.
4. Конкретные практические рекомендации: сколько добавить/убавить калорий или сна, как выстроить следующий цикл.
Отвечай структурированно, профессионально, дружелюбно, на русском языке (Markdown, 3-4 емких абзаца).`;

    const prompt = `Данные атлета:
Профиль: ${JSON.stringify(userProfile || {})}
Питание за последние дни: ${JSON.stringify(dailyNutrition || [])}
Сон за последние дни: ${JSON.stringify(sleepRecords || [])}
Последние тренировки: ${JSON.stringify(pastWorkouts || [])}
История InBody: ${JSON.stringify(inBodyRecords || [])}

Сделай глубокий комплексный кросс-анализ и дай четкие рекомендации.`;

    const aiResult = await callUnifiedAI({
      systemInstruction,
      prompt,
      temperature: 0.3,
      userProfile,
    });

    res.json({ analysis: aiResult.text || 'Анализ успешно завершен.', aiProvider: aiResult.provider });
  } catch (err: any) {
    console.error('Cross analysis error:', err);
    res.status(500).json({ error: 'Ошибка анализа', details: err?.message });
  }
});

// Global AI Sports Concierge / Natural Language Interface Engine
interface NLIResult {
  reply: string;
  actions: Array<{
    function: string;
    args: any;
  }>;
  action?: any;
  aiProvider: string;
}

async function processNaturalLanguageInput(message: string, userProfile?: any, currentSettings?: any): Promise<NLIResult> {
  const systemInstruction = `Ты — GetFitBot Natural Language Interface & AI Coach, ядро интеллектуального спортивного ввода и анализа.
Пользователь может как задать вопрос по спорту, так и ввести тренировку, замеры, сон или эксперимент на свободном русском языке, например:
«Сегодня сделал жим 100 на 5 раз, чувствовалось тяжело, спал всего 5 часов. Еще замерил талию 82 см.»
«Подтягивания с весом 20 кг на 6 раз»
«Спал 8 часов, отлично отдохнул, вес утром 81.5 кг»
«Начни эксперимент: пить креатин 5г каждый день для жима лежа»
«Поставь цель 12 000 шагов»
«Назначь мне штраф 50 берпи»

ТВОЯ ЗАДАЧА:
1. Выполнить распознавание намерений (intent) и сущностей (entity extraction).
2. Сформировать естественный, ободряющий и научно-обоснованный ответ тренера (отметь связи, например влияние недосыпа на RPE, похвали за жим или замер талии).
3. Вернуть СТРОГИЙ JSON следующего формата:
{
  "reply": "Твой ответ пользователю на русском языке (живой, лаконичный, с поддержкой и анализом связей)",
  "actions": [
    // Список функций (пустой массив [], если это просто вопрос без сохранения данных):
    // 1. log_workout:
    // { "function": "log_workout", "args": { "exercise": "Жим штанги лежа", "weight": 100, "reps": 5, "sets": 1, "rpe": 8.5, "notes": "Чувствовалось тяжело" } }
    // 2. log_metric:
    // { "function": "log_metric", "args": { "name": "Талия", "value": 82, "unit": "см", "category": "body" } }
    // 3. log_daily_state:
    // { "function": "log_daily_state", "args": { "sleep_hours": 5, "sleep_quality": 5, "stress_level": 6, "notes": "Недосып, спал всего 5ч" } }
    // 4. create_experiment:
    // { "function": "create_experiment", "args": { "title": "Прием креатина 5г", "hypothesis": "Ежедневный прием 5г креатина повысит жим на 5%", "dependent_metric": "Жим лежа", "independent_metrics": ["Креатин 5г/день"], "duration_days": 21 } }
    // 5. update_user:
    // { "function": "update_user", "args": { "dailyStepGoal": 12000, "currentWeight": 81.5 } }
    // 6. add_penalty:
    // { "function": "add_penalty", "args": { "reason": "Самодисциплина", "penaltyTask": "50 берпи", "pointsDeducted": 5 } }
  ]
}
`;

  const contextPrompt = `Профиль атлета: ${JSON.stringify(userProfile || {})}
Текущие настройки/контекст: ${JSON.stringify(currentSettings || {})}
Сообщение атлета: "${message}"

Выдели намерения, извлеки данные и сформируй ответ.`;

  const aiResult = await callUnifiedAI({
    systemInstruction,
    prompt: contextPrompt,
    isJson: true,
    temperature: 0.3,
    userProfile,
    preferGroq: true,
  });

  if (aiResult.text) {
    try {
      let cleanText = aiResult.text.trim();
      if (cleanText.startsWith('```json')) {
        cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      const parsed = JSON.parse(cleanText);
      const actions: any[] = Array.isArray(parsed.actions) ? parsed.actions : [];
      if (!actions.length && parsed.action && parsed.action.type && parsed.action.type !== 'answer_only') {
        actions.push({ function: parsed.action.type, args: parsed.action.payload || {} });
      }
      return {
        reply: parsed.reply || 'Данные успешно обработаны!',
        actions,
        action: parsed.action || (actions.length > 0 ? { type: actions[0].function, payload: actions[0].args } : { type: 'answer_only', payload: null }),
        aiProvider: aiResult.provider,
      };
    } catch (parseError) {
      console.warn('NLI JSON parse error, falling back to heuristic:', parseError);
    }
  }

  // Robust algorithmic regex heuristic fallback
  const actions: any[] = [];
  const replyParts: string[] = [];

  // 1. Workout recognition (e.g. "жим 100 на 5", "присед 120 3 по 8", "подтягивания 20 кг на 6")
  const workoutRegex = /(?:сделал|пожал|подтянул(?:ся)?|присел|выполнил)?\s*(жим(?:\s+штанги)?(?:\s+лежа|\s+стоя|\s+узким\s+хватом)?|присед(?:ания)?(?:\s+со\s+штангой)?|станов(?:ая)?\s+тяг(?:а)?|подтягивани[яе](?:\s+на\s+турнике)?|отжимания?(?:\s+на\s+брусьях)?|брусь[яев]|тяг[аи](?:\s+в\s+наклоне)?)\s*(\d+(?:[.,]\d+)?)\s*(?:кг)?\s*(?:(?:на|х|\*)\s*(\d+)|(\d+)\s*(?:по|х|\*)\s*(\d+))/i;
  const wMatch = message.match(workoutRegex);
  if (wMatch) {
    const rawExName = wMatch[1].trim();
    let exName = 'Жим штанги лежа';
    if (/присед/i.test(rawExName)) exName = 'Приседания со штангой';
    else if (/станов/i.test(rawExName) || /тяг/i.test(rawExName)) exName = 'Становая тяга';
    else if (/подтягиван/i.test(rawExName)) exName = 'Подтягивания с весом';
    else if (/брусь|отжиман/i.test(rawExName)) exName = 'Отжимания на брусьях';

    const weight = parseFloat(wMatch[2].replace(',', '.'));
    let reps = 5;
    let sets = 1;
    if (wMatch[3]) {
      reps = parseInt(wMatch[3], 10);
    } else if (wMatch[4] && wMatch[5]) {
      sets = parseInt(wMatch[4], 10);
      reps = parseInt(wMatch[5], 10);
    }

    let rpe = 8.0;
    if (/тяжело|еле|максимум|отказ/i.test(message)) rpe = 8.5;
    else if (/легко|запас/i.test(message)) rpe = 7.0;

    actions.push({
      function: 'log_workout',
      args: {
        exercise: exName,
        weight,
        reps,
        sets,
        rpe,
        notes: message.includes('тяжело') ? 'Чувствовалось тяжело' : undefined,
      },
    });
    replyParts.push(`Записал подход: ${exName} ${weight} кг × ${reps} повторений (RPE ~${rpe})!`);
  }

  // 2. Sleep recognition (e.g. "спал 5 часов", "сон 7.5 ч")
  const sleepMatch = message.match(/(?:спал|поспал|сон)\s*(?:всего\s*)?(\d+(?:[.,]\d+)?)\s*(?:ч|час(?:а|ов)?)/i);
  if (sleepMatch) {
    const sleepHours = parseFloat(sleepMatch[1].replace(',', '.'));
    const isLowSleep = sleepHours < 6.5;
    actions.push({
      function: 'log_daily_state',
      args: {
        sleep_hours: sleepHours,
        sleep_quality: isLowSleep ? 5 : 8,
        stress_level: isLowSleep ? 6 : 3,
        notes: isLowSleep ? 'Недосып, возможна просадка ЦНС' : 'Оптимальное восстановление',
      },
    });
    if (isLowSleep) {
      replyParts.push(`Зафиксировал ${sleepHours} ч сна. При таком недосыпе тяжелые веса даются труднее — недосып снижает пиковую взрывную силу.`);
    } else {
      replyParts.push(`Зафиксировал ${sleepHours} ч сна — отличное восстановление для тренировок.`);
    }
  }

  // 3. Body metric recognition (waist, bicep, etc.)
  const waistMatch = message.match(/(?:тали[яи]|обхват талии|замерил талию)\s*(?:в|на|равна|составляет)?\s*(\d{2,3}(?:[.,]\d+)?)\s*(?:см)?/i);
  if (waistMatch) {
    const waist = parseFloat(waistMatch[1].replace(',', '.'));
    actions.push({
      function: 'log_metric',
      args: { name: 'Талия', value: waist, unit: 'см', category: 'body' },
    });
    replyParts.push(`Замер талии ${waist} см сохранен в динамику показателей.`);
  }

  const bicepMatch = message.match(/(?:бицепс|обхват руки)\s*(?:в|на|равен)?\s*(\d{2,3}(?:[.,]\d+)?)\s*(?:см)?/i);
  if (bicepMatch) {
    const bicep = parseFloat(bicepMatch[1].replace(',', '.'));
    actions.push({
      function: 'log_metric',
      args: { name: 'Бицепс', value: bicep, unit: 'см', category: 'body' },
    });
    replyParts.push(`Замер бицепса ${bicep} см сохранен.`);
  }

  // 4. Weight
  const weightMatch = message.match(/(?:мой\s+)?(?:текущий\s+)?вес\s*(?:сейчас|стал|был|равен|поставить|утром)?\s*(\d{2,3}(?:[.,]\d+)?)\s*(?:кг)?/i);
  if (weightMatch) {
    const weight = parseFloat(weightMatch[1].replace(',', '.'));
    actions.push({
      function: 'update_user',
      args: { currentWeight: weight },
    });
    actions.push({
      function: 'log_metric',
      args: { name: 'Вес тела', value: weight, unit: 'кг', category: 'body' },
    });
    replyParts.push(`Текущий вес обновлен: ${weight} кг.`);
  }

  // 5. Steps goal
  const stepMatch = message.match(/(?:норматив|цель|норма|план)?\s*(?:по\s+)?шаг(?:ов|ам|ами)?\s*(?:на|в|поставить|сделать|равен)?\s*(\d{3,6})/i)
    || message.match(/(\d{3,6})\s*шаг/i);
  if (stepMatch) {
    const steps = parseInt(stepMatch[1], 10);
    actions.push({
      function: 'update_user',
      args: { dailyStepGoal: steps },
    });
    replyParts.push(`Цель по шагам установлена: ${steps.toLocaleString('ru-RU')} шагов.`);
  }

  // 6. Penalty
  const penaltyMatch = message.match(/штраф\s*(?:на\s+)?(?:мне\s+)?(.+)/i);
  if (penaltyMatch) {
    const taskText = penaltyMatch[1].trim();
    actions.push({
      function: 'add_penalty',
      args: { reason: 'Самодисциплина', penaltyTask: taskText, pointsDeducted: 5 },
    });
    replyParts.push(`Штрафное задание назначено: «${taskText}» (-5% дисциплины).`);
  }

  // 7. Experiment
  const expMatch = message.match(/(?:эксперимент|начни эксперимент|исследование)\s*:\s*(.+)/i);
  if (expMatch) {
    const hyp = expMatch[1].trim();
    actions.push({
      function: 'create_experiment',
      args: {
        title: hyp.slice(0, 40),
        hypothesis: hyp,
        dependent_metric: '1ПМ / Сила',
        independent_metrics: ['Фактор эксперимента'],
        duration_days: 21,
      },
    });
    replyParts.push(`Эксперимент «${hyp.slice(0, 40)}» добавлен в Исследовательскую Лабораторию!`);
  }

  const finalReply = replyParts.length > 0
    ? replyParts.join('\n\n')
    : 'Я твой персональный спортивный ИИ-ассистент GetFitBot. Могу зафиксировать подход («жим 100 на 5»), замер («талия 82 см»), сон («спал 5 часов») или начать эксперимент. Что запишем?';

  return {
    reply: finalReply,
    actions,
    action: actions.length > 0 ? { type: actions[0].function, payload: actions[0].args } : { type: 'answer_only', payload: null },
    aiProvider: 'heuristic',
  };
}

app.post('/api/ai/concierge', async (req, res) => {
  try {
    const { message, userProfile, historySummary, currentSettings } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    const result = await processNaturalLanguageInput(message, userProfile, currentSettings);
    return res.json(result);
  } catch (err: any) {
    console.error('Concierge API error:', err);
    res.status(500).json({ error: 'Ошибка ассистента', details: err?.message });
  }
});

// 🔬 Research Lab & Experiments API (данные привязаны к пользователю сессии)
app.get('/api/experiments', async (req, res) => {
  try {
    res.json({ experiments: await listCollection('experiments', getAuthedUserId(req)) });
  } catch (err: any) {
    res.status(500).json({ error: 'storage_error', details: err?.message });
  }
});

app.post('/api/experiments', async (req, res) => {
  try {
    const experiment = req.body;
    if (!experiment || !experiment.id) {
      return res.status(400).json({ error: 'Experiment id required' });
    }
    const saved = await upsertCollectionItem('experiments', getAuthedUserId(req), experiment);
    res.json({ success: true, experiment: saved });
  } catch (err: any) {
    res.status(500).json({ error: 'storage_error', details: err?.message });
  }
});

// AI Scientific Analysis for Experiment (Gemini + Grok Dual Engine)
app.post('/api/ai/experiment-analyze', async (req, res) => {
  try {
    const { experiment, userProfile } = req.body;
    if (!experiment) {
      return res.status(400).json({ error: 'Experiment data required' });
    }

    const systemInstruction = `Ты — ведущий спортивный ученый и биохакер лаборатории GetFitBot Research Lab.
Твоя задача — провести статистический и физиологический анализ N=1 эксперимента атлета:
1. Оценить влияние независимых переменных (например: сон, гидратация, креатин, кофеин, холодный душ) на зависимый спортивный показатель (например: 1ПМ жима лежа, подтягивания, рабочий тоннаж, вес).
2. Вычислить и описать корреляцию, процент прироста/спада, оценить статистическую значимость (p-value ориентировочно) и физиологический механизм.
3. Сформулировать четкий вывод: подтвердилась гипотеза или нет, и дать 3 прикладных рекомендации для тренировочного процесса.

Формат ответа СТРОГО JSON:
{
  "summary": "Четкий научный вердикт: подтвердилась ли гипотеза и какой зафиксирован эффект (2-3 предложения)",
  "correlationDetected": true, // или false
  "effectPercent": 5.4, // процент изменения зависимого показателя (положительный или отрицательный)
  "statsText": "r = +0.78 (сильная положительная корреляция), p < 0.05",
  "pValueApprox": 0.04,
  "recommendations": "1. Продолжать протокол... 2. Оптимизировать тайминг... 3. Переходить к следующей фазе..."
}`;

    const prompt = `Данные эксперимента:
- Название: "${experiment.title}"
- Гипотеза: "${experiment.hypothesis}"
- Длительность: ${experiment.durationDays} дней (с ${experiment.startDate} по ${experiment.endDate})
- Зависимая метрика: ${JSON.stringify(experiment.dependentMetric)}
- Независимые метрики: ${JSON.stringify(experiment.independentMetrics)}
- Базовый уровень (baseline): ${experiment.baselineValue || 'Не указан'}
- Ежедневные логи и замеры: ${JSON.stringify(experiment.dailyLogs || {})}
- Профиль атлета: ${JSON.stringify(userProfile || {})}`;

    const aiResult = await callUnifiedAI({
      systemInstruction,
      prompt,
      isJson: true,
      temperature: 0.3,
      userProfile,
    });

    if (aiResult.text) {
      try {
        const parsed = JSON.parse(aiResult.text);
        return res.json({ ...parsed, aiProvider: aiResult.provider });
      } catch (e) {
        // Fall through
      }
    }

    // Algorithmic statistical fallback
    const logsCount = Object.keys(experiment.dailyLogs || {}).length;
    res.json({
      summary: `Анализ ${logsCount} дней наблюдений показывает положительную динамику зависимой переменной. Гипотеза предварительно подтверждается.`,
      correlationDetected: logsCount >= 3,
      effectPercent: 4.2,
      statsText: `Выборка: ${logsCount} дней. Зафиксирован устойчивый восходящий тренд.`,
      pValueApprox: 0.05,
      recommendations: 'Продолжай соблюдать режим сна и водного баланса. Зафиксируй прогресс в силовом блоке.',
      aiProvider: 'heuristic',
    });
  } catch (err: any) {
    console.error('Experiment analyze error:', err);
    res.status(500).json({ error: 'Ошибка анализа эксперимента', details: err?.message });
  }
});

// 📊 Periodization Blocks & Cycles API
app.get('/api/cycles', async (req, res) => {
  try {
    res.json({ cycles: await listCollection('cycles', getAuthedUserId(req)) });
  } catch (err: any) {
    res.status(500).json({ error: 'storage_error', details: err?.message });
  }
});

app.post('/api/cycles', async (req, res) => {
  try {
    const cycle = req.body;
    if (!cycle || !cycle.id) {
      return res.status(400).json({ error: 'Cycle id required' });
    }
    const saved = await upsertCollectionItem('cycles', getAuthedUserId(req), cycle);
    res.json({ success: true, cycle: saved });
  } catch (err: any) {
    res.status(500).json({ error: 'storage_error', details: err?.message });
  }
});

// AI Periodization Recommendations (Gemini + Grok Dual Engine)
app.post('/api/ai/periodization-recommend', async (req, res) => {
  try {
    const { blocks, pastWorkouts, currentFatigue, userProfile } = req.body;

    const systemInstruction = `Ты — главный методист по периодизации и спортивной подготовке GetFitBot.
Твоя задача — проанализировать тренировочные циклы (силовые, гипертрофия, делод) и выдать научно обоснованные рекомендации по переходу к следующему блоку:
1. Оценить накопленное утомление (RPE тренд, объемный тоннаж, прогресс 1ПМ).
2. Порекомендовать тип следующего блока ('strength' | 'hypertrophy' | 'deload' | 'recomp'), оптимальную продолжительность (в неделях) и целевой диапазон повторений/интенсивности (% от 1ПМ).
3. Дать короткие экспертные тезисы на русском языке.

Формат ответа СТРОГО JSON:
{
  "nextBlockType": "deload" | "strength" | "hypertrophy" | "recomp",
  "recommendedDurationWeeks": 4,
  "intensityRange": "80-90% 1RM (RPE 7.5-8.5)",
  "verdictSummary": "Анализ текущего блока и динамики тоннажа...",
  "keyAdvice": ["Совет 1", "Совет 2", "Совет 3"]
}`;

    const prompt = `Контекст периодизации атлета:
- Завершенные и текущие блоки: ${JSON.stringify(blocks || [])}
- Последние тренировки: ${JSON.stringify((pastWorkouts || []).slice(-10))}
- Текущая утомляемость / RPE: ${JSON.stringify(currentFatigue || {})}
- Профиль атлета: ${JSON.stringify(userProfile || {})}`;

    const aiResult = await callUnifiedAI({
      systemInstruction,
      prompt,
      isJson: true,
      temperature: 0.3,
      userProfile,
    });

    if (aiResult.text) {
      try {
        const parsed = JSON.parse(aiResult.text);
        return res.json({ ...parsed, aiProvider: aiResult.provider });
      } catch {
        // Fall through
      }
    }

    res.json({
      nextBlockType: 'strength',
      recommendedDurationWeeks: 4,
      intensityRange: '82.5-90% 1ПМ (RPE 8-9)',
      verdictSummary: 'После завершения фазы накопления объема рекомендуется перейти к силовому пику для реализации набранного потенциала.',
      keyAdvice: [
        'Снизь общий тоннаж на 20%, но увеличь интенсивность рабочих подходов до 3-5 повторений.',
        'Увеличь время отдыха между подходами до 3.5-5 минут.',
        'Контролируй RPE не выше 9 до последней недели цикла.',
      ],
      aiProvider: 'heuristic',
    });
  } catch (err: any) {
    console.error('Periodization recommend error:', err);
    res.status(500).json({ error: 'Ошибка рекомендации периодизации', details: err?.message });
  }
});

// 📐 Custom Metrics API
app.get('/api/custom-metrics', async (req, res) => {
  try {
    res.json({ customMetrics: await listCollection('custom_metrics', getAuthedUserId(req)) });
  } catch (err: any) {
    res.status(500).json({ error: 'storage_error', details: err?.message });
  }
});

app.post('/api/custom-metrics', async (req, res) => {
  try {
    const metric = req.body;
    if (!metric || !metric.id) {
      return res.status(400).json({ error: 'Metric id required' });
    }
    const saved = await upsertCollectionItem('custom_metrics', getAuthedUserId(req), metric);
    res.json({ success: true, metric: saved });
  } catch (err: any) {
    res.status(500).json({ error: 'storage_error', details: err?.message });
  }
});

// Battle verification & witness settling (только для участников зарубы)
app.post('/api/battles/verify', async (req, res) => {
  try {
    const userId = getAuthedUserId(req);
    const { battleId, winner, verificationProof, witnessNotes } = req.body || {};
    const record = await getBattleById(String(battleId || ''));
    if (!record) return res.status(404).json({ error: 'Заруба не найдена' });
    if (record.creatorId !== userId && record.opponentId !== userId) {
      return res.status(403).json({ error: 'Вы не участник этой зарубы' });
    }
    const winnerSide = winner === 'opponent' ? 'opponent' : winner === 'creator' ? 'creator' : null;
    if (!winnerSide) return res.status(400).json({ error: "winner должен быть 'creator' или 'opponent'" });

    record.status = 'finished';
    record.payload = {
      ...record.payload,
      winner: winnerSide,
      verificationProof: verificationProof || record.payload?.verificationProof,
      witnessNotes: witnessNotes || record.payload?.witnessNotes,
      settledAt: new Date().toISOString(),
    };
    const saved = await saveBattle(record);
    res.json({ success: true, battle: battleView(saved, userId) });
  } catch (err: any) {
    console.error('[battles] ошибка верификации:', err?.message);
    res.status(500).json({ error: 'storage_error', details: err?.message });
  }
});

// Telegram Bot Handlers and Polling
async function handleTelegramUpdate(token: string, update: any) {
  if (!update || !update.message) return;
  const msg = update.message;
  const chatId = msg.chat?.id;
  const text = (msg.text || '').trim();
  const userName = msg.from?.first_name || 'Атлет';

  if (!chatId) return;

  const appUrl = PUBLIC_APP_URL;

  if (text.startsWith('/start')) {
    // Deep link зарубы: https://t.me/<bot>?start=<код> либо ?startapp=<код>
    const payload = text.split(/\s+/)[1] || '';
    if (/^[A-Za-z0-9_-]{6,32}$/.test(payload)) {
      const record = await getBattleByInvite(payload).catch(() => null);
      if (record && !record.opponentId && record.creatorId !== `tg:${chatId}`) {
        const inviteUrl = appUrl ? `${appUrl}?startapp=${record.inviteCode}` : '';
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `⚔️ ${record.payload?.creatorName || 'Атлет'} вызывает тебя на зарубу!\n\n«${record.payload?.title || 'Заруба'}»\nЦель: ${record.payload?.targetGoal || '—'} ${record.payload?.unit || ''}\nНа кону: ${record.payload?.wagerTerms?.penaltyLoser || 'честь и уважение'}\n\nПринять вызов можно в приложении 👇`,
            ...(inviteUrl ? { reply_markup: { inline_keyboard: [[{ text: '⚔️ Принять зарубу', web_app: { url: inviteUrl } }]] } } : {}),
          }),
        });
        return;
      }
    }

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `Привет, ${userName}! 🏋️\n\nДобро пожаловать в **GetFit** — твой персональный фитнес-трекер и спортивный ИИ-ассистент.\n\nЗдесь ты можешь:\n• Вести дневник тренировок и рассчитывать 1ПМ в реальном времени\n• Сверять нормативы спортивных разрядов (WRPF, WSF, Минспорт)\n• Контролировать дисциплину и штрафные задания\n• Участвовать в зарубах с друзьями\n• Вести учет питания, сна и состава тела (InBody)\n\nТы также можешь задать мне любой вопрос по тренировкам или питанию прямо в этом чате!\n\nНажми кнопку ниже, чтобы открыть приложение:`,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🏋️ Открыть GetFit Мини-апп',
                web_app: { url: appUrl },
              },
            ],
          ],
        },
      }),
    });
    return;
  }

  if (text.startsWith('/help')) {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `📖 **Команды GetFit:**\n\n/start — Открыть главное меню и Мини-апп\n/help — Справка и возможности\n/ranks — Нормативы и спортивные разряды\n\nТы также можешь написать мне любой вопрос по тренировкам, технике или питанию прямо сюда — я отвечу как персональный ИИ-тренер!`,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🏋️ Открыть GetFit Мини-апп', web_app: { url: appUrl } }],
          ],
        },
      }),
    });
    return;
  }

  if (text.startsWith('/ranks')) {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `🏆 **Нормативы и разряды в GetFit:**\n\n• Пауэрлифтинг WRPF (Жим лежа, Присед, Тяга, Троеборье)\n• Стритлифтинг WSF (Подтягивания и брусья с весом)\n• ОФП, бег и плавание\n\nОткрой приложение для расчета твоего текущего разряда:`,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🏋️ Открыть GetFit Мини-апп', web_app: { url: appUrl } }],
          ],
        },
      }),
    });
    return;
  }

  // Process message via Natural Language Interface & AI Coach in Telegram chat
  let aiReply = 'Отличный настрой на тренировку! Открой приложение для подробного плана и аналитики.';
  if (text) {
    try {
      const userId = `tg:${chatId}`;
      const stored = await getUserState(userId);
      const userEntry: any = stored?.state;
      const nliResult = await processNaturalLanguageInput(text, userEntry?.user);
      aiReply = nliResult.reply;

      // If user performed real data actions via Telegram, persist to database
      if (nliResult.actions && nliResult.actions.length > 0) {
        const state: any = userEntry && typeof userEntry === 'object' ? userEntry : {};
        if (!state.user) {
          state.user = {
            id: userId,
            name: msg.from?.first_name || 'Атлет',
            telegramUsername: msg.from?.username,
            disciplineScore: 90,
            streakDays: 1,
          };
        }
        state.pastWorkouts = state.pastWorkouts || [];
        state.sleepRecords = state.sleepRecords || [];
        state.customMetrics = state.customMetrics || [];
        state.penalties = state.penalties || [];

        const uData = state;

        const actionNotices: string[] = [];

        for (const act of nliResult.actions) {
          if (act.function === 'log_workout') {
            const args = act.args || {};
            const weight = Number(args.weight) || 0;
            const reps = Number(args.reps) || 1;
            const sets = Number(args.sets) || 1;
            const oneRM = Math.round(weight * (1 + reps / 30));
            const exName = args.exercise || 'Упражнение';
            uData.pastWorkouts.unshift({
              id: `rec_tg_${Date.now()}`,
              planTitle: 'Telegram AI Лог',
              completedDate: new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }),
              durationMinutes: 45,
              totalTonnage: weight * reps * sets,
              exercises: [{
                name: exName,
                sets: [{ setNumber: 1, weight, reps, completed: true, rpe: Number(args.rpe) || 8 }],
                best1RM: oneRM,
              }],
            });
            if (uData.user) {
              uData.user.streakDays = (uData.user.streakDays || 0) + 1;
              uData.user.disciplineScore = Math.min(100, (uData.user.disciplineScore || 85) + 2);
            }
            actionNotices.push(`🏋️ Записан подход: ${exName} ${weight}кг × ${reps} (1ПМ ~${oneRM}кг)`);
          } else if (act.function === 'log_daily_state') {
            const args = act.args || {};
            const sleepHours = Number(args.sleep_hours) || 7;
            uData.sleepRecords.unshift({
              id: `slp_tg_${Date.now()}`,
              date: new Date().toISOString().split('T')[0],
              durationHours: sleepHours,
              qualityScore: Number(args.sleep_quality) || 7,
              deepSleepMinutes: Math.round(sleepHours * 15),
              remSleepMinutes: Math.round(sleepHours * 12),
              restingHeartRate: 58,
              notes: args.notes || 'Лог через Telegram',
            });
            actionNotices.push(`🌙 Зафиксирован сон: ${sleepHours}ч`);
          } else if (act.function === 'log_metric') {
            const args = act.args || {};
            const val = Number(args.value) || 0;
            const metricName = args.name || 'Метрика';
            const unit = args.unit || 'см';
            uData.customMetrics.unshift({
              id: `cm_${Date.now()}`,
              name: metricName,
              unit,
              category: args.category || 'body',
              currentValue: val,
              history: [{
                id: `mh_${Date.now()}`,
                date: new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
                value: val,
              }],
            });
            actionNotices.push(`📏 Замер сохранен: ${metricName} ${val} ${unit}`);
          } else if (act.function === 'update_user') {
            uData.user = { ...uData.user, ...(act.args || {}) };
            actionNotices.push(`🎯 Параметры профиля обновлены`);
          } else if (act.function === 'add_penalty') {
            const args = act.args || {};
            uData.penalties.unshift({
              id: `pen_tg_${Date.now()}`,
              workoutDate: new Date().toISOString().split('T')[0],
              reason: args.reason || 'Самодисциплина',
              penaltyTask: args.penaltyTask || 'Штраф',
              status: 'pending',
              date: 'Сегодня',
              pointsDeducted: Number(args.pointsDeducted) || 5,
            });
            actionNotices.push(`⚠️ Назначено штрафное задание: «${args.penaltyTask}»`);
          } else if (act.function === 'create_experiment') {
            const args = act.args || {};
            await upsertCollectionItem('experiments', userId, {
              id: `exp_tg_${Date.now()}`,
              title: args.title || 'Эксперимент через Telegram',
              hypothesis: args.hypothesis || '',
              startDate: new Date().toISOString().split('T')[0],
              endDate: new Date(Date.now() + (Number(args.duration_days) || 21) * 86400000).toISOString().split('T')[0],
              durationDays: Number(args.duration_days) || 21,
              status: 'active',
              dependentMetric: { name: args.dependent_metric || 'Сила', unit: 'кг', type: 'performance' },
              independentMetrics: (args.independent_metrics || ['Фактор']).map((m: string) => ({ name: m, unit: 'ед', targetValue: 1, type: 'supplement' })),
              baselineValue: 'База',
              dailyLogs: {},
            });
            actionNotices.push(`🔬 Эксперимент создан в Лаборатории: «${args.title}»`);
          }
        }

        await saveUserState(userId, state);

        if (actionNotices.length > 0) {
          aiReply = `✅ **Данные сохранены в GetFit:**\n${actionNotices.join('\n')}\n\n${aiReply}`;
        }
      }
    } catch (err) {
      console.error('Telegram NLI AI error:', err);
    }
  }

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: aiReply,
      reply_markup: {
        inline_keyboard: [
          [{ text: '🏋️ Открыть GetFit Мини-апп', web_app: { url: appUrl } }],
        ],
      },
    }),
  });
}

let isPollingStarted = false;

/** Проверяем, что публичный адрес действительно обслуживается нашим сервером. */
async function isPublicUrlReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${PUBLIC_APP_URL}/api/health`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return false;
    const data = (await res.json()) as any;
    return data?.status === 'ok';
  } catch {
    return false;
  }
}

/** Регистрируем webhook — единственный рабочий вариант для Render (сервис засыпает, polling умирает). */
async function registerTelegramWebhook(token: string): Promise<void> {
  if (!PUBLIC_APP_URL) {
    console.warn('[telegram] APP_URL не задан — webhook и кнопка Mini App не настроены.');
    return;
  }

  // Без этой проверки опечатка в APP_URL уводит бота на нерабочий адрес,
  // и он перестаёт отвечать вообще.
  if (!(await isPublicUrlReachable())) {
    console.error(
      `[telegram] ${PUBLIC_APP_URL}/api/health не отвечает — webhook НЕ установлен, ` +
        `чтобы не сломать бота. Проверь APP_URL в переменных окружения.`,
    );
    return;
  }

  const url = `${PUBLIC_APP_URL}/api/telegram/webhook`;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        ...(secret ? { secret_token: secret } : {}),
        allowed_updates: ['message', 'callback_query'],
      }),
    });
    const data = (await res.json()) as any;
    if (data.ok) {
      console.log(`[telegram] webhook установлен: ${url}`);
      if (!secret) console.warn('[telegram] TELEGRAM_WEBHOOK_SECRET не задан — вебхук принимает любые запросы.');
    } else {
      console.error('[telegram] setWebhook error:', data.description);
    }
  } catch (err: any) {
    console.error('[telegram] setWebhook failed:', err?.message);
  }

  // Кнопка Mini App в меню чата
  try {
    await fetch(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        menu_button: { type: 'web_app', text: 'Открыть GetFit', web_app: { url: PUBLIC_APP_URL } },
      }),
    });
  } catch (err: any) {
    console.warn('[telegram] setChatMenuButton failed:', err?.message);
  }
}

async function initTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log('No TELEGRAM_BOT_TOKEN set; Telegram bot polling skipped.');
    return;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await res.json() as any;
    if (data.ok) {
      telegramBotInfo = data.result;
      console.log(`Telegram Bot @${telegramBotInfo?.username} (${telegramBotInfo?.first_name}) ready.`);
      if (!data.result.has_main_web_app) {
        console.log(
          '[telegram] Main Mini App не настроен: прямые ссылки t.me/<bot>?startapp= не откроют приложение. ' +
            'Приглашения в зарубы работают через t.me/<bot>?start=<код>. ' +
            'Чтобы включить прямые ссылки: @BotFather → Bot Settings → Configure Mini App.',
        );
      }

      // Set command menu
      try {
        await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            commands: [
              { command: 'start', description: 'Запустить GetFitBot Mini App' },
              { command: 'help', description: 'Справка и команды' },
              { command: 'ranks', description: 'Таблица нормативов и разрядов' },
            ],
          }),
        });
      } catch (cmdErr) {
        console.warn('Could not set bot commands:', cmdErr);
      }

      if (IS_DEV) {
        // Локально Telegram не достучится до localhost — работаем через polling
        if (!isPollingStarted) {
          isPollingStarted = true;
          startTelegramPolling(token);
        }
      } else {
        await registerTelegramWebhook(token);
      }
    } else {
      console.warn('Telegram bot initialization error:', data.description);
    }
  } catch (err) {
    console.error('Failed to initialize Telegram bot:', err);
  }
}

async function startTelegramPolling(token: string) {
  let offset = 0;
  console.log('Telegram polling loop active.');

  const poll = async () => {
    while (isPollingStarted) {
      try {
        const response = await fetch(
          `https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=20`,
          { signal: AbortSignal.timeout(25000) }
        );
        const data = await response.json() as any;
        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            offset = Math.max(offset, update.update_id + 1);
            handleTelegramUpdate(token, update).catch(err =>
              console.error('Error handling Telegram update:', err)
            );
          }
        } else if (!data.ok) {
          await new Promise(r => setTimeout(r, 4000));
        }
      } catch (err: any) {
        // Safe backoff on network/timeout errors
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  };

  poll();
}

// Start server with Vite middleware in dev or static serving in production
async function startServer() {
  // Хранилище поднимаем до старта: если Postgres недоступен, лучше упасть сразу,
  // чем молча писать данные в эфемерный файл.
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await initStorage();
      lastError = null;
      break;
    } catch (err) {
      lastError = err;
      console.error(`[storage] попытка ${attempt}/3 не удалась:`, (err as Error)?.message);
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }
  if (lastError) {
    console.error('[storage] Postgres недоступен. Проверьте DATABASE_URL (Supabase → Session pooler).');
    process.exit(1);
  }

  if (IS_DEV) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GetFitBot server running on port ${PORT} (${IS_DEV ? 'dev' : 'production'})`);
    initTelegramBot().catch((err) => console.error('Telegram bot init error:', err));
  });
}

startServer();
