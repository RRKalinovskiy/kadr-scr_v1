/**
 * Аутентификация для КАДР.
 *
 * LOCAL-режим: пароль никогда не хранится в открытом виде — только
 * SHA-256(salt + ":" + password) через Web Crypto API. Сессия — случайный
 * токен с временем жизни (по умолчанию 7 дней), хранится в localStorage.
 *
 * SUPABASE-режим (когда заданы ключи): используется supabase.auth — регистрация,
 * логин и сессии целиком на стороне Supabase (см. backend/supabase.ts).
 */

import { db, type DbAccount, type DbSession, type DbUser } from "./db";

const SESSION_KEY = "kadr-db:session-token";
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000; // 7 дней

export interface PublicUser {
  id: string;
  accountId: string;
  name: string;
  email: string;
}

export interface AuthResult {
  ok: true;
  user: PublicUser;
  session: DbSession;
}
export interface AuthError {
  ok: false;
  error: string;
}

/* ---------- crypto ---------- */

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function toPublic(u: DbUser): PublicUser {
  return { id: u.id, accountId: u.accountId, name: u.name, email: u.email };
}

function createSession(userId: string, accountId: string): DbSession {
  const session: DbSession = {
    token: randomHex(32),
    userId,
    accountId,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL,
  };
  db.insertSession(session);
  localStorage.setItem(SESSION_KEY, session.token);
  return session;
}

/* ---------- валидация ---------- */

export function validateEmail(email: string): string | null {
  const v = email.trim();
  if (!v) return "Укажите email";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "Некорректный email";
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return "Укажите пароль";
  if (password.length < 6) return "Пароль должен быть не короче 6 символов";
  return null;
}

/* ---------- API ---------- */

export async function register(name: string, email: string, password: string): Promise<AuthResult | AuthError> {
  const emailErr = validateEmail(email);
  if (emailErr) return { ok: false, error: emailErr };
  const passErr = validatePassword(password);
  if (passErr) return { ok: false, error: passErr };
  if (!name.trim()) return { ok: false, error: "Укажите имя" };

  if (db.findUserByEmail(email)) {
    return { ok: false, error: "Пользователь с таким email уже зарегистрирован" };
  }

  const accountId = randomHex(8);
  const userId = randomHex(8);
  const salt = randomHex(16);
  const passwordHash = await hashPassword(password, salt);
  const now = Date.now();

  const account: DbAccount = {
    id: accountId,
    ownerUserId: userId,
    name: `${name.trim()} · рабочее место`,
    plan: "team",
    createdAt: now,
  };
  const user: DbUser = {
    id: userId,
    accountId,
    name: name.trim(),
    email: email.trim(),
    passwordHash,
    salt,
    createdAt: now,
  };

  db.insertAccount(account);
  db.insertUser(user);
  const session = createSession(userId, accountId);
  return { ok: true, user: toPublic(user), session };
}

export async function login(email: string, password: string): Promise<AuthResult | AuthError> {
  const user = db.findUserByEmail(email);
  if (!user) return { ok: false, error: "Пользователь с таким email не найден" };

  const candidate = await hashPassword(password, user.salt);
  if (candidate !== user.passwordHash) {
    return { ok: false, error: "Неверный пароль" };
  }

  const session = createSession(user.id, user.accountId);
  return { ok: true, user: toPublic(user), session };
}

/** Восстанавливает текущую сессию (если есть и не истекла). */
export function restoreSession(): { user: PublicUser; session: DbSession } | null {
  const token = localStorage.getItem(SESSION_KEY);
  if (!token) return null;
  const session = db.getSession(token);
  if (!session) {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
  const user = db.getUser(session.userId);
  if (!user) {
    db.deleteSession(token);
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
  return { user: toPublic(user), session };
}

export function logout() {
  const token = localStorage.getItem(SESSION_KEY);
  if (token) db.deleteSession(token);
  localStorage.removeItem(SESSION_KEY);
}

/** Список пользователей рабочего места (аккаунта) — для раздела «Пользователи». */
export function listAccountUsers(accountId: string): PublicUser[] {
  return db.usersOfAccount(accountId).map(toPublic);
}
