import wppconnect from '@wppconnect-team/wppconnect';
import pool from '../config/database.js';
import { existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const sessions = new Map();
// Armazena último QR gerado por sessão (acessível pelo controller)
const qrCodes = new Map();
// Evita múltiplos starts concorrentes da mesma sessão
const startingSessions = new Map();

// TokenStore em disco (essencial para restaurar após restart do container)
// OBS: em redeploy (container novo), isso só persiste se o disco persistir.
function getPreferredTokensPath() {
  if (process.env.WHATSAPP_TOKENS_PATH) return process.env.WHATSAPP_TOKENS_PATH;
  if (process.env.DATA_DIR) return `${process.env.DATA_DIR}/tokens`;
  if (process.env.NODE_ENV === 'production') return '/data/tokens';
  return './tokens';
}

function ensureWritableDir(dirPath) {
  try {
    mkdirSync(dirPath, { recursive: true });
    return dirPath;
  } catch (err) {
    console.warn('[WhatsApp] [WARN] Não foi possível criar pasta de tokens:', dirPath, err?.message || err);
    return null;
  }
}

const preferredTokensPathRaw = getPreferredTokensPath();
const preferredTokensPath = preferredTokensPathRaw.startsWith('/')
  ? preferredTokensPathRaw
  : resolve(preferredTokensPathRaw);

const effectiveTokensPath =
  ensureWritableDir(preferredTokensPath) ||
  ensureWritableDir(resolve('./tokens')) ||
  preferredTokensPath;

console.log('[WhatsApp] TokenStore path:', effectiveTokensPath);

const fileTokenStore = new wppconnect.tokenStore.FileTokenStore({
  path: effectiveTokensPath,
});

// Evita gravar status repetidamente no banco a cada callback
const lastPersistedStatus = new Map();

function parseBarbershopIdFromSessionName(sessionName) {
  const m = /^barbershop_(\d+)$/.exec(String(sessionName || ''));
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isFinite(id) ? id : null;
}

async function persistSessionStatus(sessionName, status) {
  const barbershopId = parseBarbershopIdFromSessionName(sessionName);
  if (!barbershopId) return;

  const key = `${sessionName}:${status}`;
  if (lastPersistedStatus.get(sessionName) === status) return;
  lastPersistedStatus.set(sessionName, status);
  try {
    await registerSession(barbershopId, status);
  } catch (err) {
    console.error('[WhatsApp] Erro ao persistir status no banco:', err?.message || err);
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

  const errorMsg = `Chromium não encontrado em nenhum dos locais: ${candidates.join(', ')}`;
  const requireChromium =
    process.env.REQUIRE_CHROMIUM === 'true' ||
    (process.platform === 'linux' && process.env.NODE_ENV === 'production');

  if (requireChromium) {
    console.error('[WhatsApp] ❌ CRÍTICO:', errorMsg);
    throw new Error(`❌ CRÍTICO: ${errorMsg}`);
  }

  console.warn('[WhatsApp] [WARN]', errorMsg, '- usando Chromium padrão do Puppeteer/WPPConnect');
  return null;
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
  if (chromiumPath) {
    console.log('[WhatsApp] Iniciando sessão com Chromium:', chromiumPath);
  }

  const startPromise = (async () => {
    try {
      const client = await wppconnect.create({
        session: sessionName,
        tokenStore: fileTokenStore,
        catchQR: (base64Qr) => {
          console.log('[WhatsApp] QR Code gerado para sessão:', sessionName);
          qrCodes.set(sessionName, base64Qr);
          // Enquanto houver QR, consideramos que está aguardando scan
          persistSessionStatus(sessionName, 'waiting_qr');
        },
        statusFind: (statusSession) => {
          console.log('[WhatsApp] Status da sessão:', statusSession);

          const normalized = String(statusSession || '').toLowerCase();
          // Eventos comuns de sucesso de login no WPPConnect
          if (
            normalized.includes('qrreadsuccess') ||
            normalized.includes('islogged') ||
            normalized.includes('inchat') ||
            normalized.includes('main')
          ) {
            persistSessionStatus(sessionName, 'connected');
            qrCodes.delete(sessionName);
          }

          if (normalized.includes('disconnected')) {
            persistSessionStatus(sessionName, 'disconnected');
          }
        },
        headless: true,
        logQR: true,
        // CRÍTICO: não auto-fechar após scan/sync (Railway pode demorar e isso derruba a sessão)
        autoClose: 0,
        deviceSyncTimeout: 0,
        // Aguarda login para devolver o client (evita /status ficar false após scan)
        waitForLogin: true,
        // CRÍTICO: Sempre passar browserPathExecutable, não deixar undefined
        ...(chromiumPath
          ? {
              puppeteerOptions: {
                executablePath: chromiumPath,
              },
            }
          : {}),
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
      qrCodes.delete(sessionName);
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
    const [rows] = await pool.query(
      `SELECT barbershop_id
       FROM whatsapp_sessions
       WHERE status = 'connected'`
    );

    let tokenSessions = [];
    try {
      tokenSessions = await fileTokenStore.listTokens();
    } catch (err) {
      console.error('[WhatsApp] [WARN] Não foi possível listar tokens:', err?.message || err);
    }

    const sessionNames = new Set();
    for (const row of rows) {
      sessionNames.add('barbershop_' + row.barbershop_id);
    }
    for (const name of tokenSessions) {
      if (String(name).startsWith('barbershop_')) {
        sessionNames.add(String(name));
      }
    }

    console.log(`[WhatsApp] [DEBUG] Sessões conectadas no banco: ${rows.length}`);
    console.log(`[WhatsApp] [DEBUG] Tokens encontrados em disco: ${tokenSessions.length}`);
    console.log(`[WhatsApp] Iniciando ${sessionNames.size} sessões (banco + tokens)...`);

    for (const sessionName of sessionNames) {
      try {
        console.log(`[WhatsApp] [DEBUG] Iniciando sessão: ${sessionName}`);
        await startSession(sessionName);

        // Se a sessão está de fato iniciando, aguarda um pouco para restaurar o client.
        // Isso melhora o cenário: reinicia container -> /status já enxergar active=true.
        const startPromise = startingSessions.get(sessionName);
        if (startPromise) {
          const timeoutMs = Number(process.env.WHATSAPP_RESTORE_WAIT_MS || 45000);
          await Promise.race([
            startPromise,
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('timeout_waiting_session_start')), timeoutMs)
            ),
          ]).catch((err) => {
            if (String(err?.message || err) === 'timeout_waiting_session_start') {
              console.warn(`[WhatsApp] [WARN] Timeout aguardando restore de ${sessionName} (${timeoutMs}ms)`);
              return;
            }
            console.error(`[WhatsApp] [WARN] Erro aguardando start de ${sessionName}:`, err?.message || err);
          });
        }

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
