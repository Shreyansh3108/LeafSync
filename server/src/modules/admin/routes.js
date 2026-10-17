const express = require('express');
const controller = require('./controller');
const { auth, requireRole } = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const { createRateLimiter } = require('../../middleware/rateLimit');
const {
  patchTicketSchema,
  adminReplySchema,
  internalNoteSchema,
} = require('./schemas');

const router = express.Router();

// Enforce admin role once at the router level so no admin route can be forgotten
router.use(auth, requireRole('admin'));

const regenerateLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 8,
  message: 'Draft regeneration rate limit reached. Please wait a moment.',
});

router.get('/tickets', controller.getQueue);
router.get('/tickets/:id', controller.getTicketDetail);
router.patch('/tickets/:id', validate(patchTicketSchema), controller.patchTicket);
router.post('/tickets/:id/messages', validate(adminReplySchema), controller.sendReply);

router.get('/tickets/:id/notes', controller.listNotes);
router.post('/tickets/:id/notes', validate(internalNoteSchema), controller.addNote);

router.get('/tickets/:id/draft', controller.getDraft);
router.post('/tickets/:id/draft/regenerate', regenerateLimiter, controller.regenerateDraft);
router.post('/tickets/:id/classify', controller.reclassify);

router.get('/stats', controller.getStats);
router.get('/ai/usage', controller.getAiUsage);

module.exports = router;