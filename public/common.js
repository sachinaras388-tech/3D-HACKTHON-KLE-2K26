const TK = window.TK || 'token';
const tok = () => localStorage.getItem(TK);
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
async function api(path, o = {}) {
  const h = { 'Content-Type': 'application/json' };
  if (tok()) h.Authorization = 'Bearer ' + tok();
  const API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.protocol === 'file:') && location.port !== '5000' ? 'http://localhost:5000/api' : '/api';
  
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), o.timeout || 15000);
  
  try {
    const r = await fetch(API_BASE + path, { 
      method: o.method || 'GET', 
      headers: h, 
      body: o.body ? JSON.stringify(o.body) : undefined,
      signal: controller.signal
    });
    clearTimeout(id);
    if (o.raw) return r;
    
    const text = await r.text();
    let j = {};
    try { j = JSON.parse(text); } catch(e) {}
    
    if (!r.ok) { 
      const e = new Error(j.error || (text ? `Server error: ${r.status}` : 'Request failed')); 
      e.data = j; 
      e.status = r.status; 
      throw e; 
    }
    return j;
  } catch (err) {
    clearTimeout(id);
    if (err.name === 'AbortError') throw new Error('Request timed out. Please check your connection and try again.');
    throw err;
  }
}
