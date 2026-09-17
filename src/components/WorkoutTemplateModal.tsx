import React, { useState } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Clock, 
  Dumbbell, 
  Search, 
  Sparkles, 
  Check, 
  Layers,
  Timer,
  Info
} from 'lucide-react';
import { WorkoutPlan, PlannedExercise } from '../types';
import { EXERCISE_CATALOG, MUSCLE_GROUPS, CatalogExercise } from '../data/exerciseCatalog';

interface WorkoutTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveTemplate: (template: WorkoutPlan) => void;
  initialTemplate?: WorkoutPlan | null;
}

const PRESET_TITLES = [
  'Грудь + Трицепс',
  'Спина + Бицепс',
  'День ног & Присед',
  'Плечи & Дельты',
  'Фуллбоди База',
  'Жимовой день (Power)',
  'Тяговый день (Volume)',
  'Верх тела (Push / Pull)',
  'Круговая ОФП & Пресс',
];

const DAYS_OF_WEEK = [
  'Понедельник',
  'Вторник',
  'Среда',
  'Четверг',
  'Пятница',
  'Суббота',
  'Воскресенье',
  'Любой день',
];

export const WorkoutTemplateModal: React.FC<WorkoutTemplateModalProps> = ({
  isOpen,
  onClose,
  onSaveTemplate,
  initialTemplate,
}) => {
  const [title, setTitle] = useState(initialTemplate?.title || '');
  const [scheduledDay, setScheduledDay] = useState(initialTemplate?.scheduledDay || 'Понедельник');
  const [defaultRestBetweenEx, setDefaultRestBetweenEx] = useState<number>(
    initialTemplate?.restBetweenExercisesMinutes || 3
  );

  const [exercises, setExercises] = useState<PlannedExercise[]>(
    initialTemplate?.exercises?.map(e => ({ ...e })) || []
  );

  // Exercise picker state
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [customExerciseName, setCustomExerciseName] = useState('');
  const [showCatalog, setShowCatalog] = useState(true);

  if (!isOpen) return null;

  // Filter catalog
  const filteredCatalog = EXERCISE_CATALOG.filter(ex => {
    const matchesGroup = selectedMuscleGroup === 'all' || ex.muscleGroup === selectedMuscleGroup;
    const matchesQuery = ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ex.muscleGroupName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesGroup && matchesQuery;
  });

  // Add exercise from catalog
  const handleAddFromCatalog = (item: CatalogExercise) => {
    const newExercise: PlannedExercise = {
      id: `ex_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: item.name,
      targetSets: item.defaultSets,
      targetReps: item.defaultReps,
      targetWeight: item.defaultWeight,
      restMinutes: item.defaultRestMinutes,
      restBetweenExercisesMinutes: item.defaultRestBetweenExercisesMinutes || defaultRestBetweenEx,
      muscleGroup: item.muscleGroupName,
    };
    setExercises(prev => [...prev, newExercise]);
  };

  // Add custom exercise
  const handleAddCustom = () => {
    if (!customExerciseName.trim()) return;
    const newExercise: PlannedExercise = {
      id: `ex_custom_${Date.now()}`,
      name: customExerciseName.trim(),
      targetSets: 4,
      targetReps: 10,
      targetWeight: 50,
      restMinutes: 2.5,
      restBetweenExercisesMinutes: defaultRestBetweenEx,
      muscleGroup: 'Свое упражнение',
    };
    setExercises(prev => [...prev, newExercise]);
    setCustomExerciseName('');
  };

  // Move exercise up in sequence
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    setExercises(prev => {
      const copy = [...prev];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  // Move exercise down in sequence
  const handleMoveDown = (index: number) => {
    if (index === exercises.length - 1) return;
    setExercises(prev => {
      const copy = [...prev];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  // Delete exercise
  const handleDeleteExercise = (index: number) => {
    setExercises(prev => prev.filter((_, i) => i !== index));
  };

  // Update specific exercise field
  const handleUpdateExercise = (index: number, field: keyof PlannedExercise, value: any) => {
    setExercises(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Calculate estimated duration
  // Approx 45 sec per set + rest between sets + rest between exercises
  const calculateDuration = () => {
    let totalMinutes = 0;
    exercises.forEach((ex, idx) => {
      const workTime = (ex.targetSets * 45) / 60; // working time
      const restSetsTime = (ex.targetSets - 1) * ex.restMinutes; // rest between sets
      const restExTime = idx < exercises.length - 1 
        ? (ex.restBetweenExercisesMinutes || defaultRestBetweenEx) 
        : 0;
      totalMinutes += workTime + restSetsTime + restExTime;
    });
    return Math.max(15, Math.round(totalMinutes));
  };

  const handleSave = () => {
    const finalTitle = title.trim() || 'Мой шаблон тренировки';
    const template: WorkoutPlan = {
      id: initialTemplate?.id || `tmpl_custom_${Date.now()}`,
      title: finalTitle,
      scheduledDay: scheduledDay,
      estimatedDurationMinutes: calculateDuration(),
      exercises: exercises,
      restBetweenExercisesMinutes: defaultRestBetweenEx,
      isCustomTemplate: true,
      status: 'scheduled',
      createdAt: initialTemplate?.createdAt || new Date().toISOString(),
    };

    onSaveTemplate(template);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#0f1620] border border-[#233345] rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl shadow-emerald-950/30 overflow-hidden my-auto">
        
        {/* Header */}
        <div className="px-4 py-3.5 bg-[#141f2c] border-b border-[#233345] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Dumbbell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                {initialTemplate ? 'Редактировать шаблон' : 'Конструктор шаблона тренировки'}
              </h3>
              <p className="text-[11px] text-slate-400">
                Базовые упражнения по группам мышц, очередь, подходы и таймеры отдыха
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-[#1a2636] hover:bg-[#25374d] text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          
          {/* Main Template Parameters */}
          <div className="bg-[#111a24] p-3 rounded-xl border border-[#1f2d3d] space-y-3">
            <div>
              <label className="text-[11px] font-bold text-slate-300 block mb-1">
                Название шаблона:
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Например: Грудь + Трицепс или Силовой день"
                className="w-full bg-[#0b1016] border border-[#243447] focus:border-emerald-500 rounded-xl px-3 py-2 text-slate-100 text-xs focus:outline-none"
              />

              {/* Quick Presets */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {PRESET_TITLES.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setTitle(preset)}
                    className="px-2 py-1 rounded-lg bg-[#16212d] hover:bg-[#1d2b3a] text-slate-300 text-[10px] transition-colors border border-[#233140]"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  День недели (по умолчанию):
                </label>
                <select
                  value={scheduledDay}
                  onChange={e => setScheduledDay(e.target.value)}
                  className="w-full bg-[#0b1016] border border-[#243447] rounded-xl px-3 py-2 text-slate-100 text-xs focus:outline-none"
                >
                  {DAYS_OF_WEEK.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1 flex items-center gap-1">
                  <Timer className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Отдых между упражнениями:</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="10"
                    value={defaultRestBetweenEx}
                    onChange={e => setDefaultRestBetweenEx(parseFloat(e.target.value) || 3)}
                    className="w-20 bg-[#0b1016] border border-[#243447] rounded-xl px-2 py-2 text-center font-mono font-bold text-emerald-400 text-xs focus:outline-none"
                  />
                  <span className="text-slate-400 text-[11px]">мин (переход к след. снаряду)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Current Queue of Added Exercises in this Template */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-slate-200">
                  Очередь упражнений в шаблоне ({exercises.length}):
                </span>
              </div>
              <span className="text-[11px] text-emerald-400 font-mono font-semibold">
                ~{calculateDuration()} мин расчетного времени
              </span>
            </div>

            {exercises.length === 0 ? (
              <div className="bg-[#111a24] border border-dashed border-[#243447] rounded-xl p-5 text-center text-slate-400 space-y-1">
                <Dumbbell className="w-6 h-6 text-slate-500 mx-auto mb-1" />
                <p className="font-semibold text-slate-300">В шаблоне пока нет упражнений</p>
                <p className="text-[11px] text-slate-500">
                  Выберите упражнения из каталога ниже или добавьте свое кастомное
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {exercises.map((ex, index) => (
                  <div
                    key={ex.id || index}
                    className="bg-gradient-to-r from-[#121c27] via-[#0f1722] to-[#121c27] border border-[#233446] rounded-xl p-3 space-y-2.5 transition-all"
                  >
                    {/* Header line of exercise with order buttons */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 font-mono font-bold text-xs flex items-center justify-center shrink-0 border border-emerald-500/30">
                          {index + 1}
                        </span>
                        <div className="truncate">
                          <span className="font-bold text-slate-100 text-xs truncate block">
                            {ex.name}
                          </span>
                          {ex.muscleGroup && (
                            <span className="text-[10px] text-slate-400 font-medium">
                              {ex.muscleGroup}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Sequence controls: Move Up, Move Down, Remove */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0}
                          title="Поднять выше в очереди"
                          className="w-7 h-7 rounded-lg bg-[#1a2533] hover:bg-[#253549] text-slate-300 disabled:opacity-30 flex items-center justify-center transition-colors"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveDown(index)}
                          disabled={index === exercises.length - 1}
                          title="Опустить ниже в очереди"
                          className="w-7 h-7 rounded-lg bg-[#1a2533] hover:bg-[#253549] text-slate-300 disabled:opacity-30 flex items-center justify-center transition-colors"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteExercise(index)}
                          title="Удалить упражнение"
                          className="w-7 h-7 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 flex items-center justify-center transition-colors border border-red-900/40 ml-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Parameters grid: Sets, Weight, Reps, Rest between sets, Rest before next exercise */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-[#1e2c3c]">
                      {/* Sets */}
                      <div className="bg-[#0b1016] p-2 rounded-lg border border-[#1b2633]">
                        <span className="text-[10px] text-slate-400 block mb-1">Подходы:</span>
                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => handleUpdateExercise(index, 'targetSets', Math.max(1, ex.targetSets - 1))}
                            className="w-5 h-5 rounded bg-[#1a2636] text-slate-300 font-bold flex items-center justify-center"
                          >
                            -
                          </button>
                          <span className="font-mono font-bold text-slate-100 text-xs">
                            {ex.targetSets}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateExercise(index, 'targetSets', ex.targetSets + 1)}
                            className="w-5 h-5 rounded bg-[#1a2636] text-slate-300 font-bold flex items-center justify-center"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Weight */}
                      <div className="bg-[#0b1016] p-2 rounded-lg border border-[#1b2633]">
                        <span className="text-[10px] text-slate-400 block mb-1">Вес снаряда:</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="2.5"
                            value={ex.targetWeight}
                            onChange={e => handleUpdateExercise(index, 'targetWeight', parseFloat(e.target.value) || 0)}
                            className="w-full bg-transparent font-mono font-bold text-emerald-400 text-xs focus:outline-none text-center"
                          />
                          <span className="text-slate-500 text-[10px]">кг</span>
                        </div>
                      </div>

                      {/* Reps */}
                      <div className="bg-[#0b1016] p-2 rounded-lg border border-[#1b2633]">
                        <span className="text-[10px] text-slate-400 block mb-1">Повторения:</span>
                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => handleUpdateExercise(index, 'targetReps', Math.max(1, ex.targetReps - 1))}
                            className="w-5 h-5 rounded bg-[#1a2636] text-slate-300 font-bold flex items-center justify-center"
                          >
                            -
                          </button>
                          <span className="font-mono font-bold text-slate-100 text-xs">
                            {ex.targetReps}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateExercise(index, 'targetReps', ex.targetReps + 1)}
                            className="w-5 h-5 rounded bg-[#1a2636] text-slate-300 font-bold flex items-center justify-center"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Rest between sets */}
                      <div className="bg-[#0b1016] p-2 rounded-lg border border-[#1b2633]">
                        <span className="text-[10px] text-slate-400 block mb-1">Отдых подходов:</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.5"
                            min="0.5"
                            max="10"
                            value={ex.restMinutes}
                            onChange={e => handleUpdateExercise(index, 'restMinutes', parseFloat(e.target.value) || 2)}
                            className="w-full bg-transparent font-mono font-bold text-cyan-400 text-xs focus:outline-none text-center"
                          />
                          <span className="text-slate-500 text-[10px]">мин</span>
                        </div>
                      </div>
                    </div>

                    {/* Rest between exercises customization */}
                    <div className="flex items-center justify-between text-[10px] text-slate-400 bg-[#0d141d] px-2.5 py-1.5 rounded-lg border border-[#1a2430]">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>Отдых перед следующим упражнением:</span>
                      </span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          max="10"
                          value={ex.restBetweenExercisesMinutes !== undefined ? ex.restBetweenExercisesMinutes : defaultRestBetweenEx}
                          onChange={e => handleUpdateExercise(index, 'restBetweenExercisesMinutes', parseFloat(e.target.value) || 3)}
                          className="w-12 bg-[#080d12] border border-[#233140] rounded px-1 text-center font-mono font-bold text-slate-200 text-[11px]"
                        />
                        <span>мин</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Catalog & Adding Section */}
          <div className="bg-[#111a24] p-3 rounded-xl border border-[#1f2d3d] space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                <span>Базовые упражнения по группам мышц</span>
              </span>
              <button
                type="button"
                onClick={() => setShowCatalog(!showCatalog)}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold"
              >
                {showCatalog ? 'Свернуть каталог' : 'Развернуть каталог'}
              </button>
            </div>

            {showCatalog && (
              <div className="space-y-2.5">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Поиск упражнения..."
                    className="w-full bg-[#0b1016] border border-[#243447] rounded-xl pl-8 pr-3 py-1.5 text-slate-100 text-xs focus:outline-none"
                  />
                </div>

                {/* Muscle Group Chips */}
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  <button
                    type="button"
                    onClick={() => setSelectedMuscleGroup('all')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold shrink-0 transition-colors ${
                      selectedMuscleGroup === 'all'
                        ? 'bg-emerald-500 text-slate-950 font-bold'
                        : 'bg-[#182330] text-slate-300 hover:bg-[#202f40]'
                    }`}
                  >
                    Все группы
                  </button>
                  {MUSCLE_GROUPS.map(mg => (
                    <button
                      key={mg.id}
                      type="button"
                      onClick={() => setSelectedMuscleGroup(mg.id)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold shrink-0 transition-colors flex items-center gap-1 ${
                        selectedMuscleGroup === mg.id
                          ? 'bg-emerald-500 text-slate-950 font-bold'
                          : 'bg-[#182330] text-slate-300 hover:bg-[#202f40]'
                      }`}
                    >
                      <span>{mg.icon}</span>
                      <span>{mg.label}</span>
                    </button>
                  ))}
                </div>

                {/* Exercise List from Catalog */}
                <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                  {filteredCatalog.length === 0 ? (
                    <div className="p-3 text-center text-slate-400 text-xs">
                      Упражнения не найдены
                    </div>
                  ) : (
                    filteredCatalog.map(item => {
                      const isAlreadyAdded = exercises.some(e => e.name === item.name);
                      return (
                        <div
                          key={item.id}
                          className="bg-[#0e1620] hover:bg-[#14202e] border border-[#1e2a38] rounded-xl p-2.5 flex items-center justify-between gap-2 transition-colors"
                        >
                          <div className="truncate flex-1">
                            <span className="font-semibold text-slate-200 text-xs block truncate">
                              {item.name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {item.muscleGroupName} • по умолч. {item.defaultSets}×{item.defaultReps} ({item.defaultWeight} кг), отдых {item.defaultRestMinutes} мин
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleAddFromCatalog(item)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/40 text-[11px] font-bold shrink-0 transition-all flex items-center gap-1 active:scale-95"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Добавить</span>
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Custom Exercise Input */}
                <div className="pt-2 border-t border-[#1e2a38]">
                  <span className="text-[11px] font-bold text-slate-300 block mb-1">
                    Или введите свое кастомное упражнение:
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customExerciseName}
                      onChange={e => setCustomExerciseName(e.target.value)}
                      placeholder="Название упражнения..."
                      className="flex-1 bg-[#0b1016] border border-[#243447] rounded-xl px-3 py-1.5 text-slate-100 text-xs focus:outline-none"
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustom();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddCustom}
                      disabled={!customExerciseName.trim()}
                      className="px-3 py-1.5 rounded-xl bg-[#1a2636] hover:bg-[#253549] text-emerald-400 font-bold text-xs disabled:opacity-40 transition-colors shrink-0"
                    >
                      + Добавить
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="p-3.5 bg-[#141f2c] border-t border-[#233345] flex items-center justify-between shrink-0 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-[#1a2533] hover:bg-[#253549] text-slate-300 font-semibold text-xs transition-colors"
          >
            Отмена
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={exercises.length === 0}
            className="flex-1 max-w-xs py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs shadow-lg shadow-emerald-500/20 disabled:opacity-40 flex items-center justify-center gap-1.5 transition-all active:scale-95"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>{initialTemplate ? 'Сохранить изменения' : 'Сохранить в шаблоны'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
