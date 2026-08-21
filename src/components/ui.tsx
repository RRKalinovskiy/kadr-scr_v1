import type { ReactNode } from "react";
import { Ban, CheckCircle2, CircleDashed, Clock3, Diff, Loader2, XCircle } from "lucide-react";
import type { Person, TestStatus } from "../types";
import { STATUS_META, initials } from "../types";

export function StatusBadge({ status }: { status: TestStatus }) {
  const m = STATUS_META[status];
  const Icon =
    status === "passed" ? CheckCircle2 : status === "failed" ? XCircle : status === "diff" ? Diff :
    status === "running" ? Loader2 : status === "queued" ? Clock3 : status === "skipped" ? Ban : CircleDashed;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] font-bold" style={{ color: m.color, background: m.bg }}>
      <Icon size={13} className={status === "running" ? "spin" : undefined} />
      {m.label}
    </span>
  );
}

export function Switch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}
      className={`relative h-[20px] w-[36px] shrink-0 rounded-full transition-colors duration-200 disabled:opacity-40 ${checked ? "bg-teal" : "bg-line2"}`}>
      <span className={`absolute top-[3px] h-[14px] w-[14px] rounded-full bg-deep transition-all duration-200 ${checked ? "left-[19px]" : "left-[3px]"}`} />
    </button>
  );
}

export function ToggleChip({ active, onClick, children, title }: { active: boolean; onClick: () => void; children: ReactNode; title?: string }) {
  return (
    <button type="button" title={title} onClick={onClick}
      className={`rounded-md border px-2 py-[5px] font-mono text-[11px] font-semibold transition-all duration-150 active:scale-95 ${
        active ? "border-amber/60 bg-amber/12 text-amber" : "border-line bg-raised/50 text-mist hover:border-line2 hover:text-fog"}`}>
      {children}
    </button>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-dim">{children}</div>;
}

export function Avatar({ person, size = 24 }: { person: Person; size?: number; ring?: boolean }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-full font-extrabold"
      style={{ width: size, height: size, background: `${person.color}26`, color: person.color, fontSize: size * 0.38 }}
      title={person.name}>
      {initials(person.name)}
    </span>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between">
      <div className="text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-dim">{children}</div>
      {right}
    </div>
  );
}
