import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Account, AutoTest, Collection, CollectionDraft, CookieStore, LastBuild, Person, RunRecord, TreeNode } from "../types";
import { ROOT_SUITE, uid } from "../types";
import { backend, type PublicUser } from "../backend";
import type { DbSession } from "../backend/db";
import { loadStateFor, saveStateFor, type PersistedState } from "../data";
import { ensureTrash, nodeById, parentOf, getTrash } from "../tree";
import CollectionPanel from "../components/CollectionPanel";
import TestTable from "../components/TestTable";
import Inspector, { type ManualResult } from "../components/Inspector";
import Toolbar from "../components/Toolbar";
import TestBuilder from "../components/TestBuilder";
import NewTestModal from "../components/NewTestModal";

interface WorkspaceState {
  collections: Collection[];
  activeId: string;
  buildNo: number;
  cookieStore: CookieStore;
  account: Account;
  tagColors: Record<string, string>;
}

export default function WorkspacePage() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState<{ user: PublicUser; session: DbSession } | null>(null);
  const [state, setState] = useState<WorkspaceState | null>(null);
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [flashTestId, setFlashTestId] = useState<string | null>(null);
  const [folderScope, setFolderScope] = useState<string | null>(null);
  const [buildActive, setBuildActive] = useState(false);
  const [buildProgress, setBuildProgress] = useState<{ done: number; total: number } | null>(null);
  const [lastBuild, setLastBuild] = useState<LastBuild | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [builderTest, setBuilderTest] = useState<AutoTest | null>(null);
  const [newTestFor, setNewTestFor] = useState<string | null>(null);

  // Восстановление сессии при старте страницы
  useEffect(() => {
    backend.restore().then((result) => {
      if (result && result.user && result.session) {
        setAuthed(result);
      } else {
        navigate("/auth");
      }
    }).catch((e) => {
      console.error("Ошибка восстановления сессии:", e);
      navigate("/auth");
    });
  }, [navigate]);

  // Загрузка состояния рабочего места после аутентификации
  useEffect(() => {
    if (!authed || !authed.user || !authed.user.accountId) return;
    const s = loadStateFor(authed.user.accountId);
    setState({
      collections: s.collections,
      activeId: s.activeId,
      buildNo: s.buildNo,
      cookieStore: s.cookieStore,
      account: s.account,
      tagColors: s.tagColors,
    });
  }, [authed]);

  // Автосохранение состояния
  useEffect(() => {
    if (!state || !authed || !authed.user || !authed.user.accountId) return;
    const t = window.setTimeout(() => {
      saveStateFor(authed.user.accountId, state as unknown as PersistedState);
      setSavedAt(Date.now());
    }, 500);
    return () => window.clearTimeout(t);
  }, [state, authed]);

  // Показываем заглушку пока нет данных
  if (!authed || !state) {
    return (
      <div className="grid h-screen w-screen place-items-center bg-deep text-fog">
        <div className="text-center">
          <div className="font-display text-[18px] font-bold">Загрузка...</div>
        </div>
      </div>
    );
  }

  const { collections, activeId, buildNo, cookieStore, account, tagColors } = state;
  
  // Надёжное получение активной коллекции
  const col = collections.find((c) => c.id === activeId && !c.deleted) 
    ?? collections.find((c) => !c.deleted) 
    ?? null;
  
  // Если коллекций нет вообще — показываем экран создания
  if (!col || collections.length === 0) {
    return (
      <div className="grid h-screen w-screen place-items-center bg-deep text-fog">
        <div className="text-center">
          <div className="mb-2 text-[28px] font-bold text-fog">Нет коллекций</div>
          <p className="mb-6 max-w-[320px] text-[13px] font-semibold leading-relaxed text-mist">
            Создайте первую коллекцию для начала работы с тестами
          </p>
          <button 
            onClick={() => {
              const newCol: Collection = {
                id: uid(),
                name: "Моя коллекция",
                color: "#ffb454",
                baseUrl: "",
                screenUrl: "",
                browser: "chrome",
                viewports: ["1440"],
                threshold: 0.05,
                delayMs: 1000,
                baseline: "main",
                notify: [],
                auth: { enabled: false },
                tests: [],
                tree: ensureTrash([]),
              };
              setState((prev) => prev ? { ...prev, collections: [newCol], activeId: newCol.id } : prev);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-amber px-5 py-2.5 text-[13px] font-extrabold text-[#17211d] shadow-[0_2px_12px_rgba(255,180,84,0.3)] transition-all hover:brightness-110 active:scale-95"
          >
            Создать коллекцию
          </button>
        </div>
      </div>
    );
  }
  
  const people: Person[] = [];

  /* ---------- Handlers ---------- */

  const updateCollections = (fn: (cols: Collection[]) => Collection[]) => {
    setState((prev) => (prev ? { ...prev, collections: fn(prev.collections) } : prev));
  };

  const handleSelectCollection = (id: string) => {
    setState((prev) => (prev ? { ...prev, activeId: id } : prev));
    setSelectedTestId(null);
    setFolderScope(null);
  };

  const handleSelectFolder = (id: string | null) => {
    setFolderScope(id);
  };

  const handleOpenTest = (nodeId: string) => {
    if (!col) return;
    const test = col.tests.find((t) => t.requestId === nodeId);
    if (test) {
      setSelectedTestId(test.id);
      setFlashTestId(test.id);
      window.setTimeout(() => setFlashTestId(null), 1600);
    }
  };

  const handleFilterFailing = (folderId: string) => {
    setFolderScope(folderId);
  };

  const handleCreateCollection = (d: CollectionDraft) => {
    const newCol: Collection = {
      id: uid(),
      name: d.name,
      color: d.color ?? "#ffb454",
      baseUrl: "",
      screenUrl: d.screenUrl,
      browser: d.browser,
      viewports: ["1440"],
      threshold: d.threshold,
      delayMs: d.delayMs,
      baseline: "main",
      notify: d.notify,
      auth: d.auth,
      authLogin: d.authLogin,
      authPassword: d.authPassword,
      tests: [],
      tree: ensureTrash([]),
    };
    updateCollections((cols) => [...cols, newCol]);
    setState((prev) => (prev ? { ...prev, activeId: newCol.id } : prev));
  };

  const handleCreateNode = (parentId: string | null, d: { kind: "request" | "folder"; name: string; path?: string }) => {
    if (!col) return;
    updateCollections((cols) =>
      cols.map((c) => {
        if (c.id !== col.id) return c;
        const newNode: TreeNode =
          d.kind === "folder"
            ? { id: uid(), kind: "folder", name: d.name, children: [] }
            : { id: uid(), kind: "request", name: d.name, method: "GET", path: d.path ?? "/" };
        const tree = [...c.tree];
        if (parentId) {
          const addRecursive = (ns: TreeNode[]): boolean => {
            for (const n of ns) {
              if (n.kind === "folder" && n.id === parentId) {
                n.children.push(newNode);
                return true;
              }
              if (n.kind === "folder" && addRecursive(n.children)) return true;
            }
            return false;
          };
          addRecursive(tree);
        } else {
          tree.push(newNode);
        }
        return { ...c, tree: ensureTrash(tree) };
      })
    );
  };

  const handleAddRequest = (parentId: string | null) => {
    setNewTestFor(parentId);
  };

  const handleUpdateNode = (nodeId: string, patch: { name: string; path?: string }) => {
    if (!col) return;
    updateCollections((cols) =>
      cols.map((c) => {
        if (c.id !== col.id) return c;
        const updateRecursive = (ns: TreeNode[]): TreeNode[] =>
          ns.map((n) => {
            if (n.kind === "request" && n.id === nodeId) {
              return { ...n, name: patch.name, path: patch.path ?? n.path };
            }
            if (n.kind === "folder") {
              return { ...n, children: updateRecursive(n.children) };
            }
            return n;
          });
        return { ...c, tree: updateRecursive(c.tree) };
      })
    );
  };

  const handleDeleteNode = (nodeId: string) => {
    if (!col) return;
    const trash = getTrash(col.tree);
    if (!trash) return;
    updateCollections((cols) =>
      cols.map((c) => {
        if (c.id !== col.id) return c;
        const moveRecursive = (ns: TreeNode[], targetId: string): TreeNode[] => {
          const result: TreeNode[] = [];
          for (const n of ns) {
            if (n.id === targetId) continue;
            if (n.kind === "folder") {
              const filtered = moveRecursive(n.children, targetId);
              if (n.id === targetId) {
                trash.children.push(n);
              } else {
                result.push({ ...n, children: filtered });
              }
            } else {
              result.push(n);
            }
          }
          return result;
        };
        const newTree = moveRecursive(c.tree, nodeId);
        return { ...c, tree: ensureTrash(newTree) };
      })
    );
  };

  const handleMoveNode = (fromId: string, toParent: string | null, toIndex: number) => {
    // Реализация перемещения узла
  };

  const handleMoveCollection = (fromId: string, toIndex: number) => {
    updateCollections((cols) => {
      const newCols = cols.filter((c) => c.id !== fromId);
      const moved = cols.find((c) => c.id === fromId);
      if (moved) {
        newCols.splice(toIndex, 0, moved);
      }
      return newCols;
    });
  };

  const handleDeleteCollection = (id: string) => {
    updateCollections((cols) => cols.map((c) => (c.id === id ? { ...c, deleted: true } : c)));
  };

  const handleRestoreNode = (nodeId: string) => {
    // Восстановление из корзины
  };

  const handlePurgeNode = (nodeId: string) => {
    // Безвозвратное удаление
  };

  const handleRestoreCollection = (id: string) => {
    updateCollections((cols) => cols.map((c) => (c.id === id ? { ...c, deleted: false } : c)));
  };

  const handlePurgeCollection = (id: string) => {
    updateCollections((cols) => cols.filter((c) => c.id !== id));
  };

  const handlePurgeAll = () => {
    updateCollections((cols) => cols.filter((c) => !c.deleted));
  };

  const handleSaveCard = (id: string, patch: Partial<Collection>) => {
    updateCollections((cols) => cols.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const handleRunAll = (id: string) => {
    setBuildActive(true);
    const targetCol = collections.find((c) => c.id === id);
    if (!targetCol) return;
    const total = targetCol.tests.filter((t) => t.enabled).length;
    let done = 0;
    setBuildProgress({ done: 0, total });
    
    const interval = setInterval(() => {
      done++;
      setBuildProgress({ done, total });
      if (done >= total) {
        clearInterval(interval);
        setBuildActive(false);
        setLastBuild({
          no: buildNo + 1,
          colName: targetCol.name,
          at: Date.now(),
          durMs: 5000,
          total,
          passed: Math.floor(total * 0.7),
          diff: Math.floor(total * 0.1),
          failed: Math.floor(total * 0.2),
        });
        setState((prev) => (prev ? { ...prev, buildNo: prev.buildNo + 1 } : prev));
      }
    }, 500);
  };

  const handleCheckUrl = (id: string) => {
    // Проверка URL стенда
  };

  const handleRefreshStands = () => {
    // Обновление стендов
  };

  const handleCheckAuth = (id: string, draft?: CollectionDraft) => {
    // Проверка авторизации
  };

  const handleTagColor = (tag: string, color: string) => {
    setState((prev) => (prev ? { ...prev, tagColors: { ...prev.tagColors, [tag]: color } } : prev));
  };

  const handleSaveTest = (id: string, patch: Partial<AutoTest>) => {
    if (!col) return;
    updateCollections((cols) =>
      cols.map((c) => {
        if (c.id !== col.id) return c;
        return {
          ...c,
          tests: c.tests.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        };
      })
    );
  };

  const handleDirtyChange = (dirty: boolean) => {
    // Отслеживание изменений
  };

  const handleRunTest = (id: string) => {
    // Запуск конкретного теста
  };

  const handleDeleteTest = (id: string) => {
    if (!col) return;
    updateCollections((cols) =>
      cols.map((c) => {
        if (c.id !== col.id) return c;
        const test = c.tests.find((t) => t.id === id);
        const newTree = c.tree.filter((n) => n.kind !== "request" || n.id !== test?.requestId);
        return {
          ...c,
          tree: ensureTrash(newTree),
          tests: c.tests.filter((t) => t.id !== id),
        };
      })
    );
    setSelectedTestId(null);
  };

  const handleCloseInspector = () => {
    setSelectedTestId(null);
  };

  const handleOpenBuilder = () => {
    if (!col || !selectedTestId) return;
    const test = col.tests.find((t) => t.id === selectedTestId);
    if (test) setBuilderTest(test);
  };

  const handleManualResult = (id: string, r: ManualResult) => {
    if (!col) return;
    handleSaveTest(id, {
      status: r.status,
      diffPct: r.diffPct,
      durMs: r.durMs,
      lastRun: Date.now(),
      history: [
        ...(col.tests.find((t) => t.id === id)?.history ?? []),
        { id: uid(), status: r.status, at: Date.now(), dur: r.durMs, diffPct: r.diffPct, failText: r.failText } as RunRecord,
      ],
    });
  };

  const handleLogout = () => {
    backend.logout();
    setAuthed(null);
    setState(null);
    navigate("/auth");
  };

  const handleSetEnabled = (ids: string[], v: boolean) => {
    if (!col) return;
    updateCollections((cols) =>
      cols.map((c) => {
        if (c.id !== col.id) return c;
        return {
          ...c,
          tests: c.tests.map((t) => (ids.includes(t.id) ? { ...t, enabled: v } : t)),
        };
      })
    );
  };

  const handleToggleEnabled = (id: string) => {
    if (!col) return;
    const test = col.tests.find((t) => t.id === id);
    if (test) handleSaveTest(id, { enabled: !test.enabled });
  };

  const handleAddTest = () => {
    setNewTestFor(null);
  };

  const scopedTestIds = folderScope && col
    ? new Set(
        col.tests.filter((t) => {
          if (!t.requestId) return false;
          const node = nodeById(col.tree, t.requestId);
          if (!node) return false;
          const parent = parentOf(col.tree, node.id);
          return parent === folderScope;
        }).map((t) => t.id)
      )
    : null;

  const scopeName = folderScope && col ? nodeById(col.tree, folderScope)?.name ?? null : null;

  const handleClearScope = () => {
    setFolderScope(null);
  };

  const selectedTest = col?.tests.find((t) => t.id === selectedTestId) ?? null;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-deep text-fog">
      <Toolbar
        buildNo={buildNo}
        buildActive={buildActive}
        progress={buildProgress}
        savedAt={savedAt}
        canRun={!!col && col.tests.some((t) => t.enabled)}
        onRun={() => col && handleRunAll(col.id)}
        onStop={() => setBuildActive(false)}
        onOpenData={() => {}}
        account={account}
        onLogout={handleLogout}
        onWorkspace={() => navigate("/workspace")}
      />
      
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Левая панель: коллекции и дерево */}
        <div className="flex w-[340px] shrink-0 flex-col border-r border-line bg-panel">
          <CollectionPanel
            collections={collections}
            activeId={activeId}
            onSelect={handleSelectCollection}
            folderScope={folderScope}
            onSelectFolder={handleSelectFolder}
            onOpenTest={handleOpenTest}
            onFilterFailing={handleFilterFailing}
            onCreateCollection={handleCreateCollection}
            onCreateNode={handleCreateNode}
            onAddRequest={handleAddRequest}
            onUpdateNode={handleUpdateNode}
            onDeleteNode={handleDeleteNode}
            onMoveNode={handleMoveNode}
            onMoveCollection={handleMoveCollection}
            onDeleteCollection={handleDeleteCollection}
            onRestoreNode={handleRestoreNode}
            onPurgeNode={handlePurgeNode}
            onRestoreCollection={handleRestoreCollection}
            onPurgeCollection={handlePurgeCollection}
            onPurgeAll={handlePurgeAll}
            onSaveCard={handleSaveCard}
            onCheckUrl={handleCheckUrl}
            onRefreshStands={handleRefreshStands}
            onCheckAuth={handleCheckAuth}
            tagColors={tagColors}
            onTagColor={handleTagColor}
            people={people}
          />
          
          {/* Таблица тестов */}
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <TestTable
              collection={col}
              folderScope={folderScope}
              scopeName={scopeName}
              scopedTestIds={scopedTestIds ?? new Set()}
              selectedTestId={selectedTestId}
              flashTestId={flashTestId}
              onSelect={setSelectedTestId}
              onRun={handleRunTest}
              onDelete={handleDeleteTest}
              onToggleEnabled={handleToggleEnabled}
              onSetEnabled={handleSetEnabled}
              onClearScope={handleClearScope}
            />
          </div>
        </div>

        {/* Правая панель: инспектор */}
        <div className="flex min-w-0 flex-1 overflow-hidden bg-canvas">
          {selectedTest && col ? (
            <Inspector
              test={selectedTest}
              collection={col}
              onClose={handleCloseInspector}
              onSave={handleSaveTest}
              onDirtyChange={handleDirtyChange}
              onRun={handleRunTest}
              onOpenBuilder={handleOpenBuilder}
              onManualResult={handleManualResult}
              tagColors={tagColors}
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-subtle">
              <div className="text-center">
                <div className="font-display text-[18px] font-bold">Выберите тест для просмотра</div>
                <div className="mt-2 text-sm">или создайте новый, нажав «+» в дереве</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Модальные окна */}
      {builderTest && (
        <TestBuilder
          test={builderTest}
          collection={col}
          onClose={() => setBuilderTest(null)}
          onSave={(patch) => {
            handleSaveTest(builderTest.id, patch);
            setBuilderTest(null);
          }}
        />
      )}

      {newTestFor !== undefined && col && (
        <NewTestModal
          collection={col}
          parentId={newTestFor}
          onClose={() => setNewTestFor(null)}
          onCreate={(d) => {
            handleCreateNode(newTestFor, d);
            setNewTestFor(null);
          }}
        />
      )}
    </div>
  );
}
