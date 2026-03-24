// ═══════════════════════════════════════════════════
//  routes/cart.js  (all routes require auth)
//
//  GET    /api/cart              — get user's cart
//  POST   /api/cart/add          — add / update item
//  PUT    /api/cart/update       — set exact qty
//  DELETE /api/cart/item/:id     — remove one item
//  DELETE /api/cart/clear        — clear entire cart
//  POST   /api/cart/apply-coupon — validate coupon
// ═══════════════════════════════════════════════════
const router = require('express').Router();
const { v4: uuid } = require('uuid');
const db           = require('../db/init');
const auth         = require('../middleware/auth');

router.use(auth); // all cart routes require login

// ─────────────────────────────────────────────────────
// GET /api/cart
// ─────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const cartRows = db.prepare(`
    SELECT ci.id AS cart_item_id, ci.quantity,
           mi.id, mi.name, mi.emoji, mi.price, mi.is_veg,
           r.id AS restaurant_id, r.name AS restaurant_name
    FROM cart_items ci
    JOIN menu_items mi ON ci.menu_item_id = mi.id
    JOIN restaurants r ON ci.restaurant_id = r.id
    WHERE ci.user_id = ?
    ORDER BY ci.added_at
  `).all(req.user.id);

  res.json({ cart: buildCartResponse(cartRows) });
});

// ─────────────────────────────────────────────────────
// POST /api/cart/add
//  Body: { menu_item_id, restaurant_id, quantity? }
//  If user has items from a different restaurant, return conflict.
// ─────────────────────────────────────────────────────
router.post('/add', (req, res) => {
  const { menu_item_id, restaurant_id, quantity = 1 } = req.body;
  if (!menu_item_id || !restaurant_id)
    return res.status(400).json({ error: 'menu_item_id and restaurant_id are required' });

  // Validate item exists
  const item = db.prepare('SELECT * FROM menu_items WHERE id=? AND restaurant_id=? AND is_available=1')
                 .get(menu_item_id, restaurant_id);
  if (!item) return res.status(404).json({ error: 'Menu item not found or unavailable' });

  // Check cart restaurant conflict
  const existing = db.prepare('SELECT DISTINCT restaurant_id FROM cart_items WHERE user_id=?')
                     .get(req.user.id);
  if (existing && existing.restaurant_id !== restaurant_id) {
    return res.status(409).json({
      error: 'Cart has items from another restaurant. Clear cart to add from a new restaurant.',
      conflict: true,
      current_restaurant_id: existing.restaurant_id,
    });
  }

  // Upsert
  const row = db.prepare('SELECT * FROM cart_items WHERE user_id=? AND menu_item_id=?')
                .get(req.user.id, menu_item_id);
  if (row) {
    const newQty = row.quantity + quantity;
    db.prepare('UPDATE cart_items SET quantity=?, added_at=datetime("now") WHERE id=?')
      .run(newQty, row.id);
  } else {
    db.prepare(`
      INSERT INTO cart_items(id,user_id,restaurant_id,menu_item_id,quantity)
      VALUES(?,?,?,?,?)
    `).run(uuid(), req.user.id, restaurant_id, menu_item_id, quantity);
  }

  res.json({ message: 'Added to cart', item_id: menu_item_id });
});

// ─────────────────────────────────────────────────────
// PUT /api/cart/update
//  Body: { menu_item_id, quantity }  — 0 removes item
// ─────────────────────────────────────────────────────
router.put('/update', (req, res) => {
  const { menu_item_id, quantity } = req.body;
  if (!menu_item_id) return res.status(400).json({ error: 'menu_item_id required' });

  if (quantity <= 0) {
    db.prepare('DELETE FROM cart_items WHERE user_id=? AND menu_item_id=?')
      .run(req.user.id, menu_item_id);
    return res.json({ message: 'Item removed' });
  }

  db.prepare('UPDATE cart_items SET quantity=? WHERE user_id=? AND menu_item_id=?')
    .run(quantity, req.user.id, menu_item_id);
  res.json({ message: 'Quantity updated' });
});

// ─────────────────────────────────────────────────────
// DELETE /api/cart/item/:menuItemId
// ─────────────────────────────────────────────────────
router.delete('/item/:menuItemId', (req, res) => {
  db.prepare('DELETE FROM cart_items WHERE user_id=? AND menu_item_id=?')
    .run(req.user.id, req.params.menuItemId);
  res.json({ message: 'Item removed from cart' });
});

// ─────────────────────────────────────────────────────
// DELETE /api/cart/clear
// ─────────────────────────────────────────────────────
router.delete('/clear', (req, res) => {
  db.prepare('DELETE FROM cart_items WHERE user_id=?').run(req.user.id);
  res.json({ message: 'Cart cleared' });
});

// ─────────────────────────────────────────────────────
// POST /api/cart/apply-coupon
//  Body: { code, restaurant_id }
// ─────────────────────────────────────────────────────
router.post('/apply-coupon', (req, res) => {
  const { code, restaurant_id } = req.body;
  const offer = db.prepare(`
    SELECT * FROM offers
    WHERE code=? AND restaurant_id=? AND is_active=1
  `).get(code?.toUpperCase(), restaurant_id);

  if (!offer) return res.status(404).json({ error: 'Invalid or expired coupon code' });

  res.json({
    offer,
    message: `Coupon "${code}" applied successfully!`,
  });
});

// ── Helper: compute totals ──────────────────────────
function buildCartResponse(rows) {
  if (!rows.length) return { items: [], subtotal: 0, delivery_fee: 0, discount: 0, total: 0, restaurant: null };

  const subtotal     = rows.reduce((s, r) => s + r.price * r.quantity, 0);
  const delivery_fee = subtotal >= 500 ? 0 : (rows[0]?.restaurant_id ? 40 : 0);
  const discount     = subtotal >= 300 ? Math.round(subtotal * 0.2) : 0;
  const total        = subtotal + delivery_fee - discount;

  return {
    items: rows.map(r => ({
      cart_item_id: r.cart_item_id,
      menu_item_id: r.id,
      name:         r.name,
      emoji:        r.emoji,
      price:        r.price,
      is_veg:       Boolean(r.is_veg),
      quantity:     r.quantity,
      item_total:   r.price * r.quantity,
    })),
    restaurant: { id: rows[0].restaurant_id, name: rows[0].restaurant_name },
    subtotal,
    delivery_fee,
    discount,
    total,
    total_items: rows.reduce((s, r) => s + r.quantity, 0),
  };
}

module.exports = router;
