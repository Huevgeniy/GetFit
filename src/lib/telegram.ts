/**
 * Обёртка над Telegram WebApp SDK.
 *
 * Все вызовы безопасны вне Telegram: при открытии в обычном браузере
 * функции просто ничего не делают (throw не допускаем).
 */

type TgWebApp = any;

export function getTg(): TgWebApp | null {
  try {
    return (window as any)?.Telegram?.WebApp ?? null;
  } catch {
    return null;
  }
}

export function isTelegram(): boolean {
  return Boolean(getTg()?.initData);
}

export function getInitData(): string {
  return getTg()?.initData || '';
}

/** Параметр deep-link: t.me/<bot>?startapp=<param> либо ?start=<param> */
export function getStartParam(): string {
  const fromTg = getTg()?.initDataUnsafe?.start_param;
  if (fromTg) return String(fromTg);
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('startapp') || params.get('tgWebAppStartParam') || '';
  } catch {
    return '';
  }
}

export function getTelegramUser(): { id?: number; first_name?: string; username?: string } | null {
  return getTg()?.initDataUnsafe?.user ?? null;
}

/**
 * Настраивает внешний вид Mini App и подгоняет высоту под вьюпорт Telegram.
 * Высота выносится в CSS-переменную --app-height: 100vh внутри Telegram врёт.
 */
export function applyTelegramUi(): void {
  const tg = getTg();
  if (!tg) return;

  try {
    tg.expand?.();
    tg.ready?.();
  } catch { /* ignore */ }

  const headerColor = '#0b0f12';
  const bgColor = '#0b0f12';
  try {
    tg.setHeaderColor?.(headerColor);
    tg.setBackgroundColor?.(bgColor);
    tg.setBottomBarColor?.(bgColor);
  } catch { /* ignore */ }

  // Свайп вниз закрывает приложение и мешает прокрутке длинных экранов
  try {
    if (tg.isVersionAtLeast?.('7.7')) tg.disableVerticalSwipes?.();
  } catch { /* ignore */ }

  try {
    // Полноэкранный режим доступен только на новых клиентах
    if (tg.isVersionAtLeast?.('8.0') && tg.requestFullscreen && !tg.isFullscreen) {
      tg.requestFullscreen();
    }
  } catch { /* ignore */ }

  const syncViewport = () => {
    const height = tg.viewportStableHeight || tg.viewportHeight || window.innerHeight;
    document.documentElement.style.setProperty('--app-height', `${height}px`);
    const safeTop = tg.contentSafeAreaInset?.top ?? 0;
    const safeBottom = tg.contentSafeAreaInset?.bottom ?? 0;
    document.documentElement.style.setProperty('--tg-safe-top', `${safeTop}px`);
    document.documentElement.style.setProperty('--tg-safe-bottom', `${safeBottom}px`);
  };
  syncViewport();

  try {
    tg.onEvent?.('viewportChanged', syncViewport);
    tg.onEvent?.('safeAreaChanged', syncViewport);
    tg.onEvent?.('contentSafeAreaChanged', syncViewport);
  } catch { /* ignore */ }
}

export function hapticImpact(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'light'): void {
  try {
    getTg()?.HapticFeedback?.impactOccurred?.(style);
  } catch { /* ignore */ }
}

export function hapticNotify(type: 'error' | 'success' | 'warning'): void {
  try {
    getTg()?.HapticFeedback?.notificationOccurred?.(type);
  } catch { /* ignore */ }
}

export function hapticSelect(): void {
  try {
    getTg()?.HapticFeedback?.selectionChanged?.();
  } catch { /* ignore */ }
}

/**
 * Кнопка «Назад» в шапке Telegram: показываем, пока открыт модальный экран.
 * Возвращает функцию очистки обработчика.
 */
export function setupBackButton(visible: boolean, onBack: () => void): () => void {
  const tg = getTg();
  if (!tg?.BackButton) return () => undefined;
  try {
    if (visible) {
      tg.BackButton.onClick(onBack);
      tg.BackButton.show();
    } else {
      tg.BackButton.hide();
    }
  } catch { /* ignore */ }
  return () => {
    try {
      tg.BackButton?.offClick?.(onBack);
    } catch { /* ignore */ }
  };
}

export function closeMiniApp(): void {
  const tg = getTg();
  if (tg?.close) {
    tg.close();
    return;
  }
  // В браузере просто уходим к боту
  window.open('https://t.me/get_fitbot', '_blank');
}

/** Открывает ссылку внутри Telegram (t.me — через нативный переход). */
export function openExternal(url: string): void {
  const tg = getTg();
  if (tg?.openTelegramLink && /^https:\/\/t\.me\//i.test(url)) {
    tg.openTelegramLink(url);
    return;
  }
  if (tg?.openLink) {
    tg.openLink(url);
    return;
  }
  window.open(url, '_blank', 'noopener');
}

export function shareToTelegram(url: string, text: string): void {
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  openExternal(shareUrl);
}

export function showAlert(message: string): void {
  const tg = getTg();
  if (tg?.showAlert) {
    try {
      tg.showAlert(message);
      return;
    } catch { /* ignore */ }
  }
  window.alert(message);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* ignore */ }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}
