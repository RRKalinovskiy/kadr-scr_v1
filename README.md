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
| **reg.ru «Сайт из Git»** | `.github/workflows/deploy-regru.yml` | push → подключите reg.ru к ветке **`deploy`** |
| **reg.ru / FTP** | тот же workflow          | Секреты FTP в GitHub → push → загрузка по FTP     |
| **Netlify**    | `netlify.toml`          | Import an existing project → выбрать репозиторий   |
| **Vercel**     | `vercel.json`           | Add New → Project → импорт репозитория             |
| **GitHub Pages** | `.github/workflows/deploy.yml` | Settings → Pages → Source: «GitHub Actions» |

Каждый `git push` автоматически пересобирает сайт и обновляет ветку `deploy`
(а при настроенном FTP — ещё и грузит его на хостинг).

> **Важно для reg.ru:** подключайте «Сайт из Git» к ветке **`deploy`**, а не к
> `main`. В `main` лежит исходный код, в `deploy` — только сборка. Подробнее —
> в [`DEPLOY.md`](./DEPLOY.md).

## Подключение БД

Два варианта (приоритет у Supabase):

- **БД на reg.ru (MySQL + PHP-API)** — recommended для вашего хостинга.
  Режим `VITE_BACKEND=regapi` (в workflow уже по умолчанию). Инструкция:
  создать БД в reg.ru → применить `mysql/schema.sql` → заполнить
  `api/config.php` → push. Подробнее в [`DEPLOY.md`](./DEPLOY.md).
- **Supabase (облако)** — шаги ниже.

### Подключение облачной БД (Supabase)

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
