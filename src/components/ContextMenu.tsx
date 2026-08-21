import { Fragment, useEffect, useRef } from "react";
import type { ReactNode } from "react";

export interface MenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  hint?: string;
  sep?: boolean;
  dot?: string;
}

interface Props {
  x: number;
  y: number;
  items: MenuItem[];
  groups?: string[];
  onAction: (id: string) => void;
  onClose: () => void;
}

const W = 240;

export default function ContextMenu({ x, y, items, groups, onAction, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const onScroll = () => onClose();
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  const H = items.reduce((acc, it) => acc + 34 + (it.sep ? 9 : 0), 16) + (groups?.length ? groups.length * 16 + 8 : 0);
  const px = Math.max(8, Math.min(x, window.innerWidth - W - 10));
  const py = Math.max(8, Math.min(y, window.innerHeight - H - 10));

  return (
    <div ref={ref} role="menu" onContextMenu={(e) => e.preventDefault()}
      className="menu-in fixed z-[60] max-h-[70vh] overflow-y-auto rounded-xl border border-line2 bg-panel p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.62)] scroll-thin"
      style={{ left: px, top: py, width: W }}>
      {groups && groups.length > 0 && (
        <div className="px-2.5 pb-1.5 pt-1">
          {groups.map((g) => <div key={g} className="text-[9.5px] font-extrabold uppercase tracking-[0.14em] text-dim">{g}</div>)}
        </div>
      )}
      {items.map((it) => (
        <Fragment key={it.id}>
          {it.sep && <div className="mx-2 my-1 h-px bg-line" />}
          <button role="menuitem" disabled={it.disabled} onClick={() => onAction(it.id)}
            className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[12.5px] font-bold transition-all duration-100 ${
              it.disabled ? "cursor-not-allowed opacity-35" : it.danger ? "text-coral hover:bg-coral/12" : "text-fog hover:bg-raised"}`}>
            {it.dot ? (
              <span className="grid w-4 shrink-0 place-items-center"><span className="h-2.5 w-2.5 rounded-full" style={{ background: it.dot }} /></span>
            ) : (
              <span className={`grid w-4 shrink-0 place-items-center ${it.danger ? "text-coral" : "text-mist"}`}>{it.icon}</span>
            )}
            <span className="flex-1 truncate text-left">{it.label}</span>
            {it.hint && <span className="shrink-0 font-mono text-[9.5px] font-semibold text-dim">{it.hint}</span>}
          </button>
        </Fragment>
      ))}
    </div>
  );
}
