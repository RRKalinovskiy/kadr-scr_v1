# КАДР — Блок командных тестов

## Обзор

Добавлена возможность хранения тестов команды в отдельной таблице БД. Все пользователи аккаунта имеют полный доступ к этим тестам.

## Изменения в БД

### MySQL (для хостинга reg.ru)

Примените обновлённый файл `/public/create_tables.sql` через phpMyAdmin:

```sql
-- Таблица kadr_team_tests уже включена в схему
-- Поля таблицы:
-- - id: VARCHAR(64) PRIMARY KEY
-- - account_id: VARCHAR(64) NOT NULL
-- - name: VARCHAR(255) NOT NULL
-- - description: TEXT
-- - suite: VARCHAR(255) DEFAULT '__root__'
-- - path: VARCHAR(512) DEFAULT ''
-- - viewports: JSON
-- - assignee: VARCHAR(64)
-- - tags: JSON
-- - test_type: VARCHAR(64) DEFAULT 'auto'
-- - page_url: VARCHAR(1024)
-- - steps: JSON
-- - enabled: TINYINT(1) DEFAULT 1
-- - status: VARCHAR(64) DEFAULT 'idle'
-- - last_run: BIGINT
-- - dur_ms: BIGINT
-- - diff_pct: DECIMAL(5,2) DEFAULT 0
-- - baseline_at: BIGINT
-- - history: JSON
-- - created_by: VARCHAR(64) NOT NULL
-- - created_at: BIGINT NOT NULL
-- - updated_at: BIGINT NOT NULL
```

Также добавлено поле `role` в таблицу `kadr_users` для разграничения прав доступа.

### Supabase (PostgreSQL)

Примените миграцию из `/supabase/migrations/001_init.sql`:

```bash
supabase db push
```

Или выполните SQL в Supabase SQL Editor.

## API эндпоинт

Новый эндпоинт: `/api/team_tests.php`

### GET — получить все тесты команды

**Запрос:**
```
GET /api/team_tests.php
Authorization: Bearer <token>
```

**Ответ:**
```json
{
  "ok": true,
  "tests": [
    {
      "id": "abc123",
      "name": "Главная страница",
      "description": "Проверка главной страницы",
      "suite": "__root__",
      "path": "/",
      "viewports": ["1920x1080"],
      "assignee": "user-id",
      "tags": ["smoke"],
      "testType": "auto",
      "pageUrl": "https://example.com/",
      "steps": [...],
      "enabled": true,
      "status": "idle",
      "lastRun": 1234567890,
      "durMs": 1500,
      "diffPct": 0,
      "baselineAt": 1234567890,
      "history": [...],
      "createdBy": "user-id",
      "createdAt": 1234567890,
      "updatedAt": 1234567890
    }
  ]
}
```

### POST — создать или обновить тест

**Запрос:**
```
POST /api/team_tests.php
Authorization: Bearer <token>
Content-Type: application/json

{
  "id": "abc123", // опционально, если нужно обновить
  "name": "Главная страница",
  "description": "Проверка главной страницы",
  "suite": "__root__",
  "path": "/",
  "viewports": ["1920x1080"],
  "assignee": "user-id",
  "tags": ["smoke"],
  "testType": "auto",
  "pageUrl": "https://example.com/",
  "steps": [...],
  "enabled": true,
  "status": "idle"
}
```

**Ответ:**
```json
{
  "ok": true,
  "id": "abc123"
}
```

### DELETE — удалить тест

**Запрос:**
```
DELETE /api/team_tests.php
Authorization: Bearer <token>
Content-Type: application/json

{
  "id": "abc123"
}
```

**Ответ:**
```json
{
  "ok": true
}
```

## Права доступа

- **MySQL**: Все пользователи аккаунта имеют полный доступ к тестам команды через общую `account_id`.
- **Supabase**: RLS-политики обеспечивают доступ только к тестам своего аккаунта.

## Интеграция на фронтенде

Для работы с командными тестами используйте следующие вызовы:

```typescript
// Получить все тесты команды
const response = await fetch('/api/team_tests.php', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { ok, tests } = await response.json();

// Создать тест
await fetch('/api/team_tests.php', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'Новый тест',
    suite: '__root__',
    // ... остальные поля
  })
});

// Обновить тест
await fetch('/api/team_tests.php', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    id: 'existing-id',
    name: 'Обновлённое название',
    // ... остальные поля
  })
});

// Удалить тест
await fetch('/api/team_tests.php', {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ id: 'test-id' })
});
```

## Развёртывание

1. **Обновите схему БД:**
   - Для MySQL: выполните `/public/create_tables.sql`
   - Для Supabase: примените миграцию `/supabase/migrations/001_init.sql`

2. **Скопируйте файлы API:**
   ```bash
   cp api/team_tests.php public/api/
   cp api/team_tests.php dist/api/
   ```

3. **Проверьте права доступа:**
   - Убедитесь, что веб-сервер имеет доступ к файлам
   - Проверьте корректность подключения к БД

4. **Протестируйте API:**
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" https://your-domain.ru/api/team_tests.php
   ```

## Примечания

- Тесты команды не привязаны к конкретной коллекции
- Все пользователи аккаунта видят и могут редактировать все командные тесты
- История тестов хранится в JSON-поле `history`
- Поле `role` в таблице пользователей зарезервировано для будущего разграничения прав
