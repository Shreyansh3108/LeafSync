const express = require('express');
const controller = require('./controller');
const { auth, requireRole } = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const { createTicketSchema, createMessageSchema } = require('./schemas');

const router = express.Router();

router.use(auth, requireRole('author'));

router.get('/', controller.list);
router.post('/', validate(createTicketSchema), controller.create);
router.get('/:id', controller.getById);
router.post('/:id/messages', validate(createMessageSchema), controller.addMessage);

module.exports = router;