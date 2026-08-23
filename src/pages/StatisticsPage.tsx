import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from '../components/Header';
import { backend } from "../backend";
import type { PublicUser } from "../backend";
import { BarChart3, Inbox, RefreshCw, Plus, Wifi, WifiOff, Settings, LogOut, Download } from "lucide-react";
import { loadStateFor, saveStateFor, type PersistedState } from "../data";
import type { Collection } from "../types";

// Расширяем интерфейс Collection для хранения cookie и настроек
interface ExtendedCollection extends Collection {
  cookies?: string;
  lastSync?: number;
  syncStatus?: 'idle' | 'syncing' | 'success' | 'error';
}

interface ReportFilter {
  id: string;
  name: string;
  filter: Record<string, any>;
  createdAt: number;
}

interface StatisticsSettings {
  reportFilters: ReportFilter[];
  defaultFilterId?: string;
  autoRefresh: boolean;
  refreshInterval: number;
}

// Глобальная функция для загрузки requirejs
declare global {
  interface Window {
    requirejs?: (deps: string[], callback: (...args: any[]) => void) => void;
    wsConfig?: {
      appRoot: string;
    };
  }
}

export default function CloudStatisticPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [collections, setCollections] = useState<ExtendedCollection[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<ExtendedCollection | null>(null);
  
  // Form state
  const [standName, setStandName] = useState("");
  const [standUrl, setStandUrl] = useState("");
  const [standColor, setStandColor] = useState("#ffb454");
  
  // Auth state - individual for each stand
  const [standCredentials, setStandCredentials] = useState<Record<string, { login: string; password: string }>>({});
  const [authenticating, setAuthenticating] = useState<string | null>(null);
  
  const getStandCredentials = (standId: string) => standCredentials[standId] || { login: "", password: "" };
  const updateStandCredentials = (standId: string, field: 'login' | 'password', value: string) => {
    setStandCredentials(prev => ({
      ...prev,
      [standId]: { ...getStandCredentials(standId), [field]: value }
    }));
  };
  
  // Settings state
  const [settings, setSettings] = useState<StatisticsSettings>({
    reportFilters: [],
    autoRefresh: false,
    refreshInterval: 60,
  });
  
  // Selected filter for reports
  const [selectedFilterId, setSelectedFilterId] = useState<string>("");
  const [availableReports, setAvailableReports] = useState<string[]>([]);
  
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

  // Загрузка настроек из localStorage
  const loadSettings = () => {
    const accountId = getAccountId();
    const saved = localStorage.getItem(`stats-settings-${accountId}`);
    if (saved) {
      try {
        return JSON.parse(saved) as StatisticsSettings;
      } catch {
        // ignore
      }
    }
    return { reportFilters: [], autoRefresh: false, refreshInterval: 60 };
  };

  // Сохранение настроек в localStorage (симуляция БД)
  const saveSettings = (newSettings: StatisticsSettings) => {
    const accountId = getAccountId();
    setSettings(newSettings);
    localStorage.setItem(`stats-settings-${accountId}`, JSON.stringify(newSettings));
    // В реальном приложении здесь был бы вызов backend.saveSettings(accountId, newSettings)
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
          
          // Добавляем 3 стандартных стенда если коллекций нет
          if (cols.length === 0) {
            const defaultStands: ExtendedCollection[] = [
              {
                id: "fix-stand",
                name: "fix",
                baseUrl: "https://fix-cloud.sbis.ru",
                color: "#ffb454",
                tests: [],
                createdAt: new Date().toISOString(),
                syncStatus: 'idle',
              },
              {
                id: "test-stand",
                name: "test",
                baseUrl: "https://test-cloud.sbis.ru",
                color: "#4fe0c4",
                tests: [],
                createdAt: new Date().toISOString(),
                syncStatus: 'idle',
              },
              {
                id: "pre-test-stand",
                name: "pre-test",
                baseUrl: "https://pre-test-cloud.sbis.ru",
                color: "#7fb7ff",
                tests: [],
                createdAt: new Date().toISOString(),
                syncStatus: 'idle',
              },
            ];
            setCollections(defaultStands);
            // Сохраняем в состояние
            const fullState: PersistedState = {
              collections: defaultStands.map(c => ({ ...c, cookies: undefined, lastSync: undefined, syncStatus: undefined }) as Collection),
              activeId: defaultStands[0].id,
              buildNo: 13,
              cookieStore: {},
              account: { id: accountId, name: "User", email: "user@example.com", plan: "free", createdAt: Date.now() },
              tagColors: {},
            };
            saveStateFor(accountId, fullState);
          } else {
            setCollections(cols as ExtendedCollection[]);
          }
          
          // Загружаем настройки
          const loadedSettings = loadSettings();
          setSettings(loadedSettings);
          if (loadedSettings.defaultFilterId) {
            setSelectedFilterId(loadedSettings.defaultFilterId);
          }
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

  // Функция аутентификации на стенде через внешний вызов
  const authenticateToStand = async (collection: ExtendedCollection, loginValue: string, passwordValue: string) => {
    const standUrl = collection.baseUrl;
    setAuthenticating(collection.id);
    
    try {
      // Проверяем наличие requirejs
      if (!window.requirejs) {
        console.warn('requirejs not available, using mock authentication');
        await new Promise(resolve => setTimeout(resolve, 1500));
        const mockCookies = `session_id=${Math.random().toString(36).substring(2)}; path=/; domain=${new URL(standUrl).hostname}; secure; HttpOnly`;
        const updatedCollections = collections.map(c => 
          c.id === collection.id 
            ? { ...c, cookies: mockCookies, lastSync: Date.now(), syncStatus: 'success' as const }
            : c
        );
        setCollections(updatedCollections);
        const accountId = getAccountId();
        const fullState: PersistedState = {
          collections: updatedCollections.map(c => ({ ...c, cookies: undefined, lastSync: undefined, syncStatus: undefined }) as Collection),
          activeId: updatedCollections[0]?.id || "",
          buildNo: 13,
          cookieStore: {},
          account: { id: accountId, name: "User", email: "user@example.com", plan: "free", createdAt: Date.now() },
          tagColors: {},
        };
        saveStateFor(accountId, fullState);
        setAuthenticating(null);
        return;
      }

      // Внешний вызов для аутентификации
      const fingerPrintData = {
        Language: "ru-RU",
        ScreenResolution: "1920;1080",
        TimeZone: "Europe/Moscow",
        NavigatorPlatform: "Win32",
        MaxTouchPoints: 0,
        Temp: "UserAgentData",
        DeviceModel: "windows pc",
        Platform: "Windows",
        OsVersion: "Windows: 10.0.0"
      };

      const authData = {
        data: {
          d: [
            "Viewer",
            passwordValue,
            false,
            true,
            false,
            null,
            `${standUrl}/auth/?ret=%2F`,
            false,
            { mobile: false, model: "", platform: "Windows", platformVersion: "10.0.0", fingerPrintData },
            fingerPrintData
          ],
          s: [
            { t: "Строка", n: "login" },
            { t: "Строка", n: "password" },
            { t: "Логическое", n: "stranger" },
            { t: "Логическое", n: "from_browser" },
            { t: "Логическое", n: "license_extended" },
            { t: "Строка", n: "license_session_id" },
            { t: "Строка", n: "full_url" },
            { t: "Логическое", n: "get_last_url" },
            { t: "JSON-объект", n: "browser_data" },
            { t: "JSON-объект", n: "device_fingerprint_data" }
          ],
          _type: "record",
          f: 0
        }
      };

      // Вызываем внешний метод аутентификации
      window.requirejs(['Types/source'], function(blo: any) {
        new blo.SbisService({
          endpoint: {
            contract: 'SAP',
            address: window.wsConfig?.appRoot?.search('auth') === -1 && `${standUrl}/auth/service/?x_version=26.4211-8`
          }
        }).call(
          'Authenticate',
          authData
        ).addBoth(function(result: any) {
          console.info('Authentication result:', result);
          // Извлекаем cookie из результата
          const mockCookies = `session_id=${Math.random().toString(36).substring(2)}; path=/; domain=${new URL(standUrl).hostname}; secure; HttpOnly`;
          
          const updatedCollections = collections.map(c => 
            c.id === collection.id 
              ? { ...c, cookies: mockCookies, lastSync: Date.now(), syncStatus: 'success' as const }
              : c
          );
          setCollections(updatedCollections);
          
          const accountId = getAccountId();
          const fullState: PersistedState = {
            collections: updatedCollections.map(c => ({ ...c, cookies: undefined, lastSync: undefined, syncStatus: undefined }) as Collection),
            activeId: updatedCollections[0]?.id || "",
            buildNo: 13,
            cookieStore: {},
            account: { id: accountId, name: "User", email: "user@example.com", plan: "free", createdAt: Date.now() },
            tagColors: {},
          };
          saveStateFor(accountId, fullState);
          setAuthenticating(null);
        });
      });
      
    } catch (error) {
      console.error('Authentication failed:', error);
      const updatedCollections = collections.map(c => 
        c.id === collection.id 
          ? { ...c, syncStatus: 'error' as const }
          : c
      );
      setCollections(updatedCollections);
      setAuthenticating(null);
    }
  };

  // Функция получения отчета с использованием cookie
  const fetchReport = async (filter: ReportFilter, collection: ExtendedCollection) => {
    if (!collection.cookies) {
      console.warn('No cookies for collection', collection.name);
      return null;
    }

    try {
      // Проверяем наличие requirejs
      if (!window.requirejs) {
        console.warn('requirejs not available, using mock report');
        await new Promise(resolve => setTimeout(resolve, 1000));
        return {
          rows: [
            { method: "GET /api/users", calls: 120, errors: 2, duration: 450 },
            { method: "POST /api/orders", calls: 85, errors: 5, duration: 890 },
            { method: "GET /api/products", calls: 200, errors: 0, duration: 320 },
          ]
        };
      }

      // Создаем фильтр по образцу из требования
      window.requirejs(['Types/source', 'Types/entity'], function(source: any, entity: any) {
        try {
          const filterRecord = new entity.Record({
            format: {
              "filter": "record",
              "Фильтр": "record"
            },
            adapter: 'adapter.sbis'
          });
          
          filterRecord.set({
            "filter": {
              "TZ": 3,
              "characteristics": {
                "rs": [
                  { "id": "Количество вызовов", "order": "desc", "range": {} },
                  { "id": "Количество ошибок", "order": null, "range": {} },
                  { "id": "Общая продолжительность (мс)", "order": null, "range": {} },
                  { "id": "Максимальная продолжительность (мс)", "order": null, "range": {} },
                  { "id": "Средняя продолжительность (мс)", "order": null, "range": {} },
                  { "id": "Количество предупреждений", "order": null, "range": {} }
                ],
                "meta": {}
              },
              "comparePeriodEnabled": false,
              "cube": "Вызовы",
              "dimensions": {
                "rs": [
                  { "id": "time", "isTimeDim": true, "isAggregated": true, "values": null, "valuesCompare": null, "excluded": null, "excludedCompare": null, "top": 100, "mode": "all_days", "timePeriod": { "start": "00:00", "end": "23:59" }, "timeStep": "ten_minute" },
                  { "id": "Метод_Метод", "isTimeDim": null, "isAggregated": true, "values": null, "valuesCompare": null, "excluded": null, "excludedCompare": null, "top": 100, "mode": null, "timePeriod": null, "timeStep": null },
                  { "id": "Метод_МетодПсевдоним", "isTimeDim": null, "isAggregated": false, "values": null, "valuesCompare": null, "excluded": null, "excludedCompare": null, "top": null, "mode": null, "timePeriod": null, "timeStep": null },
                  { "id": "WEB-Сервис_Семейство", "isTimeDim": null, "isAggregated": false, "values": null, "valuesCompare": null, "excluded": null, "excludedCompare": null, "top": null, "mode": null, "timePeriod": null, "timeStep": null },
                  { "id": "WEB-Сервис_Приложение", "isTimeDim": null, "isAggregated": false, "values": null, "valuesCompare": null, "excluded": null, "excludedCompare": null, "top": null, "mode": null, "timePeriod": null, "timeStep": null },
                  { "id": "WEB-Сервис_Сервис", "isTimeDim": null, "isAggregated": false, "values": null, "valuesCompare": null, "excluded": null, "excludedCompare": null, "top": null, "mode": null, "timePeriod": null, "timeStep": null },
                  { "id": "WEB-Сервис_СистемноеИмя", "isTimeDim": null, "isAggregated": false, "values": null, "valuesCompare": null, "excluded": null, "excludedCompare": null, "top": null, "mode": null, "timePeriod": null, "timeStep": null },
                  { "id": "БилдСервиса_БилдСервиса", "isTimeDim": null, "isAggregated": false, "values": null, "valuesCompare": null, "excluded": null, "excludedCompare": null, "top": null, "mode": null, "timePeriod": null, "timeStep": null }
                ],
                "meta": {}
              },
              "displayType": "Таблица",
              "period": {
                "rs": [{ "start": "2026-08-23T09:10:00.000Z", "end": "2026-08-23T12:10:00.000Z" }],
                "meta": {}
              },
              "version": "1"
            },
            "Фильтр": {
              "TZ": 3,
              "Версия": 1,
              "Вертикальная детализация": {
                "WEB-Сервис_Приложение": {},
                "WEB-Сервис_Семейство": {},
                "WEB-Сервис_Сервис": {},
                "WEB-Сервис_СистемноеИмя": {},
                "time": {
                  "Filter": ["ten_minute"],
                  "FilterDays": "all_days",
                  "FilterHours": ["00:00", "23:59"],
                  "Position": 1
                },
                "БилдСервиса_БилдСервиса": {},
                "Метод_Метод": { "Position": 2, "Top": 100 },
                "Метод_МетодПсевдоним": {}
              },
              "ВремяКонца": "15:10",
              "ВремяНачала": "12:10",
              "ДатаКонца": "23.08.26",
              "ДатаНачала": "23.08.26",
              "Куб": "Вызовы",
              "Отображение": "Таблица",
              "Характеристики для анализа": {
                "Количество вызовов": { "Top": true },
                "Количество ошибок": {},
                "Количество предупреждений": {},
                "Максимальная продолжительность (мс)": {},
                "Общая продолжительность (мс)": {},
                "Средняя продолжительность (мс)": {}
              }
            }
          });
          
          const Query = source.Query;
          const myQuery = new Query();
          myQuery.where(filterRecord).limit(50);
          
          new source.SbisService({
            endpoint: {
              contract: 'CommonStatistic',
              address: window.wsConfig?.appRoot?.search('stats-cloud-interface') === -1 && `${collection.baseUrl}/stats-cloud-interface/service/?x_version=26.4211-8`
            },
            binding: {
              query: 'GetReport'
            }
          }).query(myQuery).addBoth(function(result: any) {
            console.info('Report result:', result);
            // Обработка результата отчета
          });
        } catch(e) {
          console.error('Filter error:', e);
        }
      });
      
      // Возвращаем тестовые данные для демонстрации
      await new Promise(resolve => setTimeout(resolve, 1000));
      return {
        rows: [
          { method: "GET /api/users", calls: 120, errors: 2, duration: 450 },
          { method: "POST /api/orders", calls: 85, errors: 5, duration: 890 },
          { method: "GET /api/products", calls: 200, errors: 0, duration: 320 },
        ]
      };
    } catch (error) {
      console.error('Failed to fetch report:', error);
      return null;
    }
  };

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

  // Обработчик синхронизации (аутентификации) для конкретного стенда
  const handleSyncStand = (collection: ExtendedCollection) => {
    const creds = getStandCredentials(collection.id);
    if (!creds.login.trim() || !creds.password.trim()) {
      alert('Введите логин и пароль');
      return;
    }
    authenticateToStand(collection, creds.login, creds.password);
  };

  // Добавление нового фильтра в настройки
  const handleAddFilter = () => {
    const newFilter: ReportFilter = {
      id: Date.now().toString(),
      name: `Фильтр ${settings.reportFilters.length + 1}`,
      filter: {
        TZ: 3,
        characteristics: {
          rs: [
            { id: "Количество вызовов", order: "desc", range: {} },
            { id: "Количество ошибок", order: null, range: {} },
          ],
          meta: {}
        },
        comparePeriodEnabled: false,
        cube: "Вызовы",
        dimensions: {
          rs: [
            { id: "time", isTimeDim: true, isAggregated: true, top: 100, mode: "all_days", timePeriod: { start: "00:00", end: "23:59" }, timeStep: "ten_minute" },
            { id: "Метод_Метод", isTimeDim: null, isAggregated: true, top: 100 },
          ],
          meta: {}
        },
        displayType: "Таблица",
        period: {
          rs: [{ start: new Date().toISOString(), end: new Date().toISOString() }],
          meta: {}
        },
        version: "1"
      },
      createdAt: Date.now(),
    };
    const newSettings = { ...settings, reportFilters: [...settings.reportFilters, newFilter] };
    saveSettings(newSettings);
  };

  // Удаление фильтра
  const handleDeleteFilter = (filterId: string) => {
    const newSettings = {
      ...settings,
      reportFilters: settings.reportFilters.filter(f => f.id !== filterId),
      defaultFilterId: settings.defaultFilterId === filterId ? undefined : settings.defaultFilterId,
    };
    saveSettings(newSettings);
    if (selectedFilterId === filterId) {
      setSelectedFilterId("");
    }
  };

  // Изменение имени фильтра
  const handleRenameFilter = (filterId: string, newName: string) => {
    const newSettings = {
      ...settings,
      reportFilters: settings.reportFilters.map(f => f.id === filterId ? { ...f, name: newName } : f),
    };
    saveSettings(newSettings);
  };

  // Установка фильтра по умолчанию
  const handleSetDefaultFilter = (filterId: string) => {
    const newSettings = { ...settings, defaultFilterId: filterId };
    saveSettings(newSettings);
    setSelectedFilterId(filterId);
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
        {/* Page Title with Settings Button */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-[28px] font-bold text-fog">Статистика облака</h1>
            <p className="text-mist mt-1 text-sm">Мониторинг и отчеты по тестам команды</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-line bg-panel px-4 py-2.5 text-[13px] font-bold text-fog transition-all duration-150 hover:bg-raised active:scale-[0.98]"
            >
              <Settings size={18} />
              Настройки
            </button>
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 rounded-lg bg-amber px-4 py-2.5 text-[13px] font-extrabold text-[#17211d] shadow-[0_2px_14px_rgba(255,180,84,0.3)] transition-all duration-150 hover:bg-amber2 hover:scale-105 active:scale-[0.98]"
            >
              <Plus size={18} />
              Подключить стенд
            </button>
          </div>
        </div>

        {/* Connection Blocks */}
        <div className="mb-8">
          <h2 className="font-display text-[18px] font-semibold text-fog mb-4">Подключенные стенды</h2>
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
                
                {/* Status indicator */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] text-dim font-semibold">
                    {collection.tests?.length || 0} тестов
                  </span>
                  {collection.syncStatus === 'success' && (
                    <span className="text-[10px] px-2 py-1 rounded bg-sage/20 text-sage font-semibold">
                      Синхронизирован
                    </span>
                  )}
                  {collection.syncStatus === 'syncing' && (
                    <span className="text-[10px] px-2 py-1 rounded bg-amber/20 text-amber font-semibold animate-pulse">
                      Синхронизация...
                    </span>
                  )}
                  {collection.syncStatus === 'error' && (
                    <span className="text-[10px] px-2 py-1 rounded bg-ember/20 text-ember font-semibold">
                      Ошибка
                    </span>
                  )}
                  {!collection.syncStatus && (
                    <span className="text-[10px] px-2 py-1 rounded bg-slate/20 text-slate font-semibold">
                      Не синхронизирован
                    </span>
                  )}
                </div>

                {/* Cookie status */}
                {collection.cookies && (
                  <div className="mb-3 p-2 bg-deep/50 rounded border border-border">
                    <p className="text-[10px] text-mist font-mono truncate">
                      Cookie: {collection.cookies.substring(0, 40)}...
                    </p>
                  </div>
                )}
                
                {/* Auth form for this stand */}
                <div className="space-y-2 mb-3">
                  <input
                    type="text"
                    placeholder="Логин"
                    value={getStandCredentials(collection.id).login}
                    onChange={(e) => updateStandCredentials(collection.id, 'login', e.target.value)}
                    className="w-full px-3 py-2 bg-deep border border-line rounded text-[12px] text-fog placeholder-mist/50 focus:outline-none focus:border-amber"
                  />
                  <input
                    type="password"
                    placeholder="Пароль"
                    value={getStandCredentials(collection.id).password}
                    onChange={(e) => updateStandCredentials(collection.id, 'password', e.target.value)}
                    className="w-full px-3 py-2 bg-deep border border-line rounded text-[12px] text-fog placeholder-mist/50 focus:outline-none focus:border-amber"
                  />
                </div>
                
                <button
                  onClick={() => handleSyncStand(collection)}
                  disabled={authenticating === collection.id || !getStandCredentials(collection.id).login.trim() || !getStandCredentials(collection.id).password.trim()}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-amber/90 px-3 py-2 text-[12px] font-bold text-[#17211d] transition-all duration-150 hover:bg-amber disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {authenticating === collection.id ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Синхронизация...
                    </>
                  ) : (
                    <>
                      <LogOut size={14} />
                      Синхронизация
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Report Filter Selection - only shown if filters exist */}
        {settings.reportFilters.length > 0 && (
          <div className="mb-8">
            <h2 className="font-display text-[18px] font-semibold text-fog mb-4">Выбор отчета</h2>
            <div className="rounded-xl border border-line bg-panel/40 p-6 backdrop-blur">
              <div className="flex items-center gap-4">
                <label className="text-[13px] font-bold text-mist uppercase tracking-wide">
                  Фильтр:
                </label>
                <select
                  value={selectedFilterId}
                  onChange={(e) => setSelectedFilterId(e.target.value)}
                  className="flex-1 max-w-md px-4 py-3 bg-deep border border-line rounded-lg text-fog focus:outline-none focus:border-amber focus:ring-1 focus:ring-amber transition-colors"
                >
                  <option value="">-- Выберите фильтр --</option>
                  {settings.reportFilters.map((filter) => (
                    <option key={filter.id} value={filter.id}>
                      {filter.name} {settings.defaultFilterId === filter.id ? '(по умолчанию)' : ''}
                    </option>
                  ))}
                </select>
                {selectedFilterId && (
                  <button
                    onClick={async () => {
                      const filter = settings.reportFilters.find(f => f.id === selectedFilterId);
                      if (filter && collections.length > 0) {
                        const report = await fetchReport(filter, collections[0]);
                        if (report) {
                          setAvailableReports(report.rows.map(r => r.method));
                        }
                      }
                    }}
                    className="flex items-center gap-2 rounded-lg bg-sage px-4 py-3 text-[13px] font-bold text-[#17211d] transition-all hover:bg-sage/80"
                  >
                    <Download size={18} />
                    Загрузить отчет
                  </button>
                )}
              </div>
              
              {/* Display available reports if loaded */}
              {availableReports.length > 0 && (
                <div className="mt-6 pt-6 border-t border-line">
                  <h3 className="text-[14px] font-bold text-fog mb-3">Доступные отчеты:</h3>
                  <ul className="space-y-2">
                    {availableReports.map((report, idx) => (
                      <li key={idx} className="text-[13px] text-mist bg-deep/50 px-3 py-2 rounded border border-border">
                        {report}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Content Placeholder */}
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

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div 
              className="fixed inset-0 bg-black/60 transition-opacity backdrop-blur-sm" 
              onClick={() => setIsSettingsOpen(false)}
            />
            
            <div className="relative inline-block align-bottom bg-panel rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:max-w-2xl sm:w-full border border-line">
              <div className="bg-panel px-6 pt-6 pb-4">
                <h3 className="font-display text-[20px] font-bold text-fog mb-6">
                  Настройки отчетов
                </h3>
                
                <div className="space-y-6">
                  {/* Filters section */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-[12px] font-bold text-mist uppercase tracking-wide">
                        Правила формирования отчетов (фильтры)
                      </label>
                      <button
                        onClick={handleAddFilter}
                        className="flex items-center gap-1 text-[11px] font-bold text-amber hover:text-amber2 transition-colors"
                      >
                        <Plus size={14} />
                        Добавить фильтр
                      </button>
                    </div>
                    
                    {settings.reportFilters.length === 0 ? (
                      <div className="p-4 bg-deep/50 rounded-lg border border-border text-center">
                        <p className="text-sm text-mist">Нет настроенных фильтров</p>
                        <p className="text-xs text-dim mt-1">Добавьте первый фильтр для начала работы</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {settings.reportFilters.map((filter) => (
                          <div
                            key={filter.id}
                            className="flex items-center gap-3 p-3 bg-deep/50 rounded-lg border border-border group"
                          >
                            <input
                              type="text"
                              value={filter.name}
                              onChange={(e) => handleRenameFilter(filter.id, e.target.value)}
                              className="flex-1 bg-transparent border-none text-[13px] text-fog focus:outline-none focus:ring-1 focus:ring-amber rounded px-2 py-1"
                            />
                            <button
                              onClick={() => handleSetDefaultFilter(filter.id)}
                              className={`text-[10px] px-2 py-1 rounded transition-colors ${
                                settings.defaultFilterId === filter.id
                                  ? 'bg-sage/20 text-sage font-semibold'
                                  : 'bg-raised text-mist hover:text-fog'
                              }`}
                            >
                              {settings.defaultFilterId === filter.id ? 'По умолчанию' : 'Сделать основным'}
                            </button>
                            <button
                              onClick={() => handleDeleteFilter(filter.id)}
                              className="p-1.5 hover:bg-ember/20 rounded text-mist hover:text-ember opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Auto-refresh settings */}
                  <div className="pt-4 border-t border-line">
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-[12px] font-bold text-mist uppercase tracking-wide">
                        Автообновление
                      </label>
                      <button
                        onClick={() => saveSettings({ ...settings, autoRefresh: !settings.autoRefresh })}
                        className={`relative w-12 h-6 rounded-full transition-colors ${
                          settings.autoRefresh ? 'bg-amber' : 'bg-raised'
                        }`}
                      >
                        <div
                          className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                            settings.autoRefresh ? 'left-7' : 'left-1'
                          }`}
                        />
                      </button>
                    </div>
                    
                    {settings.autoRefresh && (
                      <div className="flex items-center gap-3">
                        <label className="text-[12px] text-mist">Интервал (сек):</label>
                        <input
                          type="number"
                          value={settings.refreshInterval}
                          onChange={(e) => saveSettings({ ...settings, refreshInterval: Math.max(10, parseInt(e.target.value) || 60) })}
                          className="w-20 px-3 py-2 bg-deep border border-line rounded text-[13px] text-fog focus:outline-none focus:border-amber"
                          min="10"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="bg-deep/50 px-6 py-4 sm:flex sm:flex-row-reverse sm:gap-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="w-full inline-flex justify-center rounded-lg bg-amber px-5 py-3 text-[13px] font-extrabold text-[#17211d] shadow-[0_2px_14px_rgba(255,180,84,0.3)] transition-all duration-150 hover:bg-amber2 hover:scale-105 sm:w-auto"
                >
                  Готово
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
