/**
 * Шаги по дням.
 *
 * Ключ — локальная дата пользователя (YYYY-MM-DD), а не UTC: иначе в Москве
 * вечерние шаги могли попасть в «завтра» или «вчера». Сам журнал живёт в
 * профиле и синхронизируется вместе с остальным состоянием.
 */

const pad = (value: number): string => String(value).padStart(2, '0');

/** Локальная дата в формате YYYY-MM-DD. */
export function localDayKey(value: Date = new Date()): string {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

/**
 * Читает старые шаги из localStorage (до синхронизации).
 * Понимает и прежний UTC-ключ, чтобы данные не потерялись при обновлении.
 */
export function readLegacyStepLog(days = 120): Record<string, number> {
  const result: Record<string, number> = {};
  if (typeof localStorage === 'undefined') return result;
  const today = new Date();
  for (let i = 0; i < days; i += 1) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const localKey = localDayKey(date);
    const utcKey = date.toISOString().slice(0, 10);
    try {
      const raw = Number(localStorage.getItem(`getfit_today_steps_${localKey}`) ?? localStorage.getItem(`getfit_today_steps_${utcKey}`));
      if (Number.isFinite(raw) && raw > 0) result[localKey] = raw;
    } catch {
      /* приватный режим — просто нет старых шагов */
    }
  }
  return result;
}

/** Сливает старые локальные шаги с облачными: облако главнее. */
export function mergeStepLogs(
  cloud: Record<string, number> | undefined,
  legacy: Record<string, number>,
): Record<string, number> {
  return { ...legacy, ...(cloud || {}) };
}
