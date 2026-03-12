import pool from '../config/database.js';
import Queue from '../models/Queue.js';

/**
 * WhatsAppUsageService
 * Gerencia limite de notificações e créditos por estabelecimento
 */
export class WhatsAppUsageService {
  /**
   * Obter ou criar registro de uso do mês atual
   */
  static async getOrCreateMonthlyUsage(barbershopId) {
    const currentMonth = new Date();
    currentMonth.setDate(1);
    const mesReferencia = currentMonth.toISOString().split('T')[0]; // YYYY-MM-01

    try {
      // Tentar buscar
      const [rows] = await pool.query(
        `SELECT * FROM whatsapp_usage 
         WHERE barbershop_id = ? AND mes_referencia = ?`,
        [barbershopId, mesReferencia]
      );

      if (rows.length > 0) {
        return rows[0];
      }

      // Se não existir, criar
      await pool.query(
        `INSERT INTO whatsapp_usage (barbershop_id, mes_referencia, notificacoes_enviadas, limite_mensal, creditos_extra)
         VALUES (?, ?, 0, 500, 0)`,
        [barbershopId, mesReferencia]
      );

      const [newRows] = await pool.query(
        `SELECT * FROM whatsapp_usage 
         WHERE barbershop_id = ? AND mes_referencia = ?`,
        [barbershopId, mesReferencia]
      );

      return newRows[0];
    } catch (error) {
      console.error('[WhatsAppUsageService] Error getting/creating usage:', error.message);
      throw error;
    }
  }

  /**
   * Verificar se pode enviar notificação (limite não atingido)
   */
  static async canSendMessage(barbershopId) {
    try {
      const usage = await this.getOrCreateMonthlyUsage(barbershopId);
      const limitTotal = usage.limite_mensal + usage.creditos_extra;
      return usage.notificacoes_enviadas < limitTotal;
    } catch (error) {
      console.error('[WhatsAppUsageService] Error checking can send:', error.message);
      return false;
    }
  }

  /**
   * Obter estatísticas de uso
   */
  static async getStats(barbershopId) {
    try {
      const usage = await this.getOrCreateMonthlyUsage(barbershopId);
      const limitTotal = usage.limite_mensal + usage.creditos_extra;
      const canSend = usage.notificacoes_enviadas < limitTotal;
      const percentage = Math.round((usage.notificacoes_enviadas / limitTotal) * 100);

      // Alert threshold: 80% usage
      const alertThreshold = 80;
      const alertActive = percentage >= alertThreshold && percentage < 100;

      return {
        used: usage.notificacoes_enviadas,
        limit: usage.limite_mensal,
        extra_credits: usage.creditos_extra,
        total_available: limitTotal,
        percentage,
        can_send: canSend,
        alert: {
          active: alertActive,
          threshold: alertThreshold,
          message: alertActive ? `Você está usando ${percentage}% das notificações disponíveis` : null,
        },
      };
    } catch (error) {
      console.error('[WhatsAppUsageService] Error getting stats:', error.message);
      throw error;
    }
  }

  /**
   * Incrementar contador de notificações
   */
  static async incrementUsage(barbershopId) {
    try {
      const usage = await this.getOrCreateMonthlyUsage(barbershopId);

      await pool.query(
        `UPDATE whatsapp_usage 
         SET notificacoes_enviadas = notificacoes_enviadas + 1
         WHERE id = ?`,
        [usage.id]
      );

      // Log de uso
      await this.logMovement(
        barbershopId,
        'uso',
        -1,
        `Notificação enviada`,
        null
      );

      return true;
    } catch (error) {
      console.error('[WhatsAppUsageService] Error incrementing usage:', error.message);
      throw error;
    }
  }

  /**
   * Adicionar créditos (após pagamento Stripe)
   */
  static async addCredits(barbershopId, quantity, stripeTransactionId) {
    try {
      const usage = await this.getOrCreateMonthlyUsage(barbershopId);

      await pool.query(
        `UPDATE whatsapp_usage 
         SET creditos_extra = creditos_extra + ?
         WHERE id = ?`,
        [quantity, usage.id]
      );

      // Log de compra
      await this.logMovement(
        barbershopId,
        'compra',
        quantity,
        `Compra de ${quantity} notificações via Stripe`,
        stripeTransactionId
      );

      return true;
    } catch (error) {
      console.error('[WhatsAppUsageService] Error adding credits:', error.message);
      throw error;
    }
  }

  /**
   * Registrar movimentação de créditos (auditoria)
   */
  static async logMovement(barbershopId, tipo, quantidade, descricao, stripeId) {
    try {
      const usage = await this.getOrCreateMonthlyUsage(barbershopId);
      const saldoAnterior = usage.notificacoes_enviadas;
      const saldoPosterior = saldoAnterior + quantidade;

      await pool.query(
        `INSERT INTO whatsapp_credits_log (barbershop_id, tipo_movimento, quantidade, saldo_anterior, saldo_posterior, descricao, stripe_transaction_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [barbershopId, tipo, quantidade, saldoAnterior, saldoPosterior, descricao, stripeId]
      );

      return true;
    } catch (error) {
      console.error('[WhatsAppUsageService] Error logging movement:', error.message);
      // Não deve bloquear o fluxo principal
      return false;
    }
  }

  /**
   * Listar pacotes disponíveis para compra
   * Retorna array de pacotes configurados
   *
   * Preços: 100 notificações = R$10, 300 = R$20, 1000 = R$50
   */
  static async createCheckout() {
    const packages = [
      {
        quantity: 100,
        price: 10.00,
        priceFormatted: 'R$ 10,00',
        description: '100 notificações WhatsApp',
      },
      {
        quantity: 300,
        price: 20.00,
        priceFormatted: 'R$ 20,00',
        description: '300 notificações WhatsApp',
      },
      {
        quantity: 1000,
        price: 50.00,
        priceFormatted: 'R$ 50,00',
        description: '1000 notificações WhatsApp',
      },
    ];

    return packages;
  }
}

export default WhatsAppUsageService;
