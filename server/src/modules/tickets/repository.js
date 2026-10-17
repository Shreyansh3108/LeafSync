const pool = require('../../db/pool');
const crypto = require('crypto');

exports.createTicket = async ({ authorId, actorUserId, bookId, subject, description, attachments }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const tempTicketNo = `TMP-${crypto.randomUUID().slice(0, 18)}`;

    const insertRes = await client.query(
      `INSERT INTO tickets (
         ticket_no, author_id, book_id, subject, description, status, ai_state
       ) VALUES ($1, $2, $3, $4, $5, 'Open', 'pending')
       RETURNING id`,
      [tempTicketNo, authorId, bookId, subject, description]
    );

    const ticketId = insertRes.rows[0].id;
    const formattedTicketNo = `TKT-${String(ticketId).padStart(4, '0')}`;

    const ticketRes = await client.query(
      `UPDATE tickets
       SET ticket_no = $1
       WHERE id = $2
       RETURNING id, ticket_no, book_id, subject, description, status, created_at, updated_at, resolved_at`,
      [formattedTicketNo, ticketId]
    );

    const savedAttachments = [];
    for (const att of attachments) {
      const attRes = await client.query(
        `INSERT INTO ticket_attachments (ticket_id, filename, size, mime)
         VALUES ($1, $2, $3, $4)
         RETURNING id, filename, size, mime`,
        [ticketId, att.filename, att.size, att.mime]
      );
      savedAttachments.push(attRes.rows[0]);
    }

    await client.query(
      `INSERT INTO ticket_events (ticket_id, actor_id, type, from_value, to_value)
       VALUES ($1, $2, 'ticket.created', NULL, 'Open')`,
      [ticketId, actorUserId]
    );

    await client.query('COMMIT');
    return {
      ...ticketRes.rows[0],
      attachments: savedAttachments,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports.findByAuthorId = async (authorId, statusFilter = null) => {
  const params = [authorId];
  let statusClause = '';

  if (statusFilter) {
    params.push(statusFilter);
    statusClause = `AND t.status = $2`;
  }

  const { rows } = await pool.query(
    `SELECT 
       t.id, t.ticket_no, t.book_id,
       b.title AS book_title, b.external_id AS book_external_id,
       t.subject, t.description, t.status,
       t.created_at, t.updated_at, t.resolved_at
     FROM tickets t
     LEFT JOIN books b ON b.id = t.book_id
     WHERE t.author_id = $1 ${statusClause}
     ORDER BY t.created_at DESC`,
    params
  );
  return rows;
};

exports.findDetailByIdAndAuthorId = async (ticketId, authorId) => {
  const ticketRes = await pool.query(
    `SELECT 
       t.id, t.ticket_no, t.book_id,
       b.title AS book_title, b.external_id AS book_external_id,
       t.subject, t.description, t.status,
       t.created_at, t.updated_at, t.resolved_at
     FROM tickets t
     LEFT JOIN books b ON b.id = t.book_id
     WHERE t.id = $1 AND t.author_id = $2`,
    [ticketId, authorId]
  );

  const ticket = ticketRes.rows[0];
  if (!ticket) return null;

  const [messagesRes, attachmentsRes] = await Promise.all([
    pool.query(
      `SELECT 
         m.id, m.sender_role, u.name AS sender_name, m.body, m.created_at
       FROM ticket_messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.ticket_id = $1
       ORDER BY m.created_at ASC, m.id ASC`,
      [ticketId]
    ),
    pool.query(
      `SELECT id, filename, size, mime
       FROM ticket_attachments
       WHERE ticket_id = $1
       ORDER BY id ASC`,
      [ticketId]
    ),
  ]);

  return {
    ...ticket,
    attachments: attachmentsRes.rows,
    messages: messagesRes.rows,
  };
};

exports.addAuthorMessage = async ({ ticketId, actorUserId, body, reopenFromResolved }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const msgRes = await client.query(
      `INSERT INTO ticket_messages (ticket_id, sender_id, sender_role, body, ai_assisted)
       VALUES ($1, $2, 'author', $3, false)
       RETURNING id, sender_role, body, created_at`,
      [ticketId, actorUserId, body]
    );

    if (reopenFromResolved) {
      await client.query(
        `UPDATE tickets
         SET status = 'In Progress', resolved_at = NULL, updated_at = NOW()
         WHERE id = $1`,
        [ticketId]
      );

      await client.query(
        `INSERT INTO ticket_events (ticket_id, actor_id, type, from_value, to_value)
         VALUES ($1, $2, 'status.changed', 'Resolved', 'In Progress')`,
        [ticketId, actorUserId]
      );
    } else {
      await client.query(
        `UPDATE tickets SET updated_at = NOW() WHERE id = $1`,
        [ticketId]
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