-- ============================================================
-- КАДР · скрин-сборки автотестов — схема MySQL для хостинга reg.ru
-- Применить: reg.ru → «Базы данных» → phpMyAdmin → вкладка SQL → вставить → «Вперёд»
-- Таблицы имеют префикс kadr_, чтобы не пересекаться с другими сайтами на БД.
-- ============================================================

CREATE TABLE IF NOT EXISTS kadr_accounts (
  id         VARCHAR(64)  NOT NULL PRIMARY KEY,
  name       VARCHAR(255) NOT NULL DEFAULT '',
  plan       VARCHAR(64)  NOT NULL DEFAULT 'team',
  created_at BIGINT       NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS kadr_users (
  id            VARCHAR(64)  NOT NULL PRIMARY KEY,
  account_id    VARCHAR(64)  NOT NULL,
  name          VARCHAR(255) NOT NULL DEFAULT '',
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(64)  NOT NULL DEFAULT 'member',
  created_at    BIGINT       NOT NULL,
  UNIQUE KEY uq_email (email),
  KEY idx_account (account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS kadr_sessions (
  token      VARCHAR(128) NOT NULL PRIMARY KEY,
  user_id    VARCHAR(64)  NOT NULL,
  account_id VARCHAR(64)  NOT NULL,
  created_at BIGINT       NOT NULL,
  expires_at BIGINT       NOT NULL,
  last_activity BIGINT    NOT NULL,
  KEY idx_expires (expires_at),
  KEY idx_last_activity (last_activity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS kadr_account_state (
  account_id VARCHAR(64) NOT NULL PRIMARY KEY,
  state      LONGTEXT    NOT NULL,
  updated_at BIGINT      NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- ТАБЛИЦА КОМАНДНЫХ ТЕСТОВ
-- Хранит тесты, доступные всей команде (не привязаны к конкретной коллекции)
-- ============================================================

CREATE TABLE IF NOT EXISTS kadr_team_tests (
  id           VARCHAR(64)  NOT NULL PRIMARY KEY,
  account_id   VARCHAR(64)  NOT NULL,
  name         VARCHAR(255) NOT NULL DEFAULT '',
  description  TEXT,
  suite        VARCHAR(255) NOT NULL DEFAULT '__root__',
  path         VARCHAR(512) NOT NULL DEFAULT '',
  viewports    JSON,
  assignee     VARCHAR(64),
  tags         JSON,
  test_type    VARCHAR(64)  NOT NULL DEFAULT 'auto',
  page_url     VARCHAR(1024),
  steps        JSON,
  enabled      TINYINT(1)   NOT NULL DEFAULT 1,
  status       VARCHAR(64)  NOT NULL DEFAULT 'idle',
  last_run     BIGINT,
  dur_ms       BIGINT,
  diff_pct     DECIMAL(5,2) DEFAULT 0,
  baseline_at  BIGINT,
  history      JSON,
  created_by   VARCHAR(64)  NOT NULL,
  created_at   BIGINT       NOT NULL,
  updated_at   BIGINT       NOT NULL,
  KEY idx_account (account_id),
  KEY idx_suite (suite),
  KEY idx_status (status),
  KEY idx_created_by (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
