/* ============================================================
   main.js — Homepage: loading curtain + the profile block
   (portrait, name, welcome line, self-introduction).
   Everything here comes from /api/profile, so it is editable
   from the Admin page without touching code.
   ============================================================ */
(function () {
  'use strict';
  const { loadProfile, loc, escapeHtml } = window.Koyome;
  const { t } = window.I18N;
  const esc = escapeHtml;

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

  render();
})();
