/**
 * Авторизация Telegram Mini App.
 *
 * Схема:
 *  1. Клиент присылает `initData` из Telegram.WebApp на POST /api/auth/telegram.
 *  2. Сервер проверяет HMAC-подпись (ключ выводится из TELEGRAM_BOT_TOKEN),
 *     срок жизни (auth_date) и выдаёт подписанный сессионный токен.
 *  3. Все защищённые эндпоинты ждут заголовок `Authorization: Bearer <token>`.
 *
 * Секреты в клиент не попадают: подпись считается только на сервере.
 */
import crypto from 'crypto';

export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface InitDataValidationResult {
  valid: boolean;
  user?: TelegramUser;
  reason?: string;
  authDate?: number;
}

const DEFAULT_MAX_AGE_SECONDS = 24 * 60 * 60; // сутки
const CLOCK_SKEW_SECONDS = 300;

export function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

/**
 * Проверка initData по алгоритму Telegram:
 * secret = HMAC_SHA256(key="WebAppData", msg=bot_token)
 * hash   = HMAC_SHA256(key=secret, msg=data_check_string)
 *
 * Часть клиентов добавляет в initData поле `signature` (для сторонней проверки).
 * Принимаем оба варианта строки, чтобы не зависеть от версии клиента.
 */
export function validateTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds: number = DEFAULT_MAX_AGE_SECONDS,
): InitDataValidationResult {
  try {
    if (!initData || !botToken) return { valid: false, reason: 'initData или TELEGRAM_BOT_TOKEN отсутствуют' };

    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash || !/^[0-9a-f]{64}$/i.test(hash)) return { valid: false, reason: 'hash отсутствует или некорректен' };

    const withoutSignature = new URLSearchParams(params);
    withoutSignature.delete('signature');
    const full = new URLSearchParams(params);
    full.delete('hash');

    const buildCheckString = (p: URLSearchParams) =>
      [...p.entries()]
        .filter(([k]) => k !== 'hash')
        .map(([k, v]) => `${k}=${v}`)
        .sort()
        .join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const candidates = [buildCheckString(full), buildCheckString(withoutSignature)].map((checkString) =>
      crypto.createHmac('sha256', secretKey).update(checkString).digest('hex'),
    );

    if (!candidates.some((calculated) => safeEqualHex(calculated, hash))) {
      return { valid: false, reason: 'подпись не совпадает' };
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const authDate = Number(params.get('auth_date') || 0);
    if (!authDate) return { valid: false, reason: 'auth_date отсутствует' };
    if (nowSeconds - authDate > maxAgeSeconds) return { valid: false, reason: 'initData устарел, переоткройте Mini App' };
    if (authDate - nowSeconds > CLOCK_SKEW_SECONDS) return { valid: false, reason: 'auth_date из будущего' };

    const userRaw = params.get('user');
    const user = userRaw ? (JSON.parse(userRaw) as TelegramUser) : undefined;

    return { valid: true, user, authDate };
  } catch (err: any) {
    return { valid: false, reason: err?.message || 'ошибка проверки initData' };
  }
}

/** Секрет подписи сессий. Если SESSION_SECRET не задан — выводим из токена бота. */
export function getSessionSecret(): string {
  const explicit = process.env.SESSION_SECRET;
  if (explicit && explicit.trim()) return explicit.trim();
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (botToken && botToken.trim()) {
    return crypto.createHmac('sha256', botToken.trim()).update('getfit-session-v1').digest('hex');
  }
  if (!fallbackSecret) {
    fallbackSecret = crypto.randomBytes(32).toString('hex');
    console.warn('[auth] SESSION_SECRET и TELEGRAM_BOT_TOKEN не заданы — сессии будут сброшены при рестарте.');
  }
  return fallbackSecret;
}
let fallbackSecret = '';

export interface SessionPayload {
  sub: string;
  exp: number;
  dev?: boolean;
  name?: string;
  username?: string;
}

export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 дней

export function issueSession(
  userId: string,
  opts: { dev?: boolean; ttlSeconds?: number; name?: string; username?: string } = {},
): string {
  const payload: SessionPayload = {
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + (opts.ttlSeconds ?? SESSION_TTL_SECONDS),
    ...(opts.dev ? { dev: true } : {}),
    ...(opts.name ? { name: opts.name.slice(0, 60) } : {}),
    ...(opts.username ? { username: opts.username.slice(0, 40) } : {}),
  };
  const body = b64url(JSON.stringify(payload));
  const signature = b64url(crypto.createHmac('sha256', getSessionSecret()).update(body).digest());
  return `${body}.${signature}`;
}

export function verifySession(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  const expected = b64url(crypto.createHmac('sha256', getSessionSecret()).update(body).digest());
  if (signature.length !== expected.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8')) as SessionPayload;
    if (!payload?.sub || typeof payload.exp !== 'number') return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function readBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

/** Идентификатор пользователя в БД: `tg:<id>` для Telegram, `dev:<id>` для локальной разработки. */
export function userIdForTelegram(telegramId: number | string): string {
  return `tg:${telegramId}`;
}
