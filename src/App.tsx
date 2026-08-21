import { useEffect, useMemo, useRef, useState } from "react";
import { HashRouter, Link, Route, Routes } from "react-router-dom";
import { AlertTriangle, ArrowLeft, CheckCircle2, Info, Layers, Loader2, Pencil, Sparkles, Tags, Trash2, X, XCircle } from "lucide-react";
import { BarChart3, Camera, ListChecks } from "lucide-react";
import Toolbar from "./components/Toolbar";
import CollectionPanel from "./components/CollectionPanel";
import TestTable from "./components/TestTable";
import Inspector, { type ManualResult } from "./components/Inspector";
import TestBuilder from "./components/TestBuilder";
import DataDrawer from "./components/DataDrawer";
import NewTestModal, { type NewTestData } from "./components/NewTestModal";
import ContextMenu, { type MenuItem } from "./components/ContextMenu";
import ShotTestsView from "./components/ShotTestsView";
import StatsView from "./components/StatsView";
import { autoTagColor } from "./components/TagPicker";
import type { Account, AuthCheckState, AutoTest, Collection, CollectionDraft, CookieJarItem, CookieStore, FolderNode, LastBuild, TestStep, ToastKind, TreeNode } from "./types";
import { ROOT_SUITE, uid, fmtTime } from "./types";
import { PEOPLE, loadStateFor, saveStateFor, makeRequest } from "./data";
import { backend, type PublicUser } from "./backend";
import type { DbSession } from "./backend/db";
import { onDbChange } from "./backend/db";
import AuthGate from "./components/AuthGate";
import { childrenOf, ensureTrash, insertNode, nodeById, removeNode, restoreFromTrash, updateNodeInTree } from "./tree";
import { buildTestUrl, probeUrl, hostOfUrl } from "./urlcheck";
import { compareImages, getBaseline, saveBaseline, saveRunShots } from "./screenshots";
import { capturePage, endCaptureSession, startCaptureSession, type CaptureSession } from "./livec";

interface Toast { id: string; kind: ToastKind; title: string; sub?: string }
type FilterCmd = { kind: "failing"; folderId?: string; at: number } | null;

/** Дружелюбная заглушка, когда нет ни одной коллекции */
function EmptyWorkspace() {
  return (
    <div className="grid h-full place-items-center p-8">
      <div className="fade-up w-full max-w-[400px] rounded-2xl border border-line bg-panel/80 p-8 text-center shadow-[0_30px_80px_rgba(0,0,0,0.4)]">
        <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-amber/20 to-teal/15 shadow-[inset_0_0_0_1px_rgba(255,180,84,0.25)]">
          <Layers size={28} className="text-amber" />
        </div>
        <div className="font-display text-[17px] font-bold leading-snug text-fog">
          Пока нет ни одного набора
        </div>
        <p className="mx-auto mt-2.5 max-w-[300px] text-[12.5px] font-semibold leading-relaxed text-mist">
          Создайте первую коллекцию — добавьте адрес стенда и сценарии, и «КАДР» начнёт снимать и сверять кадры за вас.
        </p>
        <div className="mt-5 inline-flex items-center gap-2 rounded-lg border border-line bg-raised/60 px-3.5 py-2 text-[11.5px] font-bold text-dim">
          <Sparkles size={13} className="text-teal" />
          Нажмите «+» в панели «Наборы сценариев» слева
        </div>
      </div>
    </div>
  );
}

function TestsWorkspace({ accountId, user, onLogout }: { accountId: string; user: PublicUser; onLogout: () => void }) {
  const initial = useMemo(() => loadStateFor(accountId), [accountId]);
  const [collections, setCollections] = useState<Collection[]>(initial.collections);
  const [activeId, setActiveId] = useState(initial.activeId);
  const [buildNo, setBuildNo] = useState(initial.buildNo);
  const [cookieStore, setCookieStore] = useState<CookieStore>(initial.cookieStore);
  // реальный пользователь из сервисного слоя (БД) вместо демо-аккаунта
  const account = useMemo<Account>(
    () => ({ id: user.accountId, name: user.name, email: user.email, plan: "team", createdAt: Date.now() }),
    [user],
  );
  const [tagColors, setTagColors] = useState<Record<string, string>>(initial.tagColors);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [builderTestId, setBuilderTestId] = useState<string | null>(null);
  const [testDirty, setTestDirty] = useState(false);
  const [confirmCloseTest, setConfirmCloseTest] = useState(false);
  const pendingSel = useRef<string | null>(null);
  const inspectorRef = useRef<HTMLDivElement | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [prefillSuite, setPrefillSuite] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [folderScope, setFolderScope] = useState<string | null>(null);
  const [filterCmd, setFilterCmd] = useState<FilterCmd>(null);
  const [testMenu, setTestMenu] = useState<{ x: number; y: number; testId: string } | null>(null);

  const [buildActive, setBuildActive] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [lastBuild, setLastBuild] = useState<LastBuild | null>(null);
  const [gateError, setGateError] = useState<{ kind: "stand" | "auth"; name: string; url: string; detail?: string } | null>(null);
  const [dataOpen, setDataOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [mainTab, setMainTab] = useState<"tests" | "shots">("tests");

  const [urlStatuses, setUrlStatuses] = useState<Record<string, UrlStateWrap>>({});
  const [standsUpdatedAt, setStandsUpdatedAt] = useState<number | null>(null);
  const [authChecks, setAuthChecks] = useState<Record<string, AuthCheckState>>({});

  type UrlStateWrap = import("./urlcheck").UrlState;

  const buildActiveRef = useRef(false);
  const stopRef = useRef(false);
  const gateRef = useRef(false);
  const scopeRef = useRef<{ colId: string; ids: string[]; no: number } | null>(null);
  const colRef = useRef(collections);
  const liveSessionRef = useRef<CaptureSession | null>(null);

  useEffect(() => { colRef.current = collections; }, [collections]);

  const col = useMemo(
    () => collections.find((c) => c.id === activeId && !c.deleted) ?? collections.find((c) => !c.deleted) ?? collections[0],
    [collections, activeId],
  );
  const selected = col ? col.tests.find((t) => t.id === selectedId) ?? null : null;
  const builderTest = col ? col.tests.find((t) => t.id === builderTestId) ?? null : null;

  /* ---------- автосейв (per-account: локально + в облако при Supabase) ---------- */
  useEffect(() => {
    const t = window.setTimeout(() => {
      saveStateFor(accountId, { collections, activeId, buildNo, cookieStore, account, tagColors });
      setSavedAt(Date.now());
    }, 700);
    return () => window.clearTimeout(t);
  }, [accountId, collections, activeId, buildNo, cookieStore, account, tagColors]);

  /* ---------- realtime: изменения из других вкладок ---------- */
  useEffect(() => onDbChange(() => setSavedAt(Date.now())), []);

  /* ---------- выбор теста с защитой изменений ---------- */
  const selectTest = (id: string | null) => {
    if (id === selectedId) return;
    if (testDirty && selectedId !== null) { pendingSel.current = id; setConfirmCloseTest(true); return; }
    setTestDirty(false);
    setSelectedId(id);
  };
  const forceSelect = (id: string | null) => { setTestDirty(false); setConfirmCloseTest(false); setSelectedId(id); };

  /* клик вне карточки закрывает её */
  useEffect(() => {
    if (!selected) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (inspectorRef.current && inspectorRef.current.contains(target)) return;
      if (target.closest("[data-row], button, a, input, textarea, select, [role=menu]")) return;
      if (target.closest(".fixed")) return;
      selectTest(null);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, testDirty, selectedId]);

  /* ---------- тосты ---------- */
  const toast = (kind: ToastKind, title: string, sub?: string) => {
    const id = uid();
    setToasts((p) => [...p.slice(-3), { id, kind, title, sub }]);
    window.setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3600);
  };

  /* ---------- тесты ---------- */
  const patchTest = (id: string, patch: Partial<AutoTest>) =>
    setCollections((prev) => prev.map((c) => (c.id !== activeId ? c : { ...c, tests: c.tests.map((t) => (t.id === id ? { ...t, ...patch } : t)) })));

  const findFolderId = (nodes: TreeNode[], name: string): string | null => {
    for (const n of nodes) {
      if (n.kind === "folder") {
        if (n.name === name) return n.id;
        const deep = findFolderId(n.children, name);
        if (deep) return deep;
      }
    }
    return null;
  };

  const saveTest = (id: string, patch: Partial<AutoTest>) => {
    setCollections((prev) =>
      prev.map((c) => {
        if (c.id !== activeId) return c;
        const t = c.tests.find((x) => x.id === id);
        let tree = c.tree;
        if (t?.requestId && patch.name && patch.name !== t.name) tree = updateNodeInTree(tree, t.requestId, { name: patch.name });
        if (t?.requestId && patch.suite !== undefined && patch.suite !== t.suite) {
          const { next, removed } = removeNode(tree, t.requestId);
          if (removed) {
            let parentId: string | null = null;
            if (patch.suite !== ROOT_SUITE) {
              parentId = findFolderId(next, patch.suite);
              if (!parentId) {
                const folder: FolderNode = { id: uid(), kind: "folder", name: patch.suite, children: [] };
                tree = insertNode(next, null, Number.MAX_SAFE_INTEGER, folder);
                parentId = folder.id;
              } else tree = next;
            } else tree = next;
            tree = insertNode(tree, parentId, Number.MAX_SAFE_INTEGER, removed);
          }
        }
        return { ...c, tree, tests: c.tests.map((x) => (x.id === id ? { ...x, ...patch } : x)) };
      }),
    );
  };

  const saveTestSteps = (id: string, steps: TestStep[]) => {
    patchTest(id, { steps });
    const active = steps.filter((s) => s.enabled).length;
    toast("success", "Шаги сохранены", `${steps.length} шагов (активно: ${active}) — выполнятся при запуске АТ`);
  };

  const applyManualResult = (id: string, r: ManualResult) => {
    const runId = uid();
    if (r.shots) void saveRunShots(id, runId, r.shots);
    setCollections((prev) =>
      prev.map((c) =>
        c.id !== activeId ? c : {
          ...c,
          tests: c.tests.map((t) =>
            t.id !== id ? t : {
              ...t, status: r.status, diffPct: r.diffPct, durMs: r.durMs, lastRun: Date.now(),
              history: [...t.history, { id: runId, status: r.status, at: Date.now(), dur: r.durMs, diffPct: r.diffPct, byName: account.name, failText: r.failText }].slice(-6),
            },
          ),
        },
      ),
    );
    toast(r.status === "passed" ? "success" : "warning", r.status === "passed" ? "Ручной тест пройден" : "Ручной тест упал", `расхождение ${r.diffPct.toFixed(2).replace(".", ",")}%`);
  };

  const createTest = (d: NewTestData) => {
    const t: AutoTest = {
      id: uid(), name: d.name, suite: d.suite, path: d.path, viewports: d.viewports,
      assignee: d.assignee, tags: d.tags, status: "idle", enabled: true, history: [],
    };
    const node = makeRequest(d.name, "GET", d.path);
    setCollections((prev) =>
      prev.map((c) => {
        if (c.id !== activeId) return c;
        let tree = c.tree;
        let parentId: string | null = null;
        if (d.suite !== ROOT_SUITE) {
          parentId = findFolderId(tree, d.suite);
          if (!parentId) {
            const folder: FolderNode = { id: uid(), kind: "folder", name: d.suite, children: [] };
            tree = insertNode(tree, null, Number.MAX_SAFE_INTEGER, folder);
            parentId = folder.id;
          }
        }
        tree = insertNode(tree, parentId, Number.MAX_SAFE_INTEGER, node);
        return { ...c, tree, tests: [...c.tests, { ...t, requestId: node.id }] };
      }),
    );
    setModalOpen(false);
    setPrefillSuite(null);
    forceSelect(t.id);
    setFlashId(t.id);
    window.setTimeout(() => setFlashId(null), 1500);
    toast("success", "Тест добавлен", `«${d.name}» — появился в списке и в наборе сценариев`);
  };

  const deleteTests = (ids: string[]) => {
    setCollections((prev) =>
      prev.map((c) => {
        if (c.id !== activeId) return c;
        const links = c.tests.filter((t) => ids.includes(t.id)).map((t) => ({ requestId: t.requestId, name: t.name, path: t.path }));
        return { ...c, tests: c.tests.filter((t) => !ids.includes(t.id)), tree: removeLinkedNodesLocal(c.tree, links) };
      }),
    );
    if (selectedId && ids.includes(selectedId)) forceSelect(null);
    toast("success", `Удалено тестов: ${ids.length}`);
  };

  const removeLinkedNodesLocal = (nodes: TreeNode[], links: Array<{ requestId?: string; name: string; path: string }>): TreeNode[] =>
    nodes.reduce<TreeNode[]>((acc, n) => {
      if (n.kind === "request") {
        const hit = links.some((l) => (l.requestId ? n.id === l.requestId : n.name === l.name && n.path === l.path));
        if (!hit) acc.push(n);
        return acc;
      }
      acc.push({ ...n, children: removeLinkedNodesLocal(n.children, links) });
      return acc;
    }, []);

  const setEnabled = (ids: string[], v: boolean) =>
    setCollections((prev) => prev.map((c) => (c.id !== activeId ? c : { ...c, tests: c.tests.map((t) => (ids.includes(t.id) ? { ...t, enabled: v } : t)) })));
  const toggleEnabled = (id: string) => {
    const t = col.tests.find((x) => x.id === id);
    if (t) patchTest(id, { enabled: !t.enabled });
  };

  /* ---------- дерево ---------- */
  const mutateTree = (fn: (t: TreeNode[]) => TreeNode[]) =>
    setCollections((prev) => prev.map((c) => (c.id !== activeId ? c : { ...c, tree: fn(c.tree) })));

  const createCollection = (d: CollectionDraft) => {
    const c: Collection = {
      id: uid(), name: d.name, color: d.color || "#ffb454", baseUrl: d.screenUrl, screenUrl: d.screenUrl,
      browser: d.browser, viewports: ["1440", "768", "390"], threshold: d.threshold, delayMs: d.delayMs,
      baseline: "main", notify: d.notify, auth: d.auth, authLogin: d.authLogin, authPassword: d.authPassword,
      authKey: d.authKey, cookieUser: d.cookieUser, tests: [], tree: ensureTrash([]),
    };
    setCollections((prev) => [...prev, c]);
    setActiveId(c.id);
    forceSelect(null);
    toast("success", "Коллекция создана", `«${d.name}» — наполните её запросами и папками`);
  };

  const createNode = (parentId: string | null, d: { kind: "request" | "folder"; name: string; path?: string }) => {
    if (d.kind === "folder") {
      mutateTree((t) => insertNode(t, parentId, Number.MAX_SAFE_INTEGER, { id: uid(), kind: "folder", name: d.name, children: [] }));
      toast("success", "Папка добавлена", `«${d.name}»`);
    } else {
      // запрос → открываем модалку теста с предзаполненной папкой
      const parent = parentId ? nodeById(col.tree, parentId) : undefined;
      setPrefillSuite(parent && parent.kind === "folder" ? parent.name : ROOT_SUITE);
      setModalOpen(true);
    }
  };

  const updateTreeNode = (nodeId: string, patch: { name: string; path?: string }) => {
    const node = nodeById(col.tree, nodeId);
    mutateTree((t) => updateNodeInTree(t, nodeId, { name: patch.name, path: patch.path }));
    if (node?.kind === "request") {
      setCollections((prev) =>
        prev.map((c) =>
          c.id !== activeId ? c : { ...c, tests: c.tests.map((t) => (t.requestId === nodeId ? { ...t, name: patch.name, path: patch.path ?? t.path } : t)) },
        ),
      );
    }
    toast("success", "Сохранено", `«${patch.name}»`);
  };

  const deleteTreeNode = (nodeId: string) => {
    const node = nodeById(col.tree, nodeId);
    if (!node) return;
    mutateTree((t) => {
      const { next, removed } = removeNode(t, nodeId);
      if (!removed) return t;
      const trash = next.find((n) => n.kind === "folder" && n.isTrash) as FolderNode | undefined;
      if (!trash) return t;
      return next.map((n) => (n.kind === "folder" && n.isTrash ? { ...n, children: [removed, ...n.children] } : n));
    });
    toast("info", "В корзину", `«${node.name}» — восстановить можно из «Корзины»`);
  };

  const restoreNode = (nodeId: string) => {
    mutateTree((t) => restoreFromTrash(t, nodeId));
    toast("success", "Восстановлено", "Узел возвращён в корень набора");
  };

  const purgeNode = (nodeId: string) => {
    const node = nodeById(col.tree, nodeId);
    mutateTree((t) => removeNode(t, nodeId).next);
    if (node?.kind === "request") {
      setCollections((prev) => prev.map((c) => (c.id !== activeId ? c : { ...c, tests: c.tests.filter((t) => t.requestId !== nodeId) })));
    }
    toast("warning", "Удалено безвозвратно", `«${node?.name}»`);
  };

  const moveNode = (fromId: string, toParent: string | null, toIndex: number) =>
    mutateTree((t) => {
      const { next, removed } = removeNode(t, fromId);
      if (!removed) return t;
      const nextTree = insertNode(next, toParent, toIndex, removed);
      if (removed.kind === "request") {
        const parent = toParent ? nodeById(nextTree, toParent) : undefined;
        const suite = parent && parent.kind === "folder" ? parent.name : ROOT_SUITE;
        setCollections((prev) => prev.map((c) => (c.id !== activeId ? c : { ...c, tests: c.tests.map((x) => (x.requestId === removed.id ? { ...x, suite } : x)) })));
      }
      return nextTree;
    });

  const moveCollection = (fromId: string, toIndex: number) =>
    setCollections((prev) => {
      const i = prev.findIndex((c) => c.id === fromId);
      if (i < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(i, 1);
      next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, moved);
      return next;
    });

  const deleteCollection = (id: string) => {
    const visible = collections.filter((c) => !c.deleted);
    if (visible.length <= 1) { toast("warning", "Нельзя удалить", "Должна остаться хотя бы одна коллекция"); return; }
    const target = collections.find((c) => c.id === id);
    setCollections((prev) => prev.map((c) => (c.id === id ? { ...c, deleted: true } : c)));
    if (activeId === id) {
      const next = visible.filter((c) => c.id !== id);
      setActiveId(next[0].id);
      forceSelect(null);
    }
    toast("info", "Коллекция в корзине", `«${target?.name}» — восстановить из корзины`);
  };
  const restoreCollection = (id: string) => {
    const target = collections.find((c) => c.id === id);
    setCollections((prev) => prev.map((c) => (c.id === id ? { ...c, deleted: false } : c)));
    setActiveId(id);
    forceSelect(null);
    toast("success", "Коллекция восстановлена", `«${target?.name}»`);
  };
  const purgeCollection = (id: string) => {
    const target = collections.find((c) => c.id === id);
    setCollections((prev) => prev.filter((c) => c.id !== id));
    toast("warning", "Удалено безвозвратно", `Коллекция «${target?.name}»`);
  };
  const purgeAllCollections = () => {
    const n = collections.length;
    setCollections([]);
    forceSelect(null);
    toast("warning", "Все коллекции удалены", `Безвозвратно удалено: ${n}`);
  };

  /* ---------- проверка доступности ---------- */
  const checkOne = async (colId: string, url: string) => {
    setUrlStatuses((p) => ({ ...p, [colId]: { state: "checking" } }));
    const probe = await probeUrl(url);
    setUrlStatuses((p) => ({ ...p, [colId]: { ...probe, at: Date.now() } }));
    setStandsUpdatedAt(Date.now());
    return probe;
  };
  const refreshStands = () => {
    collections.filter((c) => !c.deleted).forEach((c) => void checkOne(c.id, c.screenUrl));
  };
  useEffect(() => { refreshStands(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runAuthCheck = async (colId: string, c: Collection): Promise<AuthCheckState> => {
    setAuthChecks((p) => ({ ...p, [colId]: { state: "checking" } }));
    await new Promise<void>((r) => window.setTimeout(r, 600));
    let res: AuthCheckState;
    if (c.auth === "none") res = { state: "ok", text: "авторизация не требуется", at: Date.now() };
    else if (c.auth === "cookie") {
      const host = hostOfUrl(c.screenUrl);
      const jar = cookieStore[host] ?? [];
      const cookies: CookieJarItem[] = jar.length ? jar : [
        { name: "session_id", value: `sess_${uid()}` },
        { name: "XSRF-TOKEN", value: `xs_${uid()}` },
      ];
      setCookieStore((p) => ({ ...p, [host]: cookies }));
      res = { state: "ok", text: `готовая сессия · cookie: ${cookies.length}`, at: Date.now(), cookies: cookies.map((k) => k.name) };
    } else if (c.auth === "login") {
      res = c.authLogin && c.authPassword
        ? { state: "ok", text: `вход выполнен · ${c.authLogin}`, at: Date.now() }
        : { state: "err", text: "не заполнены логин или пароль", at: Date.now() };
    } else {
      res = c.authKey ? { state: "ok", text: "ключ принят", at: Date.now() } : { state: "err", text: "не указан ключ доступа", at: Date.now() };
    }
    setAuthChecks((p) => ({ ...p, [colId]: res }));
    return res;
  };

  /* ---------- сборка ---------- */
  const launchBuild = (c: Collection, scopeIds: string[], no: number) => {
    scopeRef.current = { colId: c.id, ids: scopeIds, no };
    buildActiveRef.current = true;
    setBuildActive(true);
    setProgress({ done: 0, total: scopeIds.length });
    setCollections((prev) =>
      prev.map((cc) =>
        cc.id !== c.id ? cc : {
          ...cc,
          tests: cc.tests.map((t) => (scopeIds.includes(t.id) ? { ...t, status: "queued", startedAt: undefined } : t)),
        },
      ),
    );
  };

  const startBuild = async (colId: string, ids?: string[]) => {
    if (buildActiveRef.current || gateRef.current) return;
    const c = colRef.current.find((x) => x.id === colId && !x.deleted);
    if (!c) return;
    const scope = ids
      ? c.tests.filter((t) => ids.includes(t.id))
      : c.tests.filter((t) => t.enabled && t.status !== "skipped");
    if (scope.length === 0) { toast("warning", "Нечего запускать", "В наборе нет включённых в сборку тестов"); return; }

    gateRef.current = true;
    const probe = await checkOne(c.id, c.screenUrl);
    if (probe.state === "down") { setGateError({ kind: "stand", name: c.name, url: c.screenUrl }); gateRef.current = false; return; }
    const auth = await runAuthCheck(c.id, c);
    if (auth.state === "err") { setGateError({ kind: "auth", name: c.name, url: c.screenUrl, detail: auth.text }); gateRef.current = false; return; }
    gateRef.current = false;

    // живой захват для ручных АТ (в жесте клика)
    const manualIds = scope.filter((t) => t.testType === "manual").map((t) => t.id);
    if (manualIds.length > 0 && !liveSessionRef.current) {
      try {
        liveSessionRef.current = await startCaptureSession();
        toast("info", "Живой захват подключён", `Выберите служебную вкладку — страницы АТ (${manualIds.length} шт.) будут подставляться автоматически`);
      } catch {
        toast("warning", "Живой захват недоступен", "Ручные АТ без захвата будут помечены как упавшие");
      }
    }

    const no = buildNo + 1;
    setBuildNo(no);
    stopRef.current = false;
    launchBuild(c, scope.map((t) => t.id), no);

    const patch = (cid: string, id: string, p: Partial<AutoTest>) =>
      setCollections((prev) => prev.map((cc) => (cc.id !== cid ? cc : { ...cc, tests: cc.tests.map((t) => (t.id === id ? { ...t, ...p } : t)) })));

    const worker = async () => {
      while (!stopRef.current) {
        const cur = colRef.current.find((cc) => cc.id === scopeRef.current?.colId);
        const sc = scopeRef.current;
        if (!cur || !sc) return;
        const job = cur.tests.find((t) => sc.ids.includes(t.id) && t.status === "queued");
        if (!job) return;
        patch(cur.id, job.id, { status: "running", startedAt: Date.now() });

        let status: "passed" | "diff" | "failed" = "passed";
        let diffPct: number | undefined;
        let failText: string | undefined;

        if (job.testType === "manual") {
          const startedAt = Date.now();
          const session = liveSessionRef.current;
          let baseline = await getBaseline(job.id);
          const threshold = cur.threshold ?? 0.3;
          const runId = uid();
          let shots: { base: string; result: string; diff: string | null } | null = null;
          if (session) {
            try {
              const pageUrl = job.pageUrl?.trim() || buildTestUrl(cur.screenUrl, job.path);
              const frame = await capturePage(session, pageUrl, (cur.delayMs ?? 800) + 700);
              if (!baseline) {
                await saveBaseline(job.id, frame);
                baseline = frame;
                patch(cur.id, job.id, { baselineAt: Date.now() });
                toast("info", "Эталон создан", `«${job.name}»: первый запуск — снимок сохранён как эталон`);
              }
              const cmp = await compareImages(baseline, frame);
              diffPct = cmp.diffPct;
              shots = { base: baseline, result: frame, diff: cmp.diffDataUrl };
              status = cmp.diffPct <= threshold ? "passed" : "failed";
              if (status === "failed") failText = `Расхождение ${cmp.diffPct.toFixed(2).replace(".", ",")}% превышает порог ${threshold.toFixed(1).replace(".", ",")}% — страница отличается от эталона.`;
              void saveRunShots(job.id, runId, shots);
            } catch (e) {
              status = "failed";
              failText = e instanceof Error ? e.message : "Не удалось снять кадр живой страницы.";
            }
          } else {
            status = "failed";
            failText = "Живой захват не был подключён — кадр страницы не снят.";
          }
          const dur = Math.max(1, Date.now() - startedAt);
          patch(cur.id, job.id, {
            status, diffPct, durMs: dur, lastRun: Date.now(),
            history: [...job.history, { id: runId, status, at: Date.now(), dur, diffPct, byName: account.name, failText }].slice(-6),
          });
        } else {
          await new Promise<void>((r) => window.setTimeout(r, 650 + Math.random() * 1500));
          if (stopRef.current) return;
          const dur = Math.round(600 + Math.random() * 2600);
          const roll = Math.random();
          status = roll < 0.62 ? "passed" : roll < 0.82 ? "diff" : "failed";
          diffPct = status === "diff" ? +(0.3 + Math.random() * 2.4).toFixed(1) : undefined;
          if (status === "failed") failText = "Таймаут ожидания контрола: элемент не появился в течение 10 с.";
          const runId = uid();
          patch(cur.id, job.id, {
            status, diffPct, durMs: dur, lastRun: Date.now(),
            history: [...job.history, { id: runId, status, at: Date.now(), dur, diffPct, byName: account.name, failText }].slice(-6),
          });
        }

        setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
      }
    };

    void (async () => {
      await Promise.all([worker(), worker()]);
      setBuildActive(false);
      buildActiveRef.current = false;
      endCaptureSession(liveSessionRef.current);
      liveSessionRef.current = null;
      const sc = scopeRef.current;
      const cur = colRef.current.find((cc) => cc.id === sc?.colId);
      if (!sc || !cur) return;
      const ran = cur.tests.filter((t) => sc.ids.includes(t.id));
      const passed = ran.filter((t) => t.status === "passed").length;
      const diff = ran.filter((t) => t.status === "diff").length;
      const failed = ran.filter((t) => t.status === "failed").length;
      setLastBuild({ no: sc.no, colName: cur.name, at: Date.now(), durMs: ran.reduce((a, t) => a + (t.durMs ?? 0), 0), total: ran.length, passed, diff, failed });
      toast(failed > 0 ? "warning" : "success", `Сборка #${sc.no} завершена`, `${passed} успешно · ${diff} расхожд. · ${failed} упало`);
      void checkOne(cur.id, cur.screenUrl);
    })();
  };

  const stopBuild = () => {
    stopRef.current = true;
    setBuildActive(false);
    buildActiveRef.current = false;
    endCaptureSession(liveSessionRef.current);
    liveSessionRef.current = null;
    toast("info", "Сборка остановлена");
  };

  /* ---------- фильтры по счётчикам ---------- */
  const scopedTestIds = useMemo(() => {
    if (!filterCmd) return null;
    const failing = (t: AutoTest) => t.status === "failed" || t.status === "diff";
    if (filterCmd.folderId) {
      const idsInFolder = new Set<string>();
      const walk = (ns: TreeNode[]) =>
        ns.forEach((n) => {
          if (n.kind === "request") idsInFolder.add(n.id);
          else if (n.kind === "folder") walk(n.children);
        });
      const folder = nodeById(col.tree, filterCmd.folderId);
      if (folder && folder.kind === "folder") walk(folder.children);
      return new Set(col.tests.filter((t) => failing(t) && t.requestId && idsInFolder.has(t.requestId)).map((t) => t.id));
    }
    return new Set(col.tests.filter(failing).map((t) => t.id));
  }, [filterCmd, col]);

  const scopeName = useMemo(() => {
    if (!filterCmd) return null;
    if (filterCmd.folderId) {
      const f = nodeById(col.tree, filterCmd.folderId);
      return f ? `${f.name} · упавшие` : "упавшие";
    }
    return "упавшие АТ";
  }, [filterCmd, col]);

  const onFilterFailing = (id: string) => {
    const isCollection = collections.some((c) => c.id === id);
    setFilterCmd({ kind: "failing", folderId: isCollection ? undefined : id, at: Date.now() });
  };

  /* ---------- хоткеи ---------- */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        void startBuild(activeId);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  /* ---------- контекстное меню строки теста ---------- */
  const testMenuItems = (): MenuItem[] => {
    if (!testMenu) return [];
    const t = col.tests.find((x) => x.id === testMenu.testId);
    if (!t) return [];
    const suggestions = [...new Set(col.tests.flatMap((x) => x.tags))].filter((s) => !t.tags.includes(s)).slice(0, 5);
    return [
      { id: "edit", label: "Изменить", icon: <Pencil size={14} /> },
      { id: "delete", label: "Удалить", icon: <Trash2 size={14} />, danger: true, sep: true },
      ...(suggestions.length ? [{ id: "tag-head", label: "Пометить тегом:", disabled: true, sep: true } as MenuItem] : []),
      ...suggestions.map((s) => ({ id: `tag:${s}`, label: s, dot: tagColors[s] ?? autoTagColor(s) })),
    ];
  };
  const actTestMenu = (action: string) => {
    const id = testMenu?.testId;
    setTestMenu(null);
    if (!id) return;
    if (action === "edit") selectTest(id);
    else if (action === "delete") deleteTests([id]);
    else if (action.startsWith("tag:")) {
      const tag = action.slice(4);
      const t = col.tests.find((x) => x.id === id);
      if (t) patchTest(id, { tags: [...t.tags, tag] });
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Toolbar
        buildNo={buildNo} buildActive={buildActive} progress={progress} savedAt={savedAt}
        canRun={!buildActive} onRun={() => void startBuild(activeId)} onStop={stopBuild}
        onOpenData={() => setDataOpen(true)} account={account}
        onLogout={onLogout} onWorkspace={() => setWorkspaceOpen(true)} />

      <div className="flex min-h-0 flex-1">
        <CollectionPanel
          collections={collections} activeId={activeId}
          onSelect={(id) => { setActiveId(id); forceSelect(null); }}
          folderScope={folderScope} onSelectFolder={setFolderScope}
          onOpenTest={(nodeId) => {
            const t = col.tests.find((x) => x.requestId === nodeId);
            if (t) selectTest(t.id);
          }}
          onFilterFailing={onFilterFailing}
          onCreateCollection={createCollection} onCreateNode={createNode}
          onAddRequest={(parentId) => {
            const parent = parentId ? nodeById(col.tree, parentId) : undefined;
            setPrefillSuite(parent && parent.kind === "folder" ? parent.name : ROOT_SUITE);
            setModalOpen(true);
          }}
          onUpdateNode={updateTreeNode} onDeleteNode={deleteTreeNode}
          onMoveNode={moveNode} onMoveCollection={moveCollection}
          onDeleteCollection={deleteCollection} onRestoreNode={restoreNode} onPurgeNode={purgeNode}
          onRestoreCollection={restoreCollection} onPurgeCollection={purgeCollection} onPurgeAll={purgeAllCollections}
          onSaveCard={(id, patch) => {
            setCollections((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
            toast("success", "Карточка сохранена");
          }}
          buildActive={buildActive} onRunAll={(id) => void startBuild(id)}
          urlStatuses={urlStatuses} onCheckUrl={(id) => { const c = collections.find((x) => x.id === id); if (c) void checkOne(id, c.screenUrl); }}
          onRefreshStands={refreshStands} standsUpdatedAt={standsUpdatedAt}
          authChecks={authChecks} onCheckAuth={(id, draft) => { const c = collections.find((x) => x.id === id); if (c) void runAuthCheck(id, { ...c, ...draft }); }}
          cookieStore={cookieStore} />

        <main className="relative flex min-w-0 flex-1 flex-col">
          {/* вкладки рабочей области */}
          <div className="flex shrink-0 items-end gap-1 border-b border-line bg-panel/70 px-4 backdrop-blur-sm">
            {([
              { id: "tests" as const, label: "Тесты", Icon: ListChecks, needCol: true },
              { id: "shots" as const, label: "Скриншот тесты", Icon: Camera, needCol: false },
            ]).filter((t) => !t.needCol || !!col).map((t) => {
              const active = mainTab === t.id;
              return (
                <button key={t.id} onClick={() => setMainTab(t.id)}
                  className={`relative -mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[12px] font-extrabold transition-all duration-150 ${
                    active ? "border-amber text-fog" : "border-transparent text-dim hover:text-mist"}`}>
                  <t.Icon size={14} className={active ? "text-amber" : ""} />
                  {t.label}
                  {active && <span className="absolute inset-x-3 -bottom-[2px] h-[2px] rounded-full bg-amber shadow-[0_0_8px_rgba(255,180,84,0.6)]" />}
                </button>
              );
            })}
          </div>

          <div className="stage-bg min-h-0 flex-1">
            {mainTab === "tests" && (col ? (
              <TestTable
                col={col} people={PEOPLE} selectedId={selectedId} flashId={flashId}
                onSelect={selectTest}
                onCtxMenu={(e, t) => { e.preventDefault(); e.stopPropagation(); setTestMenu({ x: e.clientX, y: e.clientY, testId: t.id }); }}
                onRun={(ids) => void startBuild(activeId, ids)}
                onDelete={deleteTests} onSetEnabled={setEnabled} onToggleEnabled={toggleEnabled}
                onAdd={() => { setPrefillSuite(ROOT_SUITE); setModalOpen(true); }}
                tagColors={tagColors} scopedTestIds={scopedTestIds} scopeName={scopeName}
                onClearScope={() => setFilterCmd(null)} />
            ) : (
              <EmptyWorkspace />
            ))}

            {mainTab === "shots" && (
              <ShotTestsView collections={collections} people={PEOPLE}
                onRun={(colId, testId) => void startBuild(colId, [testId])}
                onOpen={(colId, testId) => { setActiveId(colId); selectTest(testId); setMainTab("tests"); }} />
            )}
          </div>
        </main>

        {col && selected && (
          <div className="relative shrink-0" ref={inspectorRef}>
            <aside className="drawer-in h-full w-[380px] overflow-hidden border-l border-line bg-panel shadow-[-18px_0_50px_rgba(0,0,0,0.28)]">
              <Inspector test={selected} col={col} people={PEOPLE} lastBuild={lastBuild}
                tagColors={tagColors} onTagColor={(tag, c) => setTagColors((p) => ({ ...p, [tag]: c }))}
                onSave={saveTest} onDirtyChange={setTestDirty}
                onRun={(id) => void startBuild(activeId, [id])} onDelete={(id) => deleteTests([id])}
                onClose={() => selectTest(null)} onOpenBuilder={() => setBuilderTestId(selected.id)}
                onManualResult={applyManualResult} />
            </aside>
          </div>
        )}
      </div>

      {col && builderTest && (
        <TestBuilder test={builderTest} col={col} onClose={() => setBuilderTestId(null)} onSave={saveTestSteps} />
      )}

      {col && (
        <NewTestModal open={modalOpen} col={col} people={PEOPLE} initialSuite={prefillSuite}
          tagColors={tagColors} onTagColor={(tag, c) => setTagColors((p) => ({ ...p, [tag]: c }))}
          onClose={() => { setModalOpen(false); setPrefillSuite(null); }} onCreate={createTest} />
      )}

      <DataDrawer open={dataOpen} account={account} users={PEOPLE} collections={collections}
        cookieStore={cookieStore} onClose={() => setDataOpen(false)} />

      {testMenu && <ContextMenu x={testMenu.x} y={testMenu.y} items={testMenuItems()} onAction={actTestMenu} onClose={() => setTestMenu(null)} />}

      {confirmCloseTest && (
        <div className="fixed inset-0 z-[65] grid place-items-center bg-deep/70 p-4 backdrop-blur-[3px]" onMouseDown={(e) => { if (e.target === e.currentTarget) setConfirmCloseTest(false); }}>
          <div className="toast-in w-full max-w-[390px] rounded-2xl border border-line bg-panel p-5 shadow-[0_30px_90px_rgba(0,0,0,0.6)]">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber/15 text-amber"><AlertTriangle size={17} /></span>
              <div>
                <div className="font-display text-[14px] font-bold text-fog">Уверены, что хотите прервать редактирование?</div>
                <p className="mt-1 text-[12px] font-semibold leading-relaxed text-mist">Несохранённые изменения в карточке теста будут потеряны.</p>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setConfirmCloseTest(false)} className="rounded-lg border border-line bg-raised px-4 py-2 text-[12.5px] font-extrabold text-mist transition-all hover:border-line2 hover:text-fog active:scale-95">Нет</button>
              <button onClick={() => { const p = pendingSel.current; setConfirmCloseTest(false); setTestDirty(false); setSelectedId(p); }}
                className="rounded-lg bg-amber px-4 py-2 text-[12.5px] font-extrabold text-[#17211d] transition-all hover:bg-amber2 active:scale-95">Да</button>
            </div>
          </div>
        </div>
      )}

      {gateError && (
        <div className="fixed inset-0 z-[65] grid place-items-center bg-deep/70 p-4 backdrop-blur-[3px]" onMouseDown={(e) => { if (e.target === e.currentTarget) setGateError(null); }}>
          <div className="toast-in w-full max-w-[420px] rounded-2xl border border-coral/40 bg-panel p-5 shadow-[0_30px_90px_rgba(0,0,0,0.6)]">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-coral/15 text-coral"><XCircle size={17} /></span>
              <div className="min-w-0">
                <div className="font-display text-[14px] font-bold text-fog">{gateError.kind === "auth" ? "Не удалось авторизоваться" : "Стенд недоступен"}</div>
                <p className="mt-1 text-[12px] font-semibold leading-relaxed text-coral">
                  {gateError.kind === "auth" ? gateError.detail ?? "Авторизация на стенде не выполнена." : "Не удалось получить статус ресурса. Попробуйте позже."}
                </p>
                <div className="mt-2.5 rounded-lg border border-line bg-raised/60 px-3 py-2">
                  <div className="text-[11px] font-bold text-fog">{gateError.name}</div>
                  <div className="mt-0.5 truncate font-mono text-[10.5px] font-semibold text-dim">{gateError.url}</div>
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={() => setGateError(null)} className="rounded-lg bg-coral px-4 py-2 text-[12.5px] font-extrabold text-[#2b0f0b] transition-all hover:brightness-110 active:scale-95">Понятно</button>
            </div>
          </div>
        </div>
      )}

      {workspaceOpen && (
        <div className="fixed inset-0 z-[65] grid place-items-center bg-deep/70 p-4 backdrop-blur-[3px]" onMouseDown={(e) => { if (e.target === e.currentTarget) setWorkspaceOpen(false); }}>
          <div className="toast-in w-full max-w-[420px] rounded-2xl border border-line bg-panel p-5 shadow-[0_30px_90px_rgba(0,0,0,0.6)]">
            <div className="flex items-center justify-between">
              <div className="font-display text-[14px] font-bold text-fog">Настройки места</div>
              <button onClick={() => setWorkspaceOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg text-dim transition-all hover:bg-raised hover:text-fog active:scale-90"><X size={16} /></button>
            </div>
            <div className="mt-4 space-y-3">
              <div className="rounded-lg border border-line bg-raised/50 px-3 py-2.5">
                <div className="text-[9.5px] font-extrabold uppercase tracking-[0.12em] text-dim">Рабочее место</div>
                <div className="mt-0.5 text-[13px] font-bold text-fog">{account.name}</div>
                <div className="font-mono text-[10.5px] font-semibold text-dim">{account.email}</div>
              </div>
              <div className="rounded-lg border border-line bg-raised/50 px-3 py-2.5">
                <div className="text-[9.5px] font-extrabold uppercase tracking-[0.12em] text-dim">Тариф</div>
                <div className="mt-0.5 text-[13px] font-bold text-amber">{account.plan}</div>
              </div>
              <p className="text-[10.5px] font-semibold leading-relaxed text-dim">Данные хранятся локально в вашем браузере (localStorage + IndexedDB).</p>
            </div>
          </div>
        </div>
      )}

      {/* тосты */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-[320px] flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className="toast-in pointer-events-auto flex items-start gap-2.5 rounded-xl border border-line bg-panel/95 px-3.5 py-3 shadow-[0_16px_50px_rgba(0,0,0,0.5)] backdrop-blur">
            {t.kind === "success" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#46d68c]" /> : t.kind === "warning" ? <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber" /> : <Info size={16} className="mt-0.5 shrink-0 text-teal" />}
            <div className="min-w-0">
              <div className="text-[12.5px] font-extrabold text-fog">{t.title}</div>
              {t.sub && <div className="mt-0.5 truncate text-[11px] font-semibold text-mist">{t.sub}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Отдельная страница «Статистика».
 * Функционал статистики отделён от рабочей области тестов: это самостоятельный
 * роут со своим хедером и источником данных (актуальное состояние из localStorage).
 */
function StatsPage({ accountId }: { accountId: string }) {
  const { collections } = useMemo(() => loadStateFor(accountId), [accountId]);
  const visible = collections.filter((c) => !c.deleted);

  return (
    <div className="stage-bg flex h-full flex-col overflow-hidden">
      {/* шапка страницы статистики */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-panel px-4">
        <Link to="/" title="Вернуться к тестам"
          className="flex items-center gap-2 rounded-lg border border-line bg-raised/60 px-3 py-2 text-[12px] font-extrabold text-mist transition-all duration-150 hover:border-teal/50 hover:text-teal active:scale-[0.97]">
          <ArrowLeft size={14} />К тестам
        </Link>
        <span className="h-6 w-px bg-line" />
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-amber/25 to-teal/15 shadow-[inset_0_0_0_1px_rgba(255,180,84,0.3)]">
            <BarChart3 size={16} className="text-amber" />
          </span>
          <div className="leading-none">
            <div className="font-display text-[14px] font-bold tracking-[0.08em] text-fog">Статистика</div>
            <div className="mt-[3px] text-[10px] font-semibold tracking-wide text-dim">сводка по скрин-сборкам</div>
          </div>
        </div>
        <div className="ml-auto hidden items-center gap-2 md:flex">
          <span className="rounded-md border border-line bg-raised/60 px-2.5 py-1 font-mono text-[10.5px] font-semibold text-mist">
            {visible.length} {visible.length === 1 ? "коллекция" : "коллекции"}
          </span>
          <span className="rounded-md border border-line bg-raised/60 px-2.5 py-1 font-mono text-[10.5px] font-semibold text-mist">
            {visible.reduce((n, c) => n + c.tests.length, 0)} тестов
          </span>
        </div>
      </header>

      {/* содержимое страницы */}
      <main className="min-h-0 flex-1 overflow-y-auto scroll-thin">
        <StatsView collections={visible} />
      </main>
    </div>
  );
}

/** Экран загрузки, пока восстанавливается сессия */
function BootScreen() {
  return (
    <div className="stage-bg grid h-full place-items-center">
      <div className="fade-up flex flex-col items-center gap-4">
        <svg width="52" height="52" viewBox="0 0 32 32" aria-hidden>
          <rect x="2" y="2" width="28" height="28" rx="8" fill="#ffb454" />
          <path d="M9 22.5V9.5l7 7 7-7v13" stroke="#17211d" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <Loader2 size={22} className="spin text-teal" />
        <div className="text-[12px] font-semibold text-mist">Открываем рабочее место…</div>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<{ user: PublicUser; session: DbSession } | null>(null);
  const [booting, setBooting] = useState(true);

  /* восстановление сессии при старте (БД: localStorage или Supabase) */
  useEffect(() => {
    let live = true;
    Promise.resolve(backend.restore()).then((r) => {
      if (live) {
        setSession(r);
        setBooting(false);
      }
    });
    return () => {
      live = false;
    };
  }, []);

  const handleLogout = () => {
    Promise.resolve(backend.logout()).then(() => setSession(null));
  };

  if (booting) return <BootScreen />;

  if (!session) {
    return <AuthGate onAuthed={(user, sess) => setSession({ user, session: sess })} />;
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<TestsWorkspace accountId={session.user.accountId} user={session.user} onLogout={handleLogout} />} />
        <Route path="/stats" element={<StatsPage accountId={session.user.accountId} />} />
        <Route path="*" element={<TestsWorkspace accountId={session.user.accountId} user={session.user} onLogout={handleLogout} />} />
      </Routes>
    </HashRouter>
  );
}
