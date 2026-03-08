import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';

export const generateJWT = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      barbershopId: user.barbershop_id,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

export const hashPassword = async (password) => {
  const saltRounds = 10;
  return bcryptjs.hash(password, saltRounds);
};

export const comparePassword = async (password, hash) => {
  return bcryptjs.compare(password, hash);
};

export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const createValidationError = (message) => {
  const error = new Error(message);
  error.isValidationError = true;
  return error;
};

export const createNotFoundError = (message) => {
  const error = new Error(message);
  error.isNotFoundError = true;
  return error;
};
