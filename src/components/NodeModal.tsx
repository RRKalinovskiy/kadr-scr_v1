import { useEffect, useState } from "react";
import { Check, Folder, FolderPlus, X, Zap } from "lucide-react";
import type { TreeNode } from "../types";
import { FieldLabel } from "./ui";

export type NodeModalState =
  | { mode: "create"; kind: "request" | "folder"; parentId: string | null; parentName: string }
  | { mode: "edit"; node: TreeNode };

export interface NodeSubmit { kind: "request" | "folder"; parentId: string | null; editId?: string; name: string; path?: string }

export default function NodeModal({ state, onClose, onSubmit }: { state: NodeModalState | null; onClose: () => void; onSubmit: (r: NodeSubmit) => void }) {
  const [name, setName] = useState("");
  const [path, setPath] = useState("/");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!state) return;
    setErr(null);
    if (state.mode === "edit") { setName(state.node.name); setPath(state.node.kind === "request" ? state.node.path : "/"); }
    else { setName(""); setPath("/"); }
  }, [state]);

  useEffect(() => {
    if (!state) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [state, onClose]);

  if (!state) return null;
  const kind = state.mode === "edit" ? state.node.kind : state.kind;
  const isRequest = kind === "request";
  const title = state.mode === "edit" ? (isRequest ? "Редактирование запроса" : "Переименовать папку") : (isRequest ? "Новый запрос" : "Новая папка");

  const submit = () => {
    if (!name.trim()) { setErr(isRequest ? "Укажите название запроса" : "Укажите название папки"); return; }
    onSubmit({
      kind, parentId: state.mode === "edit" ? null : state.parentId,
      editId: state.mode === "edit" ? state.node.id : undefined,
      name: name.trim(),
      path: isRequest ? (path.trim().startsWith("/") ? path.trim() : `/${path.trim()}`) : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-deep/70 p-4 backdrop-blur-[3px]" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="toast-in w-full max-w-[430px] rounded-2xl border border-line bg-panel p-5 shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-amber/12 text-amber">
              {isRequest ? <Zap size={16} /> : state.mode === "edit" ? <Folder size={16} /> : <FolderPlus size={16} />}
            </span>
            <div>
              <div className="font-display text-[13.5px] font-bold text-fog">{title}</div>
              <div className="mt-0.5 font-mono text-[10.5px] font-semibold text-dim">
                {state.mode === "edit" ? (state.node.kind === "request" ? state.node.path : "папка") : `в «${state.parentName}»`}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-dim transition-all hover:bg-raised hover:text-fog active:scale-90"><X size={16} /></button>
        </div>
        <div className="space-y-3.5">
          <div>
            <FieldLabel>Название *</FieldLabel>
            <input autoFocus value={name} onChange={(e) => { setName(e.target.value); setErr(null); }} onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              placeholder={isRequest ? "Получить список заказов" : "Например, «Оформление»"}
              className={`w-full rounded-lg border bg-raised px-3 py-2.5 text-[13px] font-bold text-fog outline-none transition-colors placeholder:text-dim ${err && !name.trim() ? "border-coral/70" : "border-line focus:border-line2"}`} />
          </div>
          {isRequest && (
            <div>
              <FieldLabel>Путь</FieldLabel>
              <input value={path} onChange={(e) => setPath(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} spellCheck={false} placeholder="/api/orders"
                className="w-full rounded-lg border border-line bg-raised px-3 py-2.5 font-mono text-[12px] font-semibold text-teal outline-none transition-colors focus:border-line2" />
            </div>
          )}
          {err && <div className="toast-in rounded-lg border border-coral/45 bg-coral/10 px-3 py-2 text-[12px] font-bold text-coral">{err}</div>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-line bg-raised px-4 py-2.5 text-[12.5px] font-extrabold text-mist transition-all hover:border-line2 hover:text-fog active:scale-95">Отмена</button>
          <button onClick={submit} className="flex items-center gap-1.5 rounded-lg bg-amber px-4 py-2.5 text-[12.5px] font-extrabold text-[#17211d] transition-all hover:bg-amber2 active:scale-95">
            <Check size={14} strokeWidth={2.8} />{state.mode === "edit" ? "Сохранить" : "Добавить"}
          </button>
        </div>
      </div>
    </div>
  );
}
