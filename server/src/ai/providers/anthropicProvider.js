const env = require('../../config/env');

module.exports = {
  name: 'anthropic',
  async generateJson({ model, system, user, maxTokens = 300, timeoutMs }) {
    const { text, usage } = await this.generateText({
      model,
      system: `${system}\nRespond ONLY with valid JSON.`,
      user,
      maxTokens,
      timeoutMs,
    });
    const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    return { data: JSON.parse(cleaned), usage };
  },
  async generateText({ model, system, user, maxTokens = 450, timeoutMs }) {
    if (!env.AI_API_KEY) {
      const err = new Error('Missing AI_API_KEY');
      err.code = 'MISSING_API_KEY';
      throw err;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs || env.AI_TIMEOUT_MS);
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.AI_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system,
          messages: [{ role: 'user', content: user }],
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        const err = new Error(`Anthropic HTTP ${res.status}`);
        err.code = `HTTP_${res.status}`;
        throw err;
      }
      const data = await res.json();
      return {
        text: (data.content?.[0]?.text || '').trim(),
        usage: {
          tokensIn: data.usage?.input_tokens || 0,
          tokensOut: data.usage?.output_tokens || 0,
        },
      };
    } finally {
      clearTimeout(timer);
    }
  },
};