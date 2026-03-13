import wppconnect from '@wppconnect-team/wppconnect';
import pool from '../config/database.js';
import path from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';

const sessions = new Map();
// Armazena último QR gerado por sessão (acessível pelo controller)
const qrCodes = new Map();
// Evita corridas: múltiplos /connect simultâneos para a mesma sessão
const startingSessions = new Map();

function getUserDataDir(sessionName) {
  const baseDir = process.env.WA_USER_DATA_DIR_BASE || '/tmp/wppconnect';
  return path.join(baseDir, sessionName);
}

function safeRmDir(dirPath, label) {
  try {
    if (dirPath && existsSync(dirPath)) {
      rmSync(dirPath, { recursive: true, force: true });
      console.log(`[WhatsApp] ${label} removido: ${dirPath}`);
    }
  } catch (err) {
    console.log(`[WhatsApp] Falha ao remover ${label} (${dirPath}): ${err.message}`);
  }
}

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
  // Se já está iniciando, reutiliza a mesma promise (evita 2 Chromiums no mesmo dir)
  if (startingSessions.has(sessionName)) {
    console.log('[WhatsApp] startSession já em andamento, aguardando:', sessionName);
    return startingSessions.get(sessionName);
  }

  const startPromise = (async () => {
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

  // CRÍTICO: userDataDir separado do diretório de tokens.
  // Isso evita lock em /app/tokens/... e reduz chance de "browser already running".
  const userDataDir = getUserDataDir(sessionName);
  try {
    mkdirSync(userDataDir, { recursive: true });
  } catch (e) {
    console.log(`[WhatsApp] Não foi possível criar userDataDir (${userDataDir}): ${e.message}`);
  }

  const createConfig = {
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
    // Não bloquear a criação esperando login; precisamos responder /connect com o QR imediatamente
    waitForLogin: false,
    autoClose: 0,  // CRÍTICO: não fechar sessão automaticamente
    // CRÍTICO: Sempre passar browserPathExecutable, não deixar undefined
    browserPathExecutable: chromiumPath,
    // Mantém tokens no diretório padrão (persistência), mas roda o perfil do Chromium no /tmp
    folderNameToken: './tokens',
    puppeteerOptions: {
      userDataDir,
    },
    browserArgs: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
    ],
  };

  const createClient = async () => {
    try {
      return await wppconnect.create(createConfig);
    } catch (err) {
      const msg = String(err?.message || err);
      // Fallback defensivo: se ainda assim travar por lock, limpa dirs e tenta 1x
      if (msg.includes('The browser is already running')) {
        console.log('[WhatsApp] Lock detectado ao iniciar. Limpando diretórios e tentando novamente...');
        safeRmDir(userDataDir, 'userDataDir');
        // Último recurso: às vezes o wppconnect usa tokens como profile; limpa também.
        safeRmDir(path.join(process.cwd(), 'tokens', sessionName), 'tokensDir');
        return await wppconnect.create(createConfig);
      }
      throw err;
    }
  };

  // Dispara criação do client em background; o /connect deve responder com QR sem aguardar login.
  const createPromise = createClient();
  void createPromise
    .then((client) => {
      sessions.set(sessionName, client);
    })
    .catch((err) => {
      console.error('[WhatsApp] Falha ao criar client:', err?.message || err);
    });

  // Se a criação falhar antes do QR, rejeita; se a criação apenas demorar, devolve QR assim que existir.
  const createFailureOnly = createPromise.then(
    () => new Promise(() => {}),
    (err) => {
      throw err;
    }
  );

  const qr = await Promise.race([qrPromise, createFailureOnly]);
  return { client: sessions.get(sessionName) || null, qr };
  })();

  startingSessions.set(sessionName, startPromise);
  try {
    return await startPromise;
  } finally {
    startingSessions.delete(sessionName);
  }
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
  const userDataDir = getUserDataDir(sessionName);

  try {
    if (!client) {
      console.log(`[WhatsApp] Session ${sessionName} not found in memory`);
    } else {
      // 1. Fecha o cliente wppconnect
      try {
        await client.close();
        console.log(`[WhatsApp] Client closed for ${sessionName}`);
      } catch (e) {
        console.log(`[WhatsApp] Error closing client (safe): ${e.message}`);
      }
      
      // 2. CRÍTICO: Fecha o browser/Chromium
      try {
        if (client.browser) {
          console.log(`[WhatsApp] Closing browser for ${sessionName}`);
          await client.browser.close();
          console.log(`[WhatsApp] Browser closed successfully`);
        }
      } catch (e) {
        console.log(`[WhatsApp] Error closing browser: ${e.message}`);
      }
    }

    // 3. Remove da memória (sempre)
    sessions.delete(sessionName);
    qrCodes.delete(sessionName);

    // 4. Limpa userDataDir (sempre) — onde o Chromium trava
    safeRmDir(userDataDir, 'userDataDir');

    console.log(`[WhatsApp] Session ${sessionName} disconnected successfully`);
  } catch (error) {
    console.error(`[WhatsApp] Error disconnecting ${sessionName}:`, error.message);
    sessions.delete(sessionName);
    qrCodes.delete(sessionName);
    safeRmDir(userDataDir, 'userDataDir');
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
