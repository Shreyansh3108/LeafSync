const pool = require('../db/pool');
const env = require('../config/env');
const logger = require('../utils/logger');

exports.logCall = async ({
  ticketId = null,
  kind,
  provider,
  model,
  tokensIn = 0,
  tokensOut = 0,
  latencyMs = 0,
  ok,
  errorCode = null,
}) => {
  try {
    await pool.query(
      `INSERT INTO ai_call_log (
         ticket_id, kind, provider, model, tokens_in, tokens_out, latency_ms, ok, error_code
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [ticketId, kind, provider, model, tokensIn, tokensOut, latencyMs, ok, errorCode]
    );
  } catch (err) {
    logger.error({ err }, 'Failed to write ai_call_log');
  }
};

exports.isDailyLimitReached = async () => {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM ai_call_log
     WHERE created_at >= CURRENT_DATE`
  );
  return (rows[0]?.count || 0) >= env.AI_DAILY_CALL_LIMIT;
};