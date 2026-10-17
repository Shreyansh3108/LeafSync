const env = require('../../config/env');

module.exports = {
  name: 'openai',
  async generateJson({ model, system, user, maxTokens = 300, timeoutMs }) {
    if (!env.AI_API_KEY) {
      const err = new Error('Missing AI_API_KEY');
      err.code = 'MISSING_API_KEY';
      throw err;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs || env.AI_TIMEOUT_MS);
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.AI_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          response_format: { type: 'json_object' },
          max_tokens: maxTokens,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        const err = new Error(`OpenAI HTTP ${res.status}`);
        err.code = `HTTP_${res.status}`;
        throw err;
      }
      const data = await res.json();
      return {
        data: JSON.parse(data.choices?.[0]?.message?.content || '{}'),
        usage: {
          tokensIn: data.usage?.prompt_tokens || 0,
          tokensOut: data.usage?.completion_tokens || 0,
        },
      };
    } finally {
      clearTimeout(timer);
    }
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
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.AI_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        const err = new Error(`OpenAI HTTP ${res.status}`);
        err.code = `HTTP_${res.status}`;
        throw err;
      }
      const data = await res.json();
      return {
        text: (data.choices?.[0]?.message?.content || '').trim(),
        usage: {
          tokensIn: data.usage?.prompt_tokens || 0,
          tokensOut: data.usage?.completion_tokens || 0,
        },
      };
    } finally {
      clearTimeout(timer);
    }
  },
};