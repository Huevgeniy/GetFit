import React, { useId, useMemo } from 'react';
import {
  BODY_DRAW,
  BodyDimensions,
  BodyPose,
  BodyView,
  ExerciseEvaluation,
  LOAD_LEVEL_COLOR,
  LoadJoint,
  LoadLevel,
  Point,
  buildFrontGeometry,
  buildSideGeometry,
  direction,
} from '../lib/bodyModel';

export interface BodyEquipment {
  kind: 'barbell' | 'dumbbell' | 'bodyweight';
  weightKg: number;
  anchor?: 'shoulder' | 'hand';
}

interface BodyModel2DProps {
  view: BodyView;
  pose: BodyPose;
  dimensions: BodyDimensions;
  avatarUrl?: string;
  showAngles?: boolean;
  evaluation?: ExerciseEvaluation | null;
  onChangePose?: (pose: BodyPose) => void;
  showHandles?: boolean;
  showGrid?: boolean;
  heat?: Partial<Record<LoadJoint, LoadLevel>>;
  equipment?: BodyEquipment | null;
  /** Снаряд-станция: скамья, перекладина или брусья. */
  station?: 'bench' | 'pullup' | 'dips' | null;
}

const COLOR_OUTLINE = '#5c3325';
const SKIN_LIGHT = '#f6dcc2';
const SKIN = '#e6b894';
const SKIN_MID = '#c98f70';
const SKIN_DARK = '#a96e52';
const SKIN_DEEP = '#7c4a36';
const SKIN_LINE = '#8a513c';
const MUSCLE = '#a35440';
const MUSCLE_DARK = '#7c3c2e';
const MUSCLE_LIGHT = '#c07a60';
const HAIR = '#2a1d17';
const HAIR_LIGHT = '#4a3227';
const SHORTS = '#1a2b36';
const SHORTS_LIGHT = '#2e4757';
const SHOE = '#34494c';
const SHOE_LIGHT = '#526a6d';
const SOLE = '#ece4d6';
const STEEL = '#cbd5e1';
const STEEL_DARK = '#64748b';
const STEEL_DEEP = '#1e293b';
const MAT = '#24333d';

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
const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));
const fmt = (point: Point): string => `${point.x.toFixed(1)} ${point.y.toFixed(1)}`;

function framePoint(origin: Point, up: Point, x: number, y: number): Point {
  const right = perp(up);
  return {
    x: origin.x + right.x * x + up.x * y,
    y: origin.y + right.y * x + up.y * y,
  };
}

/** Замкнутый сужающийся контур без кругов на концах: мышца, а не труба. */
function limbPath(a: Point, b: Point, startWidth: number, endWidth: number, bulge = 0): string {
  const segments = 16;
  const dir = unit(sub(b, a));
  const normal = perp(dir);
  const left: Point[] = [];
  const right: Point[] = [];
  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments;
    const center = mix(a, b, t);
    const width =
      startWidth * (1 - t) +
      endWidth * t +
      Math.sin(Math.PI * t) * bulge;
    left.push(add(center, mul(normal, width / 2)));
    right.push(add(center, mul(normal, -width / 2)));
  }
  return `${[...left, ...right.reverse()]
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${fmt(point)}`)
    .join(' ')} Z`;
}

interface LimbWidths {
  upperArm: number;
  forearm: number;
  wrist: number;
  thigh: number;
  calf: number;
  ankle: number;
}

export const BodyModel2D: React.FC<BodyModel2DProps> = ({
  view,
  pose,
  dimensions,
  avatarUrl,
  showGrid = true,
  heat,
  equipment,
  station,
}) => {
  const rawId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const surfaceId = `surface-${rawId}`;
  const skinId = `skin-${rawId}`;
  const farSkinId = `far-skin-${rawId}`;
  const armId = `arm-${rawId}`;
  const hairId = `hair-${rawId}`;
  const shortsId = `shorts-${rawId}`;
  const clipId = `avatar-${rawId}`;

  const side = useMemo(() => buildSideGeometry(pose.side, dimensions), [pose.side, dimensions]);
  const front = useMemo(() => buildFrontGeometry(pose.front, dimensions), [pose.front, dimensions]);
  const female = dimensions.sex === 'female';
  const s = dimensions.scale;

  const widths: LimbWidths = {
    upperArm: dimensions.upperArmWidthCm * s,
    forearm: dimensions.forearmWidthCm * s,
    wrist: dimensions.wristWidthCm * s,
    thigh: dimensions.thighWidthCm * s,
    calf: dimensions.calfWidthCm * s,
    ankle: dimensions.ankleWidthCm * s,
  };

  const surface = `url(#${surfaceId})`;
  const skinFill = `url(#${skinId})`;
  const farSkin = `url(#${farSkinId})`;
  const armFill = `url(#${armId})`;
  const shortsFill = `url(#${shortsId})`;
  const hairFill = `url(#${hairId})`;

  const headAngleSide = pose.side.headAngle ?? pose.side.torsoAngle;
  const headUpSide = direction(headAngleSide);
  const headUpFront = direction(pose.front.torsoAngle);

  /* ------------------------------------------------------------------ */
  /* Конечности                                                          */
  /* ------------------------------------------------------------------ */

  const drawSegment = (
    a: Point,
    b: Point,
    startWidth: number,
    endWidth: number,
    bulge: number,
    fill: string,
    outline = COLOR_OUTLINE,
  ) => (
    <path
      d={limbPath(a, b, startWidth, endWidth, bulge)}
      fill={fill}
      stroke={outline}
      strokeWidth={1.4}
      strokeLinejoin="round"
    />
  );

  const jointBlend = (point: Point, width: number, fill: string) => (
    <circle cx={point.x} cy={point.y} r={Math.max(1, width * 0.48)} fill={fill} />
  );

  const drawSideLeg = (
    hip: Point,
    knee: Point,
    ankle: Point,
    toe: Point,
    heel: Point,
    fill: string,
    outline: string,
    muscleOpacity: number,
    far = false,
  ) => {
    const thighLength = distance(hip, knee);
    const shinLength = distance(knee, ankle);
    const thighWidth = widths.thigh * (far ? 0.94 : 1);
    const calfWidth = widths.calf * (far ? 0.94 : 1);
    const thighDir = unit(sub(knee, hip));
    const shinDir = unit(sub(ankle, knee));
    const thighAngle = (Math.atan2(thighDir.y, thighDir.x) * 180) / Math.PI;
    const shinAngle = (Math.atan2(shinDir.y, shinDir.x) * 180) / Math.PI;
    const front = mul(perp(thighDir), -1);
    const back = perp(thighDir);
    const calfFront = mul(perp(shinDir), -1);
    const calfBack = perp(shinDir);
    const muscleFill = far ? MUSCLE_DARK : MUSCLE;
    const muscleLine = far ? SKIN_DEEP : MUSCLE_DARK;
    const quadCenter = add(hip, add(mul(thighDir, thighLength * 0.42), mul(front, thighWidth * 0.16)));
    const hamCenter = add(hip, add(mul(thighDir, thighLength * 0.46), mul(back, thighWidth * 0.14)));
    const calfCenter = add(knee, add(mul(shinDir, shinLength * 0.3), mul(calfBack, calfWidth * 0.12)));
    const soleusCenter = add(knee, add(mul(shinDir, shinLength * 0.62), mul(calfBack, calfWidth * 0.07)));
    return (
      <g>
        {drawSegment(hip, knee, thighWidth, thighWidth * 0.66, thighWidth * 0.11, fill, outline)}
        {drawSegment(knee, ankle, calfWidth * 0.9, widths.ankle, calfWidth * 0.12, fill, outline)}
        {jointBlend(knee, thighWidth * 0.7, fill)}
        {/* Квадрицепс и бицепс бедра */}
        <ellipse
          cx={quadCenter.x}
          cy={quadCenter.y}
          rx={thighLength * 0.27}
          ry={thighWidth * 0.19}
          transform={`rotate(${thighAngle} ${quadCenter.x} ${quadCenter.y})`}
          fill={muscleFill}
          opacity={muscleOpacity * (far ? 0.6 : 0.72)}
          stroke={muscleLine}
          strokeWidth={0.8}
        />
        <ellipse
          cx={hamCenter.x}
          cy={hamCenter.y}
          rx={thighLength * 0.26}
          ry={thighWidth * 0.14}
          transform={`rotate(${thighAngle} ${hamCenter.x} ${hamCenter.y})`}
          fill={muscleFill}
          opacity={muscleOpacity * (far ? 0.45 : 0.55)}
          stroke={muscleLine}
          strokeWidth={0.7}
        />
        {/* Коленная чашечка */}
        <ellipse
          cx={knee.x}
          cy={knee.y}
          rx={thighWidth * 0.17}
          ry={thighWidth * 0.12}
          transform={`rotate(${thighAngle} ${knee.x} ${knee.y})`}
          fill={SKIN_LIGHT}
          opacity={far ? 0.18 : 0.34}
        />
        {/* Икроножная и камбаловидная */}
        <ellipse
          cx={calfCenter.x}
          cy={calfCenter.y}
          rx={shinLength * 0.23}
          ry={calfWidth * 0.18}
          transform={`rotate(${shinAngle} ${calfCenter.x} ${calfCenter.y})`}
          fill={muscleFill}
          opacity={muscleOpacity * (far ? 0.55 : 0.65)}
          stroke={muscleLine}
          strokeWidth={0.7}
        />
        <ellipse
          cx={soleusCenter.x}
          cy={soleusCenter.y}
          rx={shinLength * 0.15}
          ry={calfWidth * 0.1}
          transform={`rotate(${shinAngle} ${soleusCenter.x} ${soleusCenter.y})`}
          fill={muscleFill}
          opacity={muscleOpacity * (far ? 0.4 : 0.48)}
        />
        {/* Передний край голени и ахилл */}
        <path
          d={`M ${fmt(add(knee, mul(calfFront, calfWidth * 0.2)))} L ${fmt(add(ankle, mul(calfFront, widths.ankle * 0.28)))}`}
          stroke={SKIN_LIGHT}
          strokeWidth={1.3}
          opacity={far ? 0.2 : 0.38}
          strokeLinecap="round"
        />
        <path
          d={`M ${fmt(add(ankle, mul(calfBack, calfWidth * 0.02)))} L ${fmt(add(ankle, mul(calfBack, calfWidth * 0.2)))}`}
          stroke={SKIN_LINE}
          strokeWidth={1.2}
          opacity={far ? 0.2 : 0.35}
          strokeLinecap="round"
        />
        {drawSideFoot(ankle, toe, heel, fill, outline)}
      </g>
    );
  };

  const drawSideArm = (shoulder: Point, elbow: Point, hand: Point, fill: string) => {
    const upperDir = unit(sub(elbow, shoulder));
    const foreDir = unit(sub(hand, elbow));
    const upperLength = distance(shoulder, elbow);
    const foreLength = distance(elbow, hand);
    const upperAngle = (Math.atan2(upperDir.y, upperDir.x) * 180) / Math.PI;
    const foreAngle = (Math.atan2(foreDir.y, foreDir.x) * 180) / Math.PI;
    const front = mul(perp(upperDir), -1);
    const back = perp(upperDir);
    const deltoid = add(shoulder, mul(upperDir, upperLength * 0.16));
    const biceps = add(shoulder, add(mul(upperDir, upperLength * 0.44), mul(front, widths.upperArm * 0.14)));
    const triceps = add(shoulder, add(mul(upperDir, upperLength * 0.42), mul(back, widths.upperArm * 0.12)));
    const forearmBelly = add(elbow, add(mul(foreDir, foreLength * 0.38), mul(perp(foreDir), widths.forearm * 0.08)));
    return (
      <g>
        {drawSegment(shoulder, elbow, widths.upperArm, widths.upperArm * 0.68, widths.upperArm * 0.12, fill)}
        {drawSegment(elbow, hand, widths.forearm, widths.wrist, widths.forearm * 0.1, fill)}
        <ellipse
          cx={deltoid.x}
          cy={deltoid.y}
          rx={widths.upperArm * 0.46}
          ry={widths.upperArm * 0.36}
          transform={`rotate(${upperAngle} ${deltoid.x} ${deltoid.y})`}
          fill={MUSCLE}
          opacity={0.45}
          stroke={MUSCLE_DARK}
          strokeWidth={0.8}
        />
        <ellipse
          cx={biceps.x}
          cy={biceps.y}
          rx={upperLength * 0.26}
          ry={widths.upperArm * 0.19}
          transform={`rotate(${upperAngle} ${biceps.x} ${biceps.y})`}
          fill={MUSCLE}
          opacity={0.42}
          stroke={MUSCLE_DARK}
          strokeWidth={0.7}
        />
        <ellipse
          cx={triceps.x}
          cy={triceps.y}
          rx={upperLength * 0.23}
          ry={widths.upperArm * 0.13}
          transform={`rotate(${upperAngle} ${triceps.x} ${triceps.y})`}
          fill={MUSCLE}
          opacity={0.28}
          stroke={MUSCLE_DARK}
          strokeWidth={0.6}
        />
        <ellipse
          cx={forearmBelly.x}
          cy={forearmBelly.y}
          rx={foreLength * 0.25}
          ry={widths.forearm * 0.2}
          transform={`rotate(${foreAngle} ${forearmBelly.x} ${forearmBelly.y})`}
          fill={MUSCLE}
          opacity={0.35}
          stroke={MUSCLE_DARK}
          strokeWidth={0.6}
        />
        {jointBlend(elbow, widths.forearm, fill)}
      </g>
    );
  };

  const drawSideFoot = (
    ankle: Point,
    toe: Point,
    heel: Point,
    fill: string,
    outline: string,
  ) => {
    const footDir = unit(sub(toe, heel));
    const soleDir = perp(footDir);
    const h = side.footHeight;
    const heelTop = add(heel, mul(soleDir, -h * 0.08));
    const heelSole = add(heel, mul(soleDir, h));
    const ankleTop = add(ankle, mul(soleDir, -h * 0.62));
    const instep = add(mix(ankle, toe, 0.4), mul(soleDir, -h * 0.2));
    const toeTop = add(toe, mul(soleDir, -h * 0.1));
    const toeSole = add(toe, mul(soleDir, h * 0.25));
    return (
      <g data-foot="side">
        <path
          d={`M ${fmt(heelTop)}
              C ${fmt(add(heel, mul(soleDir, -h * 0.32)))} ${fmt(add(ankle, mul(soleDir, -h * 0.9)))} ${fmt(ankleTop)}
              C ${fmt(add(mix(ankle, toe, 0.12), mul(soleDir, -h * 0.5)))} ${fmt(add(mix(ankle, toe, 0.28), mul(soleDir, -h * 0.38)))} ${fmt(instep)}
              C ${fmt(add(mix(ankle, toe, 0.62), mul(soleDir, -h * 0.16)))} ${fmt(add(mix(ankle, toe, 0.86), mul(soleDir, -h * 0.2)))} ${fmt(toeTop)}
              C ${fmt(add(toe, mul(soleDir, h * 0.02)))} ${fmt(add(toe, mul(soleDir, h * 0.12)))} ${fmt(toeSole)}
              C ${fmt(add(mix(heel, toe, 0.72), mul(soleDir, h * 0.82)))} ${fmt(add(mix(heel, toe, 0.35), mul(soleDir, h)))} ${fmt(heelSole)}
              C ${fmt(add(heel, mul(soleDir, h * 0.55)))} ${fmt(add(heel, mul(soleDir, h * 0.2)))} ${fmt(heelTop)} Z`}
          fill={SHOE}
          stroke={outline}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        <path
          d={`M ${fmt(add(heelSole, mul(soleDir, -h * 0.3)))}
              C ${fmt(add(mix(heel, toe, 0.35), mul(soleDir, h * 0.72)))} ${fmt(add(mix(heel, toe, 0.72), mul(soleDir, h * 0.54)))} ${fmt(add(toeSole, mul(soleDir, -h * 0.26)))}
              L ${fmt(add(toeSole, mul(soleDir, -h * 0.04)))}
              C ${fmt(add(mix(heel, toe, 0.72), mul(soleDir, h * 0.8)))} ${fmt(add(mix(heel, toe, 0.35), mul(soleDir, h)))} ${fmt(add(heelSole, mul(soleDir, -h * 0.04)))} Z`}
          fill={SOLE}
          stroke={outline}
          strokeWidth={1.1}
          strokeLinejoin="round"
        />
        <path
          d={`M ${fmt(add(mix(ankle, toe, 0.64), mul(soleDir, -h * 0.14)))} Q ${fmt(add(mix(ankle, toe, 0.82), mul(soleDir, -h * 0.1)))} ${fmt(add(mix(ankle, toe, 0.96), mul(soleDir, h * 0.03)))}`}
          fill={SHOE_LIGHT}
          stroke={outline}
          strokeWidth={0.8}
          opacity={0.75}
        />
        {[0.22, 0.34, 0.46].map((t, index) => (
          <path
            key={`lace-${index}`}
            d={`M ${fmt(add(mix(ankle, toe, t), mul(soleDir, -h * 0.52)))} L ${fmt(add(mix(ankle, toe, t), mul(soleDir, -h * 0.14)))}`}
            stroke={SOLE}
            strokeWidth={1.1}
            strokeLinecap="round"
            opacity={0.75}
          />
        ))}
        <path
          d={`M ${fmt(add(mix(heel, toe, 0.05), mul(soleDir, -h * 0.12)))} L ${fmt(add(mix(heel, toe, 0.2), mul(soleDir, -h * 0.42)))}`}
          stroke={SHOE_LIGHT}
          strokeWidth={1.2}
          strokeLinecap="round"
          opacity={0.6}
        />
      </g>
    );
  };

  const drawSideHand = (hand: Point, elbow: Point, fill: string) => {
    const dir = unit(sub(hand, elbow));
    const angle = (Math.atan2(dir.y, dir.x) * 180) / Math.PI;
    const w = Math.max(5, widths.wrist);
    const center = add(hand, mul(dir, w * 0.35));
    return (
      <g transform={`rotate(${angle} ${center.x} ${center.y})`}>
        <rect
          x={center.x - w * 0.58}
          y={center.y - w * 0.66}
          width={w * 1.16}
          height={w * 1.62}
          rx={w * 0.42}
          fill={fill}
          stroke={COLOR_OUTLINE}
          strokeWidth={1.3}
        />
        {[0.32, 0.12, -0.08, -0.28].map((offset, index) => (
          <path
            key={`finger-${index}`}
            d={`M ${center.x + w * 0.16} ${center.y + w * offset} Q ${center.x + w * 0.44} ${center.y + w * (offset + 0.02)} ${center.x + w * 0.58} ${center.y + w * (offset - 0.04)}`}
            fill="none"
            stroke={SKIN_LINE}
            strokeWidth={0.9}
            opacity={0.5}
            strokeLinecap="round"
          />
        ))}
        <path
          d={`M ${center.x - w * 0.18} ${center.y + w * 0.52} Q ${center.x - w * 0.46} ${center.y + w * 0.42} ${center.x - w * 0.5} ${center.y + w * 0.18}`}
          fill="none"
          stroke={COLOR_OUTLINE}
          strokeWidth={1.1}
          strokeLinecap="round"
        />
      </g>
    );
  };

  /* ------------------------------------------------------------------ */
  /* Корпус                                                              */
  /* ------------------------------------------------------------------ */

  const drawSideTorso = () => {
    const { hip, shoulder } = side;
    const up = direction(pose.side.torsoAngle);
    const torsoLength = distance(hip, shoulder);
    const chestDepth = dimensions.chestDepthCm * s;
    const waistDepth = dimensions.waistDepthCm * s;
    const hipDepth = dimensions.hipWidthCm * s * 0.54;
    const neckWidth = dimensions.neckWidthCm * s;
    const hipDrop = Math.max(8, hipDepth * 0.32);
    const p = (x: number, y: number) => framePoint(hip, up, x, y);
    const chestFront = chestDepth * (female ? 0.6 : 0.53);
    const chestBack = -chestDepth * (female ? 0.43 : 0.46);
    const waistFront = waistDepth * (female ? 0.4 : 0.46);
    const waistBack = -waistDepth * (female ? 0.4 : 0.43);
    const hipFront = hipDepth * (female ? 0.52 : 0.45);
    const hipBack = -hipDepth * (female ? 0.82 : 0.7);
    const neckY = torsoLength + dimensions.neckLengthCm * s * 0.45;

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
          stroke={COLOR_OUTLINE}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />

        {/* Ягодичная мышца */}
        <path
          d={`M ${fmt(p(hipBack * 0.16, torsoLength * 0.1))}
              C ${fmt(p(hipBack * 0.9, torsoLength * 0.02))} ${fmt(p(hipBack * 0.9, -hipDrop * 0.6))} ${fmt(p(0, -hipDrop * 0.96))}
              C ${fmt(p(hipBack * 0.45, -hipDrop * 0.7))} ${fmt(p(hipBack * 0.16, -hipDrop * 0.2))} ${fmt(p(hipBack * 0.16, torsoLength * 0.1))} Z`}
          fill={MUSCLE}
          opacity={0.42}
          stroke={MUSCLE_DARK}
          strokeWidth={0.8}
        />
        <path
          d={`M ${fmt(p(chestBack * 0.72, torsoLength * 0.8))} Q ${fmt(p(waistBack * 0.82, torsoLength * 0.5))} ${fmt(p(hipBack * 0.62, torsoLength * 0.12))}`}
          fill="none"
          stroke={SKIN_DARK}
          strokeWidth={Math.max(1.6, waistDepth * 0.08)}
          strokeLinecap="round"
          opacity={0.26}
        />

        {/* Широчайшая мышца спины */}
        <path
          d={`M ${fmt(p(chestBack * 0.6, torsoLength * 0.8))}
              C ${fmt(p(chestBack * 0.94, torsoLength * 0.66))} ${fmt(p(waistBack * 0.62, torsoLength * 0.44))} ${fmt(p(hipBack * 0.46, torsoLength * 0.16))}
              C ${fmt(p(waistBack * 0.3, torsoLength * 0.42))} ${fmt(p(chestBack * 0.34, torsoLength * 0.66))} ${fmt(p(chestBack * 0.6, torsoLength * 0.8))} Z`}
          fill={MUSCLE}
          opacity={female ? 0.18 : 0.24}
          stroke={MUSCLE_DARK}
          strokeWidth={0.6}
        />
        {/* Разгибатели спины */}
        <path
          d={`M ${fmt(p(chestBack * 0.42, torsoLength * 0.76))} Q ${fmt(p(waistBack * 0.48, torsoLength * 0.5))} ${fmt(p(hipBack * 0.5, torsoLength * 0.14))}`}
          fill="none"
          stroke={MUSCLE}
          strokeWidth={Math.max(2, waistDepth * 0.13)}
          strokeLinecap="round"
          opacity={0.4}
        />
        {/* Трапеция */}
        <path
          d={`M ${fmt(p(0, neckY - 2))}
              C ${fmt(p(chestBack * 0.2, torsoLength * 0.98))} ${fmt(p(chestBack * 0.55, torsoLength * 0.9))} ${fmt(p(chestBack * 0.58, torsoLength * 0.82))}
              C ${fmt(p(chestBack * 0.2, torsoLength * 0.88))} ${fmt(p(0, torsoLength * 0.9))} ${fmt(p(-neckWidth * 0.2, neckY))} Z`}
          fill={MUSCLE}
          opacity={0.3}
          stroke={MUSCLE_DARK}
          strokeWidth={0.6}
        />
        {/* Косые мышцы живота */}
        <path
          d={`M ${fmt(p(waistFront * 0.66, torsoLength * 0.56))} Q ${fmt(p(waistFront * 0.9, torsoLength * 0.36))} ${fmt(p(hipFront * 0.84, torsoLength * 0.12))}`}
          fill="none"
          stroke={MUSCLE}
          strokeWidth={Math.max(1.4, waistDepth * 0.09)}
          strokeLinecap="round"
          opacity={0.3}
        />
        {/* Кубики пресса */}
        {(female ? [0.46, 0.36] : [0.56, 0.47, 0.38, 0.29]).map((level, index) => {
          const center = p(waistFront * 0.72, torsoLength * level);
          return (
            <ellipse
              key={`abs-${index}`}
              cx={center.x}
              cy={center.y}
              rx={waistFront * 0.24}
              ry={torsoLength * 0.03}
              transform={`rotate(${pose.side.torsoAngle + 90} ${center.x} ${center.y})`}
              fill={MUSCLE}
              opacity={female ? 0.14 : 0.22}
              stroke={MUSCLE_DARK}
              strokeWidth={0.5}
            />
          );
        })}

        {/* Грудная мышца: у мужчины плоская, у женщины мягкий объём под топом */}
        {female ? (
          <>
            <path
              d={`M ${fmt(p(chestFront * 0.38, torsoLength * 0.74))}
                  C ${fmt(p(chestFront * 1.02, torsoLength * 0.68))} ${fmt(p(chestFront * 1.08, torsoLength * 0.78))} ${fmt(p(chestFront * 0.72, torsoLength * 0.84))}
                  C ${fmt(p(chestFront * 0.44, torsoLength * 0.86))} ${fmt(p(chestFront * 0.24, torsoLength * 0.82))} ${fmt(p(chestFront * 0.38, torsoLength * 0.74))} Z`}
              fill={SKIN_LIGHT}
              opacity={0.16}
              stroke={SKIN_LINE}
              strokeWidth={0.9}
            />
            <path
              d={`M ${fmt(p(chestFront * 0.42, torsoLength * 0.81))} Q ${fmt(p(chestFront * 0.72, torsoLength * 0.75))} ${fmt(p(chestFront * 0.92, torsoLength * 0.8))}`}
              fill="none"
              stroke={SKIN_LINE}
              strokeWidth={1}
              opacity={0.3}
            />
            {/* Спортивный топ сбоку: закрывает грудь и читается как одежда */}
            <path
              d={`M ${fmt(p(chestBack * 0.5, torsoLength * 0.84))}
                  C ${fmt(p(chestFront * 0.25, torsoLength * 0.85))} ${fmt(p(chestFront * 0.8, torsoLength * 0.84))} ${fmt(p(chestFront * 0.97, torsoLength * 0.78))}
                  L ${fmt(p(chestFront * 0.9, torsoLength * 0.62))}
                  C ${fmt(p(chestFront * 0.45, torsoLength * 0.57))} ${fmt(p(chestBack * 0.35, torsoLength * 0.62))} ${fmt(p(chestBack * 0.55, torsoLength * 0.68))} Z`}
              fill={shortsFill}
              stroke={COLOR_OUTLINE}
              strokeWidth={1.2}
              strokeLinejoin="round"
            />
            <path
              d={`M ${fmt(p(chestFront * 0.55, torsoLength * 0.84))} L ${fmt(p(chestFront * 0.08, torsoLength * 0.99))}`}
              stroke={SHORTS_LIGHT}
              strokeWidth={2.4}
              strokeLinecap="round"
              opacity={0.7}
            />
            <path
              d={`M ${fmt(p(chestBack * 0.45, torsoLength * 0.8))} L ${fmt(p(chestBack * 0.2, torsoLength * 0.97))}`}
              stroke={SHORTS_LIGHT}
              strokeWidth={2}
              strokeLinecap="round"
              opacity={0.45}
            />
            <path
              d={`M ${fmt(p(chestBack * 0.5, torsoLength * 0.84))} Q ${fmt(p(chestFront * 0.2, torsoLength * 0.85))} ${fmt(p(chestFront * 0.97, torsoLength * 0.78))}`}
              fill="none"
              stroke={SHORTS_LIGHT}
              strokeWidth={1.4}
              opacity={0.5}
            />
          </>
        ) : (
          <>
            <path
              d={`M ${fmt(p(chestFront * 0.9, torsoLength * 0.82))}
                  C ${fmt(p(chestFront * 0.98, torsoLength * 0.72))} ${fmt(p(chestFront * 0.62, torsoLength * 0.62))} ${fmt(p(chestFront * 0.2, torsoLength * 0.64))}
                  C ${fmt(p(chestFront * 0.5, torsoLength * 0.72))} ${fmt(p(chestFront * 0.78, torsoLength * 0.78))} ${fmt(p(chestFront * 0.9, torsoLength * 0.82))} Z`}
              fill={MUSCLE}
              opacity={0.32}
              stroke={MUSCLE_DARK}
              strokeWidth={0.7}
            />
            <path
              d={`M ${fmt(p(chestFront * 0.86, torsoLength * 0.78))} Q ${fmt(p(chestFront * 0.46, torsoLength * 0.66))} ${fmt(p(chestBack * 0.18, torsoLength * 0.74))}`}
              fill="none"
              stroke={SKIN_LINE}
              strokeWidth={1.2}
              opacity={0.26}
            />
          </>
        )}

        {/* Дельтовидная шапка: без круга-маркера, мягкий контур */}
        <path
          d={`M ${fmt(add(shoulder, { x: -widths.upperArm * 0.32, y: widths.upperArm * 0.05 }))}
              Q ${fmt(add(shoulder, { x: -widths.upperArm * 0.12, y: -widths.upperArm * 0.5 }))} ${fmt(add(shoulder, { x: widths.upperArm * 0.38, y: -widths.upperArm * 0.18 }))}`}
          fill="none"
          stroke={SKIN_LIGHT}
          strokeWidth={1.4}
          strokeLinecap="round"
          opacity={0.25}
        />

        {/* Шея */}
        <path
          d={`M ${fmt(p(0, neckY))} L ${fmt(p(0, torsoLength - neckWidth * 0.2))}`}
          stroke={COLOR_OUTLINE}
          strokeWidth={neckWidth + 2.2}
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
    const { hipCenter, shoulderCenter, leftShoulder, rightShoulder } = front;
    const up = direction(pose.front.torsoAngle);
    const torsoLength = distance(hipCenter, shoulderCenter);
    const shoulderHalf = (dimensions.shoulderWidthCm * s) / 2;
    const chestHalf = Math.min(dimensions.chestWidthCm * s / 2, shoulderHalf * 0.96);
    const waistHalf = (dimensions.waistWidthCm * s) / 2;
    const hipHalf = (dimensions.hipWidthCm * s) / 2;
    const neckHalf = dimensions.neckWidthCm * s * 0.36;
    const hipDrop = Math.max(7, hipHalf * 0.24);
    const p = (x: number, y: number) => framePoint(hipCenter, up, x, y);
    const neckY = torsoLength + dimensions.neckLengthCm * s * 0.42;

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
          stroke={COLOR_OUTLINE}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />

        {female ? (
          <g>
            {/* Спортивный топ: женская фигура читается без подчёркивания груди */}
            <path
              d={`M ${fmt(p(-chestHalf * 0.92, torsoLength * 0.82))}
                  Q ${fmt(p(0, torsoLength * 0.75))} ${fmt(p(chestHalf * 0.92, torsoLength * 0.82))}
                  L ${fmt(p(chestHalf * 0.8, torsoLength * 0.64))}
                  Q ${fmt(p(0, torsoLength * 0.57))} ${fmt(p(-chestHalf * 0.8, torsoLength * 0.64))} Z`}
              fill={shortsFill}
              stroke={COLOR_OUTLINE}
              strokeWidth={1.3}
            />
            <path
              d={`M ${fmt(p(-chestHalf * 0.62, torsoLength * 0.83))} L ${fmt(p(-shoulderHalf * 0.48, torsoLength * 0.98))}`}
              stroke={SHORTS_LIGHT}
              strokeWidth={2}
              strokeLinecap="round"
              opacity={0.65}
            />
            <path
              d={`M ${fmt(p(chestHalf * 0.62, torsoLength * 0.83))} L ${fmt(p(shoulderHalf * 0.48, torsoLength * 0.98))}`}
              stroke={SHORTS_LIGHT}
              strokeWidth={2}
              strokeLinecap="round"
              opacity={0.65}
            />
            <path
              d={`M ${fmt(p(-chestHalf * 0.7, torsoLength * 0.66))} Q ${fmt(p(0, torsoLength * 0.61))} ${fmt(p(chestHalf * 0.7, torsoLength * 0.66))}`}
              fill="none"
              stroke={SKIN_LINE}
              strokeWidth={1}
              opacity={0.25}
            />
          </g>
        ) : (
          <g>
            {/* Плоские грудные пластины: линии, а не женские объёмы */}
            <path
              d={`M ${fmt(p(-chestHalf * 0.88, torsoLength * 0.8))}
                  Q ${fmt(p(-chestHalf * 0.44, torsoLength * 0.65))} ${fmt(p(0, torsoLength * 0.71))}
                  Q ${fmt(p(chestHalf * 0.44, torsoLength * 0.65))} ${fmt(p(chestHalf * 0.88, torsoLength * 0.8))}`}
              fill="none"
              stroke={SKIN_LINE}
              strokeWidth={1.1}
              opacity={0.3}
            />
            <path
              d={`M ${fmt(p(-chestHalf * 0.76, torsoLength * 0.8))} Q ${fmt(p(-chestHalf * 0.4, torsoLength * 0.72))} ${fmt(p(-chestHalf * 0.12, torsoLength * 0.76))}`}
              fill="none"
              stroke={SKIN_LIGHT}
              strokeWidth={1.2}
              opacity={0.2}
            />
            <path
              d={`M ${fmt(p(chestHalf * 0.76, torsoLength * 0.8))} Q ${fmt(p(chestHalf * 0.4, torsoLength * 0.72))} ${fmt(p(chestHalf * 0.12, torsoLength * 0.76))}`}
              fill="none"
              stroke={SKIN_LIGHT}
              strokeWidth={1.2}
              opacity={0.2}
            />
          </g>
        )}

        {/* Грудные мышцы */}
        {!female && (
          <g>
            <path
              d={`M ${fmt(p(-chestHalf * 0.9, torsoLength * 0.8))}
                  C ${fmt(p(-chestHalf * 0.66, torsoLength * 0.66))} ${fmt(p(-chestHalf * 0.18, torsoLength * 0.66))} ${fmt(p(-chestHalf * 0.04, torsoLength * 0.74))}
                  C ${fmt(p(-chestHalf * 0.28, torsoLength * 0.8))} ${fmt(p(-chestHalf * 0.6, torsoLength * 0.84))} ${fmt(p(-chestHalf * 0.9, torsoLength * 0.8))} Z`}
              fill={MUSCLE}
              opacity={0.34}
              stroke={MUSCLE_DARK}
              strokeWidth={0.7}
            />
            <path
              d={`M ${fmt(p(chestHalf * 0.9, torsoLength * 0.8))}
                  C ${fmt(p(chestHalf * 0.66, torsoLength * 0.66))} ${fmt(p(chestHalf * 0.18, torsoLength * 0.66))} ${fmt(p(chestHalf * 0.04, torsoLength * 0.74))}
                  C ${fmt(p(chestHalf * 0.28, torsoLength * 0.8))} ${fmt(p(chestHalf * 0.6, torsoLength * 0.84))} ${fmt(p(chestHalf * 0.9, torsoLength * 0.8))} Z`}
              fill={MUSCLE}
              opacity={0.34}
              stroke={MUSCLE_DARK}
              strokeWidth={0.7}
            />
          </g>
        )}

        <path
          d={`M ${fmt(p(0, torsoLength * 0.82))} L ${fmt(p(0, torsoLength * 0.32))}`}
          stroke={SKIN_LINE}
          strokeWidth={1}
          opacity={0.2}
        />
        {[0.55, 0.45, 0.35].map((level, index) => (
          <g key={`front-abs-${index}`}>
            {[-1, 1].map((sideSign) => {
              const center = p(sideSign * waistHalf * 0.2, torsoLength * level);
              return (
                <ellipse
                  key={`abs-${sideSign}`}
                  cx={center.x}
                  cy={center.y}
                  rx={waistHalf * 0.16}
                  ry={torsoLength * 0.03}
                  transform={`rotate(${pose.front.torsoAngle + 90} ${center.x} ${center.y})`}
                  fill={MUSCLE}
                  opacity={female ? 0.14 : 0.28}
                  stroke={MUSCLE_DARK}
                  strokeWidth={0.5}
                />
              );
            })}
          </g>
        ))}

        <path
          d={`M ${fmt(p(-chestHalf * 0.58, torsoLength * 0.72))} Q ${fmt(p(0, torsoLength * 0.62))} ${fmt(p(chestHalf * 0.58, torsoLength * 0.72))}`}
          fill="none"
          stroke={SKIN_LIGHT}
          strokeWidth={1.2}
          opacity={0.18}
        />
        <path
          d={`M ${fmt(p(-waistHalf * 0.78, torsoLength * 0.47))} Q ${fmt(p(-waistHalf * 0.95, torsoLength * 0.28))} ${fmt(p(-hipHalf * 0.72, torsoLength * 0.08))}`}
          fill="none"
          stroke={SKIN_LINE}
          strokeWidth={1}
          opacity={0.2}
        />
        <path
          d={`M ${fmt(p(waistHalf * 0.78, torsoLength * 0.47))} Q ${fmt(p(waistHalf * 0.95, torsoLength * 0.28))} ${fmt(p(hipHalf * 0.72, torsoLength * 0.08))}`}
          fill="none"
          stroke={SKIN_LINE}
          strokeWidth={1}
          opacity={0.2}
        />

        {/* Дельтовидные контуры */}
        <ellipse
          cx={leftShoulder.x - widths.upperArm * 0.08}
          cy={leftShoulder.y + widths.upperArm * 0.04}
          rx={widths.upperArm * 0.42}
          ry={widths.upperArm * 0.34}
          fill={MUSCLE}
          opacity={0.32}
          stroke={MUSCLE_DARK}
          strokeWidth={0.7}
        />
        <ellipse
          cx={rightShoulder.x + widths.upperArm * 0.08}
          cy={rightShoulder.y + widths.upperArm * 0.04}
          rx={widths.upperArm * 0.42}
          ry={widths.upperArm * 0.34}
          fill={MUSCLE}
          opacity={0.32}
          stroke={MUSCLE_DARK}
          strokeWidth={0.7}
        />
        <path
          d={`M ${fmt(add(leftShoulder, { x: -widths.upperArm * 0.34, y: widths.upperArm * 0.18 }))} Q ${fmt(add(leftShoulder, { x: -widths.upperArm * 0.05, y: -widths.upperArm * 0.5 }))} ${fmt(add(leftShoulder, { x: widths.upperArm * 0.3, y: -widths.upperArm * 0.2 }))}`}
          fill="none"
          stroke={SKIN_LIGHT}
          strokeWidth={1.3}
          strokeLinecap="round"
          opacity={0.22}
        />
        <path
          d={`M ${fmt(add(rightShoulder, { x: widths.upperArm * 0.34, y: widths.upperArm * 0.18 }))} Q ${fmt(add(rightShoulder, { x: widths.upperArm * 0.05, y: -widths.upperArm * 0.5 }))} ${fmt(add(rightShoulder, { x: -widths.upperArm * 0.3, y: -widths.upperArm * 0.2 }))}`}
          fill="none"
          stroke={SKIN_LIGHT}
          strokeWidth={1.3}
          strokeLinecap="round"
          opacity={0.22}
        />

        <path
          d={`M ${fmt(p(0, neckY))} L ${fmt(p(0, torsoLength - dimensions.neckWidthCm * s * 0.08))}`}
          stroke={COLOR_OUTLINE}
          strokeWidth={dimensions.neckWidthCm * s + 2.2}
          strokeLinecap="round"
        />
        <path
          d={`M ${fmt(p(0, neckY))} L ${fmt(p(0, torsoLength - dimensions.neckWidthCm * s * 0.08))}`}
          stroke={surface}
          strokeWidth={dimensions.neckWidthCm * s}
          strokeLinecap="round"
        />
      </g>
    );
  };

  /* ------------------------------------------------------------------ */
  /* Голова                                                              */
  /* ------------------------------------------------------------------ */

  const drawAvatar = (path: string, center: Point, radius: number, rotateDeg: number) => (
    <>
      <clipPath id={clipId}>
        <path d={path} />
      </clipPath>
      <image
        href={avatarUrl}
        x={center.x - radius * 1.18}
        y={center.y - radius * 1.22}
        width={radius * 2.36}
        height={radius * 2.44}
        preserveAspectRatio="xMidYMid slice"
        clipPath={`url(#${clipId})`}
        transform={`rotate(${rotateDeg} ${center.x} ${center.y})`}
      />
    </>
  );

  const drawSideHead = () => {
    const center = side.head;
    const radius = side.headRadius;
    const hp = (x: number, y: number) => framePoint(center, headUpSide, x * radius, y * radius);
    const headPath = female
      ? `M ${fmt(hp(0, 1.02))}
          C ${fmt(hp(0.45, 1.02))} ${fmt(hp(0.72, 0.76))} ${fmt(hp(0.79, 0.44))}
          C ${fmt(hp(0.83, 0.3))} ${fmt(hp(0.82, 0.18))} ${fmt(hp(0.88, 0.12))}
          C ${fmt(hp(0.97, 0.04))} ${fmt(hp(0.98, -0.06))} ${fmt(hp(0.89, -0.11))}
          C ${fmt(hp(0.82, -0.14))} ${fmt(hp(0.77, -0.16))} ${fmt(hp(0.73, -0.2))}
          C ${fmt(hp(0.78, -0.24))} ${fmt(hp(0.79, -0.31))} ${fmt(hp(0.71, -0.35))}
          C ${fmt(hp(0.67, -0.43))} ${fmt(hp(0.63, -0.53))} ${fmt(hp(0.52, -0.62))}
          C ${fmt(hp(0.38, -0.74))} ${fmt(hp(0.18, -0.8))} ${fmt(hp(0, -0.8))}
          C ${fmt(hp(-0.28, -0.8))} ${fmt(hp(-0.5, -0.67))} ${fmt(hp(-0.6, -0.52))}
          C ${fmt(hp(-0.86, -0.28))} ${fmt(hp(-0.96, 0.06))} ${fmt(hp(-0.9, 0.36))}
          C ${fmt(hp(-0.8, 0.76))} ${fmt(hp(-0.44, 1.02))} ${fmt(hp(0, 1.02))} Z`
      : `M ${fmt(hp(0, 1.02))}
          C ${fmt(hp(0.45, 1.02))} ${fmt(hp(0.72, 0.75))} ${fmt(hp(0.8, 0.42))}
          C ${fmt(hp(0.84, 0.28))} ${fmt(hp(0.82, 0.18))} ${fmt(hp(0.88, 0.12))}
          C ${fmt(hp(0.98, 0.04))} ${fmt(hp(1, -0.06))} ${fmt(hp(0.9, -0.11))}
          C ${fmt(hp(0.82, -0.14))} ${fmt(hp(0.76, -0.16))} ${fmt(hp(0.72, -0.2))}
          C ${fmt(hp(0.78, -0.24))} ${fmt(hp(0.8, -0.31))} ${fmt(hp(0.72, -0.36))}
          C ${fmt(hp(0.68, -0.44))} ${fmt(hp(0.66, -0.54))} ${fmt(hp(0.56, -0.64))}
          C ${fmt(hp(0.4, -0.78))} ${fmt(hp(0.18, -0.84))} ${fmt(hp(0, -0.84))}
          C ${fmt(hp(-0.3, -0.84))} ${fmt(hp(-0.52, -0.72))} ${fmt(hp(-0.62, -0.56))}
          C ${fmt(hp(-0.88, -0.3))} ${fmt(hp(-0.98, 0.05))} ${fmt(hp(-0.92, 0.36))}
          C ${fmt(hp(-0.82, 0.75))} ${fmt(hp(-0.45, 1.02))} ${fmt(hp(0, 1.02))} Z`;
    const hairCap = `M ${fmt(hp(-0.94, 0.3))}
      C ${fmt(hp(-1.02, 0.72))} ${fmt(hp(-0.72, 1.08))} ${fmt(hp(-0.26, 1.12))}
      C ${fmt(hp(0.2, 1.14))} ${fmt(hp(0.58, 0.94))} ${fmt(hp(0.74, 0.56))}
      C ${fmt(hp(0.62, 0.62))} ${fmt(hp(0.48, 0.63))} ${fmt(hp(0.34, 0.6))}
      C ${fmt(hp(0.04, 0.55))} ${fmt(hp(-0.32, 0.5))} ${fmt(hp(-0.6, 0.3))}
      C ${fmt(hp(-0.74, 0.2))} ${fmt(hp(-0.86, 0.24))} ${fmt(hp(-0.94, 0.3))} Z`;
    const longHair = `M ${fmt(hp(-0.72, 0.5))}
      C ${fmt(hp(-1.24, 0.5))} ${fmt(hp(-1.3, -0.5))} ${fmt(hp(-1.02, -1.42))}
      C ${fmt(hp(-0.86, -1.94))} ${fmt(hp(-0.56, -1.78))} ${fmt(hp(-0.58, -1.48))}
      C ${fmt(hp(-0.68, -0.92))} ${fmt(hp(-0.6, -0.42))} ${fmt(hp(-0.5, -0.12))} Z`;
    const beard = `M ${fmt(hp(-0.46, -0.12))}
      C ${fmt(hp(-0.68, -0.4))} ${fmt(hp(-0.55, -0.78))} ${fmt(hp(-0.18, -0.86))}
      C ${fmt(hp(0.1, -0.94))} ${fmt(hp(0.4, -0.86))} ${fmt(hp(0.54, -0.66))}
      C ${fmt(hp(0.6, -0.56))} ${fmt(hp(0.62, -0.46))} ${fmt(hp(0.58, -0.38))}
      C ${fmt(hp(0.46, -0.44))} ${fmt(hp(0.32, -0.5))} ${fmt(hp(0.16, -0.54))}
      C ${fmt(hp(-0.06, -0.58))} ${fmt(hp(-0.28, -0.42))} ${fmt(hp(-0.46, -0.12))} Z`;
    const ear = hp(-0.2, -0.02);
    const earInner = hp(-0.2, -0.02);
    const eye = hp(0.42, 0.12);
    const browStart = hp(0.3, 0.27);
    const browMid = hp(0.45, 0.32);
    const browEnd = hp(0.6, 0.26);
    const nostril = hp(0.85, -0.08);
    const mouthStart = hp(0.6, -0.3);
    const mouthMid = hp(0.68, -0.33);
    const mouthEnd = hp(0.72, -0.28);
    return (
      <g>
        <ellipse cx={center.x} cy={center.y + radius * 0.9} rx={radius * 0.4} ry={radius * 0.18} fill={SKIN_DEEP} opacity={0.18} />
        {female && <path d={longHair} fill={hairFill} stroke={COLOR_OUTLINE} strokeWidth={1} opacity={0.98} />}
        <path d={headPath} fill={surface} stroke={COLOR_OUTLINE} strokeWidth={1.5} />
        {avatarUrl && drawAvatar(headPath, center, radius, headAngleSide + 90)}
        <ellipse
          cx={ear.x}
          cy={ear.y}
          rx={radius * 0.14}
          ry={radius * 0.21}
          transform={`rotate(${headAngleSide + 90} ${ear.x} ${ear.y})`}
          fill={SKIN_MID}
          stroke={COLOR_OUTLINE}
          strokeWidth={1}
        />
        <path
          d={`M ${fmt(earInner)} Q ${fmt(hp(-0.13, 0.03))} ${fmt(hp(-0.16, -0.09))}`}
          fill="none"
          stroke={SKIN_LINE}
          strokeWidth={0.9}
          opacity={0.6}
        />
        <path d={hairCap} fill={hairFill} stroke={COLOR_OUTLINE} strokeWidth={1} />
        {female ? (
          <>
            <path
              d={`M ${fmt(hp(-0.58, 0.34))} Q ${fmt(hp(-0.94, -0.1))} ${fmt(hp(-0.76, -0.82))}`}
              fill="none"
              stroke={HAIR_LIGHT}
              strokeWidth={radius * 0.13}
              strokeLinecap="round"
              opacity={0.85}
            />
            <path
              d={`M ${fmt(hp(-0.3, 0.52))} Q ${fmt(hp(-0.62, 0.2))} ${fmt(hp(-0.52, -0.4))}`}
              fill="none"
              stroke={HAIR_LIGHT}
              strokeWidth={radius * 0.06}
              strokeLinecap="round"
              opacity={0.5}
            />
          </>
        ) : (
          <>
            <path d={beard} fill={hairFill} stroke={COLOR_OUTLINE} strokeWidth={0.8} opacity={0.96} />
            <path
              d={`M ${fmt(hp(0.5, -0.23))} Q ${fmt(hp(0.62, -0.27))} ${fmt(hp(0.7, -0.22))}`}
              fill="none"
              stroke={HAIR_LIGHT}
              strokeWidth={radius * 0.055}
              strokeLinecap="round"
              opacity={0.9}
            />
            <path
              d={`M ${fmt(hp(-0.16, 0.18))} Q ${fmt(hp(-0.24, -0.2))} ${fmt(hp(-0.3, -0.42))}`}
              fill="none"
              stroke={HAIR}
              strokeWidth={radius * 0.1}
              strokeLinecap="round"
              opacity={0.8}
            />
          </>
        )}
        {/* Бровь и глаз */}
        <path
          d={`M ${fmt(browStart)} Q ${fmt(browMid)} ${fmt(browEnd)}`}
          fill="none"
          stroke={HAIR}
          strokeWidth={radius * (female ? 0.06 : 0.085)}
          strokeLinecap="round"
          opacity={0.95}
        />
        <ellipse cx={eye.x} cy={eye.y} rx={radius * 0.07} ry={radius * 0.045} fill={SKIN_LIGHT} stroke={COLOR_OUTLINE} strokeWidth={0.6} />
        <ellipse cx={eye.x + radius * 0.008} cy={eye.y} rx={radius * 0.033} ry={radius * 0.034} fill={HAIR} />
        <circle cx={eye.x + radius * 0.018} cy={eye.y - radius * 0.012} r={radius * 0.009} fill={SKIN_LIGHT} opacity={0.8} />
        {female && (
          <path
            d={`M ${fmt(hp(0.5, 0.2))} L ${fmt(hp(0.6, 0.16))}`}
            stroke={HAIR}
            strokeWidth={radius * 0.03}
            strokeLinecap="round"
            opacity={0.8}
          />
        )}
        {/* Нос, губы, складки */}
        <path
          d={`M ${fmt(hp(0.78, 0.04))} Q ${fmt(hp(0.9, -0.02))} ${fmt(hp(0.84, -0.1))}`}
          fill="none"
          stroke={SKIN_LINE}
          strokeWidth={radius * 0.04}
          strokeLinecap="round"
          opacity={0.65}
        />
        <ellipse cx={nostril.x} cy={nostril.y} rx={radius * 0.026} ry={radius * 0.018} fill={SKIN_DEEP} opacity={0.55} />
        <path
          d={`M ${fmt(mouthStart)} Q ${fmt(mouthMid)} ${fmt(mouthEnd)}`}
          fill="none"
          stroke={SKIN_LINE}
          strokeWidth={radius * (female ? 0.055 : 0.04)}
          strokeLinecap="round"
          opacity={0.75}
        />
        <path
          d={`M ${fmt(mouthStart)} Q ${fmt(hp(0.64, -0.38))} ${fmt(hp(0.56, -0.44))}`}
          fill="none"
          stroke={SKIN_LINE}
          strokeWidth={radius * 0.03}
          strokeLinecap="round"
          opacity={0.4}
        />
        <path
          d={`M ${fmt(hp(0.22, -0.28))} Q ${fmt(hp(0.3, -0.36))} ${fmt(hp(0.38, -0.3))}`}
          fill="none"
          stroke={SKIN_LINE}
          strokeWidth={radius * 0.025}
          strokeLinecap="round"
          opacity={0.3}
        />
      </g>
    );
  };

  const drawFrontHead = () => {
    const center = front.head;
    const radius = front.headRadius;
    const hp = (x: number, y: number) => framePoint(center, headUpFront, x * radius, y * radius);
    const headPath = female
      ? `M ${fmt(hp(0, 1.02))}
          C ${fmt(hp(-0.56, 1.02))} ${fmt(hp(-0.74, 0.56))} ${fmt(hp(-0.72, 0.08))}
          C ${fmt(hp(-0.7, -0.34))} ${fmt(hp(-0.46, -0.7))} ${fmt(hp(0, -0.8))}
          C ${fmt(hp(0.46, -0.7))} ${fmt(hp(0.7, -0.34))} ${fmt(hp(0.72, 0.08))}
          C ${fmt(hp(0.74, 0.56))} ${fmt(hp(0.56, 1.02))} ${fmt(hp(0, 1.02))} Z`
      : `M ${fmt(hp(0, 1.02))}
          C ${fmt(hp(-0.62, 1.02))} ${fmt(hp(-0.78, 0.52))} ${fmt(hp(-0.76, 0.06))}
          C ${fmt(hp(-0.74, -0.38))} ${fmt(hp(-0.5, -0.8))} ${fmt(hp(0, -0.92))}
          C ${fmt(hp(0.5, -0.8))} ${fmt(hp(0.74, -0.38))} ${fmt(hp(0.76, 0.06))}
          C ${fmt(hp(0.78, 0.52))} ${fmt(hp(0.62, 1.02))} ${fmt(hp(0, 1.02))} Z`;
    const hairCap = `M ${fmt(hp(0, 1.04))}
      C ${fmt(hp(-0.56, 1.04))} ${fmt(hp(-0.8, 0.6))} ${fmt(hp(-0.79, 0.16))}
      C ${fmt(hp(-0.58, 0.42))} ${fmt(hp(-0.38, 0.55))} ${fmt(hp(0, 0.58))}
      C ${fmt(hp(0.38, 0.55))} ${fmt(hp(0.58, 0.42))} ${fmt(hp(0.79, 0.16))}
      C ${fmt(hp(0.8, 0.6))} ${fmt(hp(0.56, 1.04))} ${fmt(hp(0, 1.04))} Z`;
    const longHairLeft = `M ${fmt(hp(-0.66, 0.4))}
      C ${fmt(hp(-1.08, 0.24))} ${fmt(hp(-1.14, -0.5))} ${fmt(hp(-0.92, -1.36))}
      C ${fmt(hp(-0.8, -1.76))} ${fmt(hp(-0.56, -1.66))} ${fmt(hp(-0.58, -1.36))}
      C ${fmt(hp(-0.66, -0.78))} ${fmt(hp(-0.56, -0.2))} ${fmt(hp(-0.46, 0.12))} Z`;
    const longHairRight = `M ${fmt(hp(0.66, 0.4))}
      C ${fmt(hp(1.08, 0.24))} ${fmt(hp(1.14, -0.5))} ${fmt(hp(0.92, -1.36))}
      C ${fmt(hp(0.8, -1.76))} ${fmt(hp(0.56, -1.66))} ${fmt(hp(0.58, -1.36))}
      C ${fmt(hp(0.66, -0.78))} ${fmt(hp(0.56, -0.2))} ${fmt(hp(0.46, 0.12))} Z`;
    const beard = `M ${fmt(hp(-0.66, -0.16))}
      C ${fmt(hp(-0.68, -0.5))} ${fmt(hp(-0.4, -0.86))} ${fmt(hp(0, -0.92))}
      C ${fmt(hp(0.4, -0.86))} ${fmt(hp(0.68, -0.5))} ${fmt(hp(0.66, -0.16))}
      C ${fmt(hp(0.5, -0.28))} ${fmt(hp(0.32, -0.36))} ${fmt(hp(0.18, -0.4))}
      C ${fmt(hp(0.06, -0.43))} ${fmt(hp(-0.06, -0.43))} ${fmt(hp(-0.18, -0.4))}
      C ${fmt(hp(-0.32, -0.36))} ${fmt(hp(-0.5, -0.28))} ${fmt(hp(-0.66, -0.16))} Z`;
    const leftEar = hp(-0.76, 0);
    const rightEar = hp(0.76, 0);
    const leftEye = hp(-0.29, 0.12);
    const rightEye = hp(0.29, 0.12);
    return (
      <g>
        <ellipse cx={center.x} cy={center.y + radius * 0.88} rx={radius * 0.34} ry={radius * 0.16} fill={SKIN_DEEP} opacity={0.16} />
        {female && (
          <g>
            <path d={longHairLeft} fill={hairFill} stroke={COLOR_OUTLINE} strokeWidth={1} />
            <path d={longHairRight} fill={hairFill} stroke={COLOR_OUTLINE} strokeWidth={1} />
          </g>
        )}
        <path d={headPath} fill={surface} stroke={COLOR_OUTLINE} strokeWidth={1.5} />
        {avatarUrl && drawAvatar(headPath, center, radius, 0)}
        <ellipse cx={leftEar.x} cy={leftEar.y} rx={radius * 0.13} ry={radius * 0.2} fill={SKIN_MID} stroke={COLOR_OUTLINE} strokeWidth={0.9} />
        <ellipse cx={rightEar.x} cy={rightEar.y} rx={radius * 0.13} ry={radius * 0.2} fill={SKIN_MID} stroke={COLOR_OUTLINE} strokeWidth={0.9} />
        <path d={hairCap} fill={hairFill} stroke={COLOR_OUTLINE} strokeWidth={1} />
        {female && (
          <>
            <path
              d={`M ${fmt(hp(-0.52, 0.46))} Q ${fmt(hp(-0.78, 0))} ${fmt(hp(-0.6, -0.82))}`}
              fill="none"
              stroke={HAIR_LIGHT}
              strokeWidth={radius * 0.09}
              strokeLinecap="round"
              opacity={0.7}
            />
            <path
              d={`M ${fmt(hp(0.52, 0.46))} Q ${fmt(hp(0.78, 0))} ${fmt(hp(0.6, -0.82))}`}
              fill="none"
              stroke={HAIR_LIGHT}
              strokeWidth={radius * 0.09}
              strokeLinecap="round"
              opacity={0.7}
            />
          </>
        )}
        {!female && (
          <>
            <path d={beard} fill={hairFill} stroke={COLOR_OUTLINE} strokeWidth={0.8} opacity={0.96} />
            <path
              d={`M ${fmt(hp(-0.2, -0.27))} Q ${fmt(hp(0, -0.33))} ${fmt(hp(0.2, -0.27))}`}
              fill="none"
              stroke={HAIR_LIGHT}
              strokeWidth={radius * 0.045}
              strokeLinecap="round"
              opacity={0.8}
            />
          </>
        )}
        {/* Брови и глаза */}
        <path
          d={`M ${fmt(hp(-0.46, 0.3))} Q ${fmt(hp(-0.32, 0.36))} ${fmt(hp(-0.16, 0.3))}`}
          fill="none"
          stroke={HAIR}
          strokeWidth={radius * (female ? 0.055 : 0.08)}
          strokeLinecap="round"
        />
        <path
          d={`M ${fmt(hp(0.16, 0.3))} Q ${fmt(hp(0.32, 0.36))} ${fmt(hp(0.46, 0.3))}`}
          fill="none"
          stroke={HAIR}
          strokeWidth={radius * (female ? 0.055 : 0.08)}
          strokeLinecap="round"
        />
        {[leftEye, rightEye].map((eye, index) => (
          <g key={`eye-${index}`}>
            <ellipse cx={eye.x} cy={eye.y} rx={radius * 0.075} ry={radius * 0.048} fill={SKIN_LIGHT} stroke={COLOR_OUTLINE} strokeWidth={0.6} />
            <ellipse cx={eye.x} cy={eye.y} rx={radius * 0.035} ry={radius * 0.036} fill={HAIR} />
            <circle cx={eye.x + radius * 0.012} cy={eye.y + radius * 0.012} r={radius * 0.009} fill={SKIN_LIGHT} opacity={0.85} />
          </g>
        ))}
        {female && (
          <>
            <path d={`M ${fmt(hp(-0.36, 0.2))} L ${fmt(hp(-0.22, 0.17))}`} stroke={HAIR} strokeWidth={radius * 0.028} strokeLinecap="round" />
            <path d={`M ${fmt(hp(0.36, 0.2))} L ${fmt(hp(0.22, 0.17))}`} stroke={HAIR} strokeWidth={radius * 0.028} strokeLinecap="round" />
          </>
        )}
        {/* Нос и губы */}
        <path
          d={`M ${fmt(hp(-0.05, 0.04))} Q ${fmt(hp(-0.08, -0.12))} ${fmt(hp(0, -0.16))} Q ${fmt(hp(0.08, -0.12))} ${fmt(hp(0.05, 0.04))}`}
          fill="none"
          stroke={SKIN_LINE}
          strokeWidth={radius * 0.035}
          strokeLinecap="round"
          opacity={0.55}
        />
        <path
          d={`M ${fmt(hp(-0.16, -0.3))} Q ${fmt(hp(0, -0.36))} ${fmt(hp(0.16, -0.3))}`}
          fill="none"
          stroke={SKIN_LINE}
          strokeWidth={radius * (female ? 0.06 : 0.045)}
          strokeLinecap="round"
          opacity={0.7}
        />
        <path
          d={`M ${fmt(hp(0, -0.16))} L ${fmt(hp(0, -0.25))}`}
          stroke={SKIN_LINE}
          strokeWidth={radius * 0.028}
          strokeLinecap="round"
          opacity={0.35}
        />
      </g>
    );
  };

  /* ------------------------------------------------------------------ */
  /* Шорты                                                               */
  /* ------------------------------------------------------------------ */

  const drawSideFarShorts = () => {
    const { hip, farKnee } = side;
    const thighDir = unit(sub(farKnee, hip));
    const thighLength = distance(hip, farKnee);
    const top = add(hip, mul(thighDir, thighLength * 0.02));
    const bottom = add(hip, mul(thighDir, thighLength * (female ? 0.32 : 0.38)));
    const wide = widths.thigh * 0.98;
    const cuff = widths.thigh * (female ? 0.88 : 0.94);
    return (
      <g>
        <path
          d={limbPath(top, bottom, wide, cuff, wide * 0.03)}
          fill={shortsFill}
          stroke={COLOR_OUTLINE}
          strokeWidth={1.2}
          strokeLinejoin="round"
          opacity={0.96}
        />
        <path
          d={`M ${fmt(add(top, mul(perp(thighDir), -wide * 0.38)))} L ${fmt(add(bottom, mul(perp(thighDir), -cuff * 0.36)))}`}
          stroke={SHORTS_LIGHT}
          strokeWidth={1.1}
          strokeLinecap="round"
          opacity={0.3}
        />
      </g>
    );
  };

  const drawSideShorts = () => {
    const { hip, knee } = side;
    const up = direction(pose.side.torsoAngle);
    const thighDir = unit(sub(knee, hip));
    const thighLength = distance(hip, knee);
    const front = mul(perp(thighDir), -1);
    const back = perp(thighDir);
    const hipDepth = dimensions.hipWidthCm * s * 0.54;
    const waist = add(hip, mul(up, female ? 11 : 13));
    const bottom = add(hip, mul(thighDir, thighLength * (female ? 0.34 : 0.4)));
    const topWidth = Math.max(hipDepth * 0.98, widths.thigh * 1.04);
    const cuffWidth = Math.max(widths.thigh * 0.96, hipDepth * 0.72);
    const topFront = add(waist, mul(front, topWidth * 0.5));
    const topBack = add(waist, mul(back, topWidth * 0.44));
    const bottomFront = add(bottom, mul(front, cuffWidth * 0.5));
    const bottomBack = add(bottom, mul(back, cuffWidth * 0.44));
    const hemMid = add(bottom, mul(thighDir, cuffWidth * 0.04));
    return (
      <g>
        <path
          d={`M ${fmt(topFront)}
              Q ${fmt(add(waist, up))} ${fmt(topBack)}
              L ${fmt(bottomBack)}
              Q ${fmt(hemMid)} ${fmt(bottomFront)}
              Z`}
          fill={shortsFill}
          stroke={COLOR_OUTLINE}
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
        <path
          d={`M ${fmt(add(topFront, mul(up, -3)))} Q ${fmt(add(waist, mul(up, -1)))} ${fmt(add(topBack, mul(up, -3)))}`}
          fill="none"
          stroke={SHORTS_LIGHT}
          strokeWidth={2.2}
          strokeLinecap="round"
          opacity={0.7}
        />
        <path
          d={`M ${fmt(bottomFront)} Q ${fmt(hemMid)} ${fmt(bottomBack)}`}
          fill="none"
          stroke={SHORTS_LIGHT}
          strokeWidth={1.3}
          strokeLinecap="round"
          opacity={0.45}
        />
        <path
          d={`M ${fmt(add(topFront, mul(up, -7)))} L ${fmt(add(bottomFront, mul(thighDir, -2)))}`}
          stroke={SHORTS_LIGHT}
          strokeWidth={1.2}
          strokeLinecap="round"
          opacity={0.35}
        />
        <path
          d={`M ${fmt(add(topBack, mul(up, -7)))} L ${fmt(add(bottomBack, mul(thighDir, -2)))}`}
          stroke={SHORTS_LIGHT}
          strokeWidth={1}
          strokeLinecap="round"
          opacity={0.25}
        />
      </g>
    );
  };

  const drawFrontShorts = () => {
    const up = direction(pose.front.torsoAngle);
    const hipHalf = (dimensions.hipWidthCm * s) / 2;
    const center = front.hipCenter;
    const top = add(center, mul(up, 14));
    const topHalf = hipHalf + (female ? 2 : 1);
    const leftEnd = mix(front.leftHip, front.leftKnee, female ? 0.34 : 0.4);
    const rightEnd = mix(front.rightHip, front.rightKnee, female ? 0.34 : 0.4);
    const legHalf = widths.thigh * (female ? 0.46 : 0.48);
    const topLeft = { x: top.x - topHalf, y: top.y };
    const topRight = { x: top.x + topHalf, y: top.y };
    const leftOuter = { x: leftEnd.x - legHalf, y: leftEnd.y };
    const leftInner = { x: leftEnd.x + legHalf * 0.14, y: leftEnd.y };
    const rightInner = { x: rightEnd.x - legHalf * 0.14, y: rightEnd.y };
    const rightOuter = { x: rightEnd.x + legHalf, y: rightEnd.y };
    const crotch = { x: center.x, y: center.y + 4 };
    return (
      <g>
        <path
          d={`M ${fmt(topLeft)}
              Q ${fmt(top)} ${fmt(topRight)}
              L ${fmt(rightOuter)}
              Q ${fmt(rightEnd)} ${fmt(rightInner)}
              L ${fmt(crotch)}
              L ${fmt(leftInner)}
              Q ${fmt(leftEnd)} ${fmt(leftOuter)}
              Z`}
          fill={shortsFill}
          stroke={COLOR_OUTLINE}
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
        <path
          d={`M ${fmt(add(topLeft, mul(up, -3)))} Q ${fmt(add(top, mul(up, -1)))} ${fmt(add(topRight, mul(up, -3)))}`}
          fill="none"
          stroke={SHORTS_LIGHT}
          strokeWidth={2.2}
          strokeLinecap="round"
          opacity={0.7}
        />
        <path
          d={`M ${fmt(add(top, mul(up, -5)))} L ${fmt(crotch)}`}
          stroke={SHORTS_LIGHT}
          strokeWidth={1.1}
          opacity={0.35}
        />
        <path
          d={`M ${fmt(leftInner)} Q ${fmt(leftEnd)} ${fmt(leftOuter)}`}
          fill="none"
          stroke={SHORTS_LIGHT}
          strokeWidth={1.2}
          opacity={0.4}
        />
        <path
          d={`M ${fmt(rightInner)} Q ${fmt(rightEnd)} ${fmt(rightOuter)}`}
          fill="none"
          stroke={SHORTS_LIGHT}
          strokeWidth={1.2}
          opacity={0.4}
        />
      </g>
    );
  };

  /* ------------------------------------------------------------------ */
  /* Инвентарь                                                           */
  /* ------------------------------------------------------------------ */

  const plateRadius = equipment
    ? clamp(11 + Math.max(0, equipment.weightKg) * 0.07, 12, 25)
    : 14;

  const equipmentAnchor: Point =
    equipment?.anchor === 'shoulder' ? side.shoulder : side.hand;

  const stationExtent = useMemo(() => {
    if (!station) return null;
    if (station === 'bench') {
      const benchY = side.hip.y + 13;
      const left = Math.min(side.shoulder.x - 50, side.head.x - side.headRadius * 0.6);
      const right = side.hip.x + 30;
      const rackY = Math.min(side.hand.y - 18, side.shoulder.y - 35);
      return { left, right, top: Math.min(rackY - 14, side.hand.y - 30), bottom: BODY_DRAW.soleY };
    }
    const width = station === 'pullup' ? 82 : 66;
    return {
      left: side.hand.x - width,
      right: side.hand.x + width,
      top: side.hand.y - 12,
      bottom: BODY_DRAW.soleY,
    };
  }, [station, side]);

  const equipmentExtent = useMemo(() => {
    if (!equipment || equipment.kind === 'bodyweight') return null;
    if (equipment.kind === 'barbell') {
      return {
        left: equipmentAnchor.x - plateRadius * 2.4 - plateRadius,
        right: equipmentAnchor.x + plateRadius * 0.9 + 8,
        top: equipmentAnchor.y - plateRadius - 8,
        bottom: equipmentAnchor.y + plateRadius + 8,
      };
    }
    return {
      left: side.hand.x - 16,
      right: side.hand.x + 16,
      top: side.hand.y - 18,
      bottom: side.hand.y + 18,
    };
  }, [equipment, equipmentAnchor, plateRadius, side.hand]);

  const fit = useMemo(() => {
    const points: Point[] = [];
    if (view === 'side') {
      points.push(
        side.hip,
        side.shoulder,
        side.head,
        side.elbow,
        side.hand,
        side.knee,
        side.ankle,
        side.toe,
        side.heel,
        side.farKnee,
        side.farAnkle,
        side.farToe,
        side.farHeel,
      );
      const r = side.headRadius;
      points.push({ x: side.head.x - r, y: side.head.y - r }, { x: side.head.x + r, y: side.head.y + r });
    } else {
      points.push(
        front.hipCenter,
        front.shoulderCenter,
        front.head,
        front.leftShoulder,
        front.rightShoulder,
        front.leftHip,
        front.rightHip,
        front.leftElbow,
        front.rightElbow,
        front.leftHand,
        front.rightHand,
        front.leftKnee,
        front.rightKnee,
        front.leftAnkle,
        front.rightAnkle,
        { x: front.leftAnkle.x, y: BODY_DRAW.soleY },
        { x: front.rightAnkle.x, y: BODY_DRAW.soleY },
      );
      const r = front.headRadius;
      points.push({ x: front.head.x - r, y: front.head.y - r }, { x: front.head.x + r, y: front.head.y + r });
    }
    let minX = Math.min(...points.map((p) => p.x));
    let maxX = Math.max(...points.map((p) => p.x));
    let minY = Math.min(...points.map((p) => p.y));
    let maxY = Math.max(...points.map((p) => p.y));
    const extents = [stationExtent, equipmentExtent].filter(Boolean) as Array<{
      left: number;
      right: number;
      top: number;
      bottom: number;
    }>;
    for (const extent of extents) {
      minX = Math.min(minX, extent.left);
      maxX = Math.max(maxX, extent.right);
      minY = Math.min(minY, extent.top);
      maxY = Math.max(maxY, extent.bottom);
    }
    const grounded = view === 'side' && Math.min(side.ankle.y, side.farAnkle.y) > BODY_DRAW.soleY - 16;
    if (grounded) maxY = Math.max(maxY, BODY_DRAW.soleY);
    const safe = { left: 12, right: BODY_DRAW.width - 12, top: 12, bottom: BODY_DRAW.height - 10 };
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    let scale = Math.min(1, (safe.right - safe.left) / width, (safe.bottom - safe.top) / height);
    if (!Number.isFinite(scale) || scale <= 0) scale = 1;
    let tx = (safe.left + safe.right) / 2 - ((minX + maxX) / 2) * scale;
    let ty = grounded ? BODY_DRAW.soleY - maxY * scale : safe.top - minY * scale;
    const scaledMinX = minX * scale + tx;
    const scaledMaxX = maxX * scale + tx;
    const scaledMinY = minY * scale + ty;
    const scaledMaxY = maxY * scale + ty;
    if (scaledMinX < safe.left) tx += safe.left - scaledMinX;
    if (scaledMaxX > safe.right) tx -= scaledMaxX - safe.right;
    if (scaledMinY < safe.top) ty += safe.top - scaledMinY;
    if (scaledMaxY > safe.bottom) ty -= scaledMaxY - safe.bottom;
    return { scale, tx, ty };
  }, [view, side, front, stationExtent, equipmentExtent]);

  /* ------------------------------------------------------------------ */
  /* Тепловая карта                                                      */
  /* ------------------------------------------------------------------ */

  const heatSpots = useMemo(() => {
    if (!heat) return [] as Array<{ joint: LoadJoint; point: Point; radius: number }>;
    const spots: Array<{ joint: LoadJoint; point: Point; radius: number }> = [];
    if (view === 'side') {
      spots.push(
        { joint: 'hip', point: side.hip, radius: 8 },
        { joint: 'knee', point: side.knee, radius: 7 },
        { joint: 'ankle', point: side.ankle, radius: 6 },
        { joint: 'spine', point: mix(side.hip, side.shoulder, 0.45), radius: 10 },
        { joint: 'shoulder', point: side.shoulder, radius: 8 },
        { joint: 'elbow', point: side.elbow, radius: 6 },
      );
    } else {
      spots.push(
        { joint: 'hip', point: front.hipCenter, radius: 9 },
        { joint: 'knee', point: front.leftKnee, radius: 7 },
        { joint: 'knee', point: front.rightKnee, radius: 7 },
        { joint: 'ankle', point: front.leftAnkle, radius: 6 },
        { joint: 'ankle', point: front.rightAnkle, radius: 6 },
        { joint: 'spine', point: mix(front.hipCenter, front.shoulderCenter, 0.45), radius: 11 },
        { joint: 'shoulder', point: front.leftShoulder, radius: 7 },
        { joint: 'shoulder', point: front.rightShoulder, radius: 7 },
        { joint: 'elbow', point: front.leftElbow, radius: 6 },
        { joint: 'elbow', point: front.rightElbow, radius: 6 },
      );
    }
    return spots.filter((spot) => heat[spot.joint]);
  }, [heat, view, side, front]);

  const drawHeat = () => {
    if (!heatSpots.length) return null;
    return (
      <g>
        {heatSpots.map((spot, index) => {
          const level = heat?.[spot.joint];
          if (!level) return null;
          const color = LOAD_LEVEL_COLOR[level];
          return (
            <g key={`heat-${spot.joint}-${index}`} data-heat={spot.joint}>
              <circle cx={spot.point.x} cy={spot.point.y} r={spot.radius * 0.55} fill={color} opacity={0.12} />
              <circle cx={spot.point.x} cy={spot.point.y} r={spot.radius * 0.28} fill={color} opacity={0.2} />
              <circle cx={spot.point.x} cy={spot.point.y} r={1.6} fill={color} opacity={0.85} />
            </g>
          );
        })}
      </g>
    );
  };

  /* ------------------------------------------------------------------ */
  /* Станции и снаряды                                                   */
  /* ------------------------------------------------------------------ */

  const renderStation = () => {
    if (view !== 'side' || !station) return null;
    if (station === 'bench') {
      const benchY = side.hip.y + 13;
      const left = Math.min(side.shoulder.x - 50, side.head.x - side.headRadius * 0.6);
      const right = side.hip.x + 30;
      const rackY = Math.min(side.hand.y - 18, side.shoulder.y - 35);
      const rackLeft = side.head.x - 6;
      return (
        <g>
          {/* Рама стойки */}
          <line x1={rackLeft} y1={BODY_DRAW.soleY} x2={rackLeft} y2={rackY} stroke={STEEL_DARK} strokeWidth={4} strokeLinecap="round" />
          <line x1={rackLeft + 8} y1={BODY_DRAW.soleY} x2={rackLeft + 8} y2={rackY} stroke={STEEL_DEEP} strokeWidth={2} strokeLinecap="round" />
          <line x1={rackLeft - 8} y1={rackY} x2={rackLeft + 12} y2={rackY} stroke={STEEL} strokeWidth={3} strokeLinecap="round" />
          {/* Скамья */}
          <rect x={left} y={benchY} width={right - left} height={9} rx={4} fill={MAT} stroke={STEEL_DARK} strokeWidth={1.4} />
          <rect x={left + 4} y={benchY + 2} width={right - left - 8} height={3} rx={1.5} fill={SHORTS_LIGHT} opacity={0.55} />
          <line x1={left + 12} y1={benchY + 9} x2={left + 4} y2={BODY_DRAW.soleY} stroke={STEEL_DARK} strokeWidth={3.5} strokeLinecap="round" />
          <line x1={right - 12} y1={benchY + 9} x2={right - 4} y2={BODY_DRAW.soleY} stroke={STEEL_DARK} strokeWidth={3.5} strokeLinecap="round" />
          <line x1={left + 8} y1={BODY_DRAW.soleY - 2} x2={left + 26} y2={BODY_DRAW.soleY - 2} stroke={STEEL_DEEP} strokeWidth={3} strokeLinecap="round" />
          <line x1={right - 26} y1={BODY_DRAW.soleY - 2} x2={right - 8} y2={BODY_DRAW.soleY - 2} stroke={STEEL_DEEP} strokeWidth={3} strokeLinecap="round" />
        </g>
      );
    }
    const width = station === 'pullup' ? 78 : 62;
    const barY = side.hand.y;
    return (
      <g>
        <line x1={side.hand.x - width} y1={barY} x2={side.hand.x + width} y2={barY} stroke={STEEL_DARK} strokeWidth={6} strokeLinecap="round" />
        <line x1={side.hand.x - width} y1={barY} x2={side.hand.x + width} y2={barY} stroke={STEEL} strokeWidth={2.6} strokeLinecap="round" />
        <line x1={side.hand.x - width} y1={barY} x2={side.hand.x - width} y2={BODY_DRAW.soleY} stroke={STEEL_DARK} strokeWidth={5} strokeLinecap="round" />
        <line x1={side.hand.x + width} y1={barY} x2={side.hand.x + width} y2={BODY_DRAW.soleY} stroke={STEEL_DARK} strokeWidth={5} strokeLinecap="round" />
        <line x1={side.hand.x - width - 10} y1={BODY_DRAW.soleY - 2} x2={side.hand.x - width + 10} y2={BODY_DRAW.soleY - 2} stroke={STEEL_DEEP} strokeWidth={4} strokeLinecap="round" />
        <line x1={side.hand.x + width - 10} y1={BODY_DRAW.soleY - 2} x2={side.hand.x + width + 10} y2={BODY_DRAW.soleY - 2} stroke={STEEL_DEEP} strokeWidth={4} strokeLinecap="round" />
        {station === 'dips' && (
          <line x1={side.hand.x - width} y1={barY + 9} x2={side.hand.x + width} y2={barY + 9} stroke={STEEL_DEEP} strokeWidth={3} strokeLinecap="round" opacity={0.7} />
        )}
      </g>
    );
  };

  const renderEquipment = () => {
    if (!equipment || equipment.kind === 'bodyweight') return null;
    if (view !== 'side') {
      const left = front.leftHand;
      const right = front.rightHand;
      if (equipment.kind === 'barbell') {
        return (
          <g>
            <line x1={left.x - 18} y1={left.y} x2={right.x + 18} y2={right.y} stroke={STEEL_DARK} strokeWidth={4} strokeLinecap="round" />
            <line x1={left.x - 18} y1={left.y} x2={right.x + 18} y2={right.y} stroke={STEEL} strokeWidth={2} strokeLinecap="round" />
          </g>
        );
      }
      return null;
    }
    if (equipment.kind === 'dumbbell') {
      const elbow = side.elbow;
      const hand = side.hand;
      const dir = unit(sub(hand, elbow));
      const n = perp(dir);
      const center = add(hand, mul(dir, widths.wrist * 0.2));
      const a = add(center, mul(n, -10));
      const b = add(center, mul(n, 10));
      return (
        <g>
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={STEEL_DARK} strokeWidth={5} strokeLinecap="round" />
          <rect x={a.x - 4} y={a.y - 7} width={8} height={14} rx={3} fill={STEEL_DEEP} stroke={STEEL_DARK} strokeWidth={1} />
          <rect x={b.x - 4} y={b.y - 7} width={8} height={14} rx={3} fill={STEEL_DEEP} stroke={STEEL_DARK} strokeWidth={1} />
        </g>
      );
    }
    const anchor = equipmentAnchor;
    const barY = equipment.anchor === 'shoulder' ? anchor.y - 2 : anchor.y;
    const farPlateX = anchor.x - plateRadius * 2.4;
    const barEndX = anchor.x + plateRadius * 0.9;
    /* Гриф показываем коротким отрезком: так снаряд читается даже в профиль. */
    return (
      <g>
        <line x1={farPlateX} y1={barY} x2={barEndX} y2={barY} stroke={STEEL_DARK} strokeWidth={4.5} strokeLinecap="round" />
        <line x1={farPlateX} y1={barY} x2={barEndX} y2={barY} stroke={STEEL} strokeWidth={1.8} strokeLinecap="round" />
        <circle cx={farPlateX} cy={barY} r={plateRadius * 0.82} fill={STEEL_DEEP} stroke={STEEL_DARK} strokeWidth={1.4} />
        <circle cx={farPlateX} cy={barY} r={plateRadius * 0.34} fill="#0f172a" stroke={STEEL} strokeWidth={0.8} />
        <rect x={barEndX - 2} y={barY - plateRadius * 0.28} width={4} height={plateRadius * 0.56} rx={1.5} fill={STEEL} opacity={0.8} />
        <circle
          cx={anchor.x + plateRadius * 0.18}
          cy={barY - plateRadius * 0.1}
          r={plateRadius * 0.94}
          fill={STEEL_DEEP}
          opacity={0.4}
        />
        <circle cx={anchor.x} cy={barY} r={plateRadius} fill={STEEL_DEEP} stroke={STEEL_DARK} strokeWidth={1.5} />
        <circle
          cx={anchor.x}
          cy={barY}
          r={plateRadius * 0.66}
          fill="#26313c"
          stroke={STEEL}
          strokeWidth={1}
          opacity={0.9}
        />
        <circle cx={anchor.x} cy={barY} r={plateRadius * 0.24} fill="#0f172a" stroke={STEEL} strokeWidth={0.9} />
        <path
          d={`M ${anchor.x - plateRadius * 0.5} ${barY - plateRadius * 0.34} Q ${anchor.x - plateRadius * 0.2} ${barY - plateRadius * 0.55} ${anchor.x + plateRadius * 0.22} ${barY - plateRadius * 0.48}`}
          fill="none"
          stroke={STEEL}
          strokeWidth={1.1}
          opacity={0.5}
          strokeLinecap="round"
        />
      </g>
    );
  };

  /* ------------------------------------------------------------------ */
  /* Сборка                                                              */
  /* ------------------------------------------------------------------ */

  const drawSideBody = () => (
    <g>
      {drawSideLeg(side.hip, side.farKnee, side.farAnkle, side.farToe, side.farHeel, farSkin, COLOR_OUTLINE, 0.15, true)}
      {drawSideFarShorts()}
      {drawSideLeg(side.hip, side.knee, side.ankle, side.toe, side.heel, skinFill, COLOR_OUTLINE, 0.38)}
      {drawSideTorso()}
      {drawSideShorts()}
      {renderEquipment()}
      {drawSideArm(side.shoulder, side.elbow, side.hand, armFill)}
      {drawSideHand(side.hand, side.elbow, armFill)}
      {drawSegment(
        side.shoulder,
        pointAlongSideHeadBase(),
        dimensions.neckWidthCm * s,
        dimensions.neckWidthCm * s * 0.92,
        0,
        surface,
      )}
      {drawSideHead()}
    </g>
  );

  const pointAlongSideHeadBase = () => {
    const dir = unit(sub(side.head, side.shoulder));
    return add(side.shoulder, mul(dir, Math.max(4, distance(side.shoulder, side.head) - side.headRadius * 0.7)));
  };

  const drawFrontLeg = (hip: Point, knee: Point, ankle: Point, sideSign: number) => {
    const thighDir = unit(sub(knee, hip));
    const shinDir = unit(sub(ankle, knee));
    const thighLength = distance(hip, knee);
    const shinLength = distance(knee, ankle);
    const thighAngle = (Math.atan2(thighDir.y, thighDir.x) * 180) / Math.PI;
    const shinAngle = (Math.atan2(shinDir.y, shinDir.x) * 180) / Math.PI;
    const quadCenter = mix(hip, knee, 0.46);
    const vastusCenter = add(mix(hip, knee, 0.4), mul(perp(thighDir), sideSign * widths.thigh * 0.14));
    const calfCenter = mix(knee, ankle, 0.42);
    const calfOuter = add(calfCenter, { x: sideSign * widths.calf * 0.18, y: 0 });
    const calfInner = add(calfCenter, { x: -sideSign * widths.calf * 0.16, y: 0 });
    return (
      <g>
        {drawSegment(hip, knee, widths.thigh, widths.thigh * 0.66, widths.thigh * 0.1, skinFill)}
        {drawSegment(knee, ankle, widths.calf * 0.9, widths.ankle, widths.calf * 0.12, skinFill)}
        <ellipse
          cx={quadCenter.x}
          cy={quadCenter.y}
          rx={widths.thigh * 0.38}
          ry={thighLength * 0.32}
          transform={`rotate(${thighAngle} ${quadCenter.x} ${quadCenter.y})`}
          fill={MUSCLE}
          opacity={0.38}
          stroke={MUSCLE_DARK}
          strokeWidth={0.8}
        />
        <ellipse
          cx={vastusCenter.x}
          cy={vastusCenter.y}
          rx={widths.thigh * 0.2}
          ry={thighLength * 0.24}
          transform={`rotate(${thighAngle} ${vastusCenter.x} ${vastusCenter.y})`}
          fill={MUSCLE}
          opacity={0.3}
          stroke={MUSCLE_DARK}
          strokeWidth={0.6}
        />
        <ellipse
          cx={knee.x}
          cy={knee.y}
          rx={widths.thigh * 0.18}
          ry={widths.thigh * 0.13}
          fill={SKIN_LIGHT}
          opacity={0.3}
        />
        <ellipse
          cx={calfOuter.x}
          cy={calfOuter.y}
          rx={widths.calf * 0.2}
          ry={shinLength * 0.22}
          transform={`rotate(${shinAngle} ${calfOuter.x} ${calfOuter.y})`}
          fill={MUSCLE}
          opacity={0.26}
          stroke={MUSCLE_DARK}
          strokeWidth={0.5}
        />
        <ellipse
          cx={calfInner.x}
          cy={calfInner.y}
          rx={widths.calf * 0.15}
          ry={shinLength * 0.18}
          transform={`rotate(${shinAngle} ${calfInner.x} ${calfInner.y})`}
          fill={MUSCLE}
          opacity={0.2}
          stroke={MUSCLE_DARK}
          strokeWidth={0.4}
        />
        <path
          d={`M ${fmt(add(knee, { x: sideSign * widths.calf * 0.02, y: 0 }))} L ${fmt(add(ankle, { x: sideSign * widths.ankle * 0.02, y: 0 }))}`}
          stroke={SKIN_LIGHT}
          strokeWidth={1.4}
          opacity={0.4}
          strokeLinecap="round"
        />
        {jointBlend(knee, widths.thigh * 0.7, skinFill)}
        {jointBlend(ankle, widths.ankle, skinFill)}
        {drawFrontFoot(ankle, sideSign)}
      </g>
    );
  };

  const drawFrontArm = (shoulder: Point, elbow: Point, hand: Point, sideSign: number) => {
    const upperDir = unit(sub(elbow, shoulder));
    const foreDir = unit(sub(hand, elbow));
    const upperLength = distance(shoulder, elbow);
    const foreLength = distance(elbow, hand);
    const upperAngle = (Math.atan2(upperDir.y, upperDir.x) * 180) / Math.PI;
    const foreAngle = (Math.atan2(foreDir.y, foreDir.x) * 180) / Math.PI;
    const deltoid = add(shoulder, mul(upperDir, upperLength * 0.12));
    const biceps = mix(shoulder, elbow, 0.46);
    const forearmBelly = mix(elbow, hand, 0.4);
    return (
      <g>
        {drawSegment(shoulder, elbow, widths.upperArm, widths.upperArm * 0.68, widths.upperArm * 0.1, armFill)}
        {drawSegment(elbow, hand, widths.forearm, widths.wrist, widths.forearm * 0.1, armFill)}
        <ellipse
          cx={deltoid.x}
          cy={deltoid.y}
          rx={widths.upperArm * 0.44}
          ry={widths.upperArm * 0.35}
          transform={`rotate(${upperAngle} ${deltoid.x} ${deltoid.y})`}
          fill={MUSCLE}
          opacity={0.4}
          stroke={MUSCLE_DARK}
          strokeWidth={0.7}
        />
        <ellipse
          cx={biceps.x}
          cy={biceps.y}
          rx={widths.upperArm * 0.24}
          ry={upperLength * 0.26}
          transform={`rotate(${upperAngle} ${biceps.x} ${biceps.y})`}
          fill={MUSCLE}
          opacity={0.36}
          stroke={MUSCLE_DARK}
          strokeWidth={0.6}
        />
        <ellipse
          cx={forearmBelly.x}
          cy={forearmBelly.y}
          rx={widths.forearm * 0.26}
          ry={foreLength * 0.26}
          transform={`rotate(${foreAngle} ${forearmBelly.x} ${forearmBelly.y})`}
          fill={MUSCLE}
          opacity={0.32}
          stroke={MUSCLE_DARK}
          strokeWidth={0.5}
        />
        {jointBlend(elbow, widths.forearm, armFill)}
      </g>
    );
  };

  const drawFrontBody = () => {
    const leftEnd = front.leftHand;
    const rightEnd = front.rightHand;
    return (
      <g>
        {drawFrontLeg(front.leftHip, front.leftKnee, front.leftAnkle, -1)}
        {drawFrontLeg(front.rightHip, front.rightKnee, front.rightAnkle, 1)}
        {drawFrontTorso()}
        {drawFrontShorts()}
        {drawFrontArm(front.leftShoulder, front.leftElbow, leftEnd, -1)}
        {drawFrontArm(front.rightShoulder, front.rightElbow, rightEnd, 1)}
        {drawFrontHand(leftEnd, front.leftElbow, armFill)}
        {drawFrontHand(rightEnd, front.rightElbow, armFill)}
        {drawSegment(
          front.shoulderCenter,
          pointAlongFrontHeadBase(),
          dimensions.neckWidthCm * s,
          dimensions.neckWidthCm * s * 0.92,
          0,
          surface,
        )}
        {drawFrontHead()}
      </g>
    );
  };

  const pointAlongFrontHeadBase = () => {
    const dir = unit(sub(front.head, front.shoulderCenter));
    return add(front.shoulderCenter, mul(dir, Math.max(4, distance(front.shoulderCenter, front.head) - front.headRadius * 0.7)));
  };

  const drawFrontFoot = (ankle: Point, sideSign: number) => {
    const footW = Math.max(8, widths.ankle * 1.25);
    const footH = Math.max(7, dimensions.footLengthCm * s * 0.22);
    const cx = ankle.x + sideSign * footW * 0.12;
    const cy = BODY_DRAW.soleY - footH * 0.68;
    return (
      <g data-foot="front">
        <path
          d={`M ${cx - footW / 2} ${cy - footH * 0.1}
              Q ${cx - footW * 0.52} ${cy - footH * 0.72} ${cx} ${cy - footH * 0.78}
              Q ${cx + footW * 0.52} ${cy - footH * 0.72} ${cx + footW / 2} ${cy - footH * 0.1}
              Q ${cx + footW * 0.48} ${cy + footH * 0.62} ${cx} ${cy + footH * 0.68}
              Q ${cx - footW * 0.48} ${cy + footH * 0.62} ${cx - footW / 2} ${cy - footH * 0.1} Z`}
          fill={SHOE}
          stroke={COLOR_OUTLINE}
          strokeWidth={1.5}
        />
        <path
          d={`M ${cx - footW * 0.46} ${cy + footH * 0.42}
              Q ${cx} ${cy + footH * 0.56} ${cx + footW * 0.46} ${cy + footH * 0.42}
              L ${cx + footW * 0.43} ${cy + footH * 0.64}
              Q ${cx} ${cy + footH * 0.74} ${cx - footW * 0.43} ${cy + footH * 0.64} Z`}
          fill={SOLE}
          stroke={COLOR_OUTLINE}
          strokeWidth={1}
        />
        <path
          d={`M ${cx - footW * 0.3} ${cy - footH * 0.58}
              Q ${cx} ${cy - footH * 0.76} ${cx + footW * 0.3} ${cy - footH * 0.58}
              L ${cx + footW * 0.22} ${cy - footH * 0.36}
              Q ${cx} ${cy - footH * 0.46} ${cx - footW * 0.22} ${cy - footH * 0.36} Z`}
          fill={SHOE_LIGHT}
          opacity={0.8}
        />
        {[0.18, 0.02, -0.14].map((offset, index) => (
          <path
            key={`front-lace-${index}`}
            d={`M ${cx - footW * 0.2} ${cy + footH * offset} Q ${cx} ${cy + footH * (offset + 0.04)} ${cx + footW * 0.2} ${cy + footH * offset}`}
            fill="none"
            stroke={SOLE}
            strokeWidth={1}
            strokeLinecap="round"
            opacity={0.7}
          />
        ))}
      </g>
    );
  };

  const drawFrontHand = (hand: Point, elbow: Point, fill: string) => {
    const dir = unit(sub(hand, elbow));
    const angle = (Math.atan2(dir.y, dir.x) * 180) / Math.PI;
    const w = Math.max(6, widths.wrist * 1.25);
    const center = add(hand, mul(dir, w * 0.42));
    return (
      <g transform={`rotate(${angle} ${center.x} ${center.y})`}>
        <rect
          x={center.x - w * 0.6}
          y={center.y - w * 0.7}
          width={w * 1.2}
          height={w * 1.76}
          rx={w * 0.42}
          fill={fill}
          stroke={COLOR_OUTLINE}
          strokeWidth={1.3}
        />
        {[0.34, 0.12, -0.1, -0.3].map((offset, index) => (
          <path
            key={`front-finger-${index}`}
            d={`M ${center.x + w * 0.12} ${center.y + w * offset} Q ${center.x + w * 0.44} ${center.y + w * (offset + 0.02)} ${center.x + w * 0.58} ${center.y + w * (offset - 0.03)}`}
            fill="none"
            stroke={SKIN_LINE}
            strokeWidth={0.85}
            opacity={0.45}
            strokeLinecap="round"
          />
        ))}
        <path
          d={`M ${center.x - w * 0.2} ${center.y - w * 0.58} Q ${center.x - w * 0.5} ${center.y - w * 0.42} ${center.x - w * 0.52} ${center.y - w * 0.12}`}
          fill="none"
          stroke={COLOR_OUTLINE}
          strokeWidth={1.1}
          strokeLinecap="round"
        />
      </g>
    );
  };

  return (
    <svg
      viewBox={`0 0 ${BODY_DRAW.width} ${BODY_DRAW.height}`}
      className="w-full max-w-[340px] select-none"
      role="img"
      data-sex={dimensions.sex}
      data-view={view}
      aria-label={`2D-модель тела, вид ${view === 'side' ? 'сбоку' : 'спереди'}.`}
    >
      <defs>
        <linearGradient id={surfaceId} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#f9e2ca" />
          <stop offset="40%" stopColor="#e5b795" />
          <stop offset="100%" stopColor="#c48c6b" />
        </linearGradient>
        <linearGradient id={skinId} x1="0.05" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#f5d6bb" />
          <stop offset="48%" stopColor="#dfae8b" />
          <stop offset="100%" stopColor="#c08665" />
        </linearGradient>
        <linearGradient id={farSkinId} x1="0.05" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#c58f70" />
          <stop offset="55%" stopColor="#a66f55" />
          <stop offset="100%" stopColor="#84523e" />
        </linearGradient>
        <linearGradient id={armId} x1="0" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="#f9e0c8" />
          <stop offset="50%" stopColor="#e5b795" />
          <stop offset="100%" stopColor="#c78d6e" />
        </linearGradient>
        <linearGradient id={hairId} x1="0" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="#4a352b" />
          <stop offset="55%" stopColor="#2b1e18" />
          <stop offset="100%" stopColor="#17100d" />
        </linearGradient>
        <linearGradient id={shortsId} x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#486a74" />
          <stop offset="55%" stopColor="#2f4a53" />
          <stop offset="100%" stopColor="#1e323a" />
        </linearGradient>
      </defs>

      {/* Анатомический атлас: светлая подложка вместо тёмной схемы */}
      <rect x={0} y={0} width={BODY_DRAW.width} height={BODY_DRAW.height} rx={18} fill="#f2ecdf" />
      {(showGrid ?? true) && (
        <g opacity={0.5}>
          {Array.from({ length: 13 }, (_, index) => 20 + index * 24).map((x) => (
            <line key={`gx-${x}`} x1={x} y1={10} x2={x} y2={BODY_DRAW.height - 10} stroke="#dcd3c3" strokeWidth={0.7} />
          ))}
          {Array.from({ length: 20 }, (_, index) => 20 + index * 24).map((y) => (
            <line key={`gy-${y}`} x1={10} y1={y} x2={BODY_DRAW.width - 10} y2={y} stroke="#dcd3c3" strokeWidth={0.7} />
          ))}
        </g>
      )}

      <ellipse cx={BODY_DRAW.width / 2} cy={BODY_DRAW.soleY + 3} rx={80} ry={9} fill="#c8bca9" opacity={0.5} />
      <line x1={18} y1={BODY_DRAW.soleY} x2={BODY_DRAW.width - 18} y2={BODY_DRAW.soleY} stroke="#9a8f7f" strokeWidth={1.1} />
      <text x={18} y={BODY_DRAW.soleY + 14} fill="#8b8070" fontSize={8} fontWeight={600}>
        пол
      </text>

      <g transform={`translate(${fit.tx.toFixed(2)} ${fit.ty.toFixed(2)}) scale(${fit.scale.toFixed(4)})`}>
        {renderStation()}
        {view === 'side' ? drawSideBody() : drawFrontBody()}
        {drawHeat()}
      </g>

      <g opacity={0.8}>
        <text x={14} y={20} fill="#7d7364" fontSize={9} fontWeight={700} letterSpacing="0.12em">
          {view === 'side' ? 'ВИД СБОКУ' : 'ВИД СПЕРЕДИ'}
        </text>
        <text x={14} y={33} fill="#9a8f7f" fontSize={8}>
          {view === 'side' ? 'пропорции по замерам · поза из техники' : 'объёмы и пропорции по замерам'}
        </text>
      </g>
    </svg>
  );
};
