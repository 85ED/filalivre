import Barbershop from '../models/Barbershop.js';
import User from '../models/User.js';
import { createValidationError, createNotFoundError } from '../middlewares/validators.js';

export class BarbershopService {
  static async createBarbershop(name, slug) {
    if (!name || name.trim() === '') {
      throw createValidationError('Barbershop name is required');
    }

    if (!slug || slug.trim() === '') {
      throw createValidationError('Slug is required');
    }

    // Check if slug already exists
    const existing = await Barbershop.findBySlug(slug.toLowerCase());
    if (existing) {
      throw createValidationError('Slug already exists');
    }

    const barbershopId = await Barbershop.create({
      name: name.trim(),
      slug: slug.toLowerCase(),
    });

    const barbershop = await Barbershop.findById(barbershopId);
    return barbershop;
  }

  static async getBarbershop(id) {
    const barbershop = await Barbershop.findById(id);
    if (!barbershop) {
      throw createNotFoundError('Barbershop not found');
    }

    // Get barbershop staff
    const staff = await User.findByBarbershop(id);
    barbershop.staff = staff;

    return barbershop;
  }

  static async getBarbershopBySlug(slug) {
    const barbershop = await Barbershop.findBySlug(slug);
    if (!barbershop) {
      throw createNotFoundError('Barbershop not found');
    }
    return barbershop;
  }

  static async getAllBarbershops() {
    const barbershops = await Barbershop.findAll();
    return barbershops;
  }

  static async updateBarbershop(id, data) {
    const barbershop = await Barbershop.findById(id);
    if (!barbershop) {
      throw createNotFoundError('Barbershop not found');
    }

    // Check if slug is being updated and if it already exists
    if (data.slug && data.slug !== barbershop.slug) {
      const existing = await Barbershop.findBySlug(data.slug.toLowerCase());
      if (existing) {
        throw createValidationError('Slug already exists');
      }
    }

    await Barbershop.update(id, {
      name: data.name,
      slug: data.slug ? data.slug.toLowerCase() : undefined,
    });

    const updated = await Barbershop.findById(id);
    return updated;
  }

  static async deleteBarbershop(id) {
    const barbershop = await Barbershop.findById(id);
    if (!barbershop) {
      throw createNotFoundError('Barbershop not found');
    }

    await Barbershop.delete(id);
    return true;
  }
}

export default BarbershopService;
