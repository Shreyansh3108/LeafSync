const ticketsRepo = require('./repository');
const booksRepo = require('../books/repository');
const { assertTransition } = require('./stateMachine');
const aiService = require('../../ai/ai.service');
const hub = require('../events/hub');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');

const VALID_STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];

exports.createAuthorTicket = async ({ user, payload }) => {
  const { bookId, subject, description, attachments } = payload;

  if (bookId !== null) {
    const ownedBook = await booksRepo.findByIdAndAuthorId(bookId, user.authorId);
    if (!ownedBook) {
      throw new AppError('VALIDATION_ERROR', 400, 'Invalid book selection', [
        { field: 'bookId', issue: 'Book does not belong to this author' },
      ]);
    }
  }

  const ticket = await ticketsRepo.createTicket({
    authorId: user.authorId,
    actorUserId: user.id,
    bookId,
    subject,
    description,
    attachments,
  });

  // Notify admin queue and author in real time
  hub.emitTicketEvent({
    type: 'ticket.created',
    ticketId: ticket.id,
    authorId: user.authorId,
  });

  // Trigger AI classification asynchronously after DB commit
  setImmediate(() => {
    aiService.classifyTicket(ticket.id).catch((err) => {
      logger.error({ err, ticketId: ticket.id }, 'Background classification failed');
    });
  });

  return ticket;
};

exports.listAuthorTickets = async (authorId, statusQuery) => {
  if (statusQuery && !VALID_STATUSES.includes(statusQuery)) {
    throw new AppError('VALIDATION_ERROR', 400, 'Invalid status filter', [
      { field: 'status', issue: 'Must be Open, In Progress, Resolved, or Closed' },
    ]);
  }
  return ticketsRepo.findByAuthorId(authorId, statusQuery || null);
};

exports.getAuthorTicketDetail = async (ticketIdParam, authorId) => {
  const ticketId = Number(ticketIdParam);
  if (!Number.isInteger(ticketId) || ticketId <= 0) {
    throw new AppError('NOT_FOUND', 404, 'Ticket not found');
  }

  const ticket = await ticketsRepo.findDetailByIdAndAuthorId(ticketId, authorId);
  if (!ticket) {
    throw new AppError('NOT_FOUND', 404, 'Ticket not found');
  }
  return ticket;
};

exports.postAuthorFollowUp = async ({ ticketIdParam, user, body }) => {
  const ticket = await exports.getAuthorTicketDetail(ticketIdParam, user.authorId);

  if (ticket.status === 'Closed') {
    assertTransition('Closed', 'In Progress');
  }

  const reopenFromResolved = ticket.status === 'Resolved';
  if (reopenFromResolved) {
    assertTransition('Resolved', 'In Progress');
  }

  const message = await ticketsRepo.addAuthorMessage({
    ticketId: ticket.id,
    actorUserId: user.id,
    body,
    reopenFromResolved,
  });

  hub.emitTicketEvent({
    type: 'message.created',
    ticketId: ticket.id,
    authorId: user.authorId,
  });

  if (reopenFromResolved) {
    hub.emitTicketEvent({
      type: 'ticket.updated',
      ticketId: ticket.id,
      authorId: user.authorId,
    });
  }

  return message;
};