const adminRepo = require('./repository');
const { assertTransition } = require('../tickets/stateMachine');
const { computeSlaDueAt } = require('../../config/sla');
const aiService = require('../../ai/ai.service');
const hub = require('../events/hub');
const AppError = require('../../utils/AppError');

function parseTicketId(idParam) {
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError('NOT_FOUND', 404, 'Ticket not found');
  }
  return id;
}

exports.getQueue = async (query, currentAdminId) => {
  return adminRepo.listQueue({
    ...query,
    currentAdminId,
  });
};

exports.getTicketDetail = async (idParam) => {
  const id = parseTicketId(idParam);
  const ticket = await adminRepo.findFullTicketDetail(id);
  if (!ticket) {
    throw new AppError('NOT_FOUND', 404, 'Ticket not found');
  }
  return ticket;
};

exports.patchTicket = async ({ idParam, actorId, payload }) => {
  const id = parseTicketId(idParam);
  const current = await adminRepo.findTicketById(id);
  if (!current) {
    throw new AppError('NOT_FOUND', 404, 'Ticket not found');
  }

  if (payload.status && payload.status !== current.status) {
    assertTransition(current.status, payload.status);
  }

  const updates = { ...payload };
  if (updates.assignedTo === 'me') {
    updates.assignedTo = actorId;
  }

  let newSlaDueAt = null;
  if (updates.priority && updates.priority !== current.priority) {
    newSlaDueAt = computeSlaDueAt(updates.priority, new Date(current.created_at));
  }

  const updated = await adminRepo.updateTicketFields({
    ticketId: id,
    actorId,
    currentTicket: current,
    updates,
    newSlaDueAt,
  });

  hub.emitTicketEvent({
    type: 'ticket.updated',
    ticketId: id,
    authorId: current.author_id,
  });

  return updated;
};

exports.sendReply = async ({ idParam, adminId, body, aiAssisted }) => {
  const id = parseTicketId(idParam);
  const current = await adminRepo.findTicketById(id);
  if (!current) {
    throw new AppError('NOT_FOUND', 404, 'Ticket not found');
  }

  if (current.status === 'Closed') {
    assertTransition('Closed', 'In Progress');
  }

  const message = await adminRepo.addAdminReply({
    ticket: current,
    adminId,
    body,
    aiAssisted,
  });

  hub.emitTicketEvent({
    type: 'message.created',
    ticketId: id,
    authorId: current.author_id,
  });

  hub.emitTicketEvent({
    type: 'ticket.updated',
    ticketId: id,
    authorId: current.author_id,
  });

  return message;
};

exports.listNotes = async (idParam) => {
  const id = parseTicketId(idParam);
  const current = await adminRepo.findTicketById(id);
  if (!current) {
    throw new AppError('NOT_FOUND', 404, 'Ticket not found');
  }
  return adminRepo.listNotes(id);
};

exports.addNote = async ({ idParam, adminId, body }) => {
  const id = parseTicketId(idParam);
  const current = await adminRepo.findTicketById(id);
  if (!current) {
    throw new AppError('NOT_FOUND', 404, 'Ticket not found');
  }
  const note = await adminRepo.addNote({ ticketId: id, adminId, body });

  // Notify admins only (authorId omitted so author never receives internal note events)
  hub.emitTicketEvent({
    type: 'ticket.updated',
    ticketId: id,
    authorId: null,
  });

  return note;
};

exports.getDraft = async (idParam, { force = false } = {}) => {
  const id = parseTicketId(idParam);
  const result = await aiService.getOrGenerateDraft(id, { force });
  if (!result) {
    throw new AppError('NOT_FOUND', 404, 'Ticket not found');
  }
  return result;
};

exports.reclassify = async (idParam) => {
  const id = parseTicketId(idParam);
  const updated = await aiService.classifyTicket(id);
  if (!updated) {
    throw new AppError('NOT_FOUND', 404, 'Ticket not found');
  }
  return updated;
};

exports.getStats = async () => adminRepo.getStats();

exports.getAiUsage = async () => adminRepo.getAiUsage();