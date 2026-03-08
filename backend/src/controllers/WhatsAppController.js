import {
  startSession,
  isSessionActive,
  getLastQR,
  disconnectSession,
  registerSession,
  getSessionFromDB,
} from '../services/WhatsAppService.js';

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
}
