import {
  startSession,
  isSessionActive,
  getLastQR,
  disconnectSession,
  registerSession,
  getSessionFromDB,
} from '../services/WhatsAppService.js';
import WhatsAppUsageService from '../services/WhatsAppUsageService.js';
import StripeService from '../services/StripeService.js';

export default class WhatsAppController {
  static async connect(req, res) {
    try {
      const { barbershopId } = req.params;

      if (!barbershopId) {
        return res.status(400).json({ error: 'barbershopId é obrigatório' });
      }

      const sessionName = 'barbershop_' + barbershopId;

      if (isSessionActive(sessionName)) {
        return res.json({
          success: true,
          message: 'Sessão WhatsApp já está ativa.',
          status: 'connected',
          qr: null,
        });
      }

      const { qr } = await startSession(sessionName);

      // Salva sessão no banco
      await registerSession(barbershopId, qr ? 'waiting_qr' : 'connected');

      res.json({
        success: true,
        message: qr ? 'QR gerado. Escaneie para conectar.' : 'Sessão conectada.',
        status: qr ? 'waiting_qr' : 'connected',
        qr: qr || null,
      });
    } catch (err) {
      console.error('[WhatsApp] Erro ao conectar:', err.message);
      res.status(500).json({ error: 'Erro ao iniciar sessão WhatsApp' });
    }
  }

  static async disconnect(req, res) {
    try {
      const { barbershopId } = req.params;
      const sessionName = 'barbershop_' + barbershopId;

      await disconnectSession(sessionName);
      await registerSession(barbershopId, 'disconnected');

      res.json({
        success: true,
        message: 'Sessão desconectada.',
        status: 'disconnected',
      });
    } catch (err) {
      console.error('[WhatsApp] Erro ao desconectar:', err.message);
      res.status(500).json({ error: 'Erro ao desconectar sessão' });
    }
  }

  static async status(req, res) {
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
  }

  static async qr(req, res) {
    try {
      const { barbershopId } = req.params;
      const sessionName = 'barbershop_' + barbershopId;
      const qr = getLastQR(sessionName);

      res.json({ qr: qr || null });
    } catch (err) {
      res.status(500).json({ error: 'Erro ao buscar QR' });
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
          error: 'package is required (100, 300, or 1000)',
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
