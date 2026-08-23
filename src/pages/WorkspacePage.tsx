import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Collection, AutoTest, CollectionDraft, Person } from "../types";
import { uid, ROOT_SUITE } from "../types";
import { backend, type PublicUser } from "../backend";
import type { DbSession } from "../backend/db";
import CollectionModal from "../components/CollectionModal";
import NewTestModal from "../components/NewTestModal";
import type { NewTestData } from "../components/NewTestModal";

export default function WorkspacePage() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState<{ user: PublicUser; session: DbSession } | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Модальные окна
  const [showCollectionModal, setShowCollectionModal] = useState<{ mode: "create" } | { mode: "edit"; id: string } | null>(null);
  const [showTestModal, setShowTestModal] = useState(false);
  const [initialSuite, setInitialSuite] = useState<string | null>(null);
  
  // Заглушки для людей и тегов
  const mockPeople: Person[] = [
    { id: "u1", name: "Вы", avatar: "" },
    { id: "u2", name: "Коллега", avatar: "" },
  ];
  const [tagColors, setTagColors] = useState<Record<string, string>>({});

  // Восстановление сессии
  useEffect(() => {
    backend.restore().then((result) => {
      if (result && result.user && result.session) {
        setAuthed(result);
      } else {
        navigate("/auth");
      }
    }).catch(() => navigate("/auth"));
  }, [navigate]);

  // Загрузка коллекций после аутентификации
  useEffect(() => {
    if (!authed?.user?.accountId) return;
    
    try {
      const saved = localStorage.getItem(`kadr_state_${authed.user.accountId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        const cols = Array.isArray(parsed.collections) ? parsed.collections : [];
        setCollections(cols);
        setActiveId(parsed.activeId || (cols.length > 0 ? cols[0].id : null));
      }
    } catch (e) {
      console.error("Ошибка загрузки состояния:", e);
    } finally {
      setLoading(false);
    }
  }, [authed]);

  // Автосохранение
  useEffect(() => {
    if (!authed?.user?.accountId) return;
    const timeout = setTimeout(() => {
      localStorage.setItem(
        `kadr_state_${authed.user.accountId}`,
        JSON.stringify({ collections, activeId })
      );
    }, 500);
    return () => clearTimeout(timeout);
  }, [collections, activeId, authed]);

  if (loading) {
    return (
      <div className="grid h-screen w-screen place-items-center bg-deep text-fog">
        <div className="text-center">
          <div className="font-display text-[18px] font-bold">Загрузка...</div>
        </div>
      </div>
    );
  }

  if (!authed) {
    return null;
  }

  const activeCollection = collections.find(c => c.id === activeId) || (collections.length > 0 ? collections[0] : null);

  // Экран создания первой коллекции
  if (collections.length === 0) {
    return (
      <div className="flex h-screen w-screen flex-col bg-deep text-fog">
        {/* Шапка */}
        <header className="flex h-14 items-center justify-between border-b border-white/10 px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber font-bold text-[#17211d]">К</div>
            <span className="font-display text-[16px] font-bold">КАДР</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/cloud-statistic")}
              className="text-[13px] font-semibold text-mist hover:text-fog"
            >
              Отчеты
            </button>
            <button
              onClick={() => {
                backend.logout();
                navigate("/auth");
              }}
              className="text-[13px] font-semibold text-mist hover:text-fog"
            >
              Выйти
            </button>
          </div>
        </header>

        {/* Центральная часть */}
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="mb-2 text-[28px] font-bold text-fog">Нет коллекций</div>
            <p className="mb-6 max-w-[320px] text-[13px] font-semibold leading-relaxed text-mist">
              Создайте первую коллекцию для начала работы с тестами
            </p>
            <button 
              onClick={() => setShowCollectionModal({ mode: "create" })}
              className="inline-flex items-center gap-2 rounded-lg bg-amber px-5 py-2.5 text-[13px] font-extrabold text-[#17211d] shadow-[0_2px_12px_rgba(255,180,84,0.3)] transition-all hover:brightness-110 active:scale-95"
            >
              Создать коллекцию
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-deep text-fog">
      {/* Шапка */}
      <header className="flex h-14 items-center justify-between border-b border-white/10 px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber font-bold text-[#17211d]">К</div>
          <span className="font-display text-[16px] font-bold">КАДР</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/cloud-statistic")}
            className="text-[13px] font-semibold text-mist hover:text-fog"
          >
            Отчеты
          </button>
          <button
            onClick={() => {
              backend.logout();
              navigate("/auth");
            }}
            className="text-[13px] font-semibold text-mist hover:text-fog"
          >
            Выйти
          </button>
        </div>
      </header>

      {/* Основная область */}
      <div className="flex flex-1 overflow-hidden">
        {/* Левая панель - Список коллекций */}
        <aside className="flex w-64 flex-col border-r border-white/10">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <span className="text-[12px] font-bold uppercase tracking-wider text-mist">Коллекции</span>
            <button
              onClick={() => setShowCollectionModal({ mode: "create" })}
              className="rounded p-1 hover:bg-white/10"
              title="Добавить коллекцию"
            >
              <i className="fas fa-plus text-[12px] text-mist"></i>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {collections.map(col => (
              <div
                key={col.id}
                onClick={() => setActiveId(col.id)}
                className={`flex cursor-pointer items-center gap-3 border-b border-white/5 px-4 py-3 transition-colors ${
                  activeId === col.id ? "bg-white/10" : "hover:bg-white/5"
                }`}
              >
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: col.color }}
                ></div>
                <span className="flex-1 truncate text-[13px] font-semibold">{col.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCollections(collections.filter(c => c.id !== col.id));
                    if (activeId === col.id) {
                      setActiveId(collections.length > 1 ? collections.find(c => c.id !== col.id)?.id || null : null);
                    }
                  }}
                  className="rounded p-1 opacity-0 transition-opacity hover:bg-red-500/20 group-hover:opacity-100"
                  title="Удалить коллекцию"
                >
                  <i className="fas fa-trash text-[11px] text-mist"></i>
                </button>
              </div>
            ))}
          </div>
        </aside>

        {/* Центральная панель - Список тестов */}
        <main className="flex flex-1 flex-col">
          {activeCollection ? (
            <>
              <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div
                    className="h-4 w-4 rounded-full"
                    style={{ backgroundColor: activeCollection.color }}
                  ></div>
                  <h2 className="text-[18px] font-bold">{activeCollection.name}</h2>
                  <span className="rounded bg-white/10 px-2 py-0.5 text-[11px] font-bold text-mist">
                    {activeCollection.tests.length} тестов
                  </span>
                </div>
                <button
                  onClick={() => {
                    setInitialSuite(ROOT_SUITE);
                    setShowTestModal(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber px-4 py-2 text-[12px] font-extrabold text-[#17211d] transition-all hover:brightness-110"
                >
                  <i className="fas fa-plus"></i>
                  Новый тест
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6">
                {activeCollection.tests.length === 0 ? (
                  <div className="grid h-full place-items-center">
                    <div className="text-center">
                      <div className="mb-2 text-[16px] font-bold text-mist">Нет тестов</div>
                      <p className="text-[12px] text-mist/70">Создайте первый тест в этой коллекции</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activeCollection.tests.map(test => (
                      <div
                        key={test.id}
                        className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3"
                      >
                        <div>
                          <div className="text-[13px] font-bold">{test.name}</div>
                          <div className="text-[11px] text-mist">{test.method} {test.path}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            test.status === "passed" ? "bg-green-500/20 text-green-400" :
                            test.status === "failed" ? "bg-red-500/20 text-red-400" :
                            "bg-gray-500/20 text-gray-400"
                          }`}>
                            {test.status || "new"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="grid h-full place-items-center">
              <div className="text-center text-mist">Выберите коллекцию</div>
            </div>
          )}
        </main>
      </div>

      {/* Модальное окно создания/редактирования коллекции */}
      {showCollectionModal && (
        <CollectionModal
          state={showCollectionModal}
          col={showCollectionModal.mode === "edit" && activeCollection ? activeCollection : null}
          cookieStore={{}}
          authState={undefined}
          onCheckAuth={undefined}
          onClose={() => setShowCollectionModal(null)}
          onSave={(id, draft) => {
            if (id) {
              // Редактирование
              setCollections(collections.map(c => c.id === id ? { ...c, ...draft } as Collection : c));
            } else {
              // Создание новой
              const newCol: Collection = {
                id: uid(),
                name: draft.name,
                color: draft.color,
                screenUrl: draft.screenUrl,
                browser: draft.browser,
                threshold: draft.threshold,
                delayMs: draft.delayMs,
                notify: draft.notify,
                auth: draft.auth === "none" ? { enabled: false } : { enabled: true },
                authLogin: draft.authLogin,
                authPassword: draft.authPassword,
                authKey: draft.authKey,
                baseUrl: "",
                viewports: ["1440"],
                baseline: "main",
                tests: [],
                tree: [],
              };
              setCollections([...collections, newCol]);
              setActiveId(newCol.id);
            }
            setShowCollectionModal(null);
          }}
        />
      )}

      {/* Модальное окно создания теста */}
      {activeCollection && (
        <NewTestModal
          open={showTestModal}
          col={activeCollection}
          people={mockPeople}
          initialSuite={initialSuite}
          tagColors={tagColors}
          onTagColor={(tag, color) => setTagColors({ ...tagColors, [tag]: color })}
          onClose={() => setShowTestModal(false)}
          onCreate={(data: NewTestData) => {
            const newTest: AutoTest = {
              id: uid(),
              name: data.name,
              path: data.path,
              method: "GET",
              status: "new",
              suite: data.suite,
              assignee: data.assignee,
              viewports: data.viewports,
              tags: data.tags,
              steps: [],
            };
            setCollections(collections.map(c => 
              c.id === activeCollection.id 
                ? { ...c, tests: [...c.tests, newTest] }
                : c
            ));
            setShowTestModal(false);
          }}
        />
      )}
    </div>
  );
}
