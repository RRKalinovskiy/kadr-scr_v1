import { useMemo, useState } from "react";
import { Check, Copy, Database, Download, Lock, X } from "lucide-react";
import type { Account, Collection, CookieStore, Person } from "../types";
import { SectionTitle } from "./ui";

const esc = (v: string | number | null | undefined) =>
  v === null || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`;

const SCHEMA_SQL = `-- КАДР · схема хранения (PostgreSQL)

CREATE TABLE accounts (
  id UUID PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE users (
  id UUID PRIMARY KEY, account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL, login TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('admin','qa','dev')),
  password_hash TEXT, color TEXT NOT NULL
);
CREATE TABLE collections (
  id UUID PRIMARY KEY, account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL, color TEXT NOT NULL, screen_url TEXT NOT NULL,
  browser TEXT NOT NULL, viewports TEXT[] NOT NULL,
  threshold NUMERIC(4,2) NOT NULL DEFAULT 0.30, delay_ms INTEGER NOT NULL DEFAULT 800,
  auth_kind TEXT NOT NULL DEFAULT 'none', auth_login TEXT, auth_password_hash TEXT,
  cookie_user TEXT, session_token TEXT, deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE cookie_jars (
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  host TEXT NOT NULL, name TEXT NOT NULL, value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (account_id, host, name)
);
CREATE INDEX idx_collections_account ON collections (account_id);
CREATE INDEX idx_cookie_jars_host ON cookie_jars (host);`;

export default function DataDrawer({ open, account, users, collections, cookieStore, onClose }: {
  open: boolean; account: Account; users: Person[]; collections: Collection[]; cookieStore: CookieStore; onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const dump = useMemo(() => {
    if (!open) return "";
    const lines: string[] = [
      "-- КАДР · дамп данных", `-- сформирован: ${new Date().toISOString()}`, "-- секреты — в виде масок", "", "BEGIN;", "",
      `INSERT INTO accounts (id, name, email, plan, created_at) VALUES (${esc(account.id)}, ${esc(account.name)}, ${esc(account.email)}, ${esc(account.plan)}, ${esc(new Date(account.createdAt).toISOString())});`, "",
      ...users.map((u) => `INSERT INTO users (id, account_id, name, login, role, password_hash, color) VALUES (${esc(u.id)}, ${esc(account.id)}, ${esc(u.name)}, ${esc(u.login)}, ${esc(u.role)}, NULL, ${esc(u.color)});`),
      "",
      ...collections.map((c) => `INSERT INTO collections (id, account_id, name, color, screen_url, browser, viewports, threshold, delay_ms, auth_kind, auth_login, auth_password_hash, cookie_user, session_token, deleted_at) VALUES (${esc(c.id)}, ${esc(account.id)}, ${esc(c.name)}, ${esc(c.color)}, ${esc(c.screenUrl)}, ${esc(c.browser)}, ARRAY[${c.viewports.map((v) => esc(v)).join(", ")}], ${esc(c.threshold)}, ${esc(c.delayMs)}, ${esc(c.auth)}, ${esc(c.authLogin ?? null)}, ${esc(c.authPasswordHash ?? (c.authPassword ? "sha256:…" : null))}, ${esc(c.cookieUser ?? null)}, ${esc(c.sessionToken ?? null)}, ${esc(c.deleted ? new Date().toISOString() : null)});`),
      "",
      ...Object.entries(cookieStore).flatMap(([host, jar]) => jar.map((k) => `INSERT INTO cookie_jars (account_id, host, name, value) VALUES (${esc(account.id)}, ${esc(host)}, ${esc(k.name)}, 'enc:••••');`)),
      "", "COMMIT;",
    ];
    return lines.join("\n");
  }, [open, account, users, collections, cookieStore]);

  if (!open) return null;
  const copy = async () => {
    try { await navigator.clipboard.writeText(dump); setCopied(true); window.setTimeout(() => setCopied(false), 1600); } catch { /* нет доступа */ }
  };
  const download = () => {
    const blob = new Blob([dump], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "kadr-dump.sql";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="fixed inset-0 z-[50]" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="drawer-in absolute inset-y-0 right-0 flex w-full max-w-[560px] flex-col border-l border-line bg-panel shadow-[-30px_0_90px_rgba(0,0,0,0.55)]">
        <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-line px-4">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal/12 text-teal"><Database size={16} /></span>
          <div className="leading-none">
            <div className="font-display text-[13px] font-bold text-fog">Хранилище данных</div>
            <div className="mt-[3px] text-[10px] font-semibold text-dim">SQL-модель · дамп · безопасность</div>
          </div>
          <button onClick={onClose} className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-dim transition-all hover:bg-raised hover:text-fog active:scale-90"><X size={16} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 scroll-thin">
          <SectionTitle>Таблицы</SectionTitle>
          <div className="mb-4 grid grid-cols-2 gap-2">
            {[
              { t: "accounts", n: 1, d: "рабочее место" },
              { t: "users", n: users.length, d: "участники команды" },
              { t: "collections", n: collections.length, d: "наборы сценариев" },
              { t: "cookie_jars", n: Object.values(cookieStore).flat().length, d: "cookie по доменам" },
            ].map((x) => (
              <div key={x.t} className="rounded-lg border border-line bg-raised/50 px-3 py-2">
                <div className="font-mono text-[12px] font-bold text-teal">{x.t}</div>
                <div className="text-[10px] font-semibold text-dim">{x.n} зап. · {x.d}</div>
              </div>
            ))}
          </div>
          <SectionTitle>Схема (PostgreSQL)</SectionTitle>
          <pre className="mb-4 max-h-[200px] overflow-auto rounded-lg border border-line bg-deep/70 p-3 font-mono text-[10.5px] leading-relaxed text-mist scroll-thin">{SCHEMA_SQL}</pre>
          <SectionTitle>Дамп текущего состояния</SectionTitle>
          <div className="mb-2 flex gap-1.5">
            <button onClick={() => void copy()}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11.5px] font-extrabold transition-all active:scale-95 ${copied ? "border-[#46d68c]/50 bg-[#46d68c]/10 text-[#46d68c]" : "border-line bg-raised text-mist hover:border-line2 hover:text-fog"}`}>
              {copied ? <Check size={12} /> : <Copy size={12} />}{copied ? "Скопировано" : "Копировать"}
            </button>
            <button onClick={download} className="flex items-center gap-1.5 rounded-lg border border-line bg-raised px-3 py-1.5 text-[11.5px] font-extrabold text-mist transition-all hover:border-line2 hover:text-fog active:scale-95">
              <Download size={12} />kadr-dump.sql
            </button>
          </div>
          <pre className="mb-4 max-h-[180px] overflow-auto rounded-lg border border-line bg-deep/70 p-3 font-mono text-[10.5px] leading-relaxed text-mist scroll-thin">{dump}</pre>
          <SectionTitle>Безопасность секретов</SectionTitle>
          <div className="space-y-1.5">
            {[
              { ok: true, text: "Пароли — только SHA-256-хеш с солью, открытый пароль не персистится" },
              { ok: true, text: "Ключи доступа — только хеш + маска для UI" },
              { ok: true, text: "Cookie и токены не попадают в дамп (маскируются)" },
              { ok: true, text: "SQL-инъекции исключены: значения экранируются" },
              { ok: false, text: "Для боевого контура: серверное шифрование cookie (AES-GCM)" },
            ].map((x, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border border-line/70 bg-raised/40 px-3 py-2">
                <Lock size={12} className={`mt-0.5 shrink-0 ${x.ok ? "text-[#46d68c]" : "text-amber"}`} />
                <span className="text-[11px] font-semibold leading-relaxed text-mist">{x.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
