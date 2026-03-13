import wppconnect from '@wppconnect-team/wppconnect';
import pool from '../config/database.js';
import { existsSync } from 'fs';

const sessions = new Map();
// Armazena último QR gerado por sessão (acessível pelo controller)
const qrCodes = new Map();
// Evita múltiplos starts concorrentes da mesma sessão
const startingSessions = new Map();

// Detecta Chromium do sistema (crítico para Railway/Docker)
// DEVE ser /usr/bin/chromium em Alpine/Linux, não fallback para bundled
function getChromiumPath() {
  // Primeira tentativa: PUPPETEER_EXECUTABLE_PATH configurado
  if (process.env.PUPPETEER_EXECUTABLE_PATH && existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    console.log('[WhatsApp] ✓ PUPPETEER_EXECUTABLE_PATH encontrado:', process.env.PUPPETEER_EXECUTABLE_PATH);
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  // Fallbacks em ordem de preferência (Alpine Linux primeiro)
  const candidates = [
    '/usr/bin/chromium',           // Alpine Linux (Railway default)
    '/usr/bin/chromium-browser',   // Debian/Ubuntu
    '/usr/bin/google-chrome-stable', // Debian/Ubuntu
    process.env.CHROME_BIN,        // Pode estar configured
  ].filter(Boolean);

  for (const p of candidates) {
    if (existsSync(p)) {
      console.log('[WhatsApp] ✓ Chromium encontrado em:', p);
      return p;
    }
    console.log('[WhatsApp] ✗ Chromium não encontrado em:', p);
  }

  // Erro crítico - Chromium não encontrado
  const errorMsg = `❌ CRÍTICO: Chromium não encontrado em nenhum dos locais: ${candidates.join(', ')}`;
  console.error('[WhatsApp]', errorMsg);
  throw new Error(errorMsg);
}

export async function startSession(sessionName) {
  // Se já existe sessão ativa, retorna ela
  if (sessions.has(sessionName)) {
    return { client: sessions.get(sessionName), qr: null };
  }

  // Se já existe start em andamento, não bloquear a request
  if (startingSessions.has(sessionName)) {
    return { client: sessions.get(sessionName) || null, qr: getLastQR(sessionName) };
  }

  // CRÍTICO: Sempre obter Chromium do sistema, não fallback para bundled
  const chromiumPath = getChromiumPath();
  console.log('[WhatsApp] Iniciando sessão com Chromium:', chromiumPath);

  const startPromise = (async () => {
    try {
      const client = await wppconnect.create({
        session: sessionName,
        catchQR: (base64Qr) => {
          console.log('[WhatsApp] QR Code gerado para sessão:', sessionName);
          qrCodes.set(sessionName, base64Qr);
        },
        statusFind: (statusSession) => {
          console.log('[WhatsApp] Status da sessão:', statusSession);
        },
        headless: true,
        logQR: true,
        // CRÍTICO: Sempre passar browserPathExecutable, não deixar undefined
        browserPathExecutable: chromiumPath,
        browserArgs: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
        ],
      });

      sessions.set(sessionName, client);
      return client;
    } catch (err) {
      console.error('[WhatsApp] Erro ao iniciar sessão:', sessionName, err?.message || err);
      throw err;
    } finally {
      startingSessions.delete(sessionName);
    }
  })();

  startingSessions.set(sessionName, startPromise);

  // Retorna imediatamente; o QR será capturado via catchQR e exposto em /qr
  return { client: sessions.get(sessionName) || null, qr: getLastQR(sessionName) };
}

export async function startAllSessions() {
  try {
    console.log("[WhatsApp] [DEBUG] startAllSessions: Iniciando...");
    const [rows] = await pool.query(`
      SELECT barbershop_id
      FROM whatsapp_sessions
      WHERE status = 'connected'
    `);

    console.log(`[WhatsApp] [DEBUG] Encontradas ${rows.length} sessões no banco`);
    console.log(`[WhatsApp] Iniciando ${rows.length} sessões do banco de dados...`);

    for (const row of rows) {
      const sessionName = "barbershop_" + row.barbershop_id;
      try {
        console.log(`[WhatsApp] [DEBUG] Iniciando sessão: ${sessionName}`);
        await startSession(sessionName);
        console.log(`[WhatsApp] Sessão iniciada: ${sessionName}`);
      } catch (err) {
        console.error(`[WhatsApp] Erro ao iniciar sessão ${sessionName}:`, err.message);
      }
    }

    console.log("[WhatsApp] [DEBUG] startAllSessions: Concluído com sucesso");
    console.log("[WhatsApp] Todas as sessões foram inicializadas");
  } catch (err) {
    console.error("[WhatsApp] Erro ao carregar sessões do banco:", err.message);
  }
}

export function getSession(sessionName) {
  return sessions.get(sessionName) || null;
}

export function getLastQR(sessionName) {
  return qrCodes.get(sessionName) || null;
}

function formatWhatsAppJid(phoneOrJid) {
  if (!phoneOrJid) return null;
  const raw = String(phoneOrJid).trim();
  if (!raw) return null;

  // Se já vier como JID, respeita
  if (raw.includes('@')) return raw;

  let number = raw.replace(/\D/g, '');
  if (!number) return null;
  if (!number.startsWith('55')) number = `55${number}`;
  return `${number}@c.us`;
}

export async function sendMessage(sessionName, phone, message) {
  const client = sessions.get(sessionName);

  if (!client) {
    throw new Error('Sessão WhatsApp não encontrada: ' + sessionName);
  }

  const jid = formatWhatsAppJid(phone);
  if (!jid) {
    throw new Error('Telefone inválido para WhatsApp');
  }

  return client.sendText(jid, message);
}

export async function isSessionReady(sessionName) {
  const client = sessions.get(sessionName);
  if (!client) return false;

  try {
    if (typeof client.isMainReady === 'function') {
      return await client.isMainReady();
    }
  } catch {
    // ignore
  }

  try {
    if (typeof client.isLoggedIn === 'function') {
      return await client.isLoggedIn();
    }
  } catch {
    // ignore
  }

  try {
    if (typeof client.isAuthenticated === 'function') {
      return await client.isAuthenticated();
    }
  } catch {
    // ignore
  }

  try {
    if (typeof client.isConnected === 'function') {
      return await client.isConnected();
    }
  } catch {
    // ignore
  }

  return false;
}

export function isSessionActive(sessionName) {
  return sessions.has(sessionName);
}

export async function disconnectSession(sessionName) {
  const client = sessions.get(sessionName);
  if (client) {
    try {
      await client.close();
    } catch (e) {
      console.error('[WhatsApp] Erro ao fechar sessão:', e.message);
    }
    sessions.delete(sessionName);
    qrCodes.delete(sessionName);
  }

  if (startingSessions.has(sessionName)) {
    startingSessions.delete(sessionName);
  }
}

// Salva/atualiza sessão no banco de dados
export async function registerSession(barbershopId, status = 'connected') {
  const sessionName = 'barbershop_' + barbershopId;
  await pool.query(
    `INSERT INTO whatsapp_sessions (barbershop_id, session_name, status)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE status = ?, updated_at = NOW()`,
    [barbershopId, sessionName, status, status]
  );
}

// Busca status da sessão no banco
export async function getSessionFromDB(barbershopId) {
  const [rows] = await pool.query(
    'SELECT * FROM whatsapp_sessions WHERE barbershop_id = ? ORDER BY id DESC LIMIT 1',
    [barbershopId]
  );
  return rows[0] || null;
}
