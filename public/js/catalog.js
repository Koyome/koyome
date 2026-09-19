/* ============================================================
   catalog.js — Catalog page: category index + grouped list.
   Every title links to its own entry detail page.
   Category names and titles follow the active language.
   ============================================================ */
(function () {
  'use strict';
  const { loadContent, escapeHtml, typeLabel, loc } = window.Koyome;
  const { t } = window.I18N;
  const esc = escapeHtml;

  function render(list) {
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

    /* Grouped sections */
    const wrap = document.getElementById('catGroups');
    wrap.innerHTML = [...groups.entries()].map(([cat, items], gi) => `
      <div class="cat-group" id="cat-${gi}">
        <div class="cat-group-title">
          <span>${esc(cat)}</span>
          <span class="n">${String(items.length).padStart(2, '0')}</span>
        </div>
        ${items.map((it, i) => `
          <a class="entry-row" href="entry.html?id=${encodeURIComponent(it.id)}">
            <span class="idx">${String(i + 1).padStart(2, '0')}</span>
            <span class="tag ${it.featured ? 'accent' : ''}">${esc(typeLabel(it.type))}</span>
            <span class="t">${esc(loc(it, 'title') || t('untitled'))}</span>
            <span class="d">${esc(it.date || '')}</span>
          </a>`).join('')}
      </div>`).join('');
  }

  loadContent().then(render);
})();
