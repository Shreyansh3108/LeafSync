const adminService = require('./service');
const asyncHandler = require('../../utils/asyncHandler');

exports.getQueue = asyncHandler(async (req, res) => {
  const result = await adminService.getQueue(req.query, req.user.id);
  res.json(result);
});

exports.getTicketDetail = asyncHandler(async (req, res) => {
  const ticket = await adminService.getTicketDetail(req.params.id);
  res.json({ ticket });
});

exports.patchTicket = asyncHandler(async (req, res) => {
  const ticket = await adminService.patchTicket({
    idParam: req.params.id,
    actorId: req.user.id,
    payload: req.body,
  });
  res.json({ ticket });
});

exports.sendReply = asyncHandler(async (req, res) => {
  const message = await adminService.sendReply({
    idParam: req.params.id,
    adminId: req.user.id,
    body: req.body.body,
    aiAssisted: req.body.aiAssisted,
  });
  res.status(201).json({ message });
});

exports.listNotes = asyncHandler(async (req, res) => {
  const notes = await adminService.listNotes(req.params.id);
  res.json({ notes });
});

exports.addNote = asyncHandler(async (req, res) => {
  const note = await adminService.addNote({
    idParam: req.params.id,
    adminId: req.user.id,
    body: req.body.body,
  });
  res.status(201).json({ note });
});

exports.getDraft = asyncHandler(async (req, res) => {
  const draftData = await adminService.getDraft(req.params.id, { force: false });
  res.json(draftData);
});

exports.regenerateDraft = asyncHandler(async (req, res) => {
  const draftData = await adminService.getDraft(req.params.id, { force: true });
  res.json(draftData);
});

exports.reclassify = asyncHandler(async (req, res) => {
  const ticket = await adminService.reclassify(req.params.id);
  res.json({ ticket });
});

exports.getStats = asyncHandler(async (req, res) => {
  const stats = await adminService.getStats();
  res.json({ stats });
});

exports.getAiUsage = asyncHandler(async (req, res) => {
  const usage = await adminService.getAiUsage();
  res.json({ usage });
});