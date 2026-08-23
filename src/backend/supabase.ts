/**
 * Адаптер Supabase (реальная БД + аутентификация).
 *
 * Включается, когда заданы переменные окружения:
 *   VITE_SUPABASE_URL      — например https://xxxx.supabase.co
 *   VITE_SUPABASE_ANON_KEY — публичный (anon) ключ проекта
 *
 * Схема таблиц и RLS-политики лежат в supabase/migrations/001_init.sql —
 * примените её в Supabase SQL Editor (или через `supabase db push`), она
 * коммитится в git вместе с проектом.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { PublicUser } from "./auth";
import type { DbSession } from "./db";

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const anonKey = env.VITE_SUPABASE_ANON_KEY;

/**
 * Нормализуем базовый URL проекта Supabase.
 *
 * Частая ошибка — вписать URL с суффиксом `/rest/v1` (его показывает панель в
 * поле REST API). Клиент сам добавляет `/auth/v1` и `/rest/v1` к базовому URL,
 * поэтому лишний суффикс даёт битый путь вида `/rest/v1/auth/v1/signup` → 404.
 * Обрезаем его, чтобы код был устойчив к такой опечатке.
 */
function normalizeUrl(raw?: string): string | undefined {
  if (!raw) return undefined;
  return raw.trim().replace(/\/(rest\/v1|auth\/v1)\/?$/, "").replace(/\/+$/, "");
}
const url = normalizeUrl(env.VITE_SUPABASE_URL);

export const isSupabase = (): boolean => Boolean(url && anonKey);

let client: SupabaseClient | null = null;
function sb(): SupabaseClient {
  if (!client) client = createClient(url as string, anonKey as string);
  return client;
}

function toPublic(id: string, accountId: string, email: string, name: string): PublicUser {
  return { id, accountId, name, email };
}

export const supabaseBackend = {
  async register(name: string, email: string, password: string) {
    const { data, error } = await sb().auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error || !data.user) return { ok: false as const, error: error?.message ?? "Не удалось зарегистрироваться" };
    // профиль + рабочее место создаются триггером on_auth_user_created (см. миграцию)
    const accountId = data.user.id;
    const session: DbSession = {
      token: data.session?.access_token ?? "",
      userId: data.user.id,
      accountId,
      createdAt: Date.now(),
      expiresAt: data.session?.expires_at ? data.session.expires_at * 1000 : Date.now() + 7 * 864e5,
    };
    return { ok: true as const, user: toPublic(data.user.id, accountId, email, name), session };
  },

  async login(email: string, password: string) {
    const { data, error } = await sb().auth.signInWithPassword({ email, password });
    if (error || !data.user) return { ok: false as const, error: error?.message ?? "Неверный email или пароль" };
    const session: DbSession = {
      token: data.session?.access_token ?? "",
      userId: data.user.id,
      accountId: data.user.id,
      createdAt: Date.now(),
      expiresAt: data.session?.expires_at ? data.session.expires_at * 1000 : Date.now() + 7 * 864e5,
    };
    const name = (data.user.user_metadata?.name as string) ?? email.split("@")[0];
    return { ok: true as const, user: toPublic(data.user.id, data.user.id, email, name), session };
  },

  async restore(): Promise<{ user: PublicUser; session: DbSession } | null> {
    const { data } = await sb().auth.getSession();
    const s = data.session;
    if (!s?.user) return null;
    const name = (s.user.user_metadata?.name as string) ?? s.user.email?.split("@")[0] ?? "Пользователь";
    return {
      user: toPublic(s.user.id, s.user.id, s.user.email ?? "", name),
      session: {
        token: s.access_token,
        userId: s.user.id,
        accountId: s.user.id,
        createdAt: Date.now(),
        expiresAt: s.expires_at ? s.expires_at * 1000 : Date.now() + 7 * 864e5,
      },
    };
  },

  async logout() {
    await sb().auth.signOut();
  },

  async loadState<T>(accountId: string): Promise<T | null> {
    const { data, error } = await sb().from("account_state").select("state").eq("account_id", accountId).maybeSingle();
    if (error || !data) return null;
    return (data.state as T) ?? null;
  },

  async saveState<T>(accountId: string, state: T) {
    await sb().from("account_state").upsert({ account_id: accountId, state }, { onConflict: "account_id" });
  },

  async listUsers(accountId: string): Promise<PublicUser[]> {
    const { data, error } = await sb().from("profiles").select("id, email, name, account_id").eq("account_id", accountId);
    if (error || !data) return [];
    return data.map((r) => toPublic(String(r.id), String(r.account_id), String(r.email), String(r.name)));
  },

  async loadUserSettings<T>(accountId: string): Promise<T | null> {
    const { data, error } = await sb().from("user_settings").select("settings").eq("account_id", accountId).maybeSingle();
    if (error || !data) return null;
    return (data.settings as T) ?? null;
  },

  async saveUserSettings<T>(accountId: string, settings: T) {
    await sb().from("user_settings").upsert({ account_id: accountId, settings }, { onConflict: "account_id" });
  },
};
