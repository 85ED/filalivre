import User from '../models/User.js';
import Barber from '../models/Barber.js';
import crypto from 'crypto';
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

  static async forgotPassword(email) {
    const user = await User.findByEmail(email);
    if (!user) return; // não revelar se existe

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min
    await User.setResetToken(user.id, token, expiresAt);

    // Enviar email via SendGrid
    const sgMail = (await import('@sendgrid/mail')).default;
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const link = `https://filalivre.app.br/resetar-senha?token=${token}`;
    await sgMail.send({
      to: email,
      from: 'no-reply@filalivre.app.br',
      subject: 'Recuperação de senha - FilaLivre',
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <div style="background:#0f172a;padding:32px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:28px;letter-spacing:-0.5px;">FilaLivre</h1>
            <p style="color:#94a3b8;margin:8px 0 0;font-size:14px;">Sistema inteligente de fila de atendimento</p>
          </div>
          <div style="padding:32px;">
            <h2 style="color:#1e293b;font-size:20px;margin:0 0 16px;">Redefinição de senha</h2>
            <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px;">
              Recebemos uma solicitação para redefinir sua senha. Clique no botão abaixo para criar uma nova senha:
            </p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${link}" style="display:inline-block;padding:14px 32px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:16px;">
                Redefinir minha senha
              </a>
            </div>
            <p style="color:#94a3b8;font-size:13px;line-height:1.5;margin:24px 0 0;">
              Este link expira em <strong>15 minutos</strong>. Se você não solicitou essa alteração, ignore este e-mail.
            </p>
          </div>
          <div style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e5e7eb;text-align:center;">
            <p style="color:#94a3b8;font-size:12px;margin:0;">FilaLivre &copy; ${new Date().getFullYear()} &bull; Sistema de gestão de filas</p>
          </div>
        </div>
      `,
    });
  }

  static async resetPassword(token, newPassword) {
    if (!token || !newPassword) {
      throw createValidationError('Token e nova senha são obrigatórios');
    }
    if (newPassword.length < 6) {
      throw createValidationError('A senha deve ter no mínimo 6 caracteres');
    }

    const user = await User.findByResetToken(token);
    if (!user) {
      throw createValidationError('Token inválido ou expirado');
    }

    const password_hash = await hashPassword(newPassword);
    await User.updatePassword(user.id, password_hash);
  }
}

export default AuthService;
