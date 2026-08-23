import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, User, Bell, Palette, Monitor } from "lucide-react";
import { db } from "../backend/db";

interface UserSettings {
  displayName: string;
  email: string;
  status: "online" | "busy" | "away";
  notifications: {
    email: boolean;
    push: boolean;
    testFailed: boolean;
    testPassed: boolean;
  };
  theme: {
    mode: "dark" | "light" | "system";
    accentColor: string;
  };
  workspace: {
    defaultView: "list" | "grid";
    autoSave: boolean;
  };
}

const DEFAULT_SETTINGS: UserSettings = {
  displayName: "",
  email: "",
  status: "online",
  notifications: {
    email: true,
    push: true,
    testFailed: true,
    testPassed: false,
  },
  theme: {
    mode: "dark",
    accentColor: "#ffb454",
  },
  workspace: {
    defaultView: "list",
    autoSave: true,
  },
};

export default function SettingsPage() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [accountId, setAccountId] = useState<string>("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    document.title = "Настройки — КАДР";
    
    // Получаем accountId из токена
    const token = localStorage.getItem("kadr-regapi-token");
    let accId = "default";
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        accId = payload.accountId || payload.sub || "default";
      } catch {
        accId = "default";
      }
    }
    setAccountId(accId);

    // Загружаем настройки из БД
    const savedSettings = db.loadUserSettings<UserSettings>(accId);
    if (savedSettings) {
      setSettings(savedSettings);
    } else {
      // Если нет сохраненных настроек, используем данные из сессии
      const session = db.listSessions().find(s => s.accountId === accId);
      if (session) {
        const user = db.getUser(session.userId);
        if (user) {
          setSettings(prev => ({
            ...prev,
            displayName: user.name,
            email: user.email,
          }));
        }
      }
    }
  }, []);

  const handleSave = () => {
    db.saveUserSettings(accountId, settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    
    // Сохраняем статус в localStorage для совместимости
    localStorage.setItem("kadr-user-status", settings.status);
  };

  const updateNotifications = (key: keyof UserSettings["notifications"], value: boolean) => {
    setSettings(prev => ({
      ...prev,
      notifications: { ...prev.notifications, [key]: value },
    }));
  };

  const updateTheme = (key: keyof UserSettings["theme"], value: string) => {
    setSettings(prev => ({
      ...prev,
      theme: { ...prev.theme, [key]: value },
    }));
  };

  const updateWorkspace = (key: keyof UserSettings["workspace"], value: any) => {
    setSettings(prev => ({
      ...prev,
      workspace: { ...prev.workspace, [key]: value },
    }));
  };

  return (
    <div className="min-h-screen bg-deep text-fog font-body">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-panel/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/workspace")}
              className="flex items-center gap-2 text-mist hover:text-fog transition-colors"
            >
              <ArrowLeft size={20} />
              <span className="font-medium">Назад</span>
            </button>
            <h1 className="font-display text-xl font-bold text-fog">Настройки</h1>
          </div>
          <button
            onClick={handleSave}
            disabled={saved}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 font-semibold transition-all ${
              saved
                ? "bg-sage text-[#17211d]"
                : "bg-amber text-[#17211d] hover:bg-amber2"
            }`}
          >
            <Save size={18} />
            <span>{saved ? "Сохранено" : "Сохранить"}</span>
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="space-y-8">
          {/* Profile Section */}
          <section className="rounded-xl border border-border bg-panel p-6">
            <div className="mb-6 flex items-center gap-3">
              <User size={20} className="text-amber" />
              <h2 className="font-display text-lg font-bold text-fog">Профиль</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-mist">
                  Отображаемое имя
                </label>
                <input
                  type="text"
                  value={settings.displayName}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, displayName: e.target.value }))
                  }
                  className="w-full rounded-lg border border-border bg-raised px-3 py-2.5 text-fog placeholder-mist/50 focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber"
                  placeholder="Ваше имя"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-mist">
                  Email
                </label>
                <input
                  type="email"
                  value={settings.email}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, email: e.target.value }))
                  }
                  className="w-full rounded-lg border border-border bg-raised px-3 py-2.5 text-fog placeholder-mist/50 focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber"
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-mist">
                  Статус
                </label>
                <select
                  value={settings.status}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      status: e.target.value as UserSettings["status"],
                    }))
                  }
                  className="w-full rounded-lg border border-border bg-raised px-3 py-2.5 text-fog focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber"
                >
                  <option value="online">В сети</option>
                  <option value="busy">Занят</option>
                  <option value="away">Отошёл</option>
                </select>
              </div>
            </div>
          </section>

          {/* Notifications Section */}
          <section className="rounded-xl border border-border bg-panel p-6">
            <div className="mb-6 flex items-center gap-3">
              <Bell size={20} className="text-amber" />
              <h2 className="font-display text-lg font-bold text-fog">Уведомления</h2>
            </div>
            <div className="space-y-4">
              <label className="flex items-center justify-between rounded-lg border border-border bg-raised/50 p-4 cursor-pointer hover:bg-raised transition-colors">
                <div>
                  <div className="font-semibold text-fog">Email уведомления</div>
                  <div className="text-sm text-mist">Получать уведомления на почту</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.notifications.email}
                  onChange={(e) => updateNotifications("email", e.target.checked)}
                  className="h-5 w-5 rounded border-border bg-deep text-amber focus:ring-amber focus:ring-offset-0"
                />
              </label>
              <label className="flex items-center justify-between rounded-lg border border-border bg-raised/50 p-4 cursor-pointer hover:bg-raised transition-colors">
                <div>
                  <div className="font-semibold text-fog">Push уведомления</div>
                  <div className="text-sm text-mist">Браузерные уведомления</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.notifications.push}
                  onChange={(e) => updateNotifications("push", e.target.checked)}
                  className="h-5 w-5 rounded border-border bg-deep text-amber focus:ring-amber focus:ring-offset-0"
                />
              </label>
              <label className="flex items-center justify-between rounded-lg border border-border bg-raised/50 p-4 cursor-pointer hover:bg-raised transition-colors">
                <div>
                  <div className="font-semibold text-fog">При падении теста</div>
                  <div className="text-sm text-mist">Уведомлять о неудачных прогонах</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.notifications.testFailed}
                  onChange={(e) => updateNotifications("testFailed", e.target.checked)}
                  className="h-5 w-5 rounded border-border bg-deep text-amber focus:ring-amber focus:ring-offset-0"
                />
              </label>
              <label className="flex items-center justify-between rounded-lg border border-border bg-raised/50 p-4 cursor-pointer hover:bg-raised transition-colors">
                <div>
                  <div className="font-semibold text-fog">При успешном тесте</div>
                  <div className="text-sm text-mist">Уведомлять об успешных прогонах</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.notifications.testPassed}
                  onChange={(e) => updateNotifications("testPassed", e.target.checked)}
                  className="h-5 w-5 rounded border-border bg-deep text-amber focus:ring-amber focus:ring-offset-0"
                />
              </label>
            </div>
          </section>

          {/* Theme Section */}
          <section className="rounded-xl border border-border bg-panel p-6">
            <div className="mb-6 flex items-center gap-3">
              <Palette size={20} className="text-amber" />
              <h2 className="font-display text-lg font-bold text-fog">Внешний вид</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-mist">
                  Тема оформления
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["dark", "light", "system"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => updateTheme("mode", mode)}
                      className={`rounded-lg border px-4 py-3 text-sm font-semibold transition-all ${
                        settings.theme.mode === mode
                          ? "border-amber bg-amber/10 text-amber"
                          : "border-border bg-raised text-mist hover:border-line2 hover:text-fog"
                      }`}
                    >
                      {mode === "dark" ? "Тёмная" : mode === "light" ? "Светлая" : "Системная"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-mist">
                  Акцентный цвет
                </label>
                <div className="flex gap-2">
                  {["#ffb454", "#46d68c", "#ff7a68", "#60a5fa", "#c9a2ff"].map((color) => (
                    <button
                      key={color}
                      onClick={() => updateTheme("accentColor", color)}
                      className={`h-10 w-10 rounded-lg border-2 transition-transform hover:scale-110 ${
                        settings.theme.accentColor === color
                          ? "border-fog scale-110"
                          : "border-transparent"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Workspace Section */}
          <section className="rounded-xl border border-border bg-panel p-6">
            <div className="mb-6 flex items-center gap-3">
              <Monitor size={20} className="text-amber" />
              <h2 className="font-display text-lg font-bold text-fog">Рабочее место</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-mist">
                  Вид по умолчанию
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["list", "grid"] as const).map((view) => (
                    <button
                      key={view}
                      onClick={() => updateWorkspace("defaultView", view)}
                      className={`rounded-lg border px-4 py-3 text-sm font-semibold transition-all ${
                        settings.workspace.defaultView === view
                          ? "border-amber bg-amber/10 text-amber"
                          : "border-border bg-raised text-mist hover:border-line2 hover:text-fog"
                      }`}
                    >
                      {view === "list" ? "Список" : "Сетка"}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center justify-between rounded-lg border border-border bg-raised/50 p-4 cursor-pointer hover:bg-raised transition-colors">
                <div>
                  <div className="font-semibold text-fog">Автосохранение</div>
                  <div className="text-sm text-mist">Автоматически сохранять изменения</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.workspace.autoSave}
                  onChange={(e) => updateWorkspace("autoSave", e.target.checked)}
                  className="h-5 w-5 rounded border-border bg-deep text-amber focus:ring-amber focus:ring-offset-0"
                />
              </label>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
