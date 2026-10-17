const booksRepo = require('./repository');
const AppError = require('../../utils/AppError');

exports.listAuthorBooks = async (authorId) => {
  return booksRepo.findByAuthorId(authorId);
};

exports.getAuthorBook = async (bookId, authorId) => {
  const id = Number(bookId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError('NOT_FOUND', 404, 'Book not found');
  }

  const book = await booksRepo.findByIdAndAuthorId(id, authorId);
  if (!book) {
    throw new AppError('NOT_FOUND', 404, 'Book not found');
  }
  return book;
};