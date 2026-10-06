(() => {
  const c = document.getElementById('bg'); if (!c || !window.THREE) return;
  const R = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true }); R.setClearColor(0x000000, 0); R.setPixelRatio(Math.min(devicePixelRatio, 2));
  const S = new THREE.Scene(), C = new THREE.PerspectiveCamera(60, 1, .1, 200); C.position.z = 30;
  const n = 1800, a = new Float32Array(n * 3); for (let i = 0; i < n * 3; i++) a[i] = (Math.random() - .5) * (i % 3 === 2 ? 60 : 120);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3));
  const P = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffd166, size: .22, transparent: true, opacity: .82, blending: THREE.AdditiveBlending, depthWrite: false })); S.add(P);
  const gr = new THREE.GridHelper(200, 60, 0xffb547, 0x35e0c0); gr.material.transparent = true; gr.material.opacity = .2; gr.position.y = -14; S.add(gr);
  let mx = 0, my = 0; addEventListener('mousemove', (e) => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; });
  const rs = () => { R.setSize(innerWidth, innerHeight, false); C.aspect = innerWidth / innerHeight; C.updateProjectionMatrix(); }; addEventListener('resize', rs); rs();
  (function f(t) { P.rotation.y = t * .00003 + mx * .1; P.rotation.x = my * .06; gr.position.z = (t * .004) % 3.3; R.render(S, C); requestAnimationFrame(f); })(0);
})();
