import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { backend } from "../backend";
import type { PublicUser } from "../backend";
import { BarChart3, Inbox, RefreshCw } from "lucide-react";

export default function CloudStatisticPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Проверка авторизации
    backend.restore().then((result) => {
      if (result && result.user) {
        setUser(result.user);
        setLoading(false);
      } else {
        navigate("/auth");
      }
    }).catch(() => {
      navigate("/auth");
    });
  }, [navigate]);

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
          <BarChart3 size={14} className="text-amber" />
          <span className="font-mono text-[12px] font-semibold text-mist">Облачная статистика</span>
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
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="max-w-lg text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-line bg-raised">
              <BarChart3 size={40} className="text-amber" />
            </div>
            <h1 className="mb-3 font-display text-[22px] font-bold text-fog">
              Облачная статистика
            </h1>
            <p className="mb-6 text-[14px] font-medium text-dim">
              Здесь будут отображаться отчеты по тестам вашей команды.<br />
              Статистика хранится в базе данных и доступна всем участникам аккаунта.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                className="flex items-center gap-2 rounded-lg border border-line bg-raised px-4 py-2.5 text-[13px] font-extrabold text-mist transition-all duration-150 hover:border-amber/50 hover:text-amber active:scale-[0.97]"
              >
                <RefreshCw size={14} />
                Обновить отчеты
              </button>
            </div>
            
            {/* Заглушка для будущих отчетов */}
            <div className="mt-10 rounded-xl border border-dashed border-line bg-panel/30 p-8">
              <Inbox size={32} className="mx-auto mb-3 text-dim" />
              <p className="text-[13px] font-semibold text-dim">
                Отчеты пока не сформированы
              </p>
              <p className="mt-1 text-[12px] text-dim">
                Запустите сборку тестов в workspace, чтобы увидеть статистику
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
