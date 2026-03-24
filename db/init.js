// ═══════════════════════════════════════════════════
//  db/init.js — SQLite schema setup
// ═══════════════════════════════════════════════════
const Database = require('better-sqlite3');
const path     = require('path');
require('dotenv').config();

const DB_PATH = process.env.DB_PATH || './db/foodrush.db';
const db      = new Database(path.resolve(DB_PATH));

// Enable WAL mode for performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ───────────────────────────────────────────
db.exec(`
  -- ── USERS ─────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT    PRIMARY KEY,
    name        TEXT    NOT NULL,
    phone       TEXT    UNIQUE NOT NULL,
    email       TEXT    UNIQUE,
    password    TEXT,
    avatar_text TEXT    DEFAULT 'U',
    provider    TEXT    DEFAULT 'local',   -- local | google | facebook
    is_verified INTEGER DEFAULT 0,
    created_at  TEXT    DEFAULT (datetime('now')),
    updated_at  TEXT    DEFAULT (datetime('now'))
  );

  -- ── OTP ────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS otps (
    id         TEXT PRIMARY KEY,
    phone      TEXT NOT NULL,
    otp        TEXT NOT NULL,
    purpose    TEXT NOT NULL,  -- register | login | reset
    expires_at TEXT NOT NULL,
    used       INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- ── RESTAURANTS ────────────────────────────────────
  CREATE TABLE IF NOT EXISTS restaurants (
    id              TEXT    PRIMARY KEY,
    name            TEXT    NOT NULL,
    description     TEXT,
    cuisine         TEXT,
    emoji           TEXT    DEFAULT '🍽️',
    rating          REAL    DEFAULT 0.0,
    review_count    INTEGER DEFAULT 0,
    distance_km     REAL    DEFAULT 0.0,
    delivery_mins   INTEGER DEFAULT 30,
    delivery_fee    INTEGER DEFAULT 40,
    min_order       INTEGER DEFAULT 100,
    is_open         INTEGER DEFAULT 1,
    offers          TEXT    DEFAULT '[]',  -- JSON array
    address         TEXT,
    city            TEXT    DEFAULT 'Rajahmundry',
    latitude        REAL,
    longitude       REAL,
    bg_gradient     TEXT    DEFAULT 'linear-gradient(135deg,#1a1c20,#2a2c35)',
    created_at      TEXT    DEFAULT (datetime('now'))
  );

  -- ── MENU CATEGORIES ───────────────────────────────
  CREATE TABLE IF NOT EXISTS menu_categories (
    id            TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    emoji         TEXT DEFAULT '🍽️',
    sort_order    INTEGER DEFAULT 0
  );

  -- ── MENU ITEMS ─────────────────────────────────────
  CREATE TABLE IF NOT EXISTS menu_items (
    id            TEXT    PRIMARY KEY,
    restaurant_id TEXT    NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    category_id   TEXT    REFERENCES menu_categories(id) ON DELETE SET NULL,
    name          TEXT    NOT NULL,
    description   TEXT,
    price         INTEGER NOT NULL,
    emoji         TEXT    DEFAULT '🍽️',
    is_veg        INTEGER DEFAULT 0,
    is_available  INTEGER DEFAULT 1,
    is_bestseller INTEGER DEFAULT 0,
    sort_order    INTEGER DEFAULT 0
  );

  -- ── REVIEWS ────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS reviews (
    id            TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating        REAL NOT NULL CHECK(rating >= 1 AND rating <= 5),
    comment       TEXT,
    created_at    TEXT DEFAULT (datetime('now'))
  );

  -- ── ADDRESSES ──────────────────────────────────────
  CREATE TABLE IF NOT EXISTS addresses (
    id         TEXT    PRIMARY KEY,
    user_id    TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label      TEXT    DEFAULT 'Home',
    full_text  TEXT    NOT NULL,
    pincode    TEXT,
    is_default INTEGER DEFAULT 0,
    created_at TEXT    DEFAULT (datetime('now'))
  );

  -- ── CART ───────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS cart_items (
    id            TEXT    PRIMARY KEY,
    user_id       TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    restaurant_id TEXT    NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    menu_item_id  TEXT    NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    quantity      INTEGER NOT NULL DEFAULT 1,
    added_at      TEXT    DEFAULT (datetime('now')),
    UNIQUE(user_id, menu_item_id)
  );

  -- ── ORDERS ─────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS orders (
    id              TEXT    PRIMARY KEY,
    user_id         TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    restaurant_id   TEXT    NOT NULL REFERENCES restaurants(id),
    order_number    TEXT    UNIQUE NOT NULL,
    status          TEXT    DEFAULT 'placed',  -- placed|preparing|out_for_delivery|delivered|cancelled
    payment_method  TEXT    DEFAULT 'upi',
    payment_status  TEXT    DEFAULT 'paid',
    subtotal        INTEGER NOT NULL,
    delivery_fee    INTEGER DEFAULT 40,
    discount        INTEGER DEFAULT 0,
    total           INTEGER NOT NULL,
    delivery_name   TEXT,
    delivery_phone  TEXT,
    delivery_address TEXT,
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
  );

  -- ── ORDER ITEMS ────────────────────────────────────
  CREATE TABLE IF NOT EXISTS order_items (
    id           TEXT    PRIMARY KEY,
    order_id     TEXT    NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id TEXT    NOT NULL REFERENCES menu_items(id),
    name         TEXT    NOT NULL,
    emoji        TEXT,
    price        INTEGER NOT NULL,
    quantity     INTEGER NOT NULL
  );

  -- ── OFFERS ─────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS offers (
    id            TEXT PRIMARY KEY,
    restaurant_id TEXT REFERENCES restaurants(id) ON DELETE CASCADE,
    code          TEXT,
    title         TEXT NOT NULL,
    description   TEXT,
    discount_type TEXT DEFAULT 'percent',  -- percent | flat | free_delivery
    discount_value INTEGER DEFAULT 0,
    min_order     INTEGER DEFAULT 0,
    is_active     INTEGER DEFAULT 1
  );
`);

console.log('✅ Database initialized');
module.exports = db;
