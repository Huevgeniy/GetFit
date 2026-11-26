import React, { useEffect, useRef, useState } from 'react';
import { Camera, Save, X, ZoomIn } from 'lucide-react';

interface BodyAvatarModalProps {
  src: string;
  onSave: (dataUrl: string) => void;
  onClose: () => void;
}

const SIZE = 256;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

interface Transform {
  zoom: number;
  x: number;
  y: number;
}

const INITIAL_TRANSFORM: Transform = { zoom: 1, x: 0, y: 0 };

export const BodyAvatarModal: React.FC<BodyAvatarModalProps> = ({ src, onSave, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [transform, setTransform] = useState<Transform>(INITIAL_TRANSFORM);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) {
        setImage(img);
        setTransform(INITIAL_TRANSFORM);
        setError(null);
      }
    };
    img.onerror = () => {
      if (!cancelled) setError('Не удалось открыть изображение. Попробуйте другой файл.');
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  const clampOffset = (
    value: { x: number; y: number },
    zoom: number,
    img: HTMLImageElement,
  ): { x: number; y: number } => {
    const baseScale = Math.max(SIZE / img.width, SIZE / img.height) * zoom;
    const drawWidth = img.width * baseScale;
    const drawHeight = img.height * baseScale;
    return {
      x: clamp(value.x, SIZE - drawWidth, 0),
      y: clamp(value.y, SIZE - drawHeight, 0),
    };
  };

  useEffect(() => {
    if (!image) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const baseScale = Math.max(SIZE / image.width, SIZE / image.height) * transform.zoom;
    const drawWidth = image.width * baseScale;
    const drawHeight = image.height * baseScale;
    const offset = clampOffset({ x: transform.x, y: transform.y }, transform.zoom, image);

    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = '#081016';
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.drawImage(image, offset.x, offset.y, drawWidth, drawHeight);

    // Мягкая круглая маска: видно, как фото попадёт в голову модели.
    ctx.save();
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }, [image, transform]);

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current || !image) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    // Переводим пиксели экрана в пиксели canvas: на телефоне canvas
    // отображается меньше 256 px, поэтому без коэффициента фото «убегает».
    const ratio = SIZE / rect.width;
    const dx = (event.clientX - dragRef.current.x) * ratio;
    const dy = (event.clientY - dragRef.current.y) * ratio;
    dragRef.current = { x: event.clientX, y: event.clientY };
    setTransform((prev) => {
      const next = clampOffset({ x: prev.x + dx, y: prev.y + dy }, prev.zoom, image);
      return { ...prev, x: next.x, y: next.y };
    });
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
  };

  const handleZoomChange = (value: number) => {
    if (!image) return;
    setTransform((prev) => {
      const zoom = clamp(value, 1, 3);
      if (zoom === prev.zoom) return prev;
      // Масштаб вокруг центра: лицо в центре кадра не уезжает при зуме.
      const ratio = zoom / prev.zoom;
      const next = clampOffset(
        {
          x: SIZE / 2 - (SIZE / 2 - prev.x) * ratio,
          y: SIZE / 2 - (SIZE / 2 - prev.y) * ratio,
        },
        zoom,
        image,
      );
      return { zoom, x: next.x, y: next.y };
    });
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas || !image) {
      setError('Фото ещё не готово.');
      return;
    }
    try {
      onSave(canvas.toDataURL('image/jpeg', 0.82));
    } catch {
      setError('Не удалось сохранить фото. Попробуйте файл меньшего размера.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-black/85 p-3 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Кадрирование фото"
    >
      <div className="w-full max-w-sm rounded-2xl border border-[#263a4a] bg-[#0d151c] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#1d2c38] px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-500/40 bg-cyan-500/10 text-cyan-300">
              <Camera className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-100">Фото для модели</div>
              <div className="text-[10px] text-slate-500">Круглая маска, 256 × 256</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#18232f] text-slate-400 hover:text-white"
            aria-label="Закрыть кадрирование"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-4 py-4">
          <div className="mx-auto w-[256px] max-w-full overflow-hidden rounded-full border-4 border-[#223442] bg-[#081016] shadow-inner">
            <canvas
              ref={canvasRef}
              width={SIZE}
              height={SIZE}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="block h-auto w-full cursor-grab touch-none active:cursor-grabbing"
            />
          </div>

          <label className="block">
            <span className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <ZoomIn className="h-3 w-3" />
              Масштаб
            </span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.02}
              value={transform.zoom}
              onChange={(event) => handleZoomChange(Number(event.target.value))}
              className="w-full accent-emerald-500"
            />
          </label>

          <p className="text-[10px] leading-relaxed text-slate-500">
            Перетащите фото, чтобы совместить лицо с центром. Фото сжимается и хранится
            в вашем профиле — его не нужно загружать заново на каждом устройстве.
          </p>

          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
              {error}
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t border-[#1d2c38] px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-[#263a4a] bg-[#121c25] py-2.5 text-xs font-semibold text-slate-300"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!image}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-2.5 text-xs font-bold text-slate-950 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
};
