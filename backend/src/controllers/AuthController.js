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
      // Fetch full user data from DB
      const User = (await import('../models/User.js')).default;
      const Barber = (await import('../models/Barber.js')).default;
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      const userData = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        barbershopId: user.barbershop_id,
      };

      // Se é barbeiro, incluir barber_id
      if (user.role === 'barber') {
        const barber = await Barber.findByUserId(user.id);
        if (barber) {
          userData.barberId = barber.id;
        }
      }

      res.json({ user: userData });
    } catch (error) {
      next(error);
    }
  }

  static async signup(req, res, next) {
    try {
      const { establishmentName, name, email, password, phone } = req.body;

      if (!establishmentName || !name || !email || !password) {
        return res.status(400).json({ error: 'Todos os campos obrigatórios devem ser preenchidos' });
      }

      const result = await AuthService.signup(establishmentName, name, email, password, phone);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'Email é obrigatório' });
      }
      await AuthService.forgotPassword(email);
      // Sempre retorna sucesso para não revelar se email existe
      res.json({ message: 'Se o email existir em nossa base, enviaremos um link de recuperação.' });
    } catch (error) {
      // Em caso de erro no envio, ainda retorna sucesso ao usuário
      console.error('Forgot password error:', error);
      res.json({ message: 'Se o email existir em nossa base, enviaremos um link de recuperação.' });
    }
  }

  static async resetPassword(req, res, next) {
    try {
      const { token, password } = req.body;
      if (!token || !password) {
        return res.status(400).json({ error: 'Token e nova senha são obrigatórios' });
      }
      await AuthService.resetPassword(token, password);
      res.json({ message: 'Senha redefinida com sucesso!' });
    } catch (error) {
      next(error);
    }
  }
}

export default AuthController;
