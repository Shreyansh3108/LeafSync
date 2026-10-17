const app = require('./app');
const env = require('./config/env');
const logger = require('./utils/logger');
const aiService = require('./ai/ai.service');

app.listen(env.PORT, () => {
  logger.info(`LeafSync Server running on port ${env.PORT}`);

  // Sweep any pending AI classifications on boot and every 60 seconds
  aiService.sweepPendingTickets();
  const sweeper = setInterval(() => {
    aiService.sweepPendingTickets();
  }, 60_000);
  sweeper.unref?.();
});