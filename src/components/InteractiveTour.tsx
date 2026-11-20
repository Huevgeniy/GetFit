import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

import { NavTab } from './Navigation';
import { hapticImpact } from '../lib/telegram';
import { buildMainTourSteps, TourId, TourStep } from '../lib/tours';
import {
  buildFocusRect,
  buildPanelRects,
  computeCardLayout,
  computeScrollTarget,
  CARD_WIDTH,
  FocusRect,
  PanelRects,
  CardLayout,
} from '../lib/tourGeometry';

interface InteractiveTourProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: NavTab) => void;
  /**
   * Шаги конкретного тура. Если не переданы, показываем основной тур —
   * так компонент остаётся самодостаточным в рендер-тестах.
   */
  steps?: TourStep[];
  /** Идентификатор для разметки и отладки: основной тур или раздел. */
  tourId?: TourId;
}

interface Geometry {
  focus: FocusRect | null;
  panels: PanelRects;
  card: CardLayout;
  radius: string;
}

/* ------------------------------------------------------------------ */
/* Вспомогательные функции браузера                                    */
/* ------------------------------------------------------------------ */

const nextFrame = (): Promise<void> =>
  new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => requestAnimationFrame(finish));
    }
    // В неактивном окне rAF может не тикать — не зависаем навсегда.
    setTimeout(finish, 120);
  });

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const measureViewport = (): { width: number; height: number } => {
  if (typeof window === 'undefined') return { width: 390, height: 844 };
  const root = document.documentElement;
  return {
    width: root?.clientWidth || window.innerWidth || 390,
    height: root?.clientHeight || window.innerHeight || 844,
  };
};

const prefersReducedMotion = (): boolean => {
  try {
    return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  } catch {
    return false;
  }
};

const getHeaderHeight = (): number => {
  const header = document.querySelector('header');
  return header ? Math.max(0, header.getBoundingClientRect().height) : 0;
};

const getBottomInset = (): number => {
  const nav = document.querySelector('nav');
  if (!nav) return 0;
  const rect = nav.getBoundingClientRect();
  if (rect.height <= 0) return 0;
  return Math.max(0, measureViewport().height - rect.top);
};

const getBorderRadius = (target: Element): string => {
  try {
    const value = getComputedStyle(target).borderRadius;
    return value && value !== '0px' ? value : '16px';
  } catch {
    return '16px';
  }
};

const isVisibleTarget = (element: Element | null): element is Element => {
  if (!element || !(element instanceof Element)) return false;
  const style = getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
};

const shouldScroll = (element: Element): boolean => {
  if (!(element instanceof Element)) return false;
  if (element.closest('header, nav')) return false;
  try {
    const style = getComputedStyle(element);
    if (style.position === 'fixed' || style.position === 'sticky') return false;
  } catch {
    /* ignore */
  }
  return true;
};

const animateScrollTo = (targetY: number): Promise<void> => {
  const startY = window.scrollY || document.documentElement.scrollTop || 0;
  const distance = targetY - startY;
  if (Math.abs(distance) < 1 || prefersReducedMotion()) {
    window.scrollTo(0, targetY);
    return Promise.resolve();
  }

  const duration = Math.min(420, Math.max(180, Math.abs(distance) * 0.5));
  return new Promise((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      resolve();
    };
    const start = performance.now();
    const step = (now: number) => {
      if (finished) return;
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      window.scrollTo(0, startY + distance * eased);
      if (t < 1) requestAnimationFrame(step);
      else finish();
    };
    requestAnimationFrame(step);
    // Страховка, если rAF заморожен в фоновом окне: доводим прокрутку
    // до конечной точки, иначе рамка подсветки остаётся за экраном.
    setTimeout(() => {
      if (!finished) {
        window.scrollTo(0, targetY);
        finish();
      }
    }, duration + 140);
  });
};

/* ------------------------------------------------------------------ */
/* Компонент                                                           */
/* ------------------------------------------------------------------ */

export const InteractiveTour: React.FC<InteractiveTourProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  steps: stepsProp,
  tourId = 'main',
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  /** Фиксируем набор шагов на момент открытия: облако не должно менять тур на ходу. */
  const [steps, setSteps] = useState<TourStep[]>(() => stepsProp || buildMainTourSteps());
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  const [viewport, setViewport] = useState(measureViewport);
  const [compact, setCompact] = useState(false);
  const [scrolling, setScrolling] = useState(false);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const nextButtonRef = useRef<HTMLButtonElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const runIdRef = useRef(0);
  const positionRafRef = useRef<number | null>(null);
  const stepRef = useRef<TourStep | null>(null);
  const onNavigateTabRef = useRef(onNavigateTab);
  const onCloseRef = useRef(onClose);

  onNavigateTabRef.current = onNavigateTab;
  onCloseRef.current = onClose;

  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  const safeIndex = Math.min(stepIndex, Math.max(0, steps.length - 1));
  const currentStep = steps[safeIndex] || steps[0];
  stepRef.current = currentStep;

  const isFirst = safeIndex === 0;
  const isLast = safeIndex === steps.length - 1;
  const progressPercent = Math.round(((safeIndex + 1) / Math.max(1, steps.length)) * 100);

  const complete = useCallback(() => {
    hapticImpact('medium');
    onCloseRef.current();
  }, []);

  const next = useCallback(() => {
    const total = stepsRef.current.length;
    if (safeIndex >= total - 1) {
      complete();
      return;
    }
    hapticImpact('light');
    setStepIndex(safeIndex + 1);
  }, [complete, safeIndex]);

  const prev = useCallback(() => {
    if (safeIndex <= 0) return;
    hapticImpact('light');
    setStepIndex(safeIndex - 1);
  }, [safeIndex]);

  const nextRef = useRef(next);
  const prevRef = useRef(prev);
  nextRef.current = next;
  prevRef.current = prev;

  const resolveTarget = useCallback((step: TourStep | null): Element | null => {
    if (!step?.target) return null;
    let raw: Element | null = null;
    try {
      raw =
        typeof step.target === 'function'
          ? step.target()
          : document.querySelector(step.target);
    } catch {
      raw = null;
    }
    return isVisibleTarget(raw) ? raw : null;
  }, []);

  /** Ждём ленивую вкладку/модалку: цель может появиться после перерисовки. */
  const waitForTarget = useCallback(
    async (step: TourStep, token: number): Promise<Element | null> => {
      if (!step.target) return null;
      let target = resolveTarget(step);
      if (target) return target;
      const deadline = Date.now() + 3200;
      while (Date.now() < deadline) {
        await sleep(70);
        if (token !== runIdRef.current) return null;
        target = resolveTarget(step);
        if (target) return target;
      }
      return null;
    },
    [resolveTarget],
  );

  const positionNow = useCallback((target: Element | null) => {
    const card = cardRef.current;
    if (!card) return;
    const vp = measureViewport();
    setViewport(vp);
    const focus = target ? buildFocusRect(target.getBoundingClientRect(), vp) : null;
    const cardRect = card.getBoundingClientRect();
    const cardHeight = Math.max(0, card.getBoundingClientRect().height || cardRect.height);
    const isCompact = card.classList.contains('is-compact');
    const cardLayout = computeCardLayout({
      focus,
      viewport: vp,
      cardWidth: Math.min(CARD_WIDTH, vp.width - 20),
      cardHeight,
      bottomInset: getBottomInset(),
      compact: isCompact,
    });
    setGeometry({
      focus,
      panels: buildPanelRects(focus, vp),
      card: cardLayout,
      radius: target ? getBorderRadius(target) : '16px',
    });
  }, []);

  const schedulePosition = useCallback(() => {
    if (positionRafRef.current !== null) return;
    positionRafRef.current = requestAnimationFrame(() => {
      positionRafRef.current = null;
      positionNow(resolveTarget(stepRef.current));
    });
  }, [positionNow, resolveTarget]);

  // Снимок шагов и сброс прогресса при каждом открытии.
  useEffect(() => {
    if (!isOpen) return;
    setSteps(stepsProp && stepsProp.length > 0 ? stepsProp : buildMainTourSteps());
    setStepIndex(0);
    hapticImpact('medium');
    // Намеренно только на открытие: набор шагов не должен меняться во время тура.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Основной конвейер шага: навигация -> ожидание DOM -> выравнивание -> отрисовка.
  useEffect(() => {
    if (!isOpen) return;
    const token = ++runIdRef.current;
    let cancelled = false;
    setGeometry(null);
    setCompact(false);
    setScrolling(false);

    const run = async () => {
      const step = stepsRef.current[safeIndex];
      if (!step) return;

      if (step.tab) onNavigateTabRef.current(step.tab);
      await nextFrame();
      if (cancelled || token !== runIdRef.current) return;

      // Под-вкладки и модалки открываем до поиска цели: они могут быть ленивыми.
      if (step.prepare) {
        try {
          await step.prepare();
        } catch {
          /* цель просто не найдётся — шаг покажется без рамки */
        }
        if (cancelled || token !== runIdRef.current) return;
        await nextFrame();
        if (cancelled || token !== runIdRef.current) return;
      }

      let target = await waitForTarget(step, token);
      if (cancelled || token !== runIdRef.current) return;

      // Даём вкладке дорисоваться и устоять layout.
      await nextFrame();
      if (cancelled || token !== runIdRef.current) return;
      target = resolveTarget(step);

      const card = cardRef.current;
      if (!card) return;

      // 1) Прокрутку планируем по компактной карточке: именно она должна
      // поместиться рядом с целью. Иначе на 320×568 карточка «не влезает»,
      // а цель ещё находится за экраном и её рамка выглядит пустой.
      if (target && shouldScroll(target)) {
        card.classList.add('is-compact');
        const compactHeight = card.getBoundingClientRect().height;
        card.classList.remove('is-compact');

        const plan = computeScrollTarget({
          rect: target.getBoundingClientRect(),
          viewport: measureViewport(),
          headerHeight: getHeaderHeight(),
          bottomInset: getBottomInset(),
          cardHeight: compactHeight,
          scrollY: window.scrollY || document.documentElement.scrollTop || 0,
          scrollHeight: Math.max(
            document.documentElement.scrollHeight,
            document.body?.scrollHeight || 0,
          ),
        });
        if (plan) {
          setScrolling(true);
          await animateScrollTo(plan.scrollTop);
          if (cancelled || token !== runIdRef.current) return;
          setScrolling(false);
          await nextFrame();
          if (cancelled || token !== runIdRef.current) return;
          target = resolveTarget(step);
        }
      }

      // 2) После прокрутки цель уже видна — окончательно выбираем раскладку.
      card.classList.remove('is-compact');
      let cardHeight = card.getBoundingClientRect().height;
      let focus = target
        ? buildFocusRect(target.getBoundingClientRect(), measureViewport())
        : null;
      let cardLayout = computeCardLayout({
        focus,
        viewport: measureViewport(),
        cardWidth: Math.min(CARD_WIDTH, measureViewport().width - 20),
        cardHeight,
        bottomInset: getBottomInset(),
        compact: false,
      });

      if (cardLayout.needsCompact) {
        card.classList.add('is-compact');
        cardHeight = card.getBoundingClientRect().height;
        focus = target
          ? buildFocusRect(target.getBoundingClientRect(), measureViewport())
          : null;
        cardLayout = computeCardLayout({
          focus,
          viewport: measureViewport(),
          cardWidth: Math.min(CARD_WIDTH, measureViewport().width - 20),
          cardHeight,
          bottomInset: getBottomInset(),
          compact: true,
        });
        setCompact(true);
      } else {
        setCompact(false);
      }

      if (cancelled || token !== runIdRef.current) return;
      positionNow(target);
      setScrolling(false);

      // Асинхронные перерисовки вкладок: несколько контрольных замеров.
      [180, 450, 900].forEach((ms) => {
        setTimeout(() => {
          if (cancelled || token !== runIdRef.current) return;
          positionNow(resolveTarget(step));
        }, ms);
      });
    };

    run();
    return () => {
      cancelled = true;
      if (runIdRef.current === token) runIdRef.current += 1;
    };
  }, [isOpen, safeIndex, waitForTarget, resolveTarget, positionNow]);

  // Перепозиционирование при скролле, ресайзе и перерисовке контента.
  useEffect(() => {
    if (!isOpen) return;
    const onViewportChange = () => {
      setViewport(measureViewport());
      schedulePosition();
    };
    window.addEventListener('scroll', onViewportChange, { passive: true });
    window.addEventListener('resize', onViewportChange);
    const visualViewport = window.visualViewport;
    visualViewport?.addEventListener('resize', onViewportChange);
    visualViewport?.addEventListener('scroll', onViewportChange);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => schedulePosition());
      const main = document.querySelector('main');
      if (main) observer.observe(main);
      const target = resolveTarget(stepRef.current);
      if (target) observer.observe(target);
      const card = cardRef.current;
      if (card) observer.observe(card);
    }

    return () => {
      window.removeEventListener('scroll', onViewportChange);
      window.removeEventListener('resize', onViewportChange);
      visualViewport?.removeEventListener('resize', onViewportChange);
      visualViewport?.removeEventListener('scroll', onViewportChange);
      observer?.disconnect();
      if (positionRafRef.current !== null) {
        cancelAnimationFrame(positionRafRef.current);
        positionRafRef.current = null;
      }
    };
  }, [isOpen, safeIndex, schedulePosition, resolveTarget]);

  // Блокировка прокрутки страницы событиями, а не overflow: hidden:
  // иначе ломается position: sticky у шапки и все замеры уезжают.
  useEffect(() => {
    if (!isOpen) return;
    const html = document.documentElement;
    html.classList.add('tour-active');

    const block = (event: Event) => {
      const target = event.target as Node | null;
      const card = cardRef.current;
      // Внутри карточки скролл разрешён, но только если ей есть что скроллить.
      if (target && card?.contains(target)) {
        if (card.scrollHeight > card.clientHeight + 1) return;
        event.preventDefault();
        return;
      }
      event.preventDefault();
    };

    window.addEventListener('wheel', block, { passive: false });
    window.addEventListener('touchmove', block, { passive: false });
    return () => {
      html.classList.remove('tour-active');
      window.removeEventListener('wheel', block);
      window.removeEventListener('touchmove', block);
    };
  }, [isOpen]);

  // Клавиатура и простой focus trap.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        complete();
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        nextRef.current();
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        prevRef.current();
        return;
      }
      if (event.key === 'Tab') {
        const card = cardRef.current;
        if (!card) return;
        const focusable = Array.from(
          card.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((element) => element.offsetParent !== null);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }
      if ([' ', 'PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        const active = document.activeElement as HTMLElement | null;
        const tag = active?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        event.preventDefault();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, complete]);

  // Фокус на основную кнопку шага.
  useEffect(() => {
    if (!isOpen) return;
    nextButtonRef.current?.focus({ preventScroll: true });
  }, [isOpen, safeIndex]);

  if (!isOpen || !currentStep) return null;

  // В браузере оверлей живёт прямо в body (никаких transform-предков),
  // а в SSR/рендер-тестах без настоящего DOM отдаём разметку инлайн.
  const canUsePortal =
    typeof document !== 'undefined' &&
    Boolean(document.body) &&
    document.body.nodeType === 1;

  const fallbackPanels = buildPanelRects(null, viewport);
  const panels = geometry?.panels || fallbackPanels;
  const card = geometry?.card;
  const cardStyle: React.CSSProperties = {
    left: card ? `${card.left}px` : '0px',
    top: card ? `${card.top}px` : '0px',
    width: `${Math.min(CARD_WIDTH, viewport.width - 20)}px`,
    visibility: geometry ? 'visible' : 'hidden',
  };

  const root = (
    <div
      ref={rootRef}
      className={`tour-root${scrolling ? ' is-scrolling' : ''}`}
      data-tour-root
      data-tour-id={tourId}
    >
      {/* Четыре панели: blur только вне «дырки». */}
      <div
        className="tour-panel tour-panel--top"
        style={panels.top}
        onClick={next}
        aria-hidden="true"
      />
      <div
        className="tour-panel tour-panel--bottom"
        style={panels.bottom}
        onClick={next}
        aria-hidden="true"
      />
      <div
        className="tour-panel tour-panel--left"
        style={panels.left}
        onClick={next}
        aria-hidden="true"
      />
      <div
        className="tour-panel tour-panel--right"
        style={panels.right}
        onClick={next}
        aria-hidden="true"
      />

      {geometry?.focus && (
        <>
          <div
            className="tour-shield"
            style={{
              left: `${geometry.focus.left}px`,
              top: `${geometry.focus.top}px`,
              width: `${geometry.focus.width}px`,
              height: `${geometry.focus.height}px`,
            }}
            onClick={next}
            aria-hidden="true"
          />
          <div
            className="tour-ring"
            style={{
              left: `${geometry.focus.left}px`,
              top: `${geometry.focus.top}px`,
              width: `${geometry.focus.width}px`,
              height: `${geometry.focus.height}px`,
              borderRadius: geometry.radius,
            }}
            aria-hidden="true"
          />
        </>
      )}

      {geometry?.card.arrow && (
        <div
          className="tour-arrow"
          style={{
            left: `${geometry.card.arrow.left}px`,
            top: `${geometry.card.arrow.top}px`,
            borderTopWidth: geometry.card.arrow.side === 'top' ? '1px' : '0px',
            borderLeftWidth: geometry.card.arrow.side === 'top' ? '1px' : '0px',
            borderRightWidth: geometry.card.arrow.side === 'bottom' ? '1px' : '0px',
            borderBottomWidth: geometry.card.arrow.side === 'bottom' ? '1px' : '0px',
          }}
          aria-hidden="true"
        />
      )}

      <div
        ref={cardRef}
        className={`tour-card${compact ? ' is-compact' : ''}`}
        style={cardStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`tour-title-${currentStep.id}`}
        aria-describedby={`tour-text-${currentStep.id}`}
      >
        <div className="tour-card__top">
          <span className="tour-card__count">
            Шаг {safeIndex + 1} из {steps.length}
          </span>
          <button
            type="button"
            className="tour-card__skip"
            onClick={complete}
            aria-label="Пропустить обучение"
          >
            <X className="h-3.5 w-3.5" />
            <span>Пропустить</span>
          </button>
        </div>

        <h2 id={`tour-title-${currentStep.id}`} className="tour-card__title">
          {currentStep.title}
        </h2>
        <p id={`tour-text-${currentStep.id}`} className="tour-card__text">
          {currentStep.description}
        </p>

        {currentStep.bullets && currentStep.bullets.length > 0 && (
          <ul className="tour-card__list">
            {currentStep.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        )}

        <div className="tour-card__progress" aria-hidden="true">
          <span style={{ width: `${progressPercent}%` }} />
        </div>

        <div className="tour-card__footer">
          <span className="tour-card__step">{safeIndex + 1} / {steps.length}</span>
          <div className="tour-card__actions">
            <button
              type="button"
              className="tour-btn tour-btn--ghost"
              onClick={prev}
              disabled={isFirst}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Назад
            </button>
            <button
              ref={nextButtonRef}
              type="button"
              className="tour-btn tour-btn--primary"
              onClick={next}
            >
              {isLast ? 'Готово' : 'Далее'}
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return canUsePortal ? createPortal(root, document.body) : root;
};
