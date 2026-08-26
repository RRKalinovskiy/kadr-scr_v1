import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { initials } from "../types";
import { restoreAuth, signOut } from "../session";
import type { PublicUser } from "../backend";

type StatusId = "online" | "busy" | "away" | "offline";

const STATUSES: Array<{ id: StatusId; label: string; color: string }> = [
  { id: "online", label: "В сети", color: "bg-sage" },
  { id: "busy", label: "Занят", color: "bg-ember" },
  { id: "away", label: "Отошёл", color: "bg-amber" },
  { id: "offline", label: "Не беспокоить", color: "bg-mist" },
];

function loadStatus(): StatusId {
  const v = localStorage.getItem("kadr-user-status");
  return v === "busy" || v === "away" || v === "offline" ? v : "online";
}

export const Header: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [status, setStatus] = useState<StatusId>(loadStatus);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  useEffect(() => {
    void restoreAuth().then((auth) => {
      if (auth?.user) setUser(auth.user);
    });
  }, []);

  useEffect(() => {
    localStorage.setItem("kadr-user-status", status);
  }, [status]);

  const currentStatus = STATUSES.find((s) => s.id === status) || STATUSES[0];
  const displayName = user?.name || "Пользователь";
  const displayEmail = user?.email || "";

  const handleLogout = async () => {
    setIsProfileOpen(false);
    await signOut();
    navigate("/auth");
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-panel/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1920px] items-center justify-between px-5">
        <div className="flex items-center gap-6">
          <button
            type="button"
            className="flex items-center gap-2.5"
            onClick={() => navigate("/workspace")}
          >
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-amber text-[13px] font-extrabold text-[#17211d]">
              К
            </div>
            <span className="font-display text-[15px] font-bold tracking-tight text-fog">КАДР</span>
          </button>

          <nav className="hidden md:flex items-center gap-0.5">
            {[
              { path: "/workspace", label: "Рабочее место" },
              { path: "/team", label: "Сотрудники" },
              { path: "/statistics", label: "Статистика облака" },
            ].map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                className={`px-3.5 py-1.5 rounded-lg text-[13px] font-semibold transition-colors ${
                  isActive(item.path)
                    ? "bg-raised text-fog"
                    : "text-mist hover:text-fog hover:bg-raised/50"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setIsProfileOpen((v) => !v)}
            className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-raised transition-colors"
          >
            <div className="hidden sm:block text-right leading-tight">
              <div className="text-[13px] font-bold text-fog truncate max-w-[160px]">{displayName}</div>
              <div className="mt-0.5 flex items-center justify-end gap-1.5 text-[11px] text-mist">
                <span className={`h-1.5 w-1.5 rounded-full ${currentStatus.color}`} />
                {currentStatus.label}
              </div>
            </div>
            <div className="relative">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-amber/20 text-[12px] font-extrabold text-amber ring-1 ring-border">
                {initials(displayName)}
              </span>
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-panel ${currentStatus.color}`}
              />
            </div>
            <ChevronDown size={14} className={`text-mist transition-transform ${isProfileOpen ? "rotate-180" : ""}`} />
          </button>

          {isProfileOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsProfileOpen(false)} />
              <div className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-panel shadow-2xl">
                <div className="border-b border-border px-3.5 py-3">
                  <div className="text-[13px] font-bold text-fog truncate">{displayName}</div>
                  {displayEmail && (
                    <div className="mt-0.5 font-mono text-[11px] text-mist truncate">{displayEmail}</div>
                  )}
                </div>
                <div className="border-b border-border px-3.5 py-2.5">
                  <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-dim">Статус</div>
                  <div className="grid grid-cols-2 gap-1">
                    {STATUSES.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setStatus(s.id)}
                        className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                          status === s.id
                            ? "bg-amber/15 text-amber"
                            : "text-mist hover:bg-raised hover:text-fog"
                        }`}
                      >
                        <span className={`h-2 w-2 rounded-full ${s.color}`} />
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(false);
                    navigate("/settings");
                  }}
                  className="w-full px-3.5 py-2.5 text-left text-[13px] font-medium text-mist hover:bg-raised hover:text-fog"
                >
                  Настройки
                </button>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="w-full px-3.5 py-2.5 text-left text-[13px] font-medium text-ember hover:bg-ember/10"
                >
                  Выйти
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
