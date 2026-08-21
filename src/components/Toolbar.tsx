import { Link } from "react-router-dom";
import { BarChart3, Database, Play, Square, Zap } from "lucide-react";
import type { Account } from "../types";
import { fmtTime } from "../types";
import { backend } from "../backend";
import UserMenu from "./UserMenu";

interface Props {
  buildNo: number;
  buildActive: boolean;
  progress: { done: number; total: number } | null;
  savedAt: number | null;
  canRun: boolean;
  onRun: () => void;
  onStop: () => void;
  onOpenData: () => void;
  account: Account;
  onLogout: () => void;
  onWorkspace: () => void;
}

export default function Toolbar({ buildNo, buildActive, progress, savedAt, canRun, onRun, onStop, onOpenData, account, onLogout, onWorkspace }: Props) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-panel px-4">
      <div className="flex items-center gap-2.5">
        <svg width="27" height="27" viewBox="0 0 32 32" aria-hidden>
          <rect x="2" y="2" width="28" height="28" rx="8" fill="#ffb454" />
          <path d="M9 22.5V9.5l7 7 7-7v13" stroke="#17211d" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="leading-none">
          <div className="font-display text-[13px] font-bold tracking-[0.14em] text-fog">КАДР</div>
          <div className="mt-[3px] text-[10px] font-semibold tracking-wide text-dim">скрин-сборки автотестов</div>
        </div>
      </div>
      <span className="h-6 w-px bg-line" />
      <div className="flex items-center gap-2 rounded-lg border border-line bg-raised/60 px-3 py-1.5">
        {buildActive ? <span className="pulse-dot h-2 w-2 rounded-full bg-teal" /> : <span className="h-2 w-2 rounded-full bg-line2" />}
        <span className="font-mono text-[12px] font-semibold text-mist">сборка <span className="text-fog">#{buildNo}</span></span>
        {buildActive && progress && <span className="font-mono text-[11px] font-bold text-teal">{progress.done}/{progress.total}</span>}
      </div>
      <div className="ml-auto flex items-center gap-2.5">
        {/* индикатор режима хранилища */}
        <span
          title={
            backend.mode === "supabase"
              ? "Данные синхронизируются с облачной БД (Supabase)"
              : backend.mode === "regapi"
                ? "Данные в MySQL на хостинге (PHP-API)"
                : "Данные хранятся локально в браузере"
          }
          className={`hidden items-center gap-1.5 rounded-md border px-2 py-1 text-[9.5px] font-extrabold uppercase tracking-wide md:flex ${
            backend.mode === "local" ? "border-line bg-raised/60 text-dim" : "border-teal/40 bg-teal/[0.08] text-teal"}`}>
          <Database size={11} />
          {backend.mode === "supabase" ? "Облако" : backend.mode === "regapi" ? "БД reg.ru" : "Локально"}
        </span>
        {savedAt && <span className="hidden text-[11px] font-semibold text-dim lg:block">сохранено в {fmtTime(savedAt)}</span>}
        <Link to="/stats" title="Статистика — отдельная страница"
          className="flex h-9 items-center gap-2 rounded-lg border border-line bg-raised px-3 text-[12px] font-extrabold text-mist transition-all duration-150 hover:border-amber/50 hover:text-amber active:scale-[0.97]">
          <BarChart3 size={14} /><span className="hidden md:inline">Статистика</span>
        </Link>
        <button onClick={onOpenData} title="Хранилище · SQL"
          className="flex h-9 items-center gap-2 rounded-lg border border-line bg-raised px-3 text-[12px] font-extrabold text-mist transition-all duration-150 hover:border-teal/50 hover:text-teal active:scale-[0.97]">
          <Database size={14} /><span className="hidden md:inline">Данные</span>
        </button>
        {buildActive ? (
          <button onClick={onStop}
            className="flex h-9 items-center gap-2 rounded-lg border border-coral/45 bg-coral/10 px-4 text-[13px] font-extrabold text-coral transition-all duration-150 hover:bg-coral/20 active:scale-[0.97]">
            <Square size={13} fill="currentColor" />Остановить
          </button>
        ) : (
          <button onClick={onRun} disabled={!canRun} title="Ctrl+Enter"
            className="flex h-9 items-center gap-2 rounded-lg bg-amber px-4 text-[13px] font-extrabold text-[#17211d] shadow-[0_2px_14px_rgba(255,180,84,0.28)] transition-all duration-150 hover:bg-amber2 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40">
            <Play size={14} fill="currentColor" />Запустить сборку
          </button>
        )}
        <span className="hidden items-center gap-1 rounded-md border border-line px-2 py-1 font-mono text-[10px] font-semibold text-dim xl:flex">
          <Zap size={11} />ctrl+enter
        </span>
        <span className="h-6 w-px bg-line" />
        <UserMenu account={account} onLogout={onLogout} onWorkspace={onWorkspace} />
      </div>
    </header>
  );
}
