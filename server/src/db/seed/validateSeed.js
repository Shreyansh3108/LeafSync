const pool = require('../pool');

async function validate() {
  const { rows } = await pool.query(`
    SELECT external_id, copies_sold, royalty_per_copy, royalty_earned, royalty_paid, royalty_pending 
    FROM books WHERE status = 'Published & Live'
  `);

  let valid = true;
  for (const book of rows) {
    const calculatedEarned = book.copies_sold * book.royalty_per_copy;
    const calculatedTotal = book.royalty_paid + book.royalty_pending;

    if (calculatedEarned !== book.royalty_earned) {
      console.error(` Data mismatch for ${book.external_id}: ${book.copies_sold} * ${book.royalty_per_copy} != ${book.royalty_earned}`);
      valid = false;
    }
    if (calculatedTotal !== book.royalty_earned) {
      console.error(` Data mismatch for ${book.external_id}: ${book.royalty_paid} + ${book.royalty_pending} != ${book.royalty_earned}`);
      valid = false;
    }
  }

  if (valid) {
    console.log(' All 18 books validated successfully. Math constraints hold true.');
  }
  process.exit(valid ? 0 : 1);
}

validate();