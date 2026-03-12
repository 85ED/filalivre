import Queue from '../models/Queue.js';
import Barber from '../models/Barber.js';
import WhatsAppUsageService from './WhatsAppUsageService.js';

/**
 * WhatsAppNotificationService
 * Gerencia lógica de envio de notificações com rate limiting
 *
 * Rate limit: máximo 1 envio a cada 300ms por barbershop
 * Isso evita travar o Chromium quando muitas notificações ocorrem juntas
 */
export class WhatsAppNotificationService {
  // Map para rastrear últimas notificações por barbershop (rate limiting)
  static lastNotificationTime = new Map();

  // Delay mínimo entre notificações (em ms)
  static NOTIFICATION_DELAY_MS = 300;

  /**
   * Verificar se pode enviar notificação (respeitando rate limit)
   */
  static async canSendNotification(barbershopId) {
    const now = Date.now();
    const lastTime = this.lastNotificationTime.get(barbershopId) || 0;
    const timeSinceLastNotification = now - lastTime;

    return timeSinceLastNotification >= this.NOTIFICATION_DELAY_MS;
  }

  /**
   * Aguardar se necessário para respeitar rate limit
   */
  static async waitIfNeeded(barbershopId) {
    const now = Date.now();
    const lastTime = this.lastNotificationTime.get(barbershopId) || 0;
    const timeSinceLastNotification = now - lastTime;

    if (timeSinceLastNotification < this.NOTIFICATION_DELAY_MS) {
      const waitTime = this.NOTIFICATION_DELAY_MS - timeSinceLastNotification;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastNotificationTime.set(barbershopId, Date.now());
  }

  /**
   * Determinar se o cliente deve receber notificação
   *
   * Condições:
   * - position <= 3 (próximo a ser atendido)
   * - position > number_of_barbers (não há barber livre para ele)
   * - notificado_whatsapp = 0 (primeira e única notificação)
   */
  static async shouldNotify(barbershopId, queueId, clientPosition) {
    try {
      // Buscar cliente
      const client = await Queue.findById(queueId);
      if (!client || client.notificado_whatsapp) {
        return false; // Já foi notificado
      }

      // Buscar número de barbeiros disponíveis
      const barbers = await Barber.findByBarbershop(barbershopId);
      const numBarbers = barbers.length;

      // Regras de negócio
      const positionCheck = clientPosition <= 3;
      const urgencyCheck = clientPosition > numBarbers;

      return positionCheck && urgencyCheck;
    } catch (error) {
      console.error('[WhatsAppNotificationService] Error checking should notify:', error.message);
      return false;
    }
  }

  /**
   * Enviar notificação via WhatsApp
   * Chamaria o endpoint /api/whatsapp/send no serviço WhatsApp
   */
  static async sendNotification(barbershopId, clientPhone, clientName, position) {
    try {
      // Validar telefone (formato básico)
      if (!clientPhone || clientPhone.length < 10) {
        console.warn('[WhatsAppNotificationService] Invalid phone number', clientPhone);
        return { success: false, error: 'Invalid phone number' };
      }

      // Aqui seria feita a chamada para o serviço WhatsApp
      // Por exemplo: POST /api/whatsapp/send
      // Temporariamente, apenas logar
      console.log(`[WhatsAppNotificationService] Would send notification to ${clientPhone}`);
      console.log(`   Client: ${clientName}, Position: ${position}`);

      // TODO: Implementar chamada real ao serviço WhatsApp
      // const response = await fetch(`${WHATSAPP_SERVICE_URL}/send`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     phone: clientPhone,
      //     message: `Olá ${clientName}! Você está na posição ${position} da fila.`,
      //   })
      // });

      return { success: true };
    } catch (error) {
      console.error('[WhatsAppNotificationService] Error sending notification:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Notificar cliente se elegível
   * Esta é a função principal chamada no QueueService.callNextClient()
   */
  static async notifyIfEligible(barbershopId, queueId) {
    try {
      // 1. Verificar se pode enviar (limite)
      const canSend = await WhatsAppUsageService.canSendMessage(barbershopId);
      if (!canSend) {
        const stats = await WhatsAppUsageService.getStats(barbershopId);
        console.warn(
          `[WhatsAppNotificationService] Limit reached for barbershop ${barbershopId}. ` +
          `Used: ${stats.used}/${stats.total_available}`
        );
        return { sent: false, reason: 'Limit reached', stats };
      }

      // 2. Buscar cliente e posição
      const client = await Queue.findById(queueId);
      if (!client) {
        return { sent: false, reason: 'Client not found' };
      }

      // 3. Verificar se deve notificar (já notificado? posição? num barbers?)
      const shouldNotify = await this.shouldNotify(barbershopId, queueId, client.position);
      if (!shouldNotify) {
        return { sent: false, reason: 'Does not meet notification criteria' };
      }

      // 4. Aguardar rate limit se necessário
      await this.waitIfNeeded(barbershopId);

      // 5. Enviar notificação
      const sendResult = await this.sendNotification(
        barbershopId,
        client.phone,
        client.name,
        client.position
      );

      if (!sendResult.success) {
        console.error('[WhatsAppNotificationService] Failed to send:', sendResult.error);
        return { sent: false, reason: 'Send failed' };
      }

      // 6. Marcar como notificado
      await Queue.update(queueId, { notificado_whatsapp: 1 });

      // 7. Incrementar uso
      await WhatsAppUsageService.incrementUsage(barbershopId);

      // Log sucesso com stats
      const updatedStats = await WhatsAppUsageService.getStats(barbershopId);
      console.log(
        `[WhatsAppNotificationService] ✓ Notification sent to ${client.phone}. ` +
        `Usage: ${updatedStats.used}/${updatedStats.total_available} (${updatedStats.percentage}%)`
      );

      return { sent: true, stats: updatedStats };
    } catch (error) {
      console.error('[WhatsAppNotificationService] Error in notifyIfEligible:', error.message);
      // Não deve bloquear o fluxo da fila
      return { sent: false, reason: 'Unexpected error' };
    }
  }
}

export default WhatsAppNotificationService;
