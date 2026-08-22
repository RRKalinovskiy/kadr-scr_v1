import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, CheckCircle2, Diff, Eye, EyeOff, Loader2, Lock, Mail, Sparkles, User as UserIcon, XCircle } from "lucide-react";
import { backend, validateEmail, validatePassword, type PublicUser } from "../backend";
import type { DbSession } from "../backend/db";

type Mode = "login" | "register";

export default function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSupa = backend.mode !== "local";
  const dbLabel = backend.mode === "supabase" ? "Supabase" : "MySQL на reg.ru";

  const submit = async () => {
    setError(null);
    if (mode === "register") {
      const ee = validateEmail(email);
      if (ee) return setError(ee);
      const pe = validatePassword(password);
      if (pe) return setError(pe);
      if (password !== confirm) return setError("Пароли не совпадают");
      if (!name.trim()) return setError("Укажите имя");
    }
    setBusy(true);
    try {
      const res =
        mode === "register"
          ? await backend.register(name, email, password)
          : await backend.login(email, password);
      if (res.ok) {
        // Сохраняем сессию и перенаправляем на рабочую область
        navigate("/workspace");
      } else {
        setError(res.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Что-то пошло не так");
    } finally {
      setBusy(false);
    }
  };

  const field =
    "w-full rounded-lg border border-line bg-deep/60 px-3 py-2.5 pl-9 text-[13px] font-semibold text-fog outline-none transition-colors placeholder:text-dim focus:border-teal/60";

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-deep">
      {/* ---- левая брендовая панель ---- */}
      <div className="relative hidden w-[46%] shrink-0 flex-col justify-between overflow-hidden border-r border-line bg-panel p-9 lg:flex">
        {/* живой фон */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-amber/[0.08] blur-3xl" />
          <div className="absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-teal/[0.07] blur-3xl" />
          <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(rgba(233,244,243,0.05) 1px, transparent 1.4px)", backgroundSize: "22px 22px" }} />
        </div>

        <div className="relative">
          <div className="flex items-center gap-3">
            <svg width="40" height="40" viewBox="0 0 32 32" aria-hidden>
              <rect x="2" y="2" width="28" height="28" rx="8" fill="#ffb454" />
              <path d="M9 22.5V9.5l7 7 7-7v13" stroke="#17211d" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div>
              <div className="font-display text-[20px] font-bold tracking-[0.12em] text-fog">КАДР</div>
              <div className="text-[11px] font-semibold tracking-wide text-dim">скрин-сборки автотестов</div>
            </div>
          </div>

          <h1 className="mt-10 font-display text-[26px] font-bold leading-snug text-fog">
            Снимайте кадры.<br />
            <span className="text-amber">Сверяйте с эталоном.</span>
          </h1>
          <p className="mt-3 max-w-[340px] text-[13px] font-semibold leading-relaxed text-mist">
            КАДР открывает страницу вашего стенда, делает скриншот и сравнивает его с эталоном — падения и расхождения видны сразу.
          </p>
        </div>

        {/* живая «лента прогонов» */}
        <div className="relative space-y-2">
          {[
            { Icon: CheckCircle2, tone: "#46d68c", label: "Корзина · добавление", val: "успешно", ms: "1,2 с" },
            { Icon: Diff, tone: "#ffb454", label: "Оплата · отказ банка", val: "расхождение 1,4%", ms: "2,6 с" },
            { Icon: XCircle, tone: "#ff7a68", label: "Промокод WINTER10", val: "падение", ms: "2,9 с" },
          ].map((r, i) => (
            <div key={i} className="fade-up flex items-center gap-3 rounded-xl border border-line bg-raised/60 px-3.5 py-2.5 backdrop-blur-sm" style={{ animationDelay: `${i * 120}ms` }}>
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ color: r.tone, background: `${r.tone}16` }}>
                <r.Icon size={14} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-bold text-fog">{r.label}</div>
                <div className="text-[10px] font-semibold" style={{ color: r.tone }}>{r.val}</div>
              </div>
              <span className="font-mono text-[10px] font-semibold text-dim">{r.ms}</span>
              <span className="pulse-dot h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: r.tone }} />
            </div>
          ))}
          <div className="flex items-center gap-1.5 pt-1 text-[10px] font-semibold text-dim">
            <Camera size={11} className="text-teal" />
            живые прогоны обновляются в реальном времени
          </div>
        </div>
      </div>

      {/* ---- правая панель с формой ---- */}
      <div className="stage-bg relative flex min-w-0 flex-1 items-center justify-center overflow-y-auto p-6">
        <div className="fade-up w-full max-w-[400px]">
          <div className="mb-6 lg:hidden">
            <div className="flex items-center gap-2.5">
              <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden>
                <rect x="2" y="2" width="28" height="28" rx="8" fill="#ffb454" />
                <path d="M9 22.5V9.5l7 7 7-7v13" stroke="#17211d" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="font-display text-[16px] font-bold tracking-[0.12em] text-fog">КАДР</span>
            </div>
          </div>

          {/* переключатель Вход / Регистрация */}
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl border border-line bg-panel/70 p-1">
            {([
              { id: "login" as const, label: "Вход" },
              { id: "register" as const, label: "Регистрация" },
            ]).map((t) => (
              <button key={t.id} onClick={() => { setMode(t.id); setError(null); }}
                className={`rounded-lg px-3 py-2 text-[12.5px] font-extrabold transition-all duration-150 ${
                  mode === t.id ? "bg-amber text-[#17211d] shadow-[0_2px_10px_rgba(255,180,84,0.35)]" : "text-mist hover:text-fog"}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* индикатор режима хранилища */}
          <div className={`mb-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-[10.5px] font-bold ${
            isSupa ? "border-teal/40 bg-teal/[0.07] text-teal" : "border-line bg-panel/60 text-dim"}`}>
            {isSupa ? <CheckCircle2 size={13} className="shrink-0" /> : <Lock size={12} className="shrink-0" />}
            {isSupa
              ? `БД подключена · данные синхронизируются (${dbLabel})`
              : "Локальный режим · данные хранятся в этом браузере"}
          </div>

          <div className="rounded-2xl border border-line bg-panel/85 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.4)] backdrop-blur">
            <div className="mb-4">
              <div className="font-display text-[17px] font-bold text-fog">
                {mode === "login" ? "С возвращением" : "Создать рабочее место"}
              </div>
              <p className="mt-1 text-[11.5px] font-semibold text-mist">
                {mode === "login"
                  ? "Войдите, чтобы открыть свои наборы и тесты."
                  : "Аккаунт хранит ваши коллекции, тесты и эталоны."}
              </p>
            </div>

            <div className="space-y-3">
              {mode === "register" && (
                <div className="relative">
                  <UserIcon size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ваше имя" className={field} />
                </div>
              )}

              <div className="relative">
                <Mail size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@team.ru" type="email" className={field} />
              </div>

              <div className="relative">
                <Lock size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
                <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Пароль" type={showPass ? "text" : "password"}
                  className={`${field} pr-10`} onKeyDown={(e) => { if (e.key === "Enter") void submit(); }} />
                <button onClick={() => setShowPass((v) => !v)} title={showPass ? "Скрыть" : "Показать"}
                  className="absolute right-2.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-dim transition-all hover:bg-raised hover:text-fog">
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>

              {mode === "register" && (
                <div className="relative">
                  <Lock size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
                  <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Повторите пароль" type={showPass ? "text" : "password"}
                    className={field} onKeyDown={(e) => { if (e.key === "Enter") void submit(); }} />
                </div>
              )}

              {error && (
                <div className="toast-in flex items-start gap-2 rounded-lg border border-coral/40 bg-coral/10 px-3 py-2.5 text-[11.5px] font-bold text-coral">
                  <XCircle size={14} className="mt-0.5 shrink-0" />
                  {error}
                </div>
              )}

              <button onClick={() => void submit()} disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber px-4 py-2.5 text-[13px] font-extrabold text-[#17211d] shadow-[0_2px_14px_rgba(255,180,84,0.3)] transition-all duration-150 hover:bg-amber2 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60">
                {busy ? <Loader2 size={15} className="spin" /> : mode === "login" ? "Войти" : "Создать аккаунт"}
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-center gap-1.5 text-center text-[10px] font-semibold text-dim">
            <Sparkles size={11} className="text-teal" />
            {isSupa
              ? `Подключено к ${dbLabel}: данные и пользователи хранятся в БД`
              : "Локальный режим: аккаунты и тесты хранятся в этом браузере. Подключите БД, чтобы синхронизировать."}
          </div>
        </div>
      </div>
    </div>
  );
}
