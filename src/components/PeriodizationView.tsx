import React, { useState, useEffect } from 'react';
import {
  Calendar,
  TrendingUp,
  Plus,
  CheckCircle2,
  ArrowRight,
  Layers,
  Target,
  Activity,
  Clock,
  ChevronRight,
  X,
  Save,
  Trash2,
  Edit3,
  BarChart3,
  Dumbbell,
  Flame,
  RefreshCcw,
  Zap,
  AlertCircle
} from 'lucide-react';
import { TrainingBlock, WorkoutRecord, UserProfile } from '../types';

interface PeriodizationViewProps {
  user: UserProfile;
  pastWorkouts: WorkoutRecord[];
  onUpdateUser?: (updated: Partial<UserProfile>) => void;
}

const BLOCK_TYPES = [
  { id: 'hypertrophy', label: '🏋️ Гипертрофия', color: 'bg-blue-500' },
  { id: 'strength', label: '💪 Сила', color: 'bg-red-500' },
  { id: 'deload', label: '😌 Разгрузка', color: 'bg-green-500' },
  { id: 'recomp', label: '🔄 Рекомп', color: 'bg-purple-500' },
  { id: 'endurance', label: '🏃 Выносливость', color: 'bg-orange-500' },
  { id: 'custom', label: '⚙️ Своё', color: 'bg-gray-500' },
];

export const PeriodizationView: React.FC<PeriodizationViewProps> = ({
  user,
  pastWorkouts,
  onUpdateUser,
}) => {
  const [blocks, setBlocks] = useState<TrainingBlock[]>(() => {
    try {
      const saved = localStorage.getItem('getfit_training_blocks');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<TrainingBlock | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [type, setType] = useState<TrainingBlock['type']>('hypertrophy');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date(Date.now() + 28 * 86400000).toISOString().split('T')[0]);
  const [goals, setGoals] = useState<string[]>([]);
  const [goalInput, setGoalInput] = useState('');
  const [notes, setNotes] = useState('');
  const [targetRpeMin, setTargetRpeMin] = useState(7);
  const [targetRpeMax, setTargetRpeMax] = useState(9);

  useEffect(() => {
    localStorage.setItem('getfit_training_blocks', JSON.stringify(blocks));
  }, [blocks]);

  const calculateBlockStats = (block: TrainingBlock) => {
    const blockStart = new Date(block.startDate).getTime();
    const blockEnd = new Date(block.endDate).getTime();
    
    const relevantWorkouts = pastWorkouts.filter(w => {
      const wDate = new Date(w.date || w.startedAt).getTime();
      return wDate >= blockStart && wDate <= blockEnd;
    });

    const totalTonnage = relevantWorkouts.reduce((sum, w) => sum + (w.totalTonnageKg || 0), 0);
    const avgRpe = relevantWorkouts.length > 0 
      ? relevantWorkouts.reduce((sum, w) => sum + (w.exercises?.reduce((eSum, e) => eSum + (e.sets?.reduce((sSum, s) => sSum + (s.rpe || 8), 0) || 0) || 0), 0) / relevantWorkouts.length / (relevantWorkouts[0]?.exercises?.length || 1)
      : 0;

    return {
      workoutsCount: relevantWorkouts.length,
      totalTonnage,
      avgRpe: avgRpe.toFixed(1),
    };
  };

  const handleAddGoal = () => {
    if (goalInput.trim()) {
      setGoals([...goals, goalInput.trim()]);
      setGoalInput('');
    }
  };

  const handleRemoveGoal = (idx: number) => {
    setGoals(goals.filter((_, i) => i !== idx));
  };

  const handleCreateBlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const durationDays = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000);

    const newBlock: TrainingBlock = {
      id: `block_${Date.now()}`,
      title: title.trim(),
      type,
      startDate,
      endDate,
      goals: goals.length > 0 ? goals : undefined,
      notes: notes.trim() || undefined,
      targetRpeRange: [targetRpeMin, targetRpeMax],
      status: 'active',
      isCurrent: blocks.filter(b => b.isCurrent).length === 0,
      createdAt: new Date().toISOString(),
    };

    setBlocks([newBlock, ...blocks]);
    setShowCreateModal(false);
    resetForm();
  };

  const resetForm = () => {
    setTitle('');
    setType('hypertrophy');
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate(new Date(Date.now() + 28 * 86400000).toISOString().split('T')[0]);
    setGoals([]);
    setGoalInput('');
    setNotes('');
    setTargetRpeMin(7);
    setTargetRpeMax(9);
  };

  const handleDeleteBlock = (id: string) => {
    if (confirm('Удалить этот тренировочный блок?')) {
      setBlocks(blocks.filter(b => b.id !== id));
    }
  };

  const handleSetCurrent = (id: string) => {
    setBlocks(blocks.map(b => ({
      ...b,
      isCurrent: b.id === id,
      status: b.id === id ? 'active' : b.status,
    })));
  };

  const currentBlock = blocks.find(b => b.isCurrent);
  const upcomingBlocks = blocks.filter(b => !b.isCurrent && new Date(b.startDate) > new Date()).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  const pastBlocks = blocks.filter(b => new Date(b.endDate) < new Date()).sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#0b0f12]/95 backdrop-blur-md border-b border-[#1a242f] px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-400" />
              Периодизация
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {blocks.length} блоков • {currentBlock ? 'Активен: ' + currentBlock.title : 'Нет активного'}
            </p>
          </div>
          <button
            onClick={() => { resetForm(); setShowCreateModal(true); }}
            className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-black px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            Блок
          </button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-6">
        {/* Current Block */}
        {currentBlock && (
          <section>
            <h2 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-3">
              🔥 Активный блок
            </h2>
            <BlockCard
              block={currentBlock}
              stats={calculateBlockStats(currentBlock)}
              onEdit={() => { setSelectedBlock(currentBlock); setShowEditModal(true); }}
              onDelete={() => handleDeleteBlock(currentBlock.id)}
              onSetCurrent={() => handleSetCurrent(currentBlock.id)}
              isCurrent
            />
          </section>
        )}

        {/* Upcoming Blocks */}
        {upcomingBlocks.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
              📅 Запланировано
            </h2>
            <div className="space-y-2">
              {upcomingBlocks.map(block => (
                <BlockCard
                  key={block.id}
                  block={block}
                  stats={calculateBlockStats(block)}
                  onEdit={() => { setSelectedBlock(block); setShowEditModal(true); }}
                  onDelete={() => handleDeleteBlock(block.id)}
                  onSetCurrent={() => handleSetCurrent(block.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Past Blocks */}
        {pastBlocks.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
              📜 История
            </h2>
            <div className="space-y-2">
              {pastBlocks.slice(0, 5).map(block => (
                <BlockCard
                  key={block.id}
                  block={block}
                  stats={calculateBlockStats(block)}
                  onEdit={() => { setSelectedBlock(block); setShowEditModal(true); }}
                  onDelete={() => handleDeleteBlock(block.id)}
                  onSetCurrent={() => handleSetCurrent(block.id)}
                  isPast
                />
              ))}
            </div>
          </section>
        )}

        {blocks.length === 0 && (
          <div className="text-center py-12">
            <Layers className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Нет тренировочных блоков</p>
            <p className="text-slate-500 text-xs mt-1">Создайте первый блок для планирования периодизации</p>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#0f161d] rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-[#1a242f]">
            <div className="sticky top-0 bg-[#0f161d] border-b border-[#1a242f] px-4 py-3 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Новый блок</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBlock} className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Название</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Например: Силовой пик к соревнованиям"
                  className="w-full bg-[#0b0f12] border border-[#1a242f] rounded-lg px-3 py-2.5 text-white text-sm focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Тип блока</label>
                <div className="grid grid-cols-2 gap-2">
                  {BLOCK_TYPES.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setType(t.id as TrainingBlock['type'])}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        type === t.id
                          ? `${t.color} text-white`
                          : 'bg-[#0b0f12] text-slate-400 border border-[#1a242f]'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Начало</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-[#0b0f12] border border-[#1a242f] rounded-lg px-3 py-2.5 text-white text-sm focus:border-emerald-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Конец</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate}
                    className="w-full bg-[#0b0f12] border border-[#1a242f] rounded-lg px-3 py-2.5 text-white text-sm focus:border-emerald-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">
                  RPE диапазон
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="10"
                    value={targetRpeMin}
                    onChange={(e) => setTargetRpeMin(Number(e.target.value))}
                    className="w-20 bg-[#0b0f12] border border-[#1a242f] rounded-lg px-3 py-2.5 text-white text-sm focus:border-emerald-500 focus:outline-none text-center"
                  />
                  <span className="text-slate-500">→</span>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="10"
                    value={targetRpeMax}
                    onChange={(e) => setTargetRpeMax(Number(e.target.value))}
                    className="w-20 bg-[#0b0f12] border border-[#1a242f] rounded-lg px-3 py-2.5 text-white text-sm focus:border-emerald-500 focus:outline-none text-center"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Цели</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={goalInput}
                    onChange={(e) => setGoalInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddGoal())}
                    placeholder="+ Цель"
                    className="flex-1 bg-[#0b0f12] border border-[#1a242f] rounded-lg px-3 py-2.5 text-white text-sm focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddGoal}
                    className="bg-emerald-500 hover:bg-emerald-400 text-black px-3 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {goals.length > 0 && (
                  <div className="space-y-1">
                    {goals.map((goal, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-[#0b0f12] border border-[#1a242f] rounded-lg px-3 py-2">
                        <span className="text-sm text-slate-300">{goal}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveGoal(idx)}
                          className="text-slate-500 hover:text-rose-400"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Заметки</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="План, фокус, особенности..."
                  rows={3}
                  className="w-full bg-[#0b0f12] border border-[#1a242f] rounded-lg px-3 py-2.5 text-white text-sm focus:border-emerald-500 focus:outline-none resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                Создать блок
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Block Card Component
const BlockCard: React.FC<{
  block: TrainingBlock;
  stats: { workoutsCount: number; totalTonnage: number; avgRpe: string };
  onEdit?: () => void;
  onDelete?: () => void;
  onSetCurrent?: () => void;
  isCurrent?: boolean;
  isPast?: boolean;
}> = ({ block, stats, onEdit, onDelete, onSetCurrent, isCurrent, isPast }) => {
  const blockType = BLOCK_TYPES.find(t => t.id === block.type) || BLOCK_TYPES[5];
  const daysLeft = Math.ceil((new Date(block.endDate).getTime() - new Date().getTime()) / 86400000);

  return (
    <div className={`bg-[#0f161d] border rounded-xl p-4 transition-all ${
      isCurrent ? 'border-emerald-500/50 shadow-lg shadow-emerald-900/20' : 'border-[#1a242f]'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${blockType.color}`} />
          <h3 className="font-bold text-white">{block.title}</h3>
        </div>
        <div className="flex items-center gap-1">
          {!isCurrent && !isPast && onSetCurrent && (
            <button
              onClick={onSetCurrent}
              className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded hover:bg-emerald-500/30 transition-colors"
            >
              Активировать
            </button>
          )}
          {onEdit && (
            <button onClick={onEdit} className="text-slate-400 hover:text-white p-1">
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} className="text-slate-400 hover:text-rose-400 p-1">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="bg-[#0b0f12] rounded-lg p-2 text-center">
          <Dumbbell className="w-3.5 h-3.5 text-slate-400 mx-auto mb-1" />
          <div className="text-lg font-bold text-white">{stats.workoutsCount}</div>
          <div className="text-[10px] text-slate-500 uppercase">Тренировок</div>
        </div>
        <div className="bg-[#0b0f12] rounded-lg p-2 text-center">
          <BarChart3 className="w-3.5 h-3.5 text-slate-400 mx-auto mb-1" />
          <div className="text-lg font-bold text-white">{(stats.totalTonnage / 1000).toFixed(0)}т</div>
          <div className="text-[10px] text-slate-500 uppercase">Тоннаж</div>
        </div>
        <div className="bg-[#0b0f12] rounded-lg p-2 text-center">
          <Activity className="w-3.5 h-3.5 text-slate-400 mx-auto mb-1" />
          <div className="text-lg font-bold text-white">{stats.avgRpe}</div>
          <div className="text-[10px] text-slate-500 uppercase">Средний RPE</div>
        </div>
      </div>

      {block.goals && block.goals.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Target className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-semibold text-slate-400 uppercase">Цели</span>
          </div>
          <div className="space-y-1">
            {block.goals.map((goal, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs text-slate-300">
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>{goal}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-[#1a242f]">
        <div className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          <span>{block.startDate} → {block.endDate}</span>
        </div>
        {!isPast && daysLeft > 0 && (
          <div className="flex items-center gap-1 text-emerald-400">
            <Clock className="w-3 h-3" />
            <span>{daysLeft} дн.</span>
          </div>
        )}
      </div>
    </div>
  );
};
