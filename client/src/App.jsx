import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth-context.jsx';
import { Layout } from './components/Layout.jsx';
import { Spinner, ToastProvider } from './components/ui.jsx';
import { Landing } from './pages/Landing.jsx';
import { Home } from './pages/Home.jsx';
import { Catalog } from './pages/Catalog.jsx';
import { CaseDetail } from './pages/CaseDetail.jsx';
import { NewInvestigation } from './pages/NewInvestigation.jsx';
import { ContinueInvestigation } from './pages/ContinueInvestigation.jsx';
import { Investigation } from './pages/Investigation.jsx';
import { Multiplayer } from './pages/Multiplayer.jsx';
import { Campaign } from './pages/Campaign.jsx';
import { BuilderList, BuilderEditor } from './pages/Builder.jsx';
import { Stats } from './pages/Stats.jsx';
import { SettingsPage } from './pages/Settings.jsx';
import { Moderation } from './pages/Moderation.jsx';

function Protected({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/" state={{ from: location.pathname }} replace />;
  return <Layout>{children}</Layout>;
}

export function App() {
  const { user, loading } = useAuth();
  return (
    <ToastProvider>
      <Routes>
        <Route path="/" element={loading ? <Spinner /> : user ? <Navigate to="/hem" replace /> : <Landing />} />
        <Route path="/hem" element={<Protected><Home /></Protected>} />
        <Route path="/katalog" element={<Protected><Catalog /></Protected>} />
        <Route path="/fall/:caseId" element={<Protected><CaseDetail /></Protected>} />
        <Route path="/ny-utredning" element={<Protected><NewInvestigation /></Protected>} />
        <Route path="/fortsatt" element={<Protected><ContinueInvestigation /></Protected>} />
        <Route path="/rum/:roomId" element={<Protected><Investigation /></Protected>} />
        <Route path="/multiplayer" element={<Protected><Multiplayer /></Protected>} />
        <Route path="/kampanj" element={<Protected><Campaign /></Protected>} />
        <Route path="/byggare" element={<Protected><BuilderList /></Protected>} />
        <Route path="/byggare/:caseId" element={<Protected><BuilderEditor /></Protected>} />
        <Route path="/statistik" element={<Protected><Stats /></Protected>} />
        <Route path="/moderation" element={<Protected><Moderation /></Protected>} />
        <Route path="/installningar" element={<Protected><SettingsPage /></Protected>} />
        <Route path="*" element={<Navigate to="/hem" replace />} />
      </Routes>
    </ToastProvider>
  );
}
