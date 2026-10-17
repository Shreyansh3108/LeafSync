const booksService = require('./service');
const asyncHandler = require('../../utils/asyncHandler');

exports.list = asyncHandler(async (req, res) => {
  const books = await booksService.listAuthorBooks(req.user.authorId);
  res.json({ books });
});

exports.getById = asyncHandler(async (req, res) => {
  const book = await booksService.getAuthorBook(req.params.id, req.user.authorId);
  res.json({ book });
});