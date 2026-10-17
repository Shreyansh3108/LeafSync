const express = require('express');
const controller = require('./controller');
const validate = require('../../middleware/validate');
const { auth } = require('../../middleware/auth');
const { createRateLimiter } = require('../../middleware/rateLimit');
const { z } = require('zod');

const router = express.Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const loginLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 20,
  message: 'Too many login attempts, please wait a minute',
});

router.post('/login', loginLimiter, validate(loginSchema), controller.login);
router.post('/logout', controller.logout);
router.get('/me', auth, controller.me);

module.exports = router;