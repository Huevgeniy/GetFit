import React, { useEffect, useState } from 'react';
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
  ChevronDown, 
  ChevronUp,
  Search,
  Share2,
  Globe,
  Users,
  Link2,
  Check,
  Download,
  Loader2,
  User
} from 'lucide-react';
import { WorkoutPlan } from '../types';
import {
  SharedTemplateInfo,
  fetchMySharedTemplates,
  fetchPublicTemplates,
  importSharedTemplate,
  removeSharedTemplate,
  shareTemplate,
} from '../lib/api';
import { copyToClipboard, hapticImpact, hapticNotify, shareToTelegram } from '../lib/telegram';

interface SavedTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: WorkoutPlan[];
  onStartTemplate: (template: WorkoutPlan) => void;
  onEditTemplate: (template: WorkoutPlan) => void;
  onDeleteTemplate: (templateId: string) => void;
  onDuplicateTemplate: (template: WorkoutPlan) => void;
  onCreateNew: () => void;
  /** Добавляет шаблон, полученный по ссылке или из общей библиотеки. */
  onAddImportedTemplate?: (template: WorkoutPlan) => void;
}

const extractCode = (raw: string): string => {
  const value = raw.trim();
  const prefixed = value.match(/tpl_([A-Za-z0-9_-]{4,28})/i);
  if (prefixed) return prefixed[1];
  try {
    const url = new URL(value);
    const fromStart = url.searchParams.get('start') || url.searchParams.get('startapp') || '';
    const matched = fromStart.match(/tpl_([A-Za-z0-9_-]{4,28})/i);
    if (matched) return matched[1];
  } catch { /* not a URL */ }
  return value.replace(/^tpl_/i, '');
};

export const SavedTemplatesModal: React.FC<SavedTemplatesModalProps> = ({
  isOpen,
  onClose,
  templates,
  onStartTemplate,
  onEditTemplate,
  onDeleteTemplate,
  onDuplicateTemplate,
  onCreateNew,
  onAddImportedTemplate,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);
  const [mode, setMode] = useState<'mine' | 'community'>('mine');
  const [sharedMine, setSharedMine] = useState<SharedTemplateInfo[]>([]);
  const [community, setCommunity] = useState<SharedTemplateInfo[]>([]);
  const [loadingMine, setLoadingMine] = useState(false);
  const [loadingCommunity, setLoadingCommunity] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [importCode, setImportCode] = useState('');
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const loadMine = async () => {
    setLoadingMine(true);
    const list = await fetchMySharedTemplates();
    setSharedMine(list);
    setLoadingMine(false);
  };

  const loadCommunity = async () => {
    setLoadingCommunity(true);
    const list = await fetchPublicTemplates();
    setCommunity(list);
    setLoadingCommunity(false);
  };

  useEffect(() => {
    if (!isOpen) return;
    setNotice(null);
    loadMine();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || mode !== 'community') return;
    loadCommunity();
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const matchesSearch = (plan: WorkoutPlan) =>
    !normalizedSearch ||
    plan.title.toLowerCase().includes(normalizedSearch) ||
    (plan.exercises || []).some(e => e.name.toLowerCase().includes(normalizedSearch));

  const filteredTemplates = templates.filter(matchesSearch);
  const filteredCommunity = community.filter(shared => matchesSearch(shared.template));

  const sharedFor = (templateId: string) =>
    sharedMine.find(shared => shared.template.id === templateId);
  const sharedForSharedInfo = (shared: SharedTemplateInfo) =>
    sharedMine.find(item => item.code === shared.code);

  const rememberShared = (shared: SharedTemplateInfo) => {
    setSharedMine(prev => [shared, ...prev.filter(item => item.id !== shared.id)]);
  };

  const ensureShared = async (template: WorkoutPlan, isPublic: boolean): Promise<SharedTemplateInfo | null> => {
    setBusyId(template.id);
    hapticImpact('light');
    const result = await shareTemplate(template, isPublic);
    setBusyId(null);
    if (!result.ok || !result.shared) {
      hapticNotify('error');
      setNotice({ kind: 'error', text: result.error || 'Не удалось поделиться шаблоном' });
      return null;
    }
    rememberShared(result.shared);
    return result.shared;
  };

  const handleShareWithFriend = async (template: WorkoutPlan) => {
    const existing = sharedFor(template.id);
    const shared = existing || (await ensureShared(template, false));
    if (!shared) return;
    hapticNotify('success');
    shareToTelegram(
      shared.link,
      `🏋️ Держи мой шаблон тренировки «${template.title}». Открой ссылку — он добавится в «Мои шаблоны» GetFit.`,
    );
    setNotice({ kind: 'ok', text: 'Ссылка открыта в Telegram — выбери друга и отправь.' });
  };

  const handleTogglePublic = async (template: WorkoutPlan) => {
    const existing = sharedFor(template.id);
    if (existing?.isPublic) {
      setBusyId(template.id);
      const result = await removeSharedTemplate(existing.id, 'unpublish');
      setBusyId(null);
      if (result.ok) {
        rememberShared({ ...existing, isPublic: false });
        setCommunity(prev => prev.filter(item => item.code !== existing.code));
        hapticNotify('success');
        setNotice({ kind: 'ok', text: 'Шаблон убран из общей библиотеки. Ссылка для друга продолжает работать.' });
        return;
      }
      hapticNotify('error');
      setNotice({ kind: 'error', text: result.error || 'Не удалось снять с публикации' });
      return;
    }

    const shared = await ensureShared(template, true);
    if (shared) {
      hapticNotify('success');
      setNotice({ kind: 'ok', text: 'Шаблон опубликован в общей библиотеке — его увидят другие атлеты.' });
    }
  };

  const handleCopyLink = async (template: WorkoutPlan) => {
    const existing = sharedFor(template.id);
    const shared = existing || (await ensureShared(template, false));
    if (!shared) return;
    const copied = await copyToClipboard(shared.link);
    hapticNotify(copied ? 'success' : 'error');
    setNotice(
      copied
        ? { kind: 'ok', text: 'Ссылка скопирована. Отправь её другу в любом чате.' }
        : { kind: 'error', text: 'Не удалось скопировать ссылку' },
    );
  };

  const handleImportByCode = async (rawCode: string) => {
    const code = extractCode(rawCode);
    if (!code) {
      setNotice({ kind: 'error', text: 'Введи код или ссылку на шаблон' });
      return;
    }
    setBusyId(`import:${code}`);
    hapticImpact('light');
    const result = await importSharedTemplate(code);
    setBusyId(null);
    if (!result.ok || !result.template) {
      hapticNotify('error');
      setNotice({ kind: 'error', text: result.error || 'Шаблон не найден' });
      return;
    }
    onAddImportedTemplate?.(result.template);
    setImportCode('');
    hapticNotify('success');
    setNotice({
      kind: 'ok',
      text: result.alreadyOwned
        ? 'Это твой собственный шаблон — он уже в библиотеке.'
        : `Шаблон «${result.template.title}» добавлен в «Мои шаблоны».`,
    });
  };

  const handleImportPublic = async (shared: SharedTemplateInfo) => {
    await handleImportByCode(shared.code);
    setMode('mine');
  };

  const importBusy = (shared: SharedTemplateInfo) => busyId === `import:${shared.code}`;

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
                <span>Шаблоны тренировок</span>
                <span className="text-[10px] font-mono bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  {templates.length}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Запускай в один клик, делись с другом и бери шаблоны других атлетов
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

        {/* Mode switch: мои / общие */}
        <div className="px-3 pt-3 flex bg-[#111923] gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setMode('mine')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
              mode === 'mine'
                ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20'
                : 'bg-[#0b1016] text-slate-400 border-[#243447] hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Мои</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('community')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
              mode === 'community'
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/20'
                : 'bg-[#0b1016] text-slate-400 border-[#243447] hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Общие шаблоны</span>
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
              placeholder={mode === 'mine' ? 'Поиск по шаблонам или упражнениям...' : 'Поиск в общей библиотеке...'}
              className="w-full bg-[#0b1016] border border-[#243447] rounded-xl pl-8 pr-3 py-1.5 text-slate-100 text-xs focus:outline-none"
            />
          </div>

          {mode === 'mine' && (
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
          )}
        </div>

        {notice && (
          <div
            className={`mx-3 mt-3 px-3 py-2 rounded-xl text-[11px] font-semibold border ${
              notice.kind === 'ok'
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                : 'bg-amber-950/50 border-amber-500/40 text-amber-300'
            }`}
          >
            {notice.text}
          </div>
        )}

        {/* Templates List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
          {mode === 'mine' ? (
            filteredTemplates.length === 0 ? (
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
                const shared = sharedFor(tmpl.id);
                const busy = busyId === tmpl.id;
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
                          {shared?.isPublic && (
                            <span className="text-[9px] font-bold uppercase text-cyan-300 bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-500/30 flex items-center gap-1">
                              <Globe className="w-2.5 h-2.5" /> в общей
                            </span>
                          )}
                          {shared && !shared.isPublic && (
                            <span className="text-[9px] font-mono text-slate-400 bg-[#151f2b] px-1.5 py-0.5 rounded border border-[#2a3b4e]">
                              по ссылке
                            </span>
                          )}
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
                          {shared && shared.copies > 0 && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1 text-cyan-300">
                                <Download className="w-3 h-3" />
                                {shared.copies}
                              </span>
                            </>
                          )}
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

                    {/* Sharing row */}
                    <div className="bg-[#0d141c] border border-[#1d2a38] rounded-xl p-2 flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleShareWithFriend(tmpl)}
                        className="flex-1 min-w-[130px] py-1.5 px-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 disabled:opacity-50 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold flex items-center justify-center gap-1 transition-colors"
                        title="Отправить ссылку другу в Telegram"
                      >
                        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Share2 className="w-3 h-3" />}
                        <span>Поделиться другу</span>
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleCopyLink(tmpl)}
                        className="py-1.5 px-2 rounded-lg bg-[#16212d] hover:bg-[#1f2d3d] disabled:opacity-50 text-slate-300 border border-[#243447] text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors"
                        title="Скопировать ссылку на шаблон"
                      >
                        <Link2 className="w-3 h-3" />
                        <span>Ссылка</span>
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleTogglePublic(tmpl)}
                        className={`py-1.5 px-2 rounded-lg border text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors disabled:opacity-50 ${
                          shared?.isPublic
                            ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/25'
                            : 'bg-[#16212d] border-[#243447] text-slate-300 hover:bg-[#1f2d3d]'
                        }`}
                        title="Показать шаблон в общей библиотеке"
                      >
                        {shared?.isPublic ? <Check className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                        <span>{shared?.isPublic ? 'В общей' : 'В общую'}</span>
                      </button>
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
            )
          ) : (
            <div className="space-y-3">
              {/* Import by code */}
              <div className="bg-[#111a24] border border-[#233446] rounded-2xl p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-cyan-400" />
                  <div>
                    <div className="text-xs font-bold text-slate-200">Забрать по коду или ссылке</div>
                    <div className="text-[10px] text-slate-400">Друг мог прислать ссылку вида t.me/get_fitbot?start=tpl_...</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={importCode}
                    onChange={e => setImportCode(e.target.value)}
                    placeholder="tpl_ABCD1234 или ссылка"
                    className="flex-1 bg-[#0b1016] border border-[#243447] rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500/50 font-mono"
                  />
                  <button
                    type="button"
                    disabled={!importCode.trim() || busyId === `import:${extractCode(importCode)}`}
                    onClick={() => handleImportByCode(importCode)}
                    className="px-3 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center gap-1"
                  >
                    {busyId === `import:${extractCode(importCode)}` ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    <span>Забрать</span>
                  </button>
                </div>
              </div>

              {loadingCommunity ? (
                <div className="py-10 flex items-center justify-center text-slate-400 text-xs gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Загружаю общую библиотеку…
                </div>
              ) : filteredCommunity.length === 0 ? (
                <div className="bg-[#111a24] border border-dashed border-[#243447] rounded-2xl p-6 text-center text-slate-400 space-y-2">
                  <Globe className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="font-bold text-slate-300">
                    {searchQuery ? 'Ничего не найдено' : 'В общей библиотеке пока пусто'}
                  </p>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                    Опубликуй свой шаблон во вкладке «Мои» — он появится здесь у других атлетов.
                  </p>
                </div>
              ) : (
                filteredCommunity.map(shared => {
                  const already = sharedForSharedInfo(shared);
                  return (
                    <div
                      key={shared.id}
                      className="bg-[#111a24] border border-[#233446] hover:border-cyan-500/40 rounded-2xl p-3 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-slate-100 truncate">{shared.title}</h4>
                          <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                            <User className="w-3 h-3 text-cyan-400" />
                            <span className="truncate">
                              {shared.ownerName}
                              {shared.ownerUsername ? ` · @${shared.ownerUsername.replace(/^@/, '')}` : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono mt-1">
                            <span>{shared.template.exercises.length} упражнений</span>
                            <span>•</span>
                            <span>~{shared.template.estimatedDurationMinutes || 60} мин</span>
                            <span>•</span>
                            <span className="text-cyan-300">{shared.copies} забрали</span>
                          </div>
                        </div>
                        <span className="text-[9px] font-bold uppercase text-cyan-300 bg-cyan-950/70 px-1.5 py-0.5 rounded border border-cyan-500/30 shrink-0">
                          общий
                        </span>
                      </div>

                      <div className="bg-[#0b1016] p-2 rounded-xl border border-[#1a2533]">
                        <p className="text-[11px] text-slate-300 line-clamp-2">
                          {shared.template.exercises.map(e => `${e.name} (${e.targetSets}×${e.targetReps})`).join(', ')}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={importBusy(shared) || Boolean(already)}
                          onClick={() => handleImportPublic(shared)}
                          className="flex-1 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold text-[11px] flex items-center justify-center gap-1"
                        >
                          {importBusy(shared) ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : already ? (
                            <Check className="w-3 h-3" />
                          ) : (
                            <Download className="w-3 h-3" />
                          )}
                          <span>{already ? 'Уже в моих' : 'Забрать в мои'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const copied = await copyToClipboard(shared.link);
                            hapticNotify(copied ? 'success' : 'error');
                            setNotice(
                              copied
                                ? { kind: 'ok', text: 'Ссылка на шаблон скопирована.' }
                                : { kind: 'error', text: 'Не удалось скопировать ссылку' },
                            );
                          }}
                          className="p-1.5 rounded-lg bg-[#16212d] hover:bg-[#1f2d3d] border border-[#243447] text-slate-300"
                          title="Скопировать ссылку"
                        >
                          <Link2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-[#141f2c] border-t border-[#233345] flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400 font-mono">
            GetFit Workout Templates Engine
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
