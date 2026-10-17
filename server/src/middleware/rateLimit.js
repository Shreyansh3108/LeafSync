const AppError = require('../utils/AppError');

function createRateLimiter({ windowMs = 60_000, max = 10, message = 'Too many requests, please try again later' } = {}) {
  const hits = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const key = `${req.ip}:${req.user?.id || 'anon'}:${req.baseUrl}${req.path}`;
    const entry = hits.get(key) || { count: 0, resetAt: now + windowMs };

    if (now > entry.resetAt) {
      entry.count = 0;
      entry.resetAt = now + windowMs;
    }

    entry.count += 1;
    hits.set(key, entry);

    if (entry.count > max) {
      return next(new AppError('RATE_LIMITED', 429, message));
    }

    next();
  };
}

module.exports = { createRateLimiter };