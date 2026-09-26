/* ============================================================
   entry.js — Entry detail page.
   · Full entry view + media gallery (images / videos / MP3 tracks)
   · Body text renders for EVERY type — for image/video entries it
     appears as a designed "note" that accompanies the media
   · Owner tools: upload media, incl. MP3s with cover art
     (cover is read from the file's ID3 tag when present,
     otherwise picked manually)
   ============================================================ */
(function () {
  'use strict';
  const { loadContent, saveOverride, escapeHtml, typeLabel, normalize, apiAvailable, loc } = window.Koyome;
  const { t } = window.I18N;
  const esc = escapeHtml;
  const $ = (id) => document.getElementById(id);

  const params = new URLSearchParams(location.search);
  const entryId = params.get('id');
  let entry = null;
  let canEdit = false; /* owner mode — inline title / desc / caption editing */

  const RM = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* reveal-on-scroll for media blocks (same language as the catalog) */
  function observeReveals(scope) {
    const els = [...scope.querySelectorAll('.reveal-row')];
    if (RM || !('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('in-view', 'settled'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add('in-view');
        io.unobserve(en.target);
        const d = parseFloat(getComputedStyle(en.target).getPropertyValue('--d')) || 0;
        setTimeout(() => en.target.classList.add('settled'), d * 1000 + 1200);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -4% 0px' });
    els.forEach((el) => io.observe(el));
  }

  async function init() {
    const list = await loadContent();
    entry = list.find((it) => it.id === entryId) || null;
    if (!entry) {
      $('entryHead').innerHTML = `<div class="empty">${esc(t('entry_not_found'))}</div>`;
      $('ownerTools').style.display = 'none';
      return;
    }
    normalize(entry);
    try { canEdit = await apiAvailable(); } catch (_) { canEdit = false; }
    /* owner-only: reveal the upload tools once the API check passes */
    if (canEdit) $('ownerTools').hidden = false;
    const title = loc(entry, 'title') || t('untitled');
    document.title = `${title} · Koyome`;
    renderHead(title);
    renderBody();
    renderAboutFigure();
    renderMedia();
    renderMaps();
    renderStarfield();
  }

  /* t2 (About Koyome): a second ink portrait keeps the words company —
     floated into the prose so the text wraps around her, printed onto
     the page with the exact same treatment as the home portrait
     (multiply ink, drop shadow, dark-mode invert, the same idle sway) */
  function renderAboutFigure() {
    if (entry.id !== 't2') return;
    const body = $('entryBody');
    if (!body || !body.firstChild) return;
    const img = document.createElement('img');
    /* dark mode uses the pre-baked variant, never a runtime invert filter
       (iOS WebKit stale-composited-layer bug — see style.css) */
    img.dataset.darkSrc = 'assets/figure_tanya_rifle_dark.webp';
    img.dataset.lightSrc = 'assets/figure_tanya_rifle.webp';
    img.src = document.documentElement.dataset.theme === 'dark'
      ? img.dataset.darkSrc
      : img.dataset.lightSrc;
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    img.decoding = 'async';
    img.className = 'about-figure portrait-cutout';
    body.prepend(img);
  }

  function renderHead(title) {
    const desc = loc(entry, 'desc');
    $('entryHead').innerHTML = `
      <div class="card-meta">
        <span class="tag accent">${esc(typeLabel(entry.type))}</span>
        <span>${esc(loc(entry, 'category') || t('uncategorized'))}</span>
        <span>${esc(entry.date || '')}</span>
        ${entry.featured ? '<span>★</span>' : ''}
      </div>
      <h1 data-etitle>${esc(title)}</h1>
      ${desc ? `<p class="desc" data-edesc>${esc(desc)}</p>` : (canEdit ? `<p class="desc desc-empty" data-edesc></p>` : '')}
      ${canEdit ? `<p class="edit-hint entry-edit-hint">${esc(t('caption_edit_hint'))}</p>` : ''}`;

    if (!canEdit) return;

    /* double-click the title or the description to edit in place */
    const h1 = $('entryHead').querySelector('[data-etitle]');
    bindInlineText(h1, () => loc(entry, 'title') || '', async (v) => {
      const field = window.I18N.isZh ? 'titleZh' : 'title';
      await putContent({ [field]: v });
      entry[field] = v;
      document.title = `${v} · Koyome`;
      return v;
    }, false);

    const dp = $('entryHead').querySelector('[data-edesc]');
    if (dp) bindInlineText(dp, () => loc(entry, 'desc') || '', async (v) => {
      const field = window.I18N.isZh ? 'descZh' : 'desc';
      await putContent({ [field]: v });
      entry[field] = v;
      return v;
    }, true);
  }

  async function putContent(fields) {
    const r = await fetch('api/content?id=' + encodeURIComponent(entry.id), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
    if (!r.ok) throw new Error('fail');
  }

  /* generic double-click inline editor for a single field
     (single-line input or multiline textarea) */
  function bindInlineText(el, getter, saver, multiline, allowEmpty) {
    if (!el) return;
    el.classList.add('editable');
    el.addEventListener('dblclick', (e) => {
      e.preventDefault();
      if (el.classList.contains('editing')) return;
      el.classList.add('editing');
      const current = getter();
      const input = document.createElement(multiline ? 'textarea' : 'input');
      if (!multiline) input.type = 'text';
      input.className = multiline ? 'cap-edit' : 't-edit';
      input.value = current;
      el.textContent = '';
      el.appendChild(input);
      input.focus();
      input.select();
      let done = false;
      const finish = (save) => {
        if (done) return;
        done = true;
        el.classList.remove('editing');
        const v = input.value.trim();
        if (!save || v === current || (!v && !allowEmpty)) { el.textContent = current || (allowEmpty ? t('caption_empty') : ''); return; }
        el.textContent = '…';
        saver(v).then((shown) => {
          el.textContent = shown;
          flashStatus(t('cat_edit_saved'));
        }).catch(() => {
          el.textContent = current;
          flashStatus(t('cat_edit_fail'));
        });
      };
      input.addEventListener('keydown', (ev) => {
        if (!multiline && ev.key === 'Enter') { ev.preventDefault(); finish(true); }
        if (ev.key === 'Escape') { ev.preventDefault(); finish(false); }
      });
      input.addEventListener('blur', () => finish(true));
    });
  }

  function flashStatus(msg) {
    let s = document.querySelector('.entry-edit-hint');
    if (!s) return;
    const prev = s.textContent;
    s.textContent = msg;
    setTimeout(() => { s.textContent = prev; }, 2400);
  }

  /* Body text: the main prose for text entries; a designed note
     that walks alongside the media for image / video entries. */
  function renderBody() {
    const body = loc(entry, 'body');
    if (!body || !String(body).trim()) { $('entryBody').innerHTML = ''; return; }
    $('entryBody').innerHTML = entry.type === 'text'
      ? `<div class="entry-prose">${esc(body)}</div>`
      : `<div class="entry-note">
           <span class="note-label">${esc(t('note_label'))}</span>
           <div class="entry-prose note-prose">${esc(body)}</div>
         </div>`;
  }

  const PLACEHOLDER_COVER =
    "data:image/svg+xml," + encodeURIComponent(
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'>" +
      "<rect width='96' height='96' fill='#e4e2df'/>" +
      "<circle cx='48' cy='48' r='26' fill='none' stroke='#b4b2a9' stroke-width='1.5'/>" +
      "<circle cx='48' cy='48' r='6' fill='#9e2b25'/></svg>");

  function trackTitle(m, i) {
    if (m.title) return m.title;
    const fn = String(m.src || '').split('/').pop().replace(/^\d+_/, '').replace(/\.[^.]*$/, '');
    return fn || `${t('media_track')} ${String(i + 1).padStart(2, '0')}`;
  }

  /* layout rhythm for the media grid — breaks the single column into
     wide / offset / half blocks. Audio tracks always span full width. */
  const LAY_CYCLE = ['lay-a', 'lay-b', 'lay-wide', 'lay-c', 'lay-d'];
  function layoutClasses() {
    const visual = entry.media.filter((m) => m.type !== 'audio').length;
    let vi = 0;
    return entry.media.map((m) => {
      if (m.type === 'audio') return 'lay-track';
      if (visual === 1) { vi++; return 'lay-wide'; }
      return LAY_CYCLE[(vi++) % LAY_CYCLE.length];
    });
  }

  /* set by renderDeck() so the travel maps can lift a named print
     to the top of the pile (null on every other board) */
  let i1DeckCtl = null;

  function renderMedia() {
    const wrap = $('entryMedia');
    /* one border language per board: the stack carries the entry id
       so CSS can frame travel photos / films / tracks differently */
    wrap.className = 'media-stack media-' + entry.id;
    i1DeckCtl = null;
    if (!entry.media || !entry.media.length) { wrap.innerHTML = ''; return; }

    /* the travel board shows its photographs as a pile of prints */
    if (entry.id === 'i1' && entry.media.length > 1 &&
        entry.media.every((m) => m.type !== 'audio')) {
      renderDeck(wrap);
      return;
    }

    const lays = layoutClasses();
    wrap.innerHTML = entry.media.map((m, i) => {
      const label = m.type === 'audio'
        ? `${esc(t('media_track'))} ${String(i + 1).padStart(2, '0')}`
        : `${esc(typeLabel(m.type))} ${String(i + 1).padStart(2, '0')}`;
      let inner;
      if (m.type === 'video') {
        /* preload="none": nine 20-45MB films must not all handshake on
           page load — the browser fetches one only when played */
        inner = `<video src="${esc(m.src)}" controls preload="none" playsinline></video>`;
      } else if (m.type === 'audio') {
        inner = `
          <div class="track-card">
            <div class="track-cover"><img src="${esc(m.cover || PLACEHOLDER_COVER)}" alt="" loading="lazy" decoding="async"></div>
            <div class="track-main">
              <div class="track-title">${esc(trackTitle(m, i))}</div>
              <audio src="${esc(m.src)}" controls preload="none"></audio>
            </div>
          </div>`;
      } else {
        inner = `<img src="${esc(m.src)}" alt="${esc(loc(entry, 'title'))} ${i + 1}" loading="lazy" decoding="async">`;
      }
      const cap = loc(m, 'caption');
      const d = Math.min(0.05 + i * 0.1, 0.5).toFixed(2) + 's';
      return `
      <div class="media-block ${lays[i]} reveal-row" style="--d:${d}">
        <div class="media-item${m.type === 'audio' ? ' is-track' : ''}">
          <span class="media-label">${label}</span>
          ${inner}
          ${canEdit ? `<button class="media-del" data-index="${i}" title="${esc(t('del'))}">${esc(t('del'))} ✕</button>` : ''}
        </div>
        ${(cap || canEdit) ? `
        <div class="media-cap" data-cap="${i}">
          <span class="cap-label">${esc(t('caption_label'))}</span>
          <div class="cap-text${cap ? '' : ' is-empty'}" data-captext>${cap ? esc(cap) : esc(t('caption_empty'))}</div>
          <span class="cap-status" data-capstatus></span>
        </div>` : ''}
      </div>`;
    }).join('');

    wrap.querySelectorAll('.media-del').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm(t('confirm_del'))) return;
        const index = parseInt(btn.dataset.index, 10);
        const api = await apiAvailable();
        if (api) {
          await fetch(`api/media?id=${encodeURIComponent(entry.id)}&index=${index}`, { method: 'DELETE' });
        }
        entry.media.splice(index, 1);
        entry.src = entry.media.length ? entry.media[0].src : '';
        if (!api) {
          const list = await loadContent();
          const mine = list.find((it) => it.id === entry.id);
          if (mine) { mine.media = entry.media; mine.src = entry.src; saveOverride(list); }
        }
        renderMedia();
      });
    });

    /* caption editing — double-click the caption area */
    if (canEdit) {
      wrap.querySelectorAll('[data-captext]').forEach((el) => {
        const index = parseInt(el.closest('[data-cap]').dataset.cap, 10);
        bindInlineText(el, () => loc(entry.media[index], 'caption') || '', async (v) => {
          const field = window.I18N.isZh ? 'captionZh' : 'caption';
          const r = await fetch(
            `api/media?id=${encodeURIComponent(entry.id)}&index=${index}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ [field]: v }),
            });
          if (!r.ok) throw new Error('fail');
          entry.media[index][field] = v;
          el.classList.toggle('is-empty', !v);
          return v || t('caption_empty');
        }, true, true);
      });
    }

    observeReveals(wrap);
  }

  /* ================= i1 photo deck =================
     The travel photographs rest as a pile of prints: the top one is
     fully visible, the next few peek out behind it. Clicking the pile
     sends the top print gliding off and it settles at the very back —
     an endless, calm shuffle. The shared caption strip below always
     describes whichever print is on top. */
  function renderDeck(wrap) {
    const n = entry.media.length;
    const order = entry.media.map((_, i) => i);   /* order[0] = top print */
    let busy = false;

    const anyCap = entry.media.some((m) => loc(m, 'caption'));
    wrap.innerHTML = `
    <div class="deck reveal-row" tabindex="0" role="group"
         aria-label="${esc(loc(entry, 'title'))}">
      <div class="deck-pile">
        ${entry.media.map((m, i) => `
        <div class="media-block deck-card" data-mi="${i}">
          <div class="media-item">
            <span class="media-label">${esc(typeLabel(m.type))} ${String(i + 1).padStart(2, '0')}</span>
            ${m.type === 'video'
              ? `<video src="${esc(m.src)}" controls preload="none" playsinline></video>`
              : `<img src="${esc(m.src)}" alt="${esc(loc(entry, 'title'))} ${i + 1}" loading="lazy" decoding="async">`}
            ${canEdit ? `<button class="media-del" data-index="${i}" title="${esc(t('del'))}">${esc(t('del'))} ✕</button>` : ''}
          </div>
        </div>`).join('')}
      </div>
      <div class="deck-foot">
        <span class="deck-count" data-count></span>
        <span class="deck-hint">${esc(t('deck_hint'))}</span>
      </div>
      ${(anyCap || canEdit) ? `
      <div class="media-cap deck-cap" data-cap="${order[0]}">
        <span class="cap-label">${esc(t('caption_label'))}</span>
        <div class="cap-text" data-captext></div>
        <span class="cap-status" data-capstatus></span>
      </div>` : ''}
    </div>`;

    const deck = wrap.querySelector('.deck');
    const cards = [...wrap.querySelectorAll('.deck-card')];
    const capWrap = wrap.querySelector('.deck-cap');
    const capText = wrap.querySelector('[data-captext]');

    function applyDepth() {
      cards.forEach((el, mi) => {
        const d = order.indexOf(mi);
        el.style.setProperty('--d0', d);
        el.style.zIndex = String(50 - d);
        el.classList.toggle('deck-top', d === 0);
        el.classList.toggle('deck-gone', d > 3);
      });
      const top = order[0];
      wrap.querySelector('[data-count]').textContent =
        `${String(top + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`;
      if (capWrap) {
        capWrap.dataset.cap = top;
        const cap = loc(entry.media[top], 'caption');
        capText.textContent = cap || t('caption_empty');
        capText.classList.toggle('is-empty', !cap);
        capWrap.classList.remove('cap-fade');
        void capWrap.offsetWidth;           /* restart the caption fade */
        capWrap.classList.add('cap-fade');
      }
    }

    /* top print flies off, the rest glide one notch forward, the
       departed print snaps invisibly to the back of the pile */
    function cycle() {
      if (busy) return;
      busy = true;
      const topEl = cards[order[0]];
      topEl.classList.add('deck-exit');
      setTimeout(() => {
        order.push(order.shift());
        topEl.classList.add('deck-settle');   /* no transition while it teleports */
        topEl.classList.remove('deck-exit');
        applyDepth();
        requestAnimationFrame(() =>
          requestAnimationFrame(() => topEl.classList.remove('deck-settle')));
        setTimeout(() => { busy = false; }, RM ? 0 : 420);
      }, RM ? 0 : 230);
    }

    deck.addEventListener('click', (e) => {
      if (e.target.closest('.media-del, video, .deck-cap')) return;
      cycle();
    });
    deck.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cycle(); }
    });

    /* owner: delete straight from the pile (top print only, via CSS) */
    deck.querySelectorAll('.media-del').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm(t('confirm_del'))) return;
        const index = parseInt(btn.dataset.index, 10);
        const api = await apiAvailable();
        if (api) {
          await fetch(`api/media?id=${encodeURIComponent(entry.id)}&index=${index}`, { method: 'DELETE' });
        }
        entry.media.splice(index, 1);
        entry.src = entry.media.length ? entry.media[0].src : '';
        if (!api) {
          const list = await loadContent();
          const mine = list.find((it) => it.id === entry.id);
          if (mine) { mine.media = entry.media; mine.src = entry.src; saveOverride(list); }
        }
        renderMedia();
      });
    });

    /* caption editing — the strip always edits the TOP print */
    if (canEdit && capText) {
      bindInlineText(capText, () => {
        const idx = parseInt(capWrap.dataset.cap, 10);
        return loc(entry.media[idx], 'caption') || '';
      }, async (v) => {
        const idx = parseInt(capWrap.dataset.cap, 10);
        const field = window.I18N.isZh ? 'captionZh' : 'caption';
        const r = await fetch(
          `api/media?id=${encodeURIComponent(entry.id)}&index=${idx}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [field]: v }),
          });
        if (!r.ok) throw new Error('fail');
        entry.media[idx][field] = v;
        capText.classList.toggle('is-empty', !v);
        return v || t('caption_empty');
      }, true, true);
    }

    /* the maps drive the pile: lift a named print straight to the top,
       or lift a whole PLACE — every print shot there rises to the top
       layers together (seq order = viewing order), staying on top
       while the pin pages through them */
    i1DeckCtl = {
      toTop(mi) {
        const at = order.indexOf(mi);
        if (at > 0) {
          order.splice(at, 1);
          order.unshift(mi);
        }
        applyDepth();
      },
      liftGroup(seq) {
        const wanted = seq.filter((mi) => order.includes(mi));
        const rest = order.filter((mi) => !wanted.includes(mi));
        order.splice(0, order.length, ...wanted, ...rest);
        applyDepth();
      },
      scroll() {
        deck.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'center' });
      },
    };

    applyDepth();
    observeReveals(wrap);
  }

  /* ================= travel maps (entry i1) =================
     Two digitized line maps drawn in one dialect:
     · TOKYO — the Yamanote loop, Sumida river, the bay; photo pins
       rise by themselves from the media captions (place-name match)
     · JEJU — Hallasan's shield, the coastal ring road, empty until
       the owner names places on it
     No lines between landmarks. The owner clicks anywhere on a map
     to name a spot (saved into entry.mapPins via the API); visitors
     just read the pins. */

  /* where the already-captioned photographs were taken — positions
     follow real Tokyo geography on the 560×400 grid; each spot carries
     its own landmark sigil, drawn in the same line dialect */
  const TOKYO_SPOTS = [
    { key: '东京塔',   en: 'TOKYO TOWER',             x: 266, y: 262, icon: 'tower' },
    { key: '东京大学', en: 'THE UNIVERSITY OF TOKYO', x: 306, y: 106, icon: 'campus' },
    { key: '你的名字', en: 'SUGA SHRINE · YOUR NAME', x: 206, y: 212, icon: 'torii' },
    { key: '新宿',     en: 'SHINJUKU',                x: 112, y: 178, icon: 'towers' },
    { key: '涩谷',     en: 'SHIBUYA CROSSING',        x: 138, y: 300, icon: 'crossing' },
  ];

  /* landmark sigils on a 24×24 grid centred on 0,0 — stroke only */
  const SPOT_ICONS = {
    /* Tokyo Tower: antenna, tapering lattice legs, cross braces */
    tower: '<path d="M0 -11 V-8 M-1.6 -8 L-6.5 11 M1.6 -8 L6.5 11 M-3.2 -4.5 H3.2 M-4.3 0.5 H4.3 M-5.4 5.5 H5.4"/>',
    /* Yasuda-auditorium style: pediment, colonnade, stylobate */
    campus: '<path d="M-9 -4 L0 -10 L9 -4 M-7.5 -4 H7.5 M-5.5 -4 V8.5 M-1.8 -4 V8.5 M1.8 -4 V8.5 M5.5 -4 V8.5 M-9 8.5 H9 M0 -10 V-7.5"/>',
    /* torii: curved kasagi, straight nuki, two pillars */
    torii: '<path d="M-9 -6.5 Q0 -9.5 9 -6.5 M-7.5 -2.5 H7.5 M-5.2 -6.8 V10 M5.2 -6.8 V10 M-6.8 10 H-3.6 M3.6 10 H6.8"/>',
    /* Shinjuku: a small skyline of three towers with lit windows */
    towers: '<path d="M-9.5 11 V-4 H-3.5 V11 M-1.5 11 V-10 H4.5 V11 M6.5 11 V-1 H10.5 V11 M-7.5 -1 h1.2 M-7.5 3 h1.2 M0.5 -7 h1.2 M0.5 -3 h1.2 M0.5 1 h1.2 M7.5 3 h1.2"/>',
    /* Shibuya: the scramble — a boxed X crossing with a centre dot */
    crossing: '<path d="M-8 -8 H8 V8 H-8 Z M-8 -8 L8 8 M8 -8 L-8 8 M0 -1.4 V1.4 M-1.4 0 H1.4"/>',
    /* a peak with a snow cap — mountains, volcano craters */
    mountain: '<path d="M-10 10 L-3 -7 L1 1 L5 -6 L11 10 Z M-5 -3.5 L-3 -7 L-1 -3.5 M3.5 -2.5 L5 -6 L6.5 -2.5"/>',
    /* three rolling waves — seasides, straits, beaches */
    wave: '<path d="M-10 -4 Q-6.5 -8 -3 -4 Q0.5 0 4 -4 Q7.5 -8 11 -4 M-10 2 Q-6.5 -2 -3 2 Q0.5 6 4 2 Q7.5 -2 11 2 M-10 8 Q-6.5 4 -3 8 Q0.5 12 4 8 Q7.5 4 11 8"/>',
    /* a five-petal sakura blossom */
    sakura: '<path d="M0 -9 C2.5 -5 2.5 -2 0 -0.5 C-2.5 -2 -2.5 -5 0 -9 Z M8.6 -2.8 C4.9 -1.6 2.4 -0.4 0.6 0.4 C0.9 2.8 3.2 4.4 7.6 5.4 C8.3 1.6 8.5 -0.7 8.6 -2.8 Z M5.3 7.6 C2.2 4.8 0.7 2.7 0.2 0.8 C-1.9 2.1 -2.8 4.8 -4.1 8.9 C-0.7 9.2 3.1 8.7 5.3 7.6 Z M-5.3 7.6 C-7.1 4.2 -6.9 1.1 -6.1 -1.1 C-2.9 -0.4 -0.6 0.4 0.6 1.1 C-0.3 3.7 -2.3 5.8 -5.3 7.6 Z M-8.6 -2.8 C-5.4 -3.6 -2.8 -2.9 -1 -1.9 C-3.3 -0.1 -6.1 0.9 -9.9 1 C-9.7 -0.6 -9.2 -1.8 -8.6 -2.8 Z"/>',
    /* a little castle keep — shrines, castles, old towns */
    castle: '<path d="M-9 10 V1 H9 V10 M-9 1 L0 -6 L9 1 M-7 -1 V-5 M7 -1 V-5 M-7 -5 H-4 M4 -5 H7 M-2.5 10 V5 A2.5 2.5 0 0 1 2.5 5 V10"/>',
    /* a paper lantern — night markets, festivals */
    lantern: '<path d="M-3 -11 H3 M0 -11 V-8 M-6 -8 Q-8 0 -6 8 H6 Q8 0 6 -8 Z M-6 -3 H6 M-6 3 H6 M-2.5 -8 Q-4 0 -2.5 8 M2.5 -8 Q4 0 2.5 8 M-2 11 H2 M0 8 V11"/>',
    /* generic map pin for owner-marked places */
    pin: '<path d="M0 -10 A6.5 6.5 0 0 1 6.5 -3.5 C6.5 2 0 11 0 11 C0 11 -6.5 2 -6.5 -3.5 A6.5 6.5 0 0 1 0 -10 Z M0 -5.4 A1.9 1.9 0 1 0 0 -1.6 A1.9 1.9 0 1 0 0 -5.4 Z"/>',
  };

  /* the styles offered when the owner names a new spot */
  const PIN_ICON_CHOICES = [
    'pin', 'torii', 'tower', 'campus', 'towers', 'crossing',
    'mountain', 'wave', 'sakura', 'castle', 'lantern',
  ];

  /* faint survey grid — the digitized-map backbone */
  function graticule(w, h, step) {
    let g = '';
    for (let x = step; x < w; x += step) g += `<path d="M${x} 0 V${h}"/>`;
    for (let y = step; y < h; y += step) g += `<path d="M0 ${y} H${w}"/>`;
    return `<g class="tm-grat">${g}</g>`;
  }

  /* city fabric: little building-footprint blocks stamped in rows —
     a seeded skip pattern leaves alleys, organic yet render-stable (R14) */
  /* city fabric: seeded building footprints — stable between renders,
     but with variety now: taller/wider blocks, little annexes tucked
     into the alleys, and courtyard dots on some plots (R15) */
  function blocks(x0, y0, cols, rows, w, h, gap) {
    let g = '';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if ((r * 7 + c * 13 + Math.round(x0)) % 5 === 0) continue;   /* the alley */
        const x = x0 + c * (w + gap), y = y0 + r * (h + gap);
        const v = (r * 11 + c * 17 + Math.round(x0)) % 7;
        if (v === 1) {
          g += `<rect x="${x}" y="${y - 2}" width="${w}" height="${h + 2}"/>`;          /* taller */
        } else if (v === 3) {
          g += `<rect x="${x - 1}" y="${y}" width="${w + 3}" height="${h}"/>`;          /* wider */
        } else if (v === 5) {
          g += `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`;
          g += `<rect x="${x + w - 3}" y="${y + h + 1}" width="3" height="2.4"/>`;      /* the annex */
        } else {
          g += `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`;
        }
        if ((r * 5 + c * 3 + Math.round(x0)) % 6 === 2) {
          g += `<circle class="tm-yard" cx="${x + w / 2}" cy="${y + h / 2}" r="0.9"/>`; /* courtyard */
        }
      }
    }
    return `<g class="tm-blocks">${g}</g>`;
  }

  /* one labelled pin: a badge with the landmark sigil hovering over
     the exact point on a hairline stem, labels beside the badge.
     Near the top edge the badge hangs below the point instead. */
  function pinMarkup(p, cls, extra, icon, xMark, count) {
    const flip = p.y < 58;
    const by = flip ? p.y + 28 : p.y - 28;
    const leftSide = p.x > 420;
    const lx = leftSide ? p.x - 16 : p.x + 16;
    const anchor = leftSide ? 'end' : 'start';
    return `
      <g class="${cls}" ${extra || ''}>
        <circle class="halo" cx="${p.x}" cy="${p.y}" r="9"/>
        <path class="tm-stem" d="M${p.x} ${flip ? p.y + 4 : p.y - 4} V${flip ? by - 12 : by + 12}"/>
        <circle class="tm-badge" cx="${p.x}" cy="${by}" r="12"/>
        <g class="tm-icon" transform="translate(${p.x} ${by}) scale(0.85)">${icon || SPOT_ICONS.pin}</g>
        <circle class="core" cx="${p.x}" cy="${p.y}" r="3"/>
        ${count > 1 ? `<circle class="tm-count-bg" cx="${p.x + 11}" cy="${flip ? by + 11 : by - 11}" r="6.5"/>
        <text class="tm-count" x="${p.x + 11}" y="${(flip ? by + 11 : by - 11) + 2.6}" text-anchor="middle">${count}</text>` : ''}
        <text class="tm-zh" x="${lx}" y="${by}" text-anchor="${anchor}">${esc(p.zh)}</text>
        ${p.en ? `<text class="tm-en" x="${lx}" y="${by + 12}" text-anchor="${anchor}">${esc(p.en)}</text>` : ''}
        ${xMark ? `<text class="tm-upin-x" x="${p.x}" y="${flip ? by + 27 : by - 19}" text-anchor="middle">✕</text>` : ''}
      </g>`;
  }

  /* an owner-placed pin: every photo whose caption mentions the pin's
     name (zh or en, ≥2 chars) belongs to it — the pin pages through
     the whole set, one print per click. The owner also gets a small ✕
     beside it for removal — the pin itself never deletes */
  function upinLinks(p) {
    const names = [p.zh, p.en]
      .map((s) => String(s || '').trim().toLowerCase())
      .filter((s) => s.length >= 2);
    if (!names.length) return [];
    const mis = [];
    entry.media.forEach((m, mi) => {
      const cz = String(m.captionZh || '').toLowerCase();
      const ce = String(m.caption || '').toLowerCase();
      if (names.some((n) => cz.includes(n) || ce.includes(n))) mis.push(mi);
    });
    return mis;
  }

  function upinMarkup(p, i) {
    const mis = upinLinks(p);
    const cls = 'tm-upin' + (mis.length ? ' tm-linked' : '');
    const extra = `data-upin="${i}"` + (mis.length
      ? ` data-mis="${mis.join(',')}" tabindex="0" role="button" aria-label="${esc(p.zh)}"` : '');
    return pinMarkup(p, cls, extra, SPOT_ICONS[p.icon] || SPOT_ICONS.pin, canEdit, mis.length);
  }

  /* cartographer's furniture: a north rose and a scale bar,
     same instruments on every map */
  function mapFurniture(h, scale) {
    return `
      <g class="tm-north" transform="translate(30 32)">
        <circle r="11"/>
        <path d="M0 -6.5 L3.8 5.5 L0 2.6 L-3.8 5.5 Z"/>
        <text y="-15" text-anchor="middle">N</text>
      </g>
      <g class="tm-scale" transform="translate(30 ${h - 16})">
        <path d="M0 0 H56 M0 -3.5 V3.5 M28 -2.5 V2.5 M56 -3.5 V3.5"/>
        <text x="28" y="-7" text-anchor="middle">${esc(scale)}</text>
      </g>`;
  }

  /* ---------- TOKYO — drawn after real city maps ---------- */
  function tokyoSvg(stops, pins) {
    const geo = [
      /* survey grid + main avenues */
      graticule(560, 400, 56),
      `<g class="tm-ave">
         <path d="M0 140 H468"/><path d="M0 250 H472"/><path d="M0 322 H484"/>
         <path d="M58 0 V392"/><path d="M198 0 V392"/><path d="M312 0 V400"/>
         <path d="M0 366 C140 306 268 238 428 52"/>
         <path d="M0 58 C122 118 246 182 466 334"/>
       </g>`,
      /* Tokyo Bay — open water to the southeast, with a depth contour */
      `<path class="tm-water" d="M560 56 C518 88 492 122 480 172 C468 222 464 262 472 302 C482 348 522 376 560 390 Z"/>
       <path class="tm-depth" d="M560 96 C528 122 508 152 500 194 C492 236 490 272 498 306 C508 344 534 366 560 376"/>
       <g class="tm-waves">
         <path d="M508 210 q7 -6 14 0 q7 6 14 0"/>
         <path d="M496 268 q7 -6 14 0 q7 6 14 0"/>
         <path d="M518 326 q7 -6 14 0 q7 6 14 0"/>
       </g>`,
      /* the Sumida, winding down to the bay */
      `<path class="tm-river" d="M406 -6 C412 56 402 118 420 172 C432 214 450 246 468 268 L460 276 C442 252 424 220 412 176 C396 122 404 56 398 -6 Z"/>`,
      /* city fabric: Shinjuku, Shibuya, Ginza, Asakusa — footprints & lanes */
      blocks(74, 140, 4, 3, 8, 6, 4),
      blocks(96, 318, 5, 3, 8, 6, 4),
      blocks(318, 224, 4, 3, 9, 6, 4),
      blocks(388, 26, 4, 2, 9, 7, 4),
      `<g class="tm-lane">
         <path d="M60 206 H296 M64 226 H236 M236 120 V300 M160 62 V162 M362 100 V240 M300 280 H420"/>
       </g>`,
      /* green: Imperial Palace grounds, Ueno, Shinjuku Gyoen — with tree dots */
      `<g class="tm-park">
         <ellipse cx="274" cy="196" rx="31" ry="21"/>
         <rect x="318" y="94" width="42" height="26"/>
         <rect x="140" y="222" width="46" height="26"/>
       </g>
       <g class="tm-treedot">
         <circle cx="264" cy="190" r="1.1"/><circle cx="278" cy="200" r="1.1"/><circle cx="286" cy="190" r="1.1"/><circle cx="268" cy="204" r="1.1"/>
         <circle cx="328" cy="102" r="1.1"/><circle cx="342" cy="110" r="1.1"/><circle cx="350" cy="100" r="1.1"/>
         <circle cx="150" cy="230" r="1.1"/><circle cx="164" cy="238" r="1.1"/><circle cx="176" cy="230" r="1.1"/>
       </g>`,
      /* Chuo line — the straight east-west cut */
      `<path class="tm-rail" d="M112 178 C186 188 282 192 354 196"/>`,
      /* the Yamanote loop and its stations */
      `<path class="tm-loop" d="M112 178 C104 98 190 56 252 62 C322 68 358 120 356 196 C354 274 340 338 288 334 C236 330 158 332 132 286 C112 250 114 214 112 178 Z"/>
       <g class="tm-station">
         <circle cx="152" cy="66" r="3"/><circle cx="326" cy="84" r="3"/>
         <circle cx="354" cy="196" r="3"/><circle cx="292" cy="332" r="3"/>
         <circle cx="138" cy="300" r="3"/><circle cx="112" cy="178" r="3"/>
       </g>`,
      /* district names, set like a printed map */
      `<g class="tm-geo">
         <text x="152" y="54" text-anchor="middle">IKEBUKURO</text>
         <text x="326" y="72" text-anchor="middle">UENO</text>
         <text x="404" y="40" text-anchor="middle">ASAKUSA</text>
         <text x="354" y="184" text-anchor="middle">TOKYO STA.</text>
         <text x="330" y="238" text-anchor="middle">GINZA</text>
         <text x="292" y="350" text-anchor="middle">SHINAGAWA</text>
         <text x="274" y="226" text-anchor="middle">IMPERIAL PALACE</text>
         <text x="512" y="150" text-anchor="middle" class="tm-sea">TOKYO BAY</text>
         <text x="428" y="120" class="tm-sea" transform="rotate(76 428 120)">SUMIDA RIVER</text>
       </g>`,
    ].join('');

    return mapPanel('tokyo', t('tm_tokyo'), stops.length ? t('tm_hint_jump') : '', `
      <svg viewBox="0 0 560 400" role="img" aria-label="${esc(t('tm_tokyo'))}" data-map="tokyo">
        ${geo}
        ${mapFurniture(400, '5 KM')}
        ${stops.map((st) => pinMarkup(
          { x: st.spot.x, y: st.spot.y, zh: st.zh, en: st.spot.en },
          'tm-node',
          `data-mis="${st.mis.join(',')}" tabindex="0" role="button" aria-label="${esc(st.zh)}"`,
          SPOT_ICONS[st.spot.icon], false, st.mis.length
        )).join('')}
        ${pins.map((p, i) => upinMarkup(p, i)).join('')}
      </svg>`);
  }

  /* ---------- JEJU — Hallasan's shield, the ring road ---------- */
  function jejuSvg(pins) {
    const geo = [
      graticule(560, 380, 56),
      /* the island — one calm volcanic shield */
      `<path class="tm-island" d="M108 168 C116 106 210 76 302 78 C394 80 464 118 472 178 C480 238 442 300 352 318 C262 336 152 320 118 260 C100 226 100 198 108 168 Z"/>`,
      /* Udo, the little islet off the east cape */
      `<ellipse class="tm-island" cx="510" cy="112" rx="17" ry="10"/>`,
      /* route 1132 — the coastal ring road */
      `<path class="tm-ring" d="M130 172 C136 122 216 96 300 98 C384 100 446 132 452 182 C458 232 424 282 348 298 C272 314 172 300 140 252 C124 224 122 196 130 172 Z"/>`,
      /* Hallasan at the heart (with summit contours), Seongsan's crater
         on the east cape, Sanbangsan alone in the southwest */
      `<g class="tm-peak">
         <path d="M270 208 L282 184 L294 208 Z"/>
         <path d="M278 194 L282 188 L286 194"/>
         <path d="M446 162 L454 146 L462 162 Z"/>
         <path d="M124 292 L132 276 L140 292 Z"/>
       </g>
       <g class="tm-contour">
         <ellipse cx="282" cy="203" rx="24" ry="12"/>
         <ellipse cx="282" cy="200" rx="15" ry="7"/>
       </g>
       <g class="tm-treedot">
         <circle cx="230" cy="170" r="1.1"/><circle cx="330" cy="150" r="1.1"/><circle cx="380" cy="220" r="1.1"/>
         <circle cx="240" cy="260" r="1.1"/><circle cx="330" cy="270" r="1.1"/><circle cx="180" cy="220" r="1.1"/>
       </g>`,
      /* the two cities */
      `<g class="tm-station">
         <circle cx="274" cy="112" r="3"/><circle cx="282" cy="292" r="3"/>
       </g>`,
      /* city fabric: Jeju-si & Seogwipo footprints, lanes off the ring */
      blocks(246, 96, 4, 2, 9, 6, 4),
      blocks(254, 286, 4, 2, 9, 6, 4),
      `<g class="tm-lane">
         <path d="M274 118 V160 M282 286 V252 M200 130 V162 M380 142 V172 M140 250 L180 270"/>
       </g>`,
      `<g class="tm-geo">
         <text x="282" y="230" text-anchor="middle">HALLASAN · 1,947M</text>
         <text x="454" y="136" text-anchor="middle">SEONGSAN</text>
         <text x="132" y="266" text-anchor="middle">SANBANGSAN</text>
         <text x="510" y="92" text-anchor="middle">UDO</text>
         <text x="274" y="100" text-anchor="middle">JEJU-SI</text>
         <text x="282" y="312" text-anchor="middle">SEOGWIPO-SI</text>
         <text x="120" y="42" class="tm-sea">JEJU STRAIT</text>
         <text x="470" y="356" text-anchor="end" class="tm-sea">EAST CHINA SEA</text>
       </g>`,
      `<g class="tm-waves">
         <path d="M52 96 q7 -6 14 0 q7 6 14 0"/>
         <path d="M66 330 q7 -6 14 0 q7 6 14 0"/>
         <path d="M480 300 q7 -6 14 0 q7 6 14 0"/>
       </g>`,
    ].join('');

    return mapPanel('jeju', t('tm_jeju'), '', `
      <svg viewBox="0 0 560 380" role="img" aria-label="${esc(t('tm_jeju'))}" data-map="jeju">
        ${geo}
        ${mapFurniture(380, '10 KM')}
        ${pins.map((p, i) => upinMarkup(p, i)).join('')}
      </svg>`);
  }

  function mapPanel(mapId, title, hint, svg) {
    const ownerHint = canEdit ? t('tm_hint_add') : hint;
    return `
      <div class="travel-map" data-panel="${mapId}">
        <div class="tm-head">
          <span>${esc(title)}</span>
          <span class="tm-hint">${esc(ownerHint)}</span>
        </div>
        ${svg}
      </div>`;
  }

  /* the line-drawn street elevation that opens the travel board —
     same stroke dialect as the planet and the compass. R14 widened
     the lane: the dwellings are now joined by signature landmarks —
     Tokyo Tower, a five-storey pagoda and a torii gate */
  function housesStrip() {
    return `
    <div class="i1-houses" aria-hidden="true">
      <svg viewBox="0 0 760 132" fill="none">
        <text class="hs-word" x="740" y="16" text-anchor="end">DWELLINGS · 住まい</text>
        <text class="hs-word hs-alt" x="20" y="16">FIELD RECORD — 01</text>
        <!-- ground -->
        <path class="hs-ground" d="M20 104 H740"/>
        <path class="hs-dash" d="M20 112 H740"/>

        <!-- house A: machiya townhouse — tiled gable, noren, round window -->
        <g class="hs-ink">
          <path d="M38 58 L78 30 L118 58"/>
          <path d="M44 104 V58 H112 V104"/>
          <path d="M78 30 V27"/>
        </g>
        <g class="hs-thin">
          <path d="M47 52 L78 33 L109 52"/>
          <path d="M56 104 V82 H74 V104 M56 82 H74 M65 82 V104"/>
          <path d="M86 66 H100 M88 66 V74 M94 66 V74 M98 66 V74"/>
          <circle cx="99" cy="47" r="4.5"/>
          <path d="M99 42.5 V51.5 M94.5 47 H103.5"/>
          <path d="M44 100 H112"/>
        </g>

        <!-- house B: apartment block — parapet, framed windows, entrance canopy -->
        <g class="hs-ink">
          <path d="M138 104 V36 H192 V104"/>
          <path d="M136 36 H194"/>
        </g>
        <g class="hs-thin">
          <path d="M141 32 H189"/>
          <path d="M138 58 H192 M138 80 H192"/>
          <rect x="146" y="43" width="9" height="10"/>
          <rect x="161" y="43" width="9" height="10"/>
          <rect x="176" y="43" width="9" height="10"/>
          <rect x="146" y="65" width="9" height="10"/>
          <rect x="176" y="65" width="9" height="10"/>
          <path d="M161 104 V88 H173 V104 M158 86 H176"/>
        </g>
        <path class="hs-dash" d="M138 26 H192 M138 22 v6 M192 22 v6"/>

        <!-- house C: the long gable — chimney with smoke, accent window, fence -->
        <g class="hs-ink">
          <path d="M210 62 L256 34 L302 62"/>
          <path d="M216 104 V62 H296 V104"/>
          <path d="M283 44 V26 H293 V50"/>
        </g>
        <g class="hs-thin">
          <path d="M218 57 L256 37 L294 57"/>
          <path d="M262 104 V82 H280 V104 M262 82 H280 M271 82 V104"/>
          <rect x="238" y="70" width="15" height="15"/>
          <path d="M238 77.5 H253 M245.5 70 V85"/>
          <path d="M220 104 V94 M230 104 V94 M240 104 V94 M218 96 H242"/>
        </g>
        <rect x="241" y="73" width="9" height="9" class="hs-accent"/>
        <path class="hs-dash" d="M288 20 V12"/>

        <!-- the tall one: gridded apartments with rooftop antenna -->
        <g class="hs-ink">
          <path d="M332 104 V28 H390 V104"/>
          <path d="M330 28 H392"/>
        </g>
        <g class="hs-thin">
          <rect x="340" y="36" width="9" height="9"/>
          <rect x="357" y="36" width="9" height="9"/>
          <rect x="374" y="36" width="9" height="9"/>
          <rect x="340" y="52" width="9" height="9"/>
          <rect x="357" y="52" width="9" height="9"/>
          <rect x="374" y="52" width="9" height="9"/>
          <rect x="340" y="68" width="9" height="9"/>
          <rect x="357" y="68" width="9" height="9"/>
          <rect x="374" y="68" width="9" height="9"/>
          <path d="M356 104 V92 H366 V104 M352 90 H370"/>
        </g>
        <path class="hs-accent-line" d="M361 28 V14 M355 14 H367"/>
        <path class="hs-dash" d="M330 118 H392"/>

        <!-- tree between them -->
        <g class="hs-ink">
          <path d="M312 104 V88 M312 93 L306 85 M312 91 L318 83"/>
          <circle cx="312" cy="76" r="10"/>
        </g>
        <g class="hs-thin">
          <path d="M305 74 a7 7 0 0 1 6 -3 M312 81 a6 6 0 0 0 6 -4"/>
        </g>

        <!-- small gable on the right -->
        <g class="hs-ink">
          <path d="M420 68 L452 46 L484 68"/>
          <path d="M426 104 V68 H478 V104"/>
        </g>
        <g class="hs-thin">
          <path d="M444 104 V86 H460 V104 M444 86 H460"/>
          <rect x="466" y="76" width="8" height="8"/>
        </g>

        <!-- TOKYO TOWER — four splayed lattice legs, cross-braces,
             main observatory deck, top observatory, antenna spire -->
        <g class="hs-ink">
          <path d="M504 104 L522 52 M556 104 L538 52"/>
          <path d="M514 104 L527 52 M546 104 L533 52"/>
          <path d="M522 52 L525 40 M538 52 L535 40"/>
          <path d="M527 33 L529 20 M533 33 L531 20"/>
        </g>
        <g class="hs-thin">
          <path d="M508 90 L548 68 M552 90 L512 68"/>
          <path d="M510 79 H550"/>
          <path d="M516 63 L544 52 M544 63 L516 52"/>
          <path d="M502 104 H510 M550 104 H558"/>
          <path d="M520 39 v4 M530 39 v4 M540 39 v4"/>
        </g>
        <g class="hs-ink">
          <path d="M514 32 H546 V40 H514 Z"/>
          <path d="M526 14 H534 V20 H526 Z"/>
          <path d="M530 14 V4"/>
        </g>
        <circle cx="530" cy="4" r="1.3" class="hs-accent"/>
        <path class="hs-accent-line" d="M530 22 V30"/>

        <!-- five-storey pagoda: curved eaves, balcony rails, sorin spire -->
        <g class="hs-ink">
          <path d="M578 94 Q604 88 630 94 M583 82 Q604 77 625 82 M587 70 Q604 66 621 70 M591 58 Q604 55 617 58 M595 46 Q604 43 613 46"/>
          <path d="M604 104 V42"/>
          <path d="M592 104 V97 M616 104 V97 M586 104 H622"/>
        </g>
        <g class="hs-thin">
          <path d="M578 94 l-2 -3 M630 94 l2 -3 M583 82 l-2 -3 M625 82 l2 -3 M587 70 l-2 -3 M621 70 l2 -3 M591 58 l-2 -3 M617 58 l2 -3 M595 46 l-2 -3 M613 46 l2 -3"/>
          <path d="M584 89 H624 M588 77 H620 M592 65 H616 M596 53 H612"/>
          <path d="M604 42 V22 M599 36 H609 M600 31 H608 M601 26 H607"/>
        </g>
        <circle cx="604" cy="21" r="1.3" class="hs-accent"/>

        <!-- torii gate: swept kasagi, tie beam, centre plaque -->
        <g class="hs-ink">
          <path d="M646 60 Q676 50 706 60"/>
          <path d="M663 64 L662 104 M689 64 L690 104"/>
          <path d="M658 104 H668 M684 104 H694"/>
        </g>
        <g class="hs-thin">
          <path d="M650 65 Q676 56 702 65"/>
          <path d="M646 60 l-2 -4 M706 60 l2 -4"/>
          <path d="M656 74 H696 M656 74 l-3 2 M696 74 l3 2"/>
        </g>
        <rect x="672" y="65" width="8" height="7" class="hs-accent"/>

        <path class="hs-accent-line" d="M716 86 v10 M711 91 h10"/>
        <!-- construction verticals -->
        <path class="hs-dash" d="M78 30 V8 M256 34 V8 M452 46 V8 M604 22 V8 M676 50 V8"/>
        <g class="hs-ink hs-ticks">
          <path d="M74 8 h8 M252 8 h8 M448 8 h8 M600 8 h8 M672 8 h8"/>
        </g>
      </svg>
    </div>`;
  }

  function renderMaps() {
    if (entry.id !== 'i1' || !entry.media || !entry.media.length) return;
    const old = document.querySelector('.travel-maps');
    if (old) old.remove();

    /* photo pins: gather EVERY media item whose caption names a known
       spot — several prints can share one place, the pin pages through
       them one by one */
    const stops = [];
    entry.media.forEach((m, mi) => {
      const cap = String(m.captionZh || m.caption || '');
      if (!cap) return;
      const spot = TOKYO_SPOTS.find((s) => cap.includes(s.key));
      if (!spot) return;
      const st = stops.find((x) => x.spot === spot);
      if (st) st.mis.push(mi);
      else stops.push({ spot, mis: [mi], zh: cap.trim() });
    });

    const allPins = (entry.mapPins && typeof entry.mapPins === 'object') ? entry.mapPins : {};
    const tokyoPins = Array.isArray(allPins.tokyo) ? allPins.tokyo : [];
    const jejuPins = Array.isArray(allPins.jeju) ? allPins.jeju : [];

    const box = document.createElement('div');
    box.className = 'travel-maps';
    box.innerHTML = housesStrip() + tokyoSvg(stops, tokyoPins) + jejuSvg(jejuPins);

    const media = $('entryMedia');
    media.parentNode.insertBefore(box, media);

    box.querySelectorAll('.tm-node' + (canEdit ? '' : ', .tm-upin.tm-linked')).forEach((node) => {
      const mis = String(node.dataset.mis || '').split(',').map(Number).filter((x) => !Number.isNaN(x));
      let cursor = -1;
      const jump = () => {
        if (!mis.length) return;
        cursor = (cursor + 1) % mis.length;
        /* the whole place rises to the top layers (all of its prints),
           rotated so the next unviewed one is on top */
        const seq = mis.slice(cursor).concat(mis.slice(0, cursor));
        if (i1DeckCtl) {
          i1DeckCtl.liftGroup(seq);
          i1DeckCtl.scroll();
          return;
        }
        const block = document.querySelectorAll('#entryMedia .media-block')[seq[0]];
        if (block) block.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'center' });
      };
      node.addEventListener('click', (e) => {
        if (e.target.closest('.tm-upin-x')) return;
        jump();
      });
      node.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); jump(); }
      });
    });

    if (!canEdit) return;   /* visitors read the maps, never alter them */

    /* owner: clicking a self-made pin opens its edit card (rename,
       switch sigil, delete, or page its photos) */
    box.querySelectorAll('.tm-upin').forEach((node) => {
      node.addEventListener('click', (e) => {
        if (e.target.closest('.tm-upin-x')) return;
        e.stopPropagation();
        const svg = node.closest('svg');
        const mapId = svg.dataset.map;
        const idx = parseInt(node.dataset.upin, 10);
        const p = (entry.mapPins?.[mapId] || [])[idx];
        if (!p) return;
        openPinForm(box.querySelector(`.travel-map[data-panel="${mapId}"]`),
          mapId, p.x, p.y, svg.viewBox.baseVal, idx);
      });
    });

    /* owner: only the small ✕ beside a self-made pin removes it */
    box.querySelectorAll('.tm-upin-x').forEach((x) => {
      x.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm(t('tm_pin_del') + '?')) return;
        const node = x.closest('.tm-upin');
        const mapId = node.closest('svg').dataset.map;
        const arr = Array.isArray(entry.mapPins?.[mapId]) ? entry.mapPins[mapId] : [];
        arr.splice(parseInt(node.dataset.upin, 10), 1);
        entry.mapPins = { ...(entry.mapPins || {}), [mapId]: arr };
        try {
          await putContent({ mapPins: entry.mapPins });
          renderMaps();
        } catch (_) { /* keep the old map on failure */ }
      });
    });

    /* owner: click bare map → name that place */
    box.querySelectorAll('svg[data-map]').forEach((svg) => {
      svg.addEventListener('click', (e) => {
        if (e.target.closest('.tm-node, .tm-upin') || box.querySelector('.tm-pinform')) return;
        const mapId = svg.dataset.map;
        const vb = svg.viewBox.baseVal;
        const rect = svg.getBoundingClientRect();
        const x = Math.round((e.clientX - rect.left) / rect.width * vb.width);
        const y = Math.round((e.clientY - rect.top) / rect.height * vb.height);
        openPinForm(box.querySelector(`.travel-map[data-panel="${mapId}"]`), mapId, x, y, vb);
      });
    });
  }

  /* floating name-card for a pin, positioned where clicked.
     Add mode: blank fields, icon picker defaults to the plain pin.
     Edit mode (editIdx given): prefilled from the existing pin — the
     owner can rename it, switch its sigil, or delete it (R14). */
  function openPinForm(panel, mapId, x, y, vb, editIdx) {
    const editing = editIdx != null
      ? (entry.mapPins?.[mapId] || [])[editIdx] : null;
    const form = document.createElement('div');
    form.className = 'tm-pinform';
    form.style.left = (x / vb.width * 100) + '%';
    form.style.top = (y / vb.height * 100) + '%';
    let icon = (editing && SPOT_ICONS[editing.icon]) ? editing.icon : 'pin';
    form.innerHTML = `
      <input type="text" data-fzh maxlength="40" placeholder="${esc(t('tm_pin_zh_ph'))}"
        value="${editing ? esc(editing.zh || '') : ''}">
      <input type="text" data-fen maxlength="40" placeholder="${esc(t('tm_pin_en_ph'))}"
        value="${editing ? esc(editing.en || '') : ''}">
      <span class="tm-pinlabel">${esc(t('tm_pin_icon'))}</span>
      <div class="tm-iconpick">
        ${PIN_ICON_CHOICES.map((k) => `
          <button type="button" data-icon="${k}" class="${k === icon ? 'on' : ''}" title="${k}"
            ><svg viewBox="-14 -14 28 28"><g transform="scale(0.95)">${SPOT_ICONS[k]}</g></svg></button>`).join('')}
      </div>
      <div class="tm-pinrow">
        <button type="button" data-ok>${esc(editing ? t('tm_pin_save') : t('tm_pin_add'))}</button>
        ${editing ? `<button type="button" data-del>${esc(t('tm_pin_del'))}</button>` : ''}
        ${editing && upinLinks(editing).length ? `<button type="button" data-view>${esc(t('tm_pin_view'))} ×${upinLinks(editing).length}</button>` : ''}
        <button type="button" data-no>${esc(t('tm_pin_cancel'))}</button>
      </div>
      <span class="tm-pinmsg"></span>`;
    panel.appendChild(form);
    const zh = form.querySelector('[data-fzh]');
    const en = form.querySelector('[data-fen]');
    const msg = form.querySelector('.tm-pinmsg');
    zh.focus();
    form.querySelectorAll('.tm-iconpick button').forEach((btn) => {
      btn.addEventListener('click', () => {
        icon = btn.dataset.icon;
        form.querySelectorAll('.tm-iconpick button').forEach((b) =>
          b.classList.toggle('on', b === btn));
      });
    });
    const close = () => form.remove();
    form.querySelector('[data-no]').addEventListener('click', close);
    const persist = async (arr) => {
      entry.mapPins = { ...(entry.mapPins || {}), [mapId]: arr };
      await putContent({ mapPins: entry.mapPins });
      close();
      renderMaps();
    };
    form.querySelector('[data-ok]').addEventListener('click', async () => {
      const name = zh.value.trim();
      if (!name && !en.value.trim()) { zh.focus(); return; }
      const arr = Array.isArray(entry.mapPins?.[mapId]) ? entry.mapPins[mapId].slice() : [];
      if (editing) arr[editIdx] = { x, y, zh: name, en: en.value.trim(), icon };
      else arr.push({ x, y, zh: name, en: en.value.trim(), icon });
      try { await persist(arr); } catch (_) { msg.textContent = t('tm_pin_fail'); }
    });
    const delBtn = form.querySelector('[data-del]');
    if (delBtn) delBtn.addEventListener('click', async () => {
      const arr = Array.isArray(entry.mapPins?.[mapId]) ? entry.mapPins[mapId].slice() : [];
      arr.splice(editIdx, 1);
      try { await persist(arr); } catch (_) { msg.textContent = t('tm_pin_fail'); }
    });
    const viewBtn = form.querySelector('[data-view]');
    if (viewBtn) viewBtn.addEventListener('click', () => {
      const mis = upinLinks(editing);
      close();
      if (mis.length && i1DeckCtl) {
        i1DeckCtl.liftGroup(mis);
        i1DeckCtl.scroll();
      }
    });
    form.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); form.querySelector('[data-ok]').click(); }
      if (e.key === 'Escape') { e.preventDefault(); close(); }
    });
  }

  /* ================= starfield (entry t2 — About Koyome) =================
     Geometric night sky behind the page: five-pointed stars, a few
     faint constellation threads, and a star-headed meteor sweeping
     by now and then.
     Performance model (R15): the quiet majority — far stars and
     threads — is baked into an offscreen canvas once per seed/theme,
     so each frame costs ONE drawImage blit plus a handful of sprite
     draws for the twinkling bright stars and any meteor. On phones
     the loop additionally FREEZES while the user is actively
     scrolling (the sky is calm, nobody can tell), which keeps the
     main thread and the texture uploader out of the compositor's
     way — that fight was the scroll jank. */
  function renderStarfield() {
    if (entry.id !== 't2') return;
    const cv = document.createElement('canvas');
    cv.className = 'starfield';
    cv.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cv);
    const ctx = cv.getContext('2d');
    const MOBILE = !!(window.matchMedia && (
      window.matchMedia('(max-width: 720px)').matches ||
      window.matchMedia('(pointer: coarse)').matches));
    const DPR = MOBILE ? 1 : Math.min(window.devicePixelRatio || 1, 2);

    let W = 0, H = 0, farStars = [], glowStars = [], threads = [], meteors = [];
    let band = null;   /* milky way: one soft diagonal river, per seed */
    let colStar = '#7d8798', colLine = 'rgba(110,118,132,0.32)', colMeteor = '#9e2b25';
    /* mood: day = sparse & whisper-quiet, night = dense & bright */
    let mood = { density: 22000, alpha: 0.72, meteorEvery: [6, 12], meteorAlpha: 0.8 };
    let frame = 0, visible = !document.hidden, nextMeteor = 4, last = performance.now();
    let scrolling = false, scrollTimer = null;
    let themeSig = '';
    let seededW = 0, seededH = 0;
    let rebakeTimer = null;

    const sky0 = document.createElement('canvas');   /* baked static layer */
    let sky = sky0;
    let sprites = null;                             /* five-star sprites by size */
    let meteorSprite = null;

    /* theme double-buffer: skies/sprites keyed by theme signature. A
       theme round-trip (dark -> light -> dark) swaps buffers INSTANTLY
       instead of rebaking a full-screen canvas mid-flip (that sync
       rebake, racing the page's own CSS var flip, was the toggle jank). */
    const skyCache = new Map();
    const SKY_CACHE_MAX = 40 * 1024 * 1024;   /* bytes — don't hoard 4K buffers */
    function stashBuffers(sig, bufs) {
      if (!sig || bufs.sky.width * bufs.sky.height * 4 > SKY_CACHE_MAX) return;
      skyCache.delete(sig);
      skyCache.set(sig, bufs);
      while (skyCache.size > 2) skyCache.delete(skyCache.keys().next().value);
    }

    /* one crisp five-pointed star path, point-up */
    function fiveStar(g, cx, cy, R) {
      const r = R * 0.46;
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const rad = i % 2 === 0 ? R : r;
        const a = -Math.PI / 2 + i * Math.PI / 5;
        const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.closePath();
    }

    /* a five-star prerendered once, then blitted per frame.
       The glow is painted with shadowBlur ALONG THE STAR PATH, so the
       light clings to the five points (rim glow) instead of bleeding
       out as a detached disc — the old radial-gradient halo read as a
       mouldy ring in daylight and as fog scatter at night. */
    function makeSprite(R, glowR, color) {
      const pad = Math.ceil(glowR * 2.4) + 2;
      const c = document.createElement('canvas');
      c.width = c.height = Math.ceil(pad * 2 * DPR);
      const g = c.getContext('2d');
      g.setTransform(DPR, 0, 0, DPR, 0, 0);
      g.fillStyle = color;
      /* two soft passes hug the shape's edges, then a crisp core on top */
      g.shadowColor = color;
      g.shadowBlur = glowR;
      fiveStar(g, pad, pad, R);
      g.fill();
      g.shadowBlur = glowR * 0.55;
      g.fill();
      g.shadowBlur = 0;
      g.fill();
      return c;
    }

    function buildSprites() {
      /* night carries a wider rim; daylight keeps just a soft edge so
         the stars stay clean against the paper */
      const dark = document.documentElement.dataset.theme === 'dark';
      const k = dark ? 1.9 : 1.05;
      sprites = {
        s: makeSprite(1.7, 2.2 * k, colStar),
        m: makeSprite(2.6, 3.2 * k, colStar),
        l: makeSprite(3.7, 4.6 * k, colStar),
      };
      meteorSprite = makeSprite(3.4, 4.8 * k, colMeteor);
    }

    function themeColors() {
      const cs = getComputedStyle(document.documentElement);
      colStar = (cs.getPropertyValue('--star') || colStar).trim();
      colLine = (cs.getPropertyValue('--star-line') || colLine).trim();
      colMeteor = (cs.getPropertyValue('--meteor') || colMeteor).trim();
      const dark = document.documentElement.dataset.theme === 'dark';
      mood = dark
        ? { density: 12500, alpha: 1, meteorEvery: [3.5, 8], meteorAlpha: 1 }
        : { density: 22000, alpha: 0.72, meteorEvery: [6, 12], meteorAlpha: 0.8 };
      const sig = colStar + '|' + colLine + '|' + colMeteor + '|' + dark + '|' + mood.density;
      if (sig === themeSig) return;
      const prevSig = themeSig;
      const prevBufs = { sky, sprites, meteorSprite };
      themeSig = sig;
      /* round-trip hit: adopt the cached buffers, zero rebake */
      const hit = skyCache.get(sig);
      if (hit) {
        skyCache.delete(sig);
        sky = hit.sky; sprites = hit.sprites; meteorSprite = hit.meteorSprite;
        stashBuffers(prevSig, prevBufs);
        return;
      }
      buildSprites();
      /* bake into a FRESH canvas — bakeSky() resets whatever `sky` points
         at, and repainting the live canvas here would corrupt the very
         buffer we are about to stash for the previous theme */
      sky = document.createElement('canvas');
      bakeSky();
      stashBuffers(prevSig, prevBufs);
    }

    function seed() {
      W = window.innerWidth;
      H = window.innerHeight;
      seededW = W; seededH = H;
      skyCache.clear();   /* geometry changed — cached skies no longer fit */
      cv.width = Math.round(W * DPR);
      cv.height = Math.round(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      /* the milky way: a real band is BOTH a soft glow and a thicker
         crowd of stars along the same line, so geometry comes first
         and the star seeding below leans on it. A gentle tilt through
         the upper sky reads as "overhead"; per-seed, re-rolled on
         resize like everything else. */
      const diag = Math.hypot(W, H);
      band = {
        ang: (24 + Math.random() * 10) * Math.PI / 180,
        cx: W * (0.40 + Math.random() * 0.20),
        cy: H * (0.28 + Math.random() * 0.20),
        w: diag * (0.15 + Math.random() * 0.07),
        len: diag * 1.5,
      };
      const n = Math.round((W * H) / mood.density);
      farStars = [];
      glowStars = [];
      for (let i = 0; i < n; i++) {
        const s = {
          ph: Math.random() * Math.PI * 2,
          sp: 0.25 + Math.random() * 1.1,
          /* per-star brightness seat & sway — no two stars breathe alike */
          base: 0.5 + Math.random() * 0.3,
          amp: 0.16 + Math.random() * 0.24,
        };
        /* ~45% of stars gather along the band (gaussian-ish offset
           across its axis — dense core, thinning shoulders); the rest
           keep the uniform sky honest */
        if (Math.random() < 0.45) {
          const t = (Math.random() - 0.5) * band.len;
          const off = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5 * band.w * 0.72;
          s.x = band.cx + Math.cos(band.ang) * t - Math.sin(band.ang) * off;
          s.y = band.cy + Math.sin(band.ang) * t + Math.cos(band.ang) * off;
          if (s.x < -20 || s.x > W + 20 || s.y < -20 || s.y > H + 20) {
            s.x = Math.random() * W; s.y = Math.random() * H;
          }
        } else {
          s.x = Math.random() * W;
          s.y = Math.random() * H;
        }
        if (Math.random() < 0.68) {
          /* quiet backdrop stars: mostly pin-pricks, a few chunkier;
             each keeps its own resting brightness baked into the sky */
          s.r = 0.8 + Math.pow(Math.random(), 1.8) * 1.6;
          s.a = 0.35 + Math.random() * 0.5;
          farStars.push(s);
        } else {
          const u = Math.random();                  /* the twinkling few */
          s.k = u < 0.55 ? 's' : (u < 0.88 ? 'm' : 'l');
          glowStars.push(s);
        }
      }
      /* constellation threads: link a few close neighbours */
      const all = farStars.concat(glowStars);
      threads = [];
      for (let i = 0; i < all.length && threads.length < 8; i += 7) {
        const a = all[i];
        let best = null, bd = 1e9;
        for (let j = i + 1; j < Math.min(i + 24, all.length); j++) {
          const b = all[j];
          const d = (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
          if (d < bd) { bd = d; best = b; }
        }
        if (best && bd < 240 * 240) threads.push([a, best]);
      }
      bakeSky();
    }

    /* the whole calm sky painted ONCE — afterwards a frame is one blit */
    function bakeSky() {
      if (!W || !H) return;
      sky.width = cv.width;
      sky.height = cv.height;
      const g = sky.getContext('2d');
      g.setTransform(DPR, 0, 0, DPR, 0, 0);
      /* a whisper of altitude: the top of the viewport sits a touch
         deeper so the star field melts into the page instead of
         floating on a flat sheet */
      const dark = document.documentElement.dataset.theme === 'dark';
      const wash = g.createLinearGradient(0, 0, 0, H * 0.62);
      wash.addColorStop(0, colStar);
      wash.addColorStop(1, 'transparent');
      g.globalAlpha = dark ? 0.055 : 0.02;
      g.fillStyle = wash;
      g.fillRect(0, 0, W, H * 0.62);
      /* the milky way veil, painted BEFORE the stars: three nested
         perpendicular gradients (wide shoulders → brighter inner arm
         drifting slightly off-axis) plus a few soft cloud clumps, so
         the light pools and thins like real star clouds instead of a
         ruled stripe. All static — baked here once, zero frame cost. */
      if (band) {
        const bandA = (dark ? 0.085 : 0.03) * mood.alpha;
        g.save();
        g.translate(band.cx, band.cy);
        g.rotate(band.ang);
        [
          { w: band.w * 2.6, a: 0.32, dy: 0 },
          { w: band.w * 1.5, a: 0.5, dy: 0 },
          { w: band.w * 0.8, a: 0.7, dy: -band.w * 0.14 },
        ].forEach((L) => {
          const grad = g.createLinearGradient(0, L.dy - L.w / 2, 0, L.dy + L.w / 2);
          grad.addColorStop(0, 'transparent');
          grad.addColorStop(0.5, colStar);
          grad.addColorStop(1, 'transparent');
          g.globalAlpha = bandA * L.a;
          g.fillStyle = grad;
          g.fillRect(-band.len / 2, L.dy - L.w / 2, band.len, L.w);
        });
        for (let i = 0; i < 7; i++) {
          const t = (Math.random() - 0.5) * band.len * 0.8;
          const off = (Math.random() - 0.5) * band.w * 0.4;
          const r = band.w * (0.25 + Math.random() * 0.45);
          const rg = g.createRadialGradient(t, off, 0, t, off, r);
          rg.addColorStop(0, colStar);
          rg.addColorStop(1, 'transparent');
          g.globalAlpha = bandA * (0.2 + Math.random() * 0.28);
          g.fillStyle = rg;
          g.fillRect(t - r, off - r, r * 2, r * 2);
        }
        g.restore();
      }
      g.strokeStyle = colLine;
      g.lineWidth = 0.6;
      g.globalAlpha = mood.alpha * 0.8;
      threads.forEach(([a, b]) => {
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      });
      /* backdrop stars keep their own resting brightness */
      g.fillStyle = colStar;
      farStars.forEach((s) => {
        g.globalAlpha = mood.alpha * s.a;
        fiveStar(g, s.x, s.y, s.r); g.fill();
      });
      g.globalAlpha = 1;
    }

    function spawnMeteor() {
      /* always a graceful ~32° diagonal, alternating direction */
      const dir = Math.random() < 0.5 ? 1 : -1;
      const speed = 300 + Math.random() * 240;
      const ang = (32 + Math.random() * 8) * Math.PI / 180;
      meteors.push({
        x: dir > 0 ? -60 : W + 60,
        y: Math.random() * H * 0.36 - 10,
        vx: dir * Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        life: 0, ttl: 1.5 + Math.random() * 0.9,
        big: Math.random() < 0.22,              /* occasional fireball */
      });
    }

    function drawMeteor(m, fade) {
      const tailLen = m.big ? 0.42 : 0.3;
      const tx = m.x - m.vx * tailLen, ty = m.y - m.vy * tailLen;
      /* a single tapered thread — the light lives in the head and the
         thin bright core, not in a wide wash behind it */
      const g = ctx.createLinearGradient(m.x, m.y, tx, ty);
      g.addColorStop(0, colMeteor);
      g.addColorStop(1, 'transparent');
      ctx.strokeStyle = g;
      ctx.globalAlpha = fade * 0.32;
      ctx.lineWidth = m.big ? 1.8 : 1.3;
      ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.globalAlpha = fade * 0.9;
      ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x - m.vx * tailLen * 0.6, m.y - m.vy * tailLen * 0.6); ctx.stroke();
      /* a little sister-star sparkles mid-tail */
      if (meteorSprite) {
        const half = (meteorSprite.width / (2 * DPR)) * 0.42;
        ctx.globalAlpha = fade * 0.4;
        ctx.drawImage(meteorSprite, m.x - m.vx * tailLen * 0.45 - half, m.y - m.vy * tailLen * 0.45 - half, half * 2, half * 2);
      }
      /* five-star head, rim-glow only */
      if (meteorSprite) {
        const scale = m.big ? 1.4 : 1;
        const half = (meteorSprite.width / (2 * DPR)) * scale;
        ctx.globalAlpha = fade;
        ctx.drawImage(meteorSprite, m.x - half, m.y - half, half * 2, half * 2);
      }
      ctx.globalAlpha = 1;
    }

    let dtDraw = 0;
    function tick(now) {
      requestAnimationFrame(tick);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      /* frozen while hidden or mid-scroll: the sky waits, the page glides */
      if (!visible || scrolling) { dtDraw = 0; return; }
      frame++;
      if (frame % 240 === 0) themeColors();   /* rare safety poll; flips arrive via observer below */
      dtDraw += dt;
      if (MOBILE && dtDraw < 1 / 30) return;   /* 30fps cadence on phones */
      const step = dtDraw; dtDraw = 0;
      const time = now / 1000;

      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(sky, 0, 0, sky.width, sky.height, 0, 0, W, H);

      /* the twinkling few — sprite blits, no path work.
         Two detuned sines per star read as organic scintillation
         instead of a metronome; the largest few also breathe a
         whisper of scale. */
      if (sprites) {
        glowStars.forEach((s) => {
          const spr = sprites[s.k];
          const half = spr.width / (2 * DPR);
          const tw = 0.62 * Math.sin(time * s.sp + s.ph) +
                     0.38 * Math.sin(time * s.sp * 2.63 + s.ph * 1.71);
          ctx.globalAlpha = Math.max(0, Math.min(1, s.base + s.amp * tw)) * mood.alpha;
          if (s.k === 'l') {
            const sc = 1 + 0.07 * Math.sin(time * s.sp * 0.6 + s.ph);
            ctx.drawImage(spr, s.x - half * sc, s.y - half * sc, half * 2 * sc, half * 2 * sc);
          } else {
            ctx.drawImage(spr, s.x - half, s.y - half, half * 2, half * 2);
          }
        });
      }
      ctx.globalAlpha = 1;

      nextMeteor -= step;
      if (nextMeteor <= 0) {
        spawnMeteor();
        nextMeteor = mood.meteorEvery[0] + Math.random() * (mood.meteorEvery[1] - mood.meteorEvery[0]);
      }
      meteors = meteors.filter((m) => m.life < m.ttl && m.y < H + 80);
      meteors.forEach((m) => {
        m.life += step;
        m.x += m.vx * step;
        m.y += m.vy * step;
        drawMeteor(m, Math.sin((m.life / m.ttl) * Math.PI) * mood.meteorAlpha);
      });
    }

    themeColors();
    seed();
    /* theme flips: observe the attribute directly, then DEFER the rebake
       a breath — the page's own restyle paints first, and a round-trip
       back hits the double-buffer (instant). Rebaking synchronously in
       the flip frame was the toggle jank. */
    new MutationObserver(() => {
      clearTimeout(rebakeTimer);
      rebakeTimer = setTimeout(() => {
        themeColors();
        if (RM) drawStatic();   /* reduced motion: nothing else will repaint */
      }, 70);
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        /* phones: the URL bar collapsing/expanding fires resize on EVERY
           scroll direction change — a full reseed + rebake there was the
           scroll jank (worse now the sky paints a milky way). Only
           reseed for real geometry changes: width flips (rotation) or a
           big height delta. The canvas CSS stretches a few px to cover
           the slack — invisible on a sky. */
        const w = window.innerWidth, h = window.innerHeight;
        if (MOBILE && w === seededW && Math.abs(h - seededH) < 120) return;
        seed();
      }, 180);
    }, { passive: true });
    /* one calm frame, no motion — re-used by the reduced-motion path AND
       after a theme flip there (no rAF loop is running to repaint for us) */
    function drawStatic() {
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(sky, 0, 0, sky.width, sky.height, 0, 0, W, H);
      if (sprites) {
        glowStars.forEach((s) => {
          const spr = sprites[s.k];
          const half = spr.width / (2 * DPR);
          ctx.globalAlpha = mood.alpha * 0.9;
          ctx.drawImage(spr, s.x - half, s.y - half, half * 2, half * 2);
        });
        ctx.globalAlpha = 1;
      }
    }

    document.addEventListener('visibilitychange', () => { visible = !document.hidden; });
    /* phones: freeze the sky while the finger is on the glass */
    if (MOBILE) {
      window.addEventListener('scroll', () => {
        scrolling = true;
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => { scrolling = false; }, 160);
      }, { passive: true });
    }

    if (RM) {
      drawStatic();
      return;
    }
    requestAnimationFrame(tick);
  }

  /* ================= owner tools: upload ================= */

  const picked = { covers: new Map() }; /* audio file index → cover dataURL */

  function isAudioFile(f) {
    return /^audio\//.test(f.type) || /\.(mp3|wav|ogg|flac|m4a)$/i.test(f.name);
  }

  $('mediaFiles').addEventListener('change', async () => {
    picked.covers.clear();
    const wrap = $('coverRows');
    wrap.innerHTML = '';
    const files = [...($('mediaFiles').files || [])];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!isAudioFile(f)) continue;

      const row = document.createElement('div');
      row.className = 'cover-row';
      row.innerHTML = `
        <div class="cr-box"><img alt=""></div>
        <div class="cr-info">
          <span class="cr-name">${esc(f.name.replace(/\.[^.]*$/, ''))}</span>
          <span class="cr-status"></span>
        </div>
        <button type="button" class="cr-pick">${esc(t('cover_pick'))}</button>
        <input type="file" accept="image/*" hidden>`;
      wrap.appendChild(row);

      const img = row.querySelector('img');
      const status = row.querySelector('.cr-status');
      const input = row.querySelector('input[type=file]');

      const setCover = (dataUrl, auto) => {
        picked.covers.set(i, dataUrl);
        img.src = dataUrl;
        status.textContent = auto ? t('cover_auto') : t('cover_manual');
      };

      row.querySelector('.cr-pick').addEventListener('click', () => input.click());
      input.addEventListener('change', async () => {
        const cf = input.files && input.files[0];
        if (cf) setCover(await readAsDataURL(cf), false);
      });

      /* try the file's own embedded cover first */
      status.textContent = t('cover_reading');
      try {
        const blob = await extractId3Cover(f);
        if (blob) setCover(await readAsDataURL(blob), true);
        else status.textContent = t('cover_none');
      } catch { status.textContent = t('cover_none'); }
    }
  });

  /* Minimal ID3v2 APIC parser — returns a Blob of the embedded
     picture, or null. Reads at most the first 8 MB of the file. */
  async function extractId3Cover(file) {
    const buf = await file.slice(0, 8 * 1024 * 1024).arrayBuffer();
    const b = new Uint8Array(buf);
    if (b.length < 10 || b[0] !== 0x49 || b[1] !== 0x44 || b[2] !== 0x33) return null;
    const ver = b[3];
    const sync = (o) => ((b[o] & 0x7f) << 21) | ((b[o + 1] & 0x7f) << 14) | ((b[o + 2] & 0x7f) << 7) | (b[o + 3] & 0x7f);
    const tagEnd = Math.min(10 + sync(6), b.length);
    let pos = 10;
    if (b[5] & 0x40) { /* extended header */
      if (ver === 3) pos += 4 + ((b[pos] << 24) | (b[pos + 1] << 16) | (b[pos + 2] << 8) | b[pos + 3]);
      else pos += sync(pos);
    }
    while (pos + 10 <= tagEnd) {
      if (b[pos] === 0) break;
      const id = String.fromCharCode(b[pos], b[pos + 1], b[pos + 2], b[pos + 3]);
      const size = ver === 4 ? sync(pos + 4)
        : ((b[pos + 4] << 24) | (b[pos + 5] << 16) | (b[pos + 6] << 8) | b[pos + 7]);
      if (size <= 0 || pos + 10 + size > b.length) break;
      if (id === 'APIC') {
        const f0 = pos + 10, fEnd = f0 + size;
        const enc = b[f0];
        let p = f0 + 1, mime = '';
        while (p < fEnd && b[p] !== 0) { mime += String.fromCharCode(b[p]); p++; }
        p += 2; /* mime NUL + picture type */
        if (enc === 1 || enc === 2) { while (p + 1 < fEnd && !(b[p] === 0 && b[p + 1] === 0)) p += 2; p += 2; }
        else { while (p < fEnd && b[p] !== 0) p++; p++; }
        if (p < fEnd) return new Blob([b.slice(p, fEnd)], { type: mime || 'image/jpeg' });
        return null;
      }
      pos += 10 + size;
    }
    return null;
  }

  $('mediaUpload').addEventListener('click', async () => {
    const msg = $('mediaMsg');
    const files = [...($('mediaFiles').files || [])];
    if (!files.length) { msg.textContent = t('msg_no_file'); return; }
    msg.textContent = t('uploading');

    const payload = { id: entry.id, files: [] };
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const item = { file: await readAsDataURL(f), filename: f.name };
        if (isAudioFile(f)) {
          item.title = f.name.replace(/\.[^.]*$/, '');
          if (picked.covers.has(i)) item.coverFile = picked.covers.get(i);
        }
        payload.files.push(item);
      }
    } catch {
      msg.textContent = t('msg_media_fail');
      return;
    }

    try {
      if (await apiAvailable()) {
        const r = await fetch('api/media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'failed');
        entry.media = data.media;
      } else {
        if (payload.files.some((f) => f.file.length > 3 * 1024 * 1024)) {
          msg.textContent = t('msg_static_big');
          return;
        }
        entry.media.push(...payload.files.map((f) => {
          const type = f.file.startsWith('data:video/') ? 'video'
            : f.file.startsWith('data:audio/') ? 'audio' : 'image';
          const m = { type, src: f.file };
          if (type === 'audio') {
            if (f.title) m.title = f.title;
            if (f.coverFile) m.cover = f.coverFile;
          }
          return m;
        }));
        const list = await loadContent();
        const mine = list.find((it) => it.id === entry.id);
        if (mine) { mine.media = entry.media; mine.src = entry.media[0].src; saveOverride(list); }
      }
      entry.src = entry.media[0] ? entry.media[0].src : '';
      msg.textContent = t('msg_media_saved');
      $('mediaFiles').value = '';
      $('coverRows').innerHTML = '';
      picked.covers.clear();
      renderMedia();
    } catch {
      msg.textContent = t('msg_media_fail');
    }
  });

  function readAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
  }

  init();
})();
