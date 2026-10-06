require('dotenv').config();

// Set public DNS + prefer IPv4 before any module triggers a network lookup
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['1.1.1.1', '8.8.8.8', '8.8.4.4']);


const express = require('express');
const cors = require('cors');
const path = require('path');
const { connect } = require('./db');

const app = express();

app.use(cors());
app.use(express.json({ limit: '3mb' }));

app.use('/api', async (req, res, next) => {
  try {
    await connect();
    next();
  } catch (e) {
    console.error('Database error:', e.message);

    res.status(500).json({
      error: e.message.startsWith('Missing')
        ? e.message
        : 'Database connection failed. Check MONGODB_URI and DNS/network connection.'
    });
  }
});

app.use('/api/admin', require('./routes/admin'));
app.use('/api', require('./routes/public'));
app.use('/api', (req, res) =>
  res.status(404).json({ error: 'Not found' })
);

app.use(express.static(path.join(__dirname, '../public')));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.status ? 'Bad request' : 'Server error'
  });
});

module.exports = app;