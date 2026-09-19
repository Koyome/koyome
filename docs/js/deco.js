/* ============================================================
   deco.js — floating geometric decorations.
   A few irregular line shapes drift, rotate and sway slowly at
   the edges of every page; they also lean gently away from the
   cursor. Everything is pointer-events:none, sits behind the
   content (z-index 0 vs 1), pauses offscreen, and goes fully
   static when the user prefers reduced motion.
   ============================================================ */
(function () {
  'use strict';

  /* phones get the design too — just fewer, smaller, calmer shapes,
     and no cursor-lean (there is no cursor) */
  const MOBILE = !!(window.matchMedia && window.matchMedia('(max-width: 720px)').matches);
  const TOUCH = !!(window.matchMedia && window.matchMedia('(hover: none)').matches);

  const RM = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const page = (document.body && document.body.dataset.page) || 'home';

  /* irregular hand-drawn-ish line shapes (stroke only) */
  const S = 'fill="none" stroke-width="1.3"';
  const SHAPES = [
    /* wobbly circle */
    `<svg viewBox="0 0 100 100"><path ${S} d="M50 8 C76 6 94 26 92 52 C90 78 70 94 48 92 C24 90 6 72 9 47 C12 24 28 10 50 8 Z"/></svg>`,
    /* skewed triangle */
    `<svg viewBox="0 0 100 100"><path ${S} d="M52 10 L90 84 L14 76 Z"/></svg>`,
    /* tilted square */
    `<svg viewBox="0 0 100 100"><rect ${S} x="22" y="22" width="56" height="56" transform="rotate(14 50 50)"/></svg>`,
    /* open arc + chord */
    `<svg viewBox="0 0 100 100"><path ${S} d="M14 66 A 40 40 0 0 1 86 66"/><line ${S} x1="14" y1="66" x2="86" y2="66" stroke-dasharray="4 6"/></svg>`,
    /* diamond shard */
    `<svg viewBox="0 0 100 100"><path ${S} d="M50 6 L88 44 L58 94 L12 56 Z"/></svg>`,
    /* cross of two short rules */
    `<svg viewBox="0 0 100 100"><line ${S} x1="50" y1="14" x2="50" y2="86"/><line ${S} x1="18" y1="54" x2="82" y2="46"/></svg>`,
    /* half-moon */
    `<svg viewBox="0 0 100 100"><path ${S} d="M70 12 A 42 42 0 1 0 70 88 A 34 34 0 1 1 70 12 Z"/></svg>`,
    /* ladder zigzag */
    `<svg viewBox="0 0 100 100"><path ${S} d="M20 82 L40 62 L32 42 L56 30 L50 12"/><circle ${S} cx="72" cy="72" r="12"/></svg>`,
  ];

  /* per-page placements: [shapeIdx, left%, top%, size, tint, driftAmp, spinSec, mouseDepth]
     tint: 'line' = hairline grey, 'accent' = signal red */
  const PLACE = {
    home: [
      [0, 88, 16, 120, 'line', 18, 90, 0.05],
      [3, 4, 68, 90, 'accent', 14, 70, 0.09],
      [5, 76, 82, 64, 'line', 12, 0, 0.13],
    ],
    catalog: [
      [1, 91, 22, 110, 'line', 16, 110, 0.06],
      [6, 3, 46, 84, 'accent', 13, 80, 0.1],
      [4, 86, 78, 72, 'line', 15, 95, 0.08],
    ],
    hobbies: [
      [2, 90, 14, 100, 'accent', 15, 100, 0.07],
      [7, 3, 60, 92, 'line', 12, 0, 0.11],
      [0, 82, 84, 76, 'line', 17, 85, 0.06],
    ],
    guestbook: [
      [4, 89, 20, 96, 'line', 14, 105, 0.07],
      [5, 5, 74, 70, 'accent', 12, 0, 0.12],
    ],
    admin: [
      [1, 90, 18, 92, 'line', 13, 100, 0.06],
      [6, 4, 72, 78, 'line', 15, 90, 0.09],
    ],
  };
  const spots = PLACE[page] || PLACE.home;

  /* mobile variant: two shapes max, ~55% size, gentler drift, no mouse depth,
     and nudged inward so nothing is cropped off the narrow screen */
  const effective = MOBILE
    ? spots.slice(0, 2).map(([si, x, y, size, tint, amp, spin]) => [
        si, Math.min(Math.max(x, 8), 78), y, Math.round(size * 0.55),
        tint, Math.max(amp * 0.5, 6), spin, 0,
      ])
    : spots;

  const COLORS = { line: '#b4b2a9', accent: '#9e2b25' };
  const shapes = effective.map(([si, x, y, size, tint, amp, spin, depth], i) => {
    const el = document.createElement('div');
    el.className = 'deco-shape';
    el.setAttribute('aria-hidden', 'true');
    el.style.left = x + '%';
    el.style.top = y + '%';
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.opacity = tint === 'accent' ? '0.16' : '0.34';
    el.innerHTML = SHAPES[si];
    const svg = el.firstChild;
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.color = COLORS[tint];
    svg.querySelectorAll('[stroke-width]').forEach((n) => (n.style.stroke = 'currentColor'));
    document.body.appendChild(el);
    return { el, amp, spin, depth, seed: i * 1.7 + x * 0.13, x: 0, y: 0, tx: 0, ty: 0 };
  });

  if (RM) return; /* static shapes only */

  /* cursor lean — shapes drift slightly away from the pointer (desktop only) */
  if (!TOUCH) {
    window.addEventListener('mousemove', (e) => {
      const cx = (e.clientX / window.innerWidth - 0.5) * 2;
      const cy = (e.clientY / window.innerHeight - 0.5) * 2;
      shapes.forEach((s) => { s.tx = -cx * s.depth * 220; s.ty = -cy * s.depth * 220; });
    }, { passive: true });
  }

  let visible = !document.hidden;
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; });

  let t0 = performance.now();
  (function tick(now) {
    requestAnimationFrame(tick);
    if (!visible) { t0 = now; return; }
    const time = (now - t0) / 1000;
    shapes.forEach((s) => {
      /* slow drift: two sine waves out of phase */
      const dx = Math.sin(time * 0.11 + s.seed) * s.amp;
      const dy = Math.cos(time * 0.087 + s.seed * 1.3) * s.amp;
      /* eased approach toward the mouse-lean target */
      s.x += (s.tx - s.x) * 0.03;
      s.y += (s.ty - s.y) * 0.03;
      const rot = s.spin ? (time * 360) / (s.spin * 10) % 360 : Math.sin(time * 0.05 + s.seed) * 6;
      s.el.style.transform =
        `translate(${(dx + s.x).toFixed(1)}px, ${(dy + s.y).toFixed(1)}px) rotate(${rot.toFixed(2)}deg)`;
    });
  })(t0);
})();
