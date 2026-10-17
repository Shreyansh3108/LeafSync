const env = require('../../config/env');
const geminiProvider = require('./geminiProvider');
const openaiProvider = require('./openaiProvider');
const anthropicProvider = require('./anthropicProvider');

const providers = {
  gemini: geminiProvider,
  openai: openaiProvider,
  anthropic: anthropicProvider,
};

function getAiProvider() {
  return providers[env.AI_PROVIDER] || geminiProvider;
}

module.exports = { getAiProvider };