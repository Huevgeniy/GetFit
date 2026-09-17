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
  Sliders
} from 'lucide-react';
import { UserProfile } from '../types';
import { AiSettingsModal } from './AiSettingsModal';

interface GlobalAiChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onUpdateUser: (updated: Partial<UserProfile>) => void;
  onAddPenalty?: (reason: string, task: string, points: number) => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  actionTaken?: string;
  timestamp: string;
}

export const GlobalAiChatModal: React.FC<GlobalAiChatModalProps> = ({
  isOpen,
  onClose,
  user,
  onUpdateUser,
  onAddPenalty,
}) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: `Привет, ${user.name || 'Атлет'}! Я твой ИИ-консьерж по спорту и дисциплине GetFitBot (работает на Gemini + Grok). Можешь спросить меня о чем угодно (программы, разряды, питание, техника) или попросить изменить параметры приложения прямо в чате: например «поставь норму шагов 12000», «мой вес 83 кг» или «назначь штраф 50 отжиманий».`,
      timestamp: 'Сейчас',
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, messages]);

  if (!isOpen) return null;

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || isLoading) return;

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
      let actionNote: string | undefined = undefined;

      // Handle executed action if AI detected intent
      if (data.action && data.action.type === 'update_user' && data.action.payload) {
        onUpdateUser(data.action.payload);
        const keys = Object.keys(data.action.payload);
        actionNote = `Обновлено: ${keys.join(', ')}`;
      } else if (data.action && data.action.type === 'add_penalty' && data.action.payload && onAddPenalty) {
        const { reason, penaltyTask, pointsDeducted } = data.action.payload;
        onAddPenalty(reason || 'Штраф от ИИ-арбитра', penaltyTask || '50 отжиманий', pointsDeducted || 5);
        actionNote = `Назначен штраф: ${penaltyTask}`;
      }

      const aiMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        sender: 'ai',
        text: data.reply || 'Запрос обработан.',
        actionTaken: actionNote,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch {
      // Offline fallback handling
      let fallbackReply = 'Отвечаю в автономном режиме: данные приняты.';
      let note: string | undefined = undefined;

      const stepMatch = text.match(/(?:норма|шаг).*?(\d{3,6})/i);
      const weightMatch = text.match(/вес.*?(\d{2,3}(?:[.,]\d+)?)/i);
      const penaltyMatch = text.match(/штраф\s*(?:на\s+)?(.+)/i);

      if (stepMatch) {
        const steps = parseInt(stepMatch[1], 10);
        onUpdateUser({ dailyStepGoal: steps });
        fallbackReply = `Отлично! Установил норматив: ${steps.toLocaleString('ru-RU')} шагов в день.`;
        note = `Норматив шагов: ${steps}`;
      } else if (weightMatch) {
        const w = parseFloat(weightMatch[1].replace(',', '.'));
        onUpdateUser({ currentWeight: w });
        fallbackReply = `Зафиксировал твой вес: ${w} кг.`;
        note = `Вес: ${w} кг`;
      } else if (penaltyMatch && onAddPenalty) {
        const task = penaltyMatch[1].trim();
        onAddPenalty('Дисциплинарное задание', task, 5);
        fallbackReply = `Назначил штраф: «${task}» (-5% дисциплины). Выполни его, чтобы восстановить индекс!`;
        note = `Штраф: ${task}`;
      } else {
        fallbackReply = 'Принял твой вопрос! Для силового роста держи прогрессивную перегрузку, спи от 7.5 часов и соблюдай норму белка 1.6–2.0 г/кг.';
      }

      setMessages(prev => [
        ...prev,
        {
          id: `ai_${Date.now()}`,
          sender: 'ai',
          text: fallbackReply,
          actionTaken: note,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickPrompts = [
    { label: '🎯 Норматив 10 000 шагов', prompt: 'Установи мне норматив 10000 шагов' },
    { label: '⚖️ Обновить вес на 80 кг', prompt: 'Мой текущий вес 80 кг' },
    { label: '⚡ Штраф 50 отжиманий', prompt: 'Назначь мне штраф 50 отжиманий' },
    { label: '🔥 Как повысить 1ПМ в жиме?', prompt: 'Как эффективно прогрессировать в жиме лежа?' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-[#0e141a] border border-[#233140] w-full max-w-md h-[88vh] sm:h-[620px] rounded-t-3xl sm:rounded-3xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom duration-200">
        
        {/* Header */}
        <div className="px-4 py-3 bg-[#131c26] border-b border-[#1e2a37] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <Bot className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-100">ИИ-Консьерж GetFitBot</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <span className="text-[10px] text-slate-400">Спорт, нормативы и гибкое управление</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              title="Личный промт и настройки ИИ"
              className="px-2.5 py-1 rounded-lg bg-cyan-950/60 border border-cyan-500/30 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-900/60 text-[11px] font-bold flex items-center gap-1 transition"
            >
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span>Промт & ИИ</span>
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-[#1a2533] hover:bg-[#233142] flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-emerald-500 text-slate-950 font-medium rounded-br-none shadow-sm'
                    : 'bg-[#15202c] border border-[#223141] text-slate-200 rounded-bl-none'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.text}</div>

                {msg.actionTaken && (
                  <div className="mt-2 pt-1.5 border-t border-emerald-500/20 flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{msg.actionTaken}</span>
                  </div>
                )}
              </div>
              <span className="text-[9px] font-mono text-slate-500 mt-1 px-1">{msg.timestamp}</span>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-slate-400 bg-[#15202c] border border-[#223141] p-3 rounded-2xl rounded-bl-none max-w-[80%]">
              <Sparkles className="w-4 h-4 text-emerald-400 animate-spin" />
              <span>ИИ анализирует и обновляет параметры...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick prompt chips */}
        <div className="px-3 py-1.5 bg-[#111822] border-t border-[#1a2430] flex gap-1.5 overflow-x-auto no-scrollbar">
          {quickPrompts.map((qp, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(qp.prompt)}
              className="px-2.5 py-1 rounded-full bg-[#182330] hover:bg-[#202f40] border border-[#263546] text-[11px] text-slate-300 whitespace-nowrap transition-colors"
            >
              {qp.label}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-[#131c26] border-t border-[#1e2a37]">
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Спроси о спорте или напиши «поставь норму шагов 12000»..."
              className="flex-1 bg-[#182330] border border-[#263546] rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="w-10 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:pointer-events-none text-slate-950 flex items-center justify-center font-bold shadow-md transition-all"
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
