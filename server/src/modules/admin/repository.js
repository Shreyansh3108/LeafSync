const pool = require('../../db/pool');

exports.listQueue = async ({
  status,
  category,
  priority,
  assignedTo,
  currentAdminId,
  from,
  to,
  q,
  page = 1,
  limit = 25,
}) => {
  const conditions = [];
  const params = [];

  const addParam = (val) => {
    params.push(val);
    return `$${params.length}`;
  };

  if (status) {
    conditions.push(`t.status = ${addParam(status)}`);
  }
  if (category) {
    conditions.push(`t.category = ${addParam(category)}`);
  }
  if (priority) {
    conditions.push(`t.priority = ${addParam(priority)}`);
  }
  if (assignedTo === 'me') {
    conditions.push(`t.assigned_to = ${addParam(currentAdminId)}`);
  } else if (assignedTo === 'unassigned') {
    conditions.push(`t.assigned_to IS NULL`);
  } else if (assignedTo && !Number.isNaN(Number(assignedTo))) {
    conditions.push(`t.assigned_to = ${addParam(Number(assignedTo))}`);
  }
  if (from) {
    conditions.push(`t.created_at >= ${addParam(from)}`);
  }
  if (to) {
    conditions.push(`t.created_at <= ${addParam(to)}`);
  }
  if (q) {
    const likeParam = addParam(`%${q}%`);
    conditions.push(
      `(t.ticket_no ILIKE ${likeParam} OR t.subject ILIKE ${likeParam} OR t.description ILIKE ${likeParam} OR a.name ILIKE ${likeParam})`
    );
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (Math.max(1, Number(page)) - 1) * Number(limit);

  const countRes = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM tickets t
     JOIN authors a ON a.id = t.author_id
     ${whereSql}`,
    params
  );

  const limitParam = addParam(Number(limit));
  const offsetParam = addParam(offset);

  const { rows } = await pool.query(
    `SELECT 
       t.id, t.ticket_no, t.subject, t.status,
       t.category, t.category_source,
       t.priority, t.priority_source,
       t.ai_state, t.ai_confidence, t.ai_reason,
       t.assigned_to, u.name AS assigned_to_name,
       t.sla_due_at, t.first_response_at, t.created_at, t.updated_at, t.resolved_at,
       a.id AS author_id, a.external_id AS author_external_id, a.name AS author_name,
       b.id AS book_id, b.external_id AS book_external_id, b.title AS book_title
     FROM tickets t
     JOIN authors a ON a.id = t.author_id
     LEFT JOIN books b ON b.id = t.book_id
     LEFT JOIN users u ON u.id = t.assigned_to
     ${whereSql}
     ORDER BY
       CASE WHEN t.status IN ('Open', 'In Progress') THEN 0 ELSE 1 END ASC,
       CASE t.priority
         WHEN 'Critical' THEN 4
         WHEN 'High' THEN 3
         WHEN 'Medium' THEN 2
         WHEN 'Low' THEN 1
         ELSE 0
       END DESC,
       t.created_at ASC
     LIMIT ${limitParam} OFFSET ${offsetParam}`,
    params
  );

  return {
    tickets: rows,
    total: countRes.rows[0]?.total || 0,
    page: Math.max(1, Number(page)),
    limit: Number(limit),
  };
};

exports.findTicketById = async (ticketId) => {
  const { rows } = await pool.query(`SELECT * FROM tickets WHERE id = $1`, [ticketId]);
  return rows[0] || null;
};

exports.findFullTicketDetail = async (ticketId) => {
  const ticketRes = await pool.query(
    `SELECT 
       t.*,
       u.name AS assigned_to_name,
       a.external_id AS author_external_id, a.name AS author_name,
       a.phone AS author_phone, a.city AS author_city, a.joined_date AS author_joined_date,
       au.email AS author_email
     FROM tickets t
     JOIN authors a ON a.id = t.author_id
     JOIN users au ON au.id = a.user_id
     LEFT JOIN users u ON u.id = t.assigned_to
     WHERE t.id = $1`,
    [ticketId]
  );

  const ticket = ticketRes.rows[0];
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

  const [messagesRes, notesRes, attachmentsRes, eventsRes] = await Promise.all([
    pool.query(
      `SELECT m.id, m.sender_id, m.sender_role, u.name AS sender_name, m.body, m.ai_assisted, m.created_at
       FROM ticket_messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.ticket_id = $1
       ORDER BY m.created_at ASC, m.id ASC`,
      [ticketId]
    ),
    pool.query(
      `SELECT n.id, n.admin_id, u.name AS admin_name, n.body, n.created_at
       FROM internal_notes n
       JOIN users u ON u.id = n.admin_id
       WHERE n.ticket_id = $1
       ORDER BY n.created_at ASC, n.id ASC`,
      [ticketId]
    ),
    pool.query(
      `SELECT id, filename, size, mime FROM ticket_attachments WHERE ticket_id = $1 ORDER BY id ASC`,
      [ticketId]
    ),
    pool.query(
      `SELECT e.id, e.actor_id, u.name AS actor_name, e.type, e.from_value, e.to_value, e.created_at
       FROM ticket_events e
       JOIN users u ON u.id = e.actor_id
       WHERE e.ticket_id = $1
       ORDER BY e.created_at DESC, e.id DESC`,
      [ticketId]
    ),
  ]);

  return {
    ...ticket,
    book,
    messages: messagesRes.rows,
    internal_notes: notesRes.rows,
    attachments: attachmentsRes.rows,
    events: eventsRes.rows,
  };
};

exports.updateTicketFields = async ({
  ticketId,
  actorId,
  currentTicket,
  updates,
  newSlaDueAt,
}) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const setClauses = ['updated_at = NOW()'];
    const params = [];
    const addParam = (val) => {
      params.push(val);
      return `$${params.length}`;
    };

    const eventsToLog = [];

    if (updates.status !== undefined && updates.status !== currentTicket.status) {
      setClauses.push(`status = ${addParam(updates.status)}`);
      if (updates.status === 'Resolved') {
        setClauses.push(`resolved_at = NOW()`);
      }
      eventsToLog.push({
        type: 'status.changed',
        from: currentTicket.status,
        to: updates.status,
      });
    }

    if (updates.category !== undefined && updates.category !== currentTicket.category) {
      setClauses.push(`category = ${addParam(updates.category)}`);
      setClauses.push(`category_source = 'admin'`);
      eventsToLog.push({
        type: 'category.overridden',
        from: currentTicket.category || 'none',
        to: updates.category,
      });
    }

    if (updates.priority !== undefined && updates.priority !== currentTicket.priority) {
      setClauses.push(`priority = ${addParam(updates.priority)}`);
      setClauses.push(`priority_source = 'admin'`);
      if (newSlaDueAt) {
        setClauses.push(`sla_due_at = ${addParam(newSlaDueAt)}`);
      }
      eventsToLog.push({
        type: 'priority.overridden',
        from: currentTicket.priority || 'none',
        to: updates.priority,
      });
    }

    if (updates.assignedTo !== undefined && updates.assignedTo !== currentTicket.assigned_to) {
      setClauses.push(`assigned_to = ${addParam(updates.assignedTo)}`);
      if (currentTicket.status === 'Open' && updates.assignedTo !== null && !updates.status) {
        setClauses.push(`status = 'In Progress'`);
        eventsToLog.push({
          type: 'status.changed',
          from: 'Open',
          to: 'In Progress',
        });
      }
      eventsToLog.push({
        type: 'ticket.assigned',
        from: currentTicket.assigned_to ? String(currentTicket.assigned_to) : 'unassigned',
        to: updates.assignedTo ? String(updates.assignedTo) : 'unassigned',
      });
    }

    const idParam = addParam(ticketId);
    const { rows } = await client.query(
      `UPDATE tickets SET ${setClauses.join(', ')} WHERE id = ${idParam} RETURNING *`,
      params
    );

    for (const ev of eventsToLog) {
      await client.query(
        `INSERT INTO ticket_events (ticket_id, actor_id, type, from_value, to_value)
         VALUES ($1, $2, $3, $4, $5)`,
        [ticketId, actorId, ev.type, ev.from, ev.to]
      );
    }

    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports.addAdminReply = async ({ ticket, adminId, body, aiAssisted }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const msgRes = await client.query(
      `INSERT INTO ticket_messages (ticket_id, sender_id, sender_role, body, ai_assisted)
       VALUES ($1, $2, 'admin', $3, $4)
       RETURNING id, ticket_id, sender_id, sender_role, body, ai_assisted, created_at`,
      [ticket.id, adminId, body, Boolean(aiAssisted)]
    );

    const moveOpenToInProgress = ticket.status === 'Open';
    const setFirstResponse = !ticket.first_response_at;

    await client.query(
      `UPDATE tickets
       SET status = CASE WHEN status = 'Open' THEN 'In Progress'::ticket_status ELSE status END,
           first_response_at = COALESCE(first_response_at, NOW()),
           updated_at = NOW()
       WHERE id = $1`,
      [ticket.id]
    );

    if (moveOpenToInProgress) {
      await client.query(
        `INSERT INTO ticket_events (ticket_id, actor_id, type, from_value, to_value)
         VALUES ($1, $2, 'status.changed', 'Open', 'In Progress')`,
        [ticket.id, adminId]
      );
    }

    if (setFirstResponse) {
      await client.query(
        `INSERT INTO ticket_events (ticket_id, actor_id, type, from_value, to_value)
         VALUES ($1, $2, 'first_response.sent', NULL, $3)`,
        [ticket.id, adminId, aiAssisted ? 'ai_assisted' : 'manual']
      );
    }

    await client.query('COMMIT');
    return msgRes.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports.listNotes = async (ticketId) => {
  const { rows } = await pool.query(
    `SELECT n.id, n.ticket_id, n.admin_id, u.name AS admin_name, n.body, n.created_at
     FROM internal_notes n
     JOIN users u ON u.id = n.admin_id
     WHERE n.ticket_id = $1
     ORDER BY n.created_at ASC, n.id ASC`,
    [ticketId]
  );
  return rows;
};

exports.addNote = async ({ ticketId, adminId, body }) => {
  const { rows } = await pool.query(
    `INSERT INTO internal_notes (ticket_id, admin_id, body)
     VALUES ($1, $2, $3)
     RETURNING id, ticket_id, admin_id, body, created_at`,
    [ticketId, adminId, body]
  );
  return rows[0];
};

exports.getStats = async () => {
  const [byStatus, byPriority, overdueRes, avgResponseRes] = await Promise.all([
    pool.query(`SELECT status, COUNT(*)::int AS count FROM tickets GROUP BY status`),
    pool.query(`SELECT COALESCE(priority::text, 'Unassigned') AS priority, COUNT(*)::int AS count FROM tickets GROUP BY priority`),
    pool.query(
      `SELECT COUNT(*)::int AS overdue_count
       FROM tickets
       WHERE status IN ('Open', 'In Progress')
         AND sla_due_at IS NOT NULL
         AND sla_due_at < NOW()`
    ),
    pool.query(
      `SELECT ROUND(AVG(EXTRACT(EPOCH FROM (first_response_at - created_at)) / 60))::int AS avg_minutes
       FROM tickets
       WHERE first_response_at IS NOT NULL`
    ),
  ]);

  return {
    byStatus: byStatus.rows,
    byPriority: byPriority.rows,
    overdueCount: overdueRes.rows[0]?.overdue_count || 0,
    avgFirstResponseMinutes: avgResponseRes.rows[0]?.avg_minutes || null,
  };
};

exports.getAiUsage = async () => {
  const [totalsRes, byKindRes, recentRes] = await Promise.all([
    pool.query(
      `SELECT 
         COUNT(*)::int AS total_calls,
         COUNT(*) FILTER (WHERE ok = true)::int AS successful_calls,
         COUNT(*) FILTER (WHERE ok = false)::int AS failed_calls,
         COALESCE(SUM(tokens_in), 0)::int AS total_tokens_in,
         COALESCE(SUM(tokens_out), 0)::int AS total_tokens_out,
         ROUND(AVG(latency_ms))::int AS avg_latency_ms
       FROM ai_call_log`
    ),
    pool.query(
      `SELECT 
         kind,
         COUNT(*)::int AS calls,
         COALESCE(SUM(tokens_in), 0)::int AS tokens_in,
         COALESCE(SUM(tokens_out), 0)::int AS tokens_out
       FROM ai_call_log
       GROUP BY kind`
    ),
    pool.query(
      `SELECT id, ticket_id, kind, provider, model, tokens_in, tokens_out, latency_ms, ok, error_code, created_at
       FROM ai_call_log
       ORDER BY created_at DESC
       LIMIT 15`
    ),
  ]);

  const summary = totalsRes.rows[0] || {};
  const totalCalls = summary.total_calls || 0;
  const failedCalls = summary.failed_calls || 0;

  return {
    ...summary,
    failureRate: totalCalls > 0 ? Number(((failedCalls / totalCalls) * 100).toFixed(1)) : 0,
    byKind: byKindRes.rows,
    recentCalls: recentRes.rows,
  };
};