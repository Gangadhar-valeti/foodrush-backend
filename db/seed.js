// ═══════════════════════════════════════════════════
//  db/seed.js — Seed restaurants, menus, demo user
// ═══════════════════════════════════════════════════
const db      = require('./init');
const bcrypt  = require('bcryptjs');
const { v4: uuid } = require('uuid');
require('dotenv').config();

console.log('🌱 Seeding database...');

// ── Clear existing data ──────────────────────────────
db.exec(`
  DELETE FROM order_items; DELETE FROM orders;
  DELETE FROM cart_items;  DELETE FROM reviews;
  DELETE FROM addresses;   DELETE FROM offers;
  DELETE FROM menu_items;  DELETE FROM menu_categories;
  DELETE FROM restaurants; DELETE FROM otps;
  DELETE FROM users;
`);

// ── Demo user ───────────────────────────────────────
const userId = uuid();
const hashedPass = bcrypt.hashSync('ravi1234', parseInt(process.env.BCRYPT_ROUNDS || 10));
db.prepare(`
  INSERT INTO users (id, name, phone, email, password, avatar_text, is_verified)
  VALUES (?, ?, ?, ?, ?, ?, 1)
`).run(userId, 'Ravi Kumar', '9876543210', 'ravi@email.com', hashedPass, 'R');

// ── Restaurant 1: Bawarchi Biryani Point ────────────
const r1 = uuid();
db.prepare(`
  INSERT INTO restaurants (id,name,description,cuisine,emoji,rating,review_count,
    distance_km,delivery_mins,delivery_fee,min_order,is_open,address,bg_gradient)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`).run(r1,
  'Bawarchi Biryani Point',
  'Best biryani in Rajahmundry · Family-friendly',
  'Biryani,Mughlai,Andhra',
  '🍛', 4.6, 342, 1.2, 25, 40, 150, 1,
  'Main Road, Near Clock Tower, Rajahmundry',
  'linear-gradient(135deg,#1a1c20,#2a2c35)'
);

// Menu categories for R1
const cat1a = uuid(), cat1b = uuid();
db.prepare(`INSERT INTO menu_categories(id,restaurant_id,name,emoji,sort_order) VALUES(?,?,?,?,?)`)
  .run(cat1a, r1, 'Biryani', '🍛', 1);
db.prepare(`INSERT INTO menu_categories(id,restaurant_id,name,emoji,sort_order) VALUES(?,?,?,?,?)`)
  .run(cat1b, r1, 'Starters', '🥗', 2);

// Menu items for R1
const items1 = [
  { id:'cdb', cat:cat1a, name:'Chicken Dum Biryani', desc:'Slow-cooked with aromatic spices · Serves 1', price:220, emoji:'🍛', veg:0, best:1 },
  { id:'vb',  cat:cat1a, name:'Veg Biryani',         desc:'Fresh vegetables, Basmati rice · Serves 1',  price:150, emoji:'🥘', veg:1, best:0 },
  { id:'mb',  cat:cat1a, name:'Mutton Biryani',       desc:'Tender mutton, secret masala · Serves 1',    price:320, emoji:'🍗', veg:0, best:0 },
  { id:'c65', cat:cat1b, name:'Chicken 65',           desc:'Crispy fried chicken, spicy sauce',          price:180, emoji:'🍗', veg:0, best:0 },
  { id:'op',  cat:cat1b, name:'Onion Pakoda',         desc:'Crispy onion fritters, mint chutney',        price:80,  emoji:'🧅', veg:1, best:0 },
];
for (const it of items1) {
  db.prepare(`
    INSERT INTO menu_items(id,restaurant_id,category_id,name,description,price,emoji,is_veg,is_bestseller)
    VALUES(?,?,?,?,?,?,?,?,?)
  `).run(it.id, r1, it.cat, it.name, it.desc, it.price, it.emoji, it.veg, it.best);
}

// Offers for R1
db.prepare(`INSERT INTO offers(id,restaurant_id,code,title,description,discount_type,discount_value,min_order) VALUES(?,?,?,?,?,?,?,?)`)
  .run(uuid(), r1, 'BIRYANI20', '20% OFF on orders above ₹300', 'Enjoy 20% off!', 'percent', 20, 300);
db.prepare(`INSERT INTO offers(id,restaurant_id,code,title,description,discount_type,discount_value,min_order) VALUES(?,?,?,?,?,?,?,?)`)
  .run(uuid(), r1, null, 'Free Delivery above ₹500', 'No delivery charge!', 'free_delivery', 0, 500);

// Reviews for R1
db.prepare(`INSERT INTO reviews(id,restaurant_id,user_id,rating,comment) VALUES(?,?,?,?,?)`)
  .run(uuid(), r1, userId, 5, "Best biryani in Rajahmundry. Dum style is absolutely perfect!");
db.prepare(`INSERT INTO reviews(id,restaurant_id,user_id,rating,comment) VALUES(?,?,?,?,?)`)
  .run(uuid(), r1, userId, 4, "Food is amazing. Chicken 65 is a must-try!");

// ── Restaurant 2: Pizza Republic ────────────────────
const r2 = uuid();
db.prepare(`
  INSERT INTO restaurants (id,name,description,cuisine,emoji,rating,review_count,
    distance_km,delivery_mins,delivery_fee,min_order,is_open,address,bg_gradient)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`).run(r2,
  'Pizza Republic',
  'Italian-style pizzas · Fast casual',
  'Pizza,Italian,Fast Food',
  '🍕', 4.3, 189, 2.8, 35, 60, 200, 1,
  'Tilak Road, Near Bus Stand, Rajahmundry',
  'linear-gradient(135deg,#1a1a2e,#2a2040)'
);

const cat2a = uuid();
db.prepare(`INSERT INTO menu_categories(id,restaurant_id,name,emoji,sort_order) VALUES(?,?,?,?,?)`)
  .run(cat2a, r2, 'Pizzas', '🍕', 1);

const items2 = [
  { id:'mg',  cat:cat2a, name:'Margherita',        desc:'Classic tomato, mozzarella, basil',    price:280, emoji:'🍕', veg:1, best:1 },
  { id:'bbq', cat:cat2a, name:'BBQ Chicken Pizza', desc:'Smoky BBQ sauce, grilled chicken',     price:380, emoji:'🍕', veg:0, best:0 },
];
for (const it of items2) {
  db.prepare(`
    INSERT INTO menu_items(id,restaurant_id,category_id,name,description,price,emoji,is_veg,is_bestseller)
    VALUES(?,?,?,?,?,?,?,?,?)
  `).run(it.id, r2, it.cat, it.name, it.desc, it.price, it.emoji, it.veg, it.best);
}

db.prepare(`INSERT INTO reviews(id,restaurant_id,user_id,rating,comment) VALUES(?,?,?,?,?)`)
  .run(uuid(), r2, userId, 4, "Thin crust is amazing! Loved the BBQ Chicken pizza.");

// ── Restaurant 3: Dragon Palace ─────────────────────
const r3 = uuid();
db.prepare(`
  INSERT INTO restaurants (id,name,description,cuisine,emoji,rating,review_count,
    distance_km,delivery_mins,delivery_fee,min_order,is_open,address,bg_gradient)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`).run(r3,
  'Dragon Palace',
  'Authentic Chinese cuisine · Dine-in & delivery',
  'Chinese,Asian',
  '🍜', 4.1, 98, 3.5, 40, 50, 150, 0,
  'Auto Nagar, Rajahmundry',
  'linear-gradient(135deg,#1a2e1a,#1a3020)'
);

const cat3a = uuid();
db.prepare(`INSERT INTO menu_categories(id,restaurant_id,name,emoji,sort_order) VALUES(?,?,?,?,?)`)
  .run(cat3a, r3, 'Noodles & Rice', '🍜', 1);

const items3 = [
  { id:'fn', cat:cat3a, name:'Fried Noodles',    desc:'Wok-tossed with veggies and soy sauce', price:160, emoji:'🍜', veg:1, best:1 },
  { id:'fr', cat:cat3a, name:'Chicken Fried Rice',desc:'Classic Chinese fried rice',            price:190, emoji:'🍚', veg:0, best:0 },
];
for (const it of items3) {
  db.prepare(`
    INSERT INTO menu_items(id,restaurant_id,category_id,name,description,price,emoji,is_veg,is_bestseller)
    VALUES(?,?,?,?,?,?,?,?,?)
  `).run(it.id, r3, it.cat, it.name, it.desc, it.price, it.emoji, it.veg, it.best);
}

// ── Restaurant 4: Andhra Spice Garden ───────────────
const r4 = uuid();
db.prepare(`
  INSERT INTO restaurants (id,name,description,cuisine,emoji,rating,review_count,
    distance_km,delivery_mins,delivery_fee,min_order,is_open,address,bg_gradient)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`).run(r4,
  'Andhra Spice Garden',
  'Traditional Andhra meals · Home-style cooking',
  'Andhra,South Indian',
  '🥘', 4.8, 517, 0.8, 20, 0, 100, 1,
  'Innespeta, Rajahmundry',
  'linear-gradient(135deg,#2e1a1a,#301a20)'
);

const cat4a = uuid(), cat4b = uuid();
db.prepare(`INSERT INTO menu_categories(id,restaurant_id,name,emoji,sort_order) VALUES(?,?,?,?,?)`)
  .run(cat4a, r4, 'Meals', '🥘', 1);
db.prepare(`INSERT INTO menu_categories(id,restaurant_id,name,emoji,sort_order) VALUES(?,?,?,?,?)`)
  .run(cat4b, r4, 'Curries', '🍲', 2);

const items4 = [
  { id:'atm', cat:cat4a, name:'Andhra Thali Meal', desc:'Full meals with rice, dal, curries, pickle', price:120, emoji:'🥘', veg:1, best:1 },
  { id:'aff', cat:cat4b, name:'Andhra Fish Fry',   desc:'Spicy coastal fish fry',                     price:260, emoji:'🐟', veg:0, best:0 },
  { id:'egm', cat:cat4b, name:'Egg Masala Curry',  desc:'Boiled eggs in spicy masala gravy',          price:140, emoji:'🍳', veg:0, best:0 },
];
for (const it of items4) {
  db.prepare(`
    INSERT INTO menu_items(id,restaurant_id,category_id,name,description,price,emoji,is_veg,is_bestseller)
    VALUES(?,?,?,?,?,?,?,?,?)
  `).run(it.id, r4, it.cat, it.name, it.desc, it.price, it.emoji, it.veg, it.best);
}

db.prepare(`INSERT INTO offers(id,restaurant_id,code,title,description,discount_type,discount_value,min_order) VALUES(?,?,?,?,?,?,?,?)`)
  .run(uuid(), r4, null, 'FREE Delivery', 'Always free delivery!', 'free_delivery', 0, 0);

// ── Demo address ────────────────────────────────────
db.prepare(`
  INSERT INTO addresses(id,user_id,label,full_text,pincode,is_default)
  VALUES(?,?,?,?,?,1)
`).run(uuid(), userId, 'Home', 'Flat 202, Sri Sai Residency, Tilak Road, Rajahmundry', '533101');

console.log('✅ Seed complete!');
console.log('   Demo login → phone: 9876543210 | password: ravi1234');
console.log('   Demo OTP   → 123456');
