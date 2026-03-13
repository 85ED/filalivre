import Queue from '../models/Queue.js';
import Barber from '../models/Barber.js';
import { createValidationError, createNotFoundError } from '../middlewares/validators.js';
import WhatsAppNotificationService from './WhatsAppNotificationService.js';

export class QueueService {
  static async joinQueue(barbershopId, clientName, clientIp = null, barberId = null, phone = null) {
    if (!clientName || clientName.trim() === '') {
      throw createValidationError('Client name is required');
    }

    // If barberId provided, verify barber exists
    if (barberId) {
      const barber = await Barber.findById(barberId);
      if (!barber || barber.barbershop_id !== barbershopId) {
        throw createValidationError('Barber not found or does not belong to this barbershop');
      }
    }

    try {
      const queueData = await Queue.create({
        barbershop_id: barbershopId,
        name: clientName.trim(),
        phone: phone ? phone.trim() : null,
        client_ip: clientIp,
        barber_id: barberId,
      });

      const fullQueue = await Queue.findById(queueData.id);
      return {
        ...fullQueue,
        token: queueData.token, // Include token in response
      };
    } catch (error) {
      if (error.code === 'DUPLICATE_ENTRY') {
        const dupError = createValidationError(error.message);
        dupError.code = 'DUPLICATE_ENTRY';
        dupError.queueId = error.queueId;
        dupError.queueToken = error.queueToken;
        throw dupError;
      }
      throw error;
    }
  }

  // Recuperar fila existente por token (para refresh de página)
  static async recoverByToken(token) {
    const queue = await Queue.findByToken(token);
    if (!queue) {
      throw createNotFoundError('Queue token not found or expired');
    }
    return queue;
  }

  static async getQueue(barbershopId) {
    const queue = await Queue.findByBarbershop(barbershopId);
    const stats = await Queue.getQueueStats(barbershopId);

    return {
      queue,
      stats,
    };
  }

  static async callNextClient(barbershopId, barberId) {
    // Verify barber exists and belongs to this barbershop
    const barber = await Barber.findById(barberId);
    if (!barber || barber.barbershop_id !== barbershopId) {
      throw createValidationError('Barber not found or does not belong to this barbershop');
    }

    // Get next client
    const clientQueueId = await Queue.callNext(barbershopId, barberId);

    if (!clientQueueId) {
      return null; // No waiting clients
    }

    // Update barber status to serving
    await Barber.updateStatus(barberId, 'serving');
    await Barber.setCurrentClient(barberId, clientQueueId);

    const client = await Queue.findById(clientQueueId);

    // Trigger WhatsApp notification asynchronously (non-blocking)
    try {
      WhatsAppNotificationService.notifyIfEligible(barbershopId, clientQueueId).catch((err) => {
        console.error('[Queue] WhatsApp notification error:', err.message);
      });
    } catch (err) {
      console.error('[Queue] Failed to trigger WhatsApp notification:', err.message);
      // Don't block queue operations if notification fails
    }

    return client;
  }

  static async finishClient(barbershopId, barberId) {
    // Get barber's current client
    const barber = await Barber.findById(barberId);
    if (!barber) {
      throw createNotFoundError('Barber not found');
    }

    if (!barber.current_client_id) {
      throw createValidationError('Barber has no current client');
    }

    // Mark as finished - ONLY finish, do NOT call next automatically
    await Queue.updateStatus(barber.current_client_id, 'finished');
    await Barber.setCurrentClient(barberId, null);

    // Set barber to available - waiting for them to call next themselves
    await Barber.updateStatus(barberId, 'available');

    return { finished: true };
  }

  // Aceita cliente que foi chamado, mudando de 'called' para 'serving' + iniciando timer
  static async acceptClient(clientQueueId, barbershopId) {
    const client = await Queue.findById(clientQueueId);
    if (!client || client.barbershop_id !== barbershopId) {
      throw createNotFoundError('Queue entry not found');
    }

    if (client.status !== 'called') {
      throw createValidationError('Client is not in the "called" state');
    }

    // Move client from 'called' to 'serving' and start timer
    const accepted = await Queue.acceptClient(clientQueueId);
    if (!accepted) {
      throw createValidationError('Failed to accept client');
    }

    const updatedClient = await Queue.findById(clientQueueId);
    return updatedClient;
  }

  static async removeClient(queueId, barbershopId) {
    const client = await Queue.findById(queueId);
    if (!client || client.barbershop_id !== barbershopId) {
      throw createNotFoundError('Queue entry not found');
    }

    await Queue.remove(queueId);
    return true;
  }

  static async skipClient(queueId, barbershopId) {
    const client = await Queue.findById(queueId);
    if (!client || client.barbershop_id !== barbershopId) {
      throw createNotFoundError('Queue entry not found');
    }

    const newSkipCount = (client.skip_count || 0) + 1;

    // If skipped 3 times, remove from queue
    if (newSkipCount >= 3) {
      await Queue.updateStatus(queueId, 'no_show');
      // Free the barber if this client was being served
      if (client.barber_id) {
        await Barber.setCurrentClient(client.barber_id, null);
        await Barber.updateStatus(client.barber_id, 'available');
      }
      return { removed: true, skipCount: newSkipCount };
    }

    // Move client behind the next person in queue
    await Queue.skipAndReposition(queueId, barbershopId, newSkipCount);
    // Free the barber if this client was being served
    if (client.barber_id && (client.status === 'serving' || client.status === 'called')) {
      await Barber.setCurrentClient(client.barber_id, null);
      await Barber.updateStatus(client.barber_id, 'available');
    }
    return { removed: false, skipCount: newSkipCount };
  }

  static async getQueueMonitor(barbershopId) {
    const queue = await Queue.findByBarbershop(barbershopId);
    const barbers = await Barber.findByBarbershop(barbershopId);
    const stats = await Queue.getQueueStats(barbershopId);

    return {
      queue,
      barbers,
      stats,
      timestamp: new Date(),
    };
  }

  static async getQueueHistory(barbershopId, limit = 50) {
    const history = await Queue.getQueueHistory(barbershopId, limit);
    return history;
  }
}

export default QueueService;
