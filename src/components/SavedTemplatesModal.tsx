import React, { useState } from 'react';
import { 
  X, 
  Play, 
  Edit3, 
  Trash2, 
  Plus, 
  Copy, 
  Dumbbell, 
  Clock, 
  Layers, 
  Sparkles, 
  ChevronDown, 
  ChevronUp,
  Search
} from 'lucide-react';
import { WorkoutPlan } from '../types';

interface SavedTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: WorkoutPlan[];
  onStartTemplate: (template: WorkoutPlan) => void;
  onEditTemplate: (template: WorkoutPlan) => void;
  onDeleteTemplate: (templateId: string) => void;
  onDuplicateTemplate: (template: WorkoutPlan) => void;
  onCreateNew: () => void;
}

export const SavedTemplatesModal: React.FC<SavedTemplatesModalProps> = ({
  isOpen,
  onClose,
  templates,
  onStartTemplate,
  onEditTemplate,
  onDeleteTemplate,
  onDuplicateTemplate,
  onCreateNew,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredTemplates = templates.filter(tmpl => 
    tmpl.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tmpl.exercises.some(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#0f1620] border border-[#233345] rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl shadow-emerald-950/30 overflow-hidden my-auto">
        
        {/* Header */}
        <div className="px-4 py-3.5 bg-[#141f2c] border-b border-[#233345] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>Мои готовые шаблоны</span>
                <span className="text-[10px] font-mono bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  {templates.length}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Запускай тренировку в один клик или редактируй параметры
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

        {/* Search & Actions Bar */}
        <div className="p-3 bg-[#111923] border-b border-[#1f2c3b] flex items-center gap-2 shrink-0">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Поиск по шаблонам или упражнениям..."
              className="w-full bg-[#0b1016] border border-[#243447] rounded-xl pl-8 pr-3 py-1.5 text-slate-100 text-xs focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              onClose();
              onCreateNew();
            }}
            className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1 shrink-0 active:scale-95 transition-all shadow-md shadow-emerald-500/20"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Создать шаблон</span>
          </button>
        </div>

        {/* Templates List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
          {filteredTemplates.length === 0 ? (
            <div className="bg-[#111a24] border border-dashed border-[#243447] rounded-2xl p-6 text-center text-slate-400 space-y-2">
              <Dumbbell className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="font-bold text-slate-300">
                {searchQuery ? 'Ничего не найдено по запросу' : 'У вас пока нет сохраненных шаблонов'}
              </p>
              <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                Создайте свой первый индивидуальный шаблон с базовыми упражнениями или сохраните проведенную тренировку как шаблон!
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onCreateNew();
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 shadow-md"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Создать первый шаблон</span>
                </button>
              </div>
            </div>
          ) : (
            filteredTemplates.map(tmpl => {
              const isExpanded = expandedTemplateId === tmpl.id;
              return (
                <div
                  key={tmpl.id}
                  className="bg-gradient-to-br from-[#121c27] via-[#0e1620] to-[#121c27] border border-[#233446] hover:border-emerald-500/40 rounded-2xl p-3.5 space-y-3 transition-all"
                >
                  {/* Top line of template */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {tmpl.scheduledDay && (
                          <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30">
                            {tmpl.scheduledDay}
                          </span>
                        )}
                        <h4 className="text-sm font-bold text-slate-100 truncate">
                          {tmpl.title}
                        </h4>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1 font-mono">
                        <span className="flex items-center gap-1">
                          <Dumbbell className="w-3 h-3 text-emerald-400" />
                          <span>{tmpl.exercises.length} упражнений</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-cyan-400" />
                          <span>~{tmpl.estimatedDurationMinutes || 60} мин</span>
                        </span>
                      </div>
                    </div>

                    {/* Launch Button */}
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onStartTemplate(tmpl);
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs shadow-md shadow-emerald-500/20 flex items-center gap-1.5 active:scale-95 transition-all shrink-0 ml-1"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Старт</span>
                    </button>
                  </div>

                  {/* Exercises Peek */}
                  <div className="bg-[#0b1016] p-2.5 rounded-xl border border-[#1a2533] space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      <span>Список упражнений в очереди:</span>
                      <button
                        type="button"
                        onClick={() => setExpandedTemplateId(isExpanded ? null : tmpl.id)}
                        className="text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5 normal-case font-semibold"
                      >
                        {isExpanded ? (
                          <>
                            <span>Свернуть</span>
                            <ChevronUp className="w-3 h-3" />
                          </>
                        ) : (
                          <>
                            <span>Подробнее</span>
                            <ChevronDown className="w-3 h-3" />
                          </>
                        )}
                      </button>
                    </div>

                    {/* Compact preview if not expanded */}
                    {!isExpanded ? (
                      <p className="text-slate-300 text-[11px] truncate">
                        {tmpl.exercises.map(e => `${e.name} (${e.targetSets}×${e.targetReps})`).join(', ')}
                      </p>
                    ) : (
                      /* Expanded full breakdown */
                      <div className="space-y-1.5 pt-1">
                        {tmpl.exercises.map((ex, idx) => (
                          <div
                            key={ex.id || idx}
                            className="bg-[#121a24] p-2 rounded-lg border border-[#1d2937] flex items-center justify-between text-xs font-sans"
                          >
                            <div className="flex items-center gap-2 truncate flex-1">
                              <span className="w-4 h-4 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <span className="font-semibold text-slate-200 truncate">
                                {ex.name}
                              </span>
                            </div>
                            <div className="font-mono text-emerald-400 text-[11px] font-bold shrink-0 ml-2">
                              {ex.targetSets} подх. × {ex.targetReps} повт. ({ex.targetWeight} кг)
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions footer: Edit, Duplicate, Delete */}
                  <div className="flex items-center justify-between pt-1 border-t border-[#1a2533] text-[11px]">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onEditTemplate(tmpl);
                        }}
                        className="text-slate-300 hover:text-emerald-300 flex items-center gap-1 font-semibold transition-colors px-2 py-1 rounded bg-[#16212d] hover:bg-[#1f2d3d]"
                      >
                        <Edit3 className="w-3 h-3 text-cyan-400" />
                        <span>Редактировать</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onDuplicateTemplate(tmpl)}
                        className="text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors px-2 py-1 rounded bg-[#16212d] hover:bg-[#1f2d3d]"
                        title="Создать копию шаблона"
                      >
                        <Copy className="w-3 h-3 text-slate-400" />
                        <span>Дублировать</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Удалить шаблон «${tmpl.title}»?`)) {
                          onDeleteTemplate(tmpl.id);
                        }
                      }}
                      className="text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors px-2 py-1 rounded hover:bg-red-950/40"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Удалить</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-[#141f2c] border-t border-[#233345] flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400 font-mono">
            GetFitBot Workout Templates Engine
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[#1a2533] hover:bg-[#253549] text-slate-300 font-semibold text-xs transition-colors"
          >
            Закрыть
          </button>
        </div>

      </div>
    </div>
  );
};
