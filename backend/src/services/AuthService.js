import User from '../models/User.js';
import Barber from '../models/Barber.js';
import { hashPassword, comparePassword, generateJWT, validateEmail, createValidationError, createNotFoundError } from '../middlewares/validators.js';

export class AuthService {
  static async register(email, password, name, barbershopId, role = 'barber') {
    // Validate email
    if (!validateEmail(email)) {
      throw createValidationError('Invalid email format');
    }

    // Validate barbershop_id is provided (except for platform_owner)
    if (!barbershopId && role !== 'platform_owner') {
      throw createValidationError('Barbershop ID is required');
    }

    // Validate role
    const validRoles = ['platform_owner', 'owner', 'admin', 'barber'];
    if (!validRoles.includes(role)) {
      throw createValidationError(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      throw createValidationError('Email already registered');
    }

    // Hash password
    const password_hash = await hashPassword(password);

    // Create user
    const userId = await User.create({
      name,
      email,
      password_hash,
      role,
      barbershop_id: barbershopId,
    });

    const user = await User.findById(userId);
    const token = generateJWT(user);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
    };
  }

  static async login(email, password) {
    // Find user by email
    const user = await User.findByEmail(email);
    if (!user) {
      throw createValidationError('Invalid email or password');
    }

    // Compare password
    const passwordMatch = await comparePassword(password, user.password_hash);
    if (!passwordMatch) {
      throw createValidationError('Invalid email or password');
    }

    const token = generateJWT(user);

    const response = {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        barbershopId: user.barbershop_id,
      },
      token,
    };

    // Se é barbeiro, buscar barber_id vinculado
    if (user.role === 'barber') {
      const barber = await Barber.findByUserId(user.id);
      if (barber) {
        response.user.barberId = barber.id;
      }
    }

    return response;
  }

  static async createAdminUser(email, password, name, barbershopId) {
    // Validate email
    if (!validateEmail(email)) {
      throw createValidationError('Invalid email format');
    }

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      throw createValidationError('Email already registered');
    }

    // Hash password
    const password_hash = await hashPassword(password);

    // Create admin user
    const userId = await User.create({
      name,
      email,
      password_hash,
      role: 'admin',
      barbershop_id: barbershopId,
    });

    return userId;
  }

  static async signup(establishmentName, name, email, password, phone) {
    if (!validateEmail(email)) {
      throw createValidationError('Formato de email inválido');
    }

    if (!establishmentName || !name || !password) {
      throw createValidationError('Todos os campos obrigatórios devem ser preenchidos');
    }

    if (password.length < 6) {
      throw createValidationError('A senha deve ter no mínimo 6 caracteres');
    }

    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      throw createValidationError('Este email já está cadastrado');
    }

    // Create slug from establishment name
    const slug = establishmentName
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Import Barbershop model
    const { default: Barbershop } = await import('../models/Barbershop.js');

    // Check if slug already exists, add suffix if needed
    let finalSlug = slug;
    let slugCheck = await Barbershop.findBySlug(finalSlug);
    let suffix = 1;
    while (slugCheck) {
      finalSlug = `${slug}-${suffix}`;
      slugCheck = await Barbershop.findBySlug(finalSlug);
      suffix++;
    }

    // Create barbershop with 7-day trial
    const trialExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const barbershopId = await Barbershop.create({ name: establishmentName, slug: finalSlug });

    // Set trial expiration, subscription_status, owner info
    const pool = (await import('../config/database.js')).default;
    await pool.query(
      'UPDATE barbershops SET trial_expires_at = ?, subscription_status = ?, owner_name = ?, email = ?, phone = ? WHERE id = ?',
      [trialExpires, 'trial', name, email, phone || null, barbershopId]
    );

    // Create admin user
    const password_hash = await hashPassword(password);
    const userId = await User.create({
      name,
      email,
      password_hash,
      role: 'admin',
      barbershop_id: barbershopId,
    });

    const user = await User.findById(userId);
    const token = generateJWT(user);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        barbershopId: barbershopId,
      },
      token,
      barbershop: {
        id: barbershopId,
        name: establishmentName,
        slug: finalSlug,
        trialExpiresAt: trialExpires.toISOString(),
      },
    };
  }
}

export default AuthService;
