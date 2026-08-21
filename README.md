# КАДР — скрин-сборки автотестов

Инструмент для настройки и запуска визуальных (скриншотных) автотестов:
наборы сценариев по коллекциям, ручной редактор шагов (клик / перетаскивание /
область), живые прогоны со сверкой кадра с эталоном, карточка прогона и
статистика. Работает локально из коробки и подключается к облачной БД
(Supabase) для регистрации аккаунтов и хранения тестов.

## Быстрый старт

```bash
npm install
npm run dev     # локальная разработка
npm run build   # сборка → dist/ (один самодостаточный index.html)
```

## Деплой: из Git сразу на стенд

Сборка — **один файл** `dist/index.html` (весь JS/CSS заинлайнен), поэтому
подходит любой хостинг с «импортом из Git». Конфиги уже в репозитории:

| Платформа      | Файл                    | Что делать                                        |
| -------------- | ----------------------- | ------------------------------------------------- |
| **reg.ru / FTP** | `.github/workflows/deploy-regru.yml` | Секреты FTP в GitHub → push → загрузка по FTP |
| **Netlify**    | `netlify.toml`          | Import an existing project → выбрать репозиторий   |
| **Vercel**     | `vercel.json`           | Add New → Project → импорт репозитория             |
| **GitHub Pages** | `.github/workflows/deploy.yml` | Settings → Pages → Source: «GitHub Actions» |

Каждый `git push` автоматически пересобирает и обновляет стенд.
Подробная инструкция — в [`DEPLOY.md`](./DEPLOY.md).

## Подключение облачной БД (Supabase)

1. Создайте проект на [supabase.com](https://supabase.com).
2. Примените схему: SQL Editor → вставить `supabase/migrations/001_init.sql` → Run.
3. Скопируйте `.env.example` в `.env.production` и впишите ключи
   (Settings → API: Project URL и anon key). Закоммитьте `.env.production`.
4. Перезапустите деплой (push или Actions → Run workflow).

Если `.env.production` нет — сайт работает в локальном режиме (localStorage).
Подробнее — в [`DEPLOY.md`](./DEPLOY.md).

## Структура

- `src/App.tsx` — оркестратор: сессия, рабочие области, страницы
- `src/backend/` — сервисный слой (local / Supabase), аутентификация, схемы
- `src/components/` — панели, карточки, редактор шагов, экран входа
- `supabase/migrations/` — SQL-схема БД (коммитится в git)
