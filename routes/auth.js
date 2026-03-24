const { decodeToken } = require('../utils/jwt');

module.exports = function authMiddleware(req, res, next) {
  const header = req.headers.authorization;

  // ✅ If no token → just continue (for public routes)
  if (!header || !header.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  try {
    const token = header.split(' ')[1];
    const decoded = decodeToken(token);

    req.user = { id: decoded.userId };
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Invalid or expired token. Please log in again.'
    });
  }
};