/**
 * Единый фасад сервисного слоя.
 *
 * Выбирает реализацию автоматически:
 *  - если заданы VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — реальная БД
 *    Supabase (PostgreSQL + auth), см. backend/supabase.ts и миграцию в git;
 *  - иначе — локальная эмуляция БД поверх localStorage (backend/db.ts + auth.ts),
 *    которая работает сразу и не требует настройки.
 *
 * Приложение использует только этот фасад, поэтому смена хранилища прозрачна.
 */

import {
  listAccountUsers, login as localLogin, logout as localLogout, register as localRegister, restoreSession,
  type AuthError, type AuthResult, type PublicUser,
} from "./auth";
import { db, type DbSession } from "./db";
import { isSupabase, supabaseBackend } from "./supabase";
import { isRegApi, regapiBackend } from "./regapi";

export type { PublicUser };
export { isSupabase, isRegApi };

export interface Backend {
  mode: "local" | "supabase" | "regapi";
  register(name: string, email: string, password: string): Promise<AuthResult | AuthError>;
  login(email: string, password: string): Promise<AuthResult | AuthError>;
  restore(): Promise<{ user: PublicUser; session: DbSession } | null> | { user: PublicUser; session: DbSession } | null;
  logout(): Promise<void> | void;
  loadState<T>(accountId: string): Promise<T | null> | T | null;
  saveState<T>(accountId: string, state: T): Promise<void> | void;
  listUsers(accountId: string): Promise<PublicUser[]> | PublicUser[];
}

/**
 * Приоритет выбора хранилища:
 *  1. Supabase — если заданы VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY;
 *  2. regapi   — если VITE_BACKEND=regapi (БД MySQL + PHP на хостинге reg.ru);
 *  3. local    — локальная эмуляция поверх localStorage (работает из коробки).
 */
function createBackend(): Backend {
  if (isSupabase()) {
    return {
      mode: "supabase",
      register: (n, e, p) => supabaseBackend.register(n, e, p),
      login: (e, p) => supabaseBackend.login(e, p),
      restore: () => supabaseBackend.restore(),
      logout: () => supabaseBackend.logout(),
      loadState: (id) => supabaseBackend.loadState(id),
      saveState: (id, s) => supabaseBackend.saveState(id, s),
      listUsers: (id) => supabaseBackend.listUsers(id),
    };
  }
  if (isRegApi()) {
    return {
      mode: "regapi",
      register: (n, e, p) => regapiBackend.register(n, e, p),
      login: (e, p) => regapiBackend.login(e, p),
      restore: () => regapiBackend.restore(),
      logout: () => regapiBackend.logout(),
      loadState: (id) => regapiBackend.loadState(id),
      saveState: (id, s) => regapiBackend.saveState(id, s),
      listUsers: (id) => regapiBackend.listUsers(id),
    };
  }
  return {
    mode: "local",
    register: localRegister,
    login: localLogin,
    restore: restoreSession,
    logout: localLogout,
    loadState: (id) => db.loadAccountState(id),
    saveState: (id, s) => db.saveAccountState(id, s),
    listUsers: (id) => listAccountUsers(id),
  };
}

export const backend: Backend = createBackend();

export { validateEmail, validatePassword } from "./auth";
