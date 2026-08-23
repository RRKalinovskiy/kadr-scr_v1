import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { backend } from "../backend";
import type { PublicUser } from "../backend";
import { FileText, Upload, AlertCircle, CheckCircle, Clock, Settings, RefreshCw, Plus } from "lucide-react";

/** Интерфейс для настроек сайта */
interface SiteSettings {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
}

/** Интерфейс для отчета */
interface Report {
  id: string;
  name: string;
  siteId: string;
  status: "created" | "uploaded" | "error";
  createdAt: number;
  updatedAt?: number;
  errorMessage?: string;
  fileSize?: number;
}

/** Состояние аккаунта для хранения настроек и отчетов */
interface ReportsState {
  sites: SiteSettings[];
  reports: Report[];
}

const DEFAULT_STATE: ReportsState = {
  sites: [
    { id: "site-1", name: "Основной сайт", url: "https://kadr-scr.ru", enabled: true },
    { id: "site-2", name: "Тестовый стенд", url: "https://test.kadr-scr.ru", enabled: false },
    { id: "site-3", name: "Продакшн", url: "https://prod.kadr-scr.ru", enabled: true },
  ],
  reports: [],
};

export default function ReportsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<ReportsState>(DEFAULT_STATE);
  const [selectedReportType, setSelectedReportType] = useState<string>("all");
  const [savingSiteId, setSavingSiteId] = useState<string | null>(null);

  // Загрузка данных пользователя и состояния
  useEffect(() => {
    backend.restore().then((result) => {
      if (result && result.user) {
        setUser(result.user);
        // Загружаем состояние отчетов из БД
        const savedState = backend.loadAccountState<ReportsState>(result.user.accountId);
        if (savedState) {
          setState(savedState);
        }
        setLoading(false);
      } else {
        navigate("/auth");
      }
    }).catch(() => {
      navigate("/auth");
    });
  }, [navigate]);

  // Сохранение настроек сайта в БД
  const toggleSiteEnabled = async (siteId: string, enabled: boolean) => {
    setSavingSiteId(siteId);
    const updatedSites = state.sites.map((site) =>
      site.id === siteId ? { ...site, enabled } : site
    );
    const newState = { ...state, sites: updatedSites };
    setState(newState);
    
    if (user) {
      try {
        await backend.saveAccountState(user.accountId, newState);
      } catch (err) {
        console.error("Ошибка сохранения настроек сайта:", err);
        // Откат изменений при ошибке
        setState(state);
      }
    }
    setSavingSiteId(null);
  };

  // Добавление нового отчета (имитация)
  const addReport = () => {
    const enabledSites = state.sites.filter((s) => s.enabled);
    if (enabledSites.length === 0) {
      alert("Включите хотя бы один сайт для создания отчета");
      return;
    }

    const newReport: Report = {
      id: `report-${Date.now()}`,
      name: `Отчет ${new Date().toLocaleDateString("ru-RU")} ${new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`,
      siteId: enabledSites[0].id,
      status: "created",
      createdAt: Date.now(),
    };

    const newState = { ...state, reports: [newReport, ...state.reports] };
    setState(newState);

    if (user) {
      backend.saveAccountState(user.accountId, newState);
    }

    // Имитация загрузки отчета
    setTimeout(() => {
      const updatedReport = { ...newReport, status: "uploaded" as const, updatedAt: Date.now(), fileSize: Math.floor(Math.random() * 5000) + 1000 };
      const updatedReports = newState.reports.map((r) =>
        r.id === newReport.id ? updatedReport : r
      );
      const finalState = { ...newState, reports: updatedReports };
      setState(finalState);
      if (user) {
        backend.saveAccountState(user.accountId, finalState);
      }
    }, 2000);
  };

  // Фильтрация отчетов
  const filteredReports = state.reports.filter((report) => {
    if (selectedReportType === "all") return true;
    return report.status === selectedReportType;
  });

  // Статусы для отображения
  const statusConfig = {
    created: { label: "Создан", icon: Clock, color: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/20" },
    uploaded: { label: "Загружен", icon: CheckCircle, color: "text-green-400", bg: "bg-green-400/10", border: "border-green-400/20" },
    error: { label: "Ошибка", icon: AlertCircle, color: "text-red-400", bg: "bg-red-400/10", border: "border-red-400/20" },
  };

  if (loading) {
    return (
      <div className="grid h-screen w-screen place-items-center bg-deep text-fog">
        <div className="text-center">
          <div className="font-display text-[18px] font-bold">Загрузка...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-deep text-fog">
      {/* Шапка */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-panel px-4">
        <div className="flex items-center gap-2.5">
          <svg width="27" height="27" viewBox="0 0 32 32" aria-hidden>
            <rect x="2" y="2" width="28" height="28" rx="8" fill="#ffb454" />
            <path d="M9 22.5V9.5l7 7 7-7v13" stroke="#17211d" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="leading-none">
            <div className="font-display text-[13px] font-bold tracking-[0.14em] text-fog">КАДР</div>
            <div className="mt-[3px] text-[10px] font-semibold tracking-wide text-dim">скрин-сборки автотестов</div>
          </div>
        </div>
        <span className="h-6 w-px bg-line" />
        <div className="flex items-center gap-2 rounded-lg border border-line bg-raised/60 px-3 py-1.5">
          <FileText size={14} className="text-amber" />
          <span className="font-mono text-[12px] font-semibold text-mist">Отчеты</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={() => navigate("/workspace")}
            className="flex h-9 items-center gap-2 rounded-lg border border-line bg-raised px-3 text-[12px] font-extrabold text-mist transition-all duration-150 hover:border-teal/50 hover:text-teal active:scale-[0.97]"
          >
            ← Назад в workspace
          </button>
          <div className="flex items-center gap-2 rounded-md border border-line bg-raised/60 px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-teal" />
            <span className="text-[11px] font-semibold text-mist">{user.email}</span>
          </div>
        </div>
      </header>

      {/* Основной контент */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 flex-col overflow-auto p-6">
          
          {/* Блок сайтов с переключателями */}
          <section className="mb-6 rounded-xl border border-line bg-panel p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-[16px] font-bold text-fog">Настройки сайтов</h2>
              <Settings size={16} className="text-dim" />
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {state.sites.map((site) => (
                <div
                  key={site.id}
                  className={`flex items-center justify-between rounded-lg border p-3 transition-all duration-200 ${
                    site.enabled
                      ? "border-teal/30 bg-teal/5"
                      : "border-line bg-raised/40"
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="font-mono text-[13px] font-semibold text-fog">{site.name}</span>
                    <span className="text-[11px] text-dim">{site.url}</span>
                  </div>
                  <button
                    onClick={() => toggleSiteEnabled(site.id, !site.enabled)}
                    disabled={savingSiteId === site.id}
                    className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${
                      site.enabled ? "bg-teal" : "bg-dim"
                    } ${savingSiteId === site.id ? "opacity-50" : ""}`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-200 ${
                        site.enabled ? "left-[22px]" : "left-0.5"
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Блок выбора отчета и списка */}
          <section className="flex-1 rounded-xl border border-line bg-panel p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-[16px] font-bold text-fog">Список отчетов</h2>
              <button
                onClick={addReport}
                className="flex items-center gap-2 rounded-lg border border-line bg-raised px-3 py-2 text-[12px] font-extrabold text-mist transition-all duration-150 hover:border-amber/50 hover:text-amber active:scale-[0.97]"
              >
                <Plus size={14} />
                Создать отчет
              </button>
            </div>

            {/* Фильтры */}
            <div className="mb-4 flex gap-2">
              {[
                { value: "all", label: "Все" },
                { value: "created", label: "Создан" },
                { value: "uploaded", label: "Загружен" },
                { value: "error", label: "Ошибка" },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSelectedReportType(option.value)}
                  className={`rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition-all duration-150 ${
                    selectedReportType === option.value
                      ? "border-amber bg-amber/10 text-amber"
                      : "border-line bg-raised text-mist hover:border-line/50"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {/* Список отчетов */}
            {filteredReports.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <FileText size={48} className="mb-3 text-dim" />
                <p className="text-[14px] font-semibold text-dim">Отчетов пока нет</p>
                <p className="mt-1 text-[12px] text-dim">Создайте первый отчет, чтобы увидеть его здесь</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredReports.map((report) => {
                  const StatusIcon = statusConfig[report.status].icon;
                  const site = state.sites.find((s) => s.id === report.siteId);
                  
                  return (
                    <div
                      key={report.id}
                      className={`flex items-center justify-between rounded-lg border p-3 transition-all duration-200 ${statusConfig[report.status].bg} ${statusConfig[report.status].border}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${statusConfig[report.status].border} ${statusConfig[report.status].bg}`}>
                          <StatusIcon size={20} className={statusConfig[report.status].color} />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-mono text-[13px] font-semibold text-fog">{report.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-dim">
                              Сайт: {site?.name || "Неизвестно"}
                            </span>
                            <span className="text-[11px] text-dim">•</span>
                            <span className="text-[11px] text-dim">
                              {new Date(report.createdAt).toLocaleString("ru-RU")}
                            </span>
                            {report.fileSize && (
                              <>
                                <span className="text-[11px] text-dim">•</span>
                                <span className="text-[11px] text-dim">{report.fileSize} КБ</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-bold ${statusConfig[report.status].bg} ${statusConfig[report.status].color}`}>
                          <StatusIcon size={12} />
                          {statusConfig[report.status].label}
                        </span>
                        {report.status === "error" && report.errorMessage && (
                          <button
                            className="rounded-md border border-line bg-raised px-2 py-1 text-[11px] text-mist hover:border-red-400/50 hover:text-red-400"
                            title={report.errorMessage}
                          >
                            Подробнее
                          </button>
                        )}
                        {report.status === "uploaded" && (
                          <button className="flex items-center gap-1.5 rounded-md border border-line bg-raised px-2 py-1 text-[11px] font-semibold text-mist transition-all duration-150 hover:border-teal/50 hover:text-teal">
                            <Upload size={12} />
                            Скачать
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
