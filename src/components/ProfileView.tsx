import React, { useState, useEffect } from 'react';
import { 
  User, 
  Scale, 
  Footprints, 
  Trophy, 
  Flame, 
  Target, 
  Award, 
  ShieldCheck, 
  Edit3, 
  Check, 
  Plus, 
  TrendingDown,
  TrendingUp,
  Activity,
  Dumbbell,
  CheckCircle2,
  Sparkles,
  Share2,
  Trash2,
  RefreshCw,
  History,
  Timer,
  Zap,
  ChevronDown,
  Download,
  Upload,
  Swords
} from 'lucide-react';
import { UserProfile, Achievement, InBodyRecord, PersonalRecord, RecordHistoryItem, FriendBattle } from '../types';
import { InBodyTracker } from './InBodyTracker';
import { FriendsAndBattlesView } from './FriendsAndBattlesView';

interface ProfileViewProps {
  user: UserProfile;
  achievements: Achievement[];
  personalRecords: PersonalRecord[];
  onUpdateUser: (updated: Partial<UserProfile>) => void;
  onAddPersonalRecord: (record: PersonalRecord) => void;
  onUpdatePersonalRecord: (recordId: string, newValue: string, notes?: string) => void;
  onShareRecordToCommunity: (record: PersonalRecord) => void;
  onResetAllData: () => void;
  onExportData?: () => void;
  onImportData?: (jsonStr: string) => { success: boolean; error?: string };
  battles?: FriendBattle[];
  onAddBattle?: (battle: FriendBattle) => void;
  onUpdateBattleProgress?: (battleId: string, amount: number) => void;
  onOpenAiSettings?: () => void;
}

const AVAILABLE_DISCIPLINES = [
  { id: 'powerlifting', label: 'Пауэрлифтинг (WRPF)', icon: '🏋️', desc: 'Жим, присед, становая тяга' },
  { id: 'streetlifting', label: 'Стритлифтинг (WSF)', icon: '⛓️', desc: 'Подтягивания и брусья с весом' },
  { id: 'bodybuilding', label: 'Бодибилдинг', icon: '💪', desc: 'Гипертрофия и пропорции' },
  { id: 'fitness', label: 'ОФП & Воркаут', icon: '🤸', desc: 'Турники, брусья, функционал' },
  { id: 'athletics', label: 'Легкая атлетика', icon: '🏃', desc: 'Бег 100м, 1000м, выносливость' },
  { id: 'swimming', label: 'Плавание', icon: '🏊', desc: 'Вольный стиль, дыхание' },
  { id: 'crossfit', label: 'Кроссфит & Комплексы', icon: '⏱️', desc: 'Высокоинтенсивные WOD и связки' },
  { id: 'combat', label: 'Единоборства', icon: '🥊', desc: 'Бокс, борьба, кондиции' },
];

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  achievements,
  personalRecords,
  onUpdateUser,
  onAddPersonalRecord,
  onUpdatePersonalRecord,
  onShareRecordToCommunity,
  onResetAllData,
  onExportData,
  onImportData,
  battles = [],
  onAddBattle = () => {},
  onUpdateBattleProgress = () => {},
  onOpenAiSettings,
}) => {
  const [profileTab, setProfileTab] = useState<'general' | 'friends_battles' | 'records' | 'disciplines' | 'inbody' | 'achievements'>('general');
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Edit Profile Modal
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [editTg, setEditTg] = useState(user?.telegramUsername || '');
  const [editCurrentWeight, setEditCurrentWeight] = useState(user?.currentWeight || 0);
  const [editTargetWeight, setEditTargetWeight] = useState(user?.targetWeight || 0);
  const [editGoalType, setEditGoalType] = useState<UserProfile['weightGoalType']>(user?.weightGoalType || 'maintain');
  const [editStepGoal, setEditStepGoal] = useState(user?.dailyStepGoal || 10000);
  const [editHeight, setEditHeight] = useState(user?.heightCm || 178);
  const [editAge, setEditAge] = useState(user?.age || 24);

  // Daily steps logger state (persisted per day)
  const [todaySteps, setTodaySteps] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`getfit_today_steps_${new Date().toISOString().split('T')[0]}`);
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  // Add Record Modal
  const [showAddRecordModal, setShowAddRecordModal] = useState(false);
  const [recordTitle, setRecordTitle] = useState('');
  const [recordCategory, setRecordCategory] = useState<PersonalRecord['category']>('strength');
  const [recordValue, setRecordValue] = useState('');
  const [recordNotes, setRecordNotes] = useState('');
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);

  // Smart Matching Dialog State
  const [matchingExistingRecord, setMatchingExistingRecord] = useState<PersonalRecord | null>(null);

  const selectedDisciplines = user?.selectedDisciplines || ['powerlifting', 'streetlifting'];

  const handleOpenEditProfile = () => {
    setEditName(user?.name || '');
    setEditTg(user?.telegramUsername || '');
    setEditCurrentWeight(user?.currentWeight || 0);
    setEditTargetWeight(user?.targetWeight || 0);
    setEditGoalType(user?.weightGoalType || 'maintain');
    setEditStepGoal(user?.dailyStepGoal || 10000);
    setEditHeight(user?.heightCm || 178);
    setEditAge(user?.age || 24);
    setShowEditProfileModal(true);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateUser({
      name: editName.trim(),
      telegramUsername: editTg.trim(),
      currentWeight: editCurrentWeight,
      targetWeight: editTargetWeight,
      weightGoalType: editGoalType,
      dailyStepGoal: editStepGoal,
      heightCm: editHeight,
      age: editAge,
    });
    setShowEditProfileModal(false);
  };

  const handleToggleDiscipline = (id: string) => {
    let updated: string[];
    if (selectedDisciplines.includes(id)) {
      if (selectedDisciplines.length <= 1) return;
      updated = selectedDisciplines.filter(d => d !== id);
    } else {
      updated = [...selectedDisciplines, id];
    }
    onUpdateUser({ selectedDisciplines: updated });
  };

  const handleAddInBodyRecord = (newRecord: InBodyRecord) => {
    const existing = user?.inBodyRecords || [];
    const updatedList = [newRecord, ...existing];
    onUpdateUser({
      inBodyRecords: updatedList,
      currentWeight: newRecord.weightKg,
    });
  };

  // Helper to normalize and match titles
  const findMatchingRecord = (title: string): PersonalRecord | undefined => {
    const clean = title.toLowerCase().trim();
    if (!clean) return undefined;

    return personalRecords.find(r => {
      const existing = r.title.toLowerCase().trim();
      if (existing === clean) return true;

      // Extract meaningful words
      const wordsNew = clean.split(/\s+/).filter(w => w.length > 2);
      const wordsExisting = existing.split(/\s+/).filter(w => w.length > 2);

      if (wordsNew.length === 0 || wordsExisting.length === 0) return false;

      // Exact match of word sets (e.g. "жим штанги лежа" vs "жим лежа")
      const matches = wordsNew.filter(w => wordsExisting.some(ew => ew.includes(w) || w.includes(ew)));
      return matches.length >= Math.min(wordsNew.length, wordsExisting.length) && Math.abs(wordsNew.length - wordsExisting.length) <= 1;
    });
  };

  const handleRecordFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordTitle.trim() || !recordValue.trim()) return;

    const matched = findMatchingRecord(recordTitle);
    if (matched) {
      setMatchingExistingRecord(matched);
      return;
    }

    // Otherwise create new record
    createNewRecordDirectly();
  };

  const createNewRecordDirectly = () => {
    const newRec: PersonalRecord = {
      id: `rec_${Date.now()}`,
      title: recordTitle.trim(),
      category: recordCategory,
      currentBest: recordValue.trim(),
      history: [
        {
          id: `hist_${Date.now()}`,
          date: new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }),
          value: recordValue.trim(),
          notes: recordNotes.trim() || undefined,
        },
      ],
      authorName: user?.name || 'Атлет',
      authorUsername: user?.telegramUsername || '@athlete',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onAddPersonalRecord(newRec);
    setShowAddRecordModal(false);
    setMatchingExistingRecord(null);
    setRecordTitle('');
    setRecordValue('');
    setRecordNotes('');
  };

  const confirmUpdateExistingRecord = () => {
    if (!matchingExistingRecord) return;
    onUpdatePersonalRecord(matchingExistingRecord.id, recordValue.trim(), recordNotes.trim() || undefined);
    setShowAddRecordModal(false);
    setMatchingExistingRecord(null);
    setRecordTitle('');
    setRecordValue('');
    setRecordNotes('');
  };

  const isGoalReached = user?.currentWeight > 0 && user?.currentWeight === user?.targetWeight;
  const weightDelta = user?.currentWeight > 0 && user?.targetWeight > 0
    ? Math.round(Math.abs(user.currentWeight - user.targetWeight) * 10) / 10
    : 0;

  const displayName = user?.name && user.name.trim().length > 0 ? user.name : 'Атлет';
  const displayTg = user?.telegramUsername && user.telegramUsername.trim().length > 0 ? user.telegramUsername : '@username';

  return (
    <div className="space-y-4 pb-24">
      {/* Profile Header Card */}
      <div className="bg-gradient-to-br from-[#121c27] via-[#0d141c] to-[#12181f] border border-[#233345] rounded-2xl p-4 shadow-lg shadow-black/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-800 flex items-center justify-center text-xl font-extrabold text-slate-950 shadow-md border border-emerald-400/40">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">{displayName}</h2>
              <div className="text-xs text-emerald-400 font-mono">{displayTg}</div>
              <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2 font-mono">
                <span>{user?.streakDays || 0} дн. стрик</span>
                <span>•</span>
                <span className="text-emerald-400">{user?.disciplineScore || 100}% дисц.</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleOpenEditProfile}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#18232f] hover:bg-[#233140] text-emerald-400 text-xs font-bold border border-[#273748] transition-all active:scale-95"
            title="Редактировать профиль"
          >
            <Edit3 className="w-4 h-4" />
            <span>Редактировать</span>
          </button>
        </div>

        {/* Selected Target Rank Goal */}
        {user?.targetRankTitle && (
          <div className="mt-3 pt-3 border-t border-[#1e2a38] flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-slate-300">
              <Target className="w-3.5 h-3.5 text-emerald-400" />
              <span>Главный норматив:</span>
            </div>
            <span className="font-bold font-mono text-emerald-400">
              {user.targetRankTitle}
            </span>
          </div>
        )}
      </div>

      {/* Sub-Navigation Tabs inside Profile */}
      <div className="flex bg-[#0f141a] p-1 rounded-xl border border-[#1d2734] gap-1 text-[11px] overflow-x-auto">
        <button
          onClick={() => setProfileTab('general')}
          className={`flex-1 py-2 px-2.5 rounded-lg font-semibold transition-all whitespace-nowrap flex items-center justify-center gap-1 ${
            profileTab === 'general'
              ? 'bg-emerald-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <User className="w-3 h-3" />
          <span>Параметры</span>
        </button>

        <button
          onClick={() => setProfileTab('friends_battles')}
          className={`flex-1 py-2 px-2.5 rounded-lg font-semibold transition-all whitespace-nowrap flex items-center justify-center gap-1 ${
            profileTab === 'friends_battles'
              ? 'bg-emerald-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Swords className="w-3 h-3" />
          <span>Друзья & Зарубы</span>
        </button>

        <button
          onClick={() => setProfileTab('records')}
          className={`flex-1 py-2 px-2.5 rounded-lg font-semibold transition-all whitespace-nowrap flex items-center justify-center gap-1 ${
            profileTab === 'records'
              ? 'bg-emerald-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Trophy className="w-3 h-3" />
          <span>Рекорды ({personalRecords.length})</span>
        </button>

        <button
          onClick={() => setProfileTab('disciplines')}
          className={`flex-1 py-2 px-2.5 rounded-lg font-semibold transition-all whitespace-nowrap flex items-center justify-center gap-1 ${
            profileTab === 'disciplines'
              ? 'bg-emerald-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Dumbbell className="w-3 h-3" />
          <span>Спорт ({selectedDisciplines.length})</span>
        </button>

        <button
          onClick={() => setProfileTab('inbody')}
          className={`flex-1 py-2 px-2.5 rounded-lg font-semibold transition-all whitespace-nowrap flex items-center justify-center gap-1 ${
            profileTab === 'inbody'
              ? 'bg-emerald-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-3 h-3" />
          <span>InBody</span>
        </button>

        <button
          onClick={() => setProfileTab('achievements')}
          className={`flex-1 py-2 px-2.5 rounded-lg font-semibold transition-all whitespace-nowrap flex items-center justify-center gap-1 ${
            profileTab === 'achievements'
              ? 'bg-emerald-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Award className="w-3 h-3" />
          <span>Награды</span>
        </button>
      </div>

      {/* TAB 1: General Goals & Steps */}
      {profileTab === 'general' && (
        <div className="space-y-4">
          {/* Body Mass & Weight Goal Section */}
          <div className="bg-[#12181f] border border-[#1e293b] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-slate-200">Цель по массе тела</h3>
              </div>
              <button
                onClick={handleOpenEditProfile}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold"
              >
                Изменить
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-xl font-bold font-mono text-slate-100">
                    {user?.currentWeight > 0 ? `${user.currentWeight} кг` : 'Не указан'}
                  </span>
                  <span className="text-slate-400">текущий</span>
                </div>

                <div className="text-right">
                  <span className="text-xs text-slate-400">Цель: </span>
                  <span className="text-sm font-bold font-mono text-emerald-400">
                    {user?.targetWeight > 0 ? `${user.targetWeight} кг` : 'Не задана'}
                  </span>
                </div>
              </div>

              <div className="bg-[#0b1016] p-2.5 rounded-xl border border-[#1b2533] flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  {user?.weightGoalType === 'lose' ? (
                    <TrendingDown className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                  )}
                  <span className="text-slate-300">
                    {user?.weightGoalType === 'lose'
                      ? 'Снижение жировой прослойки / Сушка'
                      : user?.weightGoalType === 'gain'
                      ? 'Набор мышечной массы'
                      : user?.weightGoalType === 'recomp'
                      ? 'Рекомпозиция тела'
                      : 'Поддержание текущей формы'}
                  </span>
                </div>
                <span className="font-mono font-bold text-emerald-400">
                  {isGoalReached ? 'Цель достигнута!' : weightDelta > 0 ? `Дельта: ${weightDelta} кг` : 'В графике'}
                </span>
              </div>
            </div>
          </div>

          {/* Daily Steps Normative Section */}
          <div className="bg-[#12181f] border border-[#1e293b] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Footprints className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-slate-200">Норматив шагов за сегодня</h3>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-400">
                {todaySteps.toLocaleString('ru-RU')} / {user?.dailyStepGoal && user.dailyStepGoal > 0 ? `${user.dailyStepGoal.toLocaleString('ru-RU')} ш.` : 'Без цели'}
              </span>
            </div>

            {user?.dailyStepGoal && user.dailyStepGoal > 0 ? (
              <>
                <div className="w-full bg-[#18232f] h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, (todaySteps / user.dailyStepGoal) * 100)}%` }}
                  />
                </div>
                <div className="text-[11px] text-slate-400">
                  Выполнено {Math.round((todaySteps / user.dailyStepGoal) * 100)}% дневной нормы
                </div>
              </>
            ) : (
              <div className="text-[11px] text-slate-400 bg-[#151e28] p-2 rounded-xl border border-[#1e2c3c]">
                Свободный режим: норматив шагов не установлен. Вы можете фиксировать шаги вручную ниже.
              </div>
            )}

            <div className="pt-2 flex items-center justify-between gap-2 border-t border-[#1b2532]">
              <span className="text-[11px] text-slate-400">
                Пройдено за сегодня (ввести вручную):
              </span>

              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={todaySteps || ''}
                  onChange={e => {
                    const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                    setTodaySteps(val);
                    try {
                      localStorage.setItem(`getfit_today_steps_${new Date().toISOString().split('T')[0]}`, val.toString());
                    } catch {}
                  }}
                  placeholder="0"
                  className="w-28 bg-[#18232f] border border-[#263546] rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-100 text-center focus:outline-none focus:border-emerald-500"
                />
                <span className="absolute right-2.5 top-2 text-[10px] text-slate-500 font-mono pointer-events-none">
                  ш.
                </span>
              </div>
            </div>
          </div>

          {/* AI Intelligence & Personal Prompt Card */}
          <div className="bg-gradient-to-br from-[#101b24] via-[#0e1720] to-[#131d27] border border-cyan-500/40 rounded-2xl p-4 space-y-3 shadow-lg shadow-cyan-950/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                    <span>Интеллект & Личный промт ИИ</span>
                    <span className="text-[9px] bg-cyan-950 text-cyan-400 font-mono px-1.5 py-0.5 rounded border border-cyan-500/30">
                      Dual Engine
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Персональные наставления, ограничения, травмы и спортпит
                  </p>
                </div>
              </div>

              {onOpenAiSettings && (
                <button
                  type="button"
                  onClick={onOpenAiSettings}
                  className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/20 transition-all active:scale-95 flex items-center gap-1"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Настроить</span>
                </button>
              )}
            </div>

            <div className="space-y-2 text-xs">
              <div className="bg-[#0b1016] p-2.5 rounded-xl border border-[#1b2533] space-y-1">
                <div className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider">
                  Личный промт для ИИ:
                </div>
                <p className="text-slate-300 italic text-[11px] line-clamp-2">
                  {user?.aiPersonalPrompt?.trim() 
                    ? `«${user.aiPersonalPrompt}»`
                    : 'Не задан (по умолчанию: доказательный пауэрлифтинг, шкала RPE и периодизация)'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-[#0b1016] p-2 rounded-xl border border-[#1b2533]">
                  <span className="text-slate-400 block text-[10px]">Травмы и боли:</span>
                  <span className="text-slate-200 font-semibold truncate block">
                    {user?.injuriesAndLimitations?.trim() || 'Без ограничений'}
                  </span>
                </div>

                <div className="bg-[#0b1016] p-2 rounded-xl border border-[#1b2533]">
                  <span className="text-slate-400 block text-[10px]">Спортпит & БАДы:</span>
                  <span className="text-slate-200 font-semibold truncate block">
                    {user?.activeSupplements?.trim() || 'Не указаны'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono px-1">
                <span>Движок: Gemini 2.5 Flash</span>
                <span className="text-emerald-400 font-bold">⚡ Grok 2 / Groq Llama-3.3 Fallback</span>
              </div>
            </div>
          </div>

          {/* Simple Reset Action */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Сбросить все данные приложения?')) {
                  onResetAllData();
                }
              }}
              className="w-full py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Сбросить всё</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB: Friends & Battles (from Screenshot 3) */}
      {profileTab === 'friends_battles' && (
        <FriendsAndBattlesView
          user={user}
          onUpdateUser={onUpdateUser}
          battles={battles}
          onAddBattle={onAddBattle}
          onUpdateBattleProgress={onUpdateBattleProgress}
        />
      )}

      {/* TAB 2: Personal Records & Complexes */}
      {profileTab === 'records' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-[#121c27] to-[#0d141d] border border-emerald-500/40 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-emerald-400" />
                  <span>Личные рекорды и Комплексы</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Фиксируй максимумы: жим, брусья, бег 5км, заезд на велосипеде, кроссфит-комплексы (100 отжиманий + 50 подтягиваний на время).
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowAddRecordModal(true)}
              className="mt-2 w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Добавить личный рекорд / комплекс</span>
            </button>
          </div>

          {/* Records List */}
          {personalRecords.length === 0 ? (
            <div className="bg-[#12181f] border border-[#1e293b] rounded-2xl p-6 text-center space-y-2">
              <Trophy className="w-8 h-8 text-slate-500 mx-auto" />
              <p className="text-xs font-semibold text-slate-300">Пока нет зафиксированных рекордов</p>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                Внесите свой первый рекорд через кнопку выше или просто напишите в чат ИИ: «запиши рекорд: жим 120 на 3» или «забег 5км за 24:10»!
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {personalRecords.map(rec => {
                const isExpanded = expandedRecordId === rec.id;
                return (
                  <div
                    key={rec.id}
                    className="bg-[#12181f] border border-[#1e293b] rounded-2xl overflow-hidden transition-all"
                  >
                    <div className="p-3.5 flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] uppercase font-mono font-bold px-1.5 py-0.5 rounded border ${
                            rec.category === 'strength'
                              ? 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                              : rec.category === 'cardio'
                              ? 'bg-blue-950/60 border-blue-500/40 text-blue-300'
                              : rec.category === 'complex'
                              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                              : 'bg-purple-950/60 border-purple-500/40 text-purple-300'
                          }`}>
                            {rec.category === 'strength' ? 'Сила' : rec.category === 'cardio' ? 'Кардио' : rec.category === 'complex' ? 'Комплекс / WOD' : 'Разное'}
                          </span>
                          <span className="text-xs font-bold text-slate-100">{rec.title}</span>
                        </div>

                        <div className="flex items-baseline gap-2">
                          <span className="text-base font-black font-mono text-emerald-400">
                            {rec.currentBest}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            (побит: {rec.history[0]?.date || 'сегодня'})
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onShareRecordToCommunity(rec)}
                          className="p-2 rounded-xl bg-[#18232f] hover:bg-[#223140] text-emerald-400 border border-[#273748] transition-colors"
                          title="Поделиться в комьюнити атлетов"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => setExpandedRecordId(isExpanded ? null : rec.id)}
                          className="p-2 rounded-xl bg-[#18232f] hover:bg-[#223140] text-slate-400 transition-colors"
                          title="История рекорда"
                        >
                          <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                    </div>

                    {/* Expandable History Drawer */}
                    {isExpanded && (
                      <div className="px-3.5 pb-3.5 pt-1 border-t border-[#1b2532] bg-[#0b1016] space-y-2 text-xs">
                        <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          <History className="w-3.5 h-3.5 text-emerald-400" />
                          <span>История побития рекорда:</span>
                        </div>

                        <div className="space-y-1.5">
                          {rec.history.map((h, i) => (
                            <div
                              key={h.id || i}
                              className="bg-[#121921] p-2 rounded-xl border border-[#1d2734] flex items-center justify-between text-xs font-mono"
                            >
                              <div>
                                <span className="font-bold text-slate-200">{h.value}</span>
                                {h.notes && <span className="text-[10px] text-slate-400 ml-2 font-sans font-normal">({h.notes})</span>}
                              </div>
                              <span className="text-[10px] text-slate-400">{h.date}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Sports Disciplines Specialization */}
      {profileTab === 'disciplines' && (
        <div className="space-y-4">
          <div className="bg-[#12181f] border border-[#1e293b] rounded-2xl p-4 space-y-3">
            <div>
              <h3 className="text-xs font-bold text-slate-100 flex items-center gap-2">
                <Dumbbell className="w-4 h-4 text-emerald-400" />
                <span>Направления тренировок</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Отметьте виды спорта, которыми вы занимаетесь. Приложение адаптирует нормативы (WRPF, WSF, ЕВСК), разряды и планы тренировок под вашу специфику.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {AVAILABLE_DISCIPLINES.map(disc => {
                const isSelected = selectedDisciplines.includes(disc.id);
                return (
                  <button
                    key={disc.id}
                    type="button"
                    onClick={() => handleToggleDiscipline(disc.id)}
                    className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-gradient-to-r from-emerald-950/40 via-[#131d27] to-[#12181f] border-emerald-500/50 shadow-sm shadow-emerald-950/40'
                        : 'bg-[#0f151c] border-[#1e293b] opacity-60 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{disc.icon}</span>
                      <div>
                        <div className="text-xs font-bold text-slate-100">{disc.label}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{disc.desc}</div>
                      </div>
                    </div>

                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                        isSelected
                          ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                          : 'border-slate-600 bg-[#16212d]'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: InBody Biometrics Tracker */}
      {profileTab === 'inbody' && (
        <InBodyTracker
          records={user?.inBodyRecords || []}
          user={user}
          onAddRecord={handleAddInBodyRecord}
        />
      )}

      {/* TAB 5: Achievements (Clean Slate) */}
      {profileTab === 'achievements' && (
        <div className="space-y-4">
          <div className="bg-[#12181f] border border-[#1e293b] rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold text-slate-100">Достижения и трофеи атлета</h3>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Здесь фиксируются персональные вехи, покорение спортивных разрядов и выполнение тренировочных марафонов без искусственных шаблонов.
            </p>
          </div>

          {achievements.length === 0 ? (
            <div className="bg-[#12181f] border border-[#1e293b] rounded-2xl p-6 text-center space-y-2">
              <Award className="w-8 h-8 text-slate-500 mx-auto" />
              <p className="text-xs font-semibold text-slate-300">Вкладка готова к вашим реальным достижениям</p>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                Выполняйте тренировки, бейте личные рекорды и выполняйте нормативы разрядов — награды будут начисляться за реальный прогресс!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {achievements.map(ach => (
                <div
                  key={ach.id}
                  className="p-3 rounded-xl border bg-[#0f151c] border-[#1a2430] text-xs flex items-start gap-3"
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-100">{ach.title}</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">{ach.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: Full Profile Edit */}
      {showEditProfileModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#12181f] border border-[#253342] rounded-2xl p-4 max-w-sm w-full space-y-4 my-8">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-emerald-400" />
                <span>Редактирование профиля</span>
              </h3>
              <button
                onClick={() => setShowEditProfileModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  Ваше имя:
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="Иван, Евгений..."
                  required
                  className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  Telegram Username (@...):
                </label>
                <input
                  type="text"
                  value={editTg}
                  onChange={e => setEditTg(e.target.value)}
                  placeholder="@username"
                  className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                    Текущий вес (кг):
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={editCurrentWeight || ''}
                    onChange={e => setEditCurrentWeight(parseFloat(e.target.value) || 0)}
                    placeholder="75.0"
                    className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                    Целевой вес (кг):
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={editTargetWeight || ''}
                    onChange={e => setEditTargetWeight(parseFloat(e.target.value) || 0)}
                    placeholder="80.0"
                    className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  Цель по форме:
                </label>
                <select
                  value={editGoalType}
                  onChange={e => setEditGoalType(e.target.value as any)}
                  className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="lose">Сушка / Похудение (дефицит)</option>
                  <option value="gain">Набор массы (профицит)</option>
                  <option value="recomp">Рекомпозиция (рост мышц при сжигании жира)</option>
                  <option value="maintain">Поддержание формы</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                    Рост (см):
                  </label>
                  <input
                    type="number"
                    value={editHeight || ''}
                    onChange={e => setEditHeight(parseInt(e.target.value, 10) || 0)}
                    placeholder="180"
                    className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                    Возраст:
                  </label>
                  <input
                    type="number"
                    value={editAge || ''}
                    onChange={e => setEditAge(parseInt(e.target.value, 10) || 0)}
                    placeholder="25"
                    className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] text-slate-400 uppercase font-bold">
                    Норматив шагов в день:
                  </label>
                  <button
                    type="button"
                    onClick={() => setEditStepGoal(editStepGoal === 0 ? 10000 : 0)}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition-all ${
                      editStepGoal === 0
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-[#18232f] text-slate-400 border-[#263546] hover:text-slate-200'
                    }`}
                  >
                    {editStepGoal === 0 ? '🚫 Без цели (нажмите чтобы задать)' : '🚫 Не ставить цель'}
                  </button>
                </div>
                {editStepGoal > 0 ? (
                  <div className="relative">
                    <input
                      type="number"
                      step="500"
                      min="500"
                      value={editStepGoal || ''}
                      onChange={e => setEditStepGoal(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      placeholder="Например: 10000"
                      className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-slate-100 font-mono text-xs focus:outline-none focus:border-emerald-500"
                    />
                    <span className="absolute right-3 top-2.5 text-[10px] text-slate-500 font-mono pointer-events-none">
                      шагов
                    </span>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-[#101720] border border-amber-500/30 text-[11px] text-amber-300/90 flex items-center justify-between">
                    <span>Цель отключена (свободный режим)</span>
                    <button
                      type="button"
                      onClick={() => setEditStepGoal(10000)}
                      className="text-emerald-400 hover:text-emerald-300 font-bold"
                    >
                      Задать 10 000
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditProfileModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-[#1a2430] text-slate-300 font-semibold"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold"
                >
                  Сохранить
                </button>
              </div>
            </form>

            {/* Reset Button */}
            <div className="pt-2 border-t border-[#1b2532]">
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Сбросить все данные приложения?')) {
                    onResetAllData();
                    setShowEditProfileModal(false);
                  }
                }}
                className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Сбросить всё</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Add Personal Record / Complex */}
      {showAddRecordModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#12181f] border border-[#253342] rounded-2xl p-4 max-w-sm w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-emerald-400" />
                <span>Новый личный рекорд / комплекс</span>
              </h3>
              <button
                onClick={() => {
                  setShowAddRecordModal(false);
                  setMatchingExistingRecord(null);
                }}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Smart Matching Confirmation Prompt */}
            {matchingExistingRecord ? (
              <div className="bg-[#0b1016] border border-amber-500/40 rounded-xl p-3 space-y-2.5 text-xs">
                <div className="flex items-center gap-2 text-amber-400 font-bold">
                  <Zap className="w-4 h-4" />
                  <span>Найден похожий рекорд!</span>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  У вас уже сохранен рекорд <strong className="text-emerald-400">«{matchingExistingRecord.title}»</strong> с текущим результатом <strong className="text-slate-100">{matchingExistingRecord.currentBest}</strong>.
                </p>
                <p className="text-slate-400 text-[11px]">
                  Вы хотите обновить этот рекорд новым значением <strong className="text-emerald-300">{recordValue}</strong> (старый результат сохранится в истории) или создать отдельный новый комплекс?
                </p>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={confirmUpdateExistingRecord}
                    className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs"
                  >
                    Обновить «{matchingExistingRecord.title}»
                  </button>
                  <button
                    type="button"
                    onClick={createNewRecordDirectly}
                    className="flex-1 py-2 bg-[#1b2532] text-slate-200 hover:bg-[#253342] font-semibold rounded-xl text-xs"
                  >
                    Создать новый
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRecordFormSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                    Название упражнения или комплекса:
                  </label>
                  <input
                    type="text"
                    value={recordTitle}
                    onChange={e => setRecordTitle(e.target.value)}
                    placeholder="Жим штанги лежа, 5км забег, 100 отжиманий + 50 подтягиваний..."
                    required
                    className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                    Категория:
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: 'strength', label: 'Силовой (1ПМ / вес)' },
                      { id: 'cardio', label: 'Кардио (бег, плавание)' },
                      { id: 'complex', label: 'Комплекс / WOD' },
                      { id: 'other', label: 'Произвольный тест' },
                    ].map(cat => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setRecordCategory(cat.id as any)}
                        className={`p-2 rounded-xl text-center font-semibold transition-all ${
                          recordCategory === cat.id
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-[#18232f] text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                    Текущий лучший результат:
                  </label>
                  <input
                    type="text"
                    value={recordValue}
                    onChange={e => setRecordValue(e.target.value)}
                    placeholder="120 кг × 3, 24:10 мин, 150 повторений..."
                    required
                    className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                    Заметка (опционально):
                  </label>
                  <input
                    type="text"
                    value={recordNotes}
                    onChange={e => setRecordNotes(e.target.value)}
                    placeholder="Без экипировки, чистая техника, на стадионе..."
                    className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddRecordModal(false)}
                    className="flex-1 py-2.5 rounded-xl bg-[#1a2430] text-slate-300 font-semibold"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold"
                  >
                    Зафиксировать рекорд
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
