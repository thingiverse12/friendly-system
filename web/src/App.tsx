import { Component, type ReactNode } from 'react';
import { BrowserRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider, RequireAuth } from './auth';
import { ToastProvider } from './toast';
import { AppShell } from './components/AppShell';
import { AuthPage } from './pages/AuthPage';
import { Dashboard } from './pages/Dashboard';
import { Goals } from './pages/Goals';
import { GoalDetail } from './pages/GoalDetail';
import { Transactions } from './pages/Transactions';
import { Competitions } from './pages/Competitions';
import { CompetitionDetail } from './pages/CompetitionDetail';
import { GroupDetail } from './pages/GroupDetail';
import { Achievements } from './pages/Achievements';
import { Profile } from './pages/Profile';
import { NotFound } from './pages/NotFound';
import { ErrorState } from './components/UI';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);
  return null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    if (this.state.failed) {
      return (
        <div className="page">
          <ErrorState message="Något oväntat hände. Ladda om sidan för att fortsätta." onRetry={() => window.location.reload()} />
        </div>
      );
    }
    return this.props.children;
  }
}

function Shell() {
  return (
    <RequireAuth>
      <AppShell>
        <Outlet />
      </AppShell>
    </RequireAuth>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ScrollToTop />
        <ToastProvider>
          <AuthProvider>
            <Routes>
              <Route path="/logga-in" element={<AuthPage mode="login" />} />
              <Route path="/skapa-konto" element={<AuthPage mode="register" />} />
              <Route path="/glomt-losenord" element={<AuthPage mode="forgot" />} />
              <Route path="/aterstall-losenord" element={<AuthPage mode="reset" />} />
              <Route element={<Shell />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/mal" element={<Goals />} />
                <Route path="/mal/:goalId" element={<GoalDetail />} />
                <Route path="/transaktioner" element={<Transactions />} />
                <Route path="/tavlingar" element={<Competitions />} />
                <Route path="/tavlingar/:competitionId" element={<CompetitionDetail />} />
                <Route path="/grupper/:groupId" element={<GroupDetail />} />
                <Route path="/bedrifter" element={<Achievements />} />
                <Route path="/profil" element={<Profile />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
