import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import HomePage from "./pages/HomePage";
import LoginPage from "./components/LoginPage";
import WorkspacePage from "./pages/WorkspacePage";
import CloudStatisticPage from "./pages/CloudStatisticPage";
import ReportsPage from "./pages/ReportsPage";

export default function App() {
  return (
    <BrowserRouter>
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
