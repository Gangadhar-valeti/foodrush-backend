// ═══════════════════════════════════════════════════
//  routes/menu.js
//  GET /api/menu/:restaurantId          — full menu
//  GET /api/menu/:restaurantId/item/:id — single item
// ═══════════════════════════════════════════════════
const router = require('express').Router();
const db     = require('../db/init');

// ─────────────────────────────────────────────────────
// GET /api/menu/:restaurantId
//  Returns menu grouped by category
// ─────────────────────────────────────────────────────
router.get('/:restaurantId', (req, res) => {
  const { restaurantId } = req.params;

  const restaurant = db.prepare('SELECT id, name FROM restaurants WHERE id=?').get(restaurantId);
  if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });

  const categories = db.prepare(`
    SELECT * FROM menu_categories WHERE restaurant_id=? ORDER BY sort_order
  `).all(restaurantId);

  const items = db.prepare(`
    SELECT * FROM menu_items WHERE restaurant_id=? AND is_available=1 ORDER BY sort_order
  `).all(restaurantId);

  // Group items by category
  const grouped = categories.map(cat => ({
    ...cat,
    items: items
      .filter(i => i.category_id === cat.id)
      .map(i => ({ ...i, is_veg: Boolean(i.is_veg), is_bestseller: Boolean(i.is_bestseller) })),
  }));

  // Uncategorised items
  const uncategorised = items.filter(i => !i.category_id);
  if (uncategorised.length) {
    grouped.push({ id: '__other', name: 'Other', emoji: '🍽️', items: uncategorised });
  }

  res.json({ restaurant, menu: grouped });
});

// ─────────────────────────────────────────────────────
// GET /api/menu/:restaurantId/item/:id
// ─────────────────────────────────────────────────────
router.get('/:restaurantId/item/:id', (req, res) => {
  const item = db.prepare(`
    SELECT mi.*, mc.name AS category_name
    FROM menu_items mi
    LEFT JOIN menu_categories mc ON mi.category_id = mc.id
    WHERE mi.id=? AND mi.restaurant_id=?
  `).get(req.params.id, req.params.restaurantId);

  if (!item) return res.status(404).json({ error: 'Menu item not found' });
  res.json({ item: { ...item, is_veg: Boolean(item.is_veg) } });
});

module.exports = router;
