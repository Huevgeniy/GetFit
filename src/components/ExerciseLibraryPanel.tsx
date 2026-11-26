import React, { useMemo, useState } from 'react';
import {
  ChevronRight,
  Dumbbell,
  Filter,
  Search,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  DIFFICULTY_LABELS,
  EQUIPMENT_LABELS,
  ExerciseCategory,
  EquipmentKind,
  EXERCISE_CATALOG,
  MUSCLES,
  TechniqueExercise,
  searchTechniqueExercises,
} from '../lib/exerciseTechnique';

interface ExerciseLibraryPanelProps {
  onSelect: (id: string) => void;
}

const EQUIPMENT_ORDER: EquipmentKind[] = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'];

const ExerciseCard: React.FC<{ exercise: TechniqueExercise; onSelect: (id: string) => void }> = ({
  exercise,
  onSelect,
}) => (
  <button
    id={`body-library-${exercise.id}`}
    type="button"
    onClick={() => onSelect(exercise.id)}
    className="group flex h-full flex-col rounded-2xl border border-[#223442] bg-[#0b131a] p-3 text-left transition-colors hover:border-amber-500/40 hover:bg-[#0f1a22]"
  >
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="truncate text-[11px] font-black text-slate-100">{exercise.name}</div>
        <div className="mt-0.5 text-[8px] text-slate-500">{CATEGORY_LABELS[exercise.category]}</div>
      </div>
      <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-600 transition-colors group-hover:text-amber-300" />
    </div>
    <p className="mt-1.5 line-clamp-2 text-[8px] leading-snug text-slate-500">{exercise.summary}</p>
    <div className="mt-2 flex flex-wrap gap-1">
      {exercise.primary.slice(0, 3).map((id) => (
        <span key={id} className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[7px] font-semibold text-rose-300">
          {MUSCLES[id].label}
        </span>
      ))}
    </div>
    <div className="mt-auto flex items-center justify-between gap-2 pt-2">
      <span className="text-[7px] font-semibold uppercase tracking-wider text-slate-600">
        {EQUIPMENT_LABELS[exercise.equipment]}
      </span>
      <span className="text-[7px] text-slate-600">{DIFFICULTY_LABELS[exercise.difficulty]}</span>
    </div>
  </button>
);

export const ExerciseLibraryPanel: React.FC<ExerciseLibraryPanelProps> = ({ onSelect }) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ExerciseCategory | 'all'>('all');
  const [equipment, setEquipment] = useState<EquipmentKind | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);

  const results = useMemo(
    () => searchTechniqueExercises(query, category, equipment),
    [query, category, equipment],
  );

  const featured = useMemo(
    () =>
      ['squat', 'rdl', 'bench', 'overhead', 'row', 'pullup']
        .map((id) => EXERCISE_CATALOG.find((exercise) => exercise.id === id))
        .filter((exercise): exercise is TechniqueExercise => Boolean(exercise)),
    [],
  );

  const resetFilters = () => {
    setQuery('');
    setCategory('all');
    setEquipment('all');
  };

  const filtersActive = category !== 'all' || equipment !== 'all' || Boolean(query);

  return (
    <div id="tour-body-exercises" className="space-y-3">
      <div className="rounded-2xl border border-[#223442] bg-[#0d151c] p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Dumbbell className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-bold text-slate-200">Библиотека упражнений</span>
          </div>
          <span className="text-[9px] text-slate-600">{EXERCISE_CATALOG.length} упражнений</span>
        </div>

        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            id="body-exercise-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Найти упражнение: румынская, жим, тяга..."
            className="w-full rounded-xl border border-[#263a4a] bg-[#081016] py-2 pl-8 pr-8 text-[11px] font-semibold text-slate-200 outline-none placeholder:text-slate-600 focus:border-amber-500/50"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-500 hover:text-slate-300"
              aria-label="Очистить поиск"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="mt-1.5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setShowFilters((value) => !value)}
            className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[8px] font-bold ${
              showFilters || filtersActive
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                : 'border-[#263a4a] bg-[#091117] text-slate-400'
            }`}
          >
            <Filter className="h-2.5 w-2.5" />
            Фильтры
          </button>
          <span className="text-[8px] text-slate-600">найдено {results.length}</span>
          {filtersActive && (
            <button type="button" onClick={resetFilters} className="text-[8px] font-semibold text-slate-500 hover:text-slate-300">
              Сбросить
            </button>
          )}
        </div>

        {showFilters && (
          <div className="mt-2 space-y-1.5 rounded-xl border border-[#1f303d] bg-[#091117] p-2">
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setCategory('all')}
                className={`rounded-lg px-1.5 py-1 text-[8px] font-semibold ${
                  category === 'all' ? 'bg-amber-500/15 text-amber-300' : 'text-slate-500'
                }`}
              >
                Все паттерны
              </button>
              {CATEGORY_ORDER.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  className={`rounded-lg px-1.5 py-1 text-[8px] font-semibold ${
                    category === item ? 'bg-amber-500/15 text-amber-300' : 'text-slate-500'
                  }`}
                >
                  {CATEGORY_LABELS[item]}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setEquipment('all')}
                className={`rounded-lg px-1.5 py-1 text-[8px] font-semibold ${
                  equipment === 'all' ? 'bg-cyan-500/15 text-cyan-300' : 'text-slate-500'
                }`}
              >
                Любой инвентарь
              </button>
              {EQUIPMENT_ORDER.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setEquipment(item)}
                  className={`rounded-lg px-1.5 py-1 text-[8px] font-semibold ${
                    equipment === item ? 'bg-cyan-500/15 text-cyan-300' : 'text-slate-500'
                  }`}
                >
                  {EQUIPMENT_LABELS[item]}
                </button>
              ))}
            </div>
          </div>
        )}

        {!filtersActive && (
          <div className="mt-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-2">
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-emerald-300">
              <Sparkles className="h-3 w-3" />
              С чего начать
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {featured.map((exercise) => (
                <button
                  key={exercise.id}
                  type="button"
                  onClick={() => onSelect(exercise.id)}
                  className="rounded-lg border border-emerald-500/20 bg-[#091117] px-1.5 py-1 text-[8px] font-semibold text-slate-300 hover:text-emerald-300"
                >
                  {exercise.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {results.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#263a4a] bg-[#091117] px-4 py-8 text-center">
          <Target className="mx-auto h-6 w-6 text-slate-600" />
          <div className="mt-2 text-[11px] font-bold text-slate-300">Ничего не найдено</div>
          <p className="mt-1 text-[9px] leading-relaxed text-slate-500">
            Попробуйте другое название или сбросьте фильтры. В библиотеке есть приседания, тяги, жимы, изоляция и корпус.
          </p>
          <button type="button" onClick={resetFilters} className="mt-2 rounded-lg bg-amber-500/15 px-2.5 py-1.5 text-[9px] font-bold text-amber-300">
            Сбросить поиск
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {results.map((exercise) => (
            <ExerciseCard key={exercise.id} exercise={exercise} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
};
