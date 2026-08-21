import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Cookie, Eye, EyeOff, Globe, KeyRound, Loader2, RefreshCw, ShieldCheck, UserRound, X, XCircle } from "lucide-react";
import type { AuthCheckState, BrowserKind, Collection, CollectionDraft, CookieStore } from "../types";
import { AUTH_META } from "../types";
import { hostOfUrl, probeUrl } from "../urlcheck";
import { FieldLabel, Switch } from "./ui";

export type CardState = { mode: "create" } | { mode: "edit"; id: string };

const BROWSERS: Array<{ id: BrowserKind; label: string }> = [
  { id: "chromium", label: "Chromium" }, { id: "firefox", label: "Firefox" }, { id: "webkit", label: "WebKit" },
];
const COLOR_SWATCHES = ["#ffb454", "#4fe0c4", "#7fb7ff", "#ff7a68", "#c9a2ff", "#46d68c", "#f5d76e", "#ff9ecb"];
const AUTH_OPTIONS: Array<{ id: Collection["auth"]; Icon: typeof Cookie }> = [
  { id: "none", Icon: Globe }, { id: "cookie", Icon: Cookie }, { id: "login", Icon: UserRound }, { id: "key", Icon: KeyRound },
];

const DEFAULTS: CollectionDraft = {
  name: "", screenUrl: "https://", browser: "chromium", threshold: 0.3, delayMs: 800, notify: true,
  auth: "none", authLogin: "", authPassword: "", authKey: "", color: "#ffb454",
};

type Tone = "ok" | "warn" | "err";

export default function CollectionModal({ state, col, cookieStore, authState, onCheckAuth, onClose, onSave }: {
  state: CardState; col: Collection | null; cookieStore: CookieStore; authState?: AuthCheckState;
  onCheckAuth?: (draft: CollectionDraft) => void; onClose: () => void; onSave: (id: string | null, draft: CollectionDraft) => void;
}) {
  const [draft, setDraft] = useState<CollectionDraft>(DEFAULTS);
  const [nameError, setNameError] = useState(false);
  const [addrError, setAddrError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [check, setCheck] = useState<{ status: "idle" | "checking" | "done"; tone?: Tone; text?: string }>({ status: "idle" });
  const [confirmClose, setConfirmClose] = useState(false);
  const isEdit = state.mode === "edit";

  useEffect(() => {
    setDraft(isEdit && col ? {
      name: col.name, screenUrl: col.screenUrl, browser: col.browser, threshold: col.threshold, delayMs: col.delayMs,
      notify: col.notify, auth: col.auth ?? "none", authLogin: col.authLogin ?? "", authPassword: col.authPassword ?? "",
      authKey: col.authKey ?? "", cookieUser: col.cookieUser, color: col.color || "#ffb454",
    } : { ...DEFAULTS });
    setNameError(false); setAddrError(null); setAuthError(null); setCheck({ status: "idle" }); setConfirmClose(false); setShowPass(false);
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") tryClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = isEdit && col ? (
    draft.name !== col.name || draft.screenUrl !== col.screenUrl || draft.browser !== col.browser ||
    draft.threshold !== col.threshold || draft.delayMs !== col.delayMs || draft.notify !== col.notify ||
    draft.auth !== (col.auth ?? "none") || (draft.authLogin ?? "") !== (col.authLogin ?? "") ||
    (draft.authPassword ?? "") !== (col.authPassword ?? "") || (draft.authKey ?? "") !== (col.authKey ?? "") ||
    (draft.color ?? "") !== (col.color ?? "")
  ) : false;

  const tryClose = () => { if (dirty && !confirmClose) { setConfirmClose(true); return; } onClose(); };

  const validateUrl = (v: string): string | null => {
    const s = v.trim();
    if (!s) return "Укажите адрес ресурса";
    let u: URL;
    try { u = new URL(s); } catch { return "Некорректный формат ссылки"; }
    if (u.protocol !== "http:" && u.protocol !== "https:") return "Допустимы только http:// и https://";
    if (!u.hostname || (!u.hostname.includes(".") && u.hostname !== "localhost")) return "Укажите домен страницы";
    return null;
  };

  const runCheck = async () => {
    const err = validateUrl(draft.screenUrl);
    if (err) { setAddrError(err); return; }
    setAddrError(null);
    setCheck({ status: "checking" });
    const r = await probeUrl(draft.screenUrl.trim());
    setCheck(
      r.state === "ok" ? { status: "done", tone: "ok", text: `Доступен · HTTP ${r.code} · ${r.ms} мс` }
      : r.state === "warn" ? { status: "done", tone: "warn", text: `Отвечает · HTTP ${r.code} · ${r.ms} мс` }
      : r.state === "opaque" ? { status: "done", tone: "ok", text: r.redirect ? `Доступен · редирект · ${r.ms} мс` : `Доступен · ${r.ms} мс` }
      : { status: "done", tone: "err", text: "Ресурс недоступен · соединение не установлено" },
    );
  };

  const submit = () => {
    if (!draft.name.trim()) { setNameError(true); return; }
    const err = validateUrl(draft.screenUrl);
    if (err) { setAddrError(err); return; }
    if (draft.auth === "login" && (!draft.authLogin?.trim() || !draft.authPassword?.trim())) { setAuthError("Заполните логин и пароль"); return; }
    if (draft.auth === "key" && !draft.authKey?.trim()) { setAuthError("Укажите ключ доступа"); return; }
    onSave(isEdit && col ? col.id : null, {
      ...draft, name: draft.name.trim(), screenUrl: draft.screenUrl.trim(),
      authLogin: draft.auth === "login" ? draft.authLogin?.trim() : undefined,
      authPassword: draft.auth === "login" ? draft.authPassword : undefined,
      authKey: draft.auth === "key" ? draft.authKey?.trim() : undefined,
    });
  };

  const set = <K extends keyof CollectionDraft>(k: K, v: CollectionDraft[K]) => {
    if (k === "auth" || k === "authLogin" || k === "authPassword" || k === "authKey") setAuthError(null);
    if (k === "screenUrl") setCheck({ status: "idle" });
    setDraft((d) => ({ ...d, [k]: v }));
  };

  const toneCls: Record<Tone, string> = {
    ok: "border-[#46d68c]/40 bg-[#46d68c]/10 text-[#46d68c]",
    warn: "border-amber/40 bg-amber/10 text-amber",
    err: "border-coral/40 bg-coral/10 text-coral",
  };
  const jar = cookieStore[hostOfUrl(draft.screenUrl)];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-deep/70 p-4 backdrop-blur-[3px]" onMouseDown={(e) => { if (e.target === e.currentTarget) tryClose(); }}>
      <div className="toast-in max-h-[92vh] w-full max-w-[520px] overflow-y-auto rounded-2xl border border-line bg-panel p-5 shadow-[0_30px_90px_rgba(0,0,0,0.55)] scroll-thin">
        <div className="mb-1 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[9.5px] font-extrabold uppercase tracking-[0.14em] text-dim">{isEdit ? "Карточка коллекции" : "Новая коллекция"}</div>
            <input value={draft.name} onChange={(e) => { set("name", e.target.value); setNameError(false); }} placeholder="Название коллекции…"
              className={`mt-1 w-full border-b-2 bg-transparent pb-1 font-display text-[16px] font-bold text-fog outline-none transition-colors placeholder:text-dim ${nameError ? "border-coral" : "border-line focus:border-amber"}`} />
            {nameError && <div className="mt-1 text-[10.5px] font-bold text-coral">Укажите название коллекции</div>}
          </div>
          <button onClick={tryClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-dim transition-all hover:bg-raised hover:text-fog active:scale-90"><X size={16} /></button>
        </div>
        {!isEdit && <div className="mt-2 rounded-lg border border-line bg-raised/50 px-3 py-2 text-[10.5px] font-semibold text-dim">Коллекция появится в списке после «Сохранить».</div>}

        <div className="mt-4 space-y-3.5">
          <div>
            <FieldLabel>Цвет коллекции</FieldLabel>
            <div className="flex items-center gap-2">
              <div className="flex flex-wrap gap-1.5">
                {COLOR_SWATCHES.map((c) => (
                  <button key={c} type="button" onClick={() => set("color", c)}
                    className={`h-6 w-6 rounded-full transition-all duration-150 hover:scale-110 active:scale-90 ${draft.color === c ? "ring-2 ring-fog/80 ring-offset-2 ring-offset-panel" : ""}`}
                    style={{ background: c }} />
                ))}
              </div>
              <div className="ml-auto h-6 w-[120px] max-w-[130px] rounded-md" style={{ background: `linear-gradient(100deg, ${draft.color}, ${draft.color}33 70%, transparent)` }} />
            </div>
          </div>

          <div>
            <FieldLabel><span className="flex items-center gap-1.5"><Globe size={11} className="text-teal" /> Адрес ресурса</span></FieldLabel>
            <div className="flex gap-1.5">
              <input value={draft.screenUrl} onChange={(e) => set("screenUrl", e.target.value)} spellCheck={false} placeholder="https://mvp.site/checkout"
                className={`w-full rounded-lg border bg-raised px-3 py-2.5 font-mono text-[12px] font-semibold text-teal outline-none transition-colors placeholder:text-dim ${addrError ? "border-coral/70" : "border-line focus:border-teal/50"}`} />
              <button type="button" onClick={() => void runCheck()} disabled={check.status === "checking"}
                className="flex h-[42px] shrink-0 items-center gap-1.5 rounded-lg border border-teal/40 bg-teal/10 px-3 text-[11.5px] font-extrabold text-teal transition-all duration-150 hover:bg-teal/20 active:scale-95 disabled:pointer-events-none disabled:opacity-60">
                {check.status === "checking" ? <Loader2 size={13} className="spin" /> : <RefreshCw size={13} />}Проверить
              </button>
            </div>
            {addrError && <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-bold text-coral"><XCircle size={12} /> {addrError}</div>}
            {check.status === "checking" && <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-bold text-teal"><Loader2 size={12} className="spin" /> Отправляем запрос…</div>}
            {check.status === "done" && check.tone && (
              <div className={`fade-up mt-1.5 flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold ${toneCls[check.tone]}`}>
                {check.tone === "ok" ? <CheckCircle2 size={13} /> : check.tone === "warn" ? <AlertTriangle size={13} /> : <XCircle size={13} />}{check.text}
              </div>
            )}
          </div>

          <div>
            <FieldLabel>Тип авторизации</FieldLabel>
            <div className="grid grid-cols-4 gap-1 rounded-lg border border-line bg-raised p-1">
              {AUTH_OPTIONS.map(({ id, Icon }) => (
                <button key={id} type="button" onClick={() => set("auth", id)} title={AUTH_META[id].hint}
                  className={`flex flex-col items-center gap-1 rounded-md px-1 py-1.5 transition-all duration-150 active:scale-95 ${draft.auth === id ? "bg-amber/15 text-amber shadow-[inset_0_0_0_1px_rgba(255,180,84,0.45)]" : "text-mist hover:text-fog"}`}>
                  <Icon size={14} />
                  <span className="text-[9px] font-extrabold leading-none">{id === "none" ? "Публичный" : id === "cookie" ? "Cookie" : id === "login" ? "Логин" : "Ключ"}</span>
                </button>
              ))}
            </div>
            <div key={draft.auth} className="fade-up mt-2 rounded-lg border border-line bg-raised/60 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-fog"><span className="h-1.5 w-1.5 rounded-full bg-amber" />{AUTH_META[draft.auth].hint}</div>
                {onCheckAuth && draft.auth !== "none" && (
                  <button type="button" onClick={() => onCheckAuth(draft)} disabled={authState?.state === "checking"}
                    className="flex h-[26px] shrink-0 items-center gap-1.5 rounded-md border border-teal/40 bg-teal/10 px-2.5 text-[10px] font-extrabold text-teal transition-all duration-150 hover:bg-teal/20 active:scale-95 disabled:pointer-events-none disabled:opacity-60">
                    {authState?.state === "checking" ? <Loader2 size={11} className="spin" /> : <ShieldCheck size={11} />}
                    {authState?.state === "checking" ? "Проверка…" : "Проверить авторизацию"}
                  </button>
                )}
              </div>
              {draft.auth === "login" && (
                <div className="fade-up mt-2.5 grid grid-cols-2 gap-2">
                  <div>
                    <FieldLabel>Логин</FieldLabel>
                    <input value={draft.authLogin ?? ""} onChange={(e) => set("authLogin", e.target.value)} spellCheck={false} placeholder="qa-bot@mvp.site"
                      className={`w-full rounded-lg border bg-panel px-2.5 py-2 font-mono text-[11.5px] font-semibold text-fog outline-none transition-colors placeholder:text-dim ${authError && !draft.authLogin?.trim() ? "border-coral/70" : "border-line focus:border-line2"}`} />
                  </div>
                  <div>
                    <FieldLabel>Пароль</FieldLabel>
                    <div className="relative">
                      <input type={showPass ? "text" : "password"} value={draft.authPassword ?? ""} onChange={(e) => set("authPassword", e.target.value)} spellCheck={false} placeholder="••••••••"
                        className={`w-full rounded-lg border bg-panel px-2.5 py-2 pr-9 font-mono text-[11.5px] font-semibold text-fog outline-none transition-colors placeholder:text-dim ${authError && !draft.authPassword?.trim() ? "border-coral/70" : "border-line focus:border-line2"}`} />
                      <button type="button" onClick={() => setShowPass((v) => !v)}
                        className="absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-dim transition-all hover:bg-raised hover:text-fog active:scale-90">
                        {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {draft.auth === "cookie" && (
                <div className="fade-up mt-2.5 space-y-2">
                  <div>
                    <FieldLabel>Пользователь (логин)</FieldLabel>
                    <input value={draft.cookieUser ?? ""} onChange={(e) => set("cookieUser", e.target.value)} spellCheck={false} placeholder="qa-bot"
                      className="w-full rounded-lg border border-line bg-panel px-2.5 py-2 font-mono text-[11.5px] font-semibold text-fog outline-none transition-colors placeholder:text-dim focus:border-line2" />
                  </div>
                  <div>
                    <FieldLabel>Собранные cookie стенда</FieldLabel>
                    {jar && jar.length > 0 ? (
                      <div className="space-y-1">
                        {jar.map((k) => (
                          <div key={k.name} className="flex items-center gap-2 rounded-md border border-line bg-panel px-2.5 py-1.5">
                            <Cookie size={11} className="shrink-0 text-amber" />
                            <span className="truncate font-mono text-[11px] font-bold text-fog">{k.name}</span>
                            <span className="ml-auto shrink-0 font-mono text-[9.5px] font-semibold text-dim">•••• {k.value.length} симв.</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-md border border-dashed border-line2/60 px-2.5 py-2 text-[10.5px] font-semibold text-dim">Ещё не собраны — нажмите «Проверить авторизацию»</div>
                    )}
                  </div>
                </div>
              )}
              {draft.auth === "key" && (
                <div className="fade-up mt-2.5">
                  <FieldLabel>Ключ доступа</FieldLabel>
                  <input value={draft.authKey ?? ""} onChange={(e) => set("authKey", e.target.value)} spellCheck={false} placeholder="sk-xxxxxxxxxxxx"
                    className={`w-full rounded-lg border bg-panel px-2.5 py-2 font-mono text-[11.5px] font-semibold text-teal outline-none transition-colors placeholder:text-dim ${authError && !draft.authKey?.trim() ? "border-coral/70" : "border-line focus:border-teal/50"}`} />
                </div>
              )}
              {authState && authState.state !== "idle" && (
                <div className={`fade-up mt-2.5 flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold ${
                  authState.state === "checking" ? "border-teal/40 bg-teal/10 text-teal" : authState.state === "ok" ? "border-[#46d68c]/40 bg-[#46d68c]/10 text-[#46d68c]" : "border-coral/40 bg-coral/10 text-coral"}`}>
                  {authState.state === "checking" ? <Loader2 size={12} className="spin" /> : authState.state === "ok" ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                  {authState.state === "checking" ? "Выполняем авторизацию…" : authState.text}
                </div>
              )}
              {authError && <div className="fade-up mt-2 flex items-center gap-1.5 text-[11px] font-bold text-coral"><XCircle size={12} className="shrink-0" />{authError}</div>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Браузер</FieldLabel>
              <div className="grid grid-cols-3 gap-1 rounded-lg border border-line bg-raised p-1">
                {BROWSERS.map((b) => (
                  <button key={b.id} type="button" onClick={() => set("browser", b.id)}
                    className={`rounded-md px-1 py-1.5 text-[11px] font-extrabold transition-all duration-150 ${draft.browser === b.id ? "bg-teal/15 text-teal" : "text-mist hover:text-fog"}`}>
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <FieldLabel>Порог расхождений</FieldLabel>
                <span className="mb-1.5 font-mono text-[11.5px] font-bold text-amber">{draft.threshold.toFixed(1).replace(".", ",")} %</span>
              </div>
              <input type="range" min={0} max={5} step={0.1} value={draft.threshold} onChange={(e) => set("threshold", +e.target.value)} className="w-full" style={{ accentColor: "#ffb454" }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Задержка перед кадром, мс</FieldLabel>
              <input type="number" min={0} step={100} value={draft.delayMs} onChange={(e) => set("delayMs", Math.max(0, +e.target.value || 0))}
                className="w-full rounded-lg border border-line bg-raised px-3 py-2 font-mono text-[12px] font-semibold text-fog outline-none transition-colors focus:border-line2" />
            </div>
            <div className="flex items-center justify-between self-end rounded-lg border border-line bg-raised/60 px-3 py-2.5">
              <div>
                <div className="text-[12px] font-bold text-fog">Уведомления</div>
                <div className="text-[9.5px] font-semibold text-dim">о падениях</div>
              </div>
              <Switch checked={draft.notify} onChange={(v) => set("notify", v)} />
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          <span className="text-[9.5px] font-semibold text-dim">Сохранение — только по кнопке «Сохранить»</span>
          <div className="flex gap-2">
            <button onClick={tryClose} className="rounded-lg border border-line bg-raised px-4 py-2.5 text-[12.5px] font-extrabold text-mist transition-all hover:border-line2 hover:text-fog active:scale-95">Отмена</button>
            <button onClick={submit} className="rounded-lg bg-amber px-4 py-2.5 text-[12.5px] font-extrabold text-[#17211d] shadow-[0_2px_14px_rgba(255,180,84,0.25)] transition-all hover:bg-amber2 active:scale-95">Сохранить</button>
          </div>
        </div>
      </div>

      {confirmClose && (
        <div className="fixed inset-0 z-[65] grid place-items-center bg-deep/70 p-4 backdrop-blur-[3px]" onMouseDown={(e) => { if (e.target === e.currentTarget) setConfirmClose(false); }}>
          <div className="toast-in w-full max-w-[390px] rounded-2xl border border-line bg-panel p-5 shadow-[0_30px_90px_rgba(0,0,0,0.6)]">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber/15 text-amber"><AlertTriangle size={17} /></span>
              <div>
                <div className="font-display text-[14px] font-bold text-fog">Уверены, что хотите прервать редактирование?</div>
                <p className="mt-1 text-[12px] font-semibold leading-relaxed text-mist">Несохранённые изменения карточки коллекции будут потеряны.</p>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setConfirmClose(false)} className="rounded-lg border border-line bg-raised px-4 py-2 text-[12.5px] font-extrabold text-mist transition-all hover:border-line2 hover:text-fog active:scale-95">Нет</button>
              <button onClick={onClose} className="rounded-lg bg-amber px-4 py-2 text-[12.5px] font-extrabold text-[#17211d] transition-all hover:bg-amber2 active:scale-95">Да</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
