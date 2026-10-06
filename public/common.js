const TK = window.TK || 'token';
const tok = () => localStorage.getItem(TK);
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
async function api(path, o = {}) {
  const h = { 'Content-Type': 'application/json' };
  if (tok()) h.Authorization = 'Bearer ' + tok();
  const API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.protocol === 'file:') && location.port !== '5000' ? 'http://localhost:5000/api' : '/api';
  const r = await fetch(API_BASE + path, { method: o.method || 'GET', headers: h, body: o.body ? JSON.stringify(o.body) : undefined });
  if (o.raw) return r;
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || 'Request failed'); e.data = j; throw e; }
  return j;
}
