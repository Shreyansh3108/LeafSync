const pool = require('../../db/pool');

exports.findByAuthorId = async (authorId) => {
  const { rows } = await pool.query(
    `SELECT 
       b.id, b.external_id, b.title, b.isbn, b.genre,
       b.publication_date, b.status, b.production_stage,
       b.mrp, b.royalty_per_copy, b.copies_sold,
       b.royalty_earned, b.royalty_paid, b.royalty_pending,
       b.last_payout_date, b.print_partner,
       COALESCE(
         ARRAY_AGG(bp.platform ORDER BY bp.platform) FILTER (WHERE bp.platform IS NOT NULL),
         '{}'
       ) AS available_on
     FROM books b
     LEFT JOIN book_platforms bp ON bp.book_id = b.id
     WHERE b.author_id = $1
     GROUP BY b.id
     ORDER BY b.id ASC`,
    [authorId]
  );
  return rows;
};

exports.findByIdAndAuthorId = async (bookId, authorId) => {
  const { rows } = await pool.query(
    `SELECT 
       b.id, b.external_id, b.title, b.isbn, b.genre,
       b.publication_date, b.status, b.production_stage,
       b.mrp, b.royalty_per_copy, b.copies_sold,
       b.royalty_earned, b.royalty_paid, b.royalty_pending,
       b.last_payout_date, b.print_partner,
       COALESCE(
         ARRAY_AGG(bp.platform ORDER BY bp.platform) FILTER (WHERE bp.platform IS NOT NULL),
         '{}'
       ) AS available_on
     FROM books b
     LEFT JOIN book_platforms bp ON bp.book_id = b.id
     WHERE b.id = $1 AND b.author_id = $2
     GROUP BY b.id`,
    [bookId, authorId]
  );
  return rows[0] || null;
};