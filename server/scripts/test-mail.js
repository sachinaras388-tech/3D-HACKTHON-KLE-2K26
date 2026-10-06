// Usage: npm run test-mail -- you@example.com
require('dotenv').config();
const { transport } = require('../lib/mail');
(async () => {
  const t = transport();
  if (!t) { console.error('SMTP_HOST is empty in .env'); process.exit(1); }
  await t.verify();
  console.log('SMTP connection OK');
  const to = process.argv[2];
  if (to) {
    await t.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject: 'SMTP test', text: 'SMTP works for KLE Hackathon 2K26.' });
    console.log('Test email sent to', to);
  }
})().catch((e) => { console.error('SMTP failed:', e.message); process.exit(1); });
