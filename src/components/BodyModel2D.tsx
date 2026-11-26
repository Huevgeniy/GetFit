import React, { useId, useMemo, useRef, useState } from 'react';
import {
  BODY_DRAW,
  BodyDimensions,
  BodyPose,
  BodyView,
  DrawHandle,
  ExerciseEvaluation,
  LOAD_LEVEL_COLOR,
  LoadJoint,
  LoadLevel,
  Point,
  SideSegmentKey,
  buildFrontGeometry,
  buildSideGeometry,
  direction,
  dragSidePelvis,
  jointRisk,
  pointAlong,
  rotateFrontSegment,
  rotateSideSegment,
} from '../lib/bodyModel';

interface BodyModel2DProps {
  view: BodyView;
  pose: BodyPose;
  dimensions: BodyDimensions;
  avatarUrl?: string;
  showAngles?: boolean;
  evaluation?: ExerciseEvaluation | null;
  onChangePose: (pose: BodyPose) => void;
  /** В симуляции маркеры не нужны: модель только показывает движение. */
  showHandles?: boolean;
  showGrid?: boolean;
  heat?: Partial<Record<LoadJoint, LoadLevel>>;
  equipment?: {
    kind: 'barbell' | 'dumbbell' | 'bodyweight';
    weightKg: number;
    anchor?: 'shoulder' | 'hand';
  } | null;
}

interface DragState {
  view: BodyView;
  handle: DrawHandle;
  pointerId: number;
  /** Стопа, которая остаётся на полу, пока пользователь двигает таз. */
  plantedAnkle?: Point;
}

const COLOR_SAFE = '#34d399';
const COLOR_NEAR = '#fbbf24';
const COLOR_FAIL = '#fb7185';

/** Тёплая кожа вместо синей схемы: силуэт должен читаться как человек. */
const SKIN_LIGHT = '#f0c3a0';
const SKIN = '#c98f6d';
const SKIN_MID = '#b47655';
const SKIN_DARK = '#8a523c';
const SKIN_DEEP = '#63382a';
const SKIN_LINE = '#7d4230';
const OUTLINE = '#3a2018';
const HAIR = '#241713';
const HAIR_LIGHT = '#3b271f';
const SHORTS = '#1a2b36';
const SHORTS_LIGHT = '#2e4757';

const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const mul = (p: Point, k: number): Point => ({ x: p.x * k, y: p.y * k });
const mix = (a: Point, b: Point, t: number): Point => add(a, mul(sub(b, a), t));
const length = (p: Point): number => Math.hypot(p.x, p.y);
const unit = (p: Point): Point => {
  const len = length(p) || 1;
  return { x: p.x / len, y: p.y / len };
};
const perp = (p: Point): Point => ({ x: -p.y, y: p.x });
const distance = (a: Point, b: Point): number => length(sub(b, a));

const normalizeDegrees = (value: number): number => {
  let angle = value % 360;
  if (angle > 180) angle -= 360;
  if (angle <= -180) angle += 360;
  return angle;
};

function arcPath(center: Point, startAngle: number, endAngle: number, radius: number): {
  path: string;
  label: Point;
  value: number;
} | null {
  const delta = normalizeDegrees(endAngle - startAngle);
  if (Math.abs(delta) < 2) return null;
  const start = pointAlong(center, startAngle, radius);
  const end = pointAlong(center, startAngle + delta, radius);
  const largeArc = Math.abs(delta) > 180 ? 1 : 0;
  const sweep = delta > 0 ? 1 : 0;
  const label = pointAlong(center, startAngle + delta / 2, radius + 16);
  return {
    path: `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} A ${radius} ${radius} 0 ${largeArc} ${sweep} ${end.x.toFixed(1)} ${end.y.toFixed(1)}`,
    label,
    value: Math.round(Math.abs(delta)),
  };
}

/** Замкнутый сужающийся контур конечности с мышечным утолщением. */
function limbPath(a: Point, b: Point, startWidth: number, endWidth: number, bulge = 0): string {
  const segments = 14;
  const dir = unit(sub(b, a));
  const normal = perp(dir);
  const left: Point[] = [];
  const right: Point[] = [];
  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments;
    const center = mix(a, b, t);
    const width = startWidth * (1 - t) + endWidth * t + Math.sin(Math.PI * t) * bulge;
    left.push(add(center, mul(normal, width / 2)));
    right.push(add(center, mul(normal, -width / 2)));
  }
  const path = [...left, ...right.reverse()]
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(' ');
  return `${path} Z`;
}

function framePoint(origin: Point, up: Point, x: number, y: number): Point {
  const right = perp(up);
  return {
    x: origin.x + right.x * x + up.x * y,
    y: origin.y + right.y * x + up.y * y,
  };
}

const fmt = (point: Point): string => `${point.x.toFixed(1)} ${point.y.toFixed(1)}`;

export const BodyModel2D: React.FC<BodyModel2DProps> = ({
  view,
  pose,
  dimensions,
  avatarUrl,
  showAngles = true,
  evaluation,
  onChangePose,
  showHandles = true,
  showGrid = true,
  heat,
  equipment,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const rawId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const surfaceId = `body-surface-${rawId}`;
  const limbId = `body-limb-${rawId}`;
  const armId = `body-arm-${rawId}`;
  const shadeId = `body-shade-${rawId}`;
  const hairId = `body-hair-${rawId}`;
  const shortsId = `body-shorts-${rawId}`;
  const glowId = `body-glow-${rawId}`;
  const clipId = `body-avatar-${rawId}`;

  const sideGeometry = useMemo(() => buildSideGeometry(pose.side, dimensions), [pose.side, dimensions]);
  const frontGeometry = useMemo(() => buildFrontGeometry(pose.front, dimensions), [pose.front, dimensions]);
  const geometry = view === 'side' ? sideGeometry : frontGeometry;
  const risk = useMemo(() => (evaluation ? jointRisk(evaluation) : {}), [evaluation]);

  const colorFor = (joint: string): string => {
    const status = risk[joint as keyof typeof risk];
    if (status === 'fail') return COLOR_FAIL;
    if (status === 'near') return COLOR_NEAR;
    return COLOR_SAFE;
  };

  const toModelPoint = (clientX: number, clientY: number): Point => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
    return {
      x: ((clientX - rect.left) / rect.width) * BODY_DRAW.width,
      y: ((clientY - rect.top) / rect.height) * BODY_DRAW.height,
    };
  };

  const startDrag = (event: React.PointerEvent<SVGGElement>, handle: DrawHandle) => {
    event.preventDefault();
    event.stopPropagation();
    setDrag({
      view,
      handle,
      pointerId: event.pointerId,
      plantedAnkle: handle.segment === 'pelvis' && view === 'side' ? sideGeometry.ankle : undefined,
    });
    try {
      svgRef.current?.setPointerCapture(event.pointerId);
    } catch {
      /* старые WebView */
    }
  };

  const moveDrag = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    event.preventDefault();
    const point = toModelPoint(event.clientX, event.clientY);

    if (drag.view === 'side' && drag.handle.segment === 'pelvis' && drag.plantedAnkle) {
      onChangePose({
        ...pose,
        side: dragSidePelvis(pose.side, point, drag.plantedAnkle, dimensions),
      });
      return;
    }

    const angle = Math.atan2(point.y - drag.handle.pivot.y, point.x - drag.handle.pivot.x) * (180 / Math.PI);
    if (drag.view === 'side') {
      if (drag.handle.segment === 'pelvis') return;
      onChangePose({
        ...pose,
        side: rotateSideSegment(pose.side, drag.handle.segment as SideSegmentKey, angle),
      });
    } else {
      onChangePose({
        ...pose,
        front: rotateFrontSegment(pose.front, drag.handle.segment as Parameters<typeof rotateFrontSegment>[1], angle),
      });
    }
  };

  const endDrag = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    try {
      svgRef.current?.releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    setDrag(null);
  };

  const surface = `url(#${surfaceId})`;
  const limbFill = `url(#${limbId})`;
  const armFill = `url(#${armId})`;
  const shadeFill = `url(#${shadeId})`;
  const shortsFill = `url(#${shortsId})`;

  const limb = (
    a: Point,
    b: Point,
    startWidth: number,
    endWidth: number,
    bulge = 0,
    fill = limbFill,
    outline = OUTLINE,
  ) => {
    const dir = unit(sub(b, a));
    const normal = perp(dir);
    const highlightOffset = mul(normal, -startWidth * 0.2);
    const highlightFrom = add(add(a, mul(dir, startWidth * 0.62)), highlightOffset);
    const highlightTo = add(add(b, mul(dir, -endWidth * 0.5)), highlightOffset);
    return (
      <g>
        <path
          d={limbPath(a, b, startWidth, endWidth, bulge)}
          fill={fill}
          stroke={outline}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        <circle cx={a.x} cy={a.y} r={startWidth / 2} fill={fill} stroke={outline} strokeWidth={1.2} />
        <circle cx={b.x} cy={b.y} r={endWidth / 2} fill={fill} stroke={outline} strokeWidth={1.2} />
        <path
          d={`M ${highlightFrom.x.toFixed(1)} ${highlightFrom.y.toFixed(1)} L ${highlightTo.x.toFixed(1)} ${highlightTo.y.toFixed(1)}`}
          stroke={SKIN_LIGHT}
          strokeWidth={Math.max(1.5, startWidth * 0.16)}
          strokeLinecap="round"
          opacity={0.24}
        />
      </g>
    );
  };

  const drawAvatar = (path: string, center: Point, radius: number, rotateDeg: number) => (
    <>
      <clipPath id={clipId}>
        <path d={path} />
      </clipPath>
      <image
        href={avatarUrl}
        x={center.x - radius * 1.15}
        y={center.y - radius * 1.2}
        width={radius * 2.3}
        height={radius * 2.4}
        preserveAspectRatio="xMidYMid slice"
        clipPath={`url(#${clipId})`}
        transform={`rotate(${rotateDeg} ${center.x} ${center.y})`}
      />
    </>
  );

  const drawSideHead = () => {
    const center = sideGeometry.head;
    const radius = sideGeometry.headRadius;
    const up = direction(pose.side.torsoAngle);
    const hp = (x: number, y: number) => framePoint(center, up, x * radius, y * radius);
    const headPath = `M ${fmt(hp(-0.9, 0.02))}
      C ${fmt(hp(-1.0, -0.55))} ${fmt(hp(-0.55, -1.05))} ${fmt(hp(0.02, -1.03))}
      C ${fmt(hp(0.5, -1.02))} ${fmt(hp(0.76, -0.68))} ${fmt(hp(0.8, -0.3))}
      C ${fmt(hp(0.84, -0.14))} ${fmt(hp(0.99, 0.0))} ${fmt(hp(0.94, 0.12))}
      C ${fmt(hp(0.9, 0.22))} ${fmt(hp(0.76, 0.2))} ${fmt(hp(0.72, 0.27))}
      C ${fmt(hp(0.8, 0.35))} ${fmt(hp(0.76, 0.44))} ${fmt(hp(0.64, 0.47))}
      C ${fmt(hp(0.68, 0.58))} ${fmt(hp(0.56, 0.68))} ${fmt(hp(0.42, 0.72))}
      C ${fmt(hp(0.28, 0.9))} ${fmt(hp(0.0, 0.98))} ${fmt(hp(-0.24, 0.84))}
      C ${fmt(hp(-0.5, 0.74))} ${fmt(hp(-0.72, 0.58))} ${fmt(hp(-0.82, 0.4))}
      C ${fmt(hp(-0.92, 0.28))} ${fmt(hp(-0.9, 0.14))} ${fmt(hp(-0.9, 0.02))} Z`;
    const hairPath = `M ${fmt(hp(-0.92, 0.1))}
      C ${fmt(hp(-1.04, -0.5))} ${fmt(hp(-0.6, -1.12))} ${fmt(hp(0.0, -1.1))}
      C ${fmt(hp(0.46, -1.08))} ${fmt(hp(0.78, -0.78))} ${fmt(hp(0.82, -0.38))}
      C ${fmt(hp(0.62, -0.6))} ${fmt(hp(0.5, -0.72))} ${fmt(hp(0.3, -0.8))}
      C ${fmt(hp(0.02, -0.92))} ${fmt(hp(-0.35, -0.84))} ${fmt(hp(-0.62, -0.58))}
      C ${fmt(hp(-0.78, -0.42))} ${fmt(hp(-0.9, -0.16))} ${fmt(hp(-0.92, 0.1))} Z`;
    const ear = hp(-0.16, 0.12);
    return (
      <g>
        <ellipse
          cx={center.x}
          cy={center.y + radius * 0.92}
          rx={radius * 0.42}
          ry={radius * 0.22}
          fill={SKIN_DEEP}
          opacity={0.22}
        />
        <path d={headPath} fill={surface} stroke={OUTLINE} strokeWidth={1.5} />
        {avatarUrl && drawAvatar(headPath, center, radius, pose.side.torsoAngle + 90)}
        <ellipse
          cx={ear.x}
          cy={ear.y}
          rx={radius * 0.16}
          ry={radius * 0.23}
          transform={`rotate(${pose.side.torsoAngle + 90} ${ear.x} ${ear.y})`}
          fill={SKIN_MID}
          stroke={OUTLINE}
          strokeWidth={1.1}
        />
        <path d={hairPath} fill={`url(#${hairId})`} stroke={OUTLINE} strokeWidth={1.1} />
        <path
          d={`M ${fmt(hp(0.38, -0.2))} Q ${fmt(hp(0.52, -0.28))} ${fmt(hp(0.66, -0.2))}`}
          fill="none"
          stroke={HAIR}
          strokeWidth={radius * 0.1}
          strokeLinecap="round"
        />
        <ellipse cx={hp(0.52, -0.1).x} cy={hp(0.52, -0.1).y} rx={radius * 0.07} ry={radius * 0.045} fill={HAIR} />
        <path
          d={`M ${fmt(hp(0.76, -0.04))} Q ${fmt(hp(0.83, 0.02))} ${fmt(hp(0.76, 0.08))}`}
          fill="none"
          stroke={SKIN_LINE}
          strokeWidth={radius * 0.05}
          strokeLinecap="round"
          opacity={0.7}
        />
        <path
          d={`M ${fmt(hp(0.68, 0.32))} Q ${fmt(hp(0.75, 0.38))} ${fmt(hp(0.67, 0.42))}`}
          fill="none"
          stroke={SKIN_LINE}
          strokeWidth={radius * 0.045}
          strokeLinecap="round"
          opacity={0.65}
        />
        <path
          d={`M ${fmt(hp(0.44, 0.55))} Q ${fmt(hp(0.2, 0.72))} ${fmt(hp(-0.08, 0.64))}`}
          fill="none"
          stroke={SKIN_LINE}
          strokeWidth={radius * 0.035}
          strokeLinecap="round"
          opacity={0.45}
        />
      </g>
    );
  };

  const drawFrontHead = () => {
    const center = frontGeometry.head;
    const radius = frontGeometry.headRadius;
    const up = direction(pose.front.torsoAngle);
    const hp = (x: number, y: number) => framePoint(center, up, x * radius, y * radius);
    const headPath = `M ${fmt(hp(0, -1.02))}
      C ${fmt(hp(-0.62, -1.02))} ${fmt(hp(-0.8, -0.5))} ${fmt(hp(-0.78, 0.05))}
      C ${fmt(hp(-0.76, 0.55))} ${fmt(hp(-0.5, 0.92))} ${fmt(hp(0, 0.98))}
      C ${fmt(hp(0.5, 0.92))} ${fmt(hp(0.76, 0.55))} ${fmt(hp(0.78, 0.05))}
      C ${fmt(hp(0.8, -0.5))} ${fmt(hp(0.62, -1.02))} ${fmt(hp(0, -1.02))} Z`;
    const hairPath = `M ${fmt(hp(0, -1.03))}
      C ${fmt(hp(-0.55, -1.04))} ${fmt(hp(-0.8, -0.62))} ${fmt(hp(-0.79, -0.2))}
      C ${fmt(hp(-0.58, -0.48))} ${fmt(hp(-0.4, -0.62))} ${fmt(hp(0, -0.66))}
      C ${fmt(hp(0.4, -0.62))} ${fmt(hp(0.58, -0.48))} ${fmt(hp(0.79, -0.2))}
      C ${fmt(hp(0.8, -0.62))} ${fmt(hp(0.55, -1.04))} ${fmt(hp(0, -1.03))} Z`;
    const leftEar = hp(-0.79, 0.04);
    const rightEar = hp(0.79, 0.04);
    return (
      <g>
        <ellipse cx={center.x} cy={center.y + radius * 0.9} rx={radius * 0.38} ry={radius * 0.2} fill={SKIN_DEEP} opacity={0.2} />
        <path d={headPath} fill={surface} stroke={OUTLINE} strokeWidth={1.5} />
        {avatarUrl && drawAvatar(headPath, center, radius, pose.front.torsoAngle + 90)}
        <ellipse cx={leftEar.x} cy={leftEar.y} rx={radius * 0.15} ry={radius * 0.22} fill={SKIN_MID} stroke={OUTLINE} strokeWidth={1} />
        <ellipse cx={rightEar.x} cy={rightEar.y} rx={radius * 0.15} ry={radius * 0.22} fill={SKIN_MID} stroke={OUTLINE} strokeWidth={1} />
        <path d={hairPath} fill={`url(#${hairId})`} stroke={OUTLINE} strokeWidth={1.1} />
        <path
          d={`M ${fmt(hp(-0.48, -0.14))} Q ${fmt(hp(-0.32, -0.22))} ${fmt(hp(-0.16, -0.14))}`}
          fill="none"
          stroke={HAIR}
          strokeWidth={radius * 0.09}
          strokeLinecap="round"
        />
        <path
          d={`M ${fmt(hp(0.16, -0.14))} Q ${fmt(hp(0.32, -0.22))} ${fmt(hp(0.48, -0.14))}`}
          fill="none"
          stroke={HAIR}
          strokeWidth={radius * 0.09}
          strokeLinecap="round"
        />
        <ellipse cx={hp(-0.32, -0.02).x} cy={hp(-0.32, -0.02).y} rx={radius * 0.07} ry={radius * 0.045} fill={HAIR} />
        <ellipse cx={hp(0.32, -0.02).x} cy={hp(0.32, -0.02).y} rx={radius * 0.07} ry={radius * 0.045} fill={HAIR} />
        <path
          d={`M ${fmt(hp(0, 0.02))} Q ${fmt(hp(-0.05, 0.2))} ${fmt(hp(0.02, 0.26))}`}
          fill="none"
          stroke={SKIN_LINE}
          strokeWidth={radius * 0.04}
          strokeLinecap="round"
          opacity={0.55}
        />
        <path
          d={`M ${fmt(hp(-0.2, 0.46))} Q ${fmt(hp(0, 0.53))} ${fmt(hp(0.2, 0.46))}`}
          fill="none"
          stroke={SKIN_LINE}
          strokeWidth={radius * 0.05}
          strokeLinecap="round"
          opacity={0.6}
        />
      </g>
    );
  };

  const drawSideTorso = () => {
    const { hip, shoulder } = sideGeometry;
    const up = direction(pose.side.torsoAngle);
    const torsoLength = distance(hip, shoulder);
    const scale = dimensions.scale;
    const chestDepth = dimensions.chestDepthCm * scale;
    const waistDepth = dimensions.waistDepthCm * scale;
    const hipDepth = dimensions.hipWidthCm * scale * 0.54;
    const neckWidth = dimensions.neckWidthCm * scale;
    const hipDrop = Math.max(8, hipDepth * 0.32);
    const p = (x: number, y: number) => framePoint(hip, up, x, y);
    const chestFront = chestDepth * 0.56;
    const chestBack = -chestDepth * 0.46;
    const waistFront = waistDepth * 0.46;
    const waistBack = -waistDepth * 0.42;
    const hipFront = hipDepth * 0.46;
    const hipBack = -hipDepth * 0.72;
    const neckY = torsoLength + dimensions.neckLengthCm * scale * 0.45;

    const upperArmWidth = dimensions.upperArmWidthCm * scale;
    return (
      <g>
        <path
          d={`M ${fmt(p(0, neckY))}
              C ${fmt(p(chestFront * 0.35, neckY * 0.92))} ${fmt(p(chestFront * 0.82, torsoLength * 0.92))} ${fmt(p(chestFront, torsoLength * 0.78))}
              C ${fmt(p(chestFront * 1.01, torsoLength * 0.66))} ${fmt(p(waistFront, torsoLength * 0.52))} ${fmt(p(waistFront, torsoLength * 0.4))}
              C ${fmt(p(waistFront, torsoLength * 0.24))} ${fmt(p(hipFront, torsoLength * 0.1))} ${fmt(p(hipFront, 0))}
              C ${fmt(p(hipFront * 0.9, -hipDrop * 0.35))} ${fmt(p(hipBack * 0.35, -hipDrop * 0.88))} ${fmt(p(0, -hipDrop))}
              C ${fmt(p(hipBack * 0.42, -hipDrop * 0.85))} ${fmt(p(hipBack * 0.88, -hipDrop * 0.3))} ${fmt(p(hipBack, -hipDrop * 0.05))}
              C ${fmt(p(hipBack, torsoLength * 0.12))} ${fmt(p(waistBack, torsoLength * 0.26))} ${fmt(p(waistBack, torsoLength * 0.44))}
              C ${fmt(p(waistBack, torsoLength * 0.6))} ${fmt(p(chestBack, torsoLength * 0.74))} ${fmt(p(chestBack, torsoLength * 0.87))}
              C ${fmt(p(chestBack * 0.66, torsoLength + 2))} ${fmt(p(chestFront * 0.2, neckY * 1.02))} ${fmt(p(0, neckY))} Z`}
          fill={surface}
          stroke={OUTLINE}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />

        {/* Ягодичная мышца и контур спины */}
        <ellipse
          cx={p(hipBack * 0.34, -hipDrop * 0.15).x}
          cy={p(hipBack * 0.34, -hipDrop * 0.15).y}
          rx={hipDepth * 0.42}
          ry={hipDrop * 0.95}
          fill={SKIN_MID}
          opacity={0.5}
        />
        <path
          d={`M ${fmt(p(chestBack * 0.72, torsoLength * 0.8))} Q ${fmt(p(waistBack * 0.82, torsoLength * 0.5))} ${fmt(p(hipBack * 0.62, torsoLength * 0.12))}`}
          fill="none"
          stroke={SKIN_DARK}
          strokeWidth={Math.max(2, waistDepth * 0.09)}
          strokeLinecap="round"
          opacity={0.28}
        />
        <path
          d={`M ${fmt(p(0, neckY))} C ${fmt(p(chestBack * 0.25, torsoLength * 0.98))} ${fmt(p(chestBack * 0.62, torsoLength * 0.9))} ${fmt(p(chestBack * 0.86, torsoLength * 0.8))}`}
          fill="none"
          stroke={SKIN_MID}
          strokeWidth={Math.max(3, neckWidth * 0.52)}
          strokeLinecap="round"
          opacity={0.55}
        />

        {/* Грудная мышца */}
        <ellipse
          cx={p(chestFront * 0.36, torsoLength * 0.76).x}
          cy={p(chestFront * 0.36, torsoLength * 0.76).y}
          rx={chestFront * 0.52}
          ry={torsoLength * 0.12}
          fill={SKIN_LIGHT}
          opacity={0.14}
          stroke={SKIN_LINE}
          strokeWidth={1}
        />
        <path
          d={`M ${fmt(p(chestFront * 0.86, torsoLength * 0.79))} Q ${fmt(p(chestFront * 0.36, torsoLength * 0.67))} ${fmt(p(chestBack * 0.24, torsoLength * 0.75))}`}
          fill="none"
          stroke={SKIN_LINE}
          strokeWidth={1.3}
          opacity={0.28}
        />

        {/* Пресс и косая мышца */}
        {[0.52, 0.41, 0.3].map((level, index) => (
          <ellipse
            key={`abs-${index}`}
            cx={p(waistFront * 0.56, torsoLength * level).x}
            cy={p(waistFront * 0.56, torsoLength * level).y}
            rx={waistFront * 0.24}
            ry={torsoLength * 0.042}
            fill={SKIN_LIGHT}
            opacity={0.1}
            stroke={SKIN_LINE}
            strokeWidth={0.8}
          />
        ))}
        <path
          d={`M ${fmt(p(waistFront * 0.48, torsoLength * 0.48))} Q ${fmt(p(waistFront * 0.62, torsoLength * 0.3))} ${fmt(p(hipFront * 0.72, torsoLength * 0.08))}`}
          fill="none"
          stroke={SKIN_LINE}
          strokeWidth={1.2}
          opacity={0.24}
        />

        {/* Дельтовидная шапка */}
        <circle
          cx={shoulder.x}
          cy={shoulder.y}
          r={upperArmWidth * 0.62}
          fill={surface}
          stroke={OUTLINE}
          strokeWidth={1.3}
        />
        <path
          d={`M ${fmt(add(shoulder, mul(direction(pose.side.torsoAngle), upperArmWidth * 0.32)))} Q ${fmt(add(shoulder, { x: upperArmWidth * 0.42, y: -upperArmWidth * 0.2 }))} ${fmt(add(shoulder, { x: upperArmWidth * 0.2, y: -upperArmWidth * 0.45 }))}`}
          fill="none"
          stroke={SKIN_LIGHT}
          strokeWidth={1.5}
          strokeLinecap="round"
          opacity={0.25}
        />

        {/* Шея с трапецией */}
        <path
          d={`M ${fmt(p(0, neckY))} L ${fmt(p(0, torsoLength - neckWidth * 0.2))}`}
          stroke={OUTLINE}
          strokeWidth={neckWidth + 2.4}
          strokeLinecap="round"
        />
        <path
          d={`M ${fmt(p(0, neckY))} L ${fmt(p(0, torsoLength - neckWidth * 0.2))}`}
          stroke={surface}
          strokeWidth={neckWidth}
          strokeLinecap="round"
        />
      </g>
    );
  };

  const drawFrontTorso = () => {
    const { hipCenter, shoulderCenter, leftShoulder, rightShoulder } = frontGeometry;
    const up = direction(pose.front.torsoAngle);
    const torsoLength = distance(hipCenter, shoulderCenter);
    const scale = dimensions.scale;
    const shoulderHalf = dimensions.shoulderWidthCm * scale / 2;
    const chestHalf = Math.min(dimensions.chestWidthCm * scale / 2, shoulderHalf * 0.96);
    const waistHalf = dimensions.waistWidthCm * scale / 2;
    const hipHalf = dimensions.hipWidthCm * scale / 2;
    const neckHalf = dimensions.neckWidthCm * scale * 0.36;
    const hipDrop = Math.max(7, hipHalf * 0.24);
    const p = (x: number, y: number) => framePoint(hipCenter, up, x, y);
    const neckY = torsoLength + dimensions.neckLengthCm * scale * 0.42;

    return (
      <g>
        <path
          d={`M ${fmt(p(0, neckY))}
              C ${fmt(p(-neckHalf * 0.9, neckY))} ${fmt(p(-shoulderHalf * 0.64, torsoLength + 2))} ${fmt(p(-shoulderHalf, torsoLength - 1))}
              C ${fmt(p(-shoulderHalf - 2, torsoLength * 0.9))} ${fmt(p(-chestHalf - 1, torsoLength * 0.78))} ${fmt(p(-chestHalf, torsoLength * 0.69))}
              C ${fmt(p(-chestHalf * 0.98, torsoLength * 0.57))} ${fmt(p(-waistHalf - 1, torsoLength * 0.49))} ${fmt(p(-waistHalf, torsoLength * 0.42))}
              C ${fmt(p(-waistHalf, torsoLength * 0.27))} ${fmt(p(-hipHalf - 1, torsoLength * 0.09))} ${fmt(p(-hipHalf, 0))}
              C ${fmt(p(-hipHalf * 0.76, -hipDrop * 0.35))} ${fmt(p(-hipHalf * 0.3, -hipDrop * 0.86))} ${fmt(p(0, -hipDrop))}
              C ${fmt(p(hipHalf * 0.3, -hipDrop * 0.86))} ${fmt(p(hipHalf * 0.76, -hipDrop * 0.35))} ${fmt(p(hipHalf, 0))}
              C ${fmt(p(hipHalf + 1, torsoLength * 0.09))} ${fmt(p(waistHalf, torsoLength * 0.27))} ${fmt(p(waistHalf, torsoLength * 0.42))}
              C ${fmt(p(waistHalf + 1, torsoLength * 0.49))} ${fmt(p(chestHalf * 0.98, torsoLength * 0.57))} ${fmt(p(chestHalf, torsoLength * 0.69))}
              C ${fmt(p(chestHalf + 1, torsoLength * 0.78))} ${fmt(p(shoulderHalf + 2, torsoLength * 0.9))} ${fmt(p(shoulderHalf, torsoLength - 1))}
              C ${fmt(p(shoulderHalf * 0.64, torsoLength + 2))} ${fmt(p(neckHalf * 0.9, neckY))} ${fmt(p(0, neckY))} Z`}
          fill={surface}
          stroke={OUTLINE}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />

        {/* Грудные мышцы */}
        <ellipse
          cx={p(-chestHalf * 0.42, torsoLength * 0.73).x}
          cy={p(-chestHalf * 0.42, torsoLength * 0.73).y}
          rx={chestHalf * 0.38}
          ry={torsoLength * 0.11}
          fill={SKIN_LIGHT}
          opacity={0.15}
          stroke={SKIN_LINE}
          strokeWidth={0.9}
        />
        <ellipse
          cx={p(chestHalf * 0.42, torsoLength * 0.73).x}
          cy={p(chestHalf * 0.42, torsoLength * 0.73).y}
          rx={chestHalf * 0.38}
          ry={torsoLength * 0.11}
          fill={SKIN_LIGHT}
          opacity={0.15}
          stroke={SKIN_LINE}
          strokeWidth={0.9}
        />
        <path
          d={`M ${fmt(p(0, torsoLength * 0.82))} L ${fmt(p(0, torsoLength * 0.3))}`}
          stroke={SKIN_LINE}
          strokeWidth={1.1}
          opacity={0.22}
        />

        {/* Пресс: три пары долей */}
        {[0.54, 0.44, 0.34].map((level, index) => (
          <g key={`front-abs-${index}`}>
            <ellipse
              cx={p(-waistHalf * 0.17, torsoLength * level).x}
              cy={p(-waistHalf * 0.17, torsoLength * level).y}
              rx={waistHalf * 0.15}
              ry={torsoLength * 0.034}
              fill={SKIN_LIGHT}
              opacity={0.1}
              stroke={SKIN_LINE}
              strokeWidth={0.7}
            />
            <ellipse
              cx={p(waistHalf * 0.17, torsoLength * level).x}
              cy={p(waistHalf * 0.17, torsoLength * level).y}
              rx={waistHalf * 0.15}
              ry={torsoLength * 0.034}
              fill={SKIN_LIGHT}
              opacity={0.1}
              stroke={SKIN_LINE}
              strokeWidth={0.7}
            />
          </g>
        ))}

        {/* Косые мышцы */}
        <path
          d={`M ${fmt(p(-waistHalf * 0.78, torsoLength * 0.47))} Q ${fmt(p(-waistHalf * 0.95, torsoLength * 0.28))} ${fmt(p(-hipHalf * 0.72, torsoLength * 0.08))}`}
          fill="none"
          stroke={SKIN_LINE}
          strokeWidth={1.1}
          opacity={0.22}
        />
        <path
          d={`M ${fmt(p(waistHalf * 0.78, torsoLength * 0.47))} Q ${fmt(p(waistHalf * 0.95, torsoLength * 0.28))} ${fmt(p(hipHalf * 0.72, torsoLength * 0.08))}`}
          fill="none"
          stroke={SKIN_LINE}
          strokeWidth={1.1}
          opacity={0.22}
        />

        {/* Дельтовидные шапки */}
        <circle
          cx={leftShoulder.x}
          cy={leftShoulder.y}
          r={dimensions.upperArmWidthCm * scale * 0.6}
          fill={surface}
          stroke={OUTLINE}
          strokeWidth={1.2}
        />
        <circle
          cx={rightShoulder.x}
          cy={rightShoulder.y}
          r={dimensions.upperArmWidthCm * scale * 0.6}
          fill={surface}
          stroke={OUTLINE}
          strokeWidth={1.2}
        />
        <path
          d={`M ${fmt(p(-chestHalf * 0.58, torsoLength * 0.72))} Q ${fmt(p(0, torsoLength * 0.6))} ${fmt(p(chestHalf * 0.58, torsoLength * 0.72))}`}
          fill="none"
          stroke={SKIN_LIGHT}
          strokeWidth={1.3}
          opacity={0.22}
        />
        <path
          d={`M ${fmt(p(-waistHalf * 0.32, torsoLength * 0.47))} L ${fmt(p(-waistHalf * 0.26, torsoLength * 0.2))}`}
          stroke={SKIN_LINE}
          strokeWidth={1}
          opacity={0.16}
        />
        <path
          d={`M ${fmt(p(waistHalf * 0.32, torsoLength * 0.47))} L ${fmt(p(waistHalf * 0.26, torsoLength * 0.2))}`}
          stroke={SKIN_LINE}
          strokeWidth={1}
          opacity={0.16}
        />
        <circle cx={p(0, torsoLength * 0.33).x} cy={p(0, torsoLength * 0.33).y} r={1.5} fill={SKIN_LINE} opacity={0.35} />
        <path
          d={`M ${fmt(p(0, neckY))} L ${fmt(p(0, torsoLength - dimensions.neckWidthCm * scale * 0.08))}`}
          stroke={OUTLINE}
          strokeWidth={dimensions.neckWidthCm * scale + 2.2}
          strokeLinecap="round"
        />
        <path
          d={`M ${fmt(p(0, neckY))} L ${fmt(p(0, torsoLength - dimensions.neckWidthCm * scale * 0.08))}`}
          stroke={surface}
          strokeWidth={dimensions.neckWidthCm * scale}
          strokeLinecap="round"
        />
      </g>
    );
  };

  const arcLabels: React.ReactNode[] = [];
  if (showAngles) {
    const addArc = (center: Point, startAngle: number, endAngle: number, jointName: string, radius = 19) => {
      const arc = arcPath(center, startAngle, endAngle, radius);
      if (!arc) return;
      const color = colorFor(jointName);
      arcLabels.push(
        <g key={`arc-${jointName}-${center.x}-${center.y}`}>
          <path d={arc.path} fill="none" stroke={color} strokeWidth={1.6} opacity={0.85} strokeLinecap="round" />
          <text
            x={arc.label.x}
            y={arc.label.y}
            fill={color}
            fontSize={9}
            fontWeight={700}
            textAnchor="middle"
            dominantBaseline="middle"
            paintOrder="stroke"
            stroke="#081016"
            strokeWidth={3}
          >
            {arc.value}°
          </text>
        </g>,
      );
    };

    if (view === 'side') {
      addArc(sideGeometry.hip, pose.side.torsoAngle + 180, pose.side.thighAngle, 'hip', 24);
      addArc(sideGeometry.knee, pose.side.thighAngle, pose.side.shinAngle, 'knee', 20);
      addArc(sideGeometry.elbow, pose.side.upperArmAngle, pose.side.forearmAngle, 'elbow', 17);
    } else {
      addArc(frontGeometry.leftKnee, pose.front.leftThighAngle, pose.front.leftShinAngle, 'knee', 17);
      addArc(frontGeometry.rightKnee, pose.front.rightThighAngle, pose.front.rightShinAngle, 'knee', 17);
      addArc(frontGeometry.leftElbow, pose.front.leftUpperArmAngle, pose.front.leftForearmAngle, 'elbow', 15);
      addArc(frontGeometry.rightElbow, pose.front.rightUpperArmAngle, pose.front.rightForearmAngle, 'elbow', 15);
    }
  }

  const handles = geometry.handles.map((handle) => {
    const active = drag?.handle.id === handle.id;
    const jointName =
      handle.segment === 'pelvis'
        ? 'hip'
        : handle.segment.includes('knee') || handle.segment.includes('thigh') || handle.segment.includes('shin')
          ? 'knee'
          : handle.segment.includes('elbow') || handle.segment.includes('arm') || handle.segment.includes('forearm')
            ? 'elbow'
            : handle.segment === 'torsoAngle'
              ? 'spine'
              : 'shoulder';
    const color = colorFor(jointName);
    return (
      <g
        key={handle.id}
        onPointerDown={(event) => startDrag(event, handle)}
        style={{ cursor: active ? 'grabbing' : 'grab', touchAction: 'none' }}
        role="button"
        aria-label={`Двигать: ${handle.label}`}
      >
        <title>{handle.label}</title>
        <circle cx={handle.point.x} cy={handle.point.y} r={18} fill="transparent" />
        <circle
          cx={handle.point.x}
          cy={handle.point.y}
          r={active ? 10 : 8}
          fill="#071017"
          stroke={color}
          strokeWidth={2.4}
          strokeDasharray={handle.mode === 'move' ? '3 2' : undefined}
        />
        <circle cx={handle.point.x} cy={handle.point.y} r={handle.mode === 'move' ? 2.8 : 3} fill={color} />
      </g>
    );
  });

  const sideLimbWidths = {
    upperArm: dimensions.upperArmWidthCm * dimensions.scale,
    forearm: dimensions.forearmWidthCm * dimensions.scale,
    wrist: dimensions.wristWidthCm * dimensions.scale,
    thigh: dimensions.thighWidthCm * dimensions.scale,
    calf: dimensions.calfWidthCm * dimensions.scale,
    ankle: dimensions.ankleWidthCm * dimensions.scale,
  };
  const frontLimbWidths = sideLimbWidths;
  // Рука висит чуть впереди центра торса: так она читается отдельным
  // силуэтом, а не тёмной полосой поверх корпуса.
  const sideArmOffset: Point = { x: 6, y: 0 };

  /** Мышечный контур поверх сегмента: делает ногу живой, а не трубой. */
  const sideMuscle = (
    a: Point,
    b: Point,
    t: number,
    offset: number,
    length: number,
    thickness: number,
    fill: string,
    opacity: number,
  ) => {
    const dir = unit(sub(b, a));
    const normal = perp(dir);
    const center = add(add(a, mul(dir, distance(a, b) * t)), mul(normal, offset));
    const angle = (Math.atan2(dir.y, dir.x) * 180) / Math.PI;
    return (
      <ellipse
        cx={center.x}
        cy={center.y}
        rx={length}
        ry={thickness / 2}
        transform={`rotate(${angle} ${center.x} ${center.y})`}
        fill={fill}
        opacity={opacity}
      />
    );
  };

  const drawSideLeg = (
    offset: Point,
    fill: string,
    outline: string,
    muscleFill: string,
    muscleOpacity: number,
  ) => {
    const hip = add(sideGeometry.hip, offset);
    const knee = add(sideGeometry.knee, offset);
    const ankle = add(sideGeometry.ankle, offset);
    const thighLength = distance(hip, knee);
    const shinLength = distance(knee, ankle);
    return (
      <g>
        {limb(
          hip,
          knee,
          sideLimbWidths.thigh,
          sideLimbWidths.thigh * 0.68,
          sideLimbWidths.thigh * 0.11,
          fill,
          outline,
        )}
        {limb(
          knee,
          ankle,
          sideLimbWidths.calf * 0.9,
          sideLimbWidths.ankle,
          sideLimbWidths.calf * 0.12,
          fill,
          outline,
        )}
        {sideMuscle(
          hip,
          knee,
          0.38,
          -sideLimbWidths.thigh * 0.16,
          thighLength * 0.24,
          sideLimbWidths.thigh * 0.34,
          muscleFill,
          muscleOpacity,
        )}
        {sideMuscle(
          knee,
          ankle,
          0.32,
          sideLimbWidths.calf * 0.2,
          shinLength * 0.22,
          sideLimbWidths.calf * 0.4,
          muscleFill,
          muscleOpacity,
        )}
      </g>
    );
  };

  const drawSideFoot = (offset: Point, fill: string, outline: string) => {
    const ankle = add(sideGeometry.ankle, offset);
    const footLength = distance(sideGeometry.heel, sideGeometry.toe);
    const sole = Math.max(10, BODY_DRAW.soleY - ankle.y);
    const p = (x: number, y: number) => ({ x: ankle.x + x, y: ankle.y + y });
    const heel = p(-footLength * 0.34, sole);
    const heelTop = p(-footLength * 0.36, sole * 0.16);
    const ankleTop = p(-footLength * 0.04, -sole * 0.22);
    const instep = p(footLength * 0.24, sole * 0.32);
    const toeTop = p(footLength * 0.58, sole * 0.68);
    const toeTip = p(footLength * 0.66, sole * 0.9);
    const toeBottom = p(footLength * 0.66, sole);
    return (
      <g transform={`rotate(${pose.side.footAngle} ${ankle.x} ${ankle.y})`}>
        <path
          d={`M ${fmt(heel)}
              C ${fmt(p(-footLength * 0.42, sole * 0.55))} ${fmt(p(-footLength * 0.4, sole * 0.25))} ${fmt(heelTop)}
              C ${fmt(p(-footLength * 0.34, sole * 0.02))} ${fmt(p(-footLength * 0.16, -sole * 0.18))} ${fmt(ankleTop)}
              C ${fmt(p(footLength * 0.02, -sole * 0.24))} ${fmt(p(footLength * 0.12, sole * 0.05))} ${fmt(instep)}
              C ${fmt(p(footLength * 0.38, sole * 0.48))} ${fmt(p(footLength * 0.52, sole * 0.6))} ${fmt(toeTop)}
              C ${fmt(p(footLength * 0.63, sole * 0.72))} ${fmt(p(footLength * 0.66, sole * 0.82))} ${fmt(toeTip)}
              L ${fmt(toeBottom)} L ${fmt(heel)} Z`}
          fill={fill}
          stroke={outline}
          strokeWidth={2}
          strokeLinejoin="round"
          data-foot="side"
        />
        <path
          d={`M ${fmt(p(-footLength * 0.02, -sole * 0.1))} Q ${fmt(p(footLength * 0.12, sole * 0.12))} ${fmt(p(footLength * 0.5, sole * 0.55))}`}
          fill="none"
          stroke={SKIN_LIGHT}
          strokeWidth={1.2}
          opacity={0.2}
        />
        <path
          d={`M ${fmt(p(footLength * 0.56, sole * 0.58))} Q ${fmt(p(footLength * 0.6, sole * 0.5))} ${fmt(p(footLength * 0.63, sole * 0.36))}`}
          fill="none"
          stroke={SKIN_LIGHT}
          strokeWidth={1}
          opacity={0.14}
        />
      </g>
    );
  };

  /** Шорты закрывают таз и верх бедра: силуэт читается как человек, а не манекен. */
  const drawSideShorts = () => {
    const hip = sideGeometry.hip;
    const knee = sideGeometry.knee;
    const thighDir = unit(sub(knee, hip));
    const length = distance(hip, knee);
    const top = add(hip, mul(direction(pose.side.torsoAngle), 13));
    const bottom = add(hip, mul(thighDir, length * 0.42));
    const wide = sideLimbWidths.thigh * 1.12;
    const cuff = sideLimbWidths.thigh * 0.98;
    return (
      <g>
        <path
          d={limbPath(top, bottom, wide, cuff, wide * 0.05)}
          fill={shortsFill}
          stroke={OUTLINE}
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
        <path
          d={`M ${fmt(add(top, mul(perp(thighDir), -wide * 0.42)))} L ${fmt(add(bottom, mul(perp(thighDir), -cuff * 0.4)))}`}
          stroke={SHORTS_LIGHT}
          strokeWidth={1.6}
          strokeLinecap="round"
          opacity={0.5}
        />
        <path
          d={`M ${fmt(add(top, mul(direction(pose.side.torsoAngle), 2)))} L ${fmt(add(hip, mul(perp(direction(pose.side.torsoAngle)), wide * 0.82)))}`}
          stroke={OUTLINE}
          strokeWidth={1.2}
          opacity={0.35}
        />
      </g>
    );
  };

  const drawFrontShorts = () => {
    const hipCenter = { x: BODY_DRAW.hipX, y: BODY_DRAW.hipY };
    const scale = dimensions.scale;
    const half = (dimensions.hipWidthCm * scale) / 2 + 3;
    const top = hipCenter.y - 16;
    const bottom = hipCenter.y + 10;
    const legEnd = (hip: Point, knee: Point) => add(hip, mul(unit(sub(knee, hip)), distance(hip, knee) * 0.42));
    const leftEnd = legEnd(frontGeometry.leftHip, frontGeometry.leftKnee);
    const rightEnd = legEnd(frontGeometry.rightHip, frontGeometry.rightKnee);
    const cuff = frontLimbWidths.thigh * 0.96;
    return (
      <g>
        <path
          d={`M ${(hipCenter.x - half).toFixed(1)} ${top.toFixed(1)}
              Q ${hipCenter.x.toFixed(1)} ${(top - 5).toFixed(1)} ${(hipCenter.x + half).toFixed(1)} ${top.toFixed(1)}
              L ${(hipCenter.x + half * 0.96).toFixed(1)} ${bottom.toFixed(1)}
              L ${(hipCenter.x - half * 0.96).toFixed(1)} ${bottom.toFixed(1)} Z`}
          fill={shortsFill}
          stroke={OUTLINE}
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
        {limb(frontGeometry.leftHip, leftEnd, frontLimbWidths.thigh * 1.1, cuff, 0, shortsFill)}
        {limb(frontGeometry.rightHip, rightEnd, frontLimbWidths.thigh * 1.1, cuff, 0, shortsFill)}
        <path
          d={`M ${(hipCenter.x - half * 0.9).toFixed(1)} ${(top + 3).toFixed(1)} L ${(hipCenter.x + half * 0.9).toFixed(1)} ${(top + 3).toFixed(1)}`}
          stroke={SHORTS_LIGHT}
          strokeWidth={1.6}
          strokeLinecap="round"
          opacity={0.55}
        />
      </g>
    );
  };

  /** Тепловая карта нагрузки на суставы: зелёный → жёлтый → оранжевый → красный. */
  const drawHeat = () => {
    if (!heat) return null;
    const spots: Array<{ joint: LoadJoint; point: Point; radius: number }> = [];
    if (view === 'side') {
      const hip = sideGeometry.hip;
      const shoulder = sideGeometry.shoulder;
      spots.push(
        { joint: 'hip', point: hip, radius: 15 },
        { joint: 'knee', point: sideGeometry.knee, radius: 14 },
        { joint: 'spine', point: add(hip, mul(unit(sub(shoulder, hip)), distance(hip, shoulder) * 0.45)), radius: 17 },
        { joint: 'shoulder', point: shoulder, radius: 13 },
        { joint: 'elbow', point: sideGeometry.elbow, radius: 12 },
        { joint: 'ankle', point: sideGeometry.ankle, radius: 12 },
      );
    } else {
      const center = { x: BODY_DRAW.hipX, y: BODY_DRAW.hipY };
      const shoulderCenter = frontGeometry.shoulderCenter;
      spots.push(
        { joint: 'hip', point: center, radius: 17 },
        { joint: 'knee', point: frontGeometry.leftKnee, radius: 13 },
        { joint: 'knee', point: frontGeometry.rightKnee, radius: 13 },
        { joint: 'spine', point: add(center, mul(unit(sub(shoulderCenter, center)), distance(center, shoulderCenter) * 0.45)), radius: 18 },
        { joint: 'shoulder', point: shoulderCenter, radius: 15 },
        { joint: 'elbow', point: frontGeometry.leftElbow, radius: 12 },
        { joint: 'elbow', point: frontGeometry.rightElbow, radius: 12 },
        { joint: 'ankle', point: frontGeometry.leftAnkle, radius: 11 },
        { joint: 'ankle', point: frontGeometry.rightAnkle, radius: 11 },
      );
    }
    return (
      <g>
        {spots.map((spot, index) => {
          const level = heat[spot.joint];
          if (!level) return null;
          return (
            <g key={`heat-${spot.joint}-${index}`}>
              <circle
                cx={spot.point.x}
                cy={spot.point.y}
                r={spot.radius}
                fill={LOAD_LEVEL_COLOR[level]}
                opacity={0.24}
              />
              <circle
                cx={spot.point.x}
                cy={spot.point.y}
                r={spot.radius * 0.62}
                fill={LOAD_LEVEL_COLOR[level]}
                opacity={0.28}
              />
              <circle
                cx={spot.point.x}
                cy={spot.point.y}
                r={spot.radius}
                fill="none"
                stroke={LOAD_LEVEL_COLOR[level]}
                strokeWidth={1.2}
                opacity={0.55}
              />
            </g>
          );
        })}
      </g>
    );
  };

  /** Инвентарь рисуется схематично, но узнаваемо: гриф, блины или гантель. */
  const drawEquipment = () => {
    if (!equipment || equipment.kind === 'bodyweight') return null;
    const plateRadius = Math.max(8, Math.min(22, 9 + equipment.weightKg * 0.07));
    const steel = '#cbd5e1';
    const steelDark = '#64748b';
    if (equipment.kind === 'barbell') {
      if (view === 'front') {
        const left = frontGeometry.leftHand;
        const right = frontGeometry.rightHand;
        const dir = unit(sub(right, left));
        const n = perp(dir);
        const a = add(left, mul(dir, -plateRadius * 1.1));
        const b = add(right, mul(dir, plateRadius * 1.1));
        return (
          <g>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={steelDark} strokeWidth={4} strokeLinecap="round" />
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={steel} strokeWidth={2} strokeLinecap="round" />
            {[a, b].map((point, index) => (
              <g key={`plate-${index}`}>
                <ellipse
                  cx={point.x}
                  cy={point.y}
                  rx={plateRadius * 0.34}
                  ry={plateRadius}
                  transform={`rotate(${(Math.atan2(n.y, n.x) * 180) / Math.PI} ${point.x} ${point.y})`}
                  fill="#334155"
                  stroke={steelDark}
                  strokeWidth={1.2}
                />
                <ellipse
                  cx={point.x}
                  cy={point.y}
                  rx={plateRadius * 0.14}
                  ry={plateRadius * 0.42}
                  transform={`rotate(${(Math.atan2(n.y, n.x) * 180) / Math.PI} ${point.x} ${point.y})`}
                  fill="#0f172a"
                  stroke={steel}
                  strokeWidth={1}
                />
              </g>
            ))}
          </g>
        );
      }
      const anchorPoint =
        equipment.anchor === 'shoulder' ? sideGeometry.shoulder : sideGeometry.hand;
      const offset = equipment.anchor === 'shoulder' ? { x: -10, y: -2 } : { x: 0, y: 0 };
      const center = add(anchorPoint, offset);
      return (
        <g>
          <line
            x1={center.x - plateRadius * 1.5}
            y1={center.y + plateRadius * 0.2}
            x2={center.x + plateRadius * 1.2}
            y2={center.y - plateRadius * 0.15}
            stroke={steelDark}
            strokeWidth={4}
            strokeLinecap="round"
          />
          <circle cx={center.x} cy={center.y} r={plateRadius} fill="#334155" stroke={steelDark} strokeWidth={1.3} />
          <circle cx={center.x} cy={center.y} r={plateRadius * 0.62} fill="#1e293b" stroke={steel} strokeWidth={1} />
          <circle cx={center.x} cy={center.y} r={plateRadius * 0.2} fill="#0f172a" stroke={steel} strokeWidth={1} />
        </g>
      );
    }
    const hand = view === 'front' ? frontGeometry.rightHand : sideGeometry.hand;
    const dir = view === 'front' ? unit(sub(frontGeometry.rightHand, frontGeometry.rightElbow)) : unit(sub(sideGeometry.hand, sideGeometry.elbow));
    const n = perp(dir);
    const a = add(hand, mul(n, -7));
    const b = add(hand, mul(n, 7));
    return (
      <g>
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={steelDark} strokeWidth={4} strokeLinecap="round" />
        {[a, b].map((point, index) => (
          <rect
            key={`db-${index}`}
            x={point.x - 4}
            y={point.y - 5}
            width={8}
            height={10}
            rx={2.5}
            fill="#334155"
            stroke={steelDark}
            strokeWidth={1}
          />
        ))}
      </g>
    );
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${BODY_DRAW.width} ${BODY_DRAW.height}`}
      className="w-full max-w-[340px] touch-none select-none"
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      role="img"
      aria-label={`2D-модель тела, вид ${view === 'side' ? 'сбоку' : 'спереди'}. Перетаскивайте маркеры суставов.`}
    >
      <defs>
        <linearGradient id={surfaceId} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#f4cbaa" />
          <stop offset="40%" stopColor="#d99f79" />
          <stop offset="100%" stopColor="#b27352" />
        </linearGradient>
        <linearGradient id={limbId} x1="0.05" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#f1c4a1" />
          <stop offset="48%" stopColor="#d0956f" />
          <stop offset="100%" stopColor="#a86b4d" />
        </linearGradient>
        <linearGradient id={armId} x1="0" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="#f7d4b4" />
          <stop offset="50%" stopColor="#dda27c" />
          <stop offset="100%" stopColor="#b27658" />
        </linearGradient>
        <linearGradient id={shadeId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#a46a4e" />
          <stop offset="100%" stopColor="#7d4a36" />
        </linearGradient>
        <linearGradient id={hairId} x1="0" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="#3a271f" />
          <stop offset="55%" stopColor="#241713" />
          <stop offset="100%" stopColor="#150d0b" />
        </linearGradient>
        <linearGradient id={shortsId} x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#35505f" />
          <stop offset="55%" stopColor="#223641" />
          <stop offset="100%" stopColor="#14222b" />
        </linearGradient>
        <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Сетка и рост */}
      {showGrid && (
        <g opacity={0.5}>
          {[80, 160, 240, 320, 400].map((y) => (
            <line key={y} x1={34} y1={y} x2={286} y2={y} stroke="#1a2c38" strokeDasharray="3 8" />
          ))}
          <line x1={160} y1={44} x2={160} y2={492} stroke="#1f3543" strokeDasharray="2 7" />
          <line x1={300} y1={58} x2={300} y2={500} stroke="#334d5f" strokeWidth={1.2} />
          {[58, 146, 234, 322, 410, 500].map((y) => (
            <line key={y} x1={296} y1={y} x2={304} y2={y} stroke="#334d5f" />
          ))}
          <text x={308} y={64} fill="#5f7889" fontSize={8} fontWeight={600}>
            {dimensions.heightCm} см
          </text>
          <text x={308} y={500} fill="#5f7889" fontSize={7}>
            0
          </text>
        </g>
      )}

      <ellipse cx={160} cy={503} rx={86} ry={11} fill={`url(#${glowId})`} />

      {view === 'side' ? (
        <g>
          {/* Дальняя нога — чуть позади, чтобы силуэт читался объёмно */}
          {drawSideLeg({ x: -7, y: 0 }, shadeFill, OUTLINE, SKIN_DARK, 0.16)}
          {drawSideFoot({ x: -7, y: 0 }, shadeFill, OUTLINE)}

          {/* Ближняя нога под корпусом */}
          {drawSideLeg({ x: 0, y: 0 }, limbFill, OUTLINE, SKIN_LIGHT, 0.22)}
          {drawSideFoot({ x: 0, y: 0 }, limbFill, OUTLINE)}

          {drawSideTorso()}
          {drawSideShorts()}

          {/* Рука поверх корпуса: тёмный контраст, чтобы не сливалась с торсом */}
          {limb(
            add(sideGeometry.shoulder, sideArmOffset),
            add(sideGeometry.elbow, sideArmOffset),
            sideLimbWidths.upperArm,
            sideLimbWidths.upperArm * 0.7,
            sideLimbWidths.upperArm * 0.14,
            armFill,
            OUTLINE,
          )}
          {limb(
            add(sideGeometry.elbow, sideArmOffset),
            add(sideGeometry.hand, sideArmOffset),
            sideLimbWidths.forearm,
            sideLimbWidths.wrist,
            sideLimbWidths.forearm * 0.12,
            armFill,
            OUTLINE,
          )}
          {(() => {
            const hand = add(sideGeometry.hand, sideArmOffset);
            const elbow = add(sideGeometry.elbow, sideArmOffset);
            const dir = unit(sub(hand, elbow));
            const center = add(hand, mul(dir, sideLimbWidths.wrist * 0.25));
            const angle = (Math.atan2(dir.y, dir.x) * 180) / Math.PI;
            return (
              <g transform={`rotate(${angle} ${center.x} ${center.y})`}>
                <ellipse
                  cx={center.x}
                  cy={center.y}
                  rx={sideLimbWidths.wrist * 0.72}
                  ry={sideLimbWidths.wrist * 1.05}
                  fill={armFill}
                  stroke={OUTLINE}
                  strokeWidth={1.8}
                />
              </g>
            );
          })()}

          {/* Шея и голова */}
          {limb(
            sideGeometry.shoulder,
            pointAlong(sideGeometry.head, pose.side.torsoAngle + 180, sideGeometry.headRadius * 0.42),
            dimensions.neckWidthCm * dimensions.scale,
            dimensions.neckWidthCm * dimensions.scale * 0.9,
            0,
            surface,
          )}
          {drawSideHead()}
          {drawEquipment()}
        </g>
      ) : (
        <g>
          {/* Ноги */}
          {limb(
            frontGeometry.leftHip,
            frontGeometry.leftKnee,
            frontLimbWidths.thigh,
            frontLimbWidths.thigh * 0.66,
            frontLimbWidths.thigh * 0.1,
          )}
          {limb(
            frontGeometry.rightHip,
            frontGeometry.rightKnee,
            frontLimbWidths.thigh,
            frontLimbWidths.thigh * 0.66,
            frontLimbWidths.thigh * 0.1,
          )}
          {limb(
            frontGeometry.leftKnee,
            frontGeometry.leftAnkle,
            frontLimbWidths.calf * 0.92,
            frontLimbWidths.ankle,
            frontLimbWidths.calf * 0.12,
          )}
          {limb(
            frontGeometry.rightKnee,
            frontGeometry.rightAnkle,
            frontLimbWidths.calf * 0.92,
            frontLimbWidths.ankle,
            frontLimbWidths.calf * 0.12,
          )}

          {/* Стопы */}
          {(() => {
            const ry = Math.max(5.5, frontLimbWidths.ankle * 0.5);
            const footY = BODY_DRAW.soleY - ry;
            return (
              <>
                <ellipse
                  cx={frontGeometry.leftAnkle.x - 3}
                  cy={footY}
                  rx={frontLimbWidths.ankle * 1.05}
                  ry={ry}
                  fill={limbFill}
                  stroke={OUTLINE}
                  strokeWidth={1.8}
                />
                <ellipse
                  cx={frontGeometry.rightAnkle.x + 3}
                  cy={footY}
                  rx={frontLimbWidths.ankle * 1.05}
                  ry={ry}
                  fill={limbFill}
                  stroke={OUTLINE}
                  strokeWidth={1.8}
                />
              </>
            );
          })()}

          {/* Руки под корпусом */}
          {limb(
            frontGeometry.leftShoulder,
            frontGeometry.leftElbow,
            frontLimbWidths.upperArm,
            frontLimbWidths.upperArm * 0.7,
            frontLimbWidths.upperArm * 0.12,
          )}
          {limb(
            frontGeometry.rightShoulder,
            frontGeometry.rightElbow,
            frontLimbWidths.upperArm,
            frontLimbWidths.upperArm * 0.7,
            frontLimbWidths.upperArm * 0.12,
          )}
          {limb(
            frontGeometry.leftElbow,
            frontGeometry.leftHand,
            frontLimbWidths.forearm,
            frontLimbWidths.wrist,
            frontLimbWidths.forearm * 0.1,
          )}
          {limb(
            frontGeometry.rightElbow,
            frontGeometry.rightHand,
            frontLimbWidths.forearm,
            frontLimbWidths.wrist,
            frontLimbWidths.forearm * 0.1,
          )}
          <circle
            cx={frontGeometry.leftHand.x}
            cy={frontGeometry.leftHand.y}
            r={frontLimbWidths.wrist * 0.62}
            fill={limbFill}
            stroke={OUTLINE}
            strokeWidth={1.6}
          />
          <circle
            cx={frontGeometry.rightHand.x}
            cy={frontGeometry.rightHand.y}
            r={frontLimbWidths.wrist * 0.62}
            fill={limbFill}
            stroke={OUTLINE}
            strokeWidth={1.6}
          />

          {drawFrontTorso()}
          {drawFrontShorts()}
          {limb(
            frontGeometry.shoulderCenter,
            pointAlong(frontGeometry.head, pose.front.torsoAngle + 180, frontGeometry.headRadius * 0.42),
            dimensions.neckWidthCm * dimensions.scale,
            dimensions.neckWidthCm * dimensions.scale * 0.9,
            0,
            surface,
          )}
          {drawFrontHead()}
          {drawEquipment()}
        </g>
      )}

      {drawHeat()}
      {arcLabels}
      {showHandles && handles}

      <g opacity={0.75}>
        <text x={14} y={22} fill="#5f7889" fontSize={9} fontWeight={700} letterSpacing="0.12em">
          {view === 'side' ? 'ВИД СБОКУ' : 'ВИД СПЕРЕДИ'}
        </text>
        <text x={14} y={36} fill="#3f596b" fontSize={8}>
          {view === 'side' ? 'таз двигается · колено не выгибается назад' : 'колени и локти в безопасных пределах'}
        </text>
      </g>
    </svg>
  );
};
