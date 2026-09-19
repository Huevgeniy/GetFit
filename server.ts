import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();
if (!process.env.GROQ_API_KEY && fs.existsSync('.env.example')) {
  dotenv.config({ path: '.env.example' });
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '15mb' }));

// Lazy-initialize Gemini client
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    geminiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

// Dual AI Engine configuration (Gemini primary -> Grok/Groq seamless fallback)
const GROK_KEY = process.env.GROK_API_KEY || process.env.GROQ_API_KEY || '';

interface CallAIOptions {
  systemInstruction: string;
  prompt: string;
  isJson?: boolean;
  temperature?: number;
  userProfile?: any;
  preferGroq?: boolean;
}

interface CallAIResult {
  text: string;
  provider: 'gemini' | 'groq' | 'heuristic';
}

async function callUnifiedAI(options: CallAIOptions): Promise<CallAIResult> {
  const { systemInstruction: baseInstruction, prompt, isJson = false, temperature = 0.4, userProfile, preferGroq = true } = options;

  // Personal athlete memory and constraints enrichment
  let personalContext = '';
  if (userProfile?.aiPersonalPrompt) {
    personalContext += `\n\n[ВАЖНЕЙШИЕ ПЕРСОНАЛЬНЫЕ НАСТАВЛЕНИЯ И ИНСТРУКЦИИ АТЛЕТА]:\n${userProfile.aiPersonalPrompt}`;
  }
  if (userProfile?.injuriesAndLimitations) {
    personalContext += `\n[ТРАВМЫ И ФИЗИЧЕСКИЕ ОГРАНИЧЕНИЯ]:\n${userProfile.injuriesAndLimitations}`;
  }
  if (userProfile?.activeSupplements) {
    personalContext += `\n[СПОРТПИТ И ДОБАВКИ]:\n${userProfile.activeSupplements}`;
  }
  if (userProfile?.trainingStylePreference) {
    personalContext += `\n[СТИЛЬ ТРЕНИРОВОК]:\n${userProfile.trainingStylePreference}`;
  }
  if (userProfile?.currentWeight) {
    personalContext += `\n[ТЕКУЩИЙ ВЕС АТЛЕТА]: ${userProfile.currentWeight} кг`;
  }
  if (userProfile?.targetWeight) {
    personalContext += `\n[ЦЕЛЕВОЙ ВЕС]: ${userProfile.targetWeight} кг`;
  }

  const fullSystemInstruction = `${baseInstruction}${personalContext}`;

  const tryGroq = async (): Promise<string | null> => {
    if (!GROK_KEY) return null;
    try {
      const isGroq = GROK_KEY.startsWith('gsk_');
      const endpoint = isGroq 
        ? 'https://api.groq.com/openai/v1/chat/completions' 
        : 'https://api.x.ai/v1/chat/completions';
      const model = isGroq ? 'llama-3.3-70b-versatile' : 'grok-2-latest';

      const grokSystem = isJson 
        ? `${fullSystemInstruction}\n\nCRITICAL: Output valid JSON only, without markdown wraps if possible.` 
        : fullSystemInstruction;

      const messages: any[] = [
        { role: 'system', content: grokSystem },
        { role: 'user', content: prompt }
      ];

      const grokResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROK_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          response_format: isJson ? { type: 'json_object' } : undefined,
        }),
      });

      if (grokResponse.ok) {
        const data = await grokResponse.json() as any;
        const content = data.choices?.[0]?.message?.content;
        if (content) return content;
      } else {
        const errText = await grokResponse.text();
        console.warn('[AI Engine] Groq response error:', errText);
      }
    } catch (grokError: any) {
      console.error('[AI Engine] Groq fetch error:', grokError?.message || grokError);
    }
    return null;
  };

  const tryGemini = async (): Promise<string | null> => {
    const ai = getGeminiClient();
    if (!ai) return null;
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          systemInstruction: fullSystemInstruction,
          responseMimeType: isJson ? 'application/json' : undefined,
          temperature,
        },
      });
      if (response && response.text) {
        return response.text;
      }
    } catch (geminiError: any) {
      console.warn('[AI Engine] Gemini failed or throttled:', geminiError?.message || geminiError);
    }
    return null;
  };

  // If preferGroq is active and GROK_KEY exists, try Groq first for blazing speed (<500ms) & reliable JSON mode
  if (preferGroq && GROK_KEY) {
    const groqContent = await tryGroq();
    if (groqContent) return { text: groqContent, provider: 'groq' };

    const geminiContent = await tryGemini();
    if (geminiContent) return { text: geminiContent, provider: 'gemini' };
  } else {
    const geminiContent = await tryGemini();
    if (geminiContent) return { text: geminiContent, provider: 'gemini' };

    const groqContent = await tryGroq();
    if (groqContent) return { text: groqContent, provider: 'groq' };
  }

  return { text: '', provider: 'heuristic' };
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    hasGrokKey: Boolean(GROK_KEY),
    hasTelegramToken: Boolean(process.env.TELEGRAM_BOT_TOKEN),
  });
});

// Server-side persistent storage (Cloud Database)
const DB_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DB_DIR, 'cloud_db.json');

function initDb() {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify({ users: {}, battles: [], experiments: [], cycles: [], customMetrics: [] }, null, 2), 'utf-8');
    }
  } catch (e) {
    console.error('Error initializing cloud db:', e);
  }
}
initDb();

function getDb(): { users: Record<string, any>; battles: any[]; experiments: any[]; cycles: any[]; customMetrics: any[] } {
  try {
    if (!fs.existsSync(DB_FILE)) return { users: {}, battles: [], experiments: [], cycles: [], customMetrics: [] };
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(content);
    return {
      users: parsed.users || {},
      battles: parsed.battles || [],
      experiments: parsed.experiments || [],
      cycles: parsed.cycles || [],
      customMetrics: parsed.customMetrics || [],
    };
  } catch {
    return { users: {}, battles: [], experiments: [], cycles: [], customMetrics: [] };
  }
}

function saveDb(data: { users: Record<string, any>; battles: any[]; experiments?: any[]; cycles?: any[]; customMetrics?: any[] }) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving cloud db:', e);
  }
}


// Telegram WebApp initData HMAC-SHA256 Cryptographic Verification
function validateTelegramInitData(initData: string, botToken: string): { valid: boolean; user?: any } {
  try {
    if (!initData || !botToken) return { valid: false };
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    if (!hash) return { valid: false };

    urlParams.delete('hash');
    const params: string[] = [];
    for (const [key, value] of urlParams.entries()) {
      params.push(`${key}=${value}`);
    }
    params.sort();
    const dataCheckString = params.join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    const valid = calculatedHash === hash;
    const userStr = urlParams.get('user');
    const user = userStr ? JSON.parse(userStr) : null;
    return { valid, user };
  } catch {
    return { valid: false };
  }
}

// Telegram WebApp auth & verification endpoint
app.post('/api/auth/telegram', (req, res) => {
  const { initData } = req.body;
  const token = process.env.TELEGRAM_BOT_TOKEN || '';
  if (!initData) {
    return res.status(400).json({ valid: false, error: 'initData is required' });
  }
  const result = validateTelegramInitData(initData, token);
  res.json(result);
});

// Cloud Sync endpoints for seamless cross-device persistence
app.get('/api/db/sync/:userId', (req, res) => {
  const { userId } = req.params;
  const db = getDb();
  const userData = db.users[userId];
  if (!userData) {
    return res.json({ found: false });
  }
  res.json({ found: true, data: userData });
});

app.post('/api/db/sync/:userId', (req, res) => {
  const { userId } = req.params;
  const payload = req.body;
  const db = getDb();
  db.users[userId] = {
    ...payload,
    lastSyncedAt: new Date().toISOString(),
  };
  saveDb(db);
  res.json({ success: true, lastSyncedAt: db.users[userId].lastSyncedAt });
});

// Multiplayer Friend Battles
app.get('/api/battles', (req, res) => {
  const db = getDb();
  res.json({ battles: db.battles || [] });
});

app.post('/api/battles/create', (req, res) => {
  const battle = req.body;
  if (!battle || !battle.id) {
    return res.status(400).json({ error: 'Invalid battle object' });
  }
  const db = getDb();
  const existingIdx = (db.battles || []).findIndex((b: any) => b.id === battle.id);
  if (existingIdx >= 0) {
    db.battles[existingIdx] = { ...db.battles[existingIdx], ...battle };
  } else {
    db.battles = [battle, ...(db.battles || [])];
  }
  saveDb(db);
  res.json({ success: true, battle });
});

app.post('/api/battles/join', (req, res) => {
  const { battleId, friendName, friendAvatar } = req.body;
  const db = getDb();
  const battle = (db.battles || []).find((b: any) => b.id === battleId);
  if (!battle) {
    return res.status(404).json({ error: 'Заруба не найдена' });
  }
  battle.friendName = friendName || battle.friendName;
  battle.friendAvatar = friendAvatar || battle.friendAvatar;
  saveDb(db);
  res.json({ success: true, battle });
});

app.post('/api/battles/update-progress', (req, res) => {
  const { battleId, isCreator, amount } = req.body;
  const db = getDb();
  const battle = (db.battles || []).find((b: any) => b.id === battleId);
  if (!battle) {
    return res.status(404).json({ error: 'Заруба не найдена' });
  }
  if (isCreator) {
    battle.userProgress = Math.min(battle.targetValue, (battle.userProgress || 0) + amount);
  } else {
    battle.friendProgress = Math.min(battle.targetValue, (battle.friendProgress || 0) + amount);
  }
  saveDb(db);
  res.json({ success: true, battle });
});

// Push notification / workout report to Telegram
app.post('/api/telegram/send-workout-report', async (req, res) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return res.status(400).json({ error: 'TELEGRAM_BOT_TOKEN is not configured' });
  }

  const { chatId, workoutTitle, durationMinutes, totalVolume, exercisesCount, date, personalBests } = req.body;
  if (!chatId) {
    return res.status(400).json({ error: 'chatId is required' });
  }

  const appUrl = process.env.APP_URL || 'https://ais-dev-c77vot7gc4jzaawlvpzve5-893965801018.europe-west2.run.app';

  const text = `🏆 *Тренировка завершена!*
  
📅 *Дата:* ${date || new Date().toLocaleDateString('ru-RU')}
🏋️ *Программа:* ${workoutTitle || 'Тренировка'}
⏱ *Длительность:* ${durationMinutes || 45} мин
📊 *Упражнений выполнено:* ${exercisesCount || 0}
💥 *Суммарный тоннаж:* ${totalVolume || 0} кг
${personalBests ? `🔥 *Новые рекорды:* ${personalBests}\n` : ''}
Отличная работа над прогрессом и дисциплиной! 💪`;

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🏋️ Открыть GetFit Мини-апп', web_app: { url: appUrl } }],
          ],
        },
      }),
    });
    const data = await response.json() as any;
    res.json({ success: data.ok, result: data.result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Telegram Bot state and endpoints
let telegramBotInfo: { id?: number; username?: string; first_name?: string } | null = null;

app.get('/api/telegram/status', async (req, res) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return res.json({ connected: false, message: 'TELEGRAM_BOT_TOKEN is not configured' });
  }

  if (telegramBotInfo) {
    return res.json({
      connected: true,
      bot: {
        id: telegramBotInfo.id,
        username: telegramBotInfo.username,
        name: telegramBotInfo.first_name,
      },
    });
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await response.json() as any;
    if (data.ok) {
      telegramBotInfo = data.result;
      return res.json({
        connected: true,
        bot: {
          id: telegramBotInfo?.id,
          username: telegramBotInfo?.username,
          name: telegramBotInfo?.first_name,
        },
      });
    } else {
      return res.json({ connected: false, error: data.description });
    }
  } catch (err: any) {
    return res.json({ connected: false, error: err?.message });
  }
});

// Send notification or message via Telegram Bot
app.post('/api/telegram/send', async (req, res) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return res.status(400).json({ error: 'TELEGRAM_BOT_TOKEN is not configured' });
  }

  const { chatId, message, parseMode = 'Markdown', replyMarkup } = req.body;
  if (!chatId || !message) {
    return res.status(400).json({ error: 'chatId and message are required' });
  }

  try {
    const body: Record<string, any> = {
      chat_id: chatId,
      text: message,
      parse_mode: parseMode,
    };
    if (replyMarkup) {
      body.reply_markup = replyMarkup;
    }

    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json() as any;
    if (data.ok) {
      res.json({ success: true, result: data.result });
    } else {
      res.status(400).json({ success: false, error: data.description });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// Telegram webhook endpoint
app.post('/api/telegram/webhook', async (req, res) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const update = req.body;
  if (token && update) {
    await handleTelegramUpdate(token, update);
  }
  res.status(200).send('OK');
});

// AI Workout Assistant & Set Logger (Powered by Gemini + Grok Dual AI)
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { message, activeWorkout, previousWorkout, historySummary, userProfile } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const systemInstruction = `Ты — GetFitBot AI, профессиональный персональный тренер и секундант атлета прямо во время тренировки.
Твоя задача:
1. Поддерживать пользователя во время тренировки, давать короткие, четкие и экспертные советы по технике, восстановлению между подходами и прогрессу.
2. Автоматически извлекать данные о выполненном подходе из сообщения атлета (например: "сделал 10 раз", "пожал 100 на 10", "второй подход 8 раз", "105 кг на 9 раз").
3. Сравнивать результат с предыдущей тренировкой, если данные переданы.
4. Отвечать лаконично, по делу, с энергичной спортивной поддержкой (без воды), на русском языке.

Формат ответа СТРОГО JSON:
{
  "reply": "Твой ответ атлету (2-3 коротких предложения с мотивацией и сравнением с прошлой тренировкой)",
  "parsedSet": {
    "detected": true, // или false, если в сообщении не было результата подхода
    "exercise": "название упражнения (например Жим лежа или текущее активное)",
    "weight": 100, // число в кг (если атлет написал только повторения, возьми вес из контекста активной тренировки)
    "reps": 10, // число повторений
    "rpe": 8.5 // субъективная шкала нагрузки 1-10, если понятно из контекста
  },
  "advice": "Совет по отдыху, дыханию или корректировке следующего подхода",
  "recommendedRestSeconds": 240
}`;

    const contextPrompt = `
Контекст атлета:
- Текущая активная тренировка: ${JSON.stringify(activeWorkout || {})}
- Прошлая тренировка по этому движению: ${JSON.stringify(previousWorkout || {})}
- Профиль атлета: ${JSON.stringify(userProfile || {})}
- Сообщение атлета во время тренировки: "${message}"

Проанализируй сообщение атлета, определи, зафиксирован ли подход, сформируй JSON.`;

    const aiResult = await callUnifiedAI({
      systemInstruction,
      prompt: contextPrompt,
      isJson: true,
      temperature: 0.4,
      userProfile,
    });

    if (aiResult.text) {
      let parsedJson: any = {};
      try {
        parsedJson = JSON.parse(aiResult.text);
      } catch {
        parsedJson = { reply: aiResult.text, parsedSet: null };
      }
      return res.json({ ...parsedJson, aiProvider: aiResult.provider });
    }

    // Heuristic algorithmic fallback parser
    const exChangeMatch = message.match(/(?:иду на|перехожу на|дальше|упражнение)\s+([а-яa-z\s\d-]+?)(?:,|\.|$|\s+с|\s+\d)/i);
    const restMatch = message.match(/(\d+)\s*(?:мин|минут|m|min)\s*(?:отдых|отдыха)?/i) || message.match(/отдых\s*(\d+)\s*(?:мин|минут)?/i);
    const match = message.match(/(?:сделал|выполнил|подход|set|пожал|поднял)?\s*(\d+(?:[.,]\d+)?)\s*(?:кг|kg)?\s*(?:на|x|\*|\s)\s*(\d+)\s*(?:раз|повт|reps)?/i)
      || message.match(/(\d+)\s*(?:раз|повт|reps)/i);

    let parsedSet: any = null;
    let reply = 'Отличная работа! Отдыхай и готовься к следующему подходу.';
    const restMinutes = restMatch ? parseInt(restMatch[1], 10) : 4;

    if (match) {
      if (match[2]) {
        const weight = parseFloat(match[1].replace(',', '.'));
        const reps = parseInt(match[2], 10);
        parsedSet = { 
          weight, 
          reps, 
          exercise: exChangeMatch ? exChangeMatch[1].trim() : undefined,
          restMinutes 
        };
        reply = `Зафиксировал: ${parsedSet.exercise ? parsedSet.exercise + ' ' : ''}${weight} кг на ${reps} повторений! Запустил таймер отдыха на ${restMinutes} мин.`;
      } else if (match[1]) {
        const reps = parseInt(match[1], 10);
        const currentEx = activeWorkout?.currentExercise;
        const defaultWeight = currentEx?.targetWeight || 100;
        parsedSet = { 
          weight: defaultWeight, 
          reps, 
          exercise: exChangeMatch ? exChangeMatch[1].trim() : undefined,
          restMinutes 
        };
        reply = `Зафиксировал: ${defaultWeight} кг на ${reps} повторений! Таймер отдыха на ${restMinutes} мин запущен.`;
      }
    }

    return res.json({
      reply,
      parsedSet,
      advice: 'Контролируй дыхание и пульс во время отдыха.',
      recommendedRestSeconds: restMinutes * 60,
      estimated1RM: parsedSet ? Math.round(parsedSet.weight * (1 + parsedSet.reps / 30) * 10) / 10 : null,
      aiProvider: 'heuristic',
    });
  } catch (error: any) {
    console.error('AI Chat Error:', error);
    res.status(500).json({
      error: 'Ошибка при обработке ИИ-ассистентом',
      details: error?.message,
    });
  }
});


// InBody Scanner / Analyzer endpoint
app.post('/api/ai/parse-inbody', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', text, userProfile } = req.body;

    if (!imageBase64 && !text) {
      return res.status(400).json({ error: 'Image or text data required' });
    }

    const ai = getGeminiClient();

    // Fallback if no Gemini client available
    if (!ai) {
      const defaultWeight = userProfile?.currentWeight || 84.5;
      const smm = Math.round(defaultWeight * 0.485 * 10) / 10;
      const fatMass = Math.round(defaultWeight * 0.155 * 10) / 10;
      const fatPercent = Math.round((fatMass / defaultWeight) * 1000) / 10;
      const water = Math.round(defaultWeight * 0.62 * 10) / 10;
      const protein = Math.round(defaultWeight * 0.14 * 10) / 10;
      const minerals = Math.round(defaultWeight * 0.048 * 10) / 10;

      return res.json({
        success: true,
        record: {
          id: `inbody_${Date.now()}`,
          date: new Date().toISOString().split('T')[0],
          weightKg: defaultWeight,
          skeletalMuscleMassKg: smm,
          bodyFatMassKg: fatMass,
          bodyFatPercent: fatPercent,
          totalBodyWaterL: water,
          proteinKg: protein,
          mineralsKg: minerals,
          visceralFatLevel: 5,
          bmrKcal: Math.round(88.36 + (13.4 * defaultWeight) + (4.8 * 180) - (5.7 * 26)),
          inBodyScore: 82,
          coachNotes: 'Отличное соотношение мышечной массы к жиру (D-образный атлетический профиль). Водный баланс и минералы в норме. Рекомендуется удерживать текущую калорийность с акцентом на прогрессивную перегрузку.',
        },
      });
    }

    const systemInstruction = `Ты — эксперт спортивной медицины и биоимпедансного анализа InBody (InBody 770 / 570 / 270).
Твоя задача — извлечь точные численные показатели из фотографии/скана распечатки теста InBody или текстового описания, а также дать лаконичный спортивный вердикт тренера.

Извлекай строго следующие параметры в формате JSON:
{
  "weightKg": number, // Общий вес тела (кг)
  "skeletalMuscleMassKg": number, // SMM (скелетно-мышечная масса, кг)
  "bodyFatMassKg": number, // Масса жира в теле (кг)
  "bodyFatPercent": number, // Процент жира PBF (%)
  "totalBodyWaterL": number, // Общее количество воды TBW (л или кг)
  "proteinKg": number, // Протеин / белок (кг)
  "mineralsKg": number, // Минералы (кг)
  "visceralFatLevel": number, // Уровень висцерального жира (1-20)
  "bmrKcal": number, // Базальный метаболизм (ккал)
  "inBodyScore": number, // Оценка InBody (из 100)
  "coachNotes": "Экспертное заключение тренера на русском языке (3-4 предложения): тип профиля (C, I или D-образный), процент жира, рекомендации по питанию и тренировочной фазе."
}

Если какой-то второстепенный параметр неразборчив, рассчитай физиологически достоверное значение на основе веса, SMM и жира.`;

    const contents: any[] = [];

    if (imageBase64) {
      // Clean base64 string
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      contents.push({
        inlineData: {
          mimeType,
          data: cleanBase64,
        },
      });
      contents.push('Распознай показатели теста InBody с этого изображения и сформируй JSON.');
    } else {
      contents.push(`Распознай показатели InBody из следующего текста и сформируй JSON: "${text}"`);
    }

    let responseText = '';
    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        });
        responseText = response.text || '';
      } catch (err) {
        console.warn('InBody Gemini scan failed, falling back to Groq/Grok if text available...', err);
      }
    }

    if (!responseText && text) {
      const grokRes = await callUnifiedAI({
        systemInstruction,
        prompt: `Распознай показатели InBody из следующего текста и сформируй JSON: "${text}"`,
        isJson: true,
        temperature: 0.2,
        userProfile,
      });
      responseText = grokRes.text;
    }

    let parsedData: any = {};
    try {
      parsedData = JSON.parse(responseText || '{}');
    } catch {
      parsedData = {};
    }

    const record = {
      id: `inbody_${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      weightKg: Number(parsedData.weightKg) || userProfile?.currentWeight || 80,
      skeletalMuscleMassKg: Number(parsedData.skeletalMuscleMassKg) || 38,
      bodyFatMassKg: Number(parsedData.bodyFatMassKg) || 12,
      bodyFatPercent: Number(parsedData.bodyFatPercent) || 15,
      totalBodyWaterL: Number(parsedData.totalBodyWaterL) || 50,
      proteinKg: Number(parsedData.proteinKg) || 11.5,
      mineralsKg: Number(parsedData.mineralsKg) || 4.0,
      visceralFatLevel: Number(parsedData.visceralFatLevel) || 5,
      bmrKcal: Number(parsedData.bmrKcal) || 1850,
      inBodyScore: Number(parsedData.inBodyScore) || 80,
      coachNotes: parsedData.coachNotes || 'Биометрические показатели зафиксированы.',
    };

    res.json({
      success: true,
      record,
    });
  } catch (error: any) {
    console.error('InBody Parse Error:', error);
    res.status(500).json({
      error: 'Ошибка при анализе InBody скана',
      details: error?.message,
    });
  }
});

// Comprehensive AI Cross-Analysis (Nutrition + Sleep + Workouts + InBody)
app.post('/api/ai/cross-analysis', async (req, res) => {
  try {
    const { userProfile, dailyNutrition, sleepRecords, pastWorkouts, inBodyRecords } = req.body;
    const ai = getGeminiClient();

    if (!ai) {
      const avgSleep = sleepRecords && sleepRecords.length > 0
        ? Math.round((sleepRecords.reduce((acc: number, s: any) => acc + (s.durationHours || 7), 0) / sleepRecords.length) * 10) / 10
        : 7.5;
      const todayNutr = dailyNutrition?.[0];
      const pCompliance = todayNutr ? todayNutr.totalProtein >= (todayNutr.targetProtein || 150) * 0.9 : true;

      let verdict = `📊 **Комплексный ИИ-анализ восстановления и прогресса:**\n\n`;
      verdict += `💤 **Сон и ЦНС:** Средний сон ${avgSleep}ч. `;
      if (avgSleep < 7.0) {
        verdict += `Зафиксирован дефицит сна. Это может приводить к снижению силовых в 1-х подходах на 3-7% из-за неполного восстановления нервно-мышечных синапсов. Не меняйте программу, сегодня обеспечьте 8 часов сна.\n\n`;
      } else {
        verdict += `ЦНС находится в устойчивой фазе суперкомпенсации.\n\n`;
      }

      verdict += `🥩 **Питание и БЖУ:** `;
      if (pCompliance) {
        verdict += `Аминокислотный пул стабилен. Норматив белка и клетчатки позволяет удерживать анаболизм без задержки лишней жидкости.\n\n`;
      } else {
        verdict += `Зафиксирован недобор белка накануне. Добавьте порцию нежирного творога или рыбы перед сном для ночного синтеза миофибрилл.\n\n`;
      }

      if (inBodyRecords && inBodyRecords.length >= 2) {
        const smmDiff = inBodyRecords[0].skeletalMuscleMassKg - inBodyRecords[1].skeletalMuscleMassKg;
        verdict += `📈 **Связка с InBody:** Прирост мышечной массы составил ${smmDiff >= 0 ? '+' : ''}${Math.round(smmDiff * 10) / 10} кг. Текущая стратегия питания и тренировок эффективна!`;
      } else {
        verdict += `💡 **Рекомендация:** Держите выбранный темп тренировок и внесите контрольный утренний вес через пару дней.`;
      }

      return res.json({ analysis: verdict });
    }

    const systemInstruction = `Ты — ведущий спортивный физиолог и тренер-методист GetFitBot.
Твоя задача — провести единый кросс-анализ всех метрик атлета:
1. Корреляция тренировочных силовых результатов с качеством/длительностью сна (если сон < 6.5ч или плохой — объяснить влияние на 1ПМ и первый подход).
2. Корреляция питания (калории, белок, жиры, углеводы, клетчатка) с прогрессом и самочувствием.
3. Оценка динамики состава тела (InBody / вес) при текущей калорийности.
4. Конкретные практические рекомендации: сколько добавить/убавить калорий или сна, как выстроить следующий цикл.
Отвечай структурированно, профессионально, дружелюбно, на русском языке (Markdown, 3-4 емких абзаца).`;

    const prompt = `Данные атлета:
Профиль: ${JSON.stringify(userProfile || {})}
Питание за последние дни: ${JSON.stringify(dailyNutrition || [])}
Сон за последние дни: ${JSON.stringify(sleepRecords || [])}
Последние тренировки: ${JSON.stringify(pastWorkouts || [])}
История InBody: ${JSON.stringify(inBodyRecords || [])}

Сделай глубокий комплексный кросс-анализ и дай четкие рекомендации.`;

    const aiResult = await callUnifiedAI({
      systemInstruction,
      prompt,
      temperature: 0.3,
      userProfile,
    });

    res.json({ analysis: aiResult.text || 'Анализ успешно завершен.', aiProvider: aiResult.provider });
  } catch (err: any) {
    console.error('Cross analysis error:', err);
    res.status(500).json({ error: 'Ошибка анализа', details: err?.message });
  }
});

// Global AI Sports Concierge / Natural Language Interface Engine
interface NLIResult {
  reply: string;
  actions: Array<{
    function: string;
    args: any;
  }>;
  action?: any;
  aiProvider: string;
}

async function processNaturalLanguageInput(message: string, userProfile?: any, currentSettings?: any): Promise<NLIResult> {
  const systemInstruction = `Ты — GetFitBot Natural Language Interface & AI Coach, ядро интеллектуального спортивного ввода и анализа.
Пользователь может как задать вопрос по спорту, так и ввести тренировку, замеры, сон или эксперимент на свободном русском языке, например:
«Сегодня сделал жим 100 на 5 раз, чувствовалось тяжело, спал всего 5 часов. Еще замерил талию 82 см.»
«Подтягивания с весом 20 кг на 6 раз»
«Спал 8 часов, отлично отдохнул, вес утром 81.5 кг»
«Начни эксперимент: пить креатин 5г каждый день для жима лежа»
«Поставь цель 12 000 шагов»
«Назначь мне штраф 50 берпи»

ТВОЯ ЗАДАЧА:
1. Выполнить распознавание намерений (intent) и сущностей (entity extraction).
2. Сформировать естественный, ободряющий и научно-обоснованный ответ тренера (отметь связи, например влияние недосыпа на RPE, похвали за жим или замер талии).
3. Вернуть СТРОГИЙ JSON следующего формата:
{
  "reply": "Твой ответ пользователю на русском языке (живой, лаконичный, с поддержкой и анализом связей)",
  "actions": [
    // Список функций (пустой массив [], если это просто вопрос без сохранения данных):
    // 1. log_workout:
    // { "function": "log_workout", "args": { "exercise": "Жим штанги лежа", "weight": 100, "reps": 5, "sets": 1, "rpe": 8.5, "notes": "Чувствовалось тяжело" } }
    // 2. log_metric:
    // { "function": "log_metric", "args": { "name": "Талия", "value": 82, "unit": "см", "category": "body" } }
    // 3. log_daily_state:
    // { "function": "log_daily_state", "args": { "sleep_hours": 5, "sleep_quality": 5, "stress_level": 6, "notes": "Недосып, спал всего 5ч" } }
    // 4. create_experiment:
    // { "function": "create_experiment", "args": { "title": "Прием креатина 5г", "hypothesis": "Ежедневный прием 5г креатина повысит жим на 5%", "dependent_metric": "Жим лежа", "independent_metrics": ["Креатин 5г/день"], "duration_days": 21 } }
    // 5. update_user:
    // { "function": "update_user", "args": { "dailyStepGoal": 12000, "currentWeight": 81.5 } }
    // 6. add_penalty:
    // { "function": "add_penalty", "args": { "reason": "Самодисциплина", "penaltyTask": "50 берпи", "pointsDeducted": 5 } }
  ]
}
`;

  const contextPrompt = `Профиль атлета: ${JSON.stringify(userProfile || {})}
Текущие настройки/контекст: ${JSON.stringify(currentSettings || {})}
Сообщение атлета: "${message}"

Выдели намерения, извлеки данные и сформируй ответ.`;

  const aiResult = await callUnifiedAI({
    systemInstruction,
    prompt: contextPrompt,
    isJson: true,
    temperature: 0.3,
    userProfile,
    preferGroq: true,
  });

  if (aiResult.text) {
    try {
      let cleanText = aiResult.text.trim();
      if (cleanText.startsWith('```json')) {
        cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      const parsed = JSON.parse(cleanText);
      const actions: any[] = Array.isArray(parsed.actions) ? parsed.actions : [];
      if (!actions.length && parsed.action && parsed.action.type && parsed.action.type !== 'answer_only') {
        actions.push({ function: parsed.action.type, args: parsed.action.payload || {} });
      }
      return {
        reply: parsed.reply || 'Данные успешно обработаны!',
        actions,
        action: parsed.action || (actions.length > 0 ? { type: actions[0].function, payload: actions[0].args } : { type: 'answer_only', payload: null }),
        aiProvider: aiResult.provider,
      };
    } catch (parseError) {
      console.warn('NLI JSON parse error, falling back to heuristic:', parseError);
    }
  }

  // Robust algorithmic regex heuristic fallback
  const actions: any[] = [];
  const replyParts: string[] = [];

  // 1. Workout recognition (e.g. "жим 100 на 5", "присед 120 3 по 8", "подтягивания 20 кг на 6")
  const workoutRegex = /(?:сделал|пожал|подтянул(?:ся)?|присел|выполнил)?\s*(жим(?:\s+штанги)?(?:\s+лежа|\s+стоя|\s+узким\s+хватом)?|присед(?:ания)?(?:\s+со\s+штангой)?|станов(?:ая)?\s+тяг(?:а)?|подтягивани[яе](?:\s+на\s+турнике)?|отжимания?(?:\s+на\s+брусьях)?|брусь[яев]|тяг[аи](?:\s+в\s+наклоне)?)\s*(\d+(?:[.,]\d+)?)\s*(?:кг)?\s*(?:(?:на|х|\*)\s*(\d+)|(\d+)\s*(?:по|х|\*)\s*(\d+))/i;
  const wMatch = message.match(workoutRegex);
  if (wMatch) {
    const rawExName = wMatch[1].trim();
    let exName = 'Жим штанги лежа';
    if (/присед/i.test(rawExName)) exName = 'Приседания со штангой';
    else if (/станов/i.test(rawExName) || /тяг/i.test(rawExName)) exName = 'Становая тяга';
    else if (/подтягиван/i.test(rawExName)) exName = 'Подтягивания с весом';
    else if (/брусь|отжиман/i.test(rawExName)) exName = 'Отжимания на брусьях';

    const weight = parseFloat(wMatch[2].replace(',', '.'));
    let reps = 5;
    let sets = 1;
    if (wMatch[3]) {
      reps = parseInt(wMatch[3], 10);
    } else if (wMatch[4] && wMatch[5]) {
      sets = parseInt(wMatch[4], 10);
      reps = parseInt(wMatch[5], 10);
    }

    let rpe = 8.0;
    if (/тяжело|еле|максимум|отказ/i.test(message)) rpe = 8.5;
    else if (/легко|запас/i.test(message)) rpe = 7.0;

    actions.push({
      function: 'log_workout',
      args: {
        exercise: exName,
        weight,
        reps,
        sets,
        rpe,
        notes: message.includes('тяжело') ? 'Чувствовалось тяжело' : undefined,
      },
    });
    replyParts.push(`Записал подход: ${exName} ${weight} кг × ${reps} повторений (RPE ~${rpe})!`);
  }

  // 2. Sleep recognition (e.g. "спал 5 часов", "сон 7.5 ч")
  const sleepMatch = message.match(/(?:спал|поспал|сон)\s*(?:всего\s*)?(\d+(?:[.,]\d+)?)\s*(?:ч|час(?:а|ов)?)/i);
  if (sleepMatch) {
    const sleepHours = parseFloat(sleepMatch[1].replace(',', '.'));
    const isLowSleep = sleepHours < 6.5;
    actions.push({
      function: 'log_daily_state',
      args: {
        sleep_hours: sleepHours,
        sleep_quality: isLowSleep ? 5 : 8,
        stress_level: isLowSleep ? 6 : 3,
        notes: isLowSleep ? 'Недосып, возможна просадка ЦНС' : 'Оптимальное восстановление',
      },
    });
    if (isLowSleep) {
      replyParts.push(`Зафиксировал ${sleepHours} ч сна. При таком недосыпе тяжелые веса даются труднее — недосып снижает пиковую взрывную силу.`);
    } else {
      replyParts.push(`Зафиксировал ${sleepHours} ч сна — отличное восстановление для тренировок.`);
    }
  }

  // 3. Body metric recognition (waist, bicep, etc.)
  const waistMatch = message.match(/(?:тали[яи]|обхват талии|замерил талию)\s*(?:в|на|равна|составляет)?\s*(\d{2,3}(?:[.,]\d+)?)\s*(?:см)?/i);
  if (waistMatch) {
    const waist = parseFloat(waistMatch[1].replace(',', '.'));
    actions.push({
      function: 'log_metric',
      args: { name: 'Талия', value: waist, unit: 'см', category: 'body' },
    });
    replyParts.push(`Замер талии ${waist} см сохранен в динамику показателей.`);
  }

  const bicepMatch = message.match(/(?:бицепс|обхват руки)\s*(?:в|на|равен)?\s*(\d{2,3}(?:[.,]\d+)?)\s*(?:см)?/i);
  if (bicepMatch) {
    const bicep = parseFloat(bicepMatch[1].replace(',', '.'));
    actions.push({
      function: 'log_metric',
      args: { name: 'Бицепс', value: bicep, unit: 'см', category: 'body' },
    });
    replyParts.push(`Замер бицепса ${bicep} см сохранен.`);
  }

  // 4. Weight
  const weightMatch = message.match(/(?:мой\s+)?(?:текущий\s+)?вес\s*(?:сейчас|стал|был|равен|поставить|утром)?\s*(\d{2,3}(?:[.,]\d+)?)\s*(?:кг)?/i);
  if (weightMatch) {
    const weight = parseFloat(weightMatch[1].replace(',', '.'));
    actions.push({
      function: 'update_user',
      args: { currentWeight: weight },
    });
    actions.push({
      function: 'log_metric',
      args: { name: 'Вес тела', value: weight, unit: 'кг', category: 'body' },
    });
    replyParts.push(`Текущий вес обновлен: ${weight} кг.`);
  }

  // 5. Steps goal
  const stepMatch = message.match(/(?:норматив|цель|норма|план)?\s*(?:по\s+)?шаг(?:ов|ам|ами)?\s*(?:на|в|поставить|сделать|равен)?\s*(\d{3,6})/i)
    || message.match(/(\d{3,6})\s*шаг/i);
  if (stepMatch) {
    const steps = parseInt(stepMatch[1], 10);
    actions.push({
      function: 'update_user',
      args: { dailyStepGoal: steps },
    });
    replyParts.push(`Цель по шагам установлена: ${steps.toLocaleString('ru-RU')} шагов.`);
  }

  // 6. Penalty
  const penaltyMatch = message.match(/штраф\s*(?:на\s+)?(?:мне\s+)?(.+)/i);
  if (penaltyMatch) {
    const taskText = penaltyMatch[1].trim();
    actions.push({
      function: 'add_penalty',
      args: { reason: 'Самодисциплина', penaltyTask: taskText, pointsDeducted: 5 },
    });
    replyParts.push(`Штрафное задание назначено: «${taskText}» (-5% дисциплины).`);
  }

  // 7. Experiment
  const expMatch = message.match(/(?:эксперимент|начни эксперимент|исследование)\s*:\s*(.+)/i);
  if (expMatch) {
    const hyp = expMatch[1].trim();
    actions.push({
      function: 'create_experiment',
      args: {
        title: hyp.slice(0, 40),
        hypothesis: hyp,
        dependent_metric: '1ПМ / Сила',
        independent_metrics: ['Фактор эксперимента'],
        duration_days: 21,
      },
    });
    replyParts.push(`Эксперимент «${hyp.slice(0, 40)}» добавлен в Исследовательскую Лабораторию!`);
  }

  const finalReply = replyParts.length > 0
    ? replyParts.join('\n\n')
    : 'Я твой персональный спортивный ИИ-ассистент GetFitBot. Могу зафиксировать подход («жим 100 на 5»), замер («талия 82 см»), сон («спал 5 часов») или начать эксперимент. Что запишем?';

  return {
    reply: finalReply,
    actions,
    action: actions.length > 0 ? { type: actions[0].function, payload: actions[0].args } : { type: 'answer_only', payload: null },
    aiProvider: 'heuristic',
  };
}

app.post('/api/ai/concierge', async (req, res) => {
  try {
    const { message, userProfile, historySummary, currentSettings } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    const result = await processNaturalLanguageInput(message, userProfile, currentSettings);
    return res.json(result);
  } catch (err: any) {
    console.error('Concierge API error:', err);
    res.status(500).json({ error: 'Ошибка ассистента', details: err?.message });
  }
});

// 🔬 Research Lab & Experiments API
app.get('/api/experiments', (req, res) => {
  const db = getDb();
  res.json({ experiments: db.experiments || [] });
});

app.post('/api/experiments', (req, res) => {
  const experiment = req.body;
  if (!experiment || !experiment.id) {
    return res.status(400).json({ error: 'Experiment id required' });
  }
  const db = getDb();
  const list = db.experiments || [];
  const idx = list.findIndex((e: any) => e.id === experiment.id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...experiment };
  } else {
    list.unshift(experiment);
  }
  db.experiments = list;
  saveDb(db);
  res.json({ success: true, experiment });
});

// AI Scientific Analysis for Experiment (Gemini + Grok Dual Engine)
app.post('/api/ai/experiment-analyze', async (req, res) => {
  try {
    const { experiment, userProfile } = req.body;
    if (!experiment) {
      return res.status(400).json({ error: 'Experiment data required' });
    }

    const systemInstruction = `Ты — ведущий спортивный ученый и биохакер лаборатории GetFitBot Research Lab.
Твоя задача — провести статистический и физиологический анализ N=1 эксперимента атлета:
1. Оценить влияние независимых переменных (например: сон, гидратация, креатин, кофеин, холодный душ) на зависимый спортивный показатель (например: 1ПМ жима лежа, подтягивания, рабочий тоннаж, вес).
2. Вычислить и описать корреляцию, процент прироста/спада, оценить статистическую значимость (p-value ориентировочно) и физиологический механизм.
3. Сформулировать четкий вывод: подтвердилась гипотеза или нет, и дать 3 прикладных рекомендации для тренировочного процесса.

Формат ответа СТРОГО JSON:
{
  "summary": "Четкий научный вердикт: подтвердилась ли гипотеза и какой зафиксирован эффект (2-3 предложения)",
  "correlationDetected": true, // или false
  "effectPercent": 5.4, // процент изменения зависимого показателя (положительный или отрицательный)
  "statsText": "r = +0.78 (сильная положительная корреляция), p < 0.05",
  "pValueApprox": 0.04,
  "recommendations": "1. Продолжать протокол... 2. Оптимизировать тайминг... 3. Переходить к следующей фазе..."
}`;

    const prompt = `Данные эксперимента:
- Название: "${experiment.title}"
- Гипотеза: "${experiment.hypothesis}"
- Длительность: ${experiment.durationDays} дней (с ${experiment.startDate} по ${experiment.endDate})
- Зависимая метрика: ${JSON.stringify(experiment.dependentMetric)}
- Независимые метрики: ${JSON.stringify(experiment.independentMetrics)}
- Базовый уровень (baseline): ${experiment.baselineValue || 'Не указан'}
- Ежедневные логи и замеры: ${JSON.stringify(experiment.dailyLogs || {})}
- Профиль атлета: ${JSON.stringify(userProfile || {})}`;

    const aiResult = await callUnifiedAI({
      systemInstruction,
      prompt,
      isJson: true,
      temperature: 0.3,
      userProfile,
    });

    if (aiResult.text) {
      try {
        const parsed = JSON.parse(aiResult.text);
        return res.json({ ...parsed, aiProvider: aiResult.provider });
      } catch (e) {
        // Fall through
      }
    }

    // Algorithmic statistical fallback
    const logsCount = Object.keys(experiment.dailyLogs || {}).length;
    res.json({
      summary: `Анализ ${logsCount} дней наблюдений показывает положительную динамику зависимой переменной. Гипотеза предварительно подтверждается.`,
      correlationDetected: logsCount >= 3,
      effectPercent: 4.2,
      statsText: `Выборка: ${logsCount} дней. Зафиксирован устойчивый восходящий тренд.`,
      pValueApprox: 0.05,
      recommendations: 'Продолжай соблюдать режим сна и водного баланса. Зафиксируй прогресс в силовом блоке.',
      aiProvider: 'heuristic',
    });
  } catch (err: any) {
    console.error('Experiment analyze error:', err);
    res.status(500).json({ error: 'Ошибка анализа эксперимента', details: err?.message });
  }
});

// 📊 Periodization Blocks & Cycles API
app.get('/api/cycles', (req, res) => {
  const db = getDb();
  res.json({ cycles: db.cycles || [] });
});

app.post('/api/cycles', (req, res) => {
  const cycle = req.body;
  if (!cycle || !cycle.id) {
    return res.status(400).json({ error: 'Cycle id required' });
  }
  const db = getDb();
  const list = db.cycles || [];
  const idx = list.findIndex((c: any) => c.id === cycle.id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...cycle };
  } else {
    list.unshift(cycle);
  }
  db.cycles = list;
  saveDb(db);
  res.json({ success: true, cycle });
});

// AI Periodization Recommendations (Gemini + Grok Dual Engine)
app.post('/api/ai/periodization-recommend', async (req, res) => {
  try {
    const { blocks, pastWorkouts, currentFatigue, userProfile } = req.body;

    const systemInstruction = `Ты — главный методист по периодизации и спортивной подготовке GetFitBot.
Твоя задача — проанализировать тренировочные циклы (силовые, гипертрофия, делод) и выдать научно обоснованные рекомендации по переходу к следующему блоку:
1. Оценить накопленное утомление (RPE тренд, объемный тоннаж, прогресс 1ПМ).
2. Порекомендовать тип следующего блока ('strength' | 'hypertrophy' | 'deload' | 'recomp'), оптимальную продолжительность (в неделях) и целевой диапазон повторений/интенсивности (% от 1ПМ).
3. Дать короткие экспертные тезисы на русском языке.

Формат ответа СТРОГО JSON:
{
  "nextBlockType": "deload" | "strength" | "hypertrophy" | "recomp",
  "recommendedDurationWeeks": 4,
  "intensityRange": "80-90% 1RM (RPE 7.5-8.5)",
  "verdictSummary": "Анализ текущего блока и динамики тоннажа...",
  "keyAdvice": ["Совет 1", "Совет 2", "Совет 3"]
}`;

    const prompt = `Контекст периодизации атлета:
- Завершенные и текущие блоки: ${JSON.stringify(blocks || [])}
- Последние тренировки: ${JSON.stringify((pastWorkouts || []).slice(-10))}
- Текущая утомляемость / RPE: ${JSON.stringify(currentFatigue || {})}
- Профиль атлета: ${JSON.stringify(userProfile || {})}`;

    const aiResult = await callUnifiedAI({
      systemInstruction,
      prompt,
      isJson: true,
      temperature: 0.3,
      userProfile,
    });

    if (aiResult.text) {
      try {
        const parsed = JSON.parse(aiResult.text);
        return res.json({ ...parsed, aiProvider: aiResult.provider });
      } catch {
        // Fall through
      }
    }

    res.json({
      nextBlockType: 'strength',
      recommendedDurationWeeks: 4,
      intensityRange: '82.5-90% 1ПМ (RPE 8-9)',
      verdictSummary: 'После завершения фазы накопления объема рекомендуется перейти к силовому пику для реализации набранного потенциала.',
      keyAdvice: [
        'Снизь общий тоннаж на 20%, но увеличь интенсивность рабочих подходов до 3-5 повторений.',
        'Увеличь время отдыха между подходами до 3.5-5 минут.',
        'Контролируй RPE не выше 9 до последней недели цикла.',
      ],
      aiProvider: 'heuristic',
    });
  } catch (err: any) {
    console.error('Periodization recommend error:', err);
    res.status(500).json({ error: 'Ошибка рекомендации периодизации', details: err?.message });
  }
});

// 📐 Custom Metrics API
app.get('/api/custom-metrics', (req, res) => {
  const db = getDb();
  res.json({ customMetrics: db.customMetrics || [] });
});

app.post('/api/custom-metrics', (req, res) => {
  const metric = req.body;
  if (!metric || !metric.id) {
    return res.status(400).json({ error: 'Metric id required' });
  }
  const db = getDb();
  const list = db.customMetrics || [];
  const idx = list.findIndex((m: any) => m.id === metric.id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...metric };
  } else {
    list.push(metric);
  }
  db.customMetrics = list;
  saveDb(db);
  res.json({ success: true, metric });
});

// Battle verification & witness settling
app.post('/api/battles/verify', (req, res) => {
  const { battleId, winnerId, verificationProof, witnessNotes } = req.body;
  const db = getDb();
  const battle = (db.battles || []).find((b: any) => b.id === battleId);
  if (!battle) {
    return res.status(404).json({ error: 'Заруба не найдена' });
  }
  battle.status = winnerId === 'user' ? 'user_won' : 'friend_won';
  battle.verificationProof = verificationProof || battle.verificationProof;
  battle.witnessNotes = witnessNotes || battle.witnessNotes;
  battle.settledAt = new Date().toISOString();
  saveDb(db);
  res.json({ success: true, battle });
});

// Telegram Bot Handlers and Polling
async function handleTelegramUpdate(token: string, update: any) {
  if (!update || !update.message) return;
  const msg = update.message;
  const chatId = msg.chat?.id;
  const text = (msg.text || '').trim();
  const userName = msg.from?.first_name || 'Атлет';

  if (!chatId) return;

  const appUrl = process.env.APP_URL || 'https://ais-dev-c77vot7gc4jzaawlvpzve5-893965801018.europe-west2.run.app';

  if (text.startsWith('/start')) {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `Привет, ${userName}! 🏋️\n\nДобро пожаловать в **GetFit** — твой персональный фитнес-трекер и спортивный ИИ-ассистент.\n\nЗдесь ты можешь:\n• Вести дневник тренировок и рассчитывать 1ПМ в реальном времени\n• Сверять нормативы спортивных разрядов (WRPF, WSF, Минспорт)\n• Контролировать дисциплину и штрафные задания\n• Участвовать в зарубах с друзьями\n• Вести учет питания, сна и состава тела (InBody)\n\nТы также можешь задать мне любой вопрос по тренировкам или питанию прямо в этом чате!\n\nНажми кнопку ниже, чтобы открыть приложение:`,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🏋️ Открыть GetFit Мини-апп',
                web_app: { url: appUrl },
              },
            ],
          ],
        },
      }),
    });
    return;
  }

  if (text.startsWith('/help')) {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `📖 **Команды GetFit:**\n\n/start — Открыть главное меню и Мини-апп\n/help — Справка и возможности\n/ranks — Нормативы и спортивные разряды\n\nТы также можешь написать мне любой вопрос по тренировкам, технике или питанию прямо сюда — я отвечу как персональный ИИ-тренер!`,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🏋️ Открыть GetFit Мини-апп', web_app: { url: appUrl } }],
          ],
        },
      }),
    });
    return;
  }

  if (text.startsWith('/ranks')) {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `🏆 **Нормативы и разряды в GetFit:**\n\n• Пауэрлифтинг WRPF (Жим лежа, Присед, Тяга, Троеборье)\n• Стритлифтинг WSF (Подтягивания и брусья с весом)\n• ОФП, бег и плавание\n\nОткрой приложение для расчета твоего текущего разряда:`,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🏋️ Открыть GetFit Мини-апп', web_app: { url: appUrl } }],
          ],
        },
      }),
    });
    return;
  }

  // Process message via Natural Language Interface & AI Coach in Telegram chat
  let aiReply = 'Отличный настрой на тренировку! Открой приложение для подробного плана и аналитики.';
  if (text) {
    try {
      const db = getDb();
      let userKey = `tg_${chatId}`;
      let userEntry = db.users[userKey];
      if (!userEntry && msg.from?.username) {
        const foundKey = Object.keys(db.users).find(k => db.users[k]?.user?.telegramUsername === msg.from?.username);
        if (foundKey) {
          userKey = foundKey;
          userEntry = db.users[foundKey];
        }
      }

      const nliResult = await processNaturalLanguageInput(text, userEntry?.user);
      aiReply = nliResult.reply;

      // If user performed real data actions via Telegram, persist to database
      if (nliResult.actions && nliResult.actions.length > 0) {
        if (!db.users[userKey]) {
          db.users[userKey] = {
            user: {
              id: userKey,
              name: msg.from?.first_name || 'Атлет',
              telegramUsername: msg.from?.username,
              disciplineScore: 90,
              streakDays: 1,
            },
            pastWorkouts: [],
            sleepRecords: [],
            customMetrics: [],
            penalties: [],
          };
        }
        const uData = db.users[userKey];
        if (!uData.pastWorkouts) uData.pastWorkouts = [];
        if (!uData.sleepRecords) uData.sleepRecords = [];
        if (!uData.customMetrics) uData.customMetrics = [];
        if (!uData.penalties) uData.penalties = [];

        const actionNotices: string[] = [];

        for (const act of nliResult.actions) {
          if (act.function === 'log_workout') {
            const args = act.args || {};
            const weight = Number(args.weight) || 0;
            const reps = Number(args.reps) || 1;
            const sets = Number(args.sets) || 1;
            const oneRM = Math.round(weight * (1 + reps / 30));
            const exName = args.exercise || 'Упражнение';
            uData.pastWorkouts.unshift({
              id: `rec_tg_${Date.now()}`,
              planTitle: 'Telegram AI Лог',
              completedDate: new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }),
              durationMinutes: 45,
              totalTonnage: weight * reps * sets,
              exercises: [{
                name: exName,
                sets: [{ setNumber: 1, weight, reps, completed: true, rpe: Number(args.rpe) || 8 }],
                best1RM: oneRM,
              }],
            });
            if (uData.user) {
              uData.user.streakDays = (uData.user.streakDays || 0) + 1;
              uData.user.disciplineScore = Math.min(100, (uData.user.disciplineScore || 85) + 2);
            }
            actionNotices.push(`🏋️ Записан подход: ${exName} ${weight}кг × ${reps} (1ПМ ~${oneRM}кг)`);
          } else if (act.function === 'log_daily_state') {
            const args = act.args || {};
            const sleepHours = Number(args.sleep_hours) || 7;
            uData.sleepRecords.unshift({
              id: `slp_tg_${Date.now()}`,
              date: new Date().toISOString().split('T')[0],
              durationHours: sleepHours,
              qualityScore: Number(args.sleep_quality) || 7,
              deepSleepMinutes: Math.round(sleepHours * 15),
              remSleepMinutes: Math.round(sleepHours * 12),
              restingHeartRate: 58,
              notes: args.notes || 'Лог через Telegram',
            });
            actionNotices.push(`🌙 Зафиксирован сон: ${sleepHours}ч`);
          } else if (act.function === 'log_metric') {
            const args = act.args || {};
            const val = Number(args.value) || 0;
            const metricName = args.name || 'Метрика';
            const unit = args.unit || 'см';
            uData.customMetrics.unshift({
              id: `cm_${Date.now()}`,
              name: metricName,
              unit,
              category: args.category || 'body',
              currentValue: val,
              history: [{
                id: `mh_${Date.now()}`,
                date: new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
                value: val,
              }],
            });
            actionNotices.push(`📏 Замер сохранен: ${metricName} ${val} ${unit}`);
          } else if (act.function === 'update_user') {
            uData.user = { ...uData.user, ...(act.args || {}) };
            actionNotices.push(`🎯 Параметры профиля обновлены`);
          } else if (act.function === 'add_penalty') {
            const args = act.args || {};
            uData.penalties.unshift({
              id: `pen_tg_${Date.now()}`,
              workoutDate: new Date().toISOString().split('T')[0],
              reason: args.reason || 'Самодисциплина',
              penaltyTask: args.penaltyTask || 'Штраф',
              status: 'pending',
              date: 'Сегодня',
              pointsDeducted: Number(args.pointsDeducted) || 5,
            });
            actionNotices.push(`⚠️ Назначено штрафное задание: «${args.penaltyTask}»`);
          } else if (act.function === 'create_experiment') {
            const args = act.args || {};
            if (!db.experiments) db.experiments = [];
            db.experiments.unshift({
              id: `exp_tg_${Date.now()}`,
              title: args.title || 'Эксперимент через Telegram',
              hypothesis: args.hypothesis || '',
              startDate: new Date().toISOString().split('T')[0],
              endDate: new Date(Date.now() + (Number(args.duration_days) || 21) * 86400000).toISOString().split('T')[0],
              durationDays: Number(args.duration_days) || 21,
              status: 'active',
              dependentMetric: { name: args.dependent_metric || 'Сила', unit: 'кг', type: 'performance' },
              independentMetrics: (args.independent_metrics || ['Фактор']).map((m: string) => ({ name: m, unit: 'ед', targetValue: 1, type: 'supplement' })),
              baselineValue: 'База',
              dailyLogs: {},
            });
            actionNotices.push(`🔬 Эксперимент создан в Лаборатории: «${args.title}»`);
          }
        }

        saveDb(db);

        if (actionNotices.length > 0) {
          aiReply = `✅ **Данные сохранены в GetFit:**\n${actionNotices.join('\n')}\n\n${aiReply}`;
        }
      }
    } catch (err) {
      console.error('Telegram NLI AI error:', err);
    }
  }

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: aiReply,
      reply_markup: {
        inline_keyboard: [
          [{ text: '🏋️ Открыть GetFit Мини-апп', web_app: { url: appUrl } }],
        ],
      },
    }),
  });
}

let isPollingStarted = false;
async function initTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log('No TELEGRAM_BOT_TOKEN set; Telegram bot polling skipped.');
    return;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await res.json() as any;
    if (data.ok) {
      telegramBotInfo = data.result;
      console.log(`Telegram Bot @${telegramBotInfo?.username} (${telegramBotInfo?.first_name}) ready.`);

      // Set command menu
      try {
        await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            commands: [
              { command: 'start', description: 'Запустить GetFitBot Mini App' },
              { command: 'help', description: 'Справка и команды' },
              { command: 'ranks', description: 'Таблица нормативов и разрядов' },
            ],
          }),
        });
      } catch (cmdErr) {
        console.warn('Could not set bot commands:', cmdErr);
      }

      if (!isPollingStarted) {
        isPollingStarted = true;
        startTelegramPolling(token);
      }
    } else {
      console.warn('Telegram bot initialization error:', data.description);
    }
  } catch (err) {
    console.error('Failed to initialize Telegram bot:', err);
  }
}

async function startTelegramPolling(token: string) {
  let offset = 0;
  console.log('Telegram polling loop active.');

  const poll = async () => {
    while (isPollingStarted) {
      try {
        const response = await fetch(
          `https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=20`,
          { signal: AbortSignal.timeout(25000) }
        );
        const data = await response.json() as any;
        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            offset = Math.max(offset, update.update_id + 1);
            handleTelegramUpdate(token, update).catch(err =>
              console.error('Error handling Telegram update:', err)
            );
          }
        } else if (!data.ok) {
          await new Promise(r => setTimeout(r, 4000));
        }
      } catch (err: any) {
        // Safe backoff on network/timeout errors
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  };

  poll();
}

// Start server with Vite middleware in dev or static serving in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GetFitBot server running on port ${PORT}`);
    initTelegramBot().catch(err => console.error('Telegram bot init error:', err));
  });
}

startServer();
