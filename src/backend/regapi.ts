/**
 * Адаптер «БД на reg.ru»: PHP-API (папка api/) + MySQL на хостинге.
 *
 * Включается переменной окружения VITE_BACKEND=regapi (см. .env.example).
 * База запросов — VITE_API_BASE, по умолчанию «/api» (тот же домен, что и сайт,
 * поэтому CORS не требуется).
 *
 * Токен сессии хранится в localStorage и отправляется заголовком
 * «Authorization: Bearer <token>».
 */

import type { PublicUser } from "./auth";
import type { DbSession } from "./db";

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const BASE = env.VITE_API_BASE ?? "/api";
const TOKEN_KEY = "kadr-regapi-token";

export const isRegApi = (): boolean => env.VITE_BACKEND === "regapi";

async function req<T = Record<string, unknown>>(
  path: string,
  opts: { method?: string; body?: unknown; token?: string | null } = {},
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;
  const res = await fetch(`${BASE}/${path}`, {
    method: opts.method ?? "POST",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    /* сервер вернул не-JSON */
  }
  if (!res.ok || data.ok === false) {
    throw new Error((data.error as string) ?? `Ошибка запроса (HTTP ${res.status})`);
  }
  return data as T;
}

interface ApiSession {
  token: string;
  userId: string;
  accountId: string;
  createdAt: number;
  expiresAt: number;
}

function toDbSession(s: ApiSession): DbSession {
  return {
    token: s.token,
    userId: s.userId,
    accountId: s.accountId,
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
  };
}

function storeToken(t: string | null) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

export const regapiBackend = {
  async register(name: string, email: string, password: string) {
    try {
      const d = await req<{ ok: boolean; user: PublicUser; session: ApiSession }>("register.php", {
        body: { name, email, password },
      });
      if (!d.session || !d.user) {
        throw new Error("Сервер вернул неполный ответ — проверьте, что PHP-API и база данных настроены");
      }
      storeToken(d.session.token);
      return { ok: true as const, user: d.user, session: toDbSession(d.session) };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Не удалось зарегистрироваться" };
    }
  },

  async login(email: string, password: string) {
    try {
      const d = await req<{ ok: boolean; user: PublicUser; session: ApiSession }>("login.php", {
        body: { email, password },
      });
      if (!d.session || !d.user) {
        throw new Error("Сервер вернул неполный ответ — проверьте, что PHP-API и база данных настроены");
      }
      storeToken(d.session.token);
      return { ok: true as const, user: d.user, session: toDbSession(d.session) };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Не удалось войти" };
    }
  },

  async restore(): Promise<{ user: PublicUser; session: DbSession } | null> {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;
    try {
      const d = await req<{ ok: boolean; user: PublicUser; session: ApiSession }>("restore.php", { token });
      if (!d.session || !d.user) {
        storeToken(null);
        return null;
      }
      return { user: d.user, session: toDbSession(d.session) };
    } catch {
      storeToken(null);
      return null;
    }
  },

  async logout(): Promise<void> {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      try {
        await req("logout.php", { token });
      } catch {
        /* токен уже недействителен — просто чистим */
      }
    }
    storeToken(null);
  },

  async loadState<T>(accountId: string): Promise<T | null> {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;
    try {
      const d = await req<{ ok: boolean; state: T | null }>("state.php", { method: "GET", token });
      return d.state ?? null;
    } catch {
      return null;
    }
  },

  async saveState<T>(accountId: string, state: T): Promise<void> {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    try {
      await req("state.php", { method: "POST", token, body: { state } });
    } catch {
      /* нет связи с БД — данные останутся в локальном кеше */
    }
  },

  async listUsers(accountId: string): Promise<PublicUser[]> {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return [];
    try {
      const d = await req<{ ok: boolean; users: PublicUser[] }>("users.php", { method: "GET", token });
      return d.users ?? [];
    } catch {
      return [];
    }
  },
};
