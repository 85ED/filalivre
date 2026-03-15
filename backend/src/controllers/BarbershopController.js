import BarbershopService from '../services/BarbershopService.js';
import Barbershop from '../models/Barbershop.js';
import Queue from '../models/Queue.js';
import Barber from '../models/Barber.js';

export class BarbershopController {
  // Platform-owner-only stats
  static async getPlatformStats(req, res, next) {
    try {
      const stats = await Barbershop.getPlatformStats();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  }

  // Subscription status for a barbershop (used by frontend trial check)
  static async getSubscription(req, res, next) {
    try {
      const barbershopId = parseInt(req.params.id);
      const barbershop = await Barbershop.findById(barbershopId);
      if (!barbershop) {
        return res.status(404).json({ error: 'Estabelecimento não encontrado' });
      }
      const trialExpired = barbershop.trial_expires_at && new Date(barbershop.trial_expires_at) <= new Date();
      const isActive = barbershop.subscription_status === 'active';
      const blocked = (barbershop.ativo === 0) || (!isActive && trialExpired);
      const activeCount = await Barber.countActiveByBarbershop(barbershopId);
      const seatPriceCents = barbershop.seat_price_cents || 3500;

      res.json({
        subscriptionStatus: barbershop.subscription_status || 'trial',
        trialExpiresAt: barbershop.trial_expires_at,
        blocked,
        daysRemaining: barbershop.trial_expires_at
          ? Math.max(0, Math.ceil((new Date(barbershop.trial_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
          : null,
        seatPriceCents,
        activeCount,
        totalCents: seatPriceCents * activeCount,
      });
    } catch (error) {
      next(error);
    }
  }

  static async create(req, res, next) {
    try {
      const { name, slug } = req.body;

      if (!name || !slug) {
        return res.status(400).json({ error: 'Name and slug are required' });
      }

      const barbershop = await BarbershopService.createBarbershop(name, slug);
      res.status(201).json(barbershop);
    } catch (error) {
      next(error);
    }
  }

  static async getById(req, res, next) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ error: 'Barbershop ID is required' });
      }

      const barbershop = await BarbershopService.getBarbershop(parseInt(id));
      res.json(barbershop);
    } catch (error) {
      next(error);
    }
  }

  static async getBySlug(req, res, next) {
    try {
      const { slug } = req.params;

      if (!slug) {
        return res.status(400).json({ error: 'Slug is required' });
      }

      const barbershop = await BarbershopService.getBarbershopBySlug(slug);
      res.json(barbershop);
    } catch (error) {
      next(error);
    }
  }

  static async getAll(req, res, next) {
    try {
      const barbershops = await BarbershopService.getAllBarbershops();
      res.json({ barbershops });
    } catch (error) {
      next(error);
    }
  }

  static async update(req, res, next) {
    try {
      const { id } = req.params;
      const data = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Barbershop ID is required' });
      }

      const barbershop = await BarbershopService.updateBarbershop(parseInt(id), data);
      res.json(barbershop);
    } catch (error) {
      next(error);
    }
  }

  static async delete(req, res, next) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ error: 'Barbershop ID is required' });
      }

      await BarbershopService.deleteBarbershop(parseInt(id));
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/barbershops/:id/status — Endpoint unificado
  static async getStatus(req, res, next) {
    try {
      const barbershopId = parseInt(req.params.id);
      if (!barbershopId) {
        return res.status(400).json({ error: 'Barbershop ID is required' });
      }

      const [barbershop, barbers, queueData, stats] = await Promise.all([
        Barbershop.findById(barbershopId),
        Barber.findByBarbershop(barbershopId),
        Queue.findByBarbershop(barbershopId),
        Queue.getQueueStats(barbershopId),
      ]);

      res.json({ barbershop: barbershop ? { id: barbershop.id, name: barbershop.name, slug: barbershop.slug } : null, barbers, queue: queueData, stats });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/barbershops/:id/reports?period=today|week|month
  static async getReports(req, res, next) {
    try {
      const barbershopId = parseInt(req.params.id);
      const period = req.query.period || 'today';

      const now = new Date();
      let startDate, endDate;

      if (period === 'today') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      } else if (period === 'week') {
        const dayOfWeek = now.getDay();
        const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      } else {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      }

      const [totalFinished, avgTime, byBarber, dailyCounts, serviceHeatmap, stats] = await Promise.all([
        Queue.getCountByPeriod(barbershopId, startDate, endDate),
        Queue.getAvgServiceTime(barbershopId, startDate, endDate),
        Queue.getCountByBarber(barbershopId, startDate, endDate),
        Queue.getDailyCountsByMonth(barbershopId, now.getFullYear(), now.getMonth() + 1),
        Queue.getServiceHeatmap(barbershopId, startDate, endDate),
        Queue.getQueueStats(barbershopId),
      ]);

      res.json({
        period,
        totalFinished,
        avgTime,
        currentWaiting: stats.waiting || 0,
        byBarber,
        dailyCounts,
        serviceHeatmap,
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/barbershops/:id/reports/barber/:barberId?period=today|week|month
  static async getBarberReport(req, res, next) {
    try {
      const barbershopId = parseInt(req.params.id);
      const barberId = parseInt(req.params.barberId);
      const period = req.query.period || 'today';

      const now = new Date();
      let startDate, endDate;

      if (period === 'today') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      } else if (period === 'week') {
        const dayOfWeek = now.getDay();
        const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      } else {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      }

      const clients = await Queue.getBarberClients(barbershopId, barberId, startDate, endDate);
      res.json({ barberId, clients });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/barbershops/public-price — returns the price shown on landing page
  static async getPublicPrice(req, res, next) {
    try {
      const priceCents = await BarbershopService.getPlatformSetting('public_seat_price_cents', '3500');
      res.json({ priceCents: parseInt(priceCents) });
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/barbershops/public-price — update the price shown on landing page (platform_owner only)
  static async updatePublicPrice(req, res, next) {
    try {
      const { priceCents } = req.body;
      if (!priceCents || priceCents < 0) {
        return res.status(400).json({ error: 'priceCents deve ser um número positivo' });
      }
      await BarbershopService.updatePlatformSettings('public_seat_price_cents', String(priceCents));
      res.json({ success: true, priceCents });
    } catch (error) {
      next(error);
    }
  }
}

export default BarbershopController;
