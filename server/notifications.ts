/**
 * Напоминания от бота.
 *
 * На Render бесплатный сервис засыпает, поэтому фоновый таймер внутри процесса
 * ненадёжен. Вместо него — эндпоинт, который дёргает внешний планировщик
 * (cron-job.org и подобные) каждые 30 минут. Здесь только логика: кому и что
 * отправить, с защитой от повторной отправки.
 *
 * Отметки об отправке хранятся отдельной таблицей, чтобы не перетирать
 * состояние пользователя, которое сохраняет клиент.
 */
import { getLastNotification, listAllUserStates, recordNotification } from './storage.ts';

export type ReminderType = 'workout' | 'morning_log' | 'experiment';

export interface ReminderDecision {
  userId: string;
  type: ReminderType;
  text: string;
}

export interface NotificationRunResult {
  checkedUsers: number;
  due: ReminderDecision[];
  sent: ReminderDecision[];
  failed: ReminderDecision[];
  skippedByCooldown: number;
  dryRun: boolean;
  nowLocal: string;
}

const HOUR_MS = 60 * 60 * 1000;

/** Часовой пояс пользователя в часах от UTC. По умолчанию Москва. */
function tzOffsetHours(): number {
  const raw = Number(process.env.NOTIFY_TZ_OFFSET_HOURS);
  return Number.isFinite(raw) ? raw : 3;
}

const WORKOUT_WINDOW = { from: 17, to: 21 };
const MORNING_WINDOW = { from: 9, to: 12 };
const EXPERIMENT_WINDOW = { from: 19, to: 22 };
const COOLDOWN_HOURS = 20;

export function localNow(at: Date = new Date()): { hour: number; dateKey: string } {
  const shifted = new Date(at.getTime() + tzOffsetHours() * HOUR_MS);
  return { hour: shifted.getUTCHours(), dateKey: shifted.toISOString().slice(0, 10) };
}

const inWindow = (hour: number, window: { from: number; to: number }): boolean =>
  hour >= window.from && hour < window.to;

/** Ключ даты в локальном поясе пользователя — для «сегодня/вчера». */
function dateKeyShifted(offsetDays: number, at: Date = new Date()): string {
  const shifted = new Date(at.getTime() + tzOffsetHours() * HOUR_MS + offsetDays * 24 * HOUR_MS);
  return shifted.toISOString().slice(0, 10);
}

function sameDay(iso: string | undefined, dateKey: string): boolean {
  if (!iso) return false;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return String(iso).startsWith(dateKey);
  const shifted = new Date(parsed.getTime() + tzOffsetHours() * HOUR_MS).toISOString().slice(0, 10);
  return shifted === dateKey;
}

/** Что отправить этому пользователю прямо сейчас. */
export function decideReminders(userId: string, state: any, now: Date = new Date()): ReminderDecision[] {
  const decisions: ReminderDecision[] = [];
  if (!state || typeof state !== 'object') return decisions;
  // Пользователь может отключить напоминания в профиле
  if (state.user?.notificationsEnabled === false) return decisions;

  const { hour, dateKey } = localNow(now);
  const yesterdayKey = dateKeyShifted(-1, now);

  const plans = Array.isArray(state.workoutPlans) ? state.workoutPlans : [];
  const workouts = Array.isArray(state.pastWorkouts) ? state.pastWorkouts : [];
  const sleep = Array.isArray(state.sleepRecords) ? state.sleepRecords : [];
  const nutrition = Array.isArray(state.dailyNutritionRecords) ? state.dailyNutritionRecords : [];

  const plannedToday = plans.filter((p: any) => p?.status !== 'completed' && p?.scheduledDay !== 'Пропуск');
  const trainedToday = workouts.some((w: any) => sameDay(w?.completedAt || w?.date || w?.startedAt, dateKey));

  // 1. Вечером напоминаем о тренировке, если план есть, а тренировки не было
  if (inWindow(hour, WORKOUT_WINDOW) && plannedToday.length > 0 && !trainedToday) {
    const plan = plannedToday[0];
    decisions.push({
      userId,
      type: 'workout',
      text: `⏰ <b>${plan?.title || 'Тренировка'}</b> по плану ещё не отмечена.\nОткрой приложение и запусти тренировку — или отметь перенос, если сегодня не выходит.`,
    });
  }

  // 2. Утром просим внести сон и питание за вчера
  const hasSleepYesterday = sleep.some((s: any) => sameDay(s?.date, yesterdayKey) || sameDay(s?.createdAt, yesterdayKey));
  const hasFoodYesterday = nutrition.some(
    (n: any) => sameDay(n?.date, yesterdayKey) || sameDay(n?.createdAt, yesterdayKey),
  );
  if (inWindow(hour, MORNING_WINDOW) && !hasSleepYesterday && !hasFoodYesterday) {
    decisions.push({
      userId,
      type: 'morning_log',
      text: '😴 Не вижу записей о сне и питании за вчера.\nВнеси данные в приложении — без них ИИ-тренер считает анализ восстановления вслепую.',
    });
  }

  // 3. Вечером напоминаем про активный эксперимент
  const experiments = Array.isArray(state.experiments) ? state.experiments : [];
  const activeExperiment = experiments.find((e: any) => e?.status === 'active');
  if (inWindow(hour, EXPERIMENT_WINDOW) && activeExperiment) {
    const logs = activeExperiment.dailyLogs || {};
    if (!logs[dateKey]) {
      decisions.push({
        userId,
        type: 'experiment',
        text: `🔬 Эксперимент «${activeExperiment.title || 'N=1'}»: день ${dateKey} ещё не отмечен.\nОтметь факторы в Лаборатории, пока день не закончился.`,
      });
    }
  }

  return decisions;
}

/**
 * Полный проход: собрать решения, отфильтровать по «остыванию» и отправить.
 * @param send функция отправки: возвращает false, если доставить не удалось
 */
export async function runNotificationCycle(
  send: (userId: string, text: string) => Promise<boolean | void>,
  options: { dryRun?: boolean; now?: Date } = {},
): Promise<NotificationRunResult> {
  const now = options.now || new Date();
  const dryRun = Boolean(options.dryRun);
  const users = await listAllUserStates();

  const due: ReminderDecision[] = [];
  let skippedByCooldown = 0;

  for (const user of users) {
    // Напоминания отправляем только тем, кого бот может достать
    if (!user.userId.startsWith('tg:')) continue;
    for (const decision of decideReminders(user.userId, user.state, now)) {
      const last = await getLastNotification(user.userId, decision.type);
      if (last && now.getTime() - new Date(last).getTime() < COOLDOWN_HOURS * HOUR_MS) {
        skippedByCooldown += 1;
        continue;
      }
      due.push(decision);
    }
  }

  const sent: ReminderDecision[] = [];
  const failed: ReminderDecision[] = [];
  if (!dryRun) {
    for (const decision of due) {
      try {
        const delivered = await send(decision.userId, decision.text);
        if (delivered === false) {
          // Не отмечаем как отправленное: следующая попытка — в ближайший проход
          failed.push(decision);
          continue;
        }
        await recordNotification(decision.userId, decision.type);
        sent.push(decision);
      } catch (err: any) {
        console.error(`[notify] не отправлено ${decision.userId}/${decision.type}:`, err?.message);
        failed.push(decision);
      }
    }
  }

  const { hour, dateKey } = localNow(now);
  return {
    checkedUsers: users.length,
    due,
    sent,
    failed,
    skippedByCooldown,
    dryRun,
    nowLocal: `${dateKey} ${String(hour).padStart(2, '0')}:00 (UTC+${tzOffsetHours()})`,
  };
}
