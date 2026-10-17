const jwt = require('jsonwebtoken');
const env = require('../config/env');
const AppError = require('../utils/AppError');

exports.auth = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) return next(new AppError('UNAUTHENTICATED', 401, 'No token provided'));

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = decoded; // Contains { id, role, authorId }
    next();
  } catch (err) {
    next(new AppError('UNAUTHENTICATED', 401, 'Invalid or expired token'));
  }
};

exports.requireRole = (role) => (req, res, next) => {
  if (!req.user) return next(new AppError('UNAUTHENTICATED', 401, 'Not authenticated'));
  if (req.user.role !== role) {
    return next(new AppError('FORBIDDEN', 403, 'Insufficient permissions'));
  }
  next();
};