import { useEffect, useRef, useState } from "react";
import { Briefcase, Circle, LogOut, Moon, Sun, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Account } from "../types";
import { initials } from "../types";

const STATUS = {
  online: { label: "В сети", color: "#46d68c" },
  busy: { label: "Занят", color: "#ff7a68" },
  away: { label: "Отошёл", color: "#ffb454" },
} as const;
type StatusKey = keyof typeof STATUS;
const PHOTO = "https://image.qwenlm.ai/generated-images/719096e9-629a-4507-8ec7-7f5bb8a5ae5e/_result.png";

export default function UserMenu({ account, onLogout }: { account: Account; onLogout: () => void }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<StatusKey>(() => {
    const v = localStorage.getItem("kadr-user-status");
    return v === "busy" || v === "away" ? v : "online";
  });
  const [photoOk, setPhotoOk] = useState(true);
  const [confirmOut, setConfirmOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { localStorage.setItem("kadr-user-status", status); }, [status]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setConfirmOut(false); } };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); setConfirmOut(false); } };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey); };
  }, [open]);

  const s = STATUS[status];
  
  const handleSettingsClick = () => {
    setOpen(false);
    navigate("/settings");
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} title={`${account.name} · ${s.label}`}
        className="relative grid h-9 w-9 place-items-center rounded-full transition-all duration-150 hover:ring-2 hover:ring-line2 active:scale-95">
        {photoOk ? (
          <img src={PHOTO} alt={account.name} onError={() => setPhotoOk(false)} className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <span className="grid h-9 w-9 place-items-center rounded-full bg-amber/20 text-[12px] font-extrabold text-amber">{initials(account.name)}</span>
        )}
        <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-panel ${status === "online" ? "pulse-dot" : ""}`} style={{ background: s.color }} />
      </button>
      {open && (
        <div className="menu-in absolute right-0 top-[46px] z-50 w-[268px] rounded-xl border border-line2 bg-panel p-3 shadow-[0_24px_70px_rgba(0,0,0,0.62)]">
          <div className="flex items-center gap-3 rounded-lg bg-raised/60 p-2.5">
            <div className="relative shrink-0">
              {photoOk ? (
                <img src={PHOTO} alt={account.name} onError={() => setPhotoOk(false)} className="h-12 w-12 rounded-full object-cover" />
              ) : (
                <span className="grid h-12 w-12 place-items-center rounded-full bg-amber/20 text-[15px] font-extrabold text-amber">{initials(account.name)}</span>
              )}
              <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-panel ${status === "online" ? "pulse-dot" : ""}`} style={{ background: s.color }} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-extrabold text-fog">{account.name}</div>
              <div className="truncate font-mono text-[10px] font-semibold text-dim">{account.email}</div>
              <div className="mt-0.5 inline-flex items-center gap-1 rounded bg-amber/12 px-1.5 py-[1px] text-[9px] font-extrabold uppercase tracking-wide text-amber">
                <Briefcase size={9} /> {account.plan}
              </div>
            </div>
          </div>
          <div className="mt-2.5">
            <div className="mb-1.5 text-[9.5px] font-extrabold uppercase tracking-[0.13em] text-dim">Рабочий статус</div>
            <div className="grid grid-cols-3 gap-1 rounded-lg border border-line bg-raised p-1">
              {(Object.keys(STATUS) as StatusKey[]).map((k) => (
                <button key={k} onClick={() => setStatus(k)}
                  className={`flex items-center justify-center gap-1.5 rounded-md px-1 py-1.5 text-[10.5px] font-extrabold transition-all duration-150 active:scale-95 ${
                    status === k ? "bg-fog/[0.08] text-fog shadow-[inset_0_0_0_1px_rgba(233,244,243,0.18)]" : "text-mist hover:text-fog"}`}>
                  <Circle size={7} fill={STATUS[k].color} stroke="none" />{STATUS[k].label}
                </button>
              ))}
            </div>
          </div>
          <div className="my-2.5 h-px bg-line" />
          <button onClick={handleSettingsClick}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] font-bold text-fog transition-all hover:bg-raised">
            <Settings size={15} className="text-mist" />Настройки
          </button>
          {confirmOut ? (
            <div className="mt-1 rounded-lg border border-coral/40 bg-coral/[0.07] p-2.5">
              <div className="text-[11px] font-bold leading-snug text-fog">Выйти из аккаунта?</div>
              <div className="mt-2 flex gap-1.5">
                <button onClick={() => { setOpen(false); setConfirmOut(false); onLogout(); }}
                  className="flex-1 rounded-md bg-coral px-2 py-1.5 text-[11px] font-extrabold text-[#2b0f0b] transition-all hover:brightness-110 active:scale-95">Да, выйти</button>
                <button onClick={() => setConfirmOut(false)}
                  className="flex-1 rounded-md border border-line bg-raised px-2 py-1.5 text-[11px] font-extrabold text-mist transition-all hover:border-line2 hover:text-fog active:scale-95">Нет</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmOut(true)}
              className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] font-bold text-coral transition-all hover:bg-coral/12">
              <LogOut size={15} />Выход
            </button>
          )}
          <div className="mt-2 flex items-center justify-between border-t border-line/60 px-2.5 pt-2 text-[9px] font-semibold text-dim">
            <span>КАДР · скрин-сборки</span><span className="flex items-center gap-1"><Moon size={9} /> v0.6</span>
          </div>
        </div>
      )}
    </div>
  );
}
