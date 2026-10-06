const router = require('express').Router();
const { User, Team, Domain, Announcement } = require('../models');
const { auth, adminOnly } = require('../middleware/auth');
router.use(auth, adminOnly);

const rx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const csvCell = (v) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // block spreadsheet formula injection
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

// GET /api/admin/teams?search=&domain=&status=
router.get('/teams', async (req, res) => {
  const { search, domain, status } = req.query, q = {};
  if (typeof domain === 'string' && domain) q.domain = domain;
  if (['Pending', 'Approved', 'Rejected'].includes(status)) q.status = status;
  if (typeof search === 'string' && search.trim()) {
    const r = new RegExp(rx(search.trim()), 'i');
    q.$or = [{ name: r }, { college: r }, { 'leader.name': r }, { 'leader.email': r }];
  }
  res.json(await Team.find(q).select('-idFile').sort('-createdAt').lean());
});

router.get('/teams/:id', async (req, res) => {
  const t = await Team.findById(req.params.id).lean();
  t ? res.json(t) : res.status(404).json({ error: 'Team not found.' });
});

// PUT /api/admin/teams/:id  { status: 'Approved' | 'Rejected' | 'Pending' }
router.put('/teams/:id', async (req, res) => {
  if (!['Pending', 'Approved', 'Rejected'].includes(req.body.status)) return res.status(400).json({ error: 'Invalid status.' });
  const t = await Team.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true }).select('-idFile');
  t ? res.json(t) : res.status(404).json({ error: 'Team not found.' });
});

router.get('/stats', async (req, res) => {
  const g = (f) => Team.aggregate([{ $group: { _id: f, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]);
  const [total, byStatus, byDomain, bySize, byDay, people, signups] = await Promise.all([
    Team.countDocuments(), g('$status'), g('$domain'), g('$size'), g({ $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }),
    Team.aggregate([{ $group: { _id: null, n: { $sum: '$size' } } }]), User.countDocuments({ role: 'participant' })
  ]);
  res.json({ total, byStatus, byDomain, bySize, byDay: byDay.slice(-14), participants: people[0] ? people[0].n : 0, signups });
});

router.delete('/teams/:id', async (req, res) => {
  const t = await Team.findByIdAndDelete(req.params.id);
  if (t && t.user) await User.findByIdAndDelete(t.user);
  res.json({ ok: true });
});

router.get('/export-csv', async (req, res) => {
  const teams = await Team.find().select('-idFile').sort('-createdAt').lean();
  const head = ['Team', 'Size', 'College', 'ID Number', 'Domain', 'Status', 'Leader', 'Leader Email', 'Members', 'Problem Statement', 'Registered At'];
  const rows = teams.map((t) => [t.name, t.size, t.college, t.idNumber, t.domain, t.status, t.leader.name, t.leader.email,
    t.members.map((m) => `${m.name} <${m.email}>`).join('; '), t.problemStatement, t.createdAt.toISOString()]);
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="registrations.csv"' });
  res.send('\ufeff' + [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n'));
});

// Announcements
router.post('/announcements', async (req, res) => {
  const message = String(req.body.message || '').trim().slice(0, 300);
  if (!message) return res.status(400).json({ error: 'Write an announcement first.' });
  res.status(201).json(await Announcement.create({ message }));
});
router.delete('/announcements/:id', async (req, res) => { await Announcement.findByIdAndDelete(req.params.id); res.json({ ok: true }); });

// Domains
const dom = (b) => ({ name: String(b.name || '').trim().slice(0, 60), description: String(b.description || '').trim().slice(0, 200) });
router.post('/domains', async (req, res) => {
  const d = dom(req.body);
  if (!d.name) return res.status(400).json({ error: 'Domain name is required.' });
  try { res.status(201).json(await Domain.create(d)); } catch (e) { res.status(409).json({ error: 'That domain already exists.' }); }
});
router.put('/domains/:id', async (req, res) => {
  const d = dom(req.body);
  if (!d.name) return res.status(400).json({ error: 'Domain name is required.' });
  try { res.json(await Domain.findByIdAndUpdate(req.params.id, d, { new: true })); } catch (e) { res.status(409).json({ error: 'That domain already exists.' }); }
});
router.delete('/domains/:id', async (req, res) => { await Domain.findByIdAndDelete(req.params.id); res.json({ ok: true }); });

module.exports = router;
