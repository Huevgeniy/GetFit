import React, { useId, useMemo, useRef, useState } from 'react';
import {
  BODY_DRAW,
  BodyDimensions,
  BodyPose,
  BodyView,
  DrawHandle,
  ExerciseEvaluation,
  Point,
  buildFrontGeometry,
  buildSideGeometry,
  clampSegmentAngle,
  direction,
  jointRisk,
  pointAlong,
  updateFrontPose,
  updateSidePose,
} from '../lib/bodyModel';

interface BodyModel2DProps {
  view: BodyView;
  pose: BodyPose;
  dimensions: BodyDimensions;
  avatarUrl?: string;
  showAngles?: boolean;
  evaluation?: ExerciseEvaluation | null;
  onChangePose: (pose: BodyPose) => void;
}

interface DragState {
  view: BodyView;
  handle: DrawHandle;
  pointerId: number;
}

const COLOR_SAFE = '#34d399';
const COLOR_NEAR = '#fbbf24';
const COLOR_FAIL = '#fb7185';

const lerp = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

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

export const BodyModel2D: React.FC<BodyModel2DProps> = ({
  view,
  pose,
  dimensions,
  avatarUrl,
  showAngles = true,
  evaluation,
  onChangePose,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const rawClipId = useId();
  const clipId = `body-avatar-${rawClipId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

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
    setDrag({ view, handle, pointerId: event.pointerId });
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
    const angle = Math.atan2(point.y - drag.handle.pivot.y, point.x - drag.handle.pivot.x) * (180 / Math.PI);
    const clamped = clampSegmentAngle(drag.view, drag.handle.segment, angle, pose);
    if (drag.view === 'side') {
      onChangePose({
        ...pose,
        side: updateSidePose(pose.side, drag.handle.segment as keyof typeof pose.side, clamped),
      });
    } else {
      onChangePose({
        ...pose,
        front: updateFrontPose(pose.front, drag.handle.segment as keyof typeof pose.front, clamped),
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

  const limb = (a: Point, b: Point, width: number, color = '#2d4659') => (
    <g key={`${a.x}-${a.y}-${b.x}-${b.y}-${width}`}>
      <line
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke="#0a1117"
        strokeWidth={width + 5}
        strokeLinecap="round"
      />
      <line
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
      />
      <line
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke="#4d6b80"
        strokeWidth={Math.max(2, width * 0.18)}
        strokeLinecap="round"
        opacity={0.55}
      />
    </g>
  );

  const joint = (point: Point, color: string, radius = 6) => (
    <g>
      <circle cx={point.x} cy={point.y} r={radius + 6} fill={color} opacity={0.12} />
      <circle cx={point.x} cy={point.y} r={radius} fill="#071017" stroke={color} strokeWidth={2} />
      <circle cx={point.x} cy={point.y} r={2.2} fill={color} />
    </g>
  );

  const head = (center: Point, radius: number) => (
    <g>
      <circle cx={center.x} cy={center.y} r={radius + 3} fill="#0a1117" />
      {avatarUrl ? (
        <>
          <clipPath id={clipId}>
            <circle cx={center.x} cy={center.y} r={radius} />
          </clipPath>
          <image
            href={avatarUrl}
            x={center.x - radius}
            y={center.y - radius}
            width={radius * 2}
            height={radius * 2}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${clipId})`}
          />
        </>
      ) : (
        <g>
          <circle cx={center.x} cy={center.y} r={radius} fill="#263b4b" />
          <circle cx={center.x - radius * 0.3} cy={center.y - radius * 0.12} r={1.8} fill="#8aa4b5" />
          <circle cx={center.x + radius * 0.3} cy={center.y - radius * 0.12} r={1.8} fill="#8aa4b5" />
          <path
            d={`M ${center.x - radius * 0.24} ${center.y + radius * 0.3} Q ${center.x} ${center.y + radius * 0.45} ${center.x + radius * 0.24} ${center.y + radius * 0.3}`}
            fill="none"
            stroke="#8aa4b5"
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        </g>
      )}
      <circle cx={center.x} cy={center.y} r={radius} fill="none" stroke="#4d6b80" strokeWidth={1.5} />
    </g>
  );

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
      handle.segment.includes('knee') || handle.segment.includes('thigh') || handle.segment.includes('shin')
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
        <circle cx={handle.point.x} cy={handle.point.y} r={17} fill="transparent" />
        <circle
          cx={handle.point.x}
          cy={handle.point.y}
          r={active ? 10 : 8}
          fill="#071017"
          stroke={color}
          strokeWidth={2.4}
        />
        <circle cx={handle.point.x} cy={handle.point.y} r={3} fill={color} />
      </g>
    );
  });

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
        <linearGradient id="body-surface" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#324e61" />
          <stop offset="55%" stopColor="#233947" />
          <stop offset="100%" stopColor="#162530" />
        </linearGradient>
        <linearGradient id="body-limb" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#2f4a5d" />
          <stop offset="100%" stopColor="#1d303d" />
        </linearGradient>
        <radialGradient id="floor-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Сетка и рост */}
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

      <ellipse cx={160} cy={503} rx={86} ry={11} fill="url(#floor-glow)" />

      {view === 'side' ? (
        <g>
          {/* Руки и ноги рисуем под корпусом */}
          {limb(sideGeometry.shoulder, sideGeometry.elbow, 15)}
          {limb(sideGeometry.elbow, sideGeometry.hand, 12)}
          {limb(sideGeometry.hip, sideGeometry.knee, 23)}
          {limb(sideGeometry.knee, sideGeometry.ankle, 19)}
          {limb(sideGeometry.heel, sideGeometry.toe, 10, '#243846')}

          {/* Корпус */}
          {(() => {
            const torsoDx = sideGeometry.shoulder.x - sideGeometry.hip.x;
            const torsoDy = sideGeometry.shoulder.y - sideGeometry.hip.y;
            const length = Math.hypot(torsoDx, torsoDy) || 1;
            const perp = { x: -torsoDy / length, y: torsoDx / length };
            const hipDepth = (dimensions.waistDepthCm * dimensions.scale) / 2;
            const chestDepth = (dimensions.chestDepthCm * dimensions.scale) / 2;
            const a = {
              x: sideGeometry.hip.x + perp.x * hipDepth,
              y: sideGeometry.hip.y + perp.y * hipDepth,
            };
            const b = {
              x: sideGeometry.shoulder.x + perp.x * chestDepth,
              y: sideGeometry.shoulder.y + perp.y * chestDepth,
            };
            const c = {
              x: sideGeometry.shoulder.x - perp.x * chestDepth,
              y: sideGeometry.shoulder.y - perp.y * chestDepth,
            };
            const d = {
              x: sideGeometry.hip.x - perp.x * hipDepth,
              y: sideGeometry.hip.y - perp.y * hipDepth,
            };
            return (
              <g>
                <ellipse
                  cx={sideGeometry.hip.x}
                  cy={sideGeometry.hip.y}
                  rx={(dimensions.hipWidthCm * dimensions.scale) / 2.3}
                  ry={hipDepth * 1.1}
                  fill="#1b2c38"
                  stroke="#2f485a"
                  strokeWidth={1.4}
                />
                <path
                  d={`M ${a.x} ${a.y} L ${b.x} ${b.y} Q ${(b.x + c.x) / 2 + perp.x * 8} ${(b.y + c.y) / 2 + perp.y * 8} ${c.x} ${c.y} L ${d.x} ${d.y} Q ${(a.x + d.x) / 2 + perp.x * 4} ${(a.y + d.y) / 2 + perp.y * 4} ${a.x} ${a.y} Z`}
                  fill="url(#body-surface)"
                  stroke="#3a5669"
                  strokeWidth={1.4}
                />
                <line
                  x1={sideGeometry.shoulder.x}
                  y1={sideGeometry.shoulder.y}
                  x2={sideGeometry.head.x}
                  y2={sideGeometry.head.y}
                  stroke="#2f4a5d"
                  strokeWidth={12}
                  strokeLinecap="round"
                />
              </g>
            );
          })()}

          {head(sideGeometry.head, sideGeometry.headRadius)}
          {joint(sideGeometry.shoulder, colorFor('shoulder'))}
          {joint(sideGeometry.hip, colorFor('hip'))}
          {joint(sideGeometry.knee, colorFor('knee'))}
          {joint(sideGeometry.ankle, colorFor('ankle'), 5)}
          {joint(sideGeometry.elbow, colorFor('elbow'), 5)}
          {joint(sideGeometry.hand, '#38bdf8', 4)}
        </g>
      ) : (
        <g>
          {/* Ноги и руки */}
          {limb(frontGeometry.leftHip, frontGeometry.leftKnee, 22)}
          {limb(frontGeometry.rightHip, frontGeometry.rightKnee, 22)}
          {limb(frontGeometry.leftKnee, frontGeometry.leftAnkle, 18)}
          {limb(frontGeometry.rightKnee, frontGeometry.rightAnkle, 18)}
          {limb(frontGeometry.leftShoulder, frontGeometry.leftElbow, 14)}
          {limb(frontGeometry.rightShoulder, frontGeometry.rightElbow, 14)}
          {limb(frontGeometry.leftElbow, frontGeometry.leftHand, 11)}
          {limb(frontGeometry.rightElbow, frontGeometry.rightHand, 11)}
          <ellipse cx={frontGeometry.leftAnkle.x - 6} cy={frontGeometry.leftAnkle.y + 7} rx={11} ry={5} fill="#243846" />
          <ellipse cx={frontGeometry.rightAnkle.x + 6} cy={frontGeometry.rightAnkle.y + 7} rx={11} ry={5} fill="#243846" />

          {/* Корпус */}
          {(() => {
            const waistCenter = lerp(frontGeometry.hipCenter, frontGeometry.shoulderCenter, 0.45);
            const waistHalf = (dimensions.waistWidthCm * dimensions.scale) / 2;
            const leftWaist = { x: waistCenter.x - waistHalf, y: waistCenter.y };
            const rightWaist = { x: waistCenter.x + waistHalf, y: waistCenter.y };
            return (
              <path
                d={`M ${frontGeometry.leftShoulder.x} ${frontGeometry.leftShoulder.y}
                    L ${frontGeometry.rightShoulder.x} ${frontGeometry.rightShoulder.y}
                    Q ${rightWaist.x + 12} ${rightWaist.y} ${frontGeometry.rightHip.x} ${frontGeometry.rightHip.y}
                    L ${frontGeometry.leftHip.x} ${frontGeometry.leftHip.y}
                    Q ${leftWaist.x - 12} ${leftWaist.y} ${frontGeometry.leftShoulder.x} ${frontGeometry.leftShoulder.y} Z`}
                fill="url(#body-surface)"
                stroke="#3a5669"
                strokeWidth={1.4}
              />
            );
          })()}
          <line
            x1={frontGeometry.shoulderCenter.x}
            y1={frontGeometry.shoulderCenter.y}
            x2={frontGeometry.head.x}
            y2={frontGeometry.head.y}
            stroke="#2f4a5d"
            strokeWidth={13}
            strokeLinecap="round"
          />
          {head(frontGeometry.head, frontGeometry.headRadius)}
          {joint(frontGeometry.leftShoulder, colorFor('shoulder'), 5)}
          {joint(frontGeometry.rightShoulder, colorFor('shoulder'), 5)}
          {joint(frontGeometry.leftElbow, colorFor('elbow'))}
          {joint(frontGeometry.rightElbow, colorFor('elbow'))}
          {joint(frontGeometry.leftKnee, colorFor('knee'))}
          {joint(frontGeometry.rightKnee, colorFor('knee'))}
          {joint(frontGeometry.leftAnkle, colorFor('ankle'), 5)}
          {joint(frontGeometry.rightAnkle, colorFor('ankle'), 5)}
        </g>
      )}

      {arcLabels}
      {handles}

      <g opacity={0.75}>
        <text x={14} y={22} fill="#5f7889" fontSize={9} fontWeight={700} letterSpacing="0.12em">
          {view === 'side' ? 'ВИД СБОКУ' : 'ВИД СПЕРЕДИ'}
        </text>
        <text x={14} y={36} fill="#3f596b" fontSize={8}>
          тяните круглые маркеры
        </text>
      </g>
    </svg>
  );
};
