import User from '../models/User.js';
import { hashPassword, comparePassword, generateJWT, validateEmail, createValidationError, createNotFoundError } from '../middlewares/validators.js';

export class AuthService {
  static async register(email, password, name, barbershopId, role = 'barber') {
    // Validate email
    if (!validateEmail(email)) {
      throw createValidationError('Invalid email format');
    }

    // Validate barbershop_id is provided
    if (!barbershopId) {
      throw createValidationError('Barbershop ID is required');
    }

    // Validate role
    const validRoles = ['owner', 'admin', 'barber'];
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

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        barbershopId: user.barbershop_id,
      },
      token,
    };
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
}

export default AuthService;
