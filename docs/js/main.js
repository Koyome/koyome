/* ============================================================
   main.js — Homepage: loading curtain + the profile block
   (portrait, name, welcome line, self-introduction).
   Everything here comes from /api/profile, so it is editable
   from the Admin page without touching code.
   ============================================================ */
(function () {
  'use strict';
  const { loadProfile, loadContent, loadHobbies, loc, escapeHtml, typeLabel } = window.Koyome;
  const { t } = window.I18N;
  const esc = escapeHtml;

  /* gentle staggered fade-in as elements enter the viewport */
  function observeReveals(els) {
    const rm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (rm || !('IntersectionObserver' in window)) {
      els.forEach((r) => r.classList.add('in-view', 'settled'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add('in-view');
        io.unobserve(en.target);
        setTimeout(() => en.target.classList.add('settled'), 1600);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -5% 0px' });
    els.forEach((r) => io.observe(r));
  }

  /* ---------- Loading curtain ---------- */
  const loader = document.getElementById('loader');
  const fill = document.getElementById('loaderFill');
  const num = document.getElementById('loaderNum');
  let p = 0;
  const timer = setInterval(() => {
    p = Math.min(100, p + Math.random() * 16 + 5);
    fill.style.width = p + '%';
    num.textContent = String(Math.floor(p)).padStart(3, '0');
    if (p >= 100) {
      clearInterval(timer);
      setTimeout(() => loader.classList.add('done'), 250);
    }
  }, 110);

  /* ---------- Profile ---------- */
  function paragraphs(text) {
    return String(text || '')
      .split(/\n\s*\n/)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => `<p>${esc(t).replace(/\n/g, '<br />')}</p>`)
      .join('');
  }

  async function render() {
    const profile = await loadProfile();

    const name = loc(profile, 'name') || 'Koyome';
    const tagline = loc(profile, 'tagline');
    const intro = loc(profile, 'intro');

    const nameEl = document.getElementById('homeName');
    nameEl.innerHTML = `${esc(name)}<span class="dot">.</span>`;

    /* the hexagram sigil carries the same name, and the welcome
       line gets a soft flicker — both follow the profile */
    const sigil = document.getElementById('sigilName');
    if (sigil) sigil.textContent = name;
    document.getElementById('homeTagline').classList.add('flicker-soft');

    document.getElementById('homeTagline').textContent = tagline;
    document.getElementById('homeIntro').innerHTML = paragraphs(intro);

    if (profile.avatar) {
      const img = document.getElementById('portraitImg');
      img.src = profile.avatar;
      img.alt = name;
    }

    document.title = name + t('home_title_suffix');
  }

  /* ---------- Catalog preview on the home page ---------- */
  async function renderCatalog() {
    const listEl = document.getElementById('homeCatList');
    if (!listEl) return;
    const items = await loadContent();
    document.getElementById('homeCatCount').textContent =
      String(items.length).padStart(2, '0') + ' ' + t('items');
    listEl.innerHTML = items.map((it, i) => `
      <a class="entry-row reveal-row" style="--d:${(0.05 + i * 0.08).toFixed(2)}s" href="entry.html?id=${encodeURIComponent(it.id)}">
        <span class="idx">${String(i + 1).padStart(2, '0')}</span>
        <span class="t">${esc(loc(it, 'title') || t('untitled'))}</span>
        <span class="d">${esc(typeLabel(it.type))}${it.date ? ' · ' + esc(it.date) : ''}</span>
      </a>`).join('');

    observeReveals([...listEl.querySelectorAll('.reveal-row')]);
  }

  /* ---------- Hobbies invitation strip ----------
     daily picks: the pictured favorites are shuffled once per calendar
     day (seeded by the date), so the strip feels alive but stays
     stable within the same day */
  function dailyShuffle(arr) {
    const d = new Date();
    let seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    const rand = () => {
      /* mulberry32 — tiny deterministic PRNG */
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let z = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
      return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
    };
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  async function renderHobbies() {
    const strip = document.getElementById('hhStrip');
    if (!strip) return;
    const doc = await loadHobbies();
    const total = doc.sections.reduce((n, s) => n + s.items.length, 0);
    document.getElementById('hhCount').textContent = String(total).padStart(2, '0') + ' ' + t('items');

    /* every pictured item from every section, shuffled by today's date */
    const pool = doc.sections.flatMap((s) => s.items.filter((it) => it.src));
    const picks = dailyShuffle(pool).slice(0, 4);
    if (!picks.length) { strip.remove(); return; } /* words + links still invite */

    strip.innerHTML = picks.map((it, i) => {
      /* proper nouns: when the current-language name is empty,
         show whichever language exists rather than "Untitled" */
      const name = loc(it, 'name') || it.name || it.nameZh || t('untitled');
      return `
      <a class="hh-card reveal-row" style="--d:${(0.05 + i * 0.09).toFixed(2)}s" href="hobbies.html">
        <figure class="hh-fig">
          <img src="${esc(it.src)}" alt="${esc(name)}" loading="lazy" decoding="async" />
        </figure>
        <div class="hh-name">${esc(name)}</div>
      </a>`;
    }).join('');

    const daily = document.getElementById('hhDaily');
    if (daily) daily.hidden = false;

    observeReveals([...strip.querySelectorAll('.reveal-row')]);
  }

  render();
  renderCatalog();
  renderHobbies();
})();
