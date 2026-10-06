const router = require('express').Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { User, Team, Domain, Announcement } = require('../models');
const { auth, sign } = require('../middleware/auth');
const { sendConfirmation, sendOtp } = require('../lib/mail');

const EMAIL = /^\S+@\S+\.\S+$/;
const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

async function validate(b) {
  const d = {
    name: str(b.team, 80), size: Number(b.size), college: str(b.college, 120), idNumber: str(b.idn, 60),
    domain: str(b.domain, 60), problemStatement: str(b.ps, 3000),
    leader: { name: str(b.ln, 80), email: str(b.le, 120).toLowerCase() }
  };
  if (!d.name || !d.college || !d.idNumber || !d.leader.name) return { error: 'Fill in all required fields.' };
  if (![2, 3, 4].includes(d.size)) return { error: 'Team size must be 2, 3 or 4.' };
  if (!EMAIL.test(d.leader.email)) return { error: 'Enter a valid team leader email.' };

  if (!(await Domain.exists({ name: d.domain }))) return { error: 'Choose a valid domain.' };
  const m = Array.isArray(b.members) ? b.members : [];
  if (m.length !== d.size - 1) return { error: `Add details for all ${d.size - 1} other team members.` };
  d.members = [];
  for (const x of m) {
    const mm = { name: str(x && x.name, 80), email: str(x && x.email, 120).toLowerCase() };
    if (!mm.name || !EMAIL.test(mm.email)) return { error: 'Each member needs a name and a valid email.' };
    d.members.push(mm);
  }
  if (typeof b.idFile === 'string' && b.idFile) {
    if (!/^data:(image\/(png|jpe?g|webp)|application\/pdf);base64,/.test(b.idFile) || b.idFile.length > 2e6)
      return { error: 'ID card must be an image or PDF under 1.5 MB.' };
    d.idFile = b.idFile;
  }
  return { data: d };
}

// Email verification (6-digit code sent over SMTP)
const hashCode = (email, code) => crypto.createHmac('sha256', process.env.JWT_SECRET).update(email + ':' + code).digest('hex');
const sameHash = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
async function issueOtp(u) {
  const code = String(crypto.randomInt(100000, 1000000));
  u.otpHash = hashCode(u.email, code); u.otpExpires = new Date(Date.now() + 10 * 60 * 1000); u.otpAttempts = 0; u.otpSentAt = new Date();
  await u.save();
  await sendOtp(u, code);
}
const MAIL_FAIL = 'We could not send the verification email. Check the SMTP settings, then press Resend code.';

// POST /api/signup : creates an unverified account and emails a code
router.post('/signup', async (req, res) => {
  const name = str(req.body.name, 80), email = str(req.body.email, 120).toLowerCase(), pw = String(req.body.password || '');
  if (!name || !EMAIL.test(email)) return res.status(400).json({ error: 'Enter your name and a valid email.' });
  if (pw.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  let u = await User.findOne({ email });
  if (u && u.emailVerified) return res.status(409).json({ error: 'This email already has an account. Log in instead.' });
  const password = await bcrypt.hash(pw, 10);
  if (u) { u.name = name; u.password = password; } else u = new User({ name, email, password, role: 'participant' });
  try { await issueOtp(u); }
  catch (e) { console.error('OTP email failed:', e.message); return res.status(502).json({ error: MAIL_FAIL, needsVerification: true, email }); }
  res.status(201).json({ ok: true, needsVerification: true, email });
});

// POST /api/verify-email { email, code } : activates the account and logs in
router.post('/verify-email', async (req, res) => {
  const email = str(req.body.email, 120).toLowerCase(), code = str(String(req.body.code || ''), 10);
  const u = await User.findOne({ email });
  if (!u || u.emailVerified || !u.otpHash) return res.status(400).json({ error: 'Invalid or expired code. Request a new one.' });
  if (u.otpExpires < new Date() || u.otpAttempts >= 5) return res.status(400).json({ error: 'This code has expired or was tried too many times. Press Resend code.' });
  if (!sameHash(hashCode(email, code), u.otpHash)) {
    u.otpAttempts += 1; await u.save();
    return res.status(400).json({ error: `Wrong code. ${Math.max(0, 5 - u.otpAttempts)} tries left.` });
  }
  u.emailVerified = true; u.otpHash = undefined; u.otpExpires = undefined; u.otpAttempts = 0; await u.save();
  res.json({ token: sign(u), role: u.role, name: u.name });
});

// POST /api/resend-code { email } : 60 second cooldown
router.post('/resend-code', async (req, res) => {
  const u = await User.findOne({ email: str(req.body.email, 120).toLowerCase() });
  if (u && !u.emailVerified) {
    const wait = u.otpSentAt ? 60 - Math.floor((Date.now() - u.otpSentAt) / 1000) : 0;
    if (wait > 0) return res.status(429).json({ error: `Please wait ${wait} seconds before requesting another code.` });
    try { await issueOtp(u); } catch (e) { console.error('OTP email failed:', e.message); return res.status(502).json({ error: MAIL_FAIL }); }
  }
  res.json({ ok: true });
});

// POST /api/team : logged-in participant registers their team
router.post('/team', auth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user || user.role !== 'participant') return res.status(403).json({ error: 'Only participants can register a team.' });
  if (await Team.exists({ user: user._id })) return res.status(409).json({ error: 'You already registered a team. Edit it from your dashboard.' });
  const { error, data } = await validate({ ...req.body, le: user.email, ln: str(req.body.ln, 80) || user.name });
  if (error) return res.status(400).json({ error });
  const team = await Team.create({ ...data, user: user._id });
  user.team = team._id; await user.save();
  sendConfirmation(team);
  res.status(201).json({ ok: true, team: { id: team._id, name: team.name, status: team.status } });
});

// POST /api/login : participants and admins
router.post('/login', async (req, res) => {
  const email = str(req.body.email, 120).toLowerCase();
  const u = await User.findOne({ email });
  if (!u || !(await bcrypt.compare(String(req.body.password || ''), u.password))) return res.status(401).json({ error: 'Wrong email or password.' });
  if (u.role === 'participant' && !u.emailVerified) return res.status(403).json({ error: 'Verify your email first. Enter the code we sent you, or press Resend code.', needsVerification: true, email });
  res.json({ token: sign(u), role: u.role, name: u.name });
});

// GET /api/me : the participant's own team
router.get('/me', auth, async (req, res) => {
  const user = await User.findById(req.user.id).select('name email role');
  const team = await Team.findOne({ user: req.user.id }).lean();
  if (!team) return res.json({ user, team: null });
  team.hasId = !!team.idFile; delete team.idFile;
  res.json({ user, team });
});

// PUT /api/me/team : edit team details, domain, problem statement
router.put('/me/team', auth, async (req, res) => {
  const team = await Team.findOne({ user: req.user.id });
  if (!team) return res.status(404).json({ error: 'No team found for this account.' });
  const b = { ...req.body, ln: team.leader.name, le: team.leader.email };
  const { error, data } = await validate(b);
  if (error) return res.status(400).json({ error });
  Object.assign(team, { name: data.name, size: data.size, college: data.college, idNumber: data.idNumber, domain: data.domain, problemStatement: data.problemStatement, members: data.members });
  if (data.idFile) team.idFile = data.idFile;
  await team.save();
  res.json({ ok: true });
});

router.get('/domains', async (req, res) => res.json(await Domain.find().sort('name').lean()));
router.get('/announcements', async (req, res) => res.json(await Announcement.find().sort('-createdAt').limit(20).lean()));

module.exports = router;
