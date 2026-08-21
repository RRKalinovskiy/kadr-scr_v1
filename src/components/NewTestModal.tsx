import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import type { Collection, Person } from "../types";
import { ROOT_SUITE } from "../types";
import { Avatar, FieldLabel, ToggleChip } from "./ui";
import TagPicker from "./TagPicker";

export interface NewTestData { name: string; suite: string; path: string; assignee: string; viewports: string[]; tags: string[] }

export default function NewTestModal({ open, col, people, initialSuite, tagColors, onTagColor, onClose, onCreate }: {
  open: boolean; col: Collection; people: Person[]; initialSuite?: string | null;
  tagColors: Record<string, string>; onTagColor: (tag: string, color: string) => void;
  onClose: () => void; onCreate: (d: NewTestData) => void;
}) {
  const folders = useMemo(() => {
    const names: string[] = [];
    const walk = (ns: typeof col.tree) =>
      ns.forEach((n) => {
        if (n.kind === "folder" && !n.isTrash) {
          if (!names.includes(n.name)) names.push(n.name);
          walk(n.children);
        }
      });
    walk(col.tree);
    return names;
  }, [col]);

  const [name, setName] = useState("");
  const [suite, setSuite] = useState<string>(ROOT_SUITE);
  const [path, setPath] = useState("/");
  const [assignee, setAssignee] = useState(people[0].id);
  const [viewports, setViewports] = useState<string[]>(col.viewports);
  const [tags, setTags] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(""); setSuite(initialSuite ?? ROOT_SUITE);
      setPath("/"); setAssignee(people[0].id); setViewports(col.viewports); setTags([]); setErr(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;
  const submit = () => {
    if (!name.trim()) { setErr("Укажите название теста"); return; }
    if (viewports.length === 0) { setErr("Выберите хотя бы один вьюпорт"); return; }
    onCreate({ name: name.trim(), suite, path: path.trim().startsWith("/") ? path.trim() : `/${path.trim()}`, assignee, viewports, tags });
  };
  const tagSuggestions = [...new Set(col.tests.flatMap((t) => t.tags))];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-deep/70 p-4 backdrop-blur-[3px]" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="toast-in max-h-[92vh] w-full max-w-[490px] overflow-y-auto rounded-2xl border border-line bg-panel p-5 shadow-[0_30px_90px_rgba(0,0,0,0.55)] scroll-thin">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="font-display text-[14px] font-bold text-fog">Новый автотест</div>
            <div className="mt-0.5 font-mono text-[10.5px] font-semibold text-dim">набор «{col.name}»</div>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-dim transition-all hover:bg-raised hover:text-fog active:scale-90"><X size={16} /></button>
        </div>
        <div className="space-y-3.5">
          <div>
            <FieldLabel>Название *</FieldLabel>
            <input autoFocus value={name} onChange={(e) => { setName(e.target.value); setErr(null); }} onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              placeholder="Корзина — удаление позиции"
              className={`w-full rounded-lg border bg-raised px-3 py-2.5 text-[13px] font-bold text-fog outline-none transition-colors placeholder:text-dim ${err && !name.trim() ? "border-coral/70" : "border-line focus:border-line2"}`} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Папка</FieldLabel>
              <select value={suite} onChange={(e) => { setSuite(e.target.value); setErr(null); }}
                className="w-full rounded-lg border border-line bg-raised px-2.5 py-2.5 text-[12.5px] font-bold text-fog outline-none transition-colors focus:border-line2">
                <option value={ROOT_SUITE} className="bg-panel">Корень коллекции (без папки)</option>
                {folders.map((f) => <option key={f} value={f} className="bg-panel">{f}</option>)}
              </select>
              {suite === ROOT_SUITE && (
                <div className="mt-2 rounded-lg border border-dashed border-line2/60 px-2.5 py-2 text-[10.5px] font-semibold text-dim">
                  Тест будет лежать в корне набора сценариев, вне папок.
                </div>
              )}
            </div>
            <div>
              <FieldLabel>Путь</FieldLabel>
              <input value={path} onChange={(e) => setPath(e.target.value)} spellCheck={false}
                className="w-full rounded-lg border border-line bg-raised px-2.5 py-2.5 font-mono text-[12px] font-semibold text-teal outline-none transition-colors focus:border-line2" />
            </div>
          </div>
          <div>
            <FieldLabel>Ответственный</FieldLabel>
            <div className="flex flex-wrap items-center gap-2 py-0.5">
              {people.map((p) => (
                <button key={p.id} onClick={() => setAssignee(p.id)} title={p.name}
                  className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-all duration-150 active:scale-95 ${assignee === p.id ? "border-amber/55 bg-amber/[0.08]" : "border-line bg-raised/50 hover:border-line2"}`}>
                  <Avatar person={p} size={22} />
                  <span className={`text-[11px] font-bold ${assignee === p.id ? "text-amber2" : "text-mist"}`}>{p.name.split(" ")[0]}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Вьюпорты</FieldLabel>
              <div className="flex flex-wrap gap-1.5 py-0.5">
                {col.viewports.map((v) => (
                  <ToggleChip key={v} active={viewports.includes(v)}
                    onClick={() => setViewports(viewports.includes(v) ? viewports.filter((x) => x !== v) : [...col.viewports.filter((x) => [...viewports, v].includes(x))])}>
                    {v}
                  </ToggleChip>
                ))}
              </div>
            </div>
            <TagPicker value={tags} onChange={setTags} colors={tagColors} onColor={onTagColor} suggestions={tagSuggestions} />
          </div>
          {err && <div className="toast-in rounded-lg border border-coral/45 bg-coral/10 px-3 py-2 text-[12px] font-bold text-coral">{err}</div>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-line bg-raised px-4 py-2.5 text-[12.5px] font-extrabold text-mist transition-all hover:border-line2 hover:text-fog active:scale-95">Отмена</button>
          <button onClick={submit} className="flex items-center gap-1.5 rounded-lg bg-amber px-4 py-2.5 text-[12.5px] font-extrabold text-[#17211d] transition-all hover:bg-amber2 active:scale-95">
            <Plus size={14} strokeWidth={2.8} />Добавить тест
          </button>
        </div>
      </div>
    </div>
  );
}
