// ═══════════════════════════════════════════════════
//  FoodRush Backend — server.js
//  Node.js + Express + SQLite + JWT
// ═══════════════════════════════════════════════════
const express  = require('express');
const cors     = require('cors');
const morgan   = require('morgan');
const path     = require('path');
require('dotenv').config();

const app = express();

// ── Middleware ──────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_URL || '*', credentials: true }));
app.use(express.json());
app.use(morgan('dev'));

// ── Database init (runs migrations) ────────────────
require('./db/init');

// ── Routes ──────────────────────────────────────────
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/restaurants', require('./routes/restaurants'));
app.use('/api/menu',        require('./routes/menu'));
app.use('/api/cart',        require('./routes/cart'));
app.use('/api/orders',      require('./routes/orders'));
app.use('/api/user',        require('./routes/user'));

// ── Health check ────────────────────────────────────
app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', time: new Date().toISOString() }));

// ── 404 handler ─────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// ── Global error handler ────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 FoodRush API running on port ${PORT}`));
