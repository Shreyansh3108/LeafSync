const ticketsService = require('./service');
const asyncHandler = require('../../utils/asyncHandler');

exports.create = asyncHandler(async (req, res) => {
  const ticket = await ticketsService.createAuthorTicket({
    user: req.user,
    payload: req.body,
  });
  res.status(201).json({ ticket });
});

exports.list = asyncHandler(async (req, res) => {
  const tickets = await ticketsService.listAuthorTickets(
    req.user.authorId,
    req.query.status
  );
  res.json({ tickets });
});

exports.getById = asyncHandler(async (req, res) => {
  const ticket = await ticketsService.getAuthorTicketDetail(
    req.params.id,
    req.user.authorId
  );
  res.json({ ticket });
});

exports.addMessage = asyncHandler(async (req, res) => {
  const message = await ticketsService.postAuthorFollowUp({
    ticketIdParam: req.params.id,
    user: req.user,
    body: req.body.body,
  });
  res.status(201).json({ message });
});