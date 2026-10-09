# 🏋️ GetFitBot

Telegram Mini App для учёта тренировок, питания и сна: 1ПМ-калькулятор, спортивные разряды, ИИ-тренер, зарубы с друзьями.

**Стек:** React 19 + Vite + Tailwind (клиент) · Express + TypeScript (сервер) · Postgres/Supabase · Groq + Gemini (ИИ) · Telegram Bot API.

## Быстрый старт

```bash
npm install
npm run dev      # http://localhost:3000
```

В дев-режиме вход без Telegram разрешён: создаётся локальная сессия `dev:<id>`.
Данные пишутся в `data/cloud_db.json`, пока не задан `DATABASE_URL`.

## Переменные окружения

Скопируй `.env.example` в `.env`:

| Переменная | Зачем |
|---|---|
| `TELEGRAM_BOT_TOKEN` | бот, проверка initData, уведомления |
| `GROQ_API_KEY` | основной ИИ-провайдер (бесплатный) |
| `GEMINI_API_KEY` | резервный ИИ-провайдер (недоступен из РФ) |
| `APP_URL` | публичный адрес Mini App (для webhook и ссылок-приглашений) |
| `DATABASE_URL` | Postgres/Supabase. Без него — локальный JSON-файл |
| `SESSION_SECRET` | подпись сессий (если пусто — выводится из токена бота) |
| `TELEGRAM_WEBHOOK_SECRET` | проверка, что webhook зовёт именно Telegram |
| `GROQ_MODEL` / `GEMINI_MODEL` | переопределение модели (по умолчанию `qwen/qwen3.8-27b`, `gemini-flash-latest`) |

## Команды

```bash
npm run dev          # сервер разработки (Vite middleware + бот на polling)
npm run build        # сборка клиента и сервера в dist/
npm start            # прод-запуск из dist/
npm run lint         # проверка типов (tsc --noEmit)
npm run doctor       # проверка окружения перед деплоем: токен, ключи, APP_URL, база
npm run test:client  # логика входа и синхронизации — 13 проверок, без сервера
npm run test:pg      # Postgres-ветка хранилища на in-memory Postgres — 21 проверка
npm run test:css     # сборка Tailwind v4 из src/index.css — 15 проверок
npm run test:render  # рендер приложения и всех 16 экранов — 24 проверки
npm run test:dom     # DOM (jsdom): гидратация из облака и переключение вкладок — 37 проверок
npm run test:notify  # логика напоминаний — 17 проверок
npm run test:smoke   # API целиком — 38 проверок, нужен запущенный сервер
```

## Архитектура

```
src/                 клиент
  lib/api.ts         сессия по Telegram initData, авторизованные запросы, облачная синхронизация
  lib/telegram.ts    обёртка WebApp SDK: тема, safe-area, haptics, кнопка «Назад», шаринг
  components/        экраны и модалки
server.ts            HTTP API, ИИ-слой, бот
server/auth.ts       проверка initData (HMAC + срок жизни), сессионные токены
server/storage.ts    Postgres с миграциями, JSON-файл как fallback для локалки
scripts/             сквозные тесты
```

**Безопасность.** Все `/api/*`, кроме `health`, `auth` и `webhook`, требуют сессию.
Идентификатор пользователя берётся только из подписанного токена — подставить чужой нельзя.
`initData` проверяется по HMAC-SHA256 с контролем `auth_date`, сравнение — timing-safe.
На ИИ-эндпоинты стоит лимит 40 запросов / 5 минут на пользователя.

## Деплой

Полная пошаговая инструкция — [DEPLOY_GUIDE.md](DEPLOY_GUIDE.md): Supabase + Render Blueprint, бесплатные тарифы, диагностика.
