import Queue from '../models/Queue.js';
import Barber from '../models/Barber.js';
import { createValidationError, createNotFoundError } from '../middlewares/validators.js';

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

    // Mark as finished
    await Queue.updateStatus(barber.current_client_id, 'finished');
    await Barber.setCurrentClient(barberId, null);

    // Try to call next client
    const nextClientId = await Queue.callNext(barbershopId, barberId);
    if (nextClientId) {
      await Barber.setCurrentClient(barberId, nextClientId);
      const nextClient = await Queue.findById(nextClientId);
      return { finished: true, nextClient };
    }

    // No more clients, set barber to available
    await Barber.updateStatus(barberId, 'available');

    return { finished: true, nextClient: null };
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

    // Skip by setting status to no_show
    await Queue.updateStatus(queueId, 'no_show');
    return true;
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
