# Локальный запуск backend (Next.js App Router)

## Быстрый старт

1. Установите зависимости:

```bash
npm i
```

2. Создайте `.env.local` в корне проекта и укажите подключение к Neon:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DB?sslmode=require"
NEXT_PUBLIC_API_MODE="mock"
```

`NEXT_PUBLIC_API_MODE` оставлен в `mock` по умолчанию, чтобы UI продолжал работать на моках.

3. Запустите dev-сервер:

```bash
npm run dev
```

## Проверка Swagger локально

Откройте:

```
http://localhost:3000/swagger
```

В Swagger UI используйте кнопку **Try it out** — запросы пойдут на `/api/...` ручки и вернут данные из БД.

## Проверка продакшена (Vercel)

1. Убедитесь, что переменная окружения `DATABASE_URL` задана в Vercel.
2. Откройте:

```
https://cc-analytics-ui.vercel.app/swagger
```

3. Проверьте запросы через **Try it out** — ответы должны приходить из Neon.
