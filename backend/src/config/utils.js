import crypto from 'crypto';

export const generateToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

export const getEnv = (key, defaultValue = null) => {
  const value = process.env[key];
  if (!value && !defaultValue) {
    throw new Error(`Environment variable ${key} not found`);
  }
  return value || defaultValue;
};
