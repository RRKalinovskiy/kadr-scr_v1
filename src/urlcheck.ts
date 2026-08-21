/** Общий механизм проверки доступности стендов */

export type ProbeResult =
  | { state: "ok"; code: number; ms: number }
  | { state: "warn"; code: number; ms: number }
  | { state: "opaque"; ms: number; redirect?: boolean }
  | { state: "down" };

export interface UrlState {
  state: "idle" | "checking" | ProbeResult["state"];
  code?: number;
  ms?: number;
  redirect?: boolean;
  at?: number;
}

export interface UrlMeta { label: string; sub?: string; color: string }

const faviconAlive = (url: string, timeoutMs: number): Promise<boolean> =>
  new Promise((resolve) => {
    try {
      const u = new URL(url);
      const img = new Image();
      const t = window.setTimeout(() => { img.src = ""; resolve(false); }, timeoutMs);
      img.onload = () => { window.clearTimeout(t); resolve(true); };
      img.onerror = () => { window.clearTimeout(t); resolve(false); };
      img.src = `${u.origin}/favicon.ico?_=${Date.now()}`;
    } catch { resolve(false); }
  });

/** Лестница: CORS-manual → CORS-follow → no-cors → favicon. «Недоступен» — когда ничего не ответило. */
export async function probeUrl(url: string, timeoutMs = 9000): Promise<ProbeResult> {
  const timedFetch = (init: RequestInit): Promise<Response> => {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
    return fetch(url, { ...init, signal: ctrl.signal }).finally(() => window.clearTimeout(timer));
  };
  const t0 = performance.now();
  try {
    const res = await timedFetch({ method: "GET", mode: "cors", cache: "no-store", redirect: "manual", credentials: "omit" });
    const ms = Math.round(performance.now() - t0);
    if (res.type === "opaqueredirect") return { state: "opaque", ms, redirect: true };
    return res.ok ? { state: "ok", code: res.status, ms } : { state: "warn", code: res.status, ms };
  } catch { /* дальше */ }
  try {
    const res = await timedFetch({ method: "GET", mode: "cors", cache: "no-store", redirect: "follow", credentials: "omit" });
    const ms = Math.round(performance.now() - t0);
    return res.ok ? { state: "ok", code: res.status, ms } : { state: "warn", code: res.status, ms };
  } catch { /* дальше */ }
  try {
    await timedFetch({ method: "GET", mode: "no-cors", cache: "no-store", redirect: "follow", credentials: "omit" });
    return { state: "opaque", ms: Math.round(performance.now() - t0) };
  } catch { /* favicon */ }
  if (await faviconAlive(url, 4000)) return { state: "opaque", ms: Math.round(performance.now() - t0) };
  return { state: "down" };
}

export function buildTestUrl(screenUrl: string, path?: string): string {
  const base = screenUrl.trim();
  const p = (path ?? "").trim();
  if (!p || p === "/") return base;
  try { return new URL(p, base).href; }
  catch { return `${base.replace(/\/$/, "")}${p.startsWith("/") ? p : `/${p}`}`; }
}

export function hostOfUrl(raw: string): string {
  try { return new URL(raw).host || raw; } catch { return raw || "—"; }
}

export function urlStatusMeta(s: UrlState | undefined): UrlMeta {
  switch (s?.state) {
    case "checking": return { label: "проверка…", color: "#4fe0c4" };
    case "ok": return { label: `HTTP ${s.code}`, sub: `${s.ms} мс`, color: "#46d68c" };
    case "warn": return { label: `HTTP ${s.code}`, sub: `${s.ms} мс`, color: "#ffb454" };
    case "opaque": return { label: "доступен", sub: s.redirect ? "сервер ответил редиректом" : `${s.ms} мс · статус скрыт CORS`, color: "#46d68c" };
    case "down": return { label: "недоступен", color: "#ff7a68" };
    default: return { label: "нет данных", color: "#5f777d" };
  }
}
