import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { LandingPage } from './pages/landing';
import { LoginPage } from './pages/login';
import { ClientQueuePage } from './pages/client-queue';
import { BarberPage } from './pages/barber';
import { MonitorPage } from './pages/monitor';
import { AdminPage } from './pages/admin';
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
        <Route path="/barbeiro" element={<BarberPage />} />
        <Route path="/barber-dashboard" element={<BarberPage />} />
        <Route path="/monitor" element={<MonitorPage />} />
        <Route path="/display" element={<MonitorPage />} />
        <Route path="/admin" element={<AdminPage />} />
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
