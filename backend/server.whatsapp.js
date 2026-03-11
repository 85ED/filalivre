import './env.js';
import express from 'express';
import {
  startSession,
  startAllSessions,
  isSessionActive,
  getLastQR,
  disconnectSession,
  sendMessage,
  registerSession,
  getSessionFromDB,
} from './src/services/WhatsAppService.js';

const app = express();
const PORT = process.env.PORT || 3003;

app.use(express.json());

app.use((req, res, next) => {
  console.log(`[WhatsApp] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ service: 'filalivre-whatsapp', status: 'ok', timestamp: new Date() });
});

// POST /send — called by worker to send a message
app.post('/send', async (req, res) => {
  try {
    const { barbershopId, phone, message } = req.body;
    if (!barbershopId || !phone || !message) {
      return res.status(400).json({ error: 'barbershopId, phone e message são obrigatórios' });
    }
    const sessionName = 'barbershop_' + barbershopId;
    if (!isSessionActive(sessionName)) {
      return res.status(404).json({ error: 'Sessão WhatsApp não ativa para este estabelecimento' });
    }
    await sendMessage(sessionName, phone, message);
    res.json({ success: true, message: 'Mensagem enviada' });
  } catch (err) {
    console.error('[WhatsApp] Erro ao enviar:', err.message);
    res.status(500).json({ error: 'Erro ao enviar mensagem', details: err.message });
  }
});

// POST /connect/:barbershopId — starts session and returns QR
app.post('/connect/:barbershopId', async (req, res) => {
  try {
    const { barbershopId } = req.params;
    const sessionName = 'barbershop_' + barbershopId;

    if (isSessionActive(sessionName)) {
      return res.json({ success: true, status: 'connected', qr: null });
    }

    const { qr } = await startSession(sessionName);
    await registerSession(barbershopId, qr ? 'waiting_qr' : 'connected');

    res.json({
      success: true,
      status: qr ? 'waiting_qr' : 'connected',
      qr: qr || null,
    });
  } catch (err) {
    console.error('[WhatsApp] Erro ao conectar:', err.message);
    res.status(500).json({ error: 'Erro ao iniciar sessão WhatsApp' });
  }
});

// POST /disconnect/:barbershopId
app.post('/disconnect/:barbershopId', async (req, res) => {
  try {
    const { barbershopId } = req.params;
    const sessionName = 'barbershop_' + barbershopId;
    await disconnectSession(sessionName);
    await registerSession(barbershopId, 'disconnected');
    res.json({ success: true, status: 'disconnected' });
  } catch (err) {
    console.error('[WhatsApp] Erro ao desconectar:', err.message);
    res.status(500).json({ error: 'Erro ao desconectar sessão' });
  }
});

// GET /status/:barbershopId
app.get('/status/:barbershopId', async (req, res) => {
  try {
    const { barbershopId } = req.params;
    const sessionName = 'barbershop_' + barbershopId;
    const active = isSessionActive(sessionName);
    const dbSession = await getSessionFromDB(barbershopId);

    res.json({
      session: sessionName,
      active,
      status: active ? 'connected' : (dbSession?.status || 'disconnected'),
      qr: active ? null : getLastQR(sessionName),
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao verificar status' });
  }
});

// GET /qr/:barbershopId
app.get('/qr/:barbershopId', async (req, res) => {
  try {
    const { barbershopId } = req.params;
    const sessionName = 'barbershop_' + barbershopId;
    res.json({ qr: getLastQR(sessionName) || null });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar QR' });
  }
});

// Boot
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`
╔══════════════════════════════════════════╗
║  FilaLivre WhatsApp Service              ║
║  Port: ${PORT}                           
║  Environment: ${process.env.NODE_ENV || 'development'}
╚══════════════════════════════════════════╝
  `);
  // Restore connected sessions from DB
  await startAllSessions();
});

process.on('SIGTERM', () => {
  console.log('[WhatsApp] SIGTERM received, shutting down...');
  process.exit(0);
});