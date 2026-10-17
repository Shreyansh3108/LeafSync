const AppError = require('../utils/AppError');
module.exports = (schema) => (req, res, next) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    const details = parsed.error.issues.map(issue => ({
      field: issue.path.join('.'),
      issue: issue.message
    }));
    return next(new AppError('VALIDATION_ERROR', 400, 'Validation failed', details));
  }
  req.body = parsed.data;
  next();
};