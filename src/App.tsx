import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import { LandingPage } from './pages/landing';
import { LoginPage } from './pages/login';
import { ClientQueuePage } from './pages/client-queue';
import { BarberPage } from './pages/barber';
import { MonitorPage } from './pages/monitor';
import { AdminPage } from './pages/admin';
import { PlatformAdminPage } from './pages/platform-admin';
import { SubscriptionPage } from './pages/subscription';
import { ForgotPasswordPage } from './pages/forgot-password';
import { ResetPasswordPage } from './pages/reset-password';
import { TrialGuard } from './components/layout/TrialGuard';
import { AuthGuard } from './components/layout/AuthGuard';
import './App.css';

function AppContent() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
      <Route path="/resetar-senha" element={<ResetPasswordPage />} />
      <Route path="/profissional" element={<AuthGuard allowedRoles={['barber']}><TrialGuard><BarberPage /></TrialGuard></AuthGuard>} />
      <Route path="/admin" element={<AuthGuard allowedRoles={['admin', 'owner']}><TrialGuard><AdminPage /></TrialGuard></AuthGuard>} />
      <Route path="/assinatura" element={<AuthGuard allowedRoles={['admin', 'owner']}><SubscriptionPage /></AuthGuard>} />
      <Route path="/platform-admin" element={<AuthGuard allowedRoles={['platform_owner']}><PlatformAdminPage /></AuthGuard>} />
      <Route path="/monitor/:slug" element={<TrialGuard><MonitorPage /></TrialGuard>} />
      <Route path="/:slug" element={<ClientQueuePage />} />
    </Routes>
  );
}

function App() {
  useEffect(() => {
    // Google Site Verification
    const meta = document.createElement('meta');
    meta.name = 'google-site-verification';
    meta.content = 'IH3fbEzy2e8DVDawF4Oh4JuQnwjCvpuxxIvCn1mKdVM';
    document.head.appendChild(meta);
  }, []);

  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
