import QueueService from '../services/QueueService.js';

export class QueueController {
  static async join(req, res, next) {
    try {
      const { barbershopId, clientName, barberId, phone } = req.body;

      if (!barbershopId || !clientName) {
        return res.status(400).json({ error: 'Barbershop ID and client name are required' });
      }

      const client = await QueueService.joinQueue(barbershopId, clientName, req.ip, barberId || null, phone || null);
      res.status(201).json({
        id: client.id,
        name: client.name,
        position: client.position,
        status: client.status,
        barber_id: client.barber_id || null,
        token: client.token,
        queue_token: client.queue_token,
        token_expires_at: client.token_expires_at,
      });
    } catch (error) {
      if (error.code === 'DUPLICATE_ENTRY') {
        return res.status(409).json({
          error: error.message,
          code: 'DUPLICATE_ENTRY',
          queueId: error.queueId,
          queueToken: error.queueToken,
        });
      }
      next(error);
    }
  }

  static async recover(req, res, next) {
    try {
      const { token } = req.query;

      if (!token) {
        return res.status(400).json({ error: 'Token is required' });
      }

      const client = await QueueService.recoverByToken(token);
      res.json({
        id: client.id,
        name: client.name,
        position: client.position,
        status: client.status,
        token: client.queue_token,
        token_expires_at: client.token_expires_at,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getQueue(req, res, next) {
    try {
      const { barbershopId } = req.params;

      if (!barbershopId) {
        return res.status(400).json({ error: 'Barbershop ID is required' });
      }

      const result = await QueueService.getQueue(parseInt(barbershopId));
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  static async callNext(req, res, next) {
    try {
      const { barbershopId, barberId } = req.body;

      if (!barbershopId || !barberId) {
        return res.status(400).json({ error: 'Barbershop ID and Barber ID are required' });
      }

      const client = await QueueService.callNextClient(barbershopId, barberId);
      res.json({ client });
    } catch (error) {
      next(error);
    }
  }

  static async finishClient(req, res, next) {
    try {
      const { barbershopId, barberId } = req.body;

      if (!barbershopId || !barberId) {
        return res.status(400).json({ error: 'Barbershop ID and Barber ID are required' });
      }

      const result = await QueueService.finishClient(barbershopId, barberId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  static async acceptClient(req, res, next) {
    try {
      const { clientQueueId, barbershopId } = req.body;

      if (!clientQueueId || !barbershopId) {
        return res.status(400).json({ error: 'Client Queue ID and Barbershop ID are required' });
      }

      const client = await QueueService.acceptClient(clientQueueId, barbershopId);
      res.json({ success: true, client });
    } catch (error) {
      next(error);
    }
  }

  static async remove(req, res, next) {
    try {
      const { queueId, barbershopId } = req.body;

      if (!queueId || !barbershopId) {
        return res.status(400).json({ error: 'Queue ID and Barbershop ID are required' });
      }

      await QueueService.removeClient(queueId, barbershopId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  static async skip(req, res, next) {
    try {
      const { queueId, barbershopId } = req.body;

      if (!queueId || !barbershopId) {
        return res.status(400).json({ error: 'Queue ID and Barbershop ID are required' });
      }

      await QueueService.skipClient(queueId, barbershopId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  static async monitor(req, res, next) {
    try {
      const { barbershopId } = req.params;

      if (!barbershopId) {
        return res.status(400).json({ error: 'Barbershop ID is required' });
      }

      const monitor = await QueueService.getQueueMonitor(parseInt(barbershopId));
      res.json(monitor);
    } catch (error) {
      next(error);
    }
  }

  static async history(req, res, next) {
    try {
      const { barbershopId } = req.params;
      const { limit = 50 } = req.query;

      if (!barbershopId) {
        return res.status(400).json({ error: 'Barbershop ID is required' });
      }

      const history = await QueueService.getQueueHistory(parseInt(barbershopId), parseInt(limit));
      res.json({ history });
    } catch (error) {
      next(error);
    }
  }
}

export default QueueController;
