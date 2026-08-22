-- SQL скрипт для создания таблиц в базе данных u3617849_default
-- Выполните этот скрипт через phpMyAdmin или консоль MySQL на хостинге reg.ru

-- Таблица аккаунтов (команд)
CREATE TABLE IF NOT EXISTS kadr_accounts (
  id         VARCHAR(64)  NOT NULL PRIMARY KEY,
  name       VARCHAR(255) NOT NULL DEFAULT '',
  plan       VARCHAR(64)  NOT NULL DEFAULT 'team',
  created_at BIGINT       NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Таблица пользователей
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

-- Таблица сессий с поддержкой таймаута неактивности
CREATE TABLE IF NOT EXISTS kadr_sessions (
  token         VARCHAR(128) NOT NULL PRIMARY KEY,
  user_id       VARCHAR(64)  NOT NULL,
  account_id    VARCHAR(64)  NOT NULL,
  created_at    BIGINT       NOT NULL,
  expires_at    BIGINT       NOT NULL,
  last_activity BIGINT       NOT NULL,
  KEY idx_expires (expires_at),
  KEY idx_last_activity (last_activity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Таблица состояния аккаунта
CREATE TABLE IF NOT EXISTS kadr_account_state (
  account_id VARCHAR(64) NOT NULL PRIMARY KEY,
  state      LONGTEXT    NOT NULL,
  updated_at BIGINT      NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Таблица команд (teams) - для совместимости
CREATE TABLE IF NOT EXISTS teams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME DEFAULT NULL,
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Таблица пользователей (users) - для совместимости
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    team_id INT NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'member', 'viewer') DEFAULT 'member',
    created_at DATETIME NOT NULL,
    updated_at DATETIME DEFAULT NULL,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    INDEX idx_team_id (team_id),
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Таблица коллекций (collections)
CREATE TABLE IF NOT EXISTS collections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    team_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by INT NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME DEFAULT NULL,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
    INDEX idx_team_id (team_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Таблица тестов (tests)
CREATE TABLE IF NOT EXISTS tests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    collection_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    steps JSON,
    expected_screenshot VARCHAR(255),
    status ENUM('pending', 'running', 'passed', 'failed') DEFAULT 'pending',
    created_at DATETIME NOT NULL,
    updated_at DATETIME DEFAULT NULL,
    last_run_at DATETIME DEFAULT NULL,
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
    INDEX idx_collection_id (collection_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Таблица результатов прогонов (test_runs)
CREATE TABLE IF NOT EXISTS test_runs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    test_id INT NOT NULL,
    run_by INT NOT NULL,
    status ENUM('passed', 'failed', 'error') NOT NULL,
    screenshot_path VARCHAR(255),
    diff_path VARCHAR(255),
    error_message TEXT,
    duration_ms INT DEFAULT 0,
    created_at DATETIME NOT NULL,
    FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE,
    FOREIGN KEY (run_by) REFERENCES users(id) ON DELETE RESTRICT,
    INDEX idx_test_id (test_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
