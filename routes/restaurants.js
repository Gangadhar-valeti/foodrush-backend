// ═══════════════════════════════════════════════════
//  routes/restaurants.js
//  GET  /api/restaurants              — list all
//  GET  /api/restaurants/search       — search by name/cuisine
//  GET  /api/restaurants/:id          — single restaurant
//  GET  /api/restaurants/:id/offers   — restaurant offers
//  GET  /api/restaurants/:id/reviews  — restaurant reviews
//  GET  /api/restaurants/:id/hours    — working hours (static)
// ═══════════════════════════════════════════════════
const router = require('express').Router();
const db     = require('../db/init');

// ─────────────────────────────────────────────────────
// GET /api/restaurants
//  Query: ?cuisine=biryani &open=1 &sort=rating|distance|delivery_fee
// ─────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const { cuisine, open, sort = 'rating', page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let where  = ['1=1'];
  const args = [];

  if (open === '1') { where.push('is_open = 1'); }
  if (cuisine) {
    where.push('cuisine LIKE ?');
    args.push(`%${cuisine}%`);
  }

  const ORDER = {
    rating:       'rating DESC',
    distance:     'distance_km ASC',
    delivery_fee: 'delivery_fee ASC',
    delivery_min: 'delivery_mins ASC',
  }[sort] || 'rating DESC';

  args.push(Number(limit), offset);
  const rows = db.prepare(`
    SELECT * FROM restaurants
    WHERE ${where.join(' AND ')}
    ORDER BY ${ORDER}
    LIMIT ? OFFSET ?
  `).all(...args);

  const total = db.prepare(`SELECT COUNT(*) AS n FROM restaurants WHERE ${where.join(' AND ')}`)
                  .get(...args.slice(0, -2)).n;

  res.json({ restaurants: rows.map(enrichRestaurant), total, page: Number(page), limit: Number(limit) });
});

// ─────────────────────────────────────────────────────
// GET /api/restaurants/search?q=biryani
// ─────────────────────────────────────────────────────
router.get('/search', (req, res) => {
  const { q = '' } = req.query;
  const term = `%${q.trim()}%`;
  const rows = db.prepare(`
    SELECT * FROM restaurants
    WHERE name LIKE ? OR cuisine LIKE ? OR description LIKE ?
    ORDER BY rating DESC LIMIT 20
  `).all(term, term, term);
  res.json({ restaurants: rows.map(enrichRestaurant) });
});

// ─────────────────────────────────────────────────────
// GET /api/restaurants/:id
// ─────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const r = db.prepare('SELECT * FROM restaurants WHERE id=?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Restaurant not found' });
  res.json({ restaurant: enrichRestaurant(r) });
});

// ─────────────────────────────────────────────────────
// GET /api/restaurants/:id/offers
// ─────────────────────────────────────────────────────
router.get('/:id/offers', (req, res) => {
  const offers = db.prepare(`
    SELECT * FROM offers WHERE restaurant_id=? AND is_active=1
  `).all(req.params.id);
  res.json({ offers });
});

// ─────────────────────────────────────────────────────
// GET /api/restaurants/:id/reviews
// ─────────────────────────────────────────────────────
router.get('/:id/reviews', (req, res) => {
  const reviews = db.prepare(`
    SELECT r.*, u.name AS reviewer_name, u.avatar_text
    FROM reviews r
    JOIN users u ON r.user_id = u.id
    WHERE r.restaurant_id = ?
    ORDER BY r.created_at DESC
  `).all(req.params.id);

  const stats = db.prepare(`
    SELECT COUNT(*) AS count, AVG(rating) AS avg_rating
    FROM reviews WHERE restaurant_id=?
  `).get(req.params.id);

  res.json({
    reviews,
    avg_rating: Math.round((stats.avg_rating || 0) * 10) / 10,
    total: stats.count,
  });
});

// ─────────────────────────────────────────────────────
// GET /api/restaurants/:id/hours
//  Returns hard-coded weekly hours per restaurant
// ─────────────────────────────────────────────────────
router.get('/:id/hours', (req, res) => {
  // In production these would be stored in a DB table
  const DEFAULT_HOURS = [
    { day: 'Monday',    open: '10:00 AM', close: '11:00 PM', is_closed: false },
    { day: 'Tuesday',   open: '10:00 AM', close: '11:00 PM', is_closed: false },
    { day: 'Wednesday', open: '10:00 AM', close: '11:00 PM', is_closed: false },
    { day: 'Thursday',  open: '10:00 AM', close: '11:00 PM', is_closed: false },
    { day: 'Friday',    open: '10:00 AM', close: '11:30 PM', is_closed: false },
    { day: 'Saturday',  open: '10:00 AM', close: '11:30 PM', is_closed: false },
    { day: 'Sunday',    open: null,       close: null,        is_closed: true  },
  ];
  const today = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
  res.json({ hours: DEFAULT_HOURS.map(h => ({ ...h, is_today: h.day === today })) });
});

// ── Helper: parse JSON offers field ────────────────
function enrichRestaurant(r) {
  return { ...r, is_open: Boolean(r.is_open) };
}

module.exports = router;
