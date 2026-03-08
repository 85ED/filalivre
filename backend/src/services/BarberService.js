import Barber from '../models/Barber.js';
import { createValidationError, createNotFoundError } from '../middlewares/validators.js';

export class BarberService {
  static async createBarber(barbershopId, name, { photo_url, role, active } = {}) {
    if (!name || name.trim() === '') {
      throw createValidationError('Barber name is required');
    }

    const barberId = await Barber.create(barbershopId, name.trim(), { photo_url, role, active });
    const barber = await Barber.findById(barberId);

    return barber;
  }

  static async getBarbersByBarbershop(barbershopId) {
    const barbers = await Barber.findByBarbershop(barbershopId);
    return barbers;
  }

  static async getAvailableBarbers(barbershopId) {
    const barbers = await Barber.findAvailableByBarbershop(barbershopId);
    return barbers;
  }

  static async updateBarberStatus(barberId, status) {
    const validStatuses = ['available', 'serving', 'paused', 'offline'];

    if (!validStatuses.includes(status)) {
      throw createValidationError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const barber = await Barber.findById(barberId);
    if (!barber) {
      throw createNotFoundError('Barber not found');
    }

    // If setting to offline or paused, clear current client
    if (['offline', 'paused'].includes(status)) {
      await Barber.setCurrentClient(barberId, null);
    }

    await Barber.updateStatus(barberId, status);
    const updatedBarber = await Barber.findById(barberId);

    return updatedBarber;
  }

  static async getBarber(barberId) {
    const barber = await Barber.findById(barberId);
    if (!barber) {
      throw createNotFoundError('Barber not found');
    }
    return barber;
  }

  static async updateBarber(barberId, data) {
    const barber = await Barber.findById(barberId);
    if (!barber) {
      throw createNotFoundError('Barber not found');
    }

    await Barber.update(barberId, data);
    const updatedBarber = await Barber.findById(barberId);

    return updatedBarber;
  }

  static async deleteBarber(barberId) {
    const barber = await Barber.findById(barberId);
    if (!barber) {
      throw createNotFoundError('Barber not found');
    }

    await Barber.delete(barberId);
    return true;
  }
}

export default BarberService;
