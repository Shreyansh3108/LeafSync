const pool = require('../../db/pool');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const AppError = require('../../utils/AppError');

exports.login = async (email, password) => {
  // Fetch user and grab the author_id if they are an author
  const { rows } = await pool.query(`
    SELECT u.id, u.email, u.password_hash, u.role, u.name, a.id as author_id
    FROM users u
    LEFT JOIN authors a ON a.user_id = u.id
    WHERE u.email = $1
  `, [email.toLowerCase()]);

  const user = rows[0];
  if (!user) throw new AppError('UNAUTHENTICATED', 401, 'Invalid credentials');

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new AppError('UNAUTHENTICATED', 401, 'Invalid credentials');

  const token = jwt.sign(
    { id: user.id, role: user.role, authorId: user.author_id },
    env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  return {
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  };
};