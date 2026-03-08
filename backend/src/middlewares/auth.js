import jwt from 'jsonwebtoken';

export const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token', details: error.message });
  }
};

export const roleMiddleware = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied. Required roles: ' + roles.join(', ') });
    }

    next();
  };
};

export const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);
  
  if (err.isValidationError) {
    return res.status(400).json({ error: err.message });
  }

  if (err.isNotFoundError) {
    return res.status(404).json({ error: err.message });
  }

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
};

export const notFoundHandler = (req, res) => {
  res.status(404).json({ error: 'Route not found' });
};
