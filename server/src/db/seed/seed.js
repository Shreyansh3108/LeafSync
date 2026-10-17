const bcrypt = require('bcrypt');
const pool = require('../pool');
const env = require('../../config/env');
const sampleData = require('./bookleaf_sample_data.json');

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    console.log('Seeding Admins...');
    const adminHash = await bcrypt.hash(env.DEMO_PASSWORD, 10);
    const admins = [
      ['admin1@bookleaf.demo', adminHash, 'admin', 'Admin One'],
      ['admin2@bookleaf.demo', adminHash, 'admin', 'Admin Two']
    ];
    
    for (const [email, hash, role, name] of admins) {
      await client.query(
        `INSERT INTO users (email, password_hash, role, name) 
         VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING`,
        [email, hash, role, name]
      );
    }

    console.log('Seeding Authors and Books...');
    for (const authorData of sampleData.authors) {
      const userRes = await client.query(
        `INSERT INTO users (email, password_hash, role, name) 
         VALUES ($1, $2, $3, $4) ON CONFLICT (email) 
         DO UPDATE SET name = EXCLUDED.name RETURNING id`,
        [authorData.email, adminHash, 'author', authorData.name]
      );
      const userId = userRes.rows[0].id;

      const authorRes = await client.query(
        `INSERT INTO authors (external_id, user_id, name, phone, city, joined_date)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (external_id) 
         DO UPDATE SET user_id = EXCLUDED.user_id RETURNING id`,
        [authorData.author_id, userId, authorData.name, authorData.phone, authorData.city, authorData.joined_date]
      );
      const authorId = authorRes.rows[0].id;

      for (const book of authorData.books) {
        let stage = null;
        if (book.status.startsWith('In Production')) {
          stage = book.status.split('-')[1]?.trim() || null;
        }

        const bookRes = await client.query(
          `INSERT INTO books (
            external_id, author_id, title, isbn, genre, publication_date, 
            status, production_stage, mrp, royalty_per_copy, copies_sold, 
            royalty_earned, royalty_paid, royalty_pending, last_payout_date, print_partner
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) 
          ON CONFLICT (external_id) DO UPDATE SET title = EXCLUDED.title RETURNING id`,
          [
            book.book_id, authorId, book.title, book.isbn, book.genre, book.publication_date,
            book.status, stage, book.mrp, book.author_royalty_per_copy, book.total_copies_sold,
            book.total_royalty_earned, book.royalty_paid, book.royalty_pending, book.last_royalty_payout_date, book.print_partner
          ]
        );
        
        const bookId = bookRes.rows[0].id;
        await client.query(`DELETE FROM book_platforms WHERE book_id = $1`, [bookId]);
        
        for (const platform of book.available_on) {
          await client.query(
            `INSERT INTO book_platforms (book_id, platform) VALUES ($1, $2)`,
            [bookId, platform]
          );
        }
      }
    }
    
    await client.query('COMMIT');
    console.log('Seed completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err);
  } finally {
    client.release();
  }
}

seed().then(() => process.exit(0));