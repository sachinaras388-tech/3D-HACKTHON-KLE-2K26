const nodemailer = require('nodemailer');
let tx;
const providers = {
  resend: { url: 'https://api.resend.com/emails', key: 'RESEND_API_KEY' },
  brevo: { url: 'https://api.brevo.com/v3/smtp/email', key: 'BREVO_API_KEY' },
  sendgrid: { url: 'https://api.sendgrid.com/v3/mail/send', key: 'SENDGRID_API_KEY' }
};

function transport() {
  if (!process.env.SMTP_HOST) return null;
  return tx || (tx = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: +process.env.SMTP_PORT || 587,
    secure: +process.env.SMTP_PORT === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 10000
  }));
}
const from = () => process.env.MAIL_FROM || process.env.SMTP_USER;
const h = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shell = (body) => `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;background:#0c0a26;color:#e8ecff;padding:28px;border-radius:14px;border:1px solid #8a5cff">
<h2 style="margin:0 0 14px;color:#19e6ff">KLE Inter College Hackathon 2K26</h2>${body}</div>`;

function sender() {
  const value = from();
  const match = value.match(/^\s*(.*?)\s*<([^<>]+)>\s*$/);
  if (!match) return { name: '', email: value.trim() };
  return { name: match[1].replace(/^"|"$/g, '').trim(), email: match[2].trim() };
}

async function sendWithApi({ to, subject, text, html }) {
  const provider = (process.env.MAIL_PROVIDER || '').trim().toLowerCase();
  const config = providers[provider];
  if (!config) throw new Error('Set MAIL_PROVIDER to resend, brevo, or sendgrid to use an email API.');
  const apiKey = process.env[config.key];
  if (!apiKey) throw new Error(`Missing ${config.key} for MAIL_PROVIDER=${provider}.`);

  const fromAddress = sender();
  const recipients = (Array.isArray(to) ? to : [to]).map((email) => email.trim());
  let headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
  let body;
  if (provider === 'resend') {
    body = { from: from(), to: recipients, subject, text, html };
  } else if (provider === 'brevo') {
    headers = { 'api-key': apiKey, 'Content-Type': 'application/json' };
    body = {
      sender: { email: fromAddress.email, ...(fromAddress.name && { name: fromAddress.name }) },
      to: recipients.map((email) => ({ email })),
      subject,
      textContent: text,
      htmlContent: html
    };
  } else {
    body = {
      personalizations: [{ to: recipients.map((email) => ({ email })) }],
      from: { email: fromAddress.email, ...(fromAddress.name && { name: fromAddress.name }) },
      subject,
      content: [
        ...(text ? [{ type: 'text/plain', value: text }] : []),
        ...(html ? [{ type: 'text/html', value: html }] : [])
      ]
    };
  }

  const response = await fetch(config.url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`${provider} email API returned HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
  }
}

async function sendEmail(message) {
  if (process.env.MAIL_PROVIDER) return sendWithApi(message);
  const t = transport();
  if (!t) {
    if (process.env.NODE_ENV === 'production') throw new Error('Email is not configured. Set MAIL_PROVIDER and its API key, or configure SMTP.');
    console.log(`\n[DEV] SMTP not configured. Verification code for ${message.to}: ${message.text}\n`);
    return;
  }
  await t.sendMail({ from: from(), ...message });
}

// Throws on failure so the caller can tell the participant.
async function sendOtp(user, code) {
  await sendEmail({
    to: user.email,
    subject: `${code} is your KLE Hackathon 2K26 verification code`,
    text: `Hi ${user.name}, your verification code is ${code}. It expires in 10 minutes.`,
    html: shell(`<p>Hi ${h(user.name)}, use this code to verify your email:</p>
      <p style="font-size:34px;letter-spacing:10px;font-weight:bold;color:#fff;background:#05041a;padding:14px;text-align:center;border-radius:10px">${h(code)}</p>
      <p style="color:#9aa3d6;font-size:13px">It expires in 10 minutes. If you did not sign up, ignore this email.</p>`)
  });
}

async function sendTestEmail(to) {
  await sendEmail({
    to,
    subject: 'KLE Hackathon 2K26 email test',
    text: 'Email delivery is configured successfully.',
    html: shell('<p>Email delivery is configured successfully.</p>')
  });
}

async function sendConfirmation(team) {
  if (!process.env.MAIL_PROVIDER && !process.env.SMTP_HOST) return;
  try {
    await sendEmail({
      to: [team.leader.email, ...team.members.map((m) => m.email)],
      subject: 'Registration received: KLE Inter College Hackathon 2K26',
      text: `Hi ${team.leader.name}, team ${team.name} is registered for ${team.domain}. Status: Pending. Kickoff: 10 Oct 2026, 11:00 AM. First judging: 10 Oct, 6:00 PM. Finals and results: 11 Oct, 9:00 PM.`,
      html: shell(`<p>Hi ${h(team.leader.name)}, team <b>${h(team.name)}</b> is registered for <b>${h(team.domain)}</b>. Status: <b>Pending</b>.</p>
      <p>Kickoff: 10 Oct 2026, 11:00 AM<br>First judging: 10 Oct, 6:00 PM<br>Finals and results: 11 Oct, 9:00 PM</p>
      <p>Log in to the Participant portal to track your approval status.</p>`)
    });
  } catch (e) { console.error('Email failed:', e.message); }
}
module.exports = { transport, sendOtp, sendConfirmation, sendTestEmail };
