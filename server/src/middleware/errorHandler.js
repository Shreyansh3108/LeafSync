const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

module.exports = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL';
  const message = err.message || 'An unexpected error occurred';
  const details = err.details || [];

  if (statusCode === 500) {
    logger.error({ err, reqId: req.id }, 'Unhandled Exception');
  }

  res.status(statusCode).json({
    error: { code, message, details },
    requestId: req.id
  });
};