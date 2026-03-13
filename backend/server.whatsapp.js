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
const PORT = process.env.WHATSAPP_PORT || 3003;

app.use(express.json());

// Ultra-simple ping (no dependencies, pure response)
app.get('/ping', (req, res) => {
  res.send('pong');
});

app.use((req, res, next) => {
  console.log(`[WhatsApp] ${req.method} ${req.path}`);
  next();
});

// Health check (super simple, no DB dependencies)
app.get('/health', (req, res) => {
  res.json({ service: 'filalivre-whatsapp', status: 'ok', timestamp: new Date() });
});

// Ready check (confirms server is fully initialized)
app.get('/ready', (req, res) => {
  res.json({ 
    service: 'filalivre-whatsapp', 
    status: 'ready',
    port: PORT,
    environment: process.env.NODE_ENV,
    listening: true,
    timestamp: new Date() 
  });
});

// POST /send — called by worker to send a message
app.post('/send', async (req, res) => {
  try {
    const { barbershopId, session, phone, message } = req.body;
    const sessionName = session || (barbershopId ? 'barbershop_' + barbershopId : null);
    if (!sessionName || !phone || !message) {
      return res.status(400).json({ error: 'session (ou barbershopId), phone e message são obrigatórios' });
    }
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

    // Inicia em background: o QR pode demorar (15-30s) e não pode travar a request.
    startSession(sessionName).catch((err) => {
      console.error('[WhatsApp] Erro ao iniciar sessão (async):', err?.message || err);
    });

    try {
      await registerSession(barbershopId, 'waiting_qr');
    } catch (err) {
      console.error('[WhatsApp] Erro ao salvar sessão no banco:', err?.message || err);
    }

    const qr = getLastQR(sessionName) || null;
    return res.json({
      success: true,
      status: 'waiting_qr',
      qr,
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
const SERVER_START_TIME = Date.now();
const server = app.listen(PORT, '0.0.0.0', async () => {
  const startupTime = Date.now() - SERVER_START_TIME;
  console.log(`[WhatsApp] ✓ BINDING CONFIRMADO: 0.0.0.0:${PORT}`);
  console.log(`
╔══════════════════════════════════════════╗
║  FilaLivre WhatsApp Service              ║
║  Port: ${PORT}                           
║  Environment: ${process.env.NODE_ENV || 'development'}
║  Bind: 0.0.0.0:${PORT}
║  Ready: /ready endpoint disponível
╚══════════════════════════════════════════╝
  `);
  console.log(`[WhatsApp] [DEBUG] Servidor iniciou em ${startupTime}ms`);
  console.log('[WhatsApp] [DEBUG] Restaurando sessões do banco...');
  
  try {
    await startAllSessions();
    console.log('[WhatsApp] [DEBUG] Sessões restauradas com sucesso');
  } catch (err) {
    console.error('[WhatsApp] [ERROR] Erro ao restaurar sessões:', err.message);
  }
  
  console.log('[WhatsApp] ✓ Servidor pronto para receber requisições em /health e /ready');
});

// Log se houver erro no listen
server.on('error', (err) => {
  console.error('[WhatsApp] [CRITICAL] Erro ao escutar na porta:', err.message);
  if (err.code === 'EADDRINUSE') {
    console.error(`[WhatsApp] [CRITICAL] Porta ${PORT} já está em uso!`);
  }
  process.exit(1);
});

server.on('listening', () => {
  console.log(`[WhatsApp] [DEBUG] Servidor confirmado na porta ${PORT}`);
});

// Timeout de segurança para inicialização
setTimeout(() => {
  console.log('[WhatsApp] [DEBUG] ✓ Servidor respondendo após 30s de inicialização');
}, 30000);

process.on('SIGTERM', () => {
  console.log('[WhatsApp] SIGTERM received, shutting down...');
  process.exit(0);
});