/* KLE extras: 3D auto-scrolling gallery for the footer.
   Standalone on purpose: it does not depend on three.js or on the
   main inline script, so an error elsewhere can never break it. */
(function () {
  'use strict';
  var root = document.getElementById('kleGallery');
  if (!root) return;

  var ITEMS = [
    { src: 'gallery-ekathva.jpg',   w: 447, h: 447, cap: 'Ekathva 2.0 · Inter-Collegiate Competition', alt: 'KLE BCA students at the Ekathva 2.0 inter-collegiate competition' },
    { src: 'gallery-lab.jpg',       w: 516, h: 387, cap: 'BCA Computer Lab',                          alt: 'Students working in the BCA computer lab' },
    { src: 'gallery-seminar.jpg',   w: 399, h: 501, cap: 'Seminar · Data Science with Machine Learning', alt: 'Seminar on Data Science with Machine Learning for 5th semester BCA students' },
    { src: 'gallery-placement.jpg', w: 387, h: 516, cap: 'Pre-Placement Training · V Sem 2026-27',     alt: 'Pre-placement training for V semester students, AY 2026-27' }
  ];

  var GAP = 30;
  var SPEED = 42; // pixels per second
  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var stage = root.querySelector('.kg-stage');
  if (!stage) { stage = document.createElement('div'); stage.className = 'kg-stage'; root.appendChild(stage); }

  var cards = [], L = 1, off = 0, last = null, raf = 0;
  var hover = false, dragging = false, visible = true;
  var dragX = 0, dragOff = 0;

  function build() {
    stage.innerHTML = '';
    cards = [];
    var H = window.innerWidth < 760 ? 210 : 290;
    root.style.setProperty('--kg-h', H + 'px');

    var widths = ITEMS.map(function (it) {
      var r = it.ratio || it.w / it.h;
      return Math.round(H * r);
    });
    var baseL = widths.reduce(function (a, w) { return a + w + GAP; }, 0);
    var copies = Math.max(2, Math.ceil((window.innerWidth * 1.6) / baseL));
    L = baseL * copies;

    var x = 0;
    for (var c = 0; c < copies; c++) {
      for (var i = 0; i < ITEMS.length; i++) {
        var it = ITEMS[i], w = widths[i];
        var fig = document.createElement('figure');
        fig.className = 'kg-card' + (it.logo ? ' kg-logo' : '');
        fig.style.width = w + 'px';
        var img = document.createElement('img');
        img.src = it.src;
        img.alt = c === 0 ? it.alt : '';
        img.draggable = false;
        img.decoding = 'async';
        fig.appendChild(img);
        var cap = document.createElement('figcaption');
        cap.textContent = it.cap;
        fig.appendChild(cap);
        if (c > 0) fig.setAttribute('aria-hidden', 'true');
        stage.appendChild(fig);
        cards.push({ el: fig, w: w, base: x });
        x += w + GAP;
      }
    }
    layout();
  }

  function layout() {
    var vw = root.clientWidth || window.innerWidth;
    var half = L / 2;
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      var rel = (((c.base + c.w / 2 - off) % L) + L) % L; // 0..L
      if (rel > half) rel -= L;                           // -L/2..L/2 around the centre
      var n = rel / (vw / 2);                             // -1 .. 1 at the screen edges
      var cl = Math.max(-1.4, Math.min(1.4, n));
      var ry = -cl * 46;
      var z = -Math.abs(cl) * 280;
      var sc = 1 - Math.min(Math.abs(cl), 1.4) * 0.1;
      if (Math.abs(rel) > vw / 2 + c.w) {
        c.el.style.visibility = 'hidden';
      } else {
        c.el.style.visibility = 'visible';
        c.el.style.transform =
          'translate3d(' + (rel - c.w / 2).toFixed(1) + 'px,0,' + z.toFixed(1) + 'px) ' +
          'rotateY(' + ry.toFixed(2) + 'deg) scale(' + sc.toFixed(3) + ')';
      }
    }
  }

  function frame(ts) {
    if (last === null) last = ts;
    var dt = Math.min(0.1, (ts - last) / 1000);
    last = ts;
    if (!hover && !dragging && visible && !reduce) {
      off = (off + SPEED * dt) % L;
      layout();
    }
    raf = requestAnimationFrame(frame);
  }

  /* pause on hover / touch, and drag to scrub */
  root.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') hover = true; });
  root.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') hover = false; });
  root.addEventListener('pointerdown', function (e) {
    dragging = true; dragX = e.clientX; dragOff = off;
    try { root.setPointerCapture(e.pointerId); } catch (err) {}
  });
  root.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    off = (((dragOff - (e.clientX - dragX)) % L) + L) % L;
    layout();
  });
  function endDrag() { dragging = false; }
  root.addEventListener('pointerup', endDrag);
  root.addEventListener('pointercancel', endDrag);
  root.addEventListener('lostpointercapture', endDrag);

  /* only animate while on screen */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      last = null;
    }, { rootMargin: '120px' }).observe(root);
  }

  var rt = 0;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { off = 0; build(); }, 150);
  });

  build();
  if (reduce) { off = cards.length ? cards[2].base : 0; layout(); }
  raf = requestAnimationFrame(frame);
})();


/* ==========================================================
   Domain ring: cards orbit the cup like a 3D carousel.
   - cards always stay upright and readable
   - nearer cards are bigger, brighter and drawn in front of the cup,
     farther cards are smaller and dimmer and pass behind it
   - pauses on hover/focus or while a card is open
   - desktop only; phones and "reduced motion" keep the original grid
   If anything fails, the page's original CSS rotation stays in place.
   ========================================================== */
(function () {
  'use strict';
  try {
    var stage = document.querySelector('.domain-stage');
    var dg = document.getElementById('dg');
    if (!stage || !dg || !window.matchMedia) return;

    var wide = window.matchMedia('(min-width: 960px)');
    var calm = window.matchMedia('(prefers-reduced-motion: reduce)');
    var on = false, hovered = null, visible = true, last = null, ang = 0;
    var SECONDS_PER_TURN = 46;

    function active() { return wide.matches && !calm.matches; }

    function clear() {
      var cs = dg.children;
      for (var i = 0; i < cs.length; i++) {
        cs[i].style.transform = ''; cs[i].style.zIndex = ''; cs[i].style.opacity = '';
        cs[i].classList.remove('kd-front');
      }
    }

    function sync() {
      var want = active();
      if (want === on) return;
      on = want;
      stage.classList.toggle('kd-on', on);
      if (!on) clear(); else place();
    }

    function place() {
      var cs = dg.querySelectorAll('.dc'), n = cs.length;
      if (!n) return;
      var w = dg.clientWidth || 1000;
      var Rx = Math.min(w * 0.40, 440), Ry = 208;
      for (var i = 0; i < n; i++) {
        var a = (i * 360 / n + ang) * Math.PI / 180;
        var d = Math.cos(a);                 // 1 = in front, -1 = behind
        var sx = Math.sin(a);
        var f = (d + 1) / 2;                 // 0..1
        var x = Rx * sx, y = Ry * d + 42;
        var sc = 0.72 + 0.28 * f;
        var el = cs[i];
        el.style.transform =
          'translate(-50%,-50%) translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) scale(' + sc.toFixed(3) + ') ' +
          'perspective(1000px) rotateY(' + (-sx * 20).toFixed(2) + 'deg)';
        el.style.opacity = (0.8 + 0.2 * f).toFixed(3);
        el.style.zIndex = (el === hovered || el.classList.contains('o')) ? 30 : (d > 0.1 ? 4 + Math.round(d * 10) : (d > -0.5 ? 2 : 1));
        var front = d > 0.88;
        if (front !== el.classList.contains('kd-front')) el.classList.toggle('kd-front', front);
      }
    }

    function frame(ts) {
      if (last === null) last = ts;
      var dt = Math.min(0.1, (ts - last) / 1000);
      last = ts;
      if (on) {
        var ae = document.activeElement, focused = !!(ae && ae.classList && ae.classList.contains('dc') && dg.contains(ae));
        var paused = !!hovered || !visible || focused || !!dg.querySelector('.dc.o');
        if (!paused) ang = (ang + 360 / SECONDS_PER_TURN * dt) % 360;
        place();
      }
      requestAnimationFrame(frame);
    }

    dg.addEventListener('mouseover', function (e) { var c = e.target.closest && e.target.closest('.dc'); hovered = c || null; });
    dg.addEventListener('mouseleave', function () { hovered = null; });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; last = null; }, { rootMargin: '80px' }).observe(stage);
    }
    if (wide.addEventListener) { wide.addEventListener('change', sync); calm.addEventListener('change', sync); }
    else { wide.addListener(sync); calm.addListener(sync); }

    sync();
    requestAnimationFrame(frame);
  } catch (err) { /* keep original CSS rotation */ }
})();


/* ==========================================================
   Vivid 3D scene with selectable colour themes.
   Reuses the objects created by the page's own script and only changes
   their colours / thickness / lighting. Guarded: skipped if WebGL/three failed.
   Default theme: "royal" (deep blue, electric cyan, gold highlights).
   Switch at runtime with: kleTheme('royal' | 'emerald' | 'violet' | 'sunset')
   ========================================================== */
(function () {
  'use strict';
  try {
    if (typeof THREE === 'undefined' || typeof S === 'undefined' || typeof R === 'undefined') return;

    var THEMES = {
      royal:   { bg: 0x050a2c, lo: [.02,.05,.24], mid: [.07,.27,.85], hi: [.22,.80,1.0], g1: [.25,.90,1.0], g2: [.50,.52,1.0],
                 pal: [0x19e6ff,0x4d8dff,0xffd166,0x8aa0ff,0x7ff3ff,0xffffff], orbit: [0x19e6ff,0xffd166,0x7aa2ff],
                 core: 0x3d8bff, rim: 0x19e6ff, sky: 0xdceaff, ground: 0x1f33c8, curve: 0x2fb8ff, portal: [0x19e6ff,0xffd166,0x8a7cff] },
      emerald: { bg: 0x03140f, lo: [.01,.10,.08], mid: [.04,.55,.42], hi: [.30,.98,.70], g1: [.30,1.0,.75], g2: [.90,1.0,.50],
                 pal: [0x35e0c0,0x2cd67a,0xffd166,0x9dff6a,0x7ff7d8,0xffffff], orbit: [0x35e0c0,0xffd166,0x9dff6a],
                 core: 0x2cd67a, rim: 0x35e0c0, sky: 0xe0fff0, ground: 0x0b7a55, curve: 0x35e0c0, portal: [0x35e0c0,0xffd166,0x2cd67a] },
      violet:  { bg: 0x0c0730, lo: [.07,.03,.30], mid: [.52,.13,.85], hi: [.10,.72,.95], g1: [.12,.96,1.0], g2: [1.0,.30,.85],
                 pal: [0x19e6ff,0xff3df2,0xffd166,0x8a5cff,0xff6b63,0x35e0c0], orbit: [0x19e6ff,0xffd166,0xff3df2],
                 core: 0xff3df2, rim: 0x19e6ff, sky: 0xfff0cc, ground: 0x8a5cff, curve: 0xff3df2, portal: [0xff3df2,0x19e6ff,0xffd166] },
      sunset:  { bg: 0x1d0a05, lo: [.20,.05,.03], mid: [.92,.36,.07], hi: [1.0,.76,.26], g1: [1.0,.78,.25], g2: [1.0,.42,.10],
                 pal: [0xffb020,0xff7a1a,0xffd166,0xff5a2b,0xffe08a,0xff9a3c], orbit: [0xffb020,0xff6a1a,0xffe08a],
                 core: 0xff7a1a, rim: 0xff8a3c, sky: 0xffe2b0, ground: 0xb23a10, curve: 0xff7a1a, portal: [0xff7a1a,0xffd166,0xff5a2b] }
    };
    window.KLE_THEMES = Object.keys(THEMES);

    function vec(a) { return 'vec3(' + a.map(function (n) { return n.toFixed(3); }).join(',') + ')'; }
    function frag(t) {
      return 'uniform sampler2D t;uniform float k,tm;varying vec2 u;void main(){' +
        'vec3 c=texture2D(t,u).rgb;float l=min(dot(c,vec3(.3,.6,.1))*.85,.8);' +
        'vec3 lo=' + vec(t.lo) + ',mid=' + vec(t.mid) + ',hi=' + vec(t.hi) + ';' +
        'vec3 tone=l<.5?mix(lo,mid,l*2.):mix(mid,hi,(l-.5)*2.);tone*=.30+l*.9;' +
        'c=mix(c*.35,tone,.85);' +
        'vec2 g=abs(fract(u*vec2(60.,32.)-vec2(0.,tm*.15))-.5);float gl=smoothstep(.47,.5,max(g.x,g.y));' +
        'vec3 gc=mix(' + vec(t.g1) + ',' + vec(t.g2) + ',step(g.x,g.y));c+=gc*gl*.42;' +
        'float v=smoothstep(0.,.18,u.x)*smoothstep(1.,.82,u.x)*smoothstep(0.,.12,u.y)*smoothstep(1.,.8,u.y);' +
        'gl_FragColor=vec4(c,v*k);}';
    }

    /* ---- one-time structural changes (thicker rings / gates, extra lights) ---- */
    function thick(mesh, tube) {
      var p = mesh.geometry.parameters;
      if (!p || mesh.geometry.type !== 'TorusGeometry') return false;
      var old = mesh.geometry;
      mesh.geometry = new THREE.TorusGeometry(p.radius, tube, 16, 128);
      old.dispose(); mesh.material.opacity = 1;
      return true;
    }
    var hemi = null, tubeMesh = null, starCols = null;
    try {
      if (typeof stars !== 'undefined') {
        stars.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(stars.geometry.attributes.position.count * 3), 3));
        stars.material.vertexColors = true; stars.material.size = .26; stars.material.needsUpdate = true;
      }
      if (typeof trophyGold !== 'undefined') {
        trophyGold.color.set(0xe3a421); trophyGold.emissive.set(0xc86a10); trophyGold.emissiveIntensity = .28;
        trophyBright.color.set(0xf5c94a); trophyBright.emissive.set(0xe0a030); trophyBright.emissiveIntensity = .25;
      }
      if (typeof heroLight !== 'undefined') { heroLight.color.set(0xffc15a); heroLight.intensity = 3.2; heroLight.distance = 20; }
      if (typeof heroRimLight !== 'undefined') { heroRimLight.intensity = 2.8; heroRimLight.distance = 18; }
      hemi = new THREE.HemisphereLight(0xffffff, 0x888888, .8); S.add(hemi);
      var dl = new THREE.DirectionalLight(0xffffff, .9); dl.position.set(2, 4, 6); S.add(dl);
      if (typeof orbitA !== 'undefined') { thick(orbitA, .045); thick(orbitB, .04); thick(orbitC, .035); }
      if (typeof gates !== 'undefined') gates.forEach(function (g) { if (g.geometry.type === 'TorusGeometry') thick(g, .1); else g.material.opacity = 1; });
      if (typeof curve !== 'undefined') S.children.forEach(function (o) {
        if (!tubeMesh && o.isMesh && o.geometry && o.geometry.type === 'TubeGeometry' && o.material.blending === THREE.AdditiveBlending) {
          var old = o.geometry; o.geometry = new THREE.TubeGeometry(curve, 120, .1, 10, false); old.dispose();
          o.material.opacity = 1; tubeMesh = o;
        }
      });
      if (typeof pg !== 'undefined') pg.children.forEach(function (r) { thick(r, .12); });
    } catch (e) {}

    /* ---- colours (re-applied whenever the theme changes) ---- */
    function apply(name) {
      var t = THEMES[name]; if (!t) return;
      try { S.background = new THREE.Color(t.bg); if (S.fog) S.fog.color.set(t.bg); } catch (e) {}
      try { if (typeof cm !== 'undefined') { cm.fragmentShader = frag(t); cm.needsUpdate = true; } } catch (e) {}
      try {
        if (typeof stars !== 'undefined') {
          var a = stars.geometry.attributes.color, n = a.count, c = new THREE.Color();
          for (var i = 0; i < n; i++) { c.set(t.pal[(Math.random() * t.pal.length) | 0]); a.setXYZ(i, c.r, c.g, c.b); }
          a.needsUpdate = true;
        }
        if (typeof heroCore !== 'undefined') heroCore.material.color.set(t.core);
        if (typeof heroRimLight !== 'undefined') heroRimLight.color.set(t.rim);
        if (hemi) { hemi.color.set(t.sky); hemi.groundColor.set(t.ground); }
        if (typeof orbitA !== 'undefined') { orbitA.material.color.set(t.orbit[0]); orbitB.material.color.set(t.orbit[1]); orbitC.material.color.set(t.orbit[2]); }
        if (typeof gates !== 'undefined') gates.forEach(function (g, i) { g.material.color.set(t.pal[(g.geometry.type === 'TorusGeometry' ? i : i + 1) % t.pal.length]); });
        if (tubeMesh) tubeMesh.material.color.set(t.curve);
        if (typeof pg !== 'undefined') pg.children.forEach(function (r, i) { if (r.material) r.material.color.set(t.portal[i % 3]); });
      } catch (e) {}
      try { R.render(S, C); } catch (e) {}
    }
    window.kleTheme = apply;
    apply('royal');
  } catch (err) { /* leave the original scene untouched */ }
})();
