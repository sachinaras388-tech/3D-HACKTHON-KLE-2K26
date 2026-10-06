const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User, Domain } = require('./models');

const cache = global._mongo || (global._mongo = { conn: null, promise: null });

const DEFAULT_DOMAINS = [
  ['Healthcare', 'Tools for patients, clinics and care teams.'],
  ['Fintech', 'Payments, lending, budgeting and money safety.'],
  ['AgriTech', 'Smarter farming, crop and market solutions.'],
  ['EdTech', 'Better ways to teach, learn and assess.'],
  ['Sustainability', 'Cut waste, save energy, protect nature.'],
  ['Cybersecurity', 'Defend people, data and systems.'],
  ['AI/ML', 'Models and agents that solve real tasks.'],
  ['Open Innovation', 'Any idea that matters. Surprise us.']
];

async function seed() {
  if ((await Domain.countDocuments()) === 0)
    await Domain.insertMany(DEFAULT_DOMAINS.map(([name, description]) => ({ name, description })));
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    const email = ADMIN_EMAIL.toLowerCase();
    const existing = await User.findOne({ email });
    // Always keep the admin account in sync: wrong role / wrong hash / missing → upsert
    if (!existing || existing.role !== 'admin') {
      await User.deleteOne({ email });
      await User.create({ name: 'Admin', email, password: await bcrypt.hash(ADMIN_PASSWORD, 10), role: 'admin', emailVerified: true });
    }
  }
}

async function connect() {
  if (!process.env.MONGODB_URI) throw new Error('Missing MONGODB_URI in environment.');
  if (!process.env.JWT_SECRET) throw new Error('Missing JWT_SECRET in environment.');
  if (cache.conn) return cache.conn;
  if (!cache.promise) cache.promise = mongoose.connect(process.env.MONGODB_URI).then(async (m) => { await seed(); return m; });
  try { cache.conn = await cache.promise; } catch (e) { cache.promise = null; throw e; }
  return cache.conn;
}
module.exports = { connect };
