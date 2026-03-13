import wppconnect from '@wppconnect-team/wppconnect';
import pool from '../config/database.js';
import { existsSync } from 'fs';

const sessions = new Map();
// Armazena último QR gerado por sessão (acessível pelo controller)
const qrCodes = new Map();

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
  // Se já existe sessão ativa, destroi antes de criar nova
  if (sessions.has(sessionName)) {
    console.log('[WhatsApp] Session already exists, destroying old one:', sessionName);
    await disconnectSession(sessionName);
  }

  // Cria promise que resolve quando o QR é gerado ou a sessão conecta
  let qrResolve;
  const qrPromise = new Promise((resolve) => {
    qrResolve = resolve;
    // Timeout de 30s caso não gere QR (sessão já autenticada)
    setTimeout(() => resolve(null), 30000);
  });

  // CRÍTICO: Sempre obter Chromium do sistema, não fallback para bundled
  const chromiumPath = getChromiumPath();
  console.log('[WhatsApp] Iniciando sessão com Chromium:', chromiumPath);

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
    logQR: true,
    autoClose: 0,  // CRÍTICO: não fechar sessão automaticamente
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

  const qr = await qrPromise;
  return { client, qr };
}

export async function startAllSessions() {
  console.log('[WhatsApp] Starting all sessions from database...');
  
  try {
    const [rows] = await pool.query(`
      SELECT barbershop_id
      FROM whatsapp_sessions
      WHERE status = 'connected'
    `);

    console.log(`[WhatsApp] Found ${rows.length} sessions in database`);

    for (const row of rows) {
      const sessionName = `barbershop_${row.barbershop_id}`;
      
      try {
        console.log(`[WhatsApp] Restoring session: ${sessionName}`);
        await startSession(sessionName);
        console.log(`[WhatsApp] Session restored successfully: ${sessionName}`);
      } catch (err) {
        console.error(`[WhatsApp] Failed to restore ${sessionName}:`, err.message);
        
        // Try force clean if there's an error
        try {
          await forceCleanSession(sessionName);
        } catch (cleanErr) {
          console.error(`[WhatsApp] Failed to force clean ${sessionName}:`, cleanErr.message);
        }
        
        // Update database status to disconnected
        try {
          await registerSession(row.barbershop_id, 'disconnected');
        } catch (dbErr) {
          console.error(`[WhatsApp] Failed to update status in DB for ${sessionName}:`, dbErr.message);
        }
      }
    }

    console.log('[WhatsApp] All sessions initialization completed');
  } catch (err) {
    console.error('[WhatsApp] Error loading sessions from database:', err.message);
  }
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
  console.log(`[WhatsApp] Disconnecting session: ${sessionName}`);
  
  const client = sessions.get(sessionName);
  if (!client) {
    console.log(`[WhatsApp] Session ${sessionName} not found in memory`);
    return;
  }

  try {
    // 1. Fecha o cliente WhatsApp
    try {
      await client.close();
      console.log(`[WhatsApp] Client closed for ${sessionName}`);
    } catch (e) {
      console.log(`[WhatsApp] Error closing client (usually safe): ${e.message}`);
    }
    
    // 2. Fecha o browser explicitamente (ISSO É CRÍTICO!)
    try {
      if (client.browser) {
        console.log(`[WhatsApp] Closing browser for ${sessionName}`);
        await client.browser.close();
        console.log(`[WhatsApp] Browser closed successfully for ${sessionName}`);
      }
    } catch (e) {
      console.log(`[WhatsApp] Error closing browser (continuing anyway): ${e.message}`);
    }
    
    // 3. Remove da memória (SEMPRE, mesmo com erro)
    sessions.delete(sessionName);
    
    // 4. Limpa QR code
    qrCodes.delete(sessionName);
    
    console.log(`[WhatsApp] Session ${sessionName} disconnected successfully`);
  } catch (error) {
    console.error(`[WhatsApp] Unexpected error disconnecting ${sessionName}:`, error.message);
    // Mesmo com erro, tenta remover da memória para evitar locks
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

// Helper function: Force clean a session (useful for emergency cleanup)
export async function forceCleanSession(sessionName) {
  console.log(`[WhatsApp] Force cleaning session: ${sessionName}`);
  
  try {
    // Mata o browser se existir (força hard close)
    const client = sessions.get(sessionName);
    if (client?.browser) {
      try {
        await client.browser.close();
        console.log(`[WhatsApp] Browser force-closed for ${sessionName}`);
      } catch (e) {
        console.log(`[WhatsApp] Browser already closed or error: ${e.message}`);
      }
    }
    
    // Remove da memória
    sessions.delete(sessionName);
    qrCodes.delete(sessionName);
    
    // Atualiza status no banco como desconectado
    const barbershopId = sessionName.replace('barbershop_', '');
    if (barbershopId && !isNaN(barbershopId)) {
      await registerSession(parseInt(barbershopId), 'disconnected');
    }
    
    console.log(`[WhatsApp] Session ${sessionName} force cleaned successfully`);
  } catch (error) {
    console.error(`[WhatsApp] Error force cleaning ${sessionName}:`, error.message);
  }
}
