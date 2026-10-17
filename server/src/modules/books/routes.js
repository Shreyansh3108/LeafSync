const express = require('express');
const controller = require('./controller');
const { auth, requireRole } = require('../../middleware/auth');

const router = express.Router();

router.use(auth, requireRole('author'));

router.get('/', controller.list);
router.get('/:id', controller.getById);

module.exports = router;