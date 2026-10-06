const nodemailer = require('nodemailer');
let tx;
function transport() {
  if (!process.env.SMTP_HOST) return null;
  return tx || (tx = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: +process.env.SMTP_PORT || 587,
    secure: +process.env.SMTP_PORT === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
  }));
}
const from = () => process.env.MAIL_FROM || process.env.SMTP_USER;
const h = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shell = (body) => `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;background:#0c0a26;color:#e8ecff;padding:28px;border-radius:14px;border:1px solid #8a5cff">
<h2 style="margin:0 0 14px;color:#19e6ff">KLE Inter College Hackathon 2K26</h2>${body}</div>`;

// Throws on failure so the caller can tell the participant.
async function sendOtp(user, code) {
  const t = transport();
  if (!t) {
    if (process.env.NODE_ENV === 'production') throw new Error('SMTP is not configured');
    console.log(`\n[DEV] SMTP not configured. Verification code for ${user.email}: ${code}\n`);
    return;
  }
  await t.sendMail({
    from: from(), to: user.email,
    subject: `${code} is your KLE Hackathon 2K26 verification code`,
    text: `Hi ${user.name}, your verification code is ${code}. It expires in 10 minutes.`,
    html: shell(`<p>Hi ${h(user.name)}, use this code to verify your email:</p>
      <p style="font-size:34px;letter-spacing:10px;font-weight:bold;color:#fff;background:#05041a;padding:14px;text-align:center;border-radius:10px">${h(code)}</p>
      <p style="color:#9aa3d6;font-size:13px">It expires in 10 minutes. If you did not sign up, ignore this email.</p>`)
  });
}

async function sendConfirmation(team) {
  const t = transport();
  if (!t) return;
  try {
    await t.sendMail({
      from: from(),
      to: [team.leader.email, ...team.members.map((m) => m.email)].join(','),
      subject: 'Registration received: KLE Inter College Hackathon 2K26',
      html: shell(`<p>Hi ${h(team.leader.name)}, team <b>${h(team.name)}</b> is registered for <b>${h(team.domain)}</b>. Status: <b>Pending</b>.</p>
      <p>Kickoff: 10 Oct 2026, 11:00 AM<br>First judging: 10 Oct, 6:00 PM<br>Finals and results: 11 Oct, 9:00 PM</p>
      <p>Log in to the Participant portal to track your approval status.</p>`)
    });
  } catch (e) { console.error('Email failed:', e.message); }
}
module.exports = { transport, sendOtp, sendConfirmation };
