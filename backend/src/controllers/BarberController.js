import BarberService from '../services/BarberService.js';
import AuthService from '../services/AuthService.js';
import SeatSyncService from '../services/SeatSyncService.js';

export class BarberController {
  static async create(req, res, next) {
    try {
      const { barbershopId, name, photo_url, role, active, email, password } = req.body;

      if (!barbershopId || !name) {
        return res.status(400).json({ error: 'Barbershop ID and name are required' });
      }

      let userId = null;

      // Se email e password foram fornecidos, criar conta de usuário
      if (email && password) {
        const result = await AuthService.register(email, password, name, barbershopId, 'barber');
        userId = result.user.id;
      }

      const barber = await BarberService.createBarber(barbershopId, name, { photo_url, role, active, user_id: userId });

      // Sync seats with Stripe
      await SeatSyncService.syncSeats(barbershopId);

      res.status(201).json(barber);
    } catch (error) {
      next(error);
    }
  }

  static async getByBarbershop(req, res, next) {
    try {
      const { barbershopId } = req.params;

      if (!barbershopId) {
        return res.status(400).json({ error: 'Barbershop ID is required' });
      }

      const barbers = await BarberService.getBarbersByBarbershop(parseInt(barbershopId));
      res.json({ barbers });
    } catch (error) {
      next(error);
    }
  }

  static async getAvailable(req, res, next) {
    try {
      const { barbershopId } = req.params;

      if (!barbershopId) {
        return res.status(400).json({ error: 'Barbershop ID is required' });
      }

      const barbers = await BarberService.getAvailableBarbers(parseInt(barbershopId));
      res.json({ barbers });
    } catch (error) {
      next(error);
    }
  }

  static async updateStatus(req, res, next) {
    try {
      const { barberId, status } = req.body;

      if (!barberId || !status) {
        return res.status(400).json({ error: 'Barber ID and status are required' });
      }

      const barber = await BarberService.updateBarberStatus(barberId, status);
      res.json(barber);
    } catch (error) {
      next(error);
    }
  }

  static async getById(req, res, next) {
    try {
      const { barberId } = req.params;

      if (!barberId) {
        return res.status(400).json({ error: 'Barber ID is required' });
      }

      const barber = await BarberService.getBarber(parseInt(barberId));
      res.json(barber);
    } catch (error) {
      next(error);
    }
  }

  static async update(req, res, next) {
    try {
      const { barberId } = req.params;
      const data = req.body;

      if (!barberId) {
        return res.status(400).json({ error: 'Barber ID is required' });
      }

      const barber = await BarberService.updateBarber(parseInt(barberId), data);

      // Sync seats if active status changed
      if (data.active !== undefined && barber.barbershop_id) {
        await SeatSyncService.syncSeats(barber.barbershop_id);
      }

      res.json(barber);
    } catch (error) {
      next(error);
    }
  }

  static async delete(req, res, next) {
    try {
      const { barberId } = req.params;

      if (!barberId) {
        return res.status(400).json({ error: 'Barber ID is required' });
      }

      // Get barbershop_id before deleting
      const barber = await BarberService.getBarber(parseInt(barberId));
      const barbershopId = barber?.barbershop_id;

      await BarberService.deleteBarber(parseInt(barberId));

      // Sync seats with Stripe
      if (barbershopId) {
        await SeatSyncService.syncSeats(barbershopId);
      }

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
}

export default BarberController;
