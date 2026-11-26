import React, { useId, useMemo } from 'react';
import {
  BODY_DRAW,
  BodyDimensions,
  BodyPose,
  Point,
  buildSideGeometry,
  direction,
} from '../lib/bodyModel';
import { MUSCLES, MuscleId } from '../lib/exerciseTechnique';

export interface SkeletonEquipment {
  kind: 'barbell' | 'dumbbell' | 'bodyweight';
  weightKg: number;
  anchor: 'hand' | 'shoulder' | 'hip';
}

export type SkeletonStation = 'bench' | 'pullup' | 'dips' | 'seated' | null;

export interface SkeletonAngleSpec {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  joint: 'hip' | 'knee' | 'ankle' | 'shoulder' | 'elbow';
  a: 'hip' | 'shoulder' | 'elbow' | 'hand' | 'knee' | 'ankle';
  b: 'hip' | 'shoulder' | 'elbow' | 'hand' | 'knee' | 'ankle' | 'toe';
  vertical?: 'up' | 'down';
}

interface SkeletonModel2DProps {
  pose: BodyPose;
  dimensions: BodyDimensions;
  muscleIntensity?: Partial<Record<MuscleId, number>>;
  angles?: SkeletonAngleSpec[];
  equipment?: SkeletonEquipment | null;
  station?: SkeletonStation;
  className?: string;
}

const OUTLINE = '#6f604c';
const BONE = '#f4ead8';
const FLOOR = '#a69882';
const GRID = '#ded3c1';
const TEXT = '#7f7059';
const MUSCLE_STROKE = '#9d4636';

const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const mul = (p: Point, k: number): Point => ({ x: p.x * k, y: p.y * k });
const mix = (a: Point, b: Point, t: number): Point => add(a, mul(sub(b, a), t));
const unit = (p: Point): Point => {
  const len = Math.hypot(p.x, p.y) || 1;
  return { x: p.x / len, y: p.y / len };
};
const perp = (p: Point): Point => ({ x: -p.y, y: p.x });
const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
const fmt = (p: Point): string => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
const angleDeg = (a: Point, b: Point): number => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;

const statusColor = (value: number, min: number, max: number): string => {
  const span = Math.max(1, max - min);
  if (value < min || value > max) return '#dc2626';
  if (value - min < span * 0.12 || max - value < span * 0.12) return '#d97706';
  return '#15803d';
};

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export const SkeletonModel2D: React.FC<SkeletonModel2DProps> = ({
  pose,
  dimensions,
  muscleIntensity = {},
  angles = [],
  equipment,
  station,
  className,
}) => {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const geo = useMemo(() => buildSideGeometry(pose.side, dimensions), [pose.side, dimensions]);
  const scale = dimensions.scale;
  const widths = {
    thigh: dimensions.thighWidthCm * scale,
    calf: dimensions.calfWidthCm * scale,
    upperArm: dimensions.upperArmWidthCm * scale,
    forearm: dimensions.forearmWidthCm * scale,
    torso: Math.max(18, dimensions.chestDepthCm * scale * 0.45),
  };

  const anchor =
    equipment?.anchor === 'hip' ? geo.hip : equipment?.anchor === 'shoulder' ? geo.shoulder : geo.hand;

  const stationExtent = useMemo(() => {
    if (!station) return null;
    if (station === 'bench') {
      return {
        left: Math.min(geo.shoulder.x - 50, geo.head.x - geo.headRadius * 0.6),
        right: geo.hip.x + 34,
        top: Math.min(geo.hand.y - 20, geo.shoulder.y - 34),
        bottom: BODY_DRAW.soleY,
      };
    }
    if (station === 'seated') {
      return {
        left: geo.hip.x - 38,
        right: geo.hip.x + 86,
        top: geo.hip.y - 8,
        bottom: BODY_DRAW.soleY,
      };
    }
    const width = station === 'pullup' ? 74 : 58;
    return {
      left: geo.hand.x - width,
      right: geo.hand.x + width,
      top: geo.hand.y - 12,
      bottom: BODY_DRAW.soleY,
    };
  }, [station, geo]);

  const equipmentExtent = useMemo(() => {
    if (!equipment || equipment.kind === 'bodyweight') return null;
    if (equipment.kind === 'barbell') {
      return {
        left: anchor.x - 44,
        right: anchor.x + 20,
        top: anchor.y - 22,
        bottom: anchor.y + 22,
      };
    }
    return { left: anchor.x - 18, right: anchor.x + 18, top: anchor.y - 18, bottom: anchor.y + 18 };
  }, [equipment, anchor]);

  const fit = useMemo(() => {
    const points: Point[] = [
      geo.hip,
      geo.shoulder,
      geo.head,
      geo.elbow,
      geo.hand,
      geo.knee,
      geo.ankle,
      geo.toe,
      geo.heel,
      geo.farKnee,
      geo.farAnkle,
      geo.farToe,
      geo.farHeel,
    ];
    const r = geo.headRadius;
    points.push({ x: geo.head.x - r, y: geo.head.y - r }, { x: geo.head.x + r, y: geo.head.y + r });
    let minX = Math.min(...points.map((p) => p.x));
    let maxX = Math.max(...points.map((p) => p.x));
    let minY = Math.min(...points.map((p) => p.y));
    let maxY = Math.max(...points.map((p) => p.y));
    for (const extent of [stationExtent, equipmentExtent]) {
      if (!extent) continue;
      minX = Math.min(minX, extent.left);
      maxX = Math.max(maxX, extent.right);
      minY = Math.min(minY, extent.top);
      maxY = Math.max(maxY, extent.bottom);
    }
    const grounded = Math.min(geo.ankle.y, geo.farAnkle.y) > BODY_DRAW.soleY - 14 || station === 'bench' || station === 'seated';
    if (grounded) maxY = Math.max(maxY, BODY_DRAW.soleY);
    const safe = { left: 10, right: BODY_DRAW.width - 10, top: 14, bottom: BODY_DRAW.height - 12 };
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    let factor = Math.min(1, (safe.right - safe.left) / width, (safe.bottom - safe.top) / height);
    if (!Number.isFinite(factor) || factor <= 0) factor = 1;
    let tx = (safe.left + safe.right) / 2 - ((minX + maxX) / 2) * factor;
    let ty = grounded ? BODY_DRAW.soleY - maxY * factor : safe.top - minY * factor;
    const sminX = minX * factor + tx;
    const smaxX = maxX * factor + tx;
    const sminY = minY * factor + ty;
    const smaxY = maxY * factor + ty;
    if (sminX < safe.left) tx += safe.left - sminX;
    if (smaxX > safe.right) tx -= smaxX - safe.right;
    if (sminY < safe.top) ty += safe.top - sminY;
    if (smaxY > safe.bottom) ty -= smaxY - safe.bottom;
    return { factor, tx, ty };
  }, [geo, stationExtent, equipmentExtent, station]);

  const bone = (a: Point, b: Point, width: number, far = false) => (
    <g opacity={far ? 0.45 : 1}>
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={OUTLINE} strokeWidth={width + 2.6} strokeLinecap="round" />
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={BONE} strokeWidth={Math.max(1.6, width)} strokeLinecap="round" />
    </g>
  );

  const joint = (p: Point, r: number, far = false) => (
    <circle cx={p.x} cy={p.y} r={Math.max(2.2, r)} fill={far ? '#d9c9b3' : BONE} stroke={OUTLINE} strokeWidth={1.4} opacity={far ? 0.55 : 1} />
  );

  const muscleBand = (muscle: MuscleId) => {
    const meta = MUSCLES[muscle];
    const intensity = muscleIntensity[muscle] ?? 0;
    if (!meta?.side || intensity < 6) return null;
    const { segment, offset, width, from = 0.2, to = 0.8 } = meta.side;
    const opacity = 0.1 + clamp01(intensity / 100) * 0.5;
    const color = intensity >= 68 ? '#e04a38' : intensity >= 38 ? '#e8723a' : '#e3a33b';

    if (segment === 'glute') {
      const center = add(geo.hip, mul(perp(unit(sub(geo.shoulder, geo.hip))), -widths.torso * 0.32));
      return <ellipse cx={center.x} cy={center.y} rx={widths.thigh * 0.5 * width} ry={widths.thigh * 0.36 * width} fill={color} opacity={opacity} stroke={MUSCLE_STROKE} strokeWidth={0.7} />;
    }
    if (segment === 'shoulder') {
      const center = add(geo.shoulder, mul(perp(unit(sub(geo.elbow, geo.shoulder))), offset * widths.upperArm * 0.5));
      return <ellipse cx={center.x} cy={center.y} rx={widths.upperArm * 0.54 * width} ry={widths.upperArm * 0.44 * width} fill={color} opacity={opacity} stroke={MUSCLE_STROKE} strokeWidth={0.6} />;
    }
    if (segment === 'hip') {
      const center = add(geo.hip, mul(perp(unit(sub(geo.knee, geo.hip))), offset * widths.thigh));
      return <ellipse cx={center.x} cy={center.y} rx={widths.thigh * 0.42 * width} ry={widths.thigh * 0.3 * width} fill={color} opacity={opacity} stroke={MUSCLE_STROKE} strokeWidth={0.6} />;
    }

    let a: Point;
    let b: Point;
    let limbWidth: number;
    let positiveIsFront = false;
    if (segment === 'torso') {
      a = geo.hip;
      b = geo.shoulder;
      limbWidth = widths.torso;
      positiveIsFront = true;
    } else if (segment === 'thigh') {
      a = geo.hip;
      b = geo.knee;
      limbWidth = widths.thigh;
    } else if (segment === 'shin') {
      a = geo.knee;
      b = geo.ankle;
      limbWidth = widths.calf;
    } else if (segment === 'upperArm') {
      a = geo.shoulder;
      b = geo.elbow;
      limbWidth = widths.upperArm;
    } else {
      a = geo.elbow;
      b = geo.hand;
      limbWidth = widths.forearm;
    }
    const dir = unit(sub(b, a));
    const normal = positiveIsFront ? perp(dir) : perp(dir);
    const start = mix(a, b, from);
    const end = mix(a, b, to);
    const offsetPx = offset * limbWidth;
    const shift = mul(normal, offsetPx);
    const bandStart = add(start, shift);
    const bandEnd = add(end, shift);
    const bandWidth = Math.max(5, Math.abs(width) * limbWidth);
    const p1 = add(bandStart, mul(normal, bandWidth * 0.5));
    const p2 = add(bandStart, mul(normal, -bandWidth * 0.5));
    const p3 = add(bandEnd, mul(normal, -bandWidth * 0.42));
    const p4 = add(bandEnd, mul(normal, bandWidth * 0.42));
    return (
      <path
        d={`M ${fmt(p1)} Q ${fmt(add(mix(bandStart, bandEnd, 0.5), mul(normal, bandWidth * 0.58)))} ${fmt(p4)} L ${fmt(p3)} Q ${fmt(add(mix(bandStart, bandEnd, 0.5), mul(normal, -bandWidth * 0.5)))} ${fmt(p2)} Z`}
        fill={color}
        opacity={opacity}
        stroke={MUSCLE_STROKE}
        strokeWidth={0.65}
        strokeLinejoin="round"
      />
    );
  };

  const pointMap: Record<string, Point> = {
    hip: geo.hip,
    shoulder: geo.shoulder,
    elbow: geo.elbow,
    hand: geo.hand,
    knee: geo.knee,
    ankle: geo.ankle,
    toe: geo.toe,
  };

  const arcVectors = (spec: SkeletonAngleSpec): { center: Point; a: Point; b: Point } | null => {
    const center = pointMap[spec.joint];
    if (!center) return null;
    let a = pointMap[spec.a];
    let b = spec.vertical === 'up' ? add(center, { x: 0, y: -30 }) : spec.vertical === 'down' ? add(center, { x: 0, y: 30 }) : pointMap[spec.b];
    if (!a || !b) return null;
    if (spec.joint === 'knee' && spec.a === 'hip') {
      a = add(center, mul(unit(sub(center, pointMap.hip)), 30));
    }
    if (spec.joint === 'elbow' && spec.a === 'shoulder') {
      a = add(center, mul(unit(sub(center, pointMap.shoulder)), 30));
    }
    return { center, a, b };
  };

  const arcPath = (spec: SkeletonAngleSpec): string | null => {
    const vectors = arcVectors(spec);
    if (!vectors) return null;
    const { center, a, b } = vectors;
    const start = angleDeg(center, a);
    const end = angleDeg(center, b);
    let delta = ((end - start) % 360 + 540) % 360 - 180;
    const r = 22;
    const x1 = center.x + Math.cos((start * Math.PI) / 180) * r;
    const y1 = center.y + Math.sin((start * Math.PI) / 180) * r;
    const x2 = center.x + Math.cos(((start + delta) * Math.PI) / 180) * r;
    const y2 = center.y + Math.sin(((start + delta) * Math.PI) / 180) * r;
    return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 0 ${delta > 0 ? 1 : 0} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  };

  const angleLabel = (spec: SkeletonAngleSpec): Point | null => {
    const vectors = arcVectors(spec);
    if (!vectors) return null;
    const { center, a, b } = vectors;
    const start = angleDeg(center, a);
    const end = angleDeg(center, b);
    const delta = ((end - start) % 360 + 540) % 360 - 180;
    const mid = (start + delta / 2) * Math.PI / 180;
    const r = 34;
    return { x: center.x + Math.cos(mid) * r, y: center.y + Math.sin(mid) * r };
  };

  const drawStation = () => {
    if (!station) return null;
    if (station === 'bench') {
      const padLeft = Math.min(geo.shoulder.x - 50, geo.head.x - geo.headRadius * 0.6);
      const padRight = geo.hip.x + 34;
      const padY = geo.hip.y + 14;
      return (
        <g opacity={0.8}>
          <line x1={padLeft} y1={padY} x2={padRight} y2={padY} stroke={OUTLINE} strokeWidth={6} strokeLinecap="round" />
          <line x1={padLeft + 4} y1={padY - 3} x2={padRight - 4} y2={padY - 3} stroke="#c5b49c" strokeWidth={2.5} strokeLinecap="round" />
          <line x1={padLeft + 14} y1={padY + 4} x2={padLeft + 4} y2={BODY_DRAW.soleY} stroke={OUTLINE} strokeWidth={3} strokeLinecap="round" />
          <line x1={padRight - 14} y1={padY + 4} x2={padRight - 4} y2={BODY_DRAW.soleY} stroke={OUTLINE} strokeWidth={3} strokeLinecap="round" />
          <line x1={padLeft} y1={BODY_DRAW.soleY - 4} x2={padRight} y2={BODY_DRAW.soleY - 4} stroke="#b9a991" strokeWidth={1.2} />
        </g>
      );
    }
    if (station === 'seated') {
      const seatY = geo.hip.y + 14;
      return (
        <g opacity={0.8}>
          <line x1={geo.hip.x - 36} y1={seatY} x2={geo.hip.x + 66} y2={seatY} stroke={OUTLINE} strokeWidth={6} strokeLinecap="round" />
          <line x1={geo.hip.x - 30} y1={seatY + 4} x2={geo.hip.x - 24} y2={BODY_DRAW.soleY} stroke={OUTLINE} strokeWidth={3} strokeLinecap="round" />
          <line x1={geo.hip.x + 50} y1={seatY + 4} x2={geo.hip.x + 56} y2={BODY_DRAW.soleY} stroke={OUTLINE} strokeWidth={3} strokeLinecap="round" />
        </g>
      );
    }
    const width = station === 'pullup' ? 72 : 54;
    const barY = geo.hand.y;
    return (
      <g opacity={0.82}>
        <line x1={geo.hand.x - width} y1={barY} x2={geo.hand.x + width} y2={barY} stroke={OUTLINE} strokeWidth={6} strokeLinecap="round" />
        <line x1={geo.hand.x - width} y1={barY} x2={geo.hand.x - width} y2={BODY_DRAW.soleY} stroke={OUTLINE} strokeWidth={3.4} strokeLinecap="round" />
        <line x1={geo.hand.x + width} y1={barY} x2={geo.hand.x + width} y2={BODY_DRAW.soleY} stroke={OUTLINE} strokeWidth={3.4} strokeLinecap="round" />
      </g>
    );
  };

  const drawEquipment = () => {
    if (!equipment || equipment.kind === 'bodyweight') return null;
    if (equipment.kind === 'dumbbell') {
      const dir = unit(sub(geo.hand, geo.elbow));
      const n = perp(dir);
      const a = add(geo.hand, mul(n, -10));
      const b = add(geo.hand, mul(n, 10));
      return (
        <g>
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#5b6670" strokeWidth={5} strokeLinecap="round" />
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#cbd5e1" strokeWidth={2} strokeLinecap="round" />
          <rect x={a.x - 4} y={a.y - 7} width={8} height={14} rx={2} fill="#334155" />
          <rect x={b.x - 4} y={b.y - 7} width={8} height={14} rx={2} fill="#334155" />
        </g>
      );
    }
    const r = Math.min(22, Math.max(10, 10 + equipment.weightKg * 0.065));
    return (
      <g>
        <line x1={anchor.x - 34} y1={anchor.y} x2={anchor.x + 16} y2={anchor.y} stroke="#5b6670" strokeWidth={5} strokeLinecap="round" />
        <line x1={anchor.x - 34} y1={anchor.y} x2={anchor.x + 16} y2={anchor.y} stroke="#cbd5e1" strokeWidth={2} strokeLinecap="round" />
        <circle cx={anchor.x + 16} cy={anchor.y} r={r * 0.7} fill="#334155" stroke="#64748b" strokeWidth={1.2} />
        <circle cx={anchor.x} cy={anchor.y} r={r} fill="#334155" stroke="#64748b" strokeWidth={1.5} />
        <circle cx={anchor.x} cy={anchor.y} r={r * 0.4} fill="#0f172a" stroke="#cbd5e1" strokeWidth={0.8} />
      </g>
    );
  };

  return (
    <svg
      viewBox={`0 0 ${BODY_DRAW.width} ${BODY_DRAW.height}`}
      className={className ?? 'w-full max-w-[360px] select-none'}
      role="img"
      aria-label="Схема скелета с углами и зонами мышц"
    >
      <defs>
        <clipPath id={`clip-${id}`}>
          <rect x={0} y={0} width={BODY_DRAW.width} height={BODY_DRAW.height} rx={16} />
        </clipPath>
      </defs>
      <g clipPath={`url(#clip-${id})`}>
        <rect x={0} y={0} width={BODY_DRAW.width} height={BODY_DRAW.height} rx={16} fill="#f2ecdf" />
        <g opacity={0.55}>
          {Array.from({ length: 13 }, (_, i) => 18 + i * 24).map((x) => (
            <line key={`x-${x}`} x1={x} y1={8} x2={x} y2={BODY_DRAW.height - 8} stroke={GRID} strokeWidth={0.7} />
          ))}
          {Array.from({ length: 20 }, (_, i) => 18 + i * 24).map((y) => (
            <line key={`y-${y}`} x1={8} y1={y} x2={BODY_DRAW.width - 8} y2={y} stroke={GRID} strokeWidth={0.7} />
          ))}
        </g>
        <ellipse cx={BODY_DRAW.width / 2} cy={BODY_DRAW.soleY + 3} rx={78} ry={8} fill="#c9bda9" opacity={0.45} />
        <line x1={16} y1={BODY_DRAW.soleY} x2={BODY_DRAW.width - 16} y2={BODY_DRAW.soleY} stroke={FLOOR} strokeWidth={1.2} />
        <text x={16} y={BODY_DRAW.soleY + 14} fill={TEXT} fontSize={7} fontWeight={600}>
          пол
        </text>

        <g transform={`translate(${fit.tx.toFixed(2)} ${fit.ty.toFixed(2)}) scale(${fit.factor.toFixed(4)})`}>
          {drawStation()}
          {drawEquipment()}
          {/* мышцы под костями */}
          {(Object.keys(MUSCLES) as MuscleId[]).map((muscle) => (
            <React.Fragment key={muscle}>{muscleBand(muscle)}</React.Fragment>
          ))}
          {/* дальняя нога */}
          {bone(geo.hip, geo.farKnee, Math.max(3, widths.thigh * 0.11), true)}
          {bone(geo.farKnee, geo.farAnkle, Math.max(2.5, widths.calf * 0.1), true)}
          {bone(geo.farAnkle, geo.farToe, Math.max(2.2, widths.calf * 0.09), true)}
          {joint(geo.farKnee, Math.max(2.4, widths.thigh * 0.09), true)}
          {joint(geo.farAnkle, Math.max(2, widths.calf * 0.07), true)}
          {/* таз и позвоночник */}
          {bone(geo.hip, geo.shoulder, Math.max(4, widths.torso * 0.12))}
          {joint(geo.hip, Math.max(3, widths.thigh * 0.12))}
          {joint(geo.shoulder, Math.max(2.7, widths.upperArm * 0.16))}
          {/* ближняя нога */}
          {bone(geo.hip, geo.knee, Math.max(3.4, widths.thigh * 0.13))}
          {bone(geo.knee, geo.ankle, Math.max(3, widths.calf * 0.12))}
          {bone(geo.ankle, geo.toe, Math.max(2.4, widths.calf * 0.1))}
          {joint(geo.knee, Math.max(2.6, widths.thigh * 0.1))}
          {joint(geo.ankle, Math.max(2.2, widths.calf * 0.08))}
          {/* рука */}
          {bone(geo.shoulder, geo.elbow, Math.max(2.6, widths.upperArm * 0.12))}
          {bone(geo.elbow, geo.hand, Math.max(2.2, widths.forearm * 0.1))}
          {joint(geo.elbow, Math.max(2.2, widths.forearm * 0.1))}
          {joint(geo.hand, 2.2)}
          {/* шея и голова */}
          {bone(geo.shoulder, geo.head, Math.max(3, geo.headRadius * 0.12))}
          <ellipse
            cx={geo.head.x}
            cy={geo.head.y}
            rx={geo.headRadius * 0.78}
            ry={geo.headRadius * 0.9}
            fill={BONE}
            stroke={OUTLINE}
            strokeWidth={1.6}
            transform={`rotate(${pose.side.headAngle ?? pose.side.torsoAngle} ${geo.head.x} ${geo.head.y})`}
          />
          <circle cx={geo.head.x} cy={geo.head.y} r={geo.headRadius * 0.18} fill="none" stroke={OUTLINE} strokeWidth={1} opacity={0.35} />

          {/* длины сегментов */}
          {[
            { a: geo.hip, b: geo.shoulder, label: `корпус ${Math.round(dimensions.torsoLengthCm)} см` },
            { a: geo.hip, b: geo.knee, label: `бедро ${Math.round(dimensions.thighLengthCm)} см` },
            { a: geo.knee, b: geo.ankle, label: `голень ${Math.round(dimensions.shinLengthCm)} см` },
          ].map((item, index) => {
            const mid = mix(item.a, item.b, 0.52);
            return (
              <text
                key={`len-${index}`}
                x={mid.x + 6}
                y={mid.y - 4}
                fontSize={6.5}
                fill={TEXT}
                fontWeight={700}
                style={{ paintOrder: 'stroke', stroke: '#f2ecdf', strokeWidth: 2 }}
              >
                {item.label}
              </text>
            );
          })}

          {/* дуги углов */}
          {angles.map((spec) => {
            const path = arcPath(spec);
            const label = angleLabel(spec);
            if (!path || !label) return null;
            const color = statusColor(spec.value, spec.min, spec.max);
            return (
              <g key={spec.id}>
                <path d={path} fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" opacity={0.9} />
                <text
                  x={label.x}
                  y={label.y}
                  fontSize={7.2}
                  fontWeight={800}
                  fill={color}
                  textAnchor="middle"
                  style={{ paintOrder: 'stroke', stroke: '#f2ecdf', strokeWidth: 2.4 }}
                >
                  {Math.round(spec.value)}°
                </text>
              </g>
            );
          })}
        </g>

        <g opacity={0.85}>
          <text x={13} y={19} fill={TEXT} fontSize={8.5} fontWeight={800} letterSpacing="0.12em">
            СХЕМА · СБОКУ
          </text>
          <text x={13} y={31} fill="#9a8b74" fontSize={7}>
            длины по вашим замерам · углы расчётные
          </text>
        </g>
      </g>
    </svg>
  );
};
