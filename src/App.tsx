import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { LandingPage } from './pages/landing';
import { LoginPage } from './pages/login';
import { ClientQueuePage } from './pages/client-queue';
import { BarberPage } from './pages/barber';
import { MonitorPage } from './pages/monitor';
import { AdminPage } from './pages/admin';
import { PlatformAdminPage } from './pages/platform-admin';
import { SubscriptionPage } from './pages/subscription';
import { TrialGuard } from './components/layout/TrialGuard';
import { Dock } from './components/ui/dock';
import './App.css';

function AppContent() {
  const location = useLocation();
  const showDock = location.pathname !== '/' && location.pathname !== '/login';

  return (
    <>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/client-queue" element={<ClientQueuePage />} />
        <Route path="/cliente" element={<ClientQueuePage />} />
        <Route path="/barbeiro" element={<TrialGuard><BarberPage /></TrialGuard>} />
        <Route path="/barber-dashboard" element={<TrialGuard><BarberPage /></TrialGuard>} />
        <Route path="/monitor" element={<TrialGuard><MonitorPage /></TrialGuard>} />
        <Route path="/display" element={<TrialGuard><MonitorPage /></TrialGuard>} />
        <Route path="/admin" element={<TrialGuard><AdminPage /></TrialGuard>} />
        <Route path="/assinatura" element={<SubscriptionPage />} />
        <Route path="/platform-admin" element={<PlatformAdminPage />} />
      </Routes>
      {showDock && <Dock />}
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
