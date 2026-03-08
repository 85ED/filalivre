import User from '../models/User.js';
import { hashPassword } from '../middlewares/validators.js';

const PLATFORM_OWNER = {
  name: 'Edson Felix',
  email: 'edsonfelixnet@gmail.com',
  password: 'Bolsa@2015',
  role: 'platform_owner',
};

export async function seedPlatformOwner() {
  try {
    const existing = await User.findByEmail(PLATFORM_OWNER.email);
    if (existing) {
      console.log('[Seed] Platform owner already exists, skipping.');
      return;
    }

    const password_hash = await hashPassword(PLATFORM_OWNER.password);
    await User.create({
      name: PLATFORM_OWNER.name,
      email: PLATFORM_OWNER.email,
      password_hash,
      role: PLATFORM_OWNER.role,
      barbershop_id: null,
    });

    console.log('[Seed] Platform owner created successfully.');
  } catch (error) {
    console.error('[Seed] Failed to create platform owner:', error.message);
  }
}
