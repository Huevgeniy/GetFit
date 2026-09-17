import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Send, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  History, 
  TrendingUp, 
  Flame, 
  Bot, 
  Plus, 
  ChevronRight,
  AlertCircle,
  ArrowRight,
  Award,
  Calendar,
  Settings2,
  SlidersHorizontal,
  Dumbbell,
  Check,
  Layers,
  Edit3,
  Trash2,
  ArrowUp,
  ArrowDown,
  X
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { WorkoutPlan, WorkoutRecord, CompletedSet, ExerciseLog, ChatMessage, UserProfile, PlannedExercise, ExerciseComparison } from '../types';
import { calculateOneRepMax, calculateNormalizedReps } from '../utils/oneRepMax';

interface AiWorkoutLiveProps {
  plan: WorkoutPlan;
  user: UserProfile;
  pastWorkouts: WorkoutRecord[];
  onFinishWorkout: (record: WorkoutRecord) => void;
  onClose: () => void;
  onSaveAsTemplate?: (template: WorkoutPlan) => void;
}

export const AiWorkoutLive: React.FC<AiWorkoutLiveProps> = ({
  plan,
  user,
  pastWorkouts,
  onFinishWorkout,
  onClose,
  onSaveAsTemplate,
}) => {
  // Start time
  const [startTime] = useState<Date>(new Date());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // State for dynamic exercises list - starts strictly EMPTY for free workouts unless plan provided exercises
  const [activeExercises, setActiveExercises] = useState<PlannedExercise[]>(() => {
    return plan?.exercises && plan.exercises.length > 0 ? plan.exercises : [];
  });

  // Active exercise selection
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  const currentPlanExercise: PlannedExercise | null = activeExercises[activeExerciseIndex] || null;

  // Exercises workout progress state
  const [loggedExercises, setLoggedExercises] = useState<ExerciseLog[]>(() => {
    const list = plan?.exercises && plan.exercises.length > 0 ? plan.exercises : [];
    return list.map(ex => ({
      exerciseId: ex.id,
      name: ex?.name || 'Упражнение',
      sets: [],
      best1RM: 0,
    }));
  });

  // New Exercise Modal State
  const [showAddExModal, setShowAddExModal] = useState(false);
  const [newExNameInput, setNewExNameInput] = useState('');
  const [newExWeightInput, setNewExWeightInput] = useState(100);
  const [newExSetsInput, setNewExSetsInput] = useState(4);
  const [newExRepsInput, setNewExRepsInput] = useState(10);
  const [newExRestInput, setNewExRestInput] = useState(3);

  // Completion & Comparative Table State
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [computedComparisons, setComputedComparisons] = useState<ExerciseComparison[]>([]);
  const [pendingRecordToSave, setPendingRecordToSave] = useState<WorkoutRecord | null>(null);

  // Rest Timer State - can be set to ANY value from 0 seconds upwards
  const initialRest = (currentPlanExercise?.restMinutes !== undefined ? currentPlanExercise.restMinutes * 60 : 180);
  const [totalRestDuration, setTotalRestDuration] = useState<number>(initialRest);
  const [restSecondsLeft, setRestSecondsLeft] = useState<number>(initialRest);
  const [isRestTimerRunning, setIsRestTimerRunning] = useState<boolean>(false);
  const [isEditingRestCustom, setIsEditingRestCustom] = useState(false);
  const [customRestMinutes, setCustomRestMinutes] = useState(Math.floor(initialRest / 60));
  const [customRestSec, setCustomRestSec] = useState(initialRest % 60);

  // Tracking actual rest time elapsed between completed sets
  const lastSetTimestampRef = useRef<number>(Date.now());

  // Sets Table Display Settings (User customizable flexibility)
  const [showSetsConfig, setShowSetsConfig] = useState(false);
  const [displayPreset, setDisplayPreset] = useState<'all' | 'weight_reps' | 'one_rm' | 'custom'>('all');
  const [show1RMColumn, setShow1RMColumn] = useState(true);
  const [showNormalizedCol, setShowNormalizedCol] = useState(true);
  const [normalizedWeightStep, setNormalizedWeightStep] = useState(100); // 40kg to 150kg in 10kg steps
  const [showRestTimeColumn, setShowRestTimeColumn] = useState(true);

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg_0',
      sender: 'ai',
      text: `Привет, ${user?.name || 'Атлет'}! Тренировка "${plan?.title || 'Свободная тренировка'}" началась. Пиши прямо в чат, например: "сделал жим 100 на 10, отдых 3 мин" или "подтягивания 15 раз". Я автоматически добавлю упражнение, запишу подход, замерю отдых и сравню с прошлым разом!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      advice: 'Контролируй технику в каждом повторении и не форсируй отказ в первом подходе.',
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Manual set entry modal / state
  const [manualWeight, setManualWeight] = useState<number>(currentPlanExercise?.targetWeight || 80);
  const [manualReps, setManualReps] = useState<number>(currentPlanExercise?.targetReps || 10);
  const [showManualForm, setShowManualForm] = useState(false);

  // Reusable template saving state
  const [isTemplateSaved, setIsTemplateSaved] = useState(false);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [templateTitleToSave, setTemplateTitleToSave] = useState(plan.title || 'Моя тренировка');

  // On-the-fly current exercise parameters editing state
  const [showEditCurrentExModal, setShowEditCurrentExModal] = useState(false);
  const [editWeight, setEditWeight] = useState(currentPlanExercise?.targetWeight || 80);
  const [editReps, setEditReps] = useState(currentPlanExercise?.targetReps || 10);
  const [editSets, setEditSets] = useState(currentPlanExercise?.targetSets || 4);
  const [editRestSets, setEditRestSets] = useState(currentPlanExercise?.restMinutes || 2.5);
  const [editRestEx, setEditRestEx] = useState(currentPlanExercise?.restBetweenExercisesMinutes || 3);

  const handleOpenEditCurrentEx = () => {
    if (!currentPlanExercise) return;
    setEditWeight(currentPlanExercise.targetWeight || 80);
    setEditReps(currentPlanExercise.targetReps || 10);
    setEditSets(currentPlanExercise.targetSets || 4);
    setEditRestSets(currentPlanExercise.restMinutes !== undefined ? currentPlanExercise.restMinutes : 2.5);
    setEditRestEx(currentPlanExercise.restBetweenExercisesMinutes !== undefined ? currentPlanExercise.restBetweenExercisesMinutes : 3);
    setShowEditCurrentExModal(true);
  };

  const handleApplyEditCurrentEx = () => {
    if (!currentPlanExercise) return;
    setActiveExercises(prev => {
      const copy = [...prev];
      if (copy[activeExerciseIndex]) {
        copy[activeExerciseIndex] = {
          ...copy[activeExerciseIndex],
          targetWeight: editWeight,
          targetReps: editReps,
          targetSets: editSets,
          restMinutes: editRestSets,
          restBetweenExercisesMinutes: editRestEx,
        };
      }
      return copy;
    });
    setTotalRestDuration(Math.round(editRestSets * 60));
    setRestSecondsLeft(Math.round(editRestSets * 60));
    setShowEditCurrentExModal(false);
  };

  const handleDeleteCurrentExercise = () => {
    if (activeExercises.length === 0) return;
    const newExs = activeExercises.filter((_, idx) => idx !== activeExerciseIndex);
    const newLogs = loggedExercises.filter((_, idx) => idx !== activeExerciseIndex);
    setActiveExercises(newExs);
    setLoggedExercises(newLogs);
    setActiveExerciseIndex(Math.max(0, activeExerciseIndex - 1));
    setShowEditCurrentExModal(false);
  };

  const handleSaveAsTemplate = (customTitle?: string) => {
    if (activeExercises.length === 0) return;
    const name = (customTitle || templateTitleToSave).trim() || 'Тренировка';
    const newTemplate: WorkoutPlan = {
      id: `tmpl_saved_${Date.now()}`,
      title: name,
      scheduledDay: plan.scheduledDay || 'Любой день',
      estimatedDurationMinutes: Math.max(15, Math.round(elapsedSeconds / 60)),
      exercises: activeExercises.map((ex, idx) => ({
        id: `ex_${Date.now()}_${idx}`,
        name: ex.name,
        targetSets: ex.targetSets || 4,
        targetReps: ex.targetReps || 10,
        targetWeight: ex.targetWeight || 80,
        restMinutes: ex.restMinutes !== undefined ? ex.restMinutes : 2.5,
        restBetweenExercisesMinutes: ex.restBetweenExercisesMinutes !== undefined ? ex.restBetweenExercisesMinutes : 3,
        muscleGroup: ex.muscleGroup,
      })),
      isCustomTemplate: true,
      createdAt: new Date().toISOString(),
    };

    if (onSaveAsTemplate) {
      onSaveAsTemplate(newTemplate);
    } else {
      try {
        const saved = localStorage.getItem('getfit_custom_templates');
        const list = saved ? JSON.parse(saved) : [];
        list.push(newTemplate);
        localStorage.setItem('getfit_custom_templates', JSON.stringify(list));
      } catch {}
    }

    setIsTemplateSaved(true);
    setShowSaveTemplateModal(false);
  };

  // Track workout duration
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Track Rest Timer countdown
  useEffect(() => {
    let interval: any = null;
    if (isRestTimerRunning && restSecondsLeft > 0) {
      interval = setInterval(() => {
        setRestSecondsLeft(prev => {
          if (prev <= 1) {
            setIsRestTimerRunning(false);
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
              navigator.vibrate([200, 100, 200]);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRestTimerRunning, restSecondsLeft]);

  // Auto scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiLoading]);

  // Sync rest duration when changing exercise
  useEffect(() => {
    if (!currentPlanExercise) return;
    const seconds = (currentPlanExercise.restMinutes !== undefined ? currentPlanExercise.restMinutes : 3) * 60;
    setTotalRestDuration(seconds);
    setRestSecondsLeft(seconds);
    setIsRestTimerRunning(false);
    setManualWeight(currentPlanExercise.targetWeight || 80);
    setManualReps(currentPlanExercise.targetReps || 10);
  }, [activeExerciseIndex, currentPlanExercise]);

  // Find previous workout data for current exercise to show benchmarks
  const previousWorkoutBench = React.useMemo(() => {
    if (!pastWorkouts || pastWorkouts.length === 0 || !currentPlanExercise?.name) return null;
    for (const w of pastWorkouts) {
      const matchEx = w.exercises.find(
        e => e.name.toLowerCase().includes(currentPlanExercise.name.toLowerCase()) ||
             currentPlanExercise.name.toLowerCase().includes(e.name.toLowerCase())
      );
      if (matchEx && matchEx.sets.length > 0) {
        return {
          date: new Date(w.startedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
          sets: matchEx.sets,
          best1RM: matchEx.best1RM || Math.max(...matchEx.sets.map(s => s.calculated1RM)),
        };
      }
    }
    return null;
  }, [pastWorkouts, currentPlanExercise]);

  // Add a new exercise to session dynamically
  const addExerciseToSession = (name: string, weight = 80, reps = 10, rest = 3): number => {
    const existingIndex = activeExercises.findIndex(
      e => e.name.toLowerCase() === name.toLowerCase() ||
           e.name.toLowerCase().includes(name.toLowerCase()) ||
           name.toLowerCase().includes(e.name.toLowerCase())
    );

    if (existingIndex !== -1) {
      setActiveExerciseIndex(existingIndex);
      return existingIndex;
    }

    const newEx: PlannedExercise = {
      id: `dyn_ex_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      name,
      targetWeight: weight,
      targetReps: reps,
      targetSets: 4,
      restMinutes: rest,
    };

    setActiveExercises(prev => [...prev, newEx]);
    setLoggedExercises(prev => [
      ...prev,
      {
        exerciseId: newEx.id,
        name: newEx.name,
        sets: [],
        best1RM: 0,
      }
    ]);

    const newIdx = activeExercises.length;
    setActiveExerciseIndex(newIdx);
    return newIdx;
  };

  // Helper to add completed set to active exercise
  const addCompletedSet = (weight: number, reps: number, rpe = 8.5, targetExIndex = activeExerciseIndex) => {
    const oneRepMax = calculateOneRepMax(weight, reps).honestConsensus;
    const normalizedAt100 = calculateNormalizedReps(weight, reps, 100);

    const now = Date.now();
    const currentSetsCount = loggedExercises[targetExIndex]?.sets.length || 0;
    const actualRestSeconds = currentSetsCount > 0 
      ? Math.max(0, Math.round((now - lastSetTimestampRef.current) / 1000))
      : undefined;
    lastSetTimestampRef.current = now;

    const newSet: CompletedSet = {
      id: `set_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      setNumber: currentSetsCount + 1,
      weight,
      reps,
      rpe,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      actualRestSeconds,
      calculated1RM: oneRepMax,
      normalizedRepsAt100kg: normalizedAt100,
    };

    setLoggedExercises(prev => {
      const updated = [...prev];
      if (!updated[targetExIndex]) {
        updated[targetExIndex] = {
          exerciseId: `ex_${targetExIndex}`,
          name: activeExercises[targetExIndex]?.name || 'Упражнение',
          sets: [],
          best1RM: 0,
        };
      }
      const ex = { ...updated[targetExIndex] };
      ex.sets = [...ex.sets, newSet];
      ex.best1RM = Math.max(ex.best1RM || 0, oneRepMax);
      updated[targetExIndex] = ex;
      return updated;
    });

    // Auto trigger rest timer if duration > 0
    if (totalRestDuration > 0) {
      setRestSecondsLeft(totalRestDuration);
      setIsRestTimerRunning(true);
    }

    return newSet;
  };

  // Detect exercise keywords in text
  const detectExerciseFromText = (text: string): string | null => {
    const lower = text.toLowerCase();
    if (lower.includes('брусь') || lower.includes('отжиман на брусьях')) return 'Отжимания на брусьях';
    if (lower.includes('подтягиван') && (lower.includes('обратн') || lower.includes('хватом'))) return 'Подтягивания обратным хватом';
    if (lower.includes('подтягиван') || lower.includes('турник')) return 'Подтягивания на перекладине';
    if (lower.includes('жим') && (lower.includes('гантел') || lower.includes('наклон'))) return 'Жим гантелей на наклонной';
    if (lower.includes('жим')) return 'Жим штанги лежа';
    if (lower.includes('присед')) return 'Приседания со штангой';
    if (lower.includes('тяга') || lower.includes('станов')) return 'Становая тяга';
    if (lower.includes('плечи') || lower.includes('армейск')) return 'Армейский жим стоя';
    if (lower.includes('бицепс')) return 'Подъем штанги на бицепс';
    
    // Explicit pattern: "иду на [упражнение]"
    const exMatch = text.match(/(?:иду на|перехожу на|дальше упражнение|упражнение)\s+([а-яa-z\s\d-]+?)(?:,|\.|$|\s+с|\s+\d)/i);
    if (exMatch && exMatch[1]) {
      return exMatch[1].trim();
    }

    return null;
  };

  // Handle sending message to AI Coach
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isAiLoading) return;

    setInputMessage('');
    const userMsg: ChatMessage = {
      id: `msg_user_${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsAiLoading(true);

    try {
      // Check if message mentions changing exercise or starting a new exercise
      const detectedExName = detectExerciseFromText(text);
      let targetIndex = activeExerciseIndex;
      let switchedExercise = false;

      if (detectedExName && (!currentPlanExercise || detectedExName.toLowerCase() !== currentPlanExercise.name.toLowerCase())) {
        targetIndex = addExerciseToSession(detectedExName);
        switchedExercise = true;
      } else if (!currentPlanExercise) {
        const fallbackName = detectedExName || 'Упражнение 1';
        targetIndex = addExerciseToSession(fallbackName);
        switchedExercise = true;
      }

      // Check for custom rest in text
      const restMatch = text.match(/(\d+)\s*(?:мин|минут|m|min)\s*(?:отдых|отдыха)?/i) || text.match(/отдых\s*(\d+)\s*(?:мин|минут)?/i);
      const customRestMinutes = restMatch ? parseInt(restMatch[1], 10) : null;

      const currentExSets = loggedExercises[targetIndex]?.sets || [];
      const targetEx = activeExercises[targetIndex] || {
        id: 'ex_temp',
        name: detectedExName || 'Упражнение',
        targetWeight: 80,
        targetReps: 10,
        targetSets: 4,
        restMinutes: 3,
      };

      const payload = {
        message: text,
        activeWorkout: {
          title: plan.title,
          elapsedMinutes: Math.round(elapsedSeconds / 60),
          currentExercise: {
            name: targetEx.name,
            targetWeight: targetEx.targetWeight,
            targetReps: targetEx.targetReps,
            targetSets: targetEx.targetSets,
            restMinutes: customRestMinutes || targetEx.restMinutes,
            completedSetsCount: currentExSets.length,
            completedSets: currentExSets,
          },
        },
        previousWorkout: previousWorkoutBench,
        userProfile: user,
      };

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      let loggedSetObj: CompletedSet | undefined;
      // If AI detected a set, add it automatically
      if (data.parsedSet && data.parsedSet.reps) {
        const weight = data.parsedSet.weight || targetEx.targetWeight || 100;
        const reps = data.parsedSet.reps;
        const rpe = data.parsedSet.rpe || 8.5;
        loggedSetObj = addCompletedSet(weight, reps, rpe, targetIndex);
      }

      // Rest timer trigger
      const effectiveRestSec = customRestMinutes ? customRestMinutes * 60 : (data.recommendedRestSeconds || (targetEx.restMinutes * 60));
      if (loggedSetObj) {
        setTotalRestDuration(effectiveRestSec);
        setRestSecondsLeft(effectiveRestSec);
        setIsRestTimerRunning(true);
      }

      // Past benchmark summary if exercise switched
      let benchmarkNotice = '';
      if (switchedExercise) {
        const prevEx = pastWorkouts.find(w => w.exercises.some(e => e.name.toLowerCase().includes(targetEx.name.toLowerCase())));
        if (prevEx) {
          const matched = prevEx.exercises.find(e => e.name.toLowerCase().includes(targetEx.name.toLowerCase()));
          if (matched && matched.sets.length > 0) {
            const summary = matched.sets.map(s => `${s.weight}кг×${s.reps}`).join(', ');
            benchmarkNotice = `\n📌 В прошлый раз в "${targetEx.name}" было: ${summary}.`;
          }
        }
      }

      const aiMsg: ChatMessage = {
        id: `msg_ai_${Date.now()}`,
        sender: 'ai',
        text: (data.reply || 'Принято! Отличный темп, восстанавливай силы.') + benchmarkNotice,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        parsedSet: data.parsedSet ? {
          exercise: targetEx.name,
          weight: data.parsedSet.weight || targetEx.targetWeight,
          reps: data.parsedSet.reps,
          rpe: data.parsedSet.rpe,
        } : undefined,
        advice: data.advice,
        recommendedRestSeconds: effectiveRestSec,
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      console.error(err);
      // Fallback local parser
      const match = text.match(/(?:сделал|выполнил|подход|set|пожал|поднял)?\s*(\d+(?:[.,]\d+)?)\s*(?:кг|kg)?\s*(?:на|x|\*|\s)\s*(\d+)\s*(?:раз|повт)?/i)
        || text.match(/(\d+)\s*(?:раз|повт)/i);
      
      const restMatch = text.match(/(\d+)\s*(?:мин|минут)/i);
      const targetEx = activeExercises[activeExerciseIndex] || currentPlanExercise;
      const defaultRestSec = targetEx?.restMinutes !== undefined ? targetEx.restMinutes * 60 : 180;
      const restSec = restMatch ? parseInt(restMatch[1], 10) * 60 : defaultRestSec;

      if (match) {
        let currentExIdx = activeExerciseIndex;
        if (activeExercises.length === 0) {
          currentExIdx = addExerciseToSession('Упражнение 1');
        }
        const exTarget = activeExercises[currentExIdx] || targetEx;
        const weight = match[2] ? parseFloat(match[1].replace(',', '.')) : (exTarget?.targetWeight || 80);
        const reps = parseInt(match[2] || match[1], 10);
        addCompletedSet(weight, reps, 8.5, currentExIdx);

        setTotalRestDuration(restSec);
        setRestSecondsLeft(restSec);
        setIsRestTimerRunning(true);

        setMessages(prev => [
          ...prev,
          {
            id: `msg_ai_${Date.now()}`,
            sender: 'ai',
            text: `Зафиксировал подход: ${weight} кг на ${reps} раз! Таймер отдыха запущен на ${Math.round(restSec / 60)} мин.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            advice: 'Глубокий вдох носом, выдох ртом, расслабь плечевой пояс.',
          },
        ]);
      } else {
        setMessages(prev => [
          ...prev,
          {
            id: `msg_ai_${Date.now()}`,
            sender: 'ai',
            text: 'На связи! Напиши выполненный подход, например: "сделал 10 раз" или "100 кг на 8, отдых 4 мин".',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
    } finally {
      setIsAiLoading(false);
    }
  };

  // Finish Workout & Calculate Comparative Table
  const handleInitiateFinish = () => {
    let totalTonnage = 0;
    const comparisons: ExerciseComparison[] = [];

    // Filter exercises that actually had sets logged
    const activeLogged = loggedExercises.filter(ex => ex.sets && ex.sets.length > 0);

    activeLogged.forEach(currentEx => {
      currentEx.sets.forEach(s => {
        totalTonnage += s.weight * s.reps;
      });

      // Find the most recent workout that had this exercise
      let prevWorkoutWithEx: WorkoutRecord | null = null;
      let prevExerciseLog: ExerciseLog | null = null;

      for (const pw of pastWorkouts) {
        const found = pw.exercises?.find(
          e => e.name.toLowerCase().includes(currentEx.name.toLowerCase()) ||
               currentEx.name.toLowerCase().includes(e.name.toLowerCase())
        );
        if (found && found.sets && found.sets.length > 0) {
          prevWorkoutWithEx = pw;
          prevExerciseLog = found;
          break;
        }
      }

      const currentWeight = currentEx.sets[0]?.weight || 0;
      const currentSetsReps = currentEx.sets.map(s => s.reps);

      if (prevExerciseLog) {
        const prevWeight = prevExerciseLog.sets[0]?.weight || 0;
        const prevSetsReps = prevExerciseLog.sets.map(s => s.reps);

        const weightDelta = currentWeight - prevWeight;
        const currentTotalReps = currentSetsReps.reduce((a, b) => a + b, 0);
        const prevTotalReps = prevSetsReps.reduce((a, b) => a + b, 0);
        const repsDelta = currentTotalReps - prevTotalReps;

        let summaryVerdict = '';
        if (weightDelta > 0) {
          summaryVerdict = `+${weightDelta} кг в базе! Прогрессивная перегрузка достигнута.`;
        } else if (weightDelta === 0 && repsDelta > 0) {
          summaryVerdict = `+${repsDelta} повт. в сумме! Силовая выносливость выросла.`;
        } else if (weightDelta === 0 && repsDelta === 0) {
          summaryVerdict = `Стабильный результат. Закрепление рабочего веса.`;
        } else if (weightDelta < 0) {
          summaryVerdict = `Снижение веса на ${Math.abs(weightDelta)} кг (восстановительная сессия).`;
        } else {
          summaryVerdict = `Рабочий объем зафиксирован.`;
        }

        comparisons.push({
          exerciseName: currentEx.name,
          previousWeight: prevWeight,
          previousSetsReps: prevSetsReps,
          currentWeight: currentWeight,
          currentSetsReps: currentSetsReps,
          summaryVerdict,
        });
      } else {
        comparisons.push({
          exerciseName: currentEx.name,
          previousWeight: 0,
          previousSetsReps: [],
          currentWeight: currentWeight,
          currentSetsReps: currentSetsReps,
          summaryVerdict: 'Первая фиксация упражнения в GetFitBot. Задана базовая планка!',
        });
      }
    });

    const record: WorkoutRecord = {
      id: `w_rec_${Date.now()}`,
      planId: plan.id,
      title: plan.title || 'Тренировка',
      startedAt: startTime.toISOString(),
      completedAt: new Date().toISOString(),
      durationMinutes: Math.max(1, Math.round(elapsedSeconds / 60)),
      status: 'completed',
      exercises: activeLogged,
      totalTonnageKg: totalTonnage,
      comparisons,
    };

    setPendingRecordToSave(record);
    setComputedComparisons(comparisons);
    setShowComparisonModal(true);

    confetti({
      particleCount: 90,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#10b981', '#34d399', '#059669', '#ffffff'],
    });
  };

  const handleConfirmSaveWorkout = () => {
    if (pendingRecordToSave) {
      onFinishWorkout(pendingRecordToSave);
    }
  };

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const currentSets = loggedExercises[activeExerciseIndex]?.sets || [];
  const restProgress = totalRestDuration > 0 ? ((totalRestDuration - restSecondsLeft) / totalRestDuration) * 100 : 0;

  return (
    <div className="flex flex-col h-[calc(100vh-130px)] max-w-lg mx-auto bg-[#0b0f12] text-slate-100 overflow-hidden">
      {/* Top Bar: Start time & controls */}
      <div className="bg-[#12181f] border-b border-[#1f2937] px-4 py-2.5 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <h2 className="text-sm font-bold text-slate-100 truncate max-w-[200px]">{plan.title}</h2>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 font-mono">
            <Clock className="w-3 h-3 text-emerald-400" />
            <span>Старт: {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <span>•</span>
            <span className="text-emerald-400 font-semibold">{formatTime(elapsedSeconds)}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setTemplateTitleToSave(plan.title || 'Моя тренировка');
              setShowSaveTemplateModal(true);
            }}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-[#1a232f] hover:bg-[#253241] text-emerald-400 font-medium transition-colors flex items-center gap-1.5 active:scale-95"
            title="Сохранить эту тренировку как многоразовый шаблон"
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">В шаблон</span>
          </button>
          <button
            onClick={onClose}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-[#1a232f] hover:bg-[#253241] text-slate-300 font-medium transition-colors"
          >
            Свернуть
          </button>
          <button
            onClick={handleInitiateFinish}
            className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all active:scale-95"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Завершить
          </button>
        </div>
      </div>

      {/* Exercise Selector Tabs + Add Exercise button */}
      <div className="bg-[#0e141a] px-3 py-2 border-b border-[#1a232f] flex items-center gap-2 overflow-x-auto no-scrollbar">
        {activeExercises.map((ex, idx) => {
          const isSelected = activeExerciseIndex === idx;
          const completedCount = loggedExercises[idx]?.sets?.length || 0;
          return (
            <button
              key={ex.id}
              onClick={() => setActiveExerciseIndex(idx)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 transition-all ${
                isSelected
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold'
                  : 'bg-[#151c24] text-slate-400 border border-transparent hover:text-slate-200'
              }`}
            >
              <span className="truncate max-w-[120px]">{ex.name}</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                completedCount >= ex.targetSets ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-[#22303f] text-slate-300'
              }`}>
                {completedCount}/{ex.targetSets}
              </span>
            </button>
          );
        })}

        <button
          onClick={() => setShowAddExModal(true)}
          className="flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs bg-[#17212c] hover:bg-[#202d3d] text-emerald-400 font-semibold border border-emerald-500/20 flex items-center gap-1"
          title="Добавить упражнение"
        >
          <Plus className="w-3 h-3" />
          <span>Упражнение</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* If no exercises yet, show clean state to add first exercise */}
        {activeExercises.length === 0 ? (
          <div className="bg-[#12181f] border border-[#1e293b] rounded-2xl p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
              <Dumbbell className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Свободная тренировка</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                Список упражнений пуст. Добавь первое движение кнопкой ниже или напиши прямо в чат ИИ (например: <span className="text-emerald-400">"жим 100 на 10"</span> или <span className="text-emerald-400">"подтягивания 12"</span>)!
              </p>
            </div>
            <button
              onClick={() => setShowAddExModal(true)}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs inline-flex items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Добавить упражнение</span>
            </button>
          </div>
        ) : (
          <>
            {/* Exercise Header & Previous Workout Benchmark */}
            {currentPlanExercise && (
              <div className="bg-[#12181f] border border-[#1e293b] rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-400">
                      Текущее упражнение
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <h3 className="text-base font-bold text-slate-100">{currentPlanExercise.name}</h3>
                      <button
                        type="button"
                        onClick={handleOpenEditCurrentEx}
                        className="p-1.5 rounded-lg bg-[#192432] hover:bg-[#233345] text-slate-400 hover:text-emerald-400 border border-[#27374a] transition-all"
                        title="Настроить параметры упражнения (веса, подходы, отдых)"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {(() => {
                    const nextSetIndex = currentSets.length;
                    const prevSetForNext = previousWorkoutBench?.sets?.[nextSetIndex];
                    if (prevSetForNext) {
                      return (
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400">Ориентир подхода #{nextSetIndex + 1}:</span>
                          <div className="text-xs font-mono font-bold text-emerald-400">
                            {prevSetForNext.weight} кг × {prevSetForNext.reps} повт.
                          </div>
                        </div>
                      );
                    }
                    if (previousWorkoutBench && previousWorkoutBench.sets.length > 0) {
                      return (
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400">Ориентир подхода #{nextSetIndex + 1}:</span>
                          <div className="text-[11px] font-mono text-slate-400">
                            без ориентира ({previousWorkoutBench.sets.length} в прошл. раз)
                          </div>
                        </div>
                      );
                    }
                    if (currentPlanExercise.targetWeight && currentPlanExercise.targetWeight > 0) {
                      return (
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400">План подхода #{nextSetIndex + 1}:</span>
                          <div className="text-xs font-mono font-bold text-emerald-400">
                            {currentPlanExercise.targetWeight} кг × {currentPlanExercise.targetReps} повт.
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400">Подход #{nextSetIndex + 1}:</span>
                        <div className="text-[11px] font-mono text-slate-400">
                          без ориентира
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Benchmark with previous workout */}
                {previousWorkoutBench ? (
                  <div className="mt-2.5 pt-2 border-t border-[#1e293b] bg-[#0b0f12]/60 rounded-lg p-2 flex items-start gap-2 text-xs">
                    <History className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>В прошлый раз ({previousWorkoutBench.date}):</span>
                        <span className="text-emerald-400 font-mono font-bold">1ПМ ~ {previousWorkoutBench.best1RM} кг</span>
                      </div>
                      <div className="text-slate-300 font-mono text-[11px] mt-0.5">
                        Сделано:{' '}
                        {previousWorkoutBench.sets.map((s, idx) => (
                          <span key={s.id} className="text-slate-200">
                            {s.weight}кг×{s.reps}{idx < previousWorkoutBench.sets.length - 1 ? ', ' : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-slate-400 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Первая фиксация движения. Задаем личный ориентир!</span>
                  </div>
                )}
              </div>
            )}

            {/* Rest Timer Card (Fully customizable starting from 0) */}
            <div className="bg-[#12181f] border border-[#1e293b] rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative w-12 h-12 flex items-center justify-center">
                    <svg className="w-12 h-12 transform -rotate-90">
                      <circle
                        cx="24"
                        cy="24"
                        r="20"
                        stroke="#1f2937"
                        strokeWidth="3.5"
                        fill="transparent"
                      />
                      <circle
                        cx="24"
                        cy="24"
                        r="20"
                        stroke={restSecondsLeft === 0 ? '#10b981' : '#34d399'}
                        strokeWidth="3.5"
                        strokeDasharray={125.6}
                        strokeDashoffset={totalRestDuration > 0 ? 125.6 - (125.6 * restProgress) / 100 : 0}
                        strokeLinecap="round"
                        fill="transparent"
                        className="transition-all duration-300"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center text-xs font-mono font-bold text-slate-100">
                      {formatTime(restSecondsLeft)}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                      <span>Отдых между подходами</span>
                      {restSecondsLeft === 0 && (
                        <span className="text-[10px] text-emerald-400 font-bold uppercase animate-pulse">
                          Готов!
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => setIsEditingRestCustom(!isEditingRestCustom)}
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
                      title="Настроить время отдыха"
                    >
                      <span>Таймер: {totalRestDuration >= 60 ? `${Math.floor(totalRestDuration / 60)}м ${totalRestDuration % 60 ? (totalRestDuration % 60) + 'с' : ''}` : `${totalRestDuration}с`}</span>
                      <Settings2 className="w-3 h-3 text-slate-400" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setIsRestTimerRunning(!isRestTimerRunning)}
                    className={`p-2 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                      isRestTimerRunning
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}
                    title={isRestTimerRunning ? 'Пауза' : 'Старт'}
                  >
                    {isRestTimerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                  </button>
                  <button
                    onClick={() => {
                      setRestSecondsLeft(totalRestDuration);
                      setIsRestTimerRunning(false);
                    }}
                    className="p-2 rounded-lg bg-[#1a232f] hover:bg-[#22303f] text-slate-400 hover:text-slate-200 transition-colors"
                    title="Сброс на базовое время"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setRestSecondsLeft(prev => Math.max(0, prev - 15))}
                    className="px-1.5 py-1.5 rounded-lg bg-[#1a232f] hover:bg-[#22303f] text-[10px] font-mono text-slate-300"
                    title="-15 секунд"
                  >
                    -15с
                  </button>
                  <button
                    onClick={() => setRestSecondsLeft(prev => prev + 30)}
                    className="px-1.5 py-1.5 rounded-lg bg-[#1a232f] hover:bg-[#22303f] text-[10px] font-mono text-slate-300"
                    title="+30 секунд"
                  >
                    +30с
                  </button>
                </div>
              </div>

              {/* Quick Rest Preset Buttons & Custom Inputs */}
              {isEditingRestCustom ? (
                <div className="pt-2 border-t border-[#1e293b] space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">Свое время:</span>
                    <div className="flex items-center gap-1 text-xs">
                      <input
                        type="number"
                        min="0"
                        max="30"
                        value={customRestMinutes}
                        onChange={e => setCustomRestMinutes(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-12 bg-[#161f28] border border-[#253241] rounded px-1.5 py-0.5 text-center font-mono text-slate-100"
                      />
                      <span className="text-slate-400 text-xs">мин</span>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        step="5"
                        value={customRestSec}
                        onChange={e => setCustomRestSec(Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)))}
                        className="w-12 bg-[#161f28] border border-[#253241] rounded px-1.5 py-0.5 text-center font-mono text-slate-100"
                      />
                      <span className="text-slate-400 text-xs">сек</span>
                    </div>
                    <button
                      onClick={() => {
                        const total = customRestMinutes * 60 + customRestSec;
                        setTotalRestDuration(total);
                        setRestSecondsLeft(total);
                        setIsEditingRestCustom(false);
                      }}
                      className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs ml-auto"
                    >
                      Применить
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
                    <span className="text-[10px] text-slate-500 flex-shrink-0">Быстро:</span>
                    {[
                      { label: '0с', sec: 0 },
                      { label: '30с', sec: 30 },
                      { label: '1 мин', sec: 60 },
                      { label: '1.5 мин', sec: 90 },
                      { label: '2 мин', sec: 120 },
                      { label: '3 мин', sec: 180 },
                      { label: '4 мин', sec: 240 },
                      { label: '5 мин', sec: 300 },
                    ].map(preset => (
                      <button
                        key={preset.sec}
                        onClick={() => {
                          setTotalRestDuration(preset.sec);
                          setRestSecondsLeft(preset.sec);
                          setCustomRestMinutes(Math.floor(preset.sec / 60));
                          setCustomRestSec(preset.sec % 60);
                          setIsEditingRestCustom(false);
                        }}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono flex-shrink-0 transition-colors ${
                          totalRestDuration === preset.sec
                            ? 'bg-emerald-500 text-slate-950 font-bold'
                            : 'bg-[#1a232f] hover:bg-[#253241] text-slate-300'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 border-t border-[#1e293b]/50">
                  <span className="text-[10px] text-slate-500 flex-shrink-0">Пресет:</span>
                  {[
                    { label: '0с', sec: 0 },
                    { label: '30с', sec: 30 },
                    { label: '1 мин', sec: 60 },
                    { label: '2 мин', sec: 120 },
                    { label: '3 мин', sec: 180 },
                    { label: '4 мин', sec: 240 },
                  ].map(preset => (
                    <button
                      key={preset.sec}
                      onClick={() => {
                        setTotalRestDuration(preset.sec);
                        setRestSecondsLeft(preset.sec);
                        setCustomRestMinutes(Math.floor(preset.sec / 60));
                        setCustomRestSec(preset.sec % 60);
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono flex-shrink-0 transition-colors ${
                        totalRestDuration === preset.sec
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold'
                          : 'bg-[#161f28] hover:bg-[#1f2b38] text-slate-400'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Live Sets Table with Customization Options */}
            <div className="bg-[#12181f] border border-[#1e293b] rounded-xl overflow-hidden">
              <div className="px-3 py-2 bg-[#161f28] flex items-center justify-between border-b border-[#1f2937]">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-200">
                    Выполненные подходы ({currentSets.length})
                  </span>
                  <button
                    onClick={() => setShowSetsConfig(!showSetsConfig)}
                    className={`p-1 rounded text-slate-400 hover:text-slate-200 transition-colors ${
                      showSetsConfig ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-[#202d3d]'
                    }`}
                    title="Настройка отображения таблицы"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button
                  onClick={() => setShowManualForm(!showManualForm)}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>{showManualForm ? 'Скрыть ввод' : 'Ввести вручную'}</span>
                </button>
              </div>

              {/* Table Configuration Drawer */}
              {showSetsConfig && (
                <div className="p-3 bg-[#0f1721] border-b border-[#1f2937] space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                      Отображение таблицы подходов:
                    </span>
                    <button
                      onClick={() => setShowSetsConfig(false)}
                      className="text-[10px] text-slate-400 hover:text-slate-200"
                    >
                      Закрыть
                    </button>
                  </div>

                  {/* Presets */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => {
                        setDisplayPreset('all');
                        setShow1RMColumn(true);
                        setShowNormalizedCol(true);
                        setShowRestTimeColumn(true);
                      }}
                      className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                        displayPreset === 'all'
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-[#192330] text-slate-300 hover:bg-[#223041]'
                      }`}
                    >
                      Все столбцы
                    </button>
                    <button
                      onClick={() => {
                        setDisplayPreset('weight_reps');
                        setShow1RMColumn(false);
                        setShowNormalizedCol(false);
                        setShowRestTimeColumn(false);
                      }}
                      className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                        displayPreset === 'weight_reps'
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-[#192330] text-slate-300 hover:bg-[#223041]'
                      }`}
                    >
                      Только вес и повт.
                    </button>
                    <button
                      onClick={() => {
                        setDisplayPreset('one_rm');
                        setShow1RMColumn(true);
                        setShowNormalizedCol(false);
                        setShowRestTimeColumn(false);
                      }}
                      className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                        displayPreset === 'one_rm'
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-[#192330] text-slate-300 hover:bg-[#223041]'
                      }`}
                    >
                      Только 1ПМ
                    </button>
                  </div>

                  {/* Granular Toggles */}
                  <div className="pt-2 border-t border-[#1a2533] space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                      <input
                        type="checkbox"
                        checked={show1RMColumn}
                        onChange={e => {
                          setShow1RMColumn(e.target.checked);
                          setDisplayPreset('custom');
                        }}
                        className="rounded bg-[#1a2533] border-[#293b4e] text-emerald-500 focus:ring-0"
                      />
                      <span>Показывать 1ПМ (расчетный максимум)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                      <input
                        type="checkbox"
                        checked={showRestTimeColumn}
                        onChange={e => {
                          setShowRestTimeColumn(e.target.checked);
                          setDisplayPreset('custom');
                        }}
                        className="rounded bg-[#1a2533] border-[#293b4e] text-emerald-500 focus:ring-0"
                      />
                      <span>Показывать факт. отдых перед подходом</span>
                    </label>

                    <div className="space-y-1">
                      <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                        <input
                          type="checkbox"
                          checked={showNormalizedCol}
                          onChange={e => {
                            setShowNormalizedCol(e.target.checked);
                            setDisplayPreset('custom');
                          }}
                          className="rounded bg-[#1a2533] border-[#293b4e] text-emerald-500 focus:ring-0"
                        />
                        <span>Приведение к заданному весу:</span>
                      </label>

                      {showNormalizedCol && (
                        <div className="flex items-center gap-1.5 pl-6 pt-1 flex-wrap">
                          {[40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150].map(step => (
                            <button
                              key={step}
                              onClick={() => setNormalizedWeightStep(step)}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                                normalizedWeightStep === step
                                  ? 'bg-emerald-500 text-slate-950 font-bold'
                                  : 'bg-[#182330] hover:bg-[#202d3e] text-slate-400'
                              }`}
                            >
                              {step}кг
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {showManualForm && (
                <div className="p-3 bg-[#0d141b] border-b border-[#1f2937] flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-400 block mb-0.5">Вес (кг)</label>
                    <input
                      type="number"
                      value={manualWeight}
                      onChange={e => setManualWeight(parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#161f28] border border-[#253241] rounded px-2 py-1 text-xs text-slate-100 font-mono"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-400 block mb-0.5">Повторения</label>
                    <input
                      type="number"
                      value={manualReps}
                      onChange={e => setManualReps(parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-[#161f28] border border-[#253241] rounded px-2 py-1 text-xs text-slate-100 font-mono"
                    />
                  </div>
                  <button
                    onClick={() => {
                      addCompletedSet(manualWeight, manualReps, 8.5, activeExerciseIndex);
                      setShowManualForm(false);
                    }}
                    className="mt-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3 py-1.5 rounded text-xs"
                  >
                    Сохранить
                  </button>
                </div>
              )}

              {currentSets.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  Подходы пока не внесены. Напиши ИИ-тренеру (например: "сделал 10 раз" или "100 кг на 8")!
                </div>
              ) : (
                <div className="divide-y divide-[#1c2633] text-xs overflow-x-auto">
                  <div className="flex items-center px-3 py-1.5 text-[10px] font-mono text-slate-400 bg-[#0e141a] min-w-full">
                    <span className="w-10">Сет</span>
                    <span className="w-16">Вес</span>
                    <span className="w-14">Повт</span>
                    {show1RMColumn && <span className="w-16">1ПМ</span>}
                    {showNormalizedCol && <span className="w-20 text-right">На {normalizedWeightStep}кг</span>}
                    {showRestTimeColumn && <span className="flex-1 text-right">Отдых</span>}
                  </div>
                  {currentSets.map(set => {
                    const normalizedVal = calculateNormalizedReps(set.weight, set.reps, normalizedWeightStep);
                    const restFormatted = set.actualRestSeconds !== undefined
                      ? (set.actualRestSeconds >= 60
                          ? `${Math.floor(set.actualRestSeconds / 60)}м ${set.actualRestSeconds % 60 ? (set.actualRestSeconds % 60) + 'с' : ''}`
                          : `${set.actualRestSeconds}с`)
                      : '—';

                    return (
                      <div key={set.id} className="flex items-center px-3 py-2 font-mono min-w-full hover:bg-[#161f28]/40 transition-colors">
                        <span className="w-10 font-bold text-slate-200">#{set.setNumber}</span>
                        <span className="w-16 text-emerald-400 font-semibold">{set.weight} кг</span>
                        <span className="w-14 text-slate-100 font-bold">{set.reps}</span>
                        {show1RMColumn && (
                          <span className="w-16 text-teal-400 text-[11px]">{set.calculated1RM} кг</span>
                        )}
                        {showNormalizedCol && (
                          <span className="w-20 text-right text-slate-300 text-[11px]">
                            ~{normalizedVal} повт
                          </span>
                        )}
                        {showRestTimeColumn && (
                          <span className="flex-1 text-right text-slate-400 text-[11px]">
                            {restFormatted}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* AI Live Chat Section */}
        <div className="bg-[#12181f] border border-[#1e293b] rounded-xl overflow-hidden flex flex-col h-[280px]">
          {/* Chat Header */}
          <div className="px-3 py-2 bg-[#161f28] border-b border-[#1f2937] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-slate-200">GetFitBot Секундант</span>
            </div>
            <span className="text-[10px] text-emerald-400/90 font-mono bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/20">
              Авто-фиксация
            </span>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 text-xs">
            {messages.map(msg => {
              const isUser = msg.sender === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 ${
                      isUser
                        ? 'bg-emerald-600 text-white rounded-br-none'
                        : 'bg-[#1a232f] text-slate-200 border border-[#263546] rounded-bl-none'
                    }`}
                  >
                    <p className="leading-relaxed whitespace-pre-line">{msg.text}</p>
                    {msg.advice && (
                      <div className="mt-1.5 pt-1.5 border-t border-slate-700/60 text-[11px] text-emerald-300/90 flex items-start gap-1">
                        <Sparkles className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <span>{msg.advice}</span>
                      </div>
                    )}
                  </div>
                  <span className="text-[9px] text-slate-400 mt-0.5 px-1 font-mono">
                    {msg.timestamp}
                  </span>
                </div>
              );
            })}

            {isAiLoading && (
              <div className="flex items-center gap-2 text-slate-400 text-xs py-1">
                <Bot className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                <span>Фиксирую подход и запускаю таймер...</span>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Quick Scenario Chips */}
          <div className="px-3 py-1.5 bg-[#0e141a] border-t border-[#1a232f] flex gap-1.5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => handleSendMessage(`сделал 10 раз, отдых 4 мин`)}
              className="flex-shrink-0 text-[10px] bg-[#1a232f] hover:bg-[#253241] text-emerald-400 px-2 py-1 rounded-md border border-emerald-500/20"
            >
              + 10 раз (отдых 4 мин)
            </button>
            <button
              onClick={() => handleSendMessage(`2 подход 100 на 8`)}
              className="flex-shrink-0 text-[10px] bg-[#1a232f] hover:bg-[#253241] text-emerald-400 px-2 py-1 rounded-md border border-emerald-500/20"
            >
              + 2 подход 100×8
            </button>
            <button
              onClick={() => handleSendMessage(`5 мин отдых иду на брусья с 60кг на 10`)}
              className="flex-shrink-0 text-[10px] bg-[#1a232f] hover:bg-[#253241] text-emerald-400 px-2 py-1 rounded-md border border-emerald-500/20"
            >
              + Иду на брусья 60кг×10
            </button>
            <button
              onClick={() => handleSendMessage(`иду на подтягивания обратным хватом 30кг доп вес 10 раз`)}
              className="flex-shrink-0 text-[10px] bg-[#1a232f] hover:bg-[#253241] text-emerald-400 px-2 py-1 rounded-md border border-emerald-500/20"
            >
              + Подтягивания 30кг×10
            </button>
          </div>

          {/* Chat Input */}
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-2 bg-[#12181f] border-t border-[#1f2937] flex items-center gap-2"
          >
            <input
              type="text"
              value={inputMessage}
              onChange={e => setInputMessage(e.target.value)}
              placeholder="Напр: «жим 100 на 10, отдых 4 мин» или «иду на брусья 60кг на 8»..."
              className="flex-1 bg-[#18222d] border border-[#253342] focus:border-emerald-500 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || isAiLoading}
              className="p-2 rounded-lg bg-emerald-500 disabled:opacity-40 text-slate-950 font-bold transition-all"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>

      {/* Add Custom Exercise Modal */}
      {showAddExModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#12181f] border border-[#253342] rounded-2xl p-4 max-w-sm w-full space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100">Добавить упражнение в сессию</h3>
              <button
                onClick={() => setShowAddExModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Название упражнения</label>
                <input
                  type="text"
                  placeholder="Например: Жим гантелей, Брусья, Тяга блока..."
                  value={newExNameInput}
                  onChange={e => setNewExNameInput(e.target.value)}
                  className="w-full bg-[#18232f] border border-[#273647] rounded-lg px-3 py-2 text-slate-100"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Вес (кг)</label>
                  <input
                    type="number"
                    value={newExWeightInput}
                    onChange={e => setNewExWeightInput(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#18232f] border border-[#273647] rounded-lg px-2 py-1.5 font-mono text-center"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Повторы</label>
                  <input
                    type="number"
                    value={newExRepsInput}
                    onChange={e => setNewExRepsInput(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-[#18232f] border border-[#273647] rounded-lg px-2 py-1.5 font-mono text-center"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Отдых (мин)</label>
                  <input
                    type="number"
                    value={newExRestInput}
                    onChange={e => setNewExRestInput(parseInt(e.target.value, 10) || 4)}
                    className="w-full bg-[#18232f] border border-[#273647] rounded-lg px-2 py-1.5 font-mono text-center"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowAddExModal(false)}
                className="flex-1 py-2 rounded-lg bg-[#18232f] text-slate-300 text-xs font-medium"
              >
                Отмена
              </button>
              <button
                onClick={() => {
                  if (newExNameInput.trim()) {
                    addExerciseToSession(newExNameInput.trim(), newExWeightInput, newExRepsInput, newExRestInput);
                    setShowAddExModal(false);
                    setNewExNameInput('');
                  }
                }}
                disabled={!newExNameInput.trim()}
                className="flex-1 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold disabled:opacity-40"
              >
                Добавить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comparative Table Post-Workout Summary Modal */}
      {showComparisonModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#12181f] border border-[#253342] rounded-2xl p-4 max-w-md w-full space-y-3.5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-[#1f2937]">
              <div>
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-base font-bold text-slate-100">Тренировка завершена!</h3>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">Сравнительная таблица с прошлым разом</p>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                {formatTime(elapsedSeconds)}
              </span>
            </div>

            {/* Comparative Table Content */}
            {computedComparisons.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                Подходы не были зафиксированы. Тренировка будет сохранена без сравнительных данных.
              </div>
            ) : (
              <div className="space-y-2.5">
                {computedComparisons.map((comp, idx) => {
                  return (
                    <div key={idx} className="bg-[#0b0f12] border border-[#1e293b] rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-100">{comp.exerciseName}</span>
                        <span className="text-[10px] text-emerald-400 font-mono font-semibold">
                          {comp.summaryVerdict}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-[#151c24] p-2 rounded-lg border border-[#1e2733]">
                          <span className="text-[10px] text-slate-400 block mb-0.5">В прошлый раз</span>
                          {comp.previousSetsReps.length > 0 ? (
                            <div className="font-mono text-slate-300">
                              <span className="font-bold text-slate-200">{comp.previousWeight} кг</span>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                {comp.previousSetsReps.join('  /  ')}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Нет прошлых данных</span>
                          )}
                        </div>

                        <div className="bg-[#15231e] p-2 rounded-lg border border-emerald-500/30">
                          <span className="text-[10px] text-emerald-400 font-semibold block mb-0.5">Сегодня</span>
                          <div className="font-mono text-emerald-300">
                            <span className="font-bold text-slate-100">{comp.currentWeight} кг</span>
                            <div className="text-[11px] font-bold text-emerald-400 mt-0.5">
                              {comp.currentSetsReps.join('  /  ')}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={() => handleSaveAsTemplate()}
                disabled={isTemplateSaved || activeExercises.length === 0}
                className="w-full py-2.5 bg-[#172330] hover:bg-[#203042] text-emerald-300 font-bold text-xs rounded-xl border border-emerald-500/30 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60"
              >
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>{isTemplateSaved ? '✓ Сохранено в шаблоны' : 'Сохранить эту тренировку как шаблон'}</span>
              </button>

              <button
                onClick={handleConfirmSaveWorkout}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Зафиксировать в прогрессе и графиках</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Current Workout as Template Modal */}
      {showSaveTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#111822] border border-[#233346] rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-100">Сохранить как шаблон</h3>
              </div>
              <button
                onClick={() => setShowSaveTemplateModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Этот набор упражнений ({activeExercises.length} шт.), их порядок, подходы, веса и таймеры отдыха будут сохранены в твои шаблоны!
            </p>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-300">Название шаблона:</label>
              <input
                type="text"
                value={templateTitleToSave}
                onChange={e => setTemplateTitleToSave(e.target.value)}
                placeholder="Напр. Моя пятничная тяга"
                className="w-full bg-[#0c1219] border border-[#223348] rounded-xl px-3 py-2 text-xs text-slate-100 font-semibold focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowSaveTemplateModal(false)}
                className="flex-1 py-2 bg-[#172330] hover:bg-[#203042] text-slate-300 text-xs font-semibold rounded-xl"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => handleSaveAsTemplate()}
                className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl shadow-md"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* On-the-Fly Exercise Edit Modal */}
      {showEditCurrentExModal && currentPlanExercise && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#111822] border border-[#233346] rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-100 truncate max-w-[220px]">
                  {currentPlanExercise.name}
                </h3>
              </div>
              <button
                onClick={() => setShowEditCurrentExModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Корректировка параметров упражнения прямо во время тренировки:
            </p>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">Рабочий вес (кг):</label>
                <input
                  type="number"
                  step="0.5"
                  value={editWeight}
                  onChange={e => setEditWeight(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#0c1219] border border-[#223348] rounded-xl px-2.5 py-1.5 font-mono font-bold text-emerald-400 text-xs focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">Повторения в подходе:</label>
                <input
                  type="number"
                  value={editReps}
                  onChange={e => setEditReps(parseInt(e.target.value, 10) || 1)}
                  className="w-full bg-[#0c1219] border border-[#223348] rounded-xl px-2.5 py-1.5 font-mono font-bold text-slate-100 text-xs focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">Всего подходов:</label>
                <input
                  type="number"
                  min="1"
                  max="15"
                  value={editSets}
                  onChange={e => setEditSets(parseInt(e.target.value, 10) || 1)}
                  className="w-full bg-[#0c1219] border border-[#223348] rounded-xl px-2.5 py-1.5 font-mono font-bold text-slate-100 text-xs focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">Отдых между сетами (мин):</label>
                <input
                  type="number"
                  step="0.5"
                  value={editRestSets}
                  onChange={e => setEditRestSets(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#0c1219] border border-[#223348] rounded-xl px-2.5 py-1.5 font-mono font-bold text-cyan-400 text-xs focus:outline-none"
                />
              </div>

              <div className="col-span-2 space-y-1">
                <label className="text-[11px] text-slate-400">Отдых перед след. упражнением (мин):</label>
                <input
                  type="number"
                  step="0.5"
                  value={editRestEx}
                  onChange={e => setEditRestEx(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#0c1219] border border-[#223348] rounded-xl px-2.5 py-1.5 font-mono font-bold text-cyan-400 text-xs focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#1e2a38]">
              <button
                type="button"
                onClick={handleDeleteCurrentExercise}
                className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 font-semibold"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Удалить из тренировки</span>
              </button>

              <button
                type="button"
                onClick={handleApplyEditCurrentEx}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all active:scale-95 shadow-md shadow-emerald-500/20"
              >
                Применить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
