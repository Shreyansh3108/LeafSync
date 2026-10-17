const env = require('../../config/env');
const logger = require('../../utils/logger');

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function getCandidateModels(configuredModel) {
  const clean = (configuredModel || 'gemini-2.5-flash').trim().replace(/^models\//, '');
  // All active Flash text models verified on your Google AI Studio key
  return Array.from(
    new Set([
      clean,
      'gemini-2.5-flash-lite',
      'gemini-2.5-flash',
      'gemini-flash-lite-latest',
      'gemini-flash-latest',
      'gemini-3.1-flash-lite-preview',
      'gemini-3-flash-preview',
    ])
  );
}

async function callGemini({ model, system, user, timeoutMs, jsonMode = false }) {
  const apiKey = (env.AI_API_KEY || '').trim();
  if (!apiKey) {
    const err = new Error('Missing AI_API_KEY');
    err.code = 'MISSING_API_KEY';
    throw err;
  }

  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: {
      maxOutputTokens: 2048,
      temperature: jsonMode ? 0.1 : 0.4,
      ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
    },
  };

  const candidates = getCandidateModels(model);
  let lastErr;

  for (const candidateModel of candidates) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      candidateModel
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs || env.AI_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        const errBody = await res.text();
        logger.warn(
          { model: candidateModel, status: res.status, errBody: errBody.slice(0, 160) },
          'Gemini model busy or rejected, failing over to next Flash model'
        );
        const err = new Error(`Gemini HTTP ${res.status}`);
        err.code = `HTTP_${res.status}`;
        lastErr = err;
        if (res.status === 503 || res.status === 429) {
          await sleep(250);
        }
        continue; // Immediately try the next Flash model in the list
      }

      const data = await res.json();
      const parts = data.candidates?.[0]?.content?.parts || [];
      const text = parts
        .filter((p) => !p.thought && typeof p.text === 'string')
        .map((p) => p.text)
        .join('\n')
        .trim();

      if (!text) {
        const err = new Error('Empty response from Gemini');
        err.code = 'EMPTY_RESPONSE';
        lastErr = err;
        continue;
      }

      const usage = {
        tokensIn: data.usageMetadata?.promptTokenCount || 0,
        tokensOut: data.usageMetadata?.candidatesTokenCount || 0,
      };

      logger.info({ model: candidateModel }, 'Gemini response generated successfully');
      return { text, usage };
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        err.code = 'TIMEOUT';
      }
      lastErr = err;
    }
  }

  throw lastErr;
}

module.exports = {
  name: 'gemini',
  async generateJson({ model, system, user, timeoutMs }) {
    const { text, usage } = await callGemini({
      model,
      system,
      user,
      timeoutMs,
      jsonMode: true,
    });
    const match = text.match(/\{[\s\S]*\}/);
    const jsonStr = match ? match[0] : text;
    return { data: JSON.parse(jsonStr), usage };
  },
  async generateText({ model, system, user, timeoutMs }) {
    const { text, usage } = await callGemini({
      model,
      system,
      user,
      timeoutMs,
      jsonMode: false,
    });
    return { text: text.trim(), usage };
  },
};