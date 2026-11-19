/**
 * Геометрия онбординг-тура.
 *
 * Здесь нет DOM: только чистые функции над прямоугольниками. Благодаря этому
 * «дырку», панели затемнения, карточку и прокрутку можно проверять числами,
 * не полагаясь на скриншоты и «на глаз».
 */

export interface RectLike {
  top: number;
  left: number;
  width: number;
  height: number;
  right?: number;
  bottom?: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export interface FocusRect {
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
}

export interface PanelRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PanelRects {
  top: PanelRect;
  right: PanelRect;
  bottom: PanelRect;
  left: PanelRect;
}

export type CardPlacement = 'below' | 'above' | 'center' | 'edge-below' | 'edge-above';

export interface ArrowLayout {
  left: number;
  top: number;
  side: 'top' | 'bottom';
}

export interface CardLayout {
  left: number;
  top: number;
  width: number;
  height: number;
  placement: CardPlacement;
  arrow: ArrowLayout | null;
  /** Карточке не хватило места в обычной раскладке — нужен компактный режим. */
  needsCompact: boolean;
}

export const FOCUS_PAD = 6;
export const CARD_GAP = 12;
export const SCREEN_MARGIN = 10;
export const CARD_WIDTH = 336;
export const ARROW_SIZE = 14;

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const emptyPanel = (): PanelRect => ({ left: 0, top: 0, width: 0, height: 0 });

/** Точная рамка вокруг цели: rect + отступ, но не больше экрана. */
export function buildFocusRect(
  rect: RectLike,
  viewport: ViewportSize,
  pad = FOCUS_PAD,
): FocusRect | null {
  if (!Number.isFinite(rect.left) || !Number.isFinite(rect.top)) return null;
  if (rect.width <= 0 || rect.height <= 0) return null;

  const rawRight = Number.isFinite(rect.right) ? (rect.right as number) : rect.left + rect.width;
  const rawBottom = Number.isFinite(rect.bottom) ? (rect.bottom as number) : rect.top + rect.height;
  const left = clamp(rect.left - pad, 0, viewport.width);
  const right = clamp(rawRight + pad, 0, viewport.width);
  const top = clamp(rect.top - pad, 0, viewport.height);
  const bottom = clamp(rawBottom + pad, 0, viewport.height);

  if (right - left <= 0 || bottom - top <= 0) return null;

  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

/**
 * Четыре панели начинаются ровно от краёв «дырки». Без общего box-shadow:
 * так blur применяется только вне подсвеченной области.
 */
export function buildPanelRects(focus: FocusRect | null, viewport: ViewportSize): PanelRects {
  if (!focus) {
    return {
      top: { left: 0, top: 0, width: viewport.width, height: viewport.height },
      right: emptyPanel(),
      bottom: emptyPanel(),
      left: emptyPanel(),
    };
  }

  return {
    top: { left: 0, top: 0, width: viewport.width, height: focus.top },
    bottom: { left: 0, top: focus.bottom, width: viewport.width, height: Math.max(0, viewport.height - focus.bottom) },
    left: { left: 0, top: focus.top, width: focus.left, height: focus.height },
    right: {
      left: focus.right,
      top: focus.top,
      width: Math.max(0, viewport.width - focus.right),
      height: focus.height,
    },
  };
}

interface CardOptions {
  focus: FocusRect | null;
  viewport: ViewportSize;
  cardWidth: number;
  cardHeight: number;
  /** Нижняя панель навигации, которую карточка не должна перекрывать. */
  bottomInset?: number;
  compact?: boolean;
}

/** Куда поставить карточку, чтобы она не пересекалась с рамкой. */
export function computeCardLayout({
  focus,
  viewport,
  cardWidth,
  cardHeight,
  bottomInset = 0,
  compact = false,
}: CardOptions): CardLayout {
  const margin = SCREEN_MARGIN;
  const gap = CARD_GAP;
  const width = Math.max(0, Math.min(cardWidth || CARD_WIDTH, viewport.width - margin * 2));
  const height = Math.max(0, Math.min(cardHeight, viewport.height - margin * 2));
  const leftFor = (focusRect: FocusRect): number =>
    clamp(focusRect.left + focusRect.width / 2 - width / 2, margin, viewport.width - margin - width);

  if (!focus) {
    return {
      left: Math.round((viewport.width - width) / 2),
      top: Math.round(clamp((viewport.height - height) / 2, margin, viewport.height - margin - height)),
      width,
      height,
      placement: 'center',
      arrow: null,
      needsCompact: false,
    };
  }

  const inset = clamp(bottomInset, 0, viewport.height);
  const availableBottom = viewport.height - inset;
  const spaceBelow = availableBottom - focus.bottom - gap;
  const spaceAbove = focus.top - gap - margin;
  const fitsBelow = spaceBelow >= height;
  const fitsAbove = spaceAbove >= height;
  const preferBelow = spaceBelow >= spaceAbove;
  const placement: CardPlacement = fitsBelow
    ? 'below'
    : fitsAbove
      ? 'above'
      : preferBelow
        ? 'below'
        : 'above';

  const minTop = margin;
  const maxTop = Math.max(minTop, availableBottom - margin - height);
  const rawTop = placement === 'below' ? focus.bottom + gap : focus.top - gap - height;
  const top = clamp(rawTop, minTop, maxTop);
  const isEdge = (placement === 'below' && top < rawTop - 0.5) || (placement === 'above' && top > rawTop + 0.5);
  const actualPlacement: CardPlacement = isEdge
    ? placement === 'below'
      ? 'edge-below'
      : 'edge-above'
    : placement;
  const left = leftFor(focus);

  let arrow: ArrowLayout | null = null;
  if (!isEdge) {
    const desired = focus.left + focus.width / 2 - ARROW_SIZE / 2;
    const minArrow = left + 22;
    const maxArrow = Math.max(minArrow, left + width - 22 - ARROW_SIZE);
    arrow = {
      left: clamp(desired, minArrow, maxArrow),
      top: placement === 'below' ? top - ARROW_SIZE / 2 : top + height - ARROW_SIZE / 2,
      side: placement === 'below' ? 'top' : 'bottom',
    };
  }

  return {
    left: Math.round(left),
    top: Math.round(top),
    width,
    height,
    placement: actualPlacement,
    arrow,
    needsCompact: !compact && !fitsBelow && !fitsAbove,
  };
}

export interface ScrollInput {
  rect: { top: number; height: number };
  viewport: ViewportSize;
  headerHeight: number;
  bottomInset: number;
  cardHeight: number;
  scrollY: number;
  scrollHeight: number;
}

export interface ScrollPlan {
  scrollTop: number;
  desiredTop: number;
  mode: 'below' | 'above';
}

/**
 * Подбирает прокрутку только среди реально достижимых положений.
 * Иначе высокая цель в конце документа оказывается ниже задуманного места,
 * и карточка наезжает на рамку.
 */
export function computeScrollTarget({
  rect,
  viewport,
  headerHeight,
  bottomInset,
  cardHeight,
  scrollY,
  scrollHeight,
}: ScrollInput): ScrollPlan | null {
  if (!Number.isFinite(rect.top) || !Number.isFinite(rect.height) || rect.height <= 0) return null;

  const margin = SCREEN_MARGIN;
  const gap = CARD_GAP;
  const usableBottom = Math.max(0, viewport.height - Math.max(0, bottomInset));
  const topUnder = headerHeight + margin;
  const topBottom = usableBottom - margin - rect.height;

  const fitsBelow =
    rect.height <= usableBottom - headerHeight - margin * 2 - gap - cardHeight;
  const fitsAbove = rect.height <= usableBottom - margin * 2 - gap - cardHeight;
  const maxScroll = Math.max(0, scrollHeight - viewport.height);
  const documentTop = rect.top + scrollY;
  const reachable = (desiredTop: number): boolean => {
    const delta = documentTop - desiredTop;
    return delta >= -0.5 && delta <= maxScroll + 0.5;
  };

  let desiredTop: number | null = null;
  let mode: 'below' | 'above' = 'below';
  if (fitsBelow && reachable(topUnder)) {
    desiredTop = topUnder;
    mode = 'below';
  } else if (fitsAbove && reachable(topBottom)) {
    desiredTop = topBottom;
    mode = 'above';
  } else if (reachable(topUnder)) {
    desiredTop = topUnder;
    mode = 'below';
  } else if (reachable(topBottom)) {
    desiredTop = topBottom;
    mode = 'above';
  }

  if (desiredTop === null) return null;

  const targetScrollTop = clamp(scrollY + (rect.top - desiredTop), 0, maxScroll);
  if (Math.abs(targetScrollTop - scrollY) < 3) return null;

  return { scrollTop: Math.round(targetScrollTop), desiredTop: Math.round(desiredTop), mode };
}
