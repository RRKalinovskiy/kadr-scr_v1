import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import HomePage from "./pages/HomePage";
import LoginPage from "./components/LoginPage";
import WorkspacePage from "./pages/WorkspacePage";
import CloudStatisticPage from "./pages/CloudStatisticPage";
import ReportsPage from "./pages/ReportsPage";

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
      case "/cloud-statistic":
        document.title = "Статистика облака";
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
        <Route path="/cloud-statistic" element={<CloudStatisticPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
