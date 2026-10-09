/**
 * Клиент API: получение сессии по Telegram initData и запросы с авторизацией.
 *
 * Токен сессии подписан сервером; в нём же лежит идентификатор пользователя,
 * поэтому подставить чужой id клиент не может.
 */
import { getInitData } from './telegram';

const TOKEN_KEY = 'getfit_session_token';
const DEV_ID_KEY = 'getfit_dev_id';

export interface SessionInfo {
  authorized: boolean;
  userId: string | null;
  devMode: boolean;
  name?: string;
  error?: string;
}

let sessionInfo: SessionInfo | null = null;
let sessionPromise: Promise<SessionInfo> | null = null;

export function getSession(): SessionInfo | null {
  return sessionInfo;
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* ignore */ }
}

/** Локальный идентификатор для разработки вне Telegram (постоянный для браузера). */
function getDevId(): string {
  try {
    const saved = localStorage.getItem(DEV_ID_KEY);
    if (saved) return saved;
    const generated = Math.random().toString(36).slice(2, 10);
    localStorage.setItem(DEV_ID_KEY, generated);
    return generated;
  } catch {
    return 'local';
  }
}

export async function ensureSession(force = false): Promise<SessionInfo> {
  if (!force && sessionInfo?.authorized) return sessionInfo;
  if (!force && sessionPromise) return sessionPromise;

  sessionPromise = (async (): Promise<SessionInfo> => {
    const initData = getInitData();
    const body = initData ? { initData } : { devId: getDevId() };
    try {
      const res = await fetch('/api/auth/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.token) {
        setToken(data.token);
        sessionInfo = {
          authorized: true,
          userId: data.userId ?? null,
          devMode: Boolean(data.devMode),
          name: data.user?.first_name,
        };
      } else {
        setToken(null);
        sessionInfo = {
          authorized: false,
          userId: null,
          devMode: false,
          error: data?.error || `HTTP ${res.status}`,
        };
      }
    } catch (err: any) {
      sessionInfo = {
        authorized: false,
        userId: null,
        devMode: false,
        error: err?.message || 'network error',
      };
    }
    sessionPromise = null;
    return sessionInfo as SessionInfo;
  })();

  return sessionPromise;
}

/** fetch с авторизацией: сам поднимает сессию и один раз повторяет при 401. */
export async function apiFetch(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  await ensureSession();
  const headers = new Headers(init.headers || {});
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const res = await fetch(path, { ...init, headers });

  if (res.status === 401 && retry) {
    setToken(null);
    sessionInfo = null;
    await ensureSession(true);
    if (getToken()) return apiFetch(path, init, false);
  }
  return res;
}

export async function apiJson<T = any>(path: string, init: RequestInit = {}): Promise<T | null> {
  try {
    const res = await apiFetch(path, init);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function postJson<T = any>(path: string, body: unknown): Promise<T | null> {
  return apiJson<T>(path, { method: 'POST', body: JSON.stringify(body) });
}

/* ------------------------------------------------------------------ */
/* Облачное состояние пользователя                                     */
/* ------------------------------------------------------------------ */

export interface CloudStateResponse {
  found: boolean;
  data?: Record<string, any>;
  updatedAt?: string;
}

/** Кто мы для сервера и куда он пишет данные (postgres | file). */
export async function fetchMe(): Promise<{ userId: string; storage: 'postgres' | 'file' } | null> {
  return apiJson<{ userId: string; storage: 'postgres' | 'file' }>('/api/me');
}

export async function loadCloudState(): Promise<CloudStateResponse | null> {
  return apiJson<CloudStateResponse>('/api/db/sync');
}

export async function saveCloudState(state: Record<string, any>): Promise<boolean> {
  const res = await apiJson<{ success: boolean }>('/api/db/sync', {
    method: 'POST',
    body: JSON.stringify(state),
  });
  return Boolean(res?.success);
}

/* ------------------------------------------------------------------ */
/* Зарубы                                                              */
/* ------------------------------------------------------------------ */

export async function fetchBattles(): Promise<any[] | null> {
  const data = await apiJson<{ battles: any[] }>('/api/battles');
  return data?.battles ?? null;
}

export function createBattle(battle: Record<string, any>): Promise<{ success: boolean; battle: any } | null> {
  return postJson('/api/battles/create', { battle });
}

export function joinBattle(inviteCode: string): Promise<{ success: boolean; battle: any; alreadyMember?: boolean } | null> {
  return postJson('/api/battles/join', { inviteCode });
}

export function updateBattleProgress(
  battleId: string,
  amount: number,
): Promise<{ success: boolean; battle: any } | null> {
  return postJson('/api/battles/update-progress', { battleId, amount });
}

/* ------------------------------------------------------------------ */
/* Уведомления                                                         */
/* ------------------------------------------------------------------ */

/** Просим сервер отправить тестовое сообщение — проверка, что бот может нам писать. */
export async function testNotification(): Promise<{ delivered: boolean; error?: string }> {
  try {
    const res = await apiFetch('/api/notifications/test', { method: 'POST' });
    const data = await res.json().catch(() => null);
    return {
      delivered: Boolean(data?.delivered),
      error: data?.error || (res.ok ? undefined : `HTTP ${res.status}`),
    };
  } catch (err: any) {
    return { delivered: false, error: err?.message || 'network error' };
  }
}
