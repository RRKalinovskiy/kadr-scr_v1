import { useMemo, useRef, useState } from "react";
import type { MouseEvent as RMouseEvent } from "react";
import { ArrowDownUp, Eye, EyeOff, ListChecks, Play, Plus, Search, SearchX, Trash2, X } from "lucide-react";
import type { AutoTest, Collection, Person, TreeNode } from "../types";
import { ROOT_SUITE, STATUS_WEIGHT, fmtDate, fmtDur, fmtElapsed, fmtTime } from "../types";
import { Avatar, StatusBadge } from "./ui";
import { TagChip } from "./TagPicker";

type Filter = "all" | "progress" | "passed" | "diff" | "failed" | "off";
type SortBy = "order" | "name" | "status" | "time";

const GRID = "grid grid-cols-[34px_minmax(0,1fr)_148px_150px_minmax(150px,180px)_76px] items-center gap-x-3";

export default function TestTable({ col, people, selectedId, flashId, onSelect, onCtxMenu, onRun, onDelete, onSetEnabled, onToggleEnabled, onAdd, tagColors, scopedTestIds, scopeName, onClearScope }: {
  col: Collection; people: Person[]; selectedId: string | null; flashId: string | null;
  onSelect: (id: string | null) => void; onCtxMenu: (e: RMouseEvent, t: AutoTest) => void;
  onRun: (ids: string[]) => void; onDelete: (ids: string[]) => void;
  onSetEnabled: (ids: string[], v: boolean) => void; onToggleEnabled: (id: string) => void; onAdd: () => void;
  tagColors: Record<string, string>; scopedTestIds: Set<string> | null; scopeName: string | null; onClearScope: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("order");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);
  const confirmTimer = useRef<number | undefined>(undefined);

  const personOf = (id: string) => people.find((p) => p.id === id) ?? people[0];

  const orderMap = useMemo(() => {
    const m = new Map<string, number>();
    let i = 0;
    const walk = (ns: TreeNode[]) => ns.forEach((n) => { if (n.kind === "request") m.set(n.id, i++); else if (n.kind === "folder") walk(n.children); });
    walk(col.tree);
    return m;
  }, [col.tree]);

  const scopedList = useMemo(() => (scopedTestIds ? col.tests.filter((t) => scopedTestIds.has(t.id)) : col.tests), [col.tests, scopedTestIds]);

  const matchesFilter = (t: AutoTest, f: Filter) =>
    f === "all" ? true : f === "progress" ? t.status === "running" || t.status === "queued" :
    f === "off" ? !t.enabled || t.status === "skipped" : t.status === f;
  const countOf = (f: Filter) => scopedList.filter((t) => matchesFilter(t, f)).length;
  const orderIndex = (t: AutoTest) => (t.requestId ? orderMap.get(t.requestId) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = scopedList.filter((t) =>
      matchesFilter(t, filter) &&
      (!q || t.name.toLowerCase().includes(q) || t.path.toLowerCase().includes(q) || t.tags.some((tag) => tag.toLowerCase().includes(q))));
    return [...list].sort((a, b) => {
      if (sortBy === "order") return orderIndex(a) - orderIndex(b);
      if (sortBy === "name") return a.name.localeCompare(b.name, "ru");
      if (sortBy === "status") return STATUS_WEIGHT[a.status] - STATUS_WEIGHT[b.status] || a.name.localeCompare(b.name, "ru");
      return (b.lastRun ?? 0) - (a.lastRun ?? 0);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedList, orderMap, query, filter, sortBy]);

  const allVisibleChecked = visible.length > 0 && visible.every((t) => checked.has(t.id));
  const inBuild = col.tests.filter((t) => t.enabled).length;
  const toggleCheck = (id: string) => setChecked((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const checkMany = (ids: string[], on: boolean) => setChecked((prev) => { const n = new Set(prev); ids.forEach((i) => (on ? n.add(i) : n.delete(i))); return n; });

  const armBulkDelete = () => {
    if (!confirmBulk) {
      setConfirmBulk(true);
      window.clearTimeout(confirmTimer.current);
      confirmTimer.current = window.setTimeout(() => setConfirmBulk(false), 2600);
      return;
    }
    window.clearTimeout(confirmTimer.current);
    setConfirmBulk(false);
    onDelete([...checked]);
    setChecked(new Set());
  };

  const FILTERS: Array<{ id: Filter; label: string }> = [
    { id: "all", label: "Все" }, { id: "progress", label: "В работе" }, { id: "passed", label: "Успешно" },
    { id: "diff", label: "Расхождения" }, { id: "failed", label: "Падения" }, { id: "off", label: "Вне сборки" },
  ];
  const cc = col.color || "#ffb454";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative shrink-0 overflow-hidden px-5 pb-3 pt-4">
        <div className="pointer-events-none absolute inset-0" style={{ background: `linear-gradient(105deg, ${cc}1f 0%, ${cc}0a 45%, transparent 75%)` }} />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px]" style={{ background: `linear-gradient(90deg, ${cc}, ${cc}55 55%, transparent)` }} />
        <div className="relative flex items-center gap-3">
          <div className="min-w-0">
            <h1 className="truncate font-display text-[16px] font-bold text-fog">{col.name}</h1>
            <p className="mt-0.5 truncate font-mono text-[11px] font-semibold text-dim">{col.screenUrl} · {col.browser}</p>
          </div>
          {scopeName && (
            <button onClick={onClearScope} title="Снять фильтр"
              className="fade-up flex shrink-0 items-center gap-1.5 rounded-lg border border-teal/50 bg-teal/10 px-2.5 py-1.5 text-[11.5px] font-extrabold text-teal transition-all hover:bg-teal/20 active:scale-95">
              <ListChecks size={12} />{scopeName}: {scopedTestIds?.size ?? 0}<X size={12} strokeWidth={3} />
            </button>
          )}
          <button onClick={onAdd}
            className="ml-auto flex h-[34px] shrink-0 items-center gap-1.5 rounded-lg border px-3 text-[12.5px] font-extrabold transition-all duration-150 active:scale-95"
            style={{ borderColor: `${cc}80`, background: `${cc}14`, color: cc }}
            onMouseEnter={(e) => { e.currentTarget.style.background = `${cc}26`; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = `${cc}14`; }}>
            <Plus size={14} strokeWidth={2.6} />Добавить тест
          </button>
        </div>
        <div className="relative mt-3 flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-dim" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск: имя, путь, тег…"
              className="h-8 w-52 rounded-lg border border-line bg-raised pl-8 pr-7 text-[12.5px] font-semibold text-fog outline-none transition-colors placeholder:text-dim focus:border-line2" />
            {query && <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-dim hover:text-fog"><X size={13} /></button>}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {FILTERS.map((f) => {
              const n = countOf(f.id);
              const active = filter === f.id;
              return (
                <button key={f.id} onClick={() => setFilter(f.id)}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11.5px] font-bold transition-all duration-150 ${active ? "bg-fog/10 text-fog shadow-[inset_0_0_0_1px_rgba(233,244,243,0.18)]" : "text-mist hover:bg-raised hover:text-fog"}`}>
                  {f.label}<span className={`font-mono text-[10px] font-bold ${active ? "text-amber" : "text-dim"}`}>{n}</span>
                </button>
              );
            })}
          </div>
          <button onClick={() => setSortBy(sortBy === "order" ? "status" : sortBy === "status" ? "time" : sortBy === "time" ? "name" : "order")}
            className="ml-auto flex h-8 items-center gap-1.5 rounded-lg border border-line bg-raised px-2.5 text-[11.5px] font-bold text-mist transition-colors hover:border-line2 hover:text-fog">
            <ArrowDownUp size={13} />
            {sortBy === "order" ? "По сценарию" : sortBy === "name" ? "По имени" : sortBy === "status" ? "По статусу" : "По времени"}
          </button>
          <button onClick={() => { setBulkOpen((v) => !v); if (bulkOpen) setChecked(new Set()); }}
            className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11.5px] font-bold transition-all duration-150 active:scale-95 ${bulkOpen ? "border-teal/50 bg-teal/10 text-teal" : "border-line bg-raised text-mist hover:border-line2 hover:text-fog"}`}>
            <ListChecks size={13} />Массовые{checked.size > 0 ? ` · ${checked.size}` : ""}
          </button>
        </div>
      </div>

      {bulkOpen && (
        <div className="toast-in mx-5 mb-2 flex shrink-0 flex-wrap items-center gap-2 rounded-lg border border-teal/35 bg-teal/[0.07] px-3 py-2">
          <span className="flex items-center gap-1.5 text-[12px] font-extrabold text-teal"><ListChecks size={14} />Выбрано: {checked.size}</span>
          <span className="h-4 w-px bg-line2" />
          <button onClick={() => onRun([...checked])} disabled={checked.size === 0} className="flex items-center gap-1.5 rounded-md bg-teal/15 px-2.5 py-1 text-[11.5px] font-extrabold text-teal transition-all hover:bg-teal/25 active:scale-95 disabled:opacity-40"><Play size={11} fill="currentColor" /> Запустить</button>
          <button onClick={() => onSetEnabled([...checked], false)} disabled={checked.size === 0} className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] font-extrabold text-mist transition-all hover:bg-raised hover:text-fog active:scale-95 disabled:opacity-40"><EyeOff size={12} /> Исключить</button>
          <button onClick={() => onSetEnabled([...checked], true)} disabled={checked.size === 0} className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] font-extrabold text-mist transition-all hover:bg-raised hover:text-fog active:scale-95 disabled:opacity-40"><Eye size={12} /> Вернуть в сборку</button>
          <button onClick={armBulkDelete} disabled={checked.size === 0}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] font-extrabold transition-all active:scale-95 disabled:opacity-40 ${confirmBulk ? "bg-coral text-[#2b0f0b]" : "text-coral hover:bg-coral/15"}`}>
            <Trash2 size={12} /> {confirmBulk ? `Точно удалить ${checked.size}?` : "Удалить"}
          </button>
          <button onClick={() => setChecked(new Set())} className="ml-auto text-[11.5px] font-bold text-dim transition-colors hover:text-fog">Снять выделение</button>
        </div>
      )}

      <div className={`${GRID} shrink-0 border-y border-line bg-panel/70 px-5 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em] text-dim`}>
        {bulkOpen ? (
          <input type="checkbox" checked={allVisibleChecked} onChange={() => checkMany(visible.map((t) => t.id), !allVisibleChecked)} className="h-3.5 w-3.5 cursor-pointer accent-[#4fe0c4]" />
        ) : (<span className="w-[14px]" />)}
        <span>Тест</span><span>Статус</span><span>Время</span><span>Ответственный</span><span className="text-right">Действия</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
        {col.tests.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-xl border border-dashed border-line2 text-dim"><ListChecks size={24} /></div>
            <div>
              <div className="text-[14px] font-extrabold text-fog">В наборе пока нет тестов</div>
              <div className="mt-1 text-[12px] font-semibold text-dim">Добавьте первый сценарий — он появится в сборке</div>
            </div>
            <button onClick={onAdd} className="mt-1 flex items-center gap-1.5 rounded-lg bg-amber px-3.5 py-2 text-[12.5px] font-extrabold text-[#17211d] transition-all hover:bg-amber2 active:scale-95"><Plus size={14} strokeWidth={2.6} /> Добавить тест</button>
          </div>
        ) : visible.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-xl border border-dashed border-line2 text-dim"><SearchX size={24} /></div>
            <div>
              <div className="text-[14px] font-extrabold text-fog">Ничего не найдено</div>
              <div className="mt-1 text-[12px] font-semibold text-dim">Попробуйте сбросить фильтры или изменить запрос</div>
            </div>
            <button onClick={() => { setQuery(""); setFilter("all"); onClearScope(); }}
              className="mt-1 rounded-lg border border-line bg-raised px-3.5 py-2 text-[12.5px] font-extrabold text-mist transition-all hover:border-line2 hover:text-fog active:scale-95">Сбросить фильтры</button>
          </div>
        ) : (
          visible.map((t) => {
            const p = personOf(t.assignee);
            const isChecked = checked.has(t.id);
            const isSelected = selectedId === t.id;
            const off = !t.enabled;
            const busy = t.status === "running" || t.status === "queued";
            const manual = t.testType === "manual";
            return (
              <div key={t.id} data-row onClick={() => onSelect(isSelected ? null : t.id)} onContextMenu={(e) => onCtxMenu(e, t)}
                className={`${GRID} group relative cursor-pointer border-b border-line/60 px-5 py-2.5 transition-colors duration-150 ${isSelected ? "bg-raised" : "hover:bg-raised/60"} ${off ? "opacity-55" : ""} ${flashId === t.id ? "row-flash" : ""}`}>
                {isSelected && <span className="absolute inset-y-0 left-0 w-[3px] bg-teal" />}
                {bulkOpen ? (
                  <input type="checkbox" checked={isChecked} onChange={() => toggleCheck(t.id)} onClick={(e) => e.stopPropagation()} className="h-3.5 w-3.5 cursor-pointer accent-[#4fe0c4]" />
                ) : (<span className="w-[14px]" />)}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[13px] font-bold text-fog">{t.name}</span>
                    {manual && <span className="shrink-0 rounded bg-[#c9a2ff]/15 px-1.5 py-[1px] text-[9px] font-extrabold text-[#c9a2ff] shadow-[inset_0_0_0_1px_rgba(201,162,255,0.4)]">ручной</span>}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    {t.suite === ROOT_SUITE ? (
                      <span className="shrink-0 rounded border border-dashed border-line2/60 px-1.5 py-[1px] text-[10px] font-bold text-dim">корень</span>
                    ) : (
                      <span className="shrink-0 rounded bg-line/80 px-1.5 py-[1px] text-[10px] font-bold text-mist">{t.suite}</span>
                    )}
                    <span className="truncate font-mono text-[10.5px] font-semibold text-dim">{t.path}</span>
                    {t.tags.length > 0 && (
                      <span className="flex shrink-0 items-center gap-1">
                        {t.tags.slice(0, 2).map((tag) => <TagChip key={tag} tag={tag} color={tagColors[tag]} size="sm" />)}
                        {t.tags.length > 2 && <span className="font-mono text-[9px] font-bold text-dim">+{t.tags.length - 2}</span>}
                      </span>
                    )}
                  </div>
                </div>
                <div className="min-w-0">
                  <StatusBadge status={t.status} />
                  {t.status === "diff" && t.diffPct !== undefined && <div className="mt-1 font-mono text-[10px] font-bold text-amber">Δ {t.diffPct.toFixed(1).replace(".", ",")} %</div>}
                </div>
                <div className="min-w-0">
                  {t.status === "running" && t.startedAt ? (
                    <div><div className="font-mono text-[12px] font-bold text-teal">{fmtElapsed(t.startedAt)}</div><div className="text-[10px] font-semibold text-dim">идёт прогон…</div></div>
                  ) : t.status === "queued" ? (<div className="text-[11.5px] font-bold text-mist">ожидает слот</div>)
                  : t.lastRun ? (
                    <div>
                      <div className="text-[12px] font-bold text-fog">{fmtTime(t.lastRun)} <span className="font-semibold text-dim">{fmtDate(t.lastRun)}</span></div>
                      {t.durMs !== undefined && <div className="font-mono text-[10px] font-semibold text-dim">за {fmtDur(t.durMs)}</div>}
                    </div>
                  ) : (<div className="text-[11.5px] font-semibold text-dim">ещё не запускался</div>)}
                </div>
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar person={p} size={24} />
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-bold text-fog">{p.name}</div>
                    <div className="truncate font-mono text-[10px] font-semibold text-dim">@{p.login}</div>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                  <button title="Запустить тест" onClick={(e) => { e.stopPropagation(); onRun([t.id]); }} disabled={busy}
                    className="grid h-7 w-7 place-items-center rounded-md text-teal transition-all hover:bg-teal/15 active:scale-90 disabled:opacity-30">
                    <Play size={13} fill="currentColor" />
                  </button>
                  <button title={off ? "Вернуть в сборку" : "Исключить из сборки"} onClick={(e) => { e.stopPropagation(); onToggleEnabled(t.id); }}
                    className="grid h-7 w-7 place-items-center rounded-md text-mist transition-all hover:bg-raised hover:text-fog active:scale-90">
                    {off ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex h-8 shrink-0 items-center gap-3 border-t border-line bg-panel/70 px-5 text-[11px] font-bold text-dim">
        <span>Показано <span className="text-mist">{visible.length}</span> из {scopedList.length}{scopeName ? <span className="text-dim"> · в коллекции {col.tests.length}</span> : null}</span>
        <span className="h-3 w-px bg-line" />
        <span>в сборке <span className="text-teal">{inBuild}</span> · исключено {col.tests.length - inBuild}</span>
        <span className="ml-auto hidden font-mono text-[10px] font-semibold text-dim md:block">ПКМ по тесту — меню</span>
      </div>
    </div>
  );
}
