const pool = require('../db/pool');
const env = require('../config/env');
const { computeSlaDueAt } = require('../config/sla');
const { getAiProvider } = require('./providers/AiProvider');
const circuitBreaker = require('./circuitBreaker');
const usageLogger = require('./usageLogger');
const { buildContextFacts } = require('./prompts/buildContext');
const {
  classificationOutputSchema,
  buildClassifyPrompt,
  applyPriorityGuardrails,
} = require('./prompts/classify');
const { buildDraftPrompt } = require('./prompts/draft');
const { classifyByKeywords } = require('./fallback/keywordClassifier');
const { getCannedTemplate } = require('./fallback/cannedTemplates');
const hub = require('../modules/events/hub');
const logger = require('../utils/logger');

async function loadTicketWithContext(ticketId) {
  const { rows } = await pool.query(
    `SELECT 
       t.*,
       a.name AS author_name, a.external_id AS author_external_id
     FROM tickets t
     JOIN authors a ON a.id = t.author_id
     WHERE t.id = $1`,
    [ticketId]
  );
  const ticket = rows[0];
  if (!ticket) return null;

  let book = null;
  if (ticket.book_id) {
    const bookRes = await pool.query(
      `SELECT b.*,
         COALESCE(
           ARRAY_AGG(bp.platform ORDER BY bp.platform) FILTER (WHERE bp.platform IS NOT NULL),
           '{}'
         ) AS available_on
       FROM books b
       LEFT JOIN book_platforms bp ON bp.book_id = b.id
       WHERE b.id = $1
       GROUP BY b.id`,
      [ticket.book_id]
    );
    book = bookRes.rows[0] || null;
  }

  return {
    ticket,
    author: { id: ticket.author_id, name: ticket.author_name, external_id: ticket.author_external_id },
    book,
  };
}

exports.classifyTicket = async (ticketId) => {
  const loaded = await loadTicketWithContext(ticketId);
  if (!loaded) return null;

  const { ticket, author, book } = loaded;
  const ctx = buildContextFacts({ author, book });
  const provider = getAiProvider();
  const model = env.AI_MODEL_CLASSIFY;

  const applyFallback = async (errorCode) => {
    const fb = classifyByKeywords({
      subject: ticket.subject,
      description: ticket.description,
      overdueRoyalty: ctx.overdueRoyalty,
    });
    const guarded = applyPriorityGuardrails(fb, {
      subject: ticket.subject,
      description: ticket.description,
      overdueRoyalty: ctx.overdueRoyalty,
    });
    const slaDueAt = computeSlaDueAt(guarded.priority, new Date(ticket.created_at));

    const { rows } = await pool.query(
      `UPDATE tickets
       SET category = COALESCE( CASE WHEN category_source = 'admin' THEN category ELSE NULL END, $1 ),
           category_source = COALESCE( CASE WHEN category_source = 'admin' THEN category_source ELSE NULL END, 'fallback' ),
           priority = COALESCE( CASE WHEN priority_source = 'admin' THEN priority ELSE NULL END, $2 ),
           priority_source = COALESCE( CASE WHEN priority_source = 'admin' THEN priority_source ELSE NULL END, 'fallback' ),
           ai_state = 'failed',
           ai_reason = $3,
           ai_confidence = $4,
           sla_due_at = COALESCE(sla_due_at, $5),
           updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [guarded.category, guarded.priority, `${guarded.reason} [${errorCode}]`, guarded.confidence, slaDueAt, ticketId]
    );

    hub.emitTicketEvent({ type: 'ai.completed', ticketId });
    return rows[0];
  };

  if (!env.AI_API_KEY) {
    await usageLogger.logCall({
      ticketId,
      kind: 'classify',
      provider: provider.name,
      model,
      ok: false,
      errorCode: 'MISSING_API_KEY',
    });
    return applyFallback('MISSING_API_KEY');
  }

  if (circuitBreaker.isOpen()) {
    await usageLogger.logCall({
      ticketId,
      kind: 'classify',
      provider: provider.name,
      model,
      ok: false,
      errorCode: 'CIRCUIT_OPEN',
    });
    return applyFallback('CIRCUIT_OPEN');
  }

  if (await usageLogger.isDailyLimitReached()) {
    await usageLogger.logCall({
      ticketId,
      kind: 'classify',
      provider: provider.name,
      model,
      ok: false,
      errorCode: 'DAILY_LIMIT_REACHED',
    });
    return applyFallback('DAILY_LIMIT_REACHED');
  }

  const { system, user } = buildClassifyPrompt({
    subject: ticket.subject,
    description: ticket.description,
  });

  for (let parseAttempt = 0; parseAttempt < 2; parseAttempt++) {
    const start = Date.now();
    try {
      const { data, usage } = await provider.generateJson({
        model,
        system,
        user,
        maxTokens: 250,
      });
      const latencyMs = Date.now() - start;
      const validated = classificationOutputSchema.safeParse(data);

      if (!validated.success) {
        await usageLogger.logCall({
          ticketId,
          kind: 'classify',
          provider: provider.name,
          model,
          tokensIn: usage.tokensIn,
          tokensOut: usage.tokensOut,
          latencyMs,
          ok: false,
          errorCode: 'MALFORMED_OUTPUT',
        });
        if (parseAttempt === 0) continue;
        return applyFallback('MALFORMED_OUTPUT');
      }

      circuitBreaker.recordSuccess();
      await usageLogger.logCall({
        ticketId,
        kind: 'classify',
        provider: provider.name,
        model,
        tokensIn: usage.tokensIn,
        tokensOut: usage.tokensOut,
        latencyMs,
        ok: true,
      });

      const guarded = applyPriorityGuardrails(validated.data, {
        subject: ticket.subject,
        description: ticket.description,
        overdueRoyalty: ctx.overdueRoyalty,
      });
      const slaDueAt = computeSlaDueAt(guarded.priority, new Date(ticket.created_at));

      const { rows } = await pool.query(
        `UPDATE tickets
         SET category = CASE WHEN category_source = 'admin' THEN category ELSE $1 END,
             category_source = CASE WHEN category_source = 'admin' THEN category_source ELSE 'ai' END,
             priority = CASE WHEN priority_source = 'admin' THEN priority ELSE $2 END,
             priority_source = CASE WHEN priority_source = 'admin' THEN priority_source ELSE 'ai' END,
             ai_state = 'done',
             ai_reason = $3,
             ai_confidence = $4,
             sla_due_at = COALESCE(sla_due_at, $5),
             updated_at = NOW()
         WHERE id = $6
         RETURNING *`,
        [guarded.category, guarded.priority, guarded.reason, guarded.confidence, slaDueAt, ticketId]
      );

      hub.emitTicketEvent({ type: 'ai.completed', ticketId });
      return rows[0];
    } catch (err) {
      const latencyMs = Date.now() - start;
      circuitBreaker.recordFailure();
      await usageLogger.logCall({
        ticketId,
        kind: 'classify',
        provider: provider.name,
        model,
        latencyMs,
        ok: false,
        errorCode: err.code || 'AI_ERROR',
      });
      logger.warn({ ticketId, err: err.message, code: err.code }, 'AI classification failed, using fallback');
      return applyFallback(err.code || 'AI_ERROR');
    }
  }
};

exports.getOrGenerateDraft = async (ticketId, { force = false } = {}) => {
  const loaded = await loadTicketWithContext(ticketId);
  if (!loaded) return null;

  const { ticket, author, book } = loaded;
  const ctx = buildContextFacts({ author, book });
  const category = ticket.category || 'General Inquiry';

  const msgRes = await pool.query(
    `SELECT id, sender_role, body, created_at
     FROM ticket_messages
     WHERE ticket_id = $1
     ORDER BY created_at ASC, id ASC`,
    [ticketId]
  );
  const messages = msgRes.rows;
  const lastMessageId = messages.length > 0 ? messages[messages.length - 1].id : null;

  if (!force) {
    const cachedRes = await pool.query(
      `SELECT * FROM ai_drafts WHERE ticket_id = $1`,
      [ticketId]
    );
    const cached = cachedRes.rows[0];
    if (cached && cached.based_on_message_id === lastMessageId) {
      return {
        draft: cached.body,
        aiAvailable: true,
        cached: true,
        model: cached.model,
        kbSections: cached.kb_sections,
        template: getCannedTemplate(category, ctx),
      };
    }
  }

  const provider = getAiProvider();
  const model = env.AI_MODEL_DRAFT;
  const fallbackTemplate = getCannedTemplate(category, ctx);

  if (!env.AI_API_KEY || circuitBreaker.isOpen() || (await usageLogger.isDailyLimitReached())) {
    const reasonCode = !env.AI_API_KEY
      ? 'MISSING_API_KEY'
      : circuitBreaker.isOpen()
      ? 'CIRCUIT_OPEN'
      : 'DAILY_LIMIT_REACHED';

    await usageLogger.logCall({
      ticketId,
      kind: 'draft',
      provider: provider.name,
      model,
      ok: false,
      errorCode: reasonCode,
    });

    return {
      draft: null,
      aiAvailable: false,
      cached: false,
      reason: reasonCode,
      template: fallbackTemplate,
    };
  }

  const { system, user, kbSections } = buildDraftPrompt({
    category,
    contextFactsText: ctx.text,
    subject: ticket.subject,
    description: ticket.description,
    recentMessages: messages,
  });

  const start = Date.now();
  try {
    const { text, usage } = await provider.generateText({
      model,
      system,
      user,
      maxTokens: 450,
    });
    const latencyMs = Date.now() - start;

    if (!text || text.length < 20) {
      throw Object.assign(new Error('Empty draft returned'), { code: 'MALFORMED_OUTPUT' });
    }

    circuitBreaker.recordSuccess();
    await usageLogger.logCall({
      ticketId,
      kind: 'draft',
      provider: provider.name,
      model,
      tokensIn: usage.tokensIn,
      tokensOut: usage.tokensOut,
      latencyMs,
      ok: true,
    });

    await pool.query(
      `INSERT INTO ai_drafts (
         ticket_id, body, model, based_on_message_id, kb_sections, tokens_in, tokens_out, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (ticket_id)
       DO UPDATE SET
         body = EXCLUDED.body,
         model = EXCLUDED.model,
         based_on_message_id = EXCLUDED.based_on_message_id,
         kb_sections = EXCLUDED.kb_sections,
         tokens_in = EXCLUDED.tokens_in,
         tokens_out = EXCLUDED.tokens_out,
         created_at = NOW()`,
      [ticketId, text, model, lastMessageId, kbSections, usage.tokensIn, usage.tokensOut]
    );

    return {
      draft: text,
      aiAvailable: true,
      cached: false,
      model,
      kbSections,
      template: fallbackTemplate,
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    circuitBreaker.recordFailure();
    await usageLogger.logCall({
      ticketId,
      kind: 'draft',
      provider: provider.name,
      model,
      latencyMs,
      ok: false,
      errorCode: err.code || 'AI_ERROR',
    });

    return {
      draft: null,
      aiAvailable: false,
      cached: false,
      reason: err.code || 'AI_ERROR',
      template: fallbackTemplate,
    };
  }
};

exports.sweepPendingTickets = async () => {
  try {
    const { rows } = await pool.query(
      `SELECT id FROM tickets WHERE ai_state = 'pending' ORDER BY created_at ASC LIMIT 10`
    );
    for (const row of rows) {
      await exports.classifyTicket(row.id);
    }
  } catch (err) {
    logger.error({ err }, 'AI sweeper error');
  }
};