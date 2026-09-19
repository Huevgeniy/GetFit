import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  Send, 
  X, 
  Sparkles, 
  CheckCircle2, 
  Flame, 
  HelpCircle, 
  Scale, 
  Footprints, 
  AlertTriangle,
  Sliders,
  Mic,
  MicOff,
  Dumbbell,
  Moon,
  Ruler,
  FlaskConical
} from 'lucide-react';
import { UserProfile } from '../types';
import { AiSettingsModal } from './AiSettingsModal';

interface ActionExecuted {
  type: string;
  label: string;
  details?: string;
  icon: 'workout' | 'metric' | 'sleep' | 'experiment' | 'user' | 'penalty';
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  actionsExecuted?: ActionExecuted[];
  timestamp: string;
  aiProvider?: string;
}

interface GlobalAiChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onUpdateUser: (updated: Partial<UserProfile>) => void;
  onAddPenalty?: (reason: string, task: string, points: number) => void;
  onLogWorkout?: (exercise: string, weight: number, reps: number, sets?: number, rpe?: number, notes?: string) => void;
  onLogMetric?: (name: string, value: number, unit: string, category?: string) => void;
  onLogDailyState?: (sleepHours: number, notes?: string, quality?: number, stress?: number) => void;
  onCreateExperiment?: (title: string, hypothesis: string, dependentMetric?: string, independentMetrics?: string[], durationDays?: number) => void;
}

export const GlobalAiChatModal: React.FC<GlobalAiChatModalProps> = ({
  isOpen,
  onClose,
  user,
  onUpdateUser,
  onAddPenalty,
  onLogWorkout,
  onLogMetric,
  onLogDailyState,
  onCreateExperiment,
}) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: `Привет, ${user.name || 'Атлет'}! Я твой интеллектуальный ИИ-ассистент GetFitBot с Natural Language Interface.\n\nВместо заполнения форм просто напиши или надиктуй голосом:\n«Сегодня сделал жим 100 на 5 раз, чувствовалось тяжело, спал всего 5 часов. Еще замерил талию 82 см.»\n\nЯ сам распознаю упражнения, замеры, сон и внесу всё в твои графики и профиль!`,
      timestamp: 'Сейчас',
      aiProvider: 'groq/llama-3.3',
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, messages]);

  // Speech Recognition setup (Web Speech API)
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'ru-RU';

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInput(transcript);
      };

      recognition.onerror = (err: any) => {
        console.warn('Speech recognition error:', err);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } catch (e) {
      console.warn('Speech API init error:', e);
      setSpeechSupported(false);
    }
  }, []);

  const toggleListening = () => {
    if (!speechSupported || !recognitionRef.current) {
      alert('Голосовой ввод не поддерживается браузером в данном окружении. Введите текст вручную или отправьте голосовое в Telegram-боте.');
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch {}
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error('Speech recognition start failed:', e);
        setIsListening(false);
      }
    }
  };

  if (!isOpen) return null;

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || isLoading) return;

    if (isListening && recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      setIsListening(false);
    }

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/ai/concierge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          userProfile: user,
          currentSettings: {
            dailyStepGoal: user.dailyStepGoal,
            currentWeight: user.currentWeight,
            targetWeight: user.targetWeight,
            disciplineScore: user.disciplineScore,
          },
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      const executed: ActionExecuted[] = [];

      // Process actions list
      const actionsList: any[] = Array.isArray(data.actions) ? data.actions : [];
      if (!actionsList.length && data.action && data.action.type && data.action.type !== 'answer_only') {
        actionsList.push({ function: data.action.type, args: data.action.payload || {} });
      }

      for (const act of actionsList) {
        const fn = act.function;
        const args = act.args || {};

        if (fn === 'log_workout') {
          const ex = args.exercise || 'Упражнение';
          const weight = Number(args.weight) || 0;
          const reps = Number(args.reps) || 1;
          const sets = Number(args.sets) || 1;
          const rpe = Number(args.rpe) || 8;
          if (onLogWorkout) {
            onLogWorkout(ex, weight, reps, sets, rpe, args.notes);
          }
          executed.push({
            type: 'log_workout',
            label: `Тренировка: ${ex}`,
            details: `${weight} кг × ${reps} повторений ${sets > 1 ? `(${sets} подх.)` : ''} • RPE ~${rpe}`,
            icon: 'workout',
          });
        } else if (fn === 'log_daily_state') {
          const sleep = Number(args.sleep_hours) || 7;
          if (onLogDailyState) {
            onLogDailyState(sleep, args.notes, args.sleep_quality, args.stress_level);
          }
          executed.push({
            type: 'log_daily_state',
            label: `Сон и восстановление`,
            details: `${sleep} ч сна ${args.notes ? `(${args.notes})` : ''}`,
            icon: 'sleep',
          });
        } else if (fn === 'log_metric') {
          const mName = args.name || 'Замер';
          const val = Number(args.value) || 0;
          const unit = args.unit || 'см';
          if (onLogMetric) {
            onLogMetric(mName, val, unit, args.category);
          }
          executed.push({
            type: 'log_metric',
            label: `Замер: ${mName}`,
            details: `${val} ${unit}`,
            icon: 'metric',
          });
        } else if (fn === 'create_experiment') {
          const title = args.title || 'Эксперимент';
          if (onCreateExperiment) {
            onCreateExperiment(title, args.hypothesis || '', args.dependent_metric, args.independent_metrics, args.duration_days);
          }
          executed.push({
            type: 'create_experiment',
            label: `Лаборатория: ${title}`,
            details: args.hypothesis || 'Запущен эксперимент',
            icon: 'experiment',
          });
        } else if (fn === 'update_user') {
          onUpdateUser(args);
          const keys = Object.keys(args);
          executed.push({
            type: 'update_user',
            label: `Профиль обновлен`,
            details: keys.map(k => `${k}: ${args[k]}`).join(', '),
            icon: 'user',
          });
        } else if (fn === 'add_penalty' && onAddPenalty) {
          const { reason, penaltyTask, pointsDeducted } = args;
          onAddPenalty(reason || 'Штраф от ИИ-арбитра', penaltyTask || '50 отжиманий', pointsDeducted || 5);
          executed.push({
            type: 'add_penalty',
            label: `Штраф: ${penaltyTask}`,
            details: `-${pointsDeducted || 5}% дисциплины`,
            icon: 'penalty',
          });
        }
      }

      const aiMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        sender: 'ai',
        text: data.reply || 'Запрос успешно обработан.',
        actionsExecuted: executed.length > 0 ? executed : undefined,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        aiProvider: data.aiProvider,
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch {
      // Local heuristic execution if server is unreachable
      const executed: ActionExecuted[] = [];
      let fallbackReply = 'Отвечаю в автономном режиме: данные приняты.';

      const stepMatch = text.match(/(?:норма|шаг).*?(\d{3,6})/i);
      const weightMatch = text.match(/вес.*?(\d{2,3}(?:[.,]\d+)?)/i);
      const penaltyMatch = text.match(/штраф\s*(?:на\s+)?(.+)/i);
      const sleepMatch = text.match(/(?:спал|сон)\s*(\d+(?:[.,]\d+)?)\s*(?:ч|час)/i);
      const workoutMatch = text.match(/(?:жим|присед|тяг[аи]|подтягивани[яе]|брусь[яев])\s*(\d+(?:[.,]\d+)?)\s*(?:кг)?\s*(?:на|по|х|\*)\s*(\d+)/i);
      const waistMatch = text.match(/тали[яи]\s*(\d+(?:[.,]\d+)?)\s*(?:см)?/i);

      if (workoutMatch && onLogWorkout) {
        const w = parseFloat(workoutMatch[1].replace(',', '.'));
        const r = parseInt(workoutMatch[2], 10);
        const ex = /присед/i.test(text) ? 'Приседания со штангой' : /тяг/i.test(text) ? 'Становая тяга' : /подтягиван/i.test(text) ? 'Подтягивания с весом' : 'Жим штанги лежа';
        onLogWorkout(ex, w, r, 1, 8.5);
        executed.push({
          type: 'log_workout',
          label: `Тренировка: ${ex}`,
          details: `${w} кг × ${r} повторений`,
          icon: 'workout',
        });
      }

      if (sleepMatch && onLogDailyState) {
        const s = parseFloat(sleepMatch[1].replace(',', '.'));
        onLogDailyState(s, 'Недосып');
        executed.push({
          type: 'log_daily_state',
          label: `Сон`,
          details: `${s} ч`,
          icon: 'sleep',
        });
      }

      if (waistMatch && onLogMetric) {
        const wst = parseFloat(waistMatch[1].replace(',', '.'));
        onLogMetric('Талия', wst, 'см');
        executed.push({
          type: 'log_metric',
          label: `Замер: Талия`,
          details: `${wst} см`,
          icon: 'metric',
        });
      }

      if (stepMatch) {
        const steps = parseInt(stepMatch[1], 10);
        onUpdateUser({ dailyStepGoal: steps });
        executed.push({
          type: 'update_user',
          label: `Норматив шагов`,
          details: `${steps} шагов`,
          icon: 'user',
        });
      }

      if (weightMatch) {
        const w = parseFloat(weightMatch[1].replace(',', '.'));
        onUpdateUser({ currentWeight: w });
        if (onLogMetric) onLogMetric('Вес', w, 'кг');
        executed.push({
          type: 'log_metric',
          label: `Текущий вес`,
          details: `${w} кг`,
          icon: 'metric',
        });
      }

      if (penaltyMatch && onAddPenalty) {
        const task = penaltyMatch[1].trim();
        onAddPenalty('Дисциплинарное задание', task, 5);
        executed.push({
          type: 'add_penalty',
          label: `Штраф: ${task}`,
          details: `-5% дисциплины`,
          icon: 'penalty',
        });
      }

      if (executed.length > 0) {
        fallbackReply = `Зафиксировал все переданные данные (${executed.map(e => e.label).join(', ')})!`;
      } else {
        fallbackReply = 'Принял твой запрос. Напиши конкретные показатели, например «жим 100 на 5, спал 5 часов, талия 82 см»!';
      }

      setMessages(prev => [
        ...prev,
        {
          id: `ai_${Date.now()}`,
          sender: 'ai',
          text: fallbackReply,
          actionsExecuted: executed.length > 0 ? executed : undefined,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          aiProvider: 'heuristic',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickPrompts = [
    { label: '⚡ Жим 100 на 5, спал 5ч, талия 82см', prompt: 'Сегодня сделал жим 100 на 5 раз, чувствовалось тяжело, спал всего 5 часов. Еще замерил талию 82 см.' },
    { label: '💪 Подтягивания 20кг на 6 раз', prompt: 'Выполнил подтягивания с весом 20 кг на 6 повторений' },
    { label: '🌙 Спал 8ч, вес 81.5кг', prompt: 'Спал 8 часов, отличный тонус, вес утром 81.5 кг' },
    { label: '🔬 Эксперимент: Креатин 5г', prompt: 'Начни эксперимент: пить креатин 5г каждый день для жима лежа' },
    { label: '🎯 Норма 12 000 шагов', prompt: 'Поставь мне цель 12 000 шагов в день' },
    { label: '⚠️ Штраф 50 берпи', prompt: 'Назначь мне штраф 50 берпи за пропуск' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-[#0c1218] border border-[#1f2d3d] w-full max-w-md h-[92vh] sm:h-[640px] rounded-t-3xl sm:rounded-3xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom duration-200">
        
        {/* Header */}
        <div className="px-4 py-3 bg-[#111923] border-b border-[#1c2938] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-emerald-400 border border-emerald-300/40 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Bot className="w-4 h-4 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-100">Natural Language Interface</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <span className="text-[10px] text-slate-400 font-medium">Голосовой и текстовый ввод данных</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              title="Личный промт и настройки ИИ"
              className="px-2 py-1 rounded-lg bg-cyan-950/60 border border-cyan-500/30 text-cyan-400 hover:text-cyan-300 text-[10px] font-bold flex items-center gap-1 transition"
            >
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span>Промт</span>
            </button>

            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg bg-[#182330] hover:bg-[#223143] flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Listening Banner if voice recognition is on */}
        {isListening && (
          <div className="bg-emerald-500/15 border-b border-emerald-500/30 px-4 py-2 flex items-center justify-between text-xs text-emerald-400">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="font-bold">Слушаю вас... Говорите свободно!</span>
            </div>
            <button
              onClick={toggleListening}
              className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-bold text-[10px]"
            >
              Стоп
            </button>
          </div>
        )}

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-emerald-500 text-slate-950 font-medium rounded-br-none shadow-sm'
                    : 'bg-[#141d27] border border-[#202f40] text-slate-200 rounded-bl-none'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.text}</div>

                {/* Structured Action Badges */}
                {msg.actionsExecuted && msg.actionsExecuted.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-emerald-500/20 space-y-1.5">
                    <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Применено в базу данных:</span>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5">
                      {msg.actionsExecuted.map((act, i) => (
                        <div
                          key={i}
                          className="bg-[#0b1016]/90 border border-emerald-500/30 rounded-xl px-2.5 py-1.5 flex items-start gap-2"
                        >
                          <div className="p-1 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0 mt-0.5">
                            {act.icon === 'workout' && <Dumbbell className="w-3.5 h-3.5" />}
                            {act.icon === 'metric' && <Ruler className="w-3.5 h-3.5" />}
                            {act.icon === 'sleep' && <Moon className="w-3.5 h-3.5" />}
                            {act.icon === 'experiment' && <FlaskConical className="w-3.5 h-3.5" />}
                            {act.icon === 'user' && <Scale className="w-3.5 h-3.5" />}
                            {act.icon === 'penalty' && <AlertTriangle className="w-3.5 h-3.5" />}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-[11px] text-slate-100">{act.label}</div>
                            {act.details && (
                              <div className="text-[10px] text-slate-400 leading-snug">{act.details}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[9px] font-mono text-slate-500 mt-1 px-1">
                <span>{msg.timestamp}</span>
                {msg.aiProvider && (
                  <span className="text-[8px] px-1 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700/50">
                    {msg.aiProvider}
                  </span>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2.5 text-xs text-slate-400 bg-[#141d27] border border-[#202f40] p-3 rounded-2xl rounded-bl-none max-w-[85%]">
              <Sparkles className="w-4 h-4 text-emerald-400 animate-spin" />
              <span>ИИ анализирует текст, извлекает сущности и обновляет БД...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick prompt chips */}
        <div className="px-3 py-2 bg-[#0e151e] border-t border-[#182330] flex gap-1.5 overflow-x-auto no-scrollbar">
          {quickPrompts.map((qp, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(qp.prompt)}
              className="px-2.5 py-1 rounded-full bg-[#16212d] hover:bg-[#1d2c3d] border border-[#243447] text-[10px] font-medium text-slate-300 whitespace-nowrap transition-colors flex items-center gap-1 shrink-0"
            >
              <span>{qp.label}</span>
            </button>
          ))}
        </div>

        {/* Input Bar with Voice Button */}
        <div className="p-3 bg-[#111923] border-t border-[#1c2938]">
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <button
              type="button"
              onClick={toggleListening}
              title={isListening ? 'Остановить запись' : 'Голосовой ввод (нажмите и говорите)'}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                isListening
                  ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/40'
                  : 'bg-[#182330] border border-[#263546] text-emerald-400 hover:text-emerald-300 hover:bg-[#202f40]'
              }`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Напишите: «жим 100 на 5, спал 5ч, талия 82см»..."
              className="flex-1 bg-[#182330] border border-[#263546] rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
            />

            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="w-10 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:pointer-events-none text-slate-950 flex items-center justify-center font-bold shadow-md transition-all shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Embedded AI Settings Modal */}
      <AiSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        user={user}
        onUpdateUser={onUpdateUser}
      />
    </div>
  );
};
