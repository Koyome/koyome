/* ============================================================
   header.js — the shared site header.
   Left: brand + language switch.  Right: a "⋯" menu holding all
   page links (opened on click).  Every page only needs
   <header class="site-header" id="siteHeader"></header> plus a
   data-page attribute on <body>.
   ============================================================ */
(function () {
  'use strict';

  const PAGES = [
    { key: 'home', href: 'index.html', label: 'nav_home' },
    { key: 'catalog', href: 'catalog.html', label: 'nav_catalog' },
    { key: 'hobbies', href: 'hobbies.html', label: 'nav_hobbies' },
    { key: 'guestbook', href: 'guestbook.html', label: 'nav_guestbook' },
  ];
  /* admin entry is owner-only — injected later by maybeRevealAdmin()
     once the API check proves this is the management machine */
  const ADMIN_PAGE = { key: 'admin', href: 'admin.html', label: 'nav_admin' };

  const host = document.getElementById('siteHeader');
  if (!host) return;
  const current = document.body.dataset.page || 'home';

  host.innerHTML = `
    <div class="header-left">
      <a class="brand" href="index.html">Koyome<span class="dot">.</span></a>
      <div class="lang-switch" role="group" data-i18n-aria="menu_label">
        <button type="button" data-lang="en">EN</button>
        <span class="sep">·</span>
        <button type="button" data-lang="zh">繁中</button>
      </div>
    </div>
    <div class="menu" id="menu">
      <button class="menu-btn" id="menuBtn" type="button"
              aria-haspopup="true" aria-expanded="false" aria-controls="menuPanel"
              data-i18n-aria="menu_label">
        <i></i><i></i><i></i>
      </button>
      <nav class="menu-panel" id="menuPanel" data-i18n-aria="menu_label">
        ${PAGES.map((p, i) => `
          <a href="${p.href}" class="${p.key === current ? 'active' : ''}" data-page="${p.key}">
            <span class="no">${String(i + 1).padStart(2, '0')}</span>
            <span data-i18n="${p.label}">${p.key}</span>
          </a>`).join('')}
      </nav>
    </div>`;

  const menu = document.getElementById('menu');
  const btn = document.getElementById('menuBtn');

  function setOpen(open) {
    menu.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    setOpen(!menu.classList.contains('open'));
  });

  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target)) setOpen(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
  });

  /* localize the markup we just injected (and mark the switch active) */
  if (window.I18N) {
    window.I18N.applyStatic();
    window.I18N.bind();
  }

  /* ---------- owner-only admin entry ----------
     data.js loads after this script, so poll briefly for Koyome,
     then ask the API: only the management machine gets the link. */
  (async function maybeRevealAdmin() {
    const panel = document.getElementById('menuPanel');
    if (!panel) return;
    let K = window.Koyome;
    for (let i = 0; i < 50 && !K; i++) {
      await new Promise((r) => setTimeout(r, 100));
      K = window.Koyome;
    }
    if (!K || !K.apiAvailable) return;
    let owner = false;
    try { owner = await K.apiAvailable(); } catch (_) { owner = false; }
    if (!owner) return;
    const a = document.createElement('a');
    a.href = ADMIN_PAGE.href;
    a.dataset.page = ADMIN_PAGE.key;
    if (ADMIN_PAGE.key === current) a.className = 'active';
    a.innerHTML = `<span class="no">${String(PAGES.length + 1).padStart(2, '0')}</span><span data-i18n="${ADMIN_PAGE.label}">${ADMIN_PAGE.key}</span>`;
    panel.appendChild(a);
    if (window.I18N) window.I18N.applyStatic();
  })();
})();
