const express = require('express');
const { auth } = require('../../middleware/auth');
const hub = require('./hub');

const router = express.Router();

router.get('/', auth, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const channel =
    req.user.role === 'admin' ? 'admin' : `author:${req.user.authorId}`;

  // Send immediate comment + welcome event so Vite/proxies flush the stream
  res.write(`: connected to ${channel}\n\n`);
  res.write(
    `data: ${JSON.stringify({ type: 'connected', channel, timestamp: Date.now() })}\n\n`
  );

  const unsubscribe = hub.subscribe(channel, res);

  req.on('close', () => {
    unsubscribe();
    res.end();
  });
});

module.exports = router;