// ═══════════════════════════════════════════════════
//  routes/orders.js  (all routes require auth)
//
//  POST /api/orders           — place order
//  GET  /api/orders           — user's order history
//  GET  /api/orders/:id       — single order detail
//  PUT  /api/orders/:id/cancel — cancel order
// ═══════════════════════════════════════════════════
const router = require('express').Router();
const { v4: uuid } = require('uuid');
const db           = require('../db/init');
const auth         = require('../middleware/auth');

router.use(auth);

// ─────────────────────────────────────────────────────
// POST /api/orders
//  Body: { delivery_name, delivery_phone, delivery_address,
//          payment_method, coupon_code? }
// ─────────────────────────────────────────────────────
router.post('/', (req, res) => {
  const {
    delivery_name, delivery_phone, delivery_address,
    payment_method = 'upi', coupon_code,
  } = req.body;

  if (!delivery_name || !delivery_phone || !delivery_address)
    return res.status(400).json({ error: 'Delivery details required' });

  // Fetch cart
  const cartRows = db.prepare(`
    SELECT ci.quantity,
           mi.id AS menu_item_id, mi.name, mi.emoji, mi.price,
           r.id  AS restaurant_id
    FROM cart_items ci
    JOIN menu_items mi ON ci.menu_item_id = mi.id
    JOIN restaurants r ON ci.restaurant_id  = r.id
    WHERE ci.user_id = ?
  `).all(req.user.id);

  if (!cartRows.length) return res.status(400).json({ error: 'Cart is empty' });

  const restaurant_id = cartRows[0].restaurant_id;
  const subtotal      = cartRows.reduce((s, r) => s + r.price * r.quantity, 0);
  let   delivery_fee  = subtotal >= 500 ? 0 : 40;
  let   discount      = subtotal >= 300 ? Math.round(subtotal * 0.2) : 0;

  // Apply coupon override if valid
  if (coupon_code) {
    const offer = db.prepare(
      'SELECT * FROM offers WHERE code=? AND restaurant_id=? AND is_active=1'
    ).get(coupon_code.toUpperCase(), restaurant_id);
    if (offer) {
      if (offer.discount_type === 'free_delivery') delivery_fee = 0;
      else if (offer.discount_type === 'percent')  discount = Math.round(subtotal * offer.discount_value / 100);
      else if (offer.discount_type === 'flat')     discount = offer.discount_value;
    }
  }

  const total       = subtotal + delivery_fee - discount;
  const orderId     = uuid();
  const orderNumber = '#FR' + Date.now().toString().slice(-6);

  // Insert order + items in a transaction
  const placeOrder = db.transaction(() => {
    db.prepare(`
      INSERT INTO orders (id,user_id,restaurant_id,order_number,payment_method,
        subtotal,delivery_fee,discount,total,
        delivery_name,delivery_phone,delivery_address)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(orderId, req.user.id, restaurant_id, orderNumber, payment_method,
           subtotal, delivery_fee, discount, total,
           delivery_name, delivery_phone, delivery_address);

    for (const item of cartRows) {
      db.prepare(`
        INSERT INTO order_items(id,order_id,menu_item_id,name,emoji,price,quantity)
        VALUES(?,?,?,?,?,?,?)
      `).run(uuid(), orderId, item.menu_item_id, item.name, item.emoji, item.price, item.quantity);
    }

    // Clear cart
    db.prepare('DELETE FROM cart_items WHERE user_id=?').run(req.user.id);
  });

  placeOrder();

  const order = db.prepare('SELECT * FROM orders WHERE id=?').get(orderId);
  const items  = db.prepare('SELECT * FROM order_items WHERE order_id=?').all(orderId);

  res.status(201).json({
    message:      'Order placed successfully!',
    order:        order,
    items:        items,
    order_number: orderNumber,
  });
});

// ─────────────────────────────────────────────────────
// GET /api/orders
// ─────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const orders = db.prepare(`
    SELECT o.*, r.name AS restaurant_name, r.emoji AS restaurant_emoji
    FROM orders o
    JOIN restaurants r ON o.restaurant_id = r.id
    WHERE o.user_id = ?
    ORDER BY o.created_at DESC
  `).all(req.user.id);

  res.json({ orders });
});

// ─────────────────────────────────────────────────────
// GET /api/orders/:id
// ─────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const order = db.prepare(`
    SELECT o.*, r.name AS restaurant_name, r.emoji AS restaurant_emoji
    FROM orders o
    JOIN restaurants r ON o.restaurant_id = r.id
    WHERE o.id=? AND o.user_id=?
  `).get(req.params.id, req.user.id);

  if (!order) return res.status(404).json({ error: 'Order not found' });

  const items = db.prepare('SELECT * FROM order_items WHERE order_id=?').all(order.id);
  res.json({ order, items });
});

// ─────────────────────────────────────────────────────
// PUT /api/orders/:id/cancel
//  Only allowed if status is 'placed'
// ─────────────────────────────────────────────────────
router.put('/:id/cancel', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id=? AND user_id=?')
                  .get(req.params.id, req.user.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status !== 'placed')
    return res.status(400).json({ error: `Cannot cancel order in '${order.status}' state` });

  db.prepare(`UPDATE orders SET status='cancelled', updated_at=datetime("now") WHERE id=?`)
    .run(order.id);
  res.json({ message: 'Order cancelled successfully' });
});

module.exports = router;
