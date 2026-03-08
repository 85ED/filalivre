import AuthService from '../services/AuthService.js';

export class AuthController {
  static async login(req, res, next) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const result = await AuthService.login(email, password);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  static async register(req, res, next) {
    try {
      const { email, password, name, barbershopId, role } = req.body;

      if (!email || !password || !name || !barbershopId) {
        return res.status(400).json({ error: 'Email, password, name, and barbershopId are required' });
      }

      const result = await AuthService.register(email, password, name, barbershopId, role);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async me(req, res, next) {
    try {
      res.json({
        user: req.user,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default AuthController;
