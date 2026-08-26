import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import HomePage from "./pages/HomePage";
import LoginPage from "./components/LoginPage";
import WorkspacePage from "./pages/WorkspacePage";
import ReportsPage from "./pages/ReportsPage";
import SettingsPage from "./pages/SettingsPage";
import TeamPage from "./pages/TeamPage";
import StatisticsPage from "./pages/StatisticsPage";

function PageTitleManager() {
  const location = useLocation();

  useEffect(() => {
    switch (location.pathname) {
      case "/":
        document.title = "КАДР";
        break;
      case "/workspace":
        document.title = "Рабочее место";
        break;
      case "/team":
        document.title = "Команда";
        break;
      case "/statistics":
        document.title = "Статистика облака";
        break;
      case "/settings":
        document.title = "Настройки";
        break;
      default:
        document.title = "КАДР";
    }
  }, [location.pathname]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <PageTitleManager />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/auth" element={<LoginPage />} />
        <Route path="/workspace" element={<WorkspacePage />} />
        <Route path="/team" element={<TeamPage />} />
        <Route path="/statistics" element={<StatisticsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
