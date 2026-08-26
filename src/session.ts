import { backend, type PublicUser } from "./backend";
import type { DbSession } from "./backend/db";
import type { Account } from "./types";

export type AuthSession = { user: PublicUser; session: DbSession };

export async function restoreAuth(): Promise<AuthSession | null> {
  try {
    const result = await Promise.resolve(backend.restore());
    if (result?.user && result.session) return result;
    return null;
  } catch {
    return null;
  }
}

export function accountFromSession(auth: AuthSession): Account {
  return {
    id: auth.user.accountId,
    name: auth.user.name,
    email: auth.user.email,
    plan: "team",
    createdAt: auth.session.createdAt,
  };
}

export async function signOut(): Promise<void> {
  try {
    await Promise.resolve(backend.logout());
  } catch {
    /* сессия уже недействительна */
  }
  localStorage.removeItem("kadr_user");
  localStorage.removeItem("kadr-regapi-token");
  localStorage.removeItem("kadr-db:session-token");
}
