/* ============================================================
   catalog.js — Catalog page: category index + grouped list.
   Every title links to its own entry detail page.
   Category names and titles follow the active language.

   Kinetic title index (2026-09-20):
   · rows & static blocks fade/rise in on scroll (IntersectionObserver)
   · titles split into chars with a staggered blur-rise entrance
   · hover: gradient sheen across the title + underline draw + arrow
   · ghost index numbers drift on scroll (subtle parallax)
   · owner mode (local server): double-click a title to rename inline
   ============================================================ */
(function () {
  'use strict';
  const { loadContent, escapeHtml, typeLabel, loc, apiAvailable } = window.Koyome;
  const { t } = window.I18N;
  const esc = escapeHtml;

  const RM = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const hasIO = 'IntersectionObserver' in window;

  /* ---------- entrance: reveal on scroll + char stagger ---------- */
  function paintTitle(span, text) {
    const chars = Array.from(text);
    span.innerHTML = chars.map((c, i) =>
      `<span class="ch" style="--cd:${Math.min(i * 26, 780)}ms">${esc(c)}</span>`
    ).join('');
  }

  function observeReveals(scope) {
    const els = [...scope.querySelectorAll('[data-reveal], .reveal-row')];
    if (RM || !hasIO) {
      els.forEach((el) => el.classList.add('in-view', 'settled'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const el = en.target;
        el.classList.add('in-view');
        io.unobserve(el);
        /* once the entrance is done, drop transition delays so hover feels instant */
        const d = parseFloat(getComputedStyle(el).getPropertyValue('--d')) || 0;
        setTimeout(() => el.classList.add('settled'), d * 1000 + 1700);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    els.forEach((el) => io.observe(el));
  }

  /* ---------- ghost-number parallax (very subtle) ---------- */
  function bindParallax() {
    if (RM) return;
    const ghosts = [...document.querySelectorAll('.ghost[data-speed]')];
    if (!ghosts.length) return;
    let ticking = false;
    const update = () => {
      const vh = window.innerHeight || 800;
      ghosts.forEach((g) => {
        const host = g.parentElement;
        if (!host) return;
        const r = host.getBoundingClientRect();
        const off = (r.top + r.height / 2 - vh / 2) * parseFloat(g.dataset.speed || '0.06');
        g.style.transform = 'translateY(' + off.toFixed(1) + 'px)';
      });
      ticking = false;
    };
    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* ---------- inline rename (owner mode, local server only) ---------- */
  function bindInlineRename(row, item, span, status) {
    span.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (row.classList.contains('editing')) return;
      row.classList.add('editing');

      const current = loc(item, 'title') || '';
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 't-edit';
      input.value = current;
      input.maxLength = 120;
      span.innerHTML = '';
      span.appendChild(input);
      input.focus();
      input.select();

      /* clicks inside the input must not trigger row navigation */
      input.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); });

      let done = false;
      const finish = (save) => {
        if (done) return;
        done = true;
        row.classList.remove('editing');
        const v = input.value.trim();
        if (!save || !v || v === current) { paintTitle(span, current || t('untitled')); return; }

        const field = window.I18N.isZh ? 'titleZh' : 'title';
        status.textContent = '…';
        fetch('api/content?id=' + encodeURIComponent(item.id), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [field]: v }),
        }).then(async (r) => {
          if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'fail');
          item[field] = v;
          paintTitle(span, v);
          status.textContent = t('cat_edit_saved');
        }).catch(() => {
          paintTitle(span, current || t('untitled'));
          status.textContent = t('cat_edit_fail');
        }).finally(() => {
          setTimeout(() => { status.textContent = ''; }, 2600);
        });
      };

      input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') { ev.preventDefault(); finish(true); }
        else if (ev.key === 'Escape') { ev.preventDefault(); finish(false); }
      });
      input.addEventListener('blur', () => finish(true));
    });
  }

  /* ---------- render ---------- */
  async function render(list) {
    const groups = new Map();
    list.forEach((it) => {
      const c = loc(it, 'category') || t('uncategorized');
      if (!groups.has(c)) groups.set(c, []);
      groups.get(c).push(it);
    });

    document.getElementById('totalCount').textContent =
      String(list.length).padStart(2, '0') + ' ' + t('items');

    /* Category index */
    const index = document.getElementById('catIndex');
    index.innerHTML = [...groups.keys()].map((c, i) => `
      <a href="#cat-${i}">
        <span>${esc(c)}</span>
        <span class="leader"></span>
        <span class="n">${String(groups.get(c).length).padStart(2, '0')}</span>
      </a>`).join('')
      || `<a><span>${esc(t('no_content'))}</span><span class="leader"></span><span class="n">00</span></a>`;
    index.classList.add('reveal-row');
    index.style.setProperty('--d', '0.12s');

    /* Grouped sections — kinetic title rows */
    const wrap = document.getElementById('catGroups');
    let rowNo = 0;
    wrap.innerHTML = [...groups.entries()].map(([cat, items], gi) => `
      <div class="cat-group" id="cat-${gi}">
        <div class="cat-group-title reveal-row" style="--d:${Math.min(0.05 + gi * 0.08, 0.4)}s">
          <span>${esc(cat)}</span>
          <span class="n">${String(items.length).padStart(2, '0')}</span>
        </div>
        ${items.map((it, i) => {
          rowNo += 1;
          const d = Math.min(0.08 + rowNo * 0.09, 0.55).toFixed(2) + 's';
          return `
          <a class="entry-row reveal-row" style="--d:${d}" href="entry.html?id=${encodeURIComponent(it.id)}" data-id="${esc(it.id)}">
            <span class="ghost" data-speed="0.055" aria-hidden="true">${String(rowNo).padStart(2, '0')}</span>
            <span class="idx">${String(i + 1).padStart(2, '0')}</span>
            <span class="tag ${it.featured ? 'accent' : ''}">${esc(typeLabel(it.type))}</span>
            <span class="t" data-title></span>
            <span class="arrow" aria-hidden="true">&rarr;</span>
            <span class="d">${esc(it.date || '')}</span>
            <span class="t-status" data-status></span>
          </a>`;
        }).join('')}
      </div>`).join('');

    /* paint char-split titles */
    const items = [];
    groups.forEach((arr) => arr.forEach((it) => items.push(it)));
    wrap.querySelectorAll('.entry-row').forEach((row) => {
      const item = list.find((it) => it.id === row.dataset.id);
      const span = row.querySelector('[data-title]');
      if (item && span) paintTitle(span, loc(item, 'title') || t('untitled'));
    });

    /* owner mode: inline rename when the local API is alive */
    let canEdit = false;
    try { canEdit = await apiAvailable(); } catch (_) { canEdit = false; }
    if (canEdit) {
      const hint = document.getElementById('editHint');
      if (hint) { hint.hidden = false; hint.textContent = t('cat_edit_hint'); }
      wrap.querySelectorAll('.entry-row').forEach((row) => {
        const item = list.find((it) => it.id === row.dataset.id);
        const span = row.querySelector('[data-title]');
        const status = row.querySelector('[data-status]');
        if (!item || !span) return;
        row.classList.add('can-edit');
        /* block navigation while an edit box is open */
        row.addEventListener('click', (e) => {
          if (row.classList.contains('editing')) { e.preventDefault(); e.stopPropagation(); }
        }, true);
        bindInlineRename(row, item, span, status);
      });
    }

    observeReveals(document);
    bindParallax();
  }

  loadContent().then(render);
})();
