import { useEffect, useState } from 'react';
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import { AdminAuthProvider, useAdminAuth } from '@/auth/AdminAuthContext';
import { RequireAdmin } from '@/auth/RequireAdmin';
import AdminPage from '@/pages/AdminPage';
import AdminLoginPage from '@/pages/AdminLoginPage';
import AnalysisSummaryPage from '@/pages/AnalysisSummaryPage';
import HistoryPage from '@/pages/HistoryPage';
import LobbyPage from '@/pages/LobbyPage';
import RoomPage from '@/pages/RoomPage';
import { RequirePlayer } from '@/auth/PlayerAuth';
import SettingsPage from '@/pages/SettingsPage';
import { defaultAdminRuntimeConfig, loadCachedVisualTheme, loadPublicVisualTheme } from '@/services/adminConfigRepository';
import type { VisualTheme } from '@/types';

function AppShell() {
  const { isAdmin } = useAdminAuth();
  const [visualTheme, setVisualTheme] = useState<VisualTheme>(loadCachedVisualTheme());

  useEffect(() => {
    let cancelled = false;

    loadPublicVisualTheme()
      .then((theme) => {
        if (!cancelled) setVisualTheme(theme);
      })
      .catch(() => {
        if (!cancelled) setVisualTheme(defaultAdminRuntimeConfig.visualTheme);
      });

    const handleThemeChange = (event: Event) => {
      const customEvent = event as CustomEvent<VisualTheme>;
      setVisualTheme(customEvent.detail || loadCachedVisualTheme());
    };

    window.addEventListener('thc-visual-theme-change', handleThemeChange as EventListener);
    return () => {
      cancelled = true;
      window.removeEventListener('thc-visual-theme-change', handleThemeChange as EventListener);
    };
  }, []);

  return (
    <div className={`app-shell theme-${visualTheme}`}>
      <Routes>
        <Route path="/" element={<RequirePlayer><LobbyPage /></RequirePlayer>} />
        <Route path="/room/:roomId" element={<RoomPage />} />
        <Route path="/summary" element={<AnalysisSummaryPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/admin-login" element={<AdminLoginPage />} />
        <Route
          path="/admin"
          element={(
            <RequireAdmin>
              <AdminPage />
            </RequireAdmin>
          )}
        />
      </Routes>
      <nav className={`bottom-nav ${isAdmin ? 'bottom-nav-four' : 'bottom-nav-three'}`}>
        <NavLink to="/">Rooms</NavLink>
        <NavLink to="/history">History</NavLink>
        <NavLink to="/settings">Settings</NavLink>
        {isAdmin && <NavLink to="/admin">Admin</NavLink>}
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AdminAuthProvider>
        <AppShell />
      </AdminAuthProvider>
    </BrowserRouter>
  );
}
