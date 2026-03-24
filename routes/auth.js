// ═══════════════════════════════════════════════════
//  middleware/auth.js — JWT auth guard
// ═══════════════════════════════════════════════════
const { decodeToken } = require('../utils/jwt');

module.exports = function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided. Please log in.' });
  }

  try {
    const token   = header.split(' ')[1];
    const decoded = decodeToken(token);
    req.user      = { id: decoded.userId };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
  }
};