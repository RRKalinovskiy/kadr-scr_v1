import { useEffect, useRef, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { FieldLabel } from "./ui";

export const TAG_PALETTE = ["#4fe0c4", "#ffb454", "#7fb7ff", "#ff7a68", "#c9a2ff", "#46d68c", "#f5d76e", "#ff9ecb"];

export function autoTagColor(tag: string): string {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[h % TAG_PALETTE.length];
}

export function TagChip({ tag, color, size = "sm" }: { tag: string; color?: string; size?: "sm" | "md" }) {
  const c = color ?? autoTagColor(tag);
  return (
    <span className={`inline-flex items-center gap-1 rounded font-bold ${size === "sm" ? "px-1.5 py-[2px] text-[9.5px]" : "px-2 py-[3px] text-[10.5px]"}`}
      style={{ color: c, background: `${c}1a`, boxShadow: `inset 0 0 0 1px ${c}45` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
      {tag}
    </span>
  );
}

interface Props {
  value: string[];
  onChange: (tags: string[]) => void;
  colors: Record<string, string>;
  onColor?: (tag: string, color: string) => void;
  suggestions?: string[];
}

export default function TagPicker({ value, onChange, colors, onColor, suggestions = [] }: Props) {
  const [input, setInput] = useState("");
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerFor) return;
    const onDown = (e: MouseEvent) => { if (popRef.current && !popRef.current.contains(e.target as Node)) setPickerFor(null); };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [pickerFor]);

  const add = () => {
    const t = input.trim().toLowerCase().replace(/^#/, "");
    if (t && !value.includes(t)) onChange([...value, t]);
    setInput("");
  };
  const remove = (t: string) => onChange(value.filter((x) => x !== t));
  const addable = [...new Set(suggestions.filter((s) => !value.includes(s)))].slice(0, 6);

  return (
    <div>
      <FieldLabel>Теги</FieldLabel>
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((t) => (
          <span key={t} className="relative inline-flex">
            <button onClick={() => setPickerFor(pickerFor === t ? null : t)} title="Сменить цвет">
              <TagChip tag={t} color={colors[t]} size="md" />
            </button>
            <button onClick={() => remove(t)} title="Убрать тег"
              className="ml-0.5 grid h-[18px] w-[18px] place-items-center self-center rounded-full text-dim transition-all hover:bg-coral/20 hover:text-coral active:scale-90">
              <X size={10} strokeWidth={3} />
            </button>
            {pickerFor === t && onColor && (
              <div ref={popRef} className="menu-in absolute left-0 top-[26px] z-30 flex gap-1 rounded-lg border border-line2 bg-panel p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.55)]">
                {TAG_PALETTE.map((c) => (
                  <button key={c} onClick={() => { onColor(t, c); setPickerFor(null); }}
                    className={`grid h-5 w-5 place-items-center rounded-full transition-transform hover:scale-110 active:scale-90 ${(colors[t] ?? autoTagColor(t)) === c ? "ring-2 ring-fog/70" : ""}`}
                    style={{ background: c }}>
                    {(colors[t] ?? autoTagColor(t)) === c && <Check size={10} strokeWidth={3.5} className="text-deep" />}
                  </button>
                ))}
              </div>
            )}
          </span>
        ))}
        {addable.map((s) => (
          <button key={s} onClick={() => onChange([...value, s])}
            className="rounded border border-dashed border-line2 px-1.5 py-[3px] text-[10px] font-bold text-dim transition-all hover:border-teal/50 hover:text-teal active:scale-95">
            + {s}
          </button>
        ))}
        <span className="inline-flex items-center gap-1 rounded-md border border-line bg-raised/60 px-1.5 py-[3px]">
          <Plus size={10} className="text-dim" />
          <input value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); add(); }
              if (e.key === "Backspace" && !input && value.length) remove(value[value.length - 1]);
            }}
            placeholder="новый тег…"
            className="w-[72px] bg-transparent text-[10.5px] font-bold text-fog outline-none placeholder:text-dim" />
        </span>
      </div>
    </div>
  );
}
