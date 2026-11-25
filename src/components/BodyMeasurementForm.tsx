import React, { useMemo, useState } from 'react';
import { CalendarDays, Info, Ruler, Save, X } from 'lucide-react';
import type { BodyMeasurementEntry } from '../types';
import {
  BODY_METRIC_FIELDS,
  BODY_METRIC_GROUPS,
  BodyMetricKey,
  todayKey,
} from '../lib/bodyModel';

interface BodyMeasurementFormProps {
  initial: BodyMeasurementEntry | null;
  heightCm?: number;
  onSave: (entry: BodyMeasurementEntry) => void;
  onClose: () => void;
}

type ValueState = Partial<Record<BodyMetricKey, string>>;

const parseNumber = (raw: string): number | undefined => {
  const normalized = raw.trim().replace(',', '.');
  if (!normalized) return undefined;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : undefined;
};

export const BodyMeasurementForm: React.FC<BodyMeasurementFormProps> = ({
  initial,
  heightCm,
  onSave,
  onClose,
}) => {
  const [date, setDate] = useState(initial?.date || todayKey());
  const [weight, setWeight] = useState(initial?.weightKg !== undefined ? String(initial.weightKg) : '');
  const [notes, setNotes] = useState(initial?.notes || '');
  const [values, setValues] = useState<ValueState>(() => {
    const next: ValueState = {};
    if (initial) {
      for (const field of BODY_METRIC_FIELDS) {
        const value = initial[field.key];
        if (typeof value === 'number') next[field.key] = String(value);
      }
    }
    return next;
  });
  const [error, setError] = useState<string | null>(null);

  const filledFields = useMemo(
    () => BODY_METRIC_FIELDS.filter((field) => (values[field.key] || '').trim() !== ''),
    [values],
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('Укажите дату замера.');
      return;
    }

    const weightValue = parseNumber(weight);
    if (weight && (weightValue === undefined || weightValue < 30 || weightValue > 350)) {
      setError('Вес должен быть от 30 до 350 кг.');
      return;
    }

    const next: BodyMeasurementEntry = {
      id: initial?.id || `bm_${Date.now()}`,
      date,
      createdAt: initial?.createdAt || new Date().toISOString(),
    };
    if (weightValue !== undefined) next.weightKg = Math.round(weightValue * 10) / 10;

    for (const field of BODY_METRIC_FIELDS) {
      const raw = (values[field.key] || '').trim();
      if (!raw) continue;
      const value = parseNumber(raw);
      if (value === undefined || value < field.min || value > field.max) {
        setError(`${field.label}: значение должно быть от ${field.min} до ${field.max} см.`);
        return;
      }
      next[field.key] = Math.round(value * 10) / 10;
    }

    if (next.weightKg === undefined && filledFields.length === 0) {
      setError('Добавьте вес или хотя бы один обхват.');
      return;
    }

    const trimmedNotes = notes.trim();
    if (trimmedNotes) next.notes = trimmedNotes.slice(0, 500);
    onSave(next);
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/80 p-3 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Новый замер тела"
      onClick={onClose}
    >
      <form
        id="body-measurement-form"
        onSubmit={handleSubmit}
        onClick={(event) => event.stopPropagation()}
        className="my-3 w-full max-w-lg rounded-2xl border border-[#263a4a] bg-[#0d151c] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[#1d2c38] px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-400">
              <Ruler className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-100">
                {initial ? 'Изменить замер' : 'Новый замер'}
              </div>
              <div className="text-[10px] text-slate-500">Сантиметровая лента, утром, без напряжения</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#18232f] text-slate-400 hover:text-white"
            aria-label="Закрыть форму замера"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <CalendarDays className="h-3 w-3" />
                Дата
              </span>
              <input
                id="body-measurement-date"
                type="date"
                value={date}
                max={todayKey()}
                onChange={(event) => setDate(event.target.value)}
                className="w-full rounded-xl border border-[#263a4a] bg-[#081016] px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-emerald-500/60"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Вес, кг
              </span>
              <input
                id="body-measurement-weight"
                type="text"
                inputMode="decimal"
                value={weight}
                onChange={(event) => setWeight(event.target.value)}
                placeholder="80,5"
                className="w-full rounded-xl border border-emerald-500/30 bg-[#081016] px-3 py-2 text-sm font-semibold text-emerald-300 outline-none transition-colors focus:border-emerald-500/70"
              />
            </label>
          </div>

          {heightCm ? (
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <Info className="h-3 w-3 text-cyan-400" />
              Рост для модели: {heightCm} см. Меняется во вкладке «Модель».
            </div>
          ) : (
            <div className="flex items-center gap-1.5 rounded-xl border border-amber-500/25 bg-amber-500/5 px-2.5 py-2 text-[10px] text-amber-300">
              <Info className="h-3 w-3" />
              Укажите рост во вкладке «Модель», чтобы пропорции были точнее.
            </div>
          )}

          {BODY_METRIC_GROUPS.map((group) => {
            const fields = BODY_METRIC_FIELDS.filter((field) => field.group === group.id);
            return (
              <div key={group.id} className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {group.label}
                  </span>
                  <span className="text-[9px] text-slate-600">{group.hint}</span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {fields.map((field) => (
                    <label key={field.key} className="block">
                      <span className="mb-1 block text-[10px] text-slate-400">{field.label}</span>
                      <div className="relative">
                        <input
                          id={`body-measurement-${field.key}`}
                          type="text"
                          inputMode="decimal"
                          value={values[field.key] || ''}
                          onChange={(event) =>
                            setValues((prev) => ({ ...prev, [field.key]: event.target.value }))
                          }
                          placeholder={field.placeholder}
                          className="w-full rounded-xl border border-[#223442] bg-[#081016] px-3 py-2 pr-8 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-700 focus:border-cyan-500/50"
                        />
                        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-600">
                          см
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}

          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Заметка
            </span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Условия замера, самочувствие, что изменилось"
              className="w-full resize-none rounded-xl border border-[#223442] bg-[#081016] px-3 py-2 text-xs text-slate-200 outline-none focus:border-cyan-500/50"
            />
          </label>

          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] font-medium text-rose-300">
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
            id="body-measurement-save"
            type="submit"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-2.5 text-xs font-bold text-slate-950 shadow-lg shadow-emerald-500/20"
          >
            <Save className="h-3.5 w-3.5" />
            Сохранить замер
          </button>
        </div>
      </form>
    </div>
  );
};
