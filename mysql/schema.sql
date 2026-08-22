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
