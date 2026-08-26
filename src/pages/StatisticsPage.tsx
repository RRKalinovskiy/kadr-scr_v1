import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from '../components/Header';
import { backend } from "../backend";
import type { PublicUser } from "../backend";
import { BarChart3, Inbox, RefreshCw, Settings, LogOut, Download, Plus, Eye, EyeOff } from "lucide-react";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ReportTable from "../components/ReportTable";
import {
  authenticateStand,
  checkStandSession,
  fetchStandReport,
  formatCell,
  type ReportFilter,
  type ReportTableData,
} from "../statsCloud";

interface SavedReport {
  id: string;
  filterId: string;
  filterName: string;
  createdAt: number;
  createdBy: string;
  filterJson: string;
  standData: Record<string, ReportTableData>;
}

interface StatisticsSettings {
  reportFilters: ReportFilter[];
  defaultFilterId?: string;
  autoRefresh: boolean;
  refreshInterval: number;
}

interface StandCredentials {
  login: string;
  password: string;
}

interface StandState {
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  cookies?: string;
  lastSync?: number;
  errorMessage?: string;
}

declare global {
  interface Window {
    requirejs?: (deps: string[], callback: (...args: any[]) => void) => void;
    wsConfig?: {
      appRoot: string;
    };
  }
}

const FIXED_STANDS = [
  { id: "fix-stand", name: "fix", baseUrl: "https://fix-cloud.sbis.ru", color: "#ffb454" },
  { id: "test-stand", name: "test", baseUrl: "https://test-cloud.sbis.ru", color: "#4fe0c4" },
  { id: "pre-test-stand", name: "pre-test", baseUrl: "https://pre-test-cloud.sbis.ru", color: "#7fb7ff" },
];

export default function CloudStatisticPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [standCredentials, setStandCredentials] = useState<Record<string, StandCredentials>>({});
  const [standStates, setStandStates] = useState<Record<string, StandState>>({});
  const [authenticating, setAuthenticating] = useState<string | null>(null);
  const [passwordVisible, setPasswordVisible] = useState<Record<string, boolean>>({});
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Settings state
  const [settings, setSettings] = useState<StatisticsSettings>({
    reportFilters: [],
    autoRefresh: false,
    refreshInterval: 60,
  });
  
  // Saved reports list
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<SavedReport | null>(null);
  const [currentStandView, setCurrentStandView] = useState<string>("fix-stand"); // Текущий выбранный стенд для просмотра
  
  // Selected filter for reports
  const [selectedFilterId, setSelectedFilterId] = useState<string>("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  
  const getAccountId = (): string => user?.accountId ?? "default";

  const getStandCredentials = (standId: string): StandCredentials => standCredentials[standId] || { login: "", password: "" };
  
  const updateStandCredentials = (standId: string, field: 'login' | 'password', value: string) => {
    setStandCredentials(prev => ({
      ...prev,
      [standId]: { ...getStandCredentials(standId), [field]: value }
    }));
  };

  const getStandState = (standId: string): StandState => standStates[standId] || { syncStatus: 'idle' };
  
  const updateStandState = (standId: string, updates: Partial<StandState>) => {
    setStandStates(prev => ({
      ...prev,
      [standId]: { ...getStandState(standId), ...updates }
    }));
  };

  const togglePasswordVisibility = (standId: string) => {
    setPasswordVisible(prev => ({
      ...prev,
      [standId]: !prev[standId]
    }));
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

  // Загрузка сохраненных отчетов
  const loadSavedReports = () => {
    const accountId = getAccountId();
    const saved = localStorage.getItem(`stats-reports-${accountId}`);
    if (saved) {
      try {
        return JSON.parse(saved) as SavedReport[];
      } catch {
        // ignore
      }
    }
    return [];
  };

  // Сохранение отчета
  const saveReport = (report: SavedReport) => {
    const accountId = getAccountId();
    const reports = loadSavedReports();
    reports.unshift(report); // Add to beginning
    localStorage.setItem(`stats-reports-${accountId}`, JSON.stringify(reports));
    setSavedReports(reports);
  };

  // Формирование ссылки на отчет
  const generateReportLink = (filterJson: string, standUrl: string): string => {
    try {
      const filterObj = JSON.parse(filterJson);
      const encodedFilter = encodeURIComponent(JSON.stringify(filterObj));
      return `${standUrl}/page/statistics-new?filter=${encodedFilter}`;
    } catch {
      return standUrl;
    }
  };

  // Копирование ссылки в буфер обмена
  const handleShareReport = (report: SavedReport) => {
    const stand = FIXED_STANDS.find(s => s.id === currentStandView) || FIXED_STANDS[0];
    const link = generateReportLink(report.filterJson, stand.baseUrl);
    navigator.clipboard.writeText(link).then(() => {
      alert('Ссылка скопирована в буфер обмена');
    }).catch(() => {
      alert('Не удалось скопировать ссылку');
    });
  };

  // Скачивание отчета в PDF
  const handleDownloadReport = (report: SavedReport) => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`Отчет: ${report.filterName}`, 14, 20);
    doc.setFontSize(11);
    const standMeta = FIXED_STANDS.find(s => s.id === currentStandView);
    const standLabel = standMeta?.name ?? currentStandView;
    doc.text(`Стенд: ${standLabel}`, 14, 30);
    doc.text(`Дата формирования: ${new Date(report.createdAt).toLocaleString('ru-RU')}`, 14, 36);

    const standData = report.standData[currentStandView];
    const rows = standData?.rows || [];
    const columns = standData?.columns?.length ? standData.columns : (rows[0] ? Object.keys(rows[0]) : []);
    const tableRows = rows.map((row) => columns.map((c) => formatCell(row[c])));

    autoTable(doc, {
      head: [columns],
      body: tableRows,
      startY: 45,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [245, 158, 11], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });

    doc.save(`Otchet_${report.filterName}_${standLabel}.pdf`);
  };

  useEffect(() => {
    backend.restore().then(async (result) => {
      if (result && result.user) {
        setUser(result.user);
        const accountId = result.user.accountId;
        const loadedSettings = (() => {
          const saved = localStorage.getItem(`stats-settings-${accountId}`);
          if (saved) {
            try { return JSON.parse(saved) as StatisticsSettings; } catch { /* ignore */ }
          }
          return { reportFilters: [], autoRefresh: false, refreshInterval: 60 };
        })();
        setSettings(loadedSettings);
        if (loadedSettings.defaultFilterId) {
          setSelectedFilterId(loadedSettings.defaultFilterId);
        }

        try {
          const savedCredentials = localStorage.getItem(`stats-credentials-${accountId}`);
          if (savedCredentials) setStandCredentials(JSON.parse(savedCredentials));
          const savedReportsRaw = localStorage.getItem(`stats-reports-${accountId}`);
          if (savedReportsRaw) setSavedReports(JSON.parse(savedReportsRaw) as SavedReport[]);
        } catch (e) {
          console.error('Failed to load stand data:', e);
        }

        const nextStates: Record<string, StandState> = {};
        await Promise.all(FIXED_STANDS.map(async (stand) => {
          const has = await checkStandSession(stand.id);
          nextStates[stand.id] = has
            ? { syncStatus: 'success', cookies: 'db' }
            : { syncStatus: 'idle' };
        }));
        setStandStates(nextStates);

        setLoading(false);
      } else {
        navigate("/auth");
      }
    }).catch(() => {
      navigate("/auth");
    });
  }, [navigate]);

  // Функция аутентификации на стенде через внешний вызов
  const authenticateToStand = async (standId: string, standUrl: string, loginValue: string, passwordValue: string) => {
    setAuthenticating(standId);
    updateStandState(standId, { syncStatus: 'syncing', errorMessage: undefined });
    try {
      const res = await authenticateStand(standId, standUrl, loginValue, passwordValue);
      updateStandState(standId, {
        cookies: res.cookiePreview || 'db',
        lastSync: Date.now(),
        syncStatus: 'success',
        errorMessage: undefined,
      });
      const accountId = getAccountId();
      localStorage.setItem(`stats-credentials-${accountId}`, JSON.stringify({
        ...standCredentials,
        [standId]: { login: loginValue, password: passwordValue },
      }));
    } catch (error) {
      console.error('Authentication failed:', error);
      updateStandState(standId, {
        syncStatus: 'error',
        cookies: undefined,
        errorMessage: error instanceof Error ? error.message : 'Ошибка авторизации',
      });
    } finally {
      setAuthenticating(null);
    }
  };

  // Функция получения отчета с использованием cookie (удалена, используется fetchReportForStand)
  
  // Загрузка отчетов по всем стендам
  const handleLoadAllReports = async () => {
    if (!selectedFilterId) return;
    const filter = settings.reportFilters.find(f => f.id === selectedFilterId);
    if (!filter) return;
    if (!filter.filterJson.trim()) {
      setReportError('Вставьте JSON фильтра (CommonStatistic.GetReport) в настройках');
      return;
    }

    setReportLoading(true);
    setReportError(null);

    const standData: Record<string, ReportTableData> = {};
    try {
      for (const stand of FIXED_STANDS) {
        const standState = getStandState(stand.id);
        if (standState.syncStatus !== 'success') {
          standData[stand.id] = { columns: [], rows: [], error: 'Не синхронизирован. Выполните SAP.Authenticate.' };
          continue;
        }
        try {
          standData[stand.id] = await fetchStandReport(stand.id, stand.baseUrl, filter);
        } catch (e) {
          const err = e as Error & { needAuth?: boolean };
          if (err.needAuth) {
            updateStandState(stand.id, { syncStatus: 'idle', cookies: undefined, errorMessage: err.message });
          }
          standData[stand.id] = { columns: [], rows: [], error: err.message };
        }
      }

      const savedReport: SavedReport = {
        id: Date.now().toString(),
        filterId: filter.id,
        filterName: filter.name,
        createdAt: Date.now(),
        createdBy: user?.name || user?.email || getAccountId(),
        filterJson: filter.filterJson,
        standData,
      };
      saveReport(savedReport);
      setSelectedReport(savedReport);
      setCurrentStandView(FIXED_STANDS[0].id);
    } catch (error) {
      console.error('Error loading reports:', error);
      setReportError('Ошибка при загрузке отчетов: ' + (error as Error).message);
    } finally {
      setReportLoading(false);
    }
  };

  const handleSyncStand = (standId: string, standUrl: string) => {
    const creds = getStandCredentials(standId);
    if (!creds.login.trim() || !creds.password.trim()) {
      alert('Введите логин и пароль');
      return;
    }
    authenticateToStand(standId, standUrl, creds.login, creds.password);
  };

  // Добавление нового фильтра в настройки
  const handleAddFilter = () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const dateStart = today.toISOString().split('T')[0];
    const dateEnd = tomorrow.toISOString().split('T')[0];
    
    const newFilter: ReportFilter = {
      id: Date.now().toString(),
      name: `Фильтр ${settings.reportFilters.length + 1}`,
      filterJson: '',
      dateStart,
      dateEnd,
      timeStart: '00:00',
      timeEnd: '23:59',
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

  // Изменение JSON фильтра
  const handleUpdateFilterJson = (filterId: string, newJson: string) => {
    const newSettings = {
      ...settings,
      reportFilters: settings.reportFilters.map(f => f.id === filterId ? { ...f, filterJson: newJson } : f),
    };
    saveSettings(newSettings);
  };

  // Изменение даты начала
  const handleUpdateFilterDateStart = (filterId: string, value: string) => {
    const newSettings = {
      ...settings,
      reportFilters: settings.reportFilters.map(f => f.id === filterId ? { ...f, dateStart: value } : f),
    };
    saveSettings(newSettings);
  };

  // Изменение даты конца
  const handleUpdateFilterDateEnd = (filterId: string, value: string) => {
    const newSettings = {
      ...settings,
      reportFilters: settings.reportFilters.map(f => f.id === filterId ? { ...f, dateEnd: value } : f),
    };
    saveSettings(newSettings);
  };

  // Изменение времени начала
  const handleUpdateFilterTimeStart = (filterId: string, value: string) => {
    const newSettings = {
      ...settings,
      reportFilters: settings.reportFilters.map(f => f.id === filterId ? { ...f, timeStart: value } : f),
    };
    saveSettings(newSettings);
  };

  // Изменение времени конца
  const handleUpdateFilterTimeEnd = (filterId: string, value: string) => {
    const newSettings = {
      ...settings,
      reportFilters: settings.reportFilters.map(f => f.id === filterId ? { ...f, timeEnd: value } : f),
    };
    saveSettings(newSettings);
  };

  // Актуализация фильтра с датами и временем
  const actualizeFilter = (filter: ReportFilter): any => {
    try {
      let filterObj = {};
      if (filter.filterJson) {
        filterObj = JSON.parse(filter.filterJson);
      } else {
        // Шаблон по умолчанию
        filterObj = {
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
                { "id": "Метод_Метод", "isTimeDim": null, "isAggregated": true, "values": null, "valuesCompare": null, "excluded": null, "excludedCompare": null, "top": 100, "mode": null, "timePeriod": null, "timeStep": null }
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
            "Вертикальная детализация": {},
            "Куб": "Вызовы",
            "Отображение": "Таблица"
          }
        };
      }

      // Обновляем period и timePeriod из значений формы
      const dateStart = filter.dateStart || '2026-08-23';
      const dateEnd = filter.dateEnd || '2026-08-23';
      const timeStart = filter.timeStart || '00:00';
      const timeEnd = filter.timeEnd || '23:59';

      // Формируем ISO даты для period
      const startDateTime = `${dateStart}T${timeStart}:00.000Z`;
      const endDateTime = `${dateEnd}T${timeEnd}:00.000Z`;

      // Обновляем period в filter.filter
      if (filterObj.filter && filterObj.filter.period) {
        filterObj.filter.period.rs = [{ start: startDateTime, end: endDateTime }];
      }

      // Обновляем timePeriod в dimensions
      if (filterObj.filter && filterObj.filter.dimensions && filterObj.filter.dimensions.rs) {
        const timeDim = filterObj.filter.dimensions.rs.find((d: any) => d.id === 'time');
        if (timeDim && timeDim.timePeriod) {
          timeDim.timePeriod.start = timeStart;
          timeDim.timePeriod.end = timeEnd;
        }
      }

      // Обновляем даты в Фильтр
      if (filterObj.Фильтр) {
        const [y1, m1, d1] = dateStart.split('-');
        const [y2, m2, d2] = dateEnd.split('-');
        filterObj.Фильтр.ДатаНачала = `${d1}.${m1}.${y1.slice(-2)}`;
        filterObj.Фильтр.ДатаКонца = `${d2}.${m2}.${y2.slice(-2)}`;
        filterObj.Фильтр.ВремяНачала = timeStart;
        filterObj.Фильтр.ВремяКонца = timeEnd;
        
        // Обновляем период в вертикальной детализации
        if (filterObj.Фильтр['Вертикальная детализация'] && filterObj.Фильтр['Вертикальная детализация'].time) {
          filterObj.Фильтр['Вертикальная детализация'].time.FilterHours = [timeStart, timeEnd];
        }
      }

      return filterObj;
    } catch (e) {
      console.error('Error actualizing filter:', e);
      return null;
    }
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
          </div>
        </div>

        {/* Fixed Stands Blocks */}
        <div className="mb-8">
          <h2 className="font-display text-[18px] font-semibold text-fog mb-4">Стенды</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FIXED_STANDS.map((stand) => {
              const state = getStandState(stand.id);
              return (
                <div
                  key={stand.id}
                  className="group rounded-xl border border-line bg-panel/60 p-5 transition-all duration-200 hover:bg-panel/80 hover:shadow-[0_10px_40px_rgba(0,0,0,0.3)]"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: stand.color }}
                      />
                      <h3 className="font-display text-[16px] font-bold text-fog">{stand.name}</h3>
                    </div>
                  </div>
                  <p className="text-xs text-mist font-mono bg-deep/50 p-2 rounded border border-border truncate mb-3">
                    {stand.baseUrl}
                  </p>
                  
                  {/* Status indicator */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] text-dim font-semibold">
                      Стенд
                    </span>
                    {state.syncStatus === 'success' && (
                      <span className="text-[10px] px-2 py-1 rounded bg-sage/20 text-sage font-semibold">
                        Синхронизирован
                      </span>
                    )}
                    {state.syncStatus === 'syncing' && (
                      <span className="text-[10px] px-2 py-1 rounded bg-amber/20 text-amber font-semibold animate-pulse">
                        Синхронизация...
                      </span>
                    )}
                    {state.syncStatus === 'error' && (
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] px-2 py-1 rounded bg-ember/20 text-ember font-semibold">
                          Ошибка
                        </span>
                        {state.errorMessage && (
                          <span className="text-[10px] text-ember break-all">
                            {state.errorMessage}
                          </span>
                        )}
                      </div>
                    )}
                    {!state.syncStatus || state.syncStatus === 'idle' && (
                      <span className="text-[10px] px-2 py-1 rounded bg-slate/20 text-slate font-semibold">
                        Не синхронизирован
                      </span>
                    )}
                  </div>

                  {/* Cookie status */}
                  {state.syncStatus === 'success' && (
                    <div className="mb-3 p-2 bg-deep/50 rounded border border-border">
                      <p className="text-[10px] text-sage font-semibold">
                        Cookie сессии сохранены в БД и будут использованы в GetReport
                      </p>
                    </div>
                  )}
                  
                  {/* Auth form for this stand */}
                  <div className="space-y-2 mb-3">
                    <input
                      type="text"
                      placeholder="Логин"
                      value={getStandCredentials(stand.id).login}
                      onChange={(e) => updateStandCredentials(stand.id, 'login', e.target.value)}
                      className="w-full px-3 py-2 bg-deep border border-line rounded text-[12px] text-fog placeholder-mist/50 focus:outline-none focus:border-amber"
                    />
                    <div className="relative">
                      <input
                        type={passwordVisible[stand.id] ? "text" : "password"}
                        placeholder="Пароль"
                        value={getStandCredentials(stand.id).password}
                        onChange={(e) => updateStandCredentials(stand.id, 'password', e.target.value)}
                        className="w-full px-3 py-2 bg-deep border border-line rounded text-[12px] text-fog placeholder-mist/50 focus:outline-none focus:border-amber pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility(stand.id)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-mist/50 hover:text-fog transition-colors"
                      >
                        {passwordVisible[stand.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleSyncStand(stand.id, stand.baseUrl)}
                    disabled={authenticating === stand.id || !getStandCredentials(stand.id).login.trim() || !getStandCredentials(stand.id).password.trim()}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-amber/90 px-3 py-2 text-[12px] font-bold text-[#17211d] transition-all duration-150 hover:bg-amber disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {authenticating === stand.id ? (
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
              );
            })}
          </div>
        </div>

        {/* Report Filter Selection - only shown if filters exist */}
        {settings.reportFilters.length > 0 && (
          <div className="mb-8">
            <h2 className="font-display text-[18px] font-semibold text-fog mb-4">Выбор отчета</h2>
            <div className="rounded-xl border border-line bg-panel/40 p-6 backdrop-blur">
              <div className="flex flex-wrap items-center gap-4">
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
                  <div className="flex flex-wrap items-end gap-3">
                    {(() => {
                      const f = settings.reportFilters.find(x => x.id === selectedFilterId);
                      if (!f) return null;
                      return (
                        <>
                          <label className="text-[11px] text-mist">
                            С
                            <input type="date" value={f.dateStart || ''} onChange={(e) => handleUpdateFilterDateStart(f.id, e.target.value)}
                              className="ml-1 px-2 py-1 bg-deep border border-line rounded text-fog" />
                          </label>
                          <input type="time" value={f.timeStart || '00:00'} onChange={(e) => handleUpdateFilterTimeStart(f.id, e.target.value)}
                            className="px-2 py-1 bg-deep border border-line rounded text-fog" />
                          <label className="text-[11px] text-mist">
                            По
                            <input type="date" value={f.dateEnd || ''} onChange={(e) => handleUpdateFilterDateEnd(f.id, e.target.value)}
                              className="ml-1 px-2 py-1 bg-deep border border-line rounded text-fog" />
                          </label>
                          <input type="time" value={f.timeEnd || '23:59'} onChange={(e) => handleUpdateFilterTimeEnd(f.id, e.target.value)}
                            className="px-2 py-1 bg-deep border border-line rounded text-fog" />
                        </>
                      );
                    })()}
                    <button
                      onClick={() => { void handleLoadAllReports(); }}
                      disabled={reportLoading}
                      className="flex items-center gap-2 rounded-lg bg-sage px-4 py-3 text-[13px] font-bold text-[#17211d] transition-all hover:bg-sage/80 disabled:opacity-50"
                    >
                      {reportLoading ? (
                        <><RefreshCw size={18} className="animate-spin" />Загрузка GetReport…</>
                      ) : (
                        <><Download size={18} />Загрузить таблицу отчёта</>
                      )}
                    </button>
                  </div>
                )}
              </div>
              
              {/* Error message */}
              {reportError && (
                <div className="mt-4 p-3 bg-ember/20 border border-ember rounded-lg text-ember text-sm">
                  {reportError}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Saved Reports List */}
        {savedReports.length > 0 && !selectedReport && (
          <div className="mb-8">
            <h2 className="font-display text-[18px] font-semibold text-fog mb-4">Сохраненные отчеты</h2>
            <div className="rounded-xl border border-line bg-panel/40 backdrop-blur overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-deep/50 border-b border-line">
                  <tr>
                    <th className="px-4 py-3 text-[12px] font-bold text-mist uppercase tracking-wide">Название отчета</th>
                    <th className="px-4 py-3 text-[12px] font-bold text-mist uppercase tracking-wide">Дата получения</th>
                    <th className="px-4 py-3 text-[12px] font-bold text-mist uppercase tracking-wide">Пользователь</th>
                    <th className="px-4 py-3 text-[12px] font-bold text-mist uppercase tracking-wide text-right">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {savedReports.map((report) => (
                    <tr 
                      key={report.id} 
                      className="border-b border-line hover:bg-panel/60 cursor-pointer transition-colors"
                      onClick={() => {
                        setSelectedReport(report);
                        setCurrentStandView(FIXED_STANDS[0].id);
                      }}
                    >
                      <td className="px-4 py-3 text-[13px] text-fog font-medium">{report.filterName}</td>
                      <td className="px-4 py-3 text-[13px] text-mist">
                        {new Date(report.createdAt).toLocaleString('ru-RU')}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-mist">{report.createdBy}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShareReport(report);
                          }}
                          className="text-[11px] px-2 py-1 rounded bg-amber/20 text-amber font-semibold hover:bg-amber/30 transition-colors mr-2"
                        >
                          Поделиться
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Selected Report Detail View with Stand Switcher */}
        {selectedReport && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedReport(null)}
                  className="flex items-center gap-2 text-[13px] text-mist hover:text-fog transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 12H5M12 19l-7-7 7-7"/>
                  </svg>
                  Назад к списку
                </button>
              </div>
              <a
                href={`${FIXED_STANDS.find(s => s.id === currentStandView)?.baseUrl || '#'}/page/statistics-new`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13px] text-amber hover:text-amber2 font-semibold underline"
              >
                Открыть страницу статистики →
              </a>
            </div>
            
            <div className="rounded-xl border border-line bg-panel/40 p-6 backdrop-blur">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-line">
                <div>
                  <h2 className="font-display text-[20px] font-bold text-fog">{selectedReport.filterName}</h2>
                  <p className="text-[12px] text-mist mt-1">
                    Получен: {new Date(selectedReport.createdAt).toLocaleString('ru-RU')} | Пользователь: {selectedReport.createdBy}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleShareReport(selectedReport)}
                    className="flex items-center gap-2 rounded-lg bg-amber/90 px-4 py-2.5 text-[13px] font-bold text-[#17211d] transition-all hover:bg-amber"
                  >
                    <Download size={16} />
                    Поделиться
                  </button>
                  <button
                    onClick={() => handleDownloadReport(selectedReport)}
                    className="flex items-center gap-2 rounded-lg bg-panel border border-line px-4 py-2.5 text-[13px] font-bold text-fog transition-all hover:bg-raised"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                    </svg>
                    Скачать PDF
                  </button>
                </div>
              </div>
              
              {/* Stand Switcher Buttons */}
              <div className="flex gap-2 mb-6">
                {FIXED_STANDS.map((stand) => {
                  const standData = selectedReport.standData[stand.id];
                  const hasData = standData && standData.rows && standData.rows.length > 0;
                  return (
                    <button
                      key={stand.id}
                      onClick={() => setCurrentStandView(stand.id)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-bold transition-all ${
                        currentStandView === stand.id
                          ? 'bg-amber text-[#17211d]'
                          : 'bg-panel border border-line text-fog hover:bg-raised'
                      }`}
                      style={currentStandView !== stand.id ? { borderColor: stand.color } : {}}
                    >
                      <div 
                        className="w-2.5 h-2.5 rounded-full" 
                        style={{ backgroundColor: stand.color }}
                      />
                      {stand.name}
                      {!hasData && <span className="text-[10px] opacity-60">(нет данных)</span>}
                    </button>
                  );
                })}
              </div>
              
              {/* Current Stand Info */}
              <div className="mb-4 p-3 bg-deep/50 rounded-lg border border-border">
                <p className="text-[12px] text-mist">
                  Просмотр данных стенда: <span style={{ color: FIXED_STANDS.find(s => s.id === currentStandView)?.color, fontWeight: 'bold' }}>{FIXED_STANDS.find(s => s.id === currentStandView)?.name}</span>
                </p>
              </div>
              
              {/* Report Data Table */}
              <ReportTable
                data={selectedReport.standData[currentStandView] || { columns: [], rows: [], error: 'Нет данных' }}
              />
            </div>
          </div>
        )}

        {/* Content Placeholder */}
        {!selectedReport && savedReports.length === 0 && (!settings.reportFilters.length || !selectedFilterId) && (
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
                  Добавьте фильтр в настройках и загрузите отчет для начала работы
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

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
                      <div className="space-y-3">
                        {settings.reportFilters.map((filter) => (
                          <div
                            key={filter.id}
                            className="p-4 bg-deep/50 rounded-lg border border-border space-y-3 group"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-32">
                                <label className="block text-[10px] font-bold text-mist uppercase mb-1">Имя</label>
                                <input
                                  type="text"
                                  value={filter.name}
                                  onChange={(e) => handleRenameFilter(filter.id, e.target.value)}
                                  placeholder="Имя фильтра"
                                  className="w-full bg-deep border border-line rounded px-2 py-1.5 text-[13px] text-fog focus:outline-none focus:ring-1 focus:ring-amber"
                                />
                              </div>
                              <div className="flex-1">
                                <label className="block text-[10px] font-bold text-mist uppercase mb-1">Фильтр JSON-RPC (GetReport)</label>
                                <textarea
                                  value={filter.filterJson}
                                  onChange={(e) => handleUpdateFilterJson(filter.id, e.target.value)}
                                  placeholder='Вставьте тело запроса CommonStatistic.GetReport ({"jsonrpc":"2.0","method":"CommonStatistic.GetReport","params":{...}})'
                                  rows={6}
                                  className="w-full bg-deep border border-line rounded px-2 py-1.5 text-[11px] text-fog focus:outline-none focus:ring-1 focus:ring-amber font-mono"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              <label className="text-[10px] text-mist">Дата с
                                <input type="date" value={filter.dateStart || ''} onChange={(e) => handleUpdateFilterDateStart(filter.id, e.target.value)}
                                  className="mt-1 w-full bg-deep border border-line rounded px-2 py-1.5 text-[12px] text-fog" />
                              </label>
                              <label className="text-[10px] text-mist">Время с
                                <input type="time" value={filter.timeStart || '00:00'} onChange={(e) => handleUpdateFilterTimeStart(filter.id, e.target.value)}
                                  className="mt-1 w-full bg-deep border border-line rounded px-2 py-1.5 text-[12px] text-fog" />
                              </label>
                              <label className="text-[10px] text-mist">Дата по
                                <input type="date" value={filter.dateEnd || ''} onChange={(e) => handleUpdateFilterDateEnd(filter.id, e.target.value)}
                                  className="mt-1 w-full bg-deep border border-line rounded px-2 py-1.5 text-[12px] text-fog" />
                              </label>
                              <label className="text-[10px] text-mist">Время по
                                <input type="time" value={filter.timeEnd || '23:59'} onChange={(e) => handleUpdateFilterTimeEnd(filter.id, e.target.value)}
                                  className="mt-1 w-full bg-deep border border-line rounded px-2 py-1.5 text-[12px] text-fog" />
                              </label>
                            </div>
                            <div className="flex items-center gap-2 pt-2 border-t border-line">
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
                                className="flex items-center gap-1 text-[10px] px-2 py-1 hover:bg-ember/20 rounded text-mist hover:text-ember transition-colors"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                </svg>
                                Удалить
                              </button>
                            </div>
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
