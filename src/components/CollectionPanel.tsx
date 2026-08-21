import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { DndContext, DragOverlay, PointerSensor, closestCorners, useSensor, useSensors, type DragEndEvent, type DragOverEvent, type DragStartEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArchiveRestore, ChevronRight, Folder, FolderOpen, FolderPlus, Layers, Lock, Pencil, Play, Plus, RefreshCw, RotateCcw, Server, Settings, Shield, ShieldAlert, ShieldCheck, Trash2, Zap } from "lucide-react";
import type { AuthCheckState, Collection, CollectionDraft, CookieStore, FolderNode, HttpMethod, RequestNode, TreeNode } from "../types";
import { METHOD_COLORS } from "../types";
import { childrenOf, getTrash, isDescendant, isInsideTrash, nodeById, parentOf, treeStats } from "../tree";
import { hostOfUrl, urlStatusMeta, type UrlState } from "../urlcheck";
import ContextMenu, { type MenuItem } from "./ContextMenu";
import NodeModal, { type NodeModalState, type NodeSubmit } from "./NodeModal";
import CollectionModal, { type CardState } from "./CollectionModal";

type MenuTarget = { kind: "collection"; id: string } | { kind: "node"; id: string } | { kind: "space" };

interface TreeCtx {
  dragDisabled: boolean;
  expandedFolders: Set<string>;
  folderScope: string | null;
  onDelete: (id: string) => void;
  onEdit: (node: TreeNode) => void;
  onAddRequest: (parentId: string) => void;
  onToggleFolder: (id: string) => void;
  onSelectFolder: (id: string | null) => void;
  onOpenTest: (nodeId: string) => void;
  onFilterFailing: (folderId: string) => void;
  onCtx: (e: React.MouseEvent, nodeId: string) => void;
  onRestoreNode: (id: string) => void;
  onPurgeNode: (id: string, name: string) => void;
}
const TreeContext = createContext<TreeCtx | null>(null);
const useTree = () => useContext(TreeContext)!;

function useSortRow(id: string, disabled: boolean) {
  const s = useSortable({ id, disabled });
  return {
    wrapper: {
      ref: s.setNodeRef,
      style: {
        transform: CSS.Translate.toString(s.transform),
        transition: s.transition,
        opacity: s.isDragging ? 0.4 : 1,
        position: "relative" as const,
        zIndex: s.isDragging ? 6 : undefined,
      },
    },
    handle: { ...s.attributes, ...s.listeners },
  };
}

function MethodBadge({ method }: { method: HttpMethod }) {
  const c = METHOD_COLORS[method];
  return (
    <span className="grid w-[44px] shrink-0 place-items-center rounded py-[3px] font-mono text-[9px] font-bold"
      style={{ color: c, background: `${c}1c`, boxShadow: `inset 0 0 0 1px ${c}55` }}>
      {method}
    </span>
  );
}

function NodeActions({ node, onAddRequest }: { node: TreeNode; onAddRequest?: () => void }) {
  const ctx = useTree();
  const actionBtn = "grid h-6 w-6 place-items-center rounded-md text-mist transition-all duration-150 hover:bg-line hover:text-fog active:scale-90";
  return (
    <span className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5 rounded-md bg-raised/95 pl-0.5 opacity-0 shadow-[0_4px_14px_rgba(0,0,0,0.35)] transition-opacity duration-150 group-hover:opacity-100"
      onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} onContextMenu={(e) => e.stopPropagation()}>
      {onAddRequest && <button className={actionBtn} title="Добавить запрос в папку" onClick={onAddRequest}><Plus size={12} strokeWidth={2.6} /></button>}
      <button className={actionBtn} title="Редактировать" onClick={() => ctx.onEdit(node)}><Pencil size={11.5} /></button>
      <button className={`${actionBtn} hover:bg-coral/15 hover:text-coral`} title="В корзину" onClick={() => ctx.onDelete(node.id)}><Trash2 size={12} /></button>
    </span>
  );
}

function RequestRow({ node }: { node: RequestNode }) {
  const ctx = useTree();
  const { wrapper, handle } = useSortRow(node.id, ctx.dragDisabled);
  return (
    <div {...wrapper}>
      <div {...handle} onClick={() => ctx.onOpenTest(node.id)} onContextMenu={(e) => ctx.onCtx(e, node.id)}
        className="group relative flex cursor-grab select-none items-center gap-2 rounded-md border border-transparent px-1.5 py-[5px] transition-colors duration-150 hover:border-line hover:bg-raised active:cursor-grabbing"
        title={`${node.method} ${node.path} — клик: открыть карточку теста · ПКМ: меню`}>
        <MethodBadge method={node.method} />
        <div className="min-w-0 pr-12">
          <div className="truncate text-[12px] font-bold leading-tight text-fog">{node.name}</div>
          <div className="truncate font-mono text-[10px] font-semibold leading-tight text-dim">{node.path}</div>
        </div>
        <NodeActions node={node} />
      </div>
    </div>
  );
}

function FolderRow({ node }: { node: FolderNode }) {
  const ctx = useTree();
  const { wrapper, handle } = useSortRow(node.id, ctx.dragDisabled);
  const open = ctx.expandedFolders.has(node.id);
  const scoped = ctx.folderScope === node.id;
  return (
    <div {...wrapper}>
      <div {...handle} onClick={() => ctx.onSelectFolder(scoped ? null : node.id)} onContextMenu={(e) => ctx.onCtx(e, node.id)}
        className={`group relative flex h-[30px] cursor-grab select-none items-center gap-1.5 rounded-md border px-1.5 transition-colors duration-150 active:cursor-grabbing ${scoped ? "border-teal/55 bg-teal/[0.08]" : "border-transparent hover:border-line hover:bg-raised"}`}>
        <button onClick={(e) => { e.stopPropagation(); ctx.onToggleFolder(node.id); }} onPointerDown={(e) => e.stopPropagation()} onContextMenu={(e) => e.stopPropagation()}
          title={open ? "Свернуть папку" : "Развернуть папку"}
          className="grid h-5 w-5 shrink-0 place-items-center rounded text-dim transition-all hover:bg-line hover:text-fog active:scale-90">
          <ChevronRight size={12} className={`transition-transform duration-200 ${open ? "rotate-90" : ""}`} />
        </button>
        {open ? <FolderOpen size={14} className="shrink-0 text-amber" /> : <Folder size={14} className="shrink-0 text-amber/80" />}
        <span className={`truncate text-[12px] font-extrabold ${scoped ? "text-teal" : "text-fog"}`}>{node.name}</span>
        <button onClick={(e) => { e.stopPropagation(); ctx.onFilterFailing(node.id); }} onPointerDown={(e) => e.stopPropagation()} onContextMenu={(e) => e.stopPropagation()}
          title="Упавшие тесты папки"
          className="ml-0.5 rounded bg-line/70 px-1.5 py-[1px] font-mono text-[9.5px] font-bold text-mist transition-all hover:bg-coral/20 hover:text-coral active:scale-95">
          {node.children.length}
        </button>
        {scoped && <span className="pulse-dot ml-auto mr-1 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />}
        <NodeActions node={node} onAddRequest={() => ctx.onAddRequest(node.id)} />
      </div>
      {open && (
        <div className="my-[3px] ml-[13px] space-y-[3px] border-l border-line/70 pl-1.5">
          <SortableContext items={node.children.map((n) => n.id)} strategy={verticalListSortingStrategy}>
            {node.children.map((n) => (n.kind === "request" ? <RequestRow key={n.id} node={n} /> : <FolderRow key={n.id} node={n} />))}
          </SortableContext>
          {node.children.length === 0 && <div className="rounded-md border border-dashed border-line2/60 px-2 py-1.5 text-[10.5px] font-semibold text-dim">Папка пуста — добавьте запрос</div>}
        </div>
      )}
    </div>
  );
}

function TrashedRow({ node }: { node: TreeNode }) {
  const ctx = useTree();
  const isFolder = node.kind === "folder";
  return (
    <div onContextMenu={(e) => ctx.onCtx(e, node.id)}
      className="group relative flex select-none items-center gap-2 rounded-md border border-transparent px-1.5 py-[5px] opacity-70 transition-all hover:border-line hover:bg-raised hover:opacity-100">
      {isFolder ? <Folder size={13} className="shrink-0 text-amber/70" /> : <Zap size={13} className="shrink-0 text-teal/70" />}
      <div className="min-w-0 pr-12">
        <div className="truncate text-[12px] font-bold leading-tight text-fog">{node.name}</div>
        <div className="truncate font-mono text-[10px] font-semibold leading-tight text-dim">
          {isFolder ? `папка · ${(node as FolderNode).children.length} вложений` : (node as RequestNode).path}
        </div>
      </div>
      <span className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5 rounded-md bg-raised/95 pl-0.5 opacity-0 shadow-[0_4px_14px_rgba(0,0,0,0.35)] transition-opacity duration-150 group-hover:opacity-100"
        onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
        <button className="grid h-6 w-6 place-items-center rounded-md text-teal transition-all hover:bg-teal/15 active:scale-90" title="Восстановить" onClick={() => ctx.onRestoreNode(node.id)}><RotateCcw size={12} /></button>
        <button className="grid h-6 w-6 place-items-center rounded-md text-coral transition-all hover:bg-coral/15 active:scale-90" title="Удалить навсегда" onClick={() => ctx.onPurgeNode(node.id, node.name)}><Trash2 size={12} /></button>
      </span>
    </div>
  );
}

function TrashFolderRow({ node }: { node: FolderNode }) {
  const ctx = useTree();
  const open = ctx.expandedFolders.has(node.id);
  return (
    <div className="mt-1">
      <div onClick={() => ctx.onToggleFolder(node.id)}
        className="flex h-[30px] cursor-pointer select-none items-center gap-1.5 rounded-md border border-dashed border-line2/60 px-1.5 transition-colors hover:border-line2 hover:bg-raised/60"
        title="Служебная папка — её нельзя переименовать или переместить">
        <ChevronRight size={12} className={`shrink-0 text-dim transition-transform duration-200 ${open ? "rotate-90" : ""}`} />
        <Trash2 size={13} className="shrink-0 text-coral/80" />
        <span className="truncate text-[12px] font-extrabold text-mist">{node.name}</span>
        <span className="ml-0.5 rounded bg-coral/15 px-1.5 py-[1px] font-mono text-[9.5px] font-bold text-coral">{node.children.length}</span>
        <Lock size={10} className="ml-auto mr-1 shrink-0 text-dim" />
      </div>
      {open && (
        <div className="my-[3px] ml-[13px] space-y-[3px] border-l border-coral/25 pl-1.5">
          {node.children.map((n) => <TrashedRow key={n.id} node={n} />)}
          {node.children.length === 0 && <div className="rounded-md border border-dashed border-line2/50 px-2 py-1.5 text-[10.5px] font-semibold text-dim">Корзина пуста</div>}
        </div>
      )}
    </div>
  );
}

function CollectionItem({ c, active, expanded, colDragDisabled, onToggle, onCtx, onOpenCard, onFailingFilter, children }: {
  c: Collection; active: boolean; expanded: boolean; colDragDisabled: boolean;
  onToggle: () => void; onCtx: (e: React.MouseEvent, id: string) => void; onOpenCard: () => void; onFailingFilter: (id: string) => void;
  children?: ReactNode;
}) {
  const { wrapper, handle } = useSortRow(c.id, colDragDisabled);
  const failing = c.tests.filter((t) => t.status === "failed" || t.status === "diff").length;
  return (
    <div {...wrapper}>
      <div {...handle} onClick={onToggle} onContextMenu={(e) => onCtx(e, c.id)}
        className={`group flex h-[38px] cursor-grab select-none items-center gap-2 rounded-lg border px-2 transition-all duration-150 active:cursor-grabbing ${active ? "border-line2 bg-raised/80" : "border-transparent hover:border-line hover:bg-raised/60"}`}>
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md" style={{ background: `${c.color}1f`, color: c.color }}><Layers size={13} /></span>
        <span className={`min-w-0 flex-1 truncate text-[12.5px] font-extrabold ${active ? "text-fog" : "text-mist group-hover:text-fog"}`}>{c.name}</span>
        <button onClick={(e) => { e.stopPropagation(); onOpenCard(); }} onPointerDown={(e) => e.stopPropagation()} onContextMenu={(e) => e.stopPropagation()}
          title="Открыть карточку коллекции"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-dim opacity-0 transition-all duration-150 hover:bg-amber/15 hover:text-amber group-hover:opacity-100 active:scale-90">
          <Settings size={13} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onFailingFilter(c.id); }} onPointerDown={(e) => e.stopPropagation()} onContextMenu={(e) => e.stopPropagation()}
          title="Упавшие автотесты — фильтровать список"
          className={`shrink-0 rounded-md px-1.5 py-[2px] font-mono text-[10px] font-bold transition-all active:scale-95 ${failing > 0 ? "bg-coral/15 text-coral hover:bg-coral/30" : "bg-line/60 text-dim hover:text-mist"}`}>
          {failing}
        </button>
        <ChevronRight size={12} className={`shrink-0 text-dim transition-transform duration-200 ${expanded ? "rotate-90" : ""}`} />
      </div>
      {children}
    </div>
  );
}

function DeletedRow({ c, onRestore, onPurge, onCtx }: { c: Collection; onRestore: () => void; onPurge: () => void; onCtx: (e: React.MouseEvent, id: string) => void }) {
  const stats = treeStats(c.tree);
  return (
    <div onContextMenu={(e) => onCtx(e, c.id)} className="group flex items-center gap-2 rounded-lg border border-dashed border-line2/60 bg-raised/30 px-2 py-1.5 opacity-75 transition-all hover:opacity-100">
      <Trash2 size={13} className="shrink-0 text-coral/70" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] font-extrabold text-mist line-through decoration-coral/50">{c.name}</div>
        <div className="font-mono text-[9.5px] font-semibold text-dim">{c.tests.length} тестов · {stats.requests} запросов</div>
      </div>
      <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
        <button onClick={onRestore} title="Восстановить коллекцию" className="grid h-6 w-6 place-items-center rounded-md text-teal transition-all hover:bg-teal/15 active:scale-90"><ArchiveRestore size={13} /></button>
        <button onClick={onPurge} title="Удалить безвозвратно" className="grid h-6 w-6 place-items-center rounded-md text-coral transition-all hover:bg-coral/15 active:scale-90"><Trash2 size={13} /></button>
      </span>
    </div>
  );
}

function StandsPanel({ cols, statuses, auths, updatedAt, onCheckUrl, onRefresh, onOpenCard }: {
  cols: Collection[]; statuses: Record<string, UrlState>; auths: Record<string, AuthCheckState>; updatedAt: number | null;
  onCheckUrl: (id: string) => void; onRefresh: () => void; onOpenCard: (id: string) => void;
}) {
  const anyChecking = cols.some((c) => statuses[c.id]?.state === "checking");
  const okCount = cols.filter((c) => { const s = statuses[c.id]?.state; return s === "ok" || s === "warn" || s === "opaque"; }).length;
  const AuthShield = ({ auth }: { auth?: AuthCheckState }) => {
    const st = auth?.state ?? "idle";
    if (st === "checking") return <Shield size={12} className="pulse-dot shrink-0 text-teal" />;
    if (st === "ok") return <ShieldCheck size={12} className="shrink-0 text-[#46d68c]" />;
    if (st === "err") return <ShieldAlert size={12} className="shrink-0 text-coral" />;
    return <Shield size={12} className="shrink-0 text-line2" />;
  };
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-line bg-raised/40">
      <div className="flex items-center gap-1.5 border-b border-line/70 px-2.5 py-2">
        <Server size={12} className="shrink-0 text-teal" />
        <span className="text-[9.5px] font-extrabold uppercase tracking-[0.13em] text-mist">Доступность стендов</span>
        <span className="ml-auto rounded bg-line/70 px-1.5 py-[1px] font-mono text-[9px] font-bold text-mist">{okCount}/{cols.length}</span>
        <button onClick={onRefresh} title="Проверить все стенды" className="grid h-[22px] w-[22px] place-items-center rounded-md text-dim transition-all duration-150 hover:bg-line hover:text-teal active:scale-90">
          <RefreshCw size={11} className={anyChecking ? "spin" : ""} />
        </button>
      </div>
      <div className="max-h-[168px] overflow-y-auto p-1 scroll-thin">
        {cols.map((c) => {
          const meta = urlStatusMeta(statuses[c.id]);
          const checking = statuses[c.id]?.state === "checking";
          return (
            <div key={c.id} onClick={() => onOpenCard(c.id)} title={`Открыть карточку «${c.name}»`}
              className="group flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-[5px] transition-colors duration-150 hover:bg-raised">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${checking ? "pulse-dot" : ""}`} style={{ background: meta.color }} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-bold leading-tight text-fog">{c.name}</div>
                <div className="truncate font-mono text-[9.5px] font-semibold leading-tight text-dim">{hostOfUrl(c.screenUrl)}</div>
              </div>
              <AuthShield auth={auths[c.id]} />
              <div className="shrink-0 text-right">
                <div className="font-mono text-[9.5px] font-bold leading-tight" style={{ color: meta.color }}>{meta.label}</div>
                {meta.sub && <div className="font-mono text-[8.5px] font-semibold leading-tight text-dim">{meta.sub}</div>}
              </div>
              <button onClick={(e) => { e.stopPropagation(); onCheckUrl(c.id); }} title="Проверить стенд"
                className="grid h-5 w-5 shrink-0 place-items-center rounded text-dim opacity-0 transition-all duration-150 hover:text-teal group-hover:opacity-100 active:scale-90">
                <RefreshCw size={10} className={checking ? "spin" : ""} />
              </button>
            </div>
          );
        })}
      </div>
      <div className="border-t border-line/70 px-2.5 py-1.5 text-[9px] font-semibold text-dim">
        {updatedAt ? `обновлено в ${new Date(updatedAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}` : "проверяем…"} · авто — после каждой сборки
      </div>
    </div>
  );
}

export default function CollectionPanel(props: {
  collections: Collection[]; activeId: string; onSelect: (id: string) => void;
  folderScope: string | null; onSelectFolder: (id: string | null) => void;
  onOpenTest: (nodeId: string) => void; onFilterFailing: (id: string) => void;
  onCreateCollection: (d: CollectionDraft) => void;
  onCreateNode: (parentId: string | null, d: { kind: "request" | "folder"; name: string; path?: string }) => void;
  onAddRequest: (parentId: string | null) => void;
  onUpdateNode: (nodeId: string, patch: { name: string; path?: string }) => void;
  onDeleteNode: (nodeId: string) => void;
  onMoveNode: (fromId: string, toParent: string | null, toIndex: number) => void;
  onMoveCollection: (fromId: string, toIndex: number) => void;
  onDeleteCollection: (id: string) => void;
  onRestoreNode: (nodeId: string) => void; onPurgeNode: (nodeId: string) => void;
  onRestoreCollection: (id: string) => void; onPurgeCollection: (id: string) => void;
  onSaveCard: (id: string, patch: Partial<Collection>) => void;
  buildActive: boolean; onRunAll: (id: string) => void;
  urlStatuses: Record<string, UrlState>; onCheckUrl: (id: string) => void; onRefreshStands: () => void;
  standsUpdatedAt: number | null; authChecks: Record<string, AuthCheckState>;
  onCheckAuth: (id: string, draft?: CollectionDraft) => void; cookieStore: CookieStore;
}) {
  const { collections, activeId, onSelect, folderScope, onSelectFolder, onOpenTest, onFilterFailing, onCreateCollection, onCreateNode, onAddRequest, onUpdateNode, onDeleteNode, onMoveNode, onMoveCollection, onDeleteCollection, onRestoreNode, onPurgeNode, onRestoreCollection, onPurgeCollection, onSaveCard, buildActive, onRunAll, urlStatuses, onCheckUrl, onRefreshStands, standsUpdatedAt, authChecks, onCheckAuth, cookieStore } = props;

  const col = collections.find((c) => c.id === activeId) ?? collections[0];
  const tree = col.tree;
  const trashFolder = getTrash(tree);
  const normalNodes = tree.filter((n) => !(n.kind === "folder" && n.isTrash));
  const visible = collections.filter((c) => !c.deleted);
  const deleted = collections.filter((c) => c.deleted);

  const [expandedCol, setExpandedCol] = useState<string | null>(activeId);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [showDeleted, setShowDeleted] = useState(false);
  const [cardState, setCardState] = useState<CardState | null>(null);
  const [modal, setModal] = useState<NodeModalState | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; target: MenuTarget } | null>(null);
  const [purge, setPurge] = useState<{ kind: "collection" | "node"; id: string; name: string } | null>(null);
  const [dragInfo, setDragInfo] = useState<{ kind: "collection" | "node"; label: string; node?: TreeNode } | null>(null);
  const [panelW, setPanelW] = useState(() => Math.min(430, Math.max(232, +(localStorage.getItem("kadr-panel-w") || 292))));
  const movedRef = useRef(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  useEffect(() => { setExpandedCol(activeId); }, [activeId]);
  useEffect(() => { localStorage.setItem("kadr-panel-w", String(panelW)); }, [panelW]);

  const focusedFolder = folderScope && nodeById(tree, folderScope)?.kind === "folder" ? folderScope : null;

  const toggleFolder = (id: string) => setExpandedFolders((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const onColClick = (id: string) => { setExpandedCol((prev) => (prev === id ? null : id)); onSelect(id); };
  const openEdit = (node: TreeNode) => setModal({ mode: "edit", node });
  const openCreateFolder = (parentId: string | null) => setModal({ mode: "create", kind: "folder", parentId, parentName: parentId ? nodeById(tree, parentId)?.name ?? col.name : col.name });
  const submitModal = (r: NodeSubmit) => {
    if (r.editId) onUpdateNode(r.editId, { name: r.name, path: r.path });
    else onCreateNode(r.parentId, { kind: r.kind, name: r.name, path: r.path });
    setModal(null);
  };

  const openMenu = (e: React.MouseEvent, target: MenuTarget) => { e.preventDefault(); e.stopPropagation(); setMenu({ x: e.clientX, y: e.clientY, target }); };

  const buildItems = (): MenuItem[] => {
    if (!menu) return [];
    const t = menu.target;
    if (t.kind === "collection") {
      const c = collections.find((x) => x.id === t.id);
      if (c?.deleted) return [
        { id: "restore-col", label: "Восстановить", icon: <ArchiveRestore size={14} /> },
        { id: "purge", label: "Удалить безвозвратно", icon: <Trash2 size={14} />, danger: true, sep: true, hint: "нельзя отменить" },
      ];
      return [
        { id: "run-all", label: "Запустить все", icon: <Play size={14} />, hint: String(c?.tests.length ?? 0), disabled: buildActive },
        { id: "edit", label: "Редактировать карточку", icon: <Pencil size={14} />, sep: true },
        { id: "delete", label: "Удалить", icon: <Trash2 size={14} />, danger: true, hint: "в корзину", disabled: visible.length <= 1, sep: true },
      ];
    }
    if (t.kind === "node") {
      const n = nodeById(tree, t.id);
      const isFolder = n?.kind === "folder";
      if (isInsideTrash(tree, t.id)) return [
        { id: "restore-node", label: "Восстановить", icon: <RotateCcw size={14} /> },
        { id: "purge-node", label: "Удалить навсегда", icon: <Trash2 size={14} />, danger: true, sep: true, hint: "нельзя отменить" },
      ];
      return [
        { id: "edit", label: isFolder ? "Редактировать папку" : "Редактировать запрос", icon: <Pencil size={14} /> },
        { id: "delete", label: "В корзину", icon: <Trash2 size={14} />, sep: true, hint: isFolder ? "с вложениями" : undefined },
      ];
    }
    return [
      { id: "new-request", label: "Новый запрос", icon: <Zap size={14} /> },
      { id: "new-folder", label: "Новая папка", icon: <FolderPlus size={14} /> },
    ];
  };

  const act = (action: string) => {
    const target = menu?.target;
    setMenu(null);
    if (!target) return;
    if (target.kind === "collection") {
      const c = collections.find((x) => x.id === target.id);
      if (action === "run-all") onRunAll(target.id);
      else if (action === "edit") setCardState({ mode: "edit", id: target.id });
      else if (action === "restore-col") onRestoreCollection(target.id);
      else if (action === "purge" && c) setPurge({ kind: "collection", id: c.id, name: c.name });
      else if (action === "delete") onDeleteCollection(target.id);
      return;
    }
    if (target.kind === "node") {
      const n = nodeById(tree, target.id);
      if (!n) return;
      if (action === "edit") openEdit(n);
      else if (action === "delete") onDeleteNode(target.id);
      else if (action === "restore-node") onRestoreNode(target.id);
      else if (action === "purge-node") setPurge({ kind: "node", id: target.id, name: n.name });
      return;
    }
    if (action === "new-request") onAddRequest(focusedFolder);
    if (action === "new-folder") openCreateFolder(focusedFolder);
  };

  const handleDragStart = (e: DragStartEvent) => {
    movedRef.current = false;
    const id = String(e.active.id);
    const c = collections.find((x) => x.id === id);
    if (c) setDragInfo({ kind: "collection", label: c.name });
    else { const n = nodeById(tree, id); if (n) setDragInfo({ kind: "node", label: n.name, node: n }); }
  };
  const handleDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over || !dragInfo || dragInfo.kind !== "node") return;
    const aId = String(active.id); const oId = String(over.id);
    if (aId === oId || collections.some((c) => c.id === oId)) return;
    if (isInsideTrash(tree, aId) || isInsideTrash(tree, oId) || (trashFolder && oId === trashFolder.id)) return;
    const aParent = parentOf(tree, aId);
    if (aParent === undefined) return;
    if (isDescendant(tree, aId, oId)) return;
    let target: { parent: string | null; index: number } | null = null;
    const overNode = nodeById(tree, oId);
    if (overNode?.kind === "folder" && !overNode.isTrash && oId !== aId) {
      if (aParent !== overNode.id) target = { parent: overNode.id, index: overNode.children.length };
    } else {
      const oParent = parentOf(tree, oId);
      if (oParent === undefined) return;
      const idx = childrenOf(tree, oParent).findIndex((n) => n.id === oId);
      if (oParent !== aParent && idx >= 0) target = { parent: oParent, index: idx };
    }
    if (!target || target.parent === aParent) return;
    movedRef.current = true;
    onMoveNode(aId, target.parent, target.index);
  };
  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setDragInfo(null);
    if (!over) return;
    const aId = String(active.id); const oId = String(over.id);
    if (aId === oId) return;
    if (dragInfo?.kind === "collection") {
      const idx = collections.findIndex((c) => c.id === oId);
      if (idx >= 0) onMoveCollection(aId, idx);
      return;
    }
    if (movedRef.current || collections.some((c) => c.id === oId)) return;
    if (isInsideTrash(tree, aId) || isInsideTrash(tree, oId)) return;
    const aParent = parentOf(tree, aId);
    if (aParent === undefined) return;
    const overNode = nodeById(tree, oId);
    if (overNode?.kind === "folder" && aParent === oId) return;
    const oParent = parentOf(tree, oId);
    if (oParent === undefined) return;
    const idx = childrenOf(tree, oParent).findIndex((n) => n.id === oId);
    if (idx >= 0) onMoveNode(aId, oParent, idx);
  };

  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX; const startW = panelW;
    const onMove = (ev: PointerEvent) => setPanelW(Math.min(430, Math.max(232, startW + ev.clientX - startX)));
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const treeCtx: TreeCtx = {
    dragDisabled: dragInfo?.kind === "collection",
    expandedFolders, folderScope,
    onDelete: onDeleteNode, onEdit: openEdit,
    onAddRequest: (pid) => onAddRequest(pid),
    onToggleFolder: toggleFolder, onSelectFolder, onOpenTest, onFilterFailing,
    onCtx: (e, nodeId) => openMenu(e, { kind: "node", id: nodeId }),
    onRestoreNode, onPurgeNode: (id, name) => setPurge({ kind: "node", id, name }),
  };
  const cardCol = cardState?.mode === "edit" ? collections.find((c) => c.id === cardState.id) ?? null : null;

  return (
    <aside style={{ width: panelW }} className="relative flex shrink-0 flex-col border-r border-line bg-panel">
      <DndContext sensors={sensors} collisionDetection={closestCorners} autoScroll={false}
        onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
          <div className="p-4 pb-3">
            <div className="mb-2.5 flex items-center justify-between">
              <div className="text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-dim">Наборы сценариев</div>
              <div className="flex items-center gap-1">
                {deleted.length > 0 && (
                  <button onClick={() => setShowDeleted((v) => !v)} title={showDeleted ? "Скрыть удалённые" : "Показать удалённые коллекции"}
                    className={`flex h-6 items-center gap-1 rounded-md px-1.5 font-mono text-[10px] font-bold transition-all duration-150 active:scale-90 ${showDeleted ? "bg-coral/15 text-coral" : "bg-line/60 text-mist hover:text-fog"}`}>
                    <Trash2 size={11} /> {deleted.length}
                  </button>
                )}
                <button onClick={() => setCardState({ mode: "create" })} title="Добавить коллекцию"
                  className="grid h-6 w-6 place-items-center rounded-md bg-amber/12 text-amber transition-all duration-150 hover:bg-amber/25 active:scale-90">
                  <Plus size={14} strokeWidth={2.6} />
                </button>
              </div>
            </div>

            <TreeContext.Provider value={treeCtx}>
              <SortableContext items={visible.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1.5">
                  {visible.map((c) => (
                    <CollectionItem key={c.id} c={c} active={c.id === activeId} expanded={expandedCol === c.id}
                      colDragDisabled={dragInfo?.kind === "node"}
                      onToggle={() => onColClick(c.id)} onCtx={(e, id) => openMenu(e, { kind: "collection", id })}
                      onOpenCard={() => setCardState({ mode: "edit", id: c.id })} onFailingFilter={(id) => onFilterFailing(id)}>
                      {expandedCol === c.id && c.id === col.id && (
                        <div className="fade-up ml-[15px] mt-1.5 space-y-[3px] border-l border-line/70 py-0.5 pl-2 pr-0.5" onContextMenu={(e) => openMenu(e, { kind: "space" })}>
                          <SortableContext items={normalNodes.map((n) => n.id)} strategy={verticalListSortingStrategy}>
                            {normalNodes.map((n) => (n.kind === "request" ? <RequestRow key={n.id} node={n} /> : <FolderRow key={n.id} node={n} />))}
                          </SortableContext>
                          {normalNodes.length === 0 && <div className="rounded-md border border-dashed border-line2/60 px-2 py-2 text-[10.5px] font-semibold leading-relaxed text-dim">Пока пусто. Добавьте первый запрос или папку со сценариями.</div>}
                          {trashFolder && <TrashFolderRow node={trashFolder} />}
                          <div className="flex gap-1 pt-1" onContextMenu={(e) => e.stopPropagation()}>
                            <button onClick={() => onAddRequest(focusedFolder)}
                              title={focusedFolder ? `Будет добавлен в «${nodeById(tree, focusedFolder)?.name}»` : "Будет добавлен в корень набора"}
                              className="flex items-center gap-1 rounded-md border border-line bg-raised/60 px-2 py-1 text-[10.5px] font-extrabold text-mist transition-all duration-150 hover:border-teal/50 hover:text-teal active:scale-95">
                              <Zap size={10} /> Запрос
                              {focusedFolder && <span className="font-mono text-[9px] font-semibold text-teal">→ {nodeById(tree, focusedFolder)?.name}</span>}
                            </button>
                            <button onClick={() => openCreateFolder(focusedFolder)}
                              className="flex items-center gap-1 rounded-md border border-line bg-raised/60 px-2 py-1 text-[10.5px] font-extrabold text-mist transition-all duration-150 hover:border-amber/50 hover:text-amber active:scale-95">
                              <FolderPlus size={10} /> Папка
                            </button>
                          </div>
                        </div>
                      )}
                    </CollectionItem>
                  ))}
                </div>
              </SortableContext>

              {showDeleted && deleted.length > 0 && (
                <div className="fade-up mt-2.5">
                  <div className="mb-1.5 flex items-center gap-1.5 text-[9.5px] font-extrabold uppercase tracking-[0.13em] text-coral/80"><Trash2 size={10} /> Корзина · {deleted.length}</div>
                  <div className="space-y-1.5">
                    {deleted.map((c) => (
                      <DeletedRow key={c.id} c={c} onRestore={() => onRestoreCollection(c.id)}
                        onPurge={() => setPurge({ kind: "collection", id: c.id, name: c.name })}
                        onCtx={(e, id) => openMenu(e, { kind: "collection", id })} />
                    ))}
                  </div>
                </div>
              )}
            </TreeContext.Provider>

            <StandsPanel cols={visible} statuses={urlStatuses} auths={authChecks} updatedAt={standsUpdatedAt}
              onCheckUrl={onCheckUrl} onRefresh={onRefreshStands} onOpenCard={(id) => setCardState({ mode: "edit", id })} />

            <DragOverlay dropAnimation={null}>
              {dragInfo && (
                <div className="flex w-[250px] items-center gap-2 rounded-lg border border-line2 bg-raised px-3 py-2 shadow-[0_18px_50px_rgba(0,0,0,0.55)]">
                  {dragInfo.kind === "collection" ? <Layers size={14} className="shrink-0 text-amber" />
                    : dragInfo.node?.kind === "folder" ? <Folder size={14} className="shrink-0 text-amber" />
                    : dragInfo.node?.kind === "request" ? <MethodBadge method={dragInfo.node.method} /> : null}
                  <span className="truncate text-[12px] font-extrabold text-fog">{dragInfo.label}</span>
                </div>
              )}
            </DragOverlay>

            <div className="mt-2.5 rounded-md bg-raised/50 px-2.5 py-2 text-[10px] font-semibold leading-relaxed text-dim">
              Клик по папке — фокус и фильтр тестов; разворачивание — шевроном. ПКМ — меню. Перетаскивание меняет порядок и вкладывает запросы в папки.
            </div>
          </div>
        </div>
      </DndContext>

      <div onPointerDown={startResize} title="Потяните, чтобы изменить ширину"
        className="group absolute inset-y-0 -right-[3px] z-10 w-[6px] cursor-ew-resize">
        <div className="mx-auto h-full w-[2px] bg-transparent transition-colors duration-150 group-hover:bg-teal/60" />
      </div>

      {menu && <ContextMenu x={menu.x} y={menu.y} items={buildItems()} onAction={act} onClose={() => setMenu(null)} />}

      {purge && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-deep/70 p-4 backdrop-blur-[3px]" onMouseDown={(e) => { if (e.target === e.currentTarget) setPurge(null); }}>
          <div className="toast-in w-full max-w-[400px] rounded-2xl border border-coral/40 bg-panel p-5 shadow-[0_30px_90px_rgba(0,0,0,0.6)]">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-coral/15 text-coral"><Trash2 size={16} /></span>
              <div>
                <div className="font-display text-[14px] font-bold text-fog">Удалить безвозвратно?</div>
                <p className="mt-1 text-[12px] font-semibold leading-relaxed text-mist">
                  «{purge.name}» будет стёрт{purge.kind === "collection" ? "а вместе со всеми сценариями" : " вместе с вложениями"}. Действие нельзя отменить.
                </p>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setPurge(null)} className="rounded-lg border border-line bg-raised px-4 py-2 text-[12.5px] font-extrabold text-mist transition-all hover:border-line2 hover:text-fog active:scale-95">Нет</button>
              <button onClick={() => { const p = purge; setPurge(null); if (p.kind === "collection") onPurgeCollection(p.id); else onPurgeNode(p.id); }}
                className="rounded-lg bg-coral px-4 py-2 text-[12.5px] font-extrabold text-[#2b0f0b] transition-all hover:brightness-110 active:scale-95">Да, удалить</button>
            </div>
          </div>
        </div>
      )}

      <NodeModal state={modal} onClose={() => setModal(null)} onSubmit={submitModal} />

      {cardState && (
        <CollectionModal state={cardState} col={cardCol} cookieStore={cookieStore}
          authState={cardState.mode === "edit" ? authChecks[cardState.id] : undefined}
          onCheckAuth={(draft) => cardState.mode === "edit" && onCheckAuth(cardState.id, draft)}
          onClose={() => setCardState(null)}
          onSave={(id, d) => { if (id) onSaveCard(id, d); else onCreateCollection(d); setCardState(null); }} />
      )}
    </aside>
  );
}
