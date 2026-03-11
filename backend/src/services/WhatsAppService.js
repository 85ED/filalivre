import wppconnect from '@wppconnect-team/wppconnect';
import pool from '../config/database.js';
import { existsSync } from 'fs';

const sessions = new Map();
// Armazena último QR gerado por sessão (acessível pelo controller)
const qrCodes = new Map();

// Detecta Chromium do sistema (Nix no Railway, ou fallback)
function getChromiumPath() {
  const candidates = [
    process.env.NIXPACKS_CHROMIUM_PATH,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/nix/var/nix/profiles/default/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ].filter(Boolean);
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return undefined; // Usa Chromium bundled do puppeteer
}

export async function startSession(sessionName) {
  // Se já existe sessão ativa, retorna ela
  if (sessions.has(sessionName)) {
    return { client: sessions.get(sessionName), qr: null };
  }

  // Cria promise que resolve quando o QR é gerado ou a sessão conecta
  let qrResolve;
  const qrPromise = new Promise((resolve) => {
    qrResolve = resolve;
    // Timeout de 30s caso não gere QR (sessão já autenticada)
    setTimeout(() => resolve(null), 30000);
  });

  const chromiumPath = getChromiumPath();
  if (chromiumPath) {
    console.log('[WhatsApp] Usando Chromium do sistema:', chromiumPath);
  }

  const client = await wppconnect.create({
    session: sessionName,
    catchQR: (base64Qr) => {
      console.log('[WhatsApp] QR Code gerado para sessão:', sessionName);
      qrCodes.set(sessionName, base64Qr);
      qrResolve(base64Qr);
    },
    statusFind: (statusSession) => {
      console.log('[WhatsApp] Status da sessão:', statusSession);
      if (statusSession === 'isLogged' || statusSession === 'qrReadSuccess') {
        qrResolve(null); // Já conectado, não precisa de QR
      }
    },
    headless: true,
    useChrome: false,
    logQR: true,
    ...(chromiumPath ? { browserPathExecutable: chromiumPath } : {}),
    browserArgs: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
    ],
  });

  sessions.set(sessionName, client);

  const qr = await qrPromise;
  return { client, qr };
}

export async function startAllSessions() {
  try {
    const [rows] = await pool.query(`
      SELECT barbershop_id
      FROM whatsapp_sessions
      WHERE status = 'connected'
    `);

    console.log(`[WhatsApp] Iniciando ${rows.length} sessões do banco de dados...`);

    for (const row of rows) {
      const sessionName = "barbershop_" + row.barbershop_id;
      try {
        await startSession(sessionName);
        console.log(`[WhatsApp] Sessão iniciada: ${sessionName}`);
      } catch (err) {
        console.error(`[WhatsApp] Erro ao iniciar sessão ${sessionName}:`, err.message);
      }
    }

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

export async function sendMessage(sessionName, phone, message) {
  const client = sessions.get(sessionName);

  if (!client) {
    throw new Error('Sessão WhatsApp não encontrada: ' + sessionName);
  }

  // Formata número: remove caracteres não-numéricos e adiciona @c.us
  const cleanPhone = phone.replace(/\D/g, '');
  const number = cleanPhone + '@c.us';

  return client.sendText(number, message);
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
