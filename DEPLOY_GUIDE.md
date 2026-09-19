# 🏋️ GetFitBot - Telegram Mini App для трекинга тренировок

## 🚀 Быстрый старт для тестирования в Telegram

### 1. Создай Telegram бота
1. Открой @BotFather в Telegram
2. Отправь `/newbot`
3. Придумай имя и юзернейм (должен заканчиваться на `bot`)
4. Скопируй полученный токен

### 2. Настрой .env файл
```bash
TELEGRAM_BOT_TOKEN=1234567890:AAF...  # твой токен из @BotFather
GROQ_API_KEY=gsk_...  # получи бесплатно на https://console.groq.com
GEMINI_API_KEY=...  # опционально, https://aistudio.google.com
APP_URL=https://твой-домен.com  # будет после деплоя
```

### 3. Получи Groq API Key (БЕСПЛАТНО)
1. Иди на https://console.groq.com
2. Зарегистрируйся
3. Создай API key в разделе "API Keys"
4. Копируй в `.env`

**Почему Groq?**
- 🔥 Бесплатно (Llama 3.3 70B)
- ⚡ Быстро (<500ms ответ)
- 🎯 Отлично понимает JSON
- 📈 Лимиты: 30 запросов/мин, 14k токенов/запрос

### 4. Запусти локально для тестов
```bash
npm run dev
```

Открой http://localhost:3000 в браузере

### 5. Задеплой на Railway (БЕСПЛАТНО)

#### Вариант A: Railway App
1. Зайди на https://railway.app
2. "New Project" → "Deploy from GitHub repo"
3. Выбери свой репозиторий
4. В Settings → Variables добавь все переменные из `.env`
5. Deploy!

#### Вариант B: Vercel + Supabase
1. **Frontend на Vercel:**
   - `vercel deploy --prod`
   
2. **База данных на Supabase:**
   - Создай проект на https://supabase.com
   - Получи URL и ключ в Settings → API
   - Добавь в переменные окружения

### 6. Подключи к Telegram

1. Открой @BotFather
2. Отправь `/mybots` → выбери своего бота
3. Bot Settings → Menu Button → Configure Menu Button
4. Отправь ссылку на приложение (из Railway/Vercel)
5. Дай название кнопке "🏋️ Открыть GetFit"

**ИЛИ через WebApp URL:**
```
https://t.me/твой_бот?startapp=getfit
```

### 7. Проверь работу
1. Открой своего бота в Telegram
2. Нажми кнопку меню или отправь `/start`
3. Мини-апп должен открыться внутри Telegram!

---

## 📊 Функционал приложения

### ✅ Уже реализовано:
- **Тренировки**: План, логирование, 1ПМ калькулятор
- **ИИ-тренер**: Анализ в реальном времени (Groq/Gemini)
- **Нормативы**: WRPF, WSF, Минспорт
- **Зарубы**: Friend Battles с прогрессом
- **Дисциплина**: Штрафы, стрики, марафоны
- **Питание**: Калории, БЖУ, продукты
- **Сон**: Трекинг, качество, восстановление
- **Лаборатория**: N=1 эксперименты, корреляции
- **Периодизация**: Training Blocks (циклы)
- **Кастомные метрики**: Любые показатели
- **Telegram интеграция**: Auth, уведомления, бот

### 🔧 Что добавить для максимальной гибкости:

#### 1. Периодизация и циклы (Training Blocks)
**Что это:** Группировка тренировок в макро-/микроциклы
- **Макроцикл**: 3 месяца "Набор массы"
- **Микроцикл**: 1 неделя с конкретными задачами
- **Автопрогрессия**: Увеличение весов по формуле

**Как работает:**
```typescript
interface TrainingBlock {
  type: 'hypertrophy' | 'strength' | 'deload';
  startDate: string;
  endDate: string;
  goals: ["+5кг к жиму", "+2кг к весу тела"];
  targetRpeRange: [7, 9];
  workouts: WorkoutRecord[];
}
```

#### 2. Восстановление и Readiness
**HRV (вариабельность сердечного ритма):**
- Интеграция с Apple Health / Google Fit
- Утренний замер через камеру телефона
- Корреляция с результатами тренировок

**RPE/RIR авто-расчет:**
- RPE (Rate of Perceived Exertion): 1-10 шкала усилия
- RIR (Reps in Reserve): сколько осталось в запасе
- Автоматическая рекомендация: "Снизь вес на 5%"

#### 3. Аналитика и корреляции
**Примеры вопросов:**
- "Какой сон влияет на 1ПМ в жиме?"
- "Креатин vs прогресс в приседе"
- "Стресс на работе vs результаты в тяге"

**Визуализация:**
- Scatter plot: Сон (часы) → 1ПМ (кг)
- Heatmap: Дни недели → Средний тоннаж
- Timeline: Эксперимент → Динамика метрик

#### 4. Социальные фичи
**Лента достижений:**
```typescript
interface CommunityPost {
  authorName: string;
  type: 'record' | 'workout_plan' | 'complex';
  recordValue: "150кг × 3";
  likes: number;
  clones: number; // сколько скопировали программу
}
```

**Публичные рекорды:**
- Топ-10 по жиму/приседу/тяге
- Фильтр по весовым категориям
- Верификация по видео

#### 5. Экспорт/Импорт данных
**CSV экспорт:**
```csv
date,exercise,weight,reps,rpe,1RM
2025-01-15,Жим лежа,100,8,8,126
2025-01-15,Присед,140,5,9,168
```

**Google Sheets синхронизация:**
- Google Apps Script webhook
- Авто-обновление при каждой тренировке
- Сводные таблицы и графики

**Backup в облако:**
- JSON дамп всех данных
- Restore одной кнопкой
- Share программой с другом (ссылка)

#### 6. Умные уведомления
**Telegram Push:**
- "⏰ Пора на тренировку! (День ног)"
- "😴 Недосып: снизь интенсивность на 10%"
- "🔥 Через 3 дня рекорд в жиме!"
- "📉 Разгрузка нужна: высокий fatigue"

**Триггеры:**
- Время суток (scheduled)
- Пропуск тренировки (missed)
- Новый рекорд (achievement)
- Окончание эксперимента (analysis ready)

---

## 🗄️ База данных: варианты

### Вариант 1: Google Sheets (БЕСПЛАТНО, просто)
**Плюсы:**
- ✅ Полностью бесплатно
- ✅ Видишь данные глазами
- ✅ Легко экспортировать
- ✅ Нет лимитов на запись

**Минусы:**
- ❌ Медленнее чем SQL (~1-2 сек)
- ❌ Нет реляционных связей
- ❌ Ручная настройка Apps Script

**Настройка:**
1. Создай Google Sheet
2. Tools → Script Editor
3. Вставь код вебхука (см. `googleAppsScript.js`)
4. Deploy → Web App → Anyone with link
5. Копируй URL в `GOOGLE_APPS_SCRIPT_URL`

### Вариант 2: Supabase (PostgreSQL, 500MB бесплатно)
**Плюсы:**
- ✅ Настоящая SQL база
- ✅ Real-time подписки
- ✅ REST API из коробки
- ✅ 500MB бесплатно навсегда

**Минусы:**
- ❌ Нужно учить SQL
- ❌ Лимит 500MB (~1M записей)

**Схема таблиц:**
```sql
CREATE TABLE users (
  telegram_id BIGINT PRIMARY KEY,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE workouts (
  id UUID DEFAULT gen_random_uuid(),
  user_id BIGINT REFERENCES users(telegram_id),
  title TEXT,
  started_at TIMESTAMPTZ,
  duration_minutes INT,
  total_tonnage NUMERIC
);

CREATE TABLE experiments (
  id UUID DEFAULT gen_random_uuid(),
  user_id BIGINT REFERENCES users(telegram_id),
  title TEXT,
  hypothesis TEXT,
  status TEXT CHECK (status IN ('active', 'completed', 'paused'))
);
```

### Вариант 3: PlanetScale (MySQL, 5GB бесплатно)
**Плюсы:**
- ✅ 5GB бесплатно
- ✅ Ветвление схем (branching)
- ✅ Быстрые миграции

**Минусы:**
- ❌ Нет бесплатного tier после марта 2024 (только trial)

### Рекомендация:
**Для себя и пары друзей:** Google Sheets достаточно
**Для публичного релиза:** Supabase + Railway

---

## 🤖 ИИ API: сравнение

| Провайдер | Модель | Бесплатно | Скорость | Качество | Лимиты |
|-----------|--------|-----------|----------|----------|--------|
| **Groq** | Llama 3.3 70B | ✅ Да | ⚡ <500ms | 🎯 9/10 | 30/min |
| **Gemini** | 2.5 Flash | ✅ Да | 🐌 2-5сек | 🎯 8/10 | 15/min |
| **Ollama** | Llama 3.1 | ✅ Локально | ⚡ <1сек | 🎯 8/10 | ∞ |
| **OpenAI** | GPT-4o-mini | ❌ $0.15/1M | ⚡ <1сек | 🎯 10/10 | Платно |

**Рекомендация:**
1. **Основной:** Groq (быстро, бесплатно, качественно)
2. **Фолбэк:** Gemini (если Groq упал)
3. **Локально:** Ollama для дебага

---

## 📱 Как открыть в Telegram прямо сейчас

### Метод 1: ngrok туннель (для тестов)
```bash
# Установи ngrok
npm install -g ngrok

# Запусти сервер
npm run dev

# Открой туннель
ngrok http 3000
```

Копируй HTTPS URL из ngrok → вставь в @BotFather как Web App URL

### Метод 2: Railway деплой (навсегда)
1. Fork этот репозиторий
2. Deploy на Railway
3. Копируй домен типа `your-app.railway.app`
4. Вставь в @BotFather

---

## 🆘 Troubleshooting

**"Init data invalid"**
- Проверь что TELEGRAM_BOT_TOKEN правильный
- Убедись что открываешь через своего бота

**"AI не отвечает"**
- Проверь GROQ_API_KEY в .env
- Посмотри логи: `railway logs` или `docker logs`

**"Данные не сохраняются"**
- Проверь права записи в папку `data/`
- Для Google Sheets: проверь что Apps Script deployed как Web App

---

## 📚 Дополнительные ресурсы

- [Telegram WebApp Docs](https://core.telegram.org/bots/webapps)
- [Groq API Docs](https://console.groq.com/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Railway Deploy Guide](https://docs.railway.app/deploy)
