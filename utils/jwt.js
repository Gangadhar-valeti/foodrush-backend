// ═══════════════════════════════════════════════════
//  utils/jwt.js — Token helpers
// ═══════════════════════════════════════════════════
const jwt = require('jsonwebtoken');

const SECRET  = process.env.JWT_SECRET    || 'foodrush_secret';
const EXPIRES = process.env.JWT_EXPIRES_IN || '7d';

function signToken(userId) {
  return jwt.sign({ userId }, SECRET, { expiresIn: EXPIRES });
}

function decodeToken(token) {
  return jwt.verify(token, SECRET);
}

module.exports = { signToken, decodeToken };
