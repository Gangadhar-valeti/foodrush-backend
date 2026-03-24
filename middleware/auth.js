const express = require('express');
const app = express();

app.use(express.json());

// ✅ PUBLIC ROUTES (NO AUTH)
app.use('/api/auth', require('./routes/auth'));

// ✅ PROTECTED ROUTES (AUTH INSIDE THEM)
app.use('/api/cart', require('./routes/cart'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/user', require('./routes/user'));

module.exports = app;