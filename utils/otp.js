// ═══════════════════════════════════════════════════
//  utils/otp.js — OTP generation and verification
// ═══════════════════════════════════════════════════
const db   = require('../db/init');
const { v4: uuid } = require('uuid');

const OTP_EXPIRE_MINUTES = parseInt(process.env.OTP_EXPIRE_MINUTES || 5);

/**
 * Generate a 6-digit OTP, store in DB, return it.
 * In production you would send via SMS (Twilio / MSG91).
 */
function generateOtp(phone, purpose = 'register') {
  // Invalidate old OTPs for same phone+purpose
  db.prepare(`UPDATE otps SET used=1 WHERE phone=? AND purpose=? AND used=0`)
    .run(phone, purpose);

  const otp     = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = new Date(Date.now() + OTP_EXPIRE_MINUTES * 60 * 1000).toISOString();

  db.prepare(`INSERT INTO otps(id,phone,otp,purpose,expires_at) VALUES(?,?,?,?,?)`)
    .run(uuid(), phone, otp, purpose, expires);

  // TODO: In production → send OTP via SMS gateway
  console.log(`📱 OTP for ${phone} [${purpose}]: ${otp}`);
  return otp;
}

/**
 * Verify an OTP. Returns { valid: true|false, reason? }
 */
function verifyOtp(phone, inputOtp, purpose = 'register') {
  const record = db.prepare(`
    SELECT * FROM otps
    WHERE phone=? AND purpose=? AND used=0
    ORDER BY created_at DESC LIMIT 1
  `).get(phone, purpose);

  if (!record) return { valid: false, reason: 'OTP not found or already used' };
  if (new Date(record.expires_at) < new Date()) return { valid: false, reason: 'OTP expired' };
  if (record.otp !== inputOtp.trim()) return { valid: false, reason: 'Incorrect OTP' };

  // Mark used
  db.prepare(`UPDATE otps SET used=1 WHERE id=?`).run(record.id);
  return { valid: true };
}

module.exports = { generateOtp, verifyOtp };
