import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from '../components/Header';
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
      <div className="grid h-screen w-screen place-items-center bg-gray-100 text-gray-900">
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
    <div className="min-h-screen bg-gray-50">
      {/* Header Component */}
      <Header />
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Статистика облака</h1>
            <p className="text-gray-500 mt-1">Мониторинг и отчеты по тестам команды</p>
          </div>
        </div>

        {/* Content */}
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-blue-50">
            <BarChart3 size={40} className="text-blue-600" />
          </div>
          <h2 className="mb-3 text-xl font-semibold text-gray-900">
            Облачная статистика
          </h2>
          <p className="mb-6 text-sm text-gray-500 max-w-md mx-auto">
            Здесь будут отображаться отчеты по тестам вашей команды.<br />
            Статистика хранится в базе данных и доступна всем участникам аккаунта.
          </p>
          
          {/* Заглушка для будущих отчетов */}
          <div className="mt-10 rounded-lg border-2 border-dashed border-gray-300 bg-white p-8 max-w-2xl mx-auto">
            <Inbox size={32} className="mx-auto mb-3 text-gray-400" />
            <p className="text-sm font-medium text-gray-500">
              Отчеты пока не сформированы
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Запустите сборку тестов в workspace, чтобы увидеть статистику
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
