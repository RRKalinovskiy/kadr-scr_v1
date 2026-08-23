import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from '../components/Header';
import { backend } from "../backend";
import type { PublicUser } from "../backend";
import { BarChart3, Inbox, RefreshCw, Plus, Wifi, WifiOff } from "lucide-react";
import { loadStateFor, saveStateFor, type PersistedState } from "../data";
import type { Collection } from "../types";

export default function CloudStatisticPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  
  // Form state
  const [standName, setStandName] = useState("");
  const [standUrl, setStandUrl] = useState("");
  const [standColor, setStandColor] = useState("#ffb454");
  
  const getAccountId = (): string => {
    const token = localStorage.getItem("kadr-regapi-token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.accountId || payload.sub || "default";
      } catch {
        return "default";
      }
    }
    return "default";
  };

  useEffect(() => {
    // Проверка авторизации
    backend.restore().then((result) => {
      if (result && result.user) {
        setUser(result.user);
        // Load collections
        try {
          const accountId = getAccountId();
          const state = loadStateFor(accountId);
          const cols = state?.collections || [];
          setCollections(cols);
        } catch (e) {
          console.error('Failed to load collections:', e);
        }
        setLoading(false);
      } else {
        navigate("/auth");
      }
    }).catch(() => {
      navigate("/auth");
    });
  }, [navigate]);

  const handleCreateCollection = () => {
    if (!standName.trim() || !standUrl.trim()) return;
    
    const newCollection: Collection = {
      id: Date.now().toString(),
      name: standName,
      baseUrl: standUrl,
      color: standColor,
      tests: [],
      createdAt: new Date().toISOString(),
    };
    
    const updatedCollections = [...collections, newCollection];
    setCollections(updatedCollections);
    
    // Save state
    const accountId = getAccountId();
    const fullState: PersistedState = {
      collections: updatedCollections,
      activeId: collections.length > 0 ? collections[0].id : newCollection.id,
      buildNo: 13,
      cookieStore: {},
      account: { id: accountId, name: "User", email: "user@example.com", plan: "free", createdAt: Date.now() },
      tagColors: {},
    };
    saveStateFor(accountId, fullState);
    
    // Reset form and close modal
    setStandName("");
    setStandUrl("");
    setStandColor("#ffb454");
    setIsModalOpen(false);
    setEditingCollection(null);
  };

  const handleEditCollection = (collection: Collection) => {
    setEditingCollection(collection);
    setStandName(collection.name);
    setStandUrl(collection.baseUrl);
    setStandColor(collection.color);
    setIsModalOpen(true);
  };

  const handleUpdateCollection = () => {
    if (!editingCollection || !standName.trim() || !standUrl.trim()) return;
    
    const updatedCollections = collections.map(c => 
      c.id === editingCollection.id 
        ? { ...c, name: standName, baseUrl: standUrl, color: standColor }
        : c
    );
    
    setCollections(updatedCollections);
    
    // Save state
    const accountId = getAccountId();
    const fullState: PersistedState = {
      collections: updatedCollections,
      activeId: collections.length > 0 ? collections[0].id : "",
      buildNo: 13,
      cookieStore: {},
      account: { id: accountId, name: "User", email: "user@example.com", plan: "free", createdAt: Date.now() },
      tagColors: {},
    };
    saveStateFor(accountId, fullState);
    
    // Reset form and close modal
    setStandName("");
    setStandUrl("");
    setStandColor("#ffb454");
    setIsModalOpen(false);
    setEditingCollection(null);
  };

  const handleDeleteCollection = (id: string) => {
    if (confirm('Вы уверены? Эта коллекция будет удалена.')) {
      const updatedCollections = collections.filter(c => c.id !== id);
      setCollections(updatedCollections);
      
      // Save state
      const accountId = getAccountId();
      const fullState: PersistedState = {
        collections: updatedCollections,
        activeId: updatedCollections.length > 0 ? updatedCollections[0].id : "",
        buildNo: 13,
        cookieStore: {},
        account: { id: accountId, name: "User", email: "user@example.com", plan: "free", createdAt: Date.now() },
        tagColors: {},
      };
      saveStateFor(accountId, fullState);
    }
  };

  const openCreateModal = () => {
    setEditingCollection(null);
    setStandName("");
    setStandUrl("");
    setStandColor("#ffb454");
    setIsModalOpen(true);
  };

  if (loading) {
    return (
      <div className="grid h-screen w-screen place-items-center bg-deep text-fog">
        <div className="text-center">
          <div className="font-semibold text-[18px] font-bold">Загрузка...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-deep">
      {/* Header Component */}
      <Header />
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-[28px] font-bold text-fog">Статистика облака</h1>
            <p className="text-mist mt-1 text-sm">Мониторинг и отчеты по тестам команды</p>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 rounded-lg bg-amber px-4 py-2.5 text-[13px] font-extrabold text-[#17211d] shadow-[0_2px_14px_rgba(255,180,84,0.3)] transition-all duration-150 hover:bg-amber2 hover:scale-105 active:scale-[0.98]"
          >
            <Plus size={18} />
            Подключить стенд
          </button>
        </div>

        {/* Connection Blocks */}
        <div className="mb-8">
          <h2 className="font-display text-[18px] font-semibold text-fog mb-4">Подключенные стенды</h2>
          {collections.length === 0 ? (
            <div className="rounded-xl border border-line bg-panel/60 p-8 text-center">
              <WifiOff size={40} className="mx-auto mb-3 text-mist" />
              <p className="text-fog font-medium mb-1">Нет подключенных стендов</p>
              <p className="text-mist text-sm">Нажмите "Подключить стенд", чтобы добавить первый стенд для мониторинга</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {collections.map((collection) => (
                <div
                  key={collection.id}
                  className="group rounded-xl border border-line bg-panel/60 p-5 transition-all duration-200 hover:bg-panel/80 hover:shadow-[0_10px_40px_rgba(0,0,0,0.3)]"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: collection.color }}
                      />
                      <h3 className="font-display text-[16px] font-bold text-fog">{collection.name}</h3>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleEditCollection(collection)}
                        className="p-1.5 hover:bg-raised rounded text-mist hover:text-fog"
                      >
                        <RefreshCw size={14} />
                      </button>
                      <button 
                        onClick={() => handleDeleteCollection(collection.id)}
                        className="p-1.5 hover:bg-ember/20 rounded text-mist hover:text-ember"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-mist font-mono bg-deep/50 p-2 rounded border border-border truncate mb-3">
                    {collection.baseUrl}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-dim font-semibold">
                      {collection.tests.length} тестов
                    </span>
                    <span className="text-[10px] px-2 py-1 rounded bg-sage/20 text-sage font-semibold">
                      Активен
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="rounded-xl border border-line bg-panel/40 p-8 backdrop-blur">
          <div className="text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber/10">
              <BarChart3 size={32} className="text-amber" />
            </div>
            <h2 className="mb-3 font-display text-[20px] font-semibold text-fog">
              Облачная статистика
            </h2>
            <p className="mb-6 text-sm text-mist max-w-md mx-auto leading-relaxed">
              Здесь будут отображаться отчеты по тестам вашей команды.<br />
              Статистика хранится в базе данных и доступна всем участникам аккаунта.
            </p>
            
            {/* Заглушка для будущих отчетов */}
            <div className="mt-8 rounded-xl border-2 border-dashed border-line bg-deep/50 p-8 max-w-2xl mx-auto">
              <Inbox size={32} className="mx-auto mb-3 text-mist" />
              <p className="text-sm font-medium text-mist">
                Отчеты пока не сформированы
              </p>
              <p className="mt-1 text-xs text-dim">
                Запустите сборку тестов в workspace, чтобы увидеть статистику
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Modal for adding/editing collection */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div 
              className="fixed inset-0 bg-black/60 transition-opacity backdrop-blur-sm" 
              onClick={() => setIsModalOpen(false)}
            />
            
            <div className="relative inline-block align-bottom bg-panel rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:max-w-lg sm:w-full border border-line">
              <div className="bg-panel px-6 pt-6 pb-4">
                <h3 className="font-display text-[20px] font-bold text-fog mb-6">
                  {editingCollection ? 'Редактировать стенд' : 'Подключить стенд'}
                </h3>
                
                <div className="space-y-5">
                  <div>
                    <label className="block text-[12px] font-bold text-mist mb-2 uppercase tracking-wide">
                      Название стенда
                    </label>
                    <input
                      type="text"
                      value={standName}
                      onChange={(e) => setStandName(e.target.value)}
                      placeholder="Например: Тестовый стенд"
                      className="w-full px-4 py-3 bg-deep border border-line rounded-lg text-fog placeholder-mist/50 focus:outline-none focus:border-amber focus:ring-1 focus:ring-amber transition-colors"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-[12px] font-bold text-mist mb-2 uppercase tracking-wide">
                      URL стенда
                    </label>
                    <input
                      type="url"
                      value={standUrl}
                      onChange={(e) => setStandUrl(e.target.value)}
                      placeholder="https://example.com"
                      className="w-full px-4 py-3 bg-deep border border-line rounded-lg text-fog placeholder-mist/50 focus:outline-none focus:border-amber focus:ring-1 focus:ring-amber transition-colors font-mono text-sm"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-[12px] font-bold text-mist mb-2 uppercase tracking-wide">
                      Цвет метки
                    </label>
                    <div className="flex gap-3">
                      {['#ffb454', '#46d68c', '#60a5fa', '#f78166', '#a37fff'].map((color) => (
                        <button
                          key={color}
                          onClick={() => setStandColor(color)}
                          className={`w-10 h-10 rounded-lg transition-all ${
                            standColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-panel scale-110' : 'hover:scale-105'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-deep/50 px-6 py-4 sm:flex sm:flex-row-reverse sm:gap-3 border-t border-line">
                <button
                  type="button"
                  onClick={editingCollection ? handleUpdateCollection : handleCreateCollection}
                  disabled={!standName.trim() || !standUrl.trim()}
                  className="w-full inline-flex justify-center rounded-lg bg-amber px-5 py-3 text-[13px] font-extrabold text-[#17211d] shadow-[0_2px_14px_rgba(255,180,84,0.3)] transition-all duration-150 hover:bg-amber2 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 sm:w-auto"
                >
                  {editingCollection ? 'Сохранить' : 'Подключить'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-lg border border-line bg-panel px-5 py-3 text-[13px] font-bold text-mist hover:bg-raised transition-colors sm:mt-0 sm:w-auto"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
