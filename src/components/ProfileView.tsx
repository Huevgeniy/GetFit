import React, { useState, useEffect, useRef } from 'react';
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
  Swords,
  Bell,
  BellOff,
  Send,
  Table,
  Settings,
  RotateCcw,
  Layers
} from 'lucide-react';
import { UserProfile, Achievement, InBodyRecord, PersonalRecord, RecordHistoryItem, FriendBattle, AiProvidersInfo } from '../types';
import { InBodyTracker } from './InBodyTracker';
import { FriendsAndBattlesView } from './FriendsAndBattlesView';
import { hapticImpact, hapticNotify } from '../lib/telegram';
import { exportDiaryCsv, testNotification } from '../lib/api';
import { FEATURES, FeatureKey, getFeatureFlags, isAdvancedMode } from '../lib/features';
import { TourId } from '../lib/tours';
import { localDayKey } from '../lib/steps';

interface ProfileViewProps {
  user: UserProfile;
  achievements: Achievement[];
  personalRecords: PersonalRecord[];
  onUpdateUser: (updated: Partial<UserProfile>) => void;
  onAddPersonalRecord: (record: PersonalRecord) => void;
  onUpdatePersonalRecord: (recordId: string, newValue: string, notes?: string) => void;
  onShareRecordToCommunity: (record: PersonalRecord) => void;
  onResetAllData: () => void;
  onExportData?: () => Promise<{ ok: boolean; size?: number; text?: string; error?: string }> | void;
  onImportData?: (jsonStr: string) => { success: boolean; error?: string };
  battles?: FriendBattle[];
  onAddBattle?: (battle: FriendBattle) => void;
  onUpdateBattleProgress?: (battleId: string, amount: number) => void;
  onOpenAiSettings?: () => void;
  /** Текущий тур: нужен, чтобы показать «идёт сейчас» и не запускать два сразу. */
  activeTour?: TourId | null;
  /** Пройден ли основной тур и туры дополнительных разделов. */
  tourStatus?: Record<TourId, boolean>;
  onReplayTour?: (tourId: TourId) => void;
  onResetTours?: () => void;
  /** Состояние облака: показываем честно, а не только «синхронизировано». */
  syncStatus?: 'idle' | 'syncing' | 'synced' | 'offline' | 'local';
  storageMode?: 'postgres' | 'file' | 'unavailable' | null;
  /** Реально подключённые на сервере провайдеры ИИ. */
  aiProviders?: AiProvidersInfo | null;
}

const AVAILABLE_DISCIPLINES = [
  { id: 'powerlifting', label: 'Пауэрлифтинг (WRPF)', icon: '🏋️', desc: 'Жим, присед, становая тяга' },
  { id: 'streetlifting', label: 'Стритлифтинг (WSF)', icon: '⛓️', desc: 'Подтягивания и брусья с весом' },
  { id: 'bodybuilding', label: 'Бодибилдинг', icon: '💪', desc: 'Рост мышц и пропорции' },
  { id: 'fitness', label: 'Общая форма и уличные тренировки', icon: '🤸', desc: 'Турники, брусья, функционал' },
  { id: 'athletics', label: 'Легкая атлетика', icon: '🏃', desc: 'Бег 100 м, 1000 м, выносливость' },
  { id: 'swimming', label: 'Плавание', icon: '🏊', desc: 'Вольный стиль, дыхание' },
  { id: 'crossfit', label: 'Кроссфит и комплексы', icon: '⏱️', desc: 'Интенсивные комплексы и связки' },
  { id: 'combat', label: 'Единоборства', icon: '🥊', desc: 'Бокс, борьба, общая форма' },
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
  activeTour,
  tourStatus,
  onReplayTour,
  onResetTours,
  syncStatus = 'idle',
  storageMode = null,
  aiProviders,
}) => {
  const [profileTab, setProfileTab] = useState<'general' | 'friends_battles' | 'records' | 'disciplines' | 'inbody' | 'achievements'>('general');
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Базовый режим: четыре вкладки. Дополнительные разделы включает пользователь.
  const advancedMode = isAdvancedMode(user);
  const features = getFeatureFlags(user);
  const canUseBattles = advancedMode && features.battles;
  const canUseAchievements = advancedMode && features.discipline;

  useEffect(() => {
    if (profileTab === 'friends_battles' && !canUseBattles) setProfileTab('general');
    if (profileTab === 'achievements' && !canUseAchievements) setProfileTab('general');
  }, [profileTab, canUseBattles, canUseAchievements]);

  const handleToggleAdvanced = () => {
    hapticImpact('light');
    if (advancedMode) {
      onUpdateUser({ uiMode: 'basic' });
      return;
    }
    // При включении расширенного режима разделы остаются выключенными:
    // пользователь сам решает, что ему нужно.
    onUpdateUser({ uiMode: 'advanced', enabledFeatures: { ...(user.enabledFeatures || {}) } });
  };

  const handleToggleFeature = (key: FeatureKey) => {
    if (!advancedMode) return;
    hapticImpact('light');
    onUpdateUser({ enabledFeatures: { ...features, [key]: !features[key] } });
  };

  const handleEnableAllFeatures = () => {
    if (!advancedMode) return;
    hapticImpact('light');
    onUpdateUser({
      enabledFeatures: FEATURES.reduce((acc, feature) => {
        acc[feature.key] = true;
        return acc;
      }, {} as Record<FeatureKey, boolean>),
    });
  };

  const handleResetFeatures = () => {
    if (!advancedMode) return;
    hapticImpact('light');
    onUpdateUser({
      enabledFeatures: FEATURES.reduce((acc, feature) => {
        acc[feature.key] = false;
        return acc;
      }, {} as Record<FeatureKey, boolean>),
    });
  };

  // Напоминания: по умолчанию включены (undefined считаем включённым)
  const notificationsOn = user?.notificationsEnabled !== false;
  const [notifyTest, setNotifyTest] = useState<{ status: 'idle' | 'sending' | 'ok' | 'error'; message?: string }>({
    status: 'idle',
  });

  const handleTestNotification = async () => {
    setNotifyTest({ status: 'sending' });
    hapticImpact('light');
    const result = await testNotification();
    if (result.delivered) {
      hapticNotify('success');
      setNotifyTest({ status: 'ok' });
    } else {
      hapticNotify('error');
      setNotifyTest({ status: 'error', message: result.error || 'Не удалось отправить сообщение' });
    }
  };

  // Резервная копия: экспорт в буфер, восстановление из вставленного текста
  const [backupState, setBackupState] = useState<{ status: 'idle' | 'busy' | 'ok' | 'error'; message?: string }>({
    status: 'idle',
  });
  const [showImportArea, setShowImportArea] = useState(false);
  const [importText, setImportText] = useState('');

  // Выгрузка дневника в CSV через бота (файл открывается в Google Sheets и Excel)
  const [exportState, setExportState] = useState<{ status: 'idle' | 'busy' | 'ok' | 'error'; message?: string }>({
    status: 'idle',
  });

  const handleExportCsv = async () => {
    setExportState({ status: 'busy' });
    hapticImpact('light');
    const result = await exportDiaryCsv();
    if (result.sent) {
      hapticNotify('success');
      setExportState({ status: 'ok' });
    } else {
      hapticNotify('error');
      setExportState({ status: 'error', message: result.error || 'Не удалось отправить файл' });
    }
  };

  const handleExportClick = async () => {
    if (!onExportData) return;
    setBackupState({ status: 'busy' });
    hapticImpact('light');
    const raw = await onExportData();
    const result = (raw ?? null) as { ok: boolean; size?: number; error?: string } | null;
    if (result?.ok) {
      hapticNotify('success');
      setBackupState({
        status: 'ok',
        message: `Копия скопирована в буфер (${Math.round((result.size || 0) / 1024)} КБ). Сохраните её в заметках.`,
      });
    } else {
      hapticNotify('error');
      setBackupState({ status: 'error', message: result?.error || 'Не удалось создать копию' });
    }
  };

  const handleImportClick = () => {
    if (!onImportData || !importText.trim()) return;
    const result = onImportData(importText.trim());
    if (result.success) {
      hapticNotify('success');
      setBackupState({ status: 'ok', message: 'Данные восстановлены из копии.' });
      setImportText('');
      setShowImportArea(false);
    } else {
      hapticNotify('error');
      setBackupState({ status: 'error', message: result.error || 'Не удалось восстановить данные' });
    }
  };

  /** Скачивание файла: в браузере и Telegram Desktop работает надёжнее буфера. */
  const handleDownloadBackup = async () => {
    if (!onExportData) return;
    setBackupState({ status: 'busy' });
    hapticImpact('light');
    const result = await onExportData();
    const backupText = result && 'text' in result ? result.text : undefined;
    if (!backupText) {
      hapticNotify('error');
      const errorText = result && 'error' in result ? result.error : undefined;
      setBackupState({ status: 'error', message: errorText || 'Не удалось создать копию' });
      return;
    }
    try {
      const blob = new Blob([backupText], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `getfit-backup-${localDayKey()}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      hapticNotify('success');
      setBackupState({ status: 'ok', message: 'Файл резервной копии скачан.' });
    } catch {
      hapticNotify('error');
      setBackupState({ status: 'error', message: 'Браузер не разрешил скачивание — скопируйте текст вручную' });
    }
  };

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !onImportData) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = onImportData(String(reader.result || ''));
      if (result.success) {
        hapticNotify('success');
        setBackupState({ status: 'ok', message: `Данные восстановлены из файла «${file.name}».` });
      } else {
        hapticNotify('error');
        setBackupState({ status: 'error', message: result.error || 'Не удалось прочитать файл' });
      }
    };
    reader.onerror = () => {
      hapticNotify('error');
      setBackupState({ status: 'error', message: 'Не удалось открыть файл' });
    };
    reader.readAsText(file);
    event.target.value = '';
  };

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
  const [editGender, setEditGender] = useState<'male' | 'female'>(user?.gender || 'male');
  const [editActivity, setEditActivity] = useState<NonNullable<UserProfile['activityLevel']>>(
    user?.activityLevel || 'moderate',
  );
  const [editCalories, setEditCalories] = useState(user?.customCalorieTarget || 0);
  const [editProtein, setEditProtein] = useState(user?.customProteinTarget || 0);
  const [editFat, setEditFat] = useState(user?.customFatTarget || 0);
  const [editCarbs, setEditCarbs] = useState(user?.customCarbsTarget || 0);
  const [editFiber, setEditFiber] = useState(user?.customFiberTarget || 0);
  const backupFileRef = useRef<HTMLInputElement | null>(null);

  // Шаги за сегодня берём из профиля: они синхронизируются между устройствами.
  const stepLog = user?.dailySteps || {};
  const todayKey = localDayKey();
  const todaySteps = stepLog[todayKey] || 0;

  const handleTodayStepsChange = (raw: string) => {
    const val = Math.max(0, parseInt(raw, 10) || 0);
    const next = { ...stepLog };
    if (val > 0) next[todayKey] = val;
    else delete next[todayKey];
    onUpdateUser({ dailySteps: next });
  };

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

  const aiPrimary = !aiProviders
    ? 'проверяем подключение…'
    : aiProviders.groq || aiProviders.gemini
      ? 'ИИ-тренер подключён'
      : 'встроенный разбор';
  const aiFallback = !aiProviders
    ? ''
    : aiProviders.groq && aiProviders.gemini
      ? 'резерв подключён'
      : aiProviders.groq || aiProviders.gemini
        ? 'работает'
        : 'без внешнего ИИ';

  const handleOpenEditProfile = () => {
    setEditName(user?.name || '');
    setEditTg(user?.telegramUsername || '');
    setEditCurrentWeight(user?.currentWeight || 0);
    setEditTargetWeight(user?.targetWeight || 0);
    setEditGoalType(user?.weightGoalType || 'maintain');
    setEditStepGoal(user?.dailyStepGoal ?? 10000);
    setEditHeight(user?.heightCm || 178);
    setEditAge(user?.age || 24);
    setEditGender(user?.gender || 'male');
    setEditActivity(user?.activityLevel || 'moderate');
    setEditCalories(user?.customCalorieTarget || 0);
    setEditProtein(user?.customProteinTarget || 0);
    setEditFat(user?.customFatTarget || 0);
    setEditCarbs(user?.customCarbsTarget || 0);
    setEditFiber(user?.customFiberTarget || 0);
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
      gender: editGender,
      activityLevel: editActivity,
      customCalorieTarget: editCalories > 0 ? editCalories : undefined,
      customProteinTarget: editProtein > 0 ? editProtein : undefined,
      customFatTarget: editFat > 0 ? editFat : undefined,
      customCarbsTarget: editCarbs > 0 ? editCarbs : undefined,
      customFiberTarget: editFiber > 0 ? editFiber : undefined,
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

  // Индекс массы тела: понятный ориентир рядом с весом и целью.
  const heightMeters = (user?.heightCm || 0) / 100;
  const bmi =
    heightMeters > 0 && (user?.currentWeight || 0) > 0
      ? Math.round(((user.currentWeight || 0) / (heightMeters * heightMeters)) * 10) / 10
      : 0;
  const bmiCategory =
    bmi <= 0
      ? 'Укажите рост и вес'
      : bmi < 18.5
        ? 'Ниже нормы'
        : bmi < 25
          ? 'Норма'
          : bmi < 30
            ? 'Выше нормы'
            : 'Высокий';
  const bmiTone =
    bmi <= 0
      ? 'text-slate-400'
      : bmi >= 18.5 && bmi < 25
        ? 'text-emerald-400'
        : bmi < 18.5 || bmi < 30
          ? 'text-amber-400'
          : 'text-rose-400';

  const tourItems: Array<{ id: TourId; label: string; enabled: boolean }> = [
    { id: 'main', label: 'Основной тур', enabled: true },
    { id: 'marathons', label: 'Марафоны целей', enabled: Boolean(features.marathons) },
    { id: 'discipline', label: 'Дисциплина', enabled: Boolean(features.discipline) },
    { id: 'ranks', label: 'Спортивные разряды', enabled: Boolean(features.ranks) },
    { id: 'lab', label: 'Лаборатория', enabled: Boolean(features.lab) },
    { id: 'periodization', label: 'Циклы тренировок', enabled: Boolean(features.periodization) },
    { id: 'body', label: 'Тело и биомеханика', enabled: Boolean(features.body) },
  ];
  const visibleTourItems = tourItems.filter(item => item.enabled);

  const syncInfo =
    storageMode === 'unavailable'
      ? {
          title: 'База недоступна',
          text: 'Данные не сохраняются. Проверьте подключение сервера к базе.',
          tone: 'text-rose-400',
          badge: 'нет сохранения',
        }
      : storageMode === 'file'
        ? {
            title: 'Без базы данных',
            text: 'Сервер хранит данные в файле — они исчезнут при перезапуске.',
            tone: 'text-amber-400',
            badge: 'временно',
          }
        : syncStatus === 'local'
          ? {
              title: 'Локальный режим',
              text: 'Откройте приложение через Telegram, чтобы включить облако.',
              tone: 'text-amber-400',
              badge: 'только устройство',
            }
          : syncStatus === 'offline'
            ? {
                title: 'Нет связи с облаком',
                text: 'Изменения пока на устройстве. Они отправятся, когда связь вернётся.',
                tone: 'text-amber-400',
                badge: 'ожидает',
              }
            : syncStatus === 'syncing'
              ? {
                  title: 'Синхронизация',
                  text: 'Сохраняем последние изменения в облаке…',
                  tone: 'text-cyan-400',
                  badge: 'сохраняем',
                }
              : syncStatus === 'synced'
                ? {
                    title: 'Сохранено в облаке',
                    text: 'Данные доступны на других устройствах после входа.',
                    tone: 'text-emerald-400',
                    badge: 'облако',
                  }
                : {
                    title: 'Синхронизация готова',
                    text: 'Изменения сохраняются автоматически.',
                    tone: 'text-slate-400',
                    badge: 'ожидание',
                  };

  const displayName = user?.name && user.name.trim().length > 0 ? user.name : 'Атлет';
  const displayTg = user?.telegramUsername && user.telegramUsername.trim().length > 0 ? user.telegramUsername : '@username';

  return (
    <div className="space-y-4 pb-24">
      {/* Profile Header Card */}
      <div
        id="tour-profile-card"
        className="bg-gradient-to-br from-[#121c27] via-[#0d141c] to-[#12181f] border border-[#233345] rounded-2xl p-4 shadow-lg shadow-black/20"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-13 h-13 shrink-0 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-800 flex items-center justify-center text-xl font-extrabold text-slate-950 shadow-md border border-emerald-400/40">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-100 truncate">{displayName}</h2>
              <div className="text-xs text-emerald-400 font-mono truncate">{displayTg}</div>
              <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2 font-mono">
                <span>{user?.streakDays || 0} дн. серия</span>
                <span>•</span>
                <span className="text-emerald-400">{user?.disciplineScore || 100}% дисциплина</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleOpenEditProfile}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#18232f] hover:bg-[#233140] text-emerald-400 text-xs font-bold border border-[#273748] transition-all active:scale-95"
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

        {canUseBattles && (
          <button
            onClick={() => setProfileTab('friends_battles')}
            className={`flex-1 py-2 px-2.5 rounded-lg font-semibold transition-all whitespace-nowrap flex items-center justify-center gap-1 ${
              profileTab === 'friends_battles'
                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Swords className="w-3 h-3" />
            <span>Друзья и зарубы</span>
          </button>
        )}

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
          <span>Состав тела</span>
        </button>

        {canUseAchievements && (
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
        )}
      </div>

      {/* TAB 1: General Goals & Steps */}
      {profileTab === 'general' && (
        <div className="space-y-4">
          {/* Body Mass & Weight Goal Section */}
          <div className="bg-[#12181f] border border-[#1e293b] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-slate-200">Вес и цель</h3>
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
                      ? 'Снижение веса'
                      : user?.weightGoalType === 'gain'
                      ? 'Набор веса'
                      : user?.weightGoalType === 'recomp'
                      ? 'Перестройка тела'
                      : 'Поддержание веса'}
                  </span>
                </div>
                <span className="font-mono font-bold text-emerald-400">
                  {isGoalReached ? 'Цель достигнута!' : weightDelta > 0 ? `Разница: ${weightDelta} кг` : 'По плану'}
                </span>
              </div>
            </div>
          </div>

          {/* BMI reference */}
          <div className="bg-[#12181f] border border-[#1e293b] rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold text-slate-200">Индекс массы тела</h3>
              </div>
              <button
                type="button"
                onClick={handleOpenEditProfile}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold"
              >
                Изменить рост
              </button>
            </div>

            <div className="flex items-end justify-between">
              <div>
                <span className={`text-2xl font-extrabold font-mono ${bmiTone}`}>
                  {bmi > 0 ? bmi.toLocaleString('ru-RU', { maximumFractionDigits: 1 }) : '—'}
                </span>
                <span className="text-[11px] text-slate-400 ml-1.5">кг/м²</span>
              </div>
              <span className={`text-[11px] font-bold ${bmiTone}`}>{bmiCategory}</span>
            </div>

            <p className="text-[10px] text-slate-500 leading-snug">
              Ориентир для взрослых: 18,5–24,9. Индекс не учитывает мышцы и жир — смотрите его вместе с анализом состава тела.
            </p>
          </div>

          {/* Daily Steps Normative Section */}
          <div className="bg-[#12181f] border border-[#1e293b] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Footprints className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-slate-200">Шаги за сегодня</h3>
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
                Свободный режим: цель по шагам не задана. Можно просто записывать пройденное ниже.
              </div>
            )}

            <div className="pt-2 flex items-center justify-between gap-2 border-t border-[#1b2532]">
              <span className="text-[11px] text-slate-400">
                Пройдено за сегодня:
              </span>

              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={todaySteps || ''}
                  onChange={e => handleTodayStepsChange(e.target.value)}
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
                    <span>ИИ-помощник</span>
                    <span className="text-[9px] bg-cyan-950 text-cyan-400 font-mono px-1.5 py-0.5 rounded border border-cyan-500/30">
                      настройки
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Личные указания, ограничения, травмы и добавки
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
                  Личные указания для ИИ:
                </div>
                <p className="text-slate-300 italic text-[11px] line-clamp-2">
                  {user?.aiPersonalPrompt?.trim() 
                    ? `«${user.aiPersonalPrompt}»`
                    : 'Не заданы (по умолчанию: силовой тренинг, тяжёлые подходы по самочувствию и циклы)'}
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
                  <span className="text-slate-400 block text-[10px]">Добавки и спортпит:</span>
                  <span className="text-slate-200 font-semibold truncate block">
                    {user?.activeSupplements?.trim() || 'Не указаны'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400 font-mono px-1">
                <span className="min-w-0 truncate">ИИ-тренер: {aiPrimary}</span>
                {aiFallback && (
                  <span
                    className={`shrink-0 font-bold ${
                      aiProviders?.groq && aiProviders?.gemini
                        ? 'text-emerald-400'
                        : aiProviders?.groq || aiProviders?.gemini
                          ? 'text-amber-400'
                          : 'text-rose-400'
                    }`}
                  >
                    {aiFallback}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Напоминания в Telegram */}
          <div className="bg-[#101820] border border-[#22303f] rounded-2xl p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {notificationsOn ? (
                  <Bell className="w-4 h-4 text-emerald-400" />
                ) : (
                  <BellOff className="w-4 h-4 text-slate-500" />
                )}
                <div>
                  <div className="text-xs font-bold text-slate-200">Напоминания в Telegram</div>
                  <div className="text-[10px] text-slate-400">
                    {notificationsOn
                      ? 'Тренировка вечером, сон утром, день эксперимента'
                      : 'Отключены — бот не пишет первым'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                id="notifications-toggle"
                onClick={() => {
                  onUpdateUser({ notificationsEnabled: !notificationsOn });
                  hapticImpact('light');
                }}
                className={`w-12 h-6 rounded-full border transition-colors shrink-0 relative ${
                  notificationsOn ? 'bg-emerald-500/30 border-emerald-500/60' : 'bg-[#18232f] border-[#2b3a4a]'
                }`}
                title={notificationsOn ? 'Выключить напоминания' : 'Включить напоминания'}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-slate-100 transition-all ${
                    notificationsOn ? 'left-6' : 'left-0.5'
                  }`}
                />
              </button>
            </div>

            <button
              type="button"
              id="notifications-test"
              disabled={notifyTest.status === 'sending' || !notificationsOn}
              onClick={handleTestNotification}
              className="w-full py-2 bg-[#141c24] hover:border-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed border border-[#22303f] text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{notifyTest.status === 'sending' ? 'Отправляю…' : 'Проверить уведомления'}</span>
            </button>

            {notifyTest.status === 'ok' && (
              <p className="text-[10px] text-emerald-400 leading-snug">
                ✅ Отправлено — проверь чат с ботом @get_fitbot.
              </p>
            )}
            {notifyTest.status === 'error' && (
              <p className="text-[10px] text-amber-400 leading-snug">⚠️ {notifyTest.message}</p>
            )}
          </div>

          {/* Режим приложения: базовый или расширенный */}
          <div id="feature-settings" className="bg-[#101820] border border-[#22303f] rounded-2xl p-3.5 space-y-3">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-emerald-400" />
              <div>
                <div className="text-xs font-bold text-slate-200">Режим приложения</div>
                <div className="text-[10px] text-slate-400">
                  Базовый — только главное. Расширенный — включай нужные разделы по одному.
                </div>
              </div>
            </div>

            <div
              id="tour-feature-mode"
              className="flex items-center justify-between gap-3 bg-[#0b1016] border border-[#1b2533] rounded-xl p-3"
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${
                  !advancedMode
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                    : 'bg-[#18232f] border-[#2b3a4a] text-slate-400'
                }`}>
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-200">Базовый режим</div>
                  <div className="text-[10px] text-slate-400">
                    {!advancedMode
                      ? 'Включён: 4 вкладки — Тренировки, Питание, Прогресс, Профиль'
                      : 'Выключен: базовые вкладки остаются, ниже можно включить доп. разделы'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                id="advanced-mode-toggle"
                onClick={handleToggleAdvanced}
                className={`w-12 h-6 rounded-full border transition-colors shrink-0 relative ${
                  !advancedMode ? 'bg-emerald-500/30 border-emerald-500/60' : 'bg-[#18232f] border-[#2b3a4a]'
                }`}
                title={!advancedMode ? 'Включить расширенный режим' : 'Вернуться в базовый режим'}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-slate-100 transition-all ${
                    !advancedMode ? 'left-6' : 'left-0.5'
                  }`}
                />
              </button>
            </div>

            <div className="text-[11px] text-slate-400 leading-relaxed bg-[#0b1016] border border-[#1b2533] rounded-xl p-2.5">
              {!advancedMode ? (
                <>
                  <span className="text-slate-200 font-semibold">Что остаётся в базовом режиме:</span>{' '}
                  тренировки и шаблоны, питание и сон, графики прогресса с кнопкой{' '}
                  <span className="text-cyan-300 font-semibold">«Отчёт за период»</span>, профиль, InBody,
                  рекорды и спорт. Марафоны, зарубы, дисциплина, разряды, тело, лаборатория и циклы выключены.
                </>
              ) : (
                <>
                  <span className="text-slate-200 font-semibold">Как это работает:</span>{' '}
                  выключи «Базовый режим», затем включи только нужные разделы. Изменения применяются сразу:
                  новые вкладки появятся внизу, а разделы внутри «Тренировок», «Тела» и «Профиля» — на своих местах.
                </>
              )}
            </div>

            {advancedMode && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                    Дополнительные разделы
                  </span>
                  <div className="flex items-center gap-2 text-[10px] font-semibold">
                    <button
                      type="button"
                      onClick={handleEnableAllFeatures}
                      className="text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5"
                    >
                      <Check className="w-3 h-3" />
                      Включить всё
                    </button>
                    <button
                      type="button"
                      onClick={handleResetFeatures}
                      className="text-slate-500 hover:text-slate-300"
                    >
                      Сбросить
                    </button>
                  </div>
                </div>

                {FEATURES.map(feature => {
                  const enabled = features[feature.key];
                  return (
                    <button
                      key={feature.key}
                      type="button"
                      id={`feature-toggle-${feature.key}`}
                      role="switch"
                      aria-checked={enabled}
                      onClick={() => handleToggleFeature(feature.key)}
                      className={`w-full text-left rounded-xl border p-2.5 flex items-start justify-between gap-3 transition-colors ${
                        enabled
                          ? 'bg-emerald-950/30 border-emerald-500/40'
                          : 'bg-[#0b1016] border-[#1b2533] hover:border-[#2b3d51]'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-200">{feature.label}</span>
                          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                            enabled
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : 'bg-[#151f2b] text-slate-500 border-[#243447]'
                          }`}>
                            {enabled ? 'вкл' : 'выкл'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 leading-snug">{feature.description}</div>
                        <div className="text-[10px] text-cyan-400/90 mt-1 font-mono">{feature.where}</div>
                      </div>
                      <span className={`mt-0.5 w-10 h-5 rounded-full border transition-colors shrink-0 relative ${
                        enabled ? 'bg-emerald-500/30 border-emerald-500/60' : 'bg-[#18232f] border-[#2b3a4a]'
                      }`}>
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-slate-100 transition-all ${
                          enabled ? 'left-5' : 'left-0.5'
                        }`} />
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Синхронизация с облаком */}
          <div id="sync-status-card" className="bg-[#101820] border border-[#22303f] rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <RefreshCw className={`w-4 h-4 ${syncInfo.tone}`} />
                <div>
                  <div className="text-xs font-bold text-slate-200">Синхронизация</div>
                  <div className={`text-[10px] ${syncInfo.tone}`}>{syncInfo.title}</div>
                </div>
              </div>
              <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border border-[#243447] bg-[#0b1016] ${syncInfo.tone}`}>
                {syncInfo.badge}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">{syncInfo.text}</p>
          </div>

          {/* Обучение по разделам */}
          {onReplayTour && (
            <div id="tour-settings" className="bg-[#101820] border border-[#22303f] rounded-2xl p-3.5 space-y-3">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-emerald-400" />
                <div>
                  <div className="text-xs font-bold text-slate-200">Обучение</div>
                  <div className="text-[10px] text-slate-400">
                    Короткие подсказки по основным и включённым разделам
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                {visibleTourItems.map(item => {
                  const isActive = activeTour === item.id;
                  const isDone = Boolean(tourStatus?.[item.id]);
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2 bg-[#0b1016] border border-[#1b2533] rounded-xl px-2.5 py-2"
                    >
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-slate-200 truncate">{item.label}</div>
                        <div className={`text-[9px] font-mono ${
                          isActive ? 'text-cyan-400' : isDone ? 'text-emerald-400' : 'text-slate-500'
                        }`}>
                          {isActive ? 'идёт сейчас' : isDone ? 'пройдено' : 'не пройдено'}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={isActive}
                        onClick={() => onReplayTour(item.id)}
                        className="shrink-0 px-2.5 py-1.5 rounded-lg bg-[#17222e] hover:bg-[#22303f] disabled:opacity-50 text-[10px] font-bold text-emerald-300 border border-[#273748] transition-colors"
                      >
                        {isActive ? 'Идёт' : isDone ? 'Заново' : 'Начать'}
                      </button>
                    </div>
                  );
                })}
              </div>

              {onResetTours && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Сбросить прогресс обучения и пройти основной тур заново?')) {
                      onResetTours();
                    }
                  }}
                  className="w-full py-2 bg-[#141c24] hover:border-rose-500/40 border border-[#22303f] text-slate-400 hover:text-rose-300 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Сбросить прогресс обучения</span>
                </button>
              )}
            </div>
          )}

          {/* Резервная копия данных */}
          <div className="bg-[#101820] border border-[#22303f] rounded-2xl p-3.5 space-y-3">
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-cyan-400" />
              <div>
                <div className="text-xs font-bold text-slate-200">Резервная копия</div>
                <div className="text-[10px] text-slate-400">
                  Файл или текст со всеми данными. Сохраните перед сменой устройства
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                id="backup-export"
                onClick={handleExportClick}
                disabled={backupState.status === 'busy'}
                className="py-2 bg-[#141c24] hover:border-cyan-500/50 disabled:opacity-50 border border-[#22303f] text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{backupState.status === 'busy' ? 'Готовлю…' : 'Скопировать'}</span>
              </button>
              <button
                type="button"
                id="backup-download"
                onClick={handleDownloadBackup}
                disabled={backupState.status === 'busy'}
                className="py-2 bg-[#141c24] hover:border-cyan-500/50 disabled:opacity-50 border border-[#22303f] text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Скачать файл</span>
              </button>
              <button
                type="button"
                id="backup-import-toggle"
                onClick={() => {
                  setShowImportArea((prev) => !prev);
                  setBackupState({ status: 'idle' });
                }}
                className="py-2 bg-[#141c24] hover:border-cyan-500/50 border border-[#22303f] text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Вставить текст</span>
              </button>
              <button
                type="button"
                id="backup-import-file"
                onClick={() => backupFileRef.current?.click()}
                className="py-2 bg-[#141c24] hover:border-cyan-500/50 border border-[#22303f] text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Загрузить файл</span>
              </button>
              <input
                ref={backupFileRef}
                type="file"
                accept="application/json,.json"
                onChange={handleImportFile}
                className="hidden"
              />
            </div>

            <button
              type="button"
              id="export-csv"
              onClick={handleExportCsv}
              disabled={exportState.status === 'busy'}
              className="w-full py-2 bg-[#141c24] hover:border-emerald-500/50 disabled:opacity-50 border border-[#22303f] text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              title="Бот пришлёт CSV-файл с дневником — он открывается в Google Sheets и Excel"
            >
              <Table className="w-3.5 h-3.5" />
              <span>{exportState.status === 'busy' ? 'Отправляю…' : 'Дневник таблицей в чат'}</span>
            </button>

            {exportState.status === 'ok' && (
              <p className="text-[10px] text-emerald-400 leading-snug">
                ✅ Файл отправлен в чат с ботом — откройте его в Excel или Google Таблицах.
              </p>
            )}
            {exportState.status === 'error' && (
              <p className="text-[10px] text-amber-400 leading-snug">⚠️ {exportState.message}</p>
            )}

            {showImportArea && (
              <div className="space-y-2">
                <textarea
                  id="backup-import-text"
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="Вставьте сюда текст резервной копии"
                  rows={4}
                  className="w-full bg-[#0b1016] border border-[#22303f] rounded-xl p-2 text-[10px] font-mono text-slate-300 focus:outline-none focus:border-cyan-500/50"
                />
                <button
                  type="button"
                  id="backup-import-apply"
                  onClick={handleImportClick}
                  disabled={!importText.trim()}
                  className="w-full py-2 bg-cyan-500/20 hover:bg-cyan-500/30 disabled:opacity-50 border border-cyan-500/40 text-cyan-300 rounded-xl text-xs font-bold transition-colors"
                >
                  Применить копию
                </button>
              </div>
            )}

            {backupState.status === 'ok' && (
              <p className="text-[10px] text-emerald-400 leading-snug">✅ {backupState.message}</p>
            )}
            {backupState.status === 'error' && (
              <p className="text-[10px] text-amber-400 leading-snug">⚠️ {backupState.message}</p>
            )}
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
                  <span>Личные рекорды и комплексы</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Фиксируйте максимумы: жим, брусья, бег 5 км, заезд на велосипеде, комплексы упражнений на время.
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
                            {rec.category === 'strength' ? 'Сила' : rec.category === 'cardio' ? 'Кардио' : rec.category === 'complex' ? 'Комплекс упражнений' : 'Разное'}
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
                  Ник в Telegram:
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
                  Цель по весу:
                </label>
                <select
                  value={editGoalType}
                  onChange={e => setEditGoalType(e.target.value as any)}
                  className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="lose">Снижение веса</option>
                  <option value="gain">Набор веса</option>
                  <option value="recomp">Перестройка тела (меньше жира, больше мышц)</option>
                  <option value="maintain">Поддержание веса</option>
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

              <div className="pt-2 border-t border-[#1b2532] space-y-2.5">
                <div>
                  <div className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                    Норма питания
                  </div>
                  <p className="text-[10px] text-slate-500 leading-snug mt-0.5">
                    Пол, возраст, рост и активность нужны для расчёта калорий. Свои значения ниже важнее автоматических.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                      Пол:
                    </label>
                    <select
                      value={editGender}
                      onChange={e => setEditGender(e.target.value as 'male' | 'female')}
                      className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="male">Мужской</option>
                      <option value="female">Женский</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                      Активность:
                    </label>
                    <select
                      value={editActivity}
                      onChange={e => setEditActivity(e.target.value as NonNullable<UserProfile['activityLevel']>)}
                      className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="sedentary">Малоподвижная</option>
                      <option value="moderate">Умеренная</option>
                      <option value="active">Активная</option>
                      <option value="very_active">Очень активная</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                      Калории:
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={editCalories || ''}
                      onChange={e => setEditCalories(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      placeholder="авто"
                      className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                      Белки, г:
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={editProtein || ''}
                      onChange={e => setEditProtein(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      placeholder="авто"
                      className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                      Жиры, г:
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={editFat || ''}
                      onChange={e => setEditFat(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      placeholder="авто"
                      className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                      Углеводы, г:
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={editCarbs || ''}
                      onChange={e => setEditCarbs(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      placeholder="авто"
                      className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                    Клетчатка, г:
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={editFiber || ''}
                    onChange={e => setEditFiber(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    placeholder="авто"
                    className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] text-slate-400 uppercase font-bold">
                    Цель шагов в день:
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
                      { id: 'strength', label: 'Силовой (вес)' },
                      { id: 'cardio', label: 'Кардио (бег, плавание)' },
                      { id: 'complex', label: 'Комплекс упражнений' },
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
