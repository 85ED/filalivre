import {
  registerSession,
  getSessionFromDB,
} from '../services/WhatsAppService.js';
import WhatsAppUsageService from '../services/WhatsAppUsageService.js';
import StripeService from '../services/StripeService.js';
import pool from '../config/database.js';

// WhatsApp microservice URL (configured in env.js with Railway URL as default)
// Fallback URLs for local/Docker testing
const WHATSAPP_SERVICE_URL = process.env.WHATSAPP_SERVICE_URL;
const WHATSAPP_FALLBACK_URLS = [
  WHATSAPP_SERVICE_URL,
  // Local/Docker fallbacks (only if env var not set)
  'http://filalivre-whatsapp.railway.internal:3003',
  'http://localhost:3003',
];

console.log('[WhatsApp] Service URL configured:', WHATSAPP_SERVICE_URL);

/**
 * Envia email de alerta para o proprietário da barbearia
 * Reutiliza template similar ao de reset de senha
 */
async function sendWhatsAppAlertEmail(barbershopEmail, barbershopName, alertType = 'disconnected') {
  try {
    const sgMail = (await import('@sendgrid/mail')).default;
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const subject =
      alertType === 'disconnected'
        ? '⚠️ Alerta: WhatsApp da sua barbearia foi desconectado'
        : '❌ Erro: Falha ao conectar WhatsApp';

    const message =
      alertType === 'disconnected'
        ? 'Sua sessão do WhatsApp foi interrompida. Notificações automáticas não serão mais enviadas.'
        : 'Houve um erro ao tentar conectar o WhatsApp. Por favor, tente novamente.';

    await sgMail.send({
      to: barbershopEmail,
      from: 'alertas@filalivre.app.br',
      subject,
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <div style="background:#dc2626;padding:32px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:28px;letter-spacing:-0.5px;">⚠️ Alerta do FilaLivre</h1>
            <p style="color:#fecaca;margin:8px 0 0;font-size:14px;">Ação necessária em sua conta</p>
          </div>
          <div style="padding:32px;">
            <h2 style="color:#1e293b;font-size:20px;margin:0 0 16px;">${subject.replace(/^[⚠️❌] /, '')}</h2>
            <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px;">
              Olá, proprietário de <strong>${barbershopName || 'sua barbearia'}</strong>,
            </p>
            <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px;">
              ${message}
            </p>
            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:24px 0;">
              <p style="color:#7f1d1d;font-size:14px;margin:0;font-weight:600;">O que fazer:</p>
              <ul style="color:#7f1d1d;font-size:14px;margin:8px 0 0;padding-left:20px;">
                <li>Acesse o painel de administração</li>
                <li>Vá para a seção de WhatsApp</li>
                <li>Clique em "Conectar WhatsApp" e escaneie o QR Code com seu celular</li>
              </ul>
            </div>
            <div style="text-align:center;margin:32px 0;">
              <a href="https://filalivre.app.br/admin" style="display:inline-block;padding:14px 32px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:16px;">
                Ir para Dashboard
              </a>
            </div>
            <p style="color:#94a3b8;font-size:13px;line-height:1.5;margin:24px 0 0;">
              Se você recebe muitos alertas, pode haver um problema com sua conexão de internet ou o serviço WhatsApp. Entre em contato com nosso suporte se precisar de ajuda.
            </p>
          </div>
          <div style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e5e7eb;text-align:center;">
            <p style="color:#94a3b8;font-size:12px;margin:0;">FilaLivre &copy; ${new Date().getFullYear()} &bull; Sistema de gestão de filas</p>
          </div>
        </div>
      `,
    });

    console.log(`[WhatsApp] Email de alerta enviado para ${barbershopEmail}`);
  } catch (error) {
    console.error('[WhatsApp] Erro ao enviar email de alerta:', error.message);
    // Não lance erro aqui - o email é secundário
  }
}

async function callWhatsAppService(endpoint, method = 'POST', body = null) {
  let lastError = null;
  
  for (const baseUrl of WHATSAPP_FALLBACK_URLS) {
    try {
      const url = `${baseUrl}${endpoint}`;
      console.log(`[WhatsApp.callService] [${method}] Tentando: ${url}`);
      
      const options = {
        method,
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      };
      
      if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        options.body = JSON.stringify(body);
      }
      
      const response = await fetch(url, options);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`[WhatsApp.callService] ✓ Sucesso em: ${baseUrl}`);
      return data;
    } catch (err) {
      lastError = err;
      console.warn(`[WhatsApp.callService] ✗ Falha em ${baseUrl}: ${err.message}`);
    }
  }
  
  console.error(`[WhatsApp.callService] ❌ Nenhuma URL funcionou:`, WHATSAPP_FALLBACK_URLS);
  console.error(`[WhatsApp.callService] Último erro:`, lastError?.message);
  throw new Error(`WhatsApp service indisponível. Testadas: ${WHATSAPP_FALLBACK_URLS.join(', ')}. Erro: ${lastError?.message || 'Unknown error'}`);
}

export default class WhatsAppController {
  /**
   * POST /api/whatsapp/start/:barbershopId
   * Inicia sessão WhatsApp (alias para /connect)
   * Chama WhatsApp service para gerar QR code
   * Registra sessão no banco de dados
   */
  static async start(req, res) {
    try {
      const { barbershopId } = req.params;

      console.log(`[WhatsApp.start] INICIANDO - barbershopId: ${barbershopId}`);

      if (!barbershopId || barbershopId === '0' || isNaN(parseInt(barbershopId))) {
        console.error(`[WhatsApp.start] ❌ barbershopId INVÁLIDO: "${barbershopId}"`);
        return res.status(400).json({ error: 'barbershopId deve ser um número válido e diferente de 0' });
      }

      const parsedBarbershopId = parseInt(barbershopId);
      console.log(`[WhatsApp.start] ✓ barbershopId validado: ${parsedBarbershopId}`);
      
      // Call WhatsApp service with endpoint: POST /connect/:barbershopId
      const data = await callWhatsAppService(`/connect/${parsedBarbershopId}`, 'POST');
      
      // Registra no banco de dados
      const sessionName = `barbershop_${parsedBarbershopId}`;
      await registerSession(parsedBarbershopId, data.qr ? 'waiting_qr' : 'starting');
      console.log(`[WhatsApp.start] ✓ Sessão ${sessionName} registrada no banco com status: ${data.qr ? 'waiting_qr' : 'starting'}`);

      res.json({
        success: true,
        session: sessionName,
        message: data.qr ? 'QR gerado. Escaneie com seu celular para conectar.' : 'Sessão iniciada.',
        status: data.qr ? 'waiting_qr' : 'starting',
        qr: data.qr || null,
      });
    } catch (err) {
      console.error('[WhatsApp.start] ❌ Erro:', err.message);
      
      // Tenta enviar email de alerta para o dono da barbearia
      try {
        const [[owner]] = await pool.query(
          'SELECT u.email, b.name FROM users u JOIN barbershops b ON u.barbershop_id = b.id WHERE b.id = ? AND u.role = ?',
          [req.params.barbershopId, 'owner']
        );
        if (owner && owner.email) {
          await sendWhatsAppAlertEmail(
            owner.email,
            owner.name,
            'error'
          );
        }
      } catch (emailErr) {
        console.error('[WhatsApp] Erro ao enviar alerta por email:', emailErr.message);
      }
      
      res.status(500).json({ 
        success: false,
        error: 'Falha ao iniciar sessão WhatsApp',
        details: err.message 
      });
    }
  }

  static async connect(req, res) {
    try {
      const { barbershopId } = req.params;

      console.log(`[WhatsApp.connect] INICIANDO - barbershopId: ${barbershopId}, params:`, req.params);

      if (!barbershopId || barbershopId === '0' || isNaN(parseInt(barbershopId))) {
        console.error(`[WhatsApp.connect] ❌ barbershopId INVÁLIDO: "${barbershopId}"`);
        return res.status(400).json({ error: 'barbershopId deve ser um número válido e diferente de 0' });
      }

      const parsedBarbershopId = parseInt(barbershopId);
      console.log(`[WhatsApp.connect] ✓ barbershopId validado: ${parsedBarbershopId}`);
      
      // Call WhatsApp service with correct endpoint: POST /connect/:barbershopId
      const data = await callWhatsAppService(`/connect/${parsedBarbershopId}`, 'POST');
      
      // Registra no banco de dados local
      await registerSession(parsedBarbershopId, data.qr ? 'waiting_qr' : 'connected');
      console.log(`[WhatsApp.connect] ✓ Sessão ${parsedBarbershopId} registrada no banco`);

      res.json({
        success: true,
        message: data.qr ? 'QR gerado. Escaneie para conectar.' : 'Sessão conectada.',
        status: data.qr ? 'waiting_qr' : 'connected',
        qr: data.qr || null,
      });
    } catch (err) {
      console.error('[WhatsApp.connect] ❌ Erro:', err.message);
      
      // Tenta enviar email de alerta para o dono da barbearia
      try {
        const [[owner]] = await pool.query(
          'SELECT u.email, b.name FROM users u JOIN barbershops b ON u.barbershop_id = b.id WHERE b.id = ? AND u.role = ?',
          [req.params.barbershopId, 'owner']
        );
        if (owner && owner.email) {
          await sendWhatsAppAlertEmail(
            owner.email,
            owner.name,
            'error'
          );
        }
      } catch (emailErr) {
        console.error('[WhatsApp] Erro ao enviar alerta por email:', emailErr.message);
      }
      
      res.status(500).json({ 
        error: 'Erro ao iniciar sessão WhatsApp',
        details: err.message 
      });
    }
  }

  static async disconnect(req, res) {
    try {
      const { barbershopId } = req.params;

      console.log(`[WhatsApp.disconnect] INICIANDO - barbershopId: ${barbershopId}`);

      if (!barbershopId || barbershopId === '0' || isNaN(parseInt(barbershopId))) {
        console.error(`[WhatsApp.disconnect] ❌ barbershopId INVÁLIDO: "${barbershopId}"`);
        return res.status(400).json({ error: 'barbershopId deve ser um número válido e diferente de 0' });
      }

      const parsedBarbershopId = parseInt(barbershopId);
      
      // Call WhatsApp service with correct endpoint: POST /disconnect/:barbershopId
      await callWhatsAppService(`/disconnect/${parsedBarbershopId}`, 'POST');
      
      // Registra desconexão no banco
      await registerSession(parsedBarbershopId, 'disconnected');
      console.log(`[WhatsApp.disconnect] ✓ Barbearia ${parsedBarbershopId} desconectada`);

      res.json({
        success: true,
        message: 'Sessão desconectada.',
        status: 'disconnected',
      });
    } catch (err) {
      console.error('[WhatsApp.disconnect] ❌ Erro:', err.message);
      res.status(500).json({ 
        error: 'Erro ao desconectar sessão',
        details: err.message 
      });
    }
  }

  static async status(req, res) {
    try {
      const { barbershopId } = req.params;
      
      console.log(`[WhatsApp.status] INICIANDO - barbershopId: ${barbershopId}, params:`, req.params);

      if (!barbershopId || barbershopId === '0' || isNaN(parseInt(barbershopId))) {
        console.error(`[WhatsApp.status] ❌ barbershopId INVÁLIDO: "${barbershopId}"`);
        return res.status(400).json({ error: 'barbershopId deve ser um número válido e diferente de 0' });
      }

      const parsedBarbershopId = parseInt(barbershopId);
      console.log(`[WhatsApp.status] ✓ barbershopId validado: ${parsedBarbershopId}`);
      
      // Call WhatsApp service with correct endpoint: GET /status/:barbershopId
      const data = await callWhatsAppService(`/status/${parsedBarbershopId}`, 'GET');
      const dbSession = await getSessionFromDB(parsedBarbershopId);

      console.log(`[WhatsApp.status] ✓ Status obtido - active: ${data.active}, dbSession:`, dbSession?.status);

      // Update status in database if active (ready) and not already marked as connected
      if (data.active === true && dbSession?.status !== 'connected') {
        try {
          await pool.query(`
            UPDATE whatsapp_sessions
            SET status = 'connected', updated_at = NOW()
            WHERE barbershop_id = ?
          `, [parsedBarbershopId]);
          console.log(`[WhatsApp.status] ✓ Status no banco atualizado para 'connected'`);
        } catch (updateErr) {
          console.error(`[WhatsApp.status] ⚠️ Erro ao atualizar status no banco:`, updateErr.message);
          // Não quebra a resposta, apenas loga o erro
        }
      }

      res.json({
        session: `barbershop_${parsedBarbershopId}`,
        active: data.active || false,
        ready: data.ready === true,
        starting: data.starting === true,
        status: (data.status || (data.active ? 'connected' : (dbSession?.status || 'disconnected'))),
        qr: data.qr || null,
      });
    } catch (err) {
      console.error('[WhatsApp.status] ❌ Erro:', err.message);
      res.status(500).json({ 
        error: 'Erro ao verificar status',
        details: err.message 
      });
    }
  }

  static async qr(req, res) {
    try {
      const { barbershopId } = req.params;
      
      console.log(`[WhatsApp.qr] INICIANDO - barbershopId: ${barbershopId}`);

      if (!barbershopId || barbershopId === '0' || isNaN(parseInt(barbershopId))) {
        console.error(`[WhatsApp.qr] ❌ barbershopId INVÁLIDO: "${barbershopId}"`);
        return res.status(400).json({ error: 'barbershopId deve ser um número válido e diferente de 0' });
      }

      const parsedBarbershopId = parseInt(barbershopId);
      
      // Call WhatsApp service with correct endpoint: GET /qr/:barbershopId
      const data = await callWhatsAppService(`/qr/${parsedBarbershopId}`, 'GET');

      console.log(`[WhatsApp.qr] ✓ QR obtido para barbearia ${parsedBarbershopId}`);

      res.json({ qr: data.qr || null });
    } catch (err) {
      console.error('[WhatsApp.qr] ❌ Erro:', err.message);
      res.status(500).json({ 
        error: 'Erro ao buscar QR code',
        details: err.message 
      });
    }
  }

  /**
   * GET /api/whatsapp/usage
   * Retorna estatísticas de uso de WhatsApp para a barbearia autenticada
   * Requer autenticação: usa barbershopId do token JWT
   */
  static async getUsage(req, res) {
    try {
      // Get barbershopId from authenticated user
      const userBarbershopId = req.user?.barbershopId;
      if (!userBarbershopId) {
        return res.status(401).json({
          error: 'Unauthorized - barbershopId not found in token',
        });
      }

      // Optional: Allow query param but validate ownership
      const queryBarbershopId = parseInt(req.query.barbershopId);
      if (queryBarbershopId && queryBarbershopId !== userBarbershopId) {
        return res.status(403).json({
          error: 'Forbidden - you can only view your own barbershop usage',
        });
      }

      const stats = await WhatsAppUsageService.getStats(userBarbershopId);

      return res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('[WhatsAppController] getUsage error:', error);
      return res.status(500).json({
        error: 'Failed to fetch WhatsApp usage statistics',
        details: error.message,
      });
    }
  }

  /**
   * POST /api/whatsapp/buy-credits
   * Inicia processo de compra de créditos WhatsApp via Stripe
   * Body: { package: "100" | "300" | "1000" }
   *
   * Response: { url: "https://checkout.stripe.com/..." }
   */
  static async buyCredits(req, res) {
    try {
      // Get barbershopId from authenticated user
      const userBarbershopId = req.user?.barbershopId;
      if (!userBarbershopId) {
        return res.status(401).json({
          error: 'Unauthorized - barbershopId not found in token',
        });
      }

      const { package: packageName } = req.body;

      if (!packageName) {
        return res.status(400).json({
          error: 'package is required (100, 250, or 700)',
        });
      }

      // Verify Stripe is configured
      if (!StripeService.isConfigured()) {
        return res.status(503).json({
          error: 'Stripe não configurado. Configure STRIPE_SECRET_KEY.',
        });
      }

      // Build redirect URLs
      const baseUrl = process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
      const successUrl = `${baseUrl}/admin?payment=success&type=whatsapp_credits`;
      const cancelUrl = `${baseUrl}/admin?payment=cancelled&type=whatsapp_credits`;

      // Create Stripe checkout session
      const stripeSession = await StripeService.createWhatsAppCreditsSession({
        barbershopId: userBarbershopId,
        packageQuantity: parseInt(packageName),
        successUrl,
        cancelUrl,
      });

      return res.status(200).json({
        success: true,
        data: {
          url: stripeSession.url,
          sessionId: stripeSession.sessionId,
        },
      });
    } catch (error) {
      console.error('[WhatsAppController] buyCredits error:', error);

      return res.status(500).json({
        error: 'Failed to initiate credit purchase',
        details: error.message,
      });
    }
  }
}
