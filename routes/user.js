// ═══════════════════════════════════════════════════
//  routes/user.js  (all routes require auth)
//
//  GET  /api/user/profile
//  PUT  /api/user/profile
//  GET  /api/user/addresses
//  POST /api/user/addresses
//  PUT  /api/user/addresses/:id
//  DELETE /api/user/addresses/:id
//  POST /api/user/reviews      — add a review
// ═══════════════════════════════════════════════════
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');
const db     = require('../db/init');
const auth   = require('../middleware/auth');

router.use(auth);

// ─────────────────────────────────────────────────────
// GET /api/user/profile
// ─────────────────────────────────────────────────────
router.get('/profile', (req, res) => {
  const user = db.prepare('SELECT id,name,phone,email,avatar_text,provider,is_verified,created_at FROM users WHERE id=?')
                 .get(req.user.id);
  res.json({ user });
});

// ─────────────────────────────────────────────────────
// PUT /api/user/profile
//  Body: { name?, email?, current_password?, new_password? }
// ─────────────────────────────────────────────────────
router.put('/profile', (req, res) => {
  const { name, email, current_password, new_password } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
  const updates = {};

  if (name?.trim())  updates.name = name.trim();
  if (email?.trim()) {
    if (!/\S+@\S+\.\S+/.test(email)) return res.status(400).json({ error: 'Invalid email' });
    const conflict = db.prepare('SELECT id FROM users WHERE email=? AND id!=?').get(email, user.id);
    if (conflict) return res.status(409).json({ error: 'Email already in use' });
    updates.email = email.trim();
  }

  if (new_password) {
    if (new_password.length < 6) return res.status(400).json({ error: 'Password min 6 chars' });
    if (!bcrypt.compareSync(current_password || '', user.password || ''))
      return res.status(401).json({ error: 'Current password is incorrect' });
    updates.password = bcrypt.hashSync(new_password, parseInt(process.env.BCRYPT_ROUNDS || 10));
  }

  if (Object.keys(updates).length === 0)
    return res.status(400).json({ error: 'Nothing to update' });

  const cols = Object.keys(updates).map(k => `${k}=?`).join(', ');
  db.prepare(`UPDATE users SET ${cols}, updated_at=datetime("now") WHERE id=?`)
    .run(...Object.values(updates), user.id);

  if (updates.name) {
    db.prepare(`UPDATE users SET avatar_text=? WHERE id=?`)
      .run(updates.name.charAt(0).toUpperCase(), user.id);
  }

  const updated = db.prepare('SELECT id,name,phone,email,avatar_text,is_verified FROM users WHERE id=?')
                    .get(user.id);
  res.json({ message: 'Profile updated', user: updated });
});

// ─────────────────────────────────────────────────────
// GET /api/user/addresses
// ─────────────────────────────────────────────────────
router.get('/addresses', (req, res) => {
  const addresses = db.prepare('SELECT * FROM addresses WHERE user_id=? ORDER BY is_default DESC, created_at DESC')
                      .all(req.user.id);
  res.json({ addresses });
});

// ─────────────────────────────────────────────────────
// POST /api/user/addresses
//  Body: { label, full_text, pincode, is_default }
// ─────────────────────────────────────────────────────
router.post('/addresses', (req, res) => {
  const { label = 'Home', full_text, pincode, is_default = 0 } = req.body;
  if (!full_text?.trim()) return res.status(400).json({ error: 'Address text required' });

  if (is_default) {
    db.prepare('UPDATE addresses SET is_default=0 WHERE user_id=?').run(req.user.id);
  }

  const id = uuid();
  db.prepare(`INSERT INTO addresses(id,user_id,label,full_text,pincode,is_default) VALUES(?,?,?,?,?,?)`)
    .run(id, req.user.id, label, full_text.trim(), pincode || null, is_default ? 1 : 0);

  const addr = db.prepare('SELECT * FROM addresses WHERE id=?').get(id);
  res.status(201).json({ message: 'Address saved', address: addr });
});

// ─────────────────────────────────────────────────────
// PUT /api/user/addresses/:id
// ─────────────────────────────────────────────────────
router.put('/addresses/:id', (req, res) => {
  const addr = db.prepare('SELECT * FROM addresses WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
  if (!addr) return res.status(404).json({ error: 'Address not found' });

  const { label, full_text, pincode, is_default } = req.body;
  if (is_default) db.prepare('UPDATE addresses SET is_default=0 WHERE user_id=?').run(req.user.id);

  db.prepare(`
    UPDATE addresses SET
      label=COALESCE(?,label), full_text=COALESCE(?,full_text),
      pincode=COALESCE(?,pincode), is_default=COALESCE(?,is_default)
    WHERE id=?
  `).run(label||null, full_text||null, pincode||null, is_default!=null?is_default:null, addr.id);

  res.json({ message: 'Address updated', address: db.prepare('SELECT * FROM addresses WHERE id=?').get(addr.id) });
});

// ─────────────────────────────────────────────────────
// DELETE /api/user/addresses/:id
// ─────────────────────────────────────────────────────
router.delete('/addresses/:id', (req, res) => {
  const addr = db.prepare('SELECT * FROM addresses WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
  if (!addr) return res.status(404).json({ error: 'Address not found' });
  db.prepare('DELETE FROM addresses WHERE id=?').run(addr.id);
  res.json({ message: 'Address deleted' });
});

// ─────────────────────────────────────────────────────
// POST /api/user/reviews
//  Body: { restaurant_id, rating, comment }
// ─────────────────────────────────────────────────────
router.post('/reviews', (req, res) => {
  const { restaurant_id, rating, comment } = req.body;
  if (!restaurant_id) return res.status(400).json({ error: 'restaurant_id required' });
  if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'rating must be 1–5' });

  // Check user ordered from this restaurant
  const ordered = db.prepare(`
    SELECT id FROM orders WHERE user_id=? AND restaurant_id=? AND status='delivered'
  `).get(req.user.id, restaurant_id);
  // Uncomment to enforce order requirement:
  // if (!ordered) return res.status(403).json({ error: 'You can only review restaurants you ordered from' });

  const id = uuid();
  db.prepare(`INSERT INTO reviews(id,restaurant_id,user_id,rating,comment) VALUES(?,?,?,?,?)`)
    .run(id, restaurant_id, req.user.id, rating, comment || null);

  // Refresh restaurant's avg rating
  const stats = db.prepare('SELECT COUNT(*) AS c, AVG(rating) AS avg FROM reviews WHERE restaurant_id=?')
                  .get(restaurant_id);
  db.prepare('UPDATE restaurants SET rating=?, review_count=? WHERE id=?')
    .run(Math.round(stats.avg * 10) / 10, stats.c, restaurant_id);

  res.status(201).json({ message: 'Review submitted!', review_id: id });
});

module.exports = router;
