/**
 * Сервисный слой хранения («БД») для КАДР.
 *
 * Работает в двух режимах:
 *  - LOCAL  — полностью клиентская эмуляция БД поверх localStorage (включён по
 *    умолчанию, работает сразу, синхронизирует вкладки через событие `storage`).
 *  - SUPABASE — реальная PostgreSQL + встроенная аутентификация. Включается,
 *    когда заданы VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY (см. backend/supabase.ts
 *    и supabase/migrations/001_init.sql — схема коммитится в git).
 *
 * Таблицы (логические): users, accounts, sessions, account_state (данные тестов
 * и коллекций, привязанные к аккаунту).
 */

export interface DbUser {
  id: string;
  accountId: string;
  name: string;
  email: string;
  /** SHA-256(salt + ":" + password), hex */
  passwordHash: string;
  salt: string;
  createdAt: number;
}

export interface DbAccount {
  id: string;
  ownerUserId: string;
  name: string;
  plan: string;
  createdAt: number;
}

export interface DbSession {
  token: string;
  userId: string;
  accountId: string;
  createdAt: number;
  expiresAt: number;
}

const NS = "kadr-db";
const K = {
  users: `${NS}:users`,
  accounts: `${NS}:accounts`,
  sessions: `${NS}:sessions`,
  accountState: (accountId: string) => `${NS}:account:${accountId}:state`,
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* квота */
  }
}

export const db = {
  /* ---------- users ---------- */
  listUsers(): DbUser[] {
    return read<DbUser[]>(K.users, []);
  },
  findUserByEmail(email: string): DbUser | undefined {
    const norm = email.trim().toLowerCase();
    return db.listUsers().find((u) => u.email.toLowerCase() === norm);
  },
  getUser(id: string): DbUser | undefined {
    return db.listUsers().find((u) => u.id === id);
  },
  insertUser(u: DbUser) {
    write(K.users, [...db.listUsers(), u]);
  },

  /* ---------- accounts ---------- */
  listAccounts(): DbAccount[] {
    return read<DbAccount[]>(K.accounts, []);
  },
  getAccount(id: string): DbAccount | undefined {
    return db.listAccounts().find((a) => a.id === id);
  },
  insertAccount(a: DbAccount) {
    write(K.accounts, [...db.listAccounts(), a]);
  },
  usersOfAccount(accountId: string): DbUser[] {
    return db.listUsers().filter((u) => u.accountId === accountId);
  },

  /* ---------- sessions ---------- */
  listSessions(): DbSession[] {
    const now = Date.now();
    const all = read<DbSession[]>(K.sessions, []).filter((s) => s.expiresAt > now);
    write(K.sessions, all);
    return all;
  },
  insertSession(s: DbSession) {
    write(K.sessions, [...db.listSessions(), s]);
  },
  getSession(token: string): DbSession | undefined {
    return db.listSessions().find((s) => s.token === token);
  },
  deleteSession(token: string) {
    write(K.sessions, db.listSessions().filter((s) => s.token !== token));
  },

  /* ---------- account state (данные тестов/коллекций) ---------- */
  loadAccountState<T>(accountId: string): T | null {
    return read<T | null>(K.accountState(accountId), null);
  },
  saveAccountState<T>(accountId: string, state: T) {
    write(K.accountState(accountId), state);
  },

  /* ---------- user settings ---------- */
  loadUserSettings<T>(accountId: string): T | null {
    return read<T | null>(`${NS}:account:${accountId}:settings`, null);
  },
  saveUserSettings<T>(accountId: string, settings: T) {
    write(`${NS}:account:${accountId}:settings`, settings);
  },
};

/* ---------- синхронизация вкладок («realtime» в LOCAL-режиме) ---------- */

export function onDbChange(cb: () => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key && e.key.startsWith(NS)) cb();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}
