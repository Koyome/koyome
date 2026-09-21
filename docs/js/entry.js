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
    renderMedia();
    renderMaps();
    renderStarfield();
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
      const field = window.I18N.lang === 'zh' ? 'titleZh' : 'title';
      await putContent({ [field]: v });
      entry[field] = v;
      document.title = `${v} · Koyome`;
      return v;
    }, false);

    const dp = $('entryHead').querySelector('[data-edesc]');
    if (dp) bindInlineText(dp, () => loc(entry, 'desc') || '', async (v) => {
      const field = window.I18N.lang === 'zh' ? 'descZh' : 'desc';
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

  function renderMedia() {
    const wrap = $('entryMedia');
    /* one border language per board: the stack carries the entry id
       so CSS can frame travel photos / films / tracks differently */
    wrap.className = 'media-stack media-' + entry.id;
    if (!entry.media || !entry.media.length) { wrap.innerHTML = ''; return; }
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
          const field = window.I18N.lang === 'zh' ? 'captionZh' : 'caption';
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
     follow real Tokyo geography on the 560×400 grid */
  const TOKYO_SPOTS = [
    { key: '东京塔',   en: 'TOKYO TOWER',             x: 266, y: 262 },
    { key: '东京大学', en: 'THE UNIVERSITY OF TOKYO', x: 306, y: 106 },
    { key: '你的名字', en: 'SUGA SHRINE · YOUR NAME', x: 206, y: 212 },
    { key: '新宿',     en: 'SHINJUKU',                x: 112, y: 178 },
    { key: '涩谷',     en: 'SHIBUYA CROSSING',        x: 138, y: 300 },
  ];

  /* faint survey grid — the digitized-map backbone */
  function graticule(w, h, step) {
    let g = '';
    for (let x = step; x < w; x += step) g += `<path d="M${x} 0 V${h}"/>`;
    for (let y = step; y < h; y += step) g += `<path d="M0 ${y} H${w}"/>`;
    return `<g class="tm-grat">${g}</g>`;
  }

  /* one labelled pin: dot + halo + zh / en captions beside it */
  function pinMarkup(p, cls, extra) {
    return `
      <g class="${cls}" ${extra || ''}>
        <circle class="halo" cx="${p.x}" cy="${p.y}" r="12"/>
        <circle class="core" cx="${p.x}" cy="${p.y}" r="4"/>
        <text class="tm-zh" x="${p.x + 13}" y="${p.y + 2}">${esc(p.zh)}</text>
        ${p.en ? `<text class="tm-en" x="${p.x + 13}" y="${p.y + 14}">${esc(p.en)}</text>` : ''}
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
      /* Tokyo Bay — open water to the southeast */
      `<path class="tm-water" d="M560 56 C518 88 492 122 480 172 C468 222 464 262 472 302 C482 348 522 376 560 390 Z"/>
       <g class="tm-waves">
         <path d="M508 210 q7 -6 14 0 q7 6 14 0"/>
         <path d="M496 268 q7 -6 14 0 q7 6 14 0"/>
         <path d="M518 326 q7 -6 14 0 q7 6 14 0"/>
       </g>`,
      /* the Sumida, winding down to the bay */
      `<path class="tm-river" d="M406 -6 C412 56 402 118 420 172 C432 214 450 246 468 268 L460 276 C442 252 424 220 412 176 C396 122 404 56 398 -6 Z"/>`,
      /* green: Imperial Palace grounds, Ueno, Shinjuku Gyoen */
      `<g class="tm-park">
         <ellipse cx="274" cy="196" rx="31" ry="21"/>
         <rect x="318" y="94" width="42" height="26"/>
         <rect x="140" y="222" width="46" height="26"/>
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
        ${stops.map((st) => pinMarkup(
          { x: st.spot.x, y: st.spot.y, zh: st.zh, en: st.spot.en },
          'tm-node', `data-mi="${st.mi}" tabindex="0" role="button" aria-label="${esc(st.zh)}"`
        )).join('')}
        ${pins.map((p, i) => pinMarkup(p, 'tm-upin', `data-upin="${i}"`)).join('')}
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
      /* Hallasan at the heart, Seongsan's crater on the east cape,
         Sanbangsan alone in the southwest */
      `<g class="tm-peak">
         <path d="M270 208 L282 184 L294 208 Z"/>
         <path d="M278 194 L282 188 L286 194"/>
         <path d="M446 162 L454 146 L462 162 Z"/>
         <path d="M124 292 L132 276 L140 292 Z"/>
       </g>`,
      /* the two cities */
      `<g class="tm-station">
         <circle cx="274" cy="112" r="3"/><circle cx="282" cy="292" r="3"/>
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
        ${pins.map((p, i) => pinMarkup(p, 'tm-upin', `data-upin="${i}"`)).join('')}
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
     same stroke dialect as the planet and the compass */
  function housesStrip() {
    return `
    <div class="i1-houses" aria-hidden="true">
      <svg viewBox="0 0 560 132" fill="none">
        <text class="hs-word" x="540" y="16" text-anchor="end">DWELLINGS · 住まい</text>
        <text class="hs-word hs-alt" x="20" y="16">FIELD RECORD — 01</text>
        <!-- ground -->
        <path class="hs-ground" d="M20 104 H540"/>
        <path class="hs-dash" d="M20 112 H540"/>
        <!-- house A: gabled, round window -->
        <g class="hs-ink">
          <path d="M42 104 V54 L78 28 L114 54 V104"/>
          <path d="M64 104 V78 H86 V104"/>
          <circle cx="96" cy="62" r="6"/>
        </g>
        <!-- house B: flat roof, three floors -->
        <g class="hs-ink">
          <path d="M136 104 V34 H192 V104"/>
          <path d="M136 58 H192 M136 81 H192"/>
          <path d="M148 46 h10 M160 46 h10 M172 46 h10 M148 70 h10 M172 70 h10 M148 92 h10 M160 92 h10 M172 92 h10"/>
        </g>
        <path class="hs-dash" d="M136 26 H192 M136 22 v8 M192 22 v8"/>
        <!-- house C: the long gable, accent window -->
        <g class="hs-ink">
          <path d="M214 104 V58 L256 32 L298 58 V104"/>
          <path d="M282 44 V28 H292 V50"/>
          <rect x="240" y="66" width="12" height="12" class="hs-accent"/>
          <path d="M262 104 V80 H278 V104"/>
        </g>
        <!-- the tall one: gridded apartments -->
        <g class="hs-ink">
          <path d="M330 104 V26 H392 V104"/>
          <path d="M345 38 h8 M361 38 h8 M377 38 h8 M345 54 h8 M361 54 h8 M377 54 h8
                   M345 70 h8 M361 70 h8 M377 70 h8 M345 86 h8 M361 86 h8 M377 86 h8"/>
          <path d="M361 26 V14 M355 14 h12" class="hs-accent-line"/>
        </g>
        <path class="hs-dash" d="M330 118 H392"/>
        <!-- tree between them -->
        <g class="hs-ink">
          <path d="M312 104 V86"/>
          <circle cx="312" cy="78" r="9"/>
        </g>
        <!-- small gable on the right -->
        <g class="hs-ink">
          <path d="M424 104 V66 L452 46 L480 66 V104"/>
          <path d="M444 104 V84 H460 V104"/>
        </g>
        <!-- construction verticals -->
        <path class="hs-dash" d="M78 28 V8 M256 32 V8 M452 46 V8"/>
        <g class="hs-ink hs-ticks">
          <path d="M74 8 h8 M252 8 h8 M448 8 h8"/>
        </g>
        <!-- surveyor's spark -->
        <path class="hs-accent-line" d="M516 86 v10 M511 91 h10"/>
      </svg>
    </div>`;
  }

  function renderMaps() {
    if (entry.id !== 'i1' || !entry.media || !entry.media.length) return;
    const old = document.querySelector('.travel-maps');
    if (old) old.remove();

    /* photo pins: pair each known spot with the media item whose
       caption names it (first match wins) */
    const stops = [];
    entry.media.forEach((m, mi) => {
      const cap = String(m.captionZh || m.caption || '');
      if (!cap) return;
      const spot = TOKYO_SPOTS.find((s) => cap.includes(s.key));
      if (spot && !stops.some((st) => st.spot === spot)) {
        stops.push({ spot, mi, zh: cap.trim() });
      }
    });

    const allPins = (entry.mapPins && typeof entry.mapPins === 'object') ? entry.mapPins : {};
    const tokyoPins = Array.isArray(allPins.tokyo) ? allPins.tokyo : [];
    const jejuPins = Array.isArray(allPins.jeju) ? allPins.jeju : [];

    const box = document.createElement('div');
    box.className = 'travel-maps';
    box.innerHTML = housesStrip() + tokyoSvg(stops, tokyoPins) + jejuSvg(jejuPins);

    const media = $('entryMedia');
    media.parentNode.insertBefore(box, media);

    /* photo pin → glide to its photograph */
    box.querySelectorAll('.tm-node').forEach((node) => {
      const jump = () => {
        const idx = parseInt(node.dataset.mi, 10);
        const block = document.querySelectorAll('#entryMedia .media-block')[idx];
        if (block) block.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'center' });
      };
      node.addEventListener('click', jump);
      node.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); jump(); }
      });
    });

    if (!canEdit) return;   /* visitors read the maps, never alter them */

    /* owner: click a self-made pin to remove it */
    box.querySelectorAll('.tm-upin').forEach((node) => {
      node.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm(t('tm_pin_del') + '?')) return;
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

  /* floating name-card for a fresh pin, positioned where clicked */
  function openPinForm(panel, mapId, x, y, vb) {
    const form = document.createElement('div');
    form.className = 'tm-pinform';
    form.style.left = (x / vb.width * 100) + '%';
    form.style.top = (y / vb.height * 100) + '%';
    form.innerHTML = `
      <input type="text" data-fzh maxlength="40" placeholder="${esc(t('tm_pin_zh_ph'))}">
      <input type="text" data-fen maxlength="40" placeholder="${esc(t('tm_pin_en_ph'))}">
      <div class="tm-pinrow">
        <button type="button" data-ok>${esc(t('tm_pin_add'))}</button>
        <button type="button" data-no>${esc(t('tm_pin_cancel'))}</button>
      </div>
      <span class="tm-pinmsg"></span>`;
    panel.appendChild(form);
    const zh = form.querySelector('[data-fzh]');
    const en = form.querySelector('[data-fen]');
    const msg = form.querySelector('.tm-pinmsg');
    zh.focus();
    const close = () => form.remove();
    form.querySelector('[data-no]').addEventListener('click', close);
    form.querySelector('[data-ok]').addEventListener('click', async () => {
      const name = zh.value.trim();
      if (!name && !en.value.trim()) { zh.focus(); return; }
      const arr = Array.isArray(entry.mapPins?.[mapId]) ? entry.mapPins[mapId].slice() : [];
      arr.push({ x, y, zh: name, en: en.value.trim() });
      entry.mapPins = { ...(entry.mapPins || {}), [mapId]: arr };
      try {
        await putContent({ mapPins: entry.mapPins });
        close();
        renderMaps();
      } catch (_) {
        msg.textContent = t('tm_pin_fail');
      }
    });
    form.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); form.querySelector('[data-ok]').click(); }
      if (e.key === 'Escape') { e.preventDefault(); close(); }
    });
  }

  /* ================= starfield (entry t2 — About Koyome) =================
     Geometric night sky behind the page: plus-shaped stars, a few
     faint constellation threads, and a meteor sweeping by now and
     then. Retina-crisp (devicePixelRatio aware), calmer in day mode,
     richer at night; reduced motion gets a single static frame. */
  function renderStarfield() {
    if (entry.id !== 't2') return;
    const cv = document.createElement('canvas');
    cv.className = 'starfield';
    cv.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cv);
    const ctx = cv.getContext('2d');
    /* phones: full-screen canvas repaints were fighting the scroll
     * compositor — drop to DPR 1 and a 30fps cadence there (R11) */
    const MOBILE = !!(window.matchMedia && (
      window.matchMedia('(max-width: 720px)').matches ||
      window.matchMedia('(pointer: coarse)').matches));
    const DPR = MOBILE ? 1 : Math.min(window.devicePixelRatio || 1, 2);

    let W = 0, H = 0, stars = [], threads = [], meteors = [];
    let colStar = '#7d8798', colLine = 'rgba(110,118,132,0.32)', colMeteor = '#9e2b25';
    /* mood: day = sparse & whisper-quiet, night = dense & bright */
    let mood = { density: 22000, alpha: 0.5, meteorEvery: [7, 14], meteorAlpha: 0.55 };
    let frame = 0, visible = !document.hidden, nextMeteor = 4, last = performance.now();

    function themeColors() {
      const cs = getComputedStyle(document.documentElement);
      colStar = (cs.getPropertyValue('--star') || colStar).trim();
      colLine = (cs.getPropertyValue('--star-line') || colLine).trim();
      colMeteor = (cs.getPropertyValue('--meteor') || colMeteor).trim();
      const dark = document.documentElement.dataset.theme === 'dark';
      mood = dark
        ? { density: 13000, alpha: 1, meteorEvery: [3.5, 8], meteorAlpha: 0.95 }
        : { density: 22000, alpha: 0.5, meteorEvery: [7, 14], meteorAlpha: 0.55 };
    }

    function seed() {
      W = window.innerWidth;
      H = window.innerHeight;
      cv.width = Math.round(W * DPR);
      cv.height = Math.round(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const n = Math.round((W * H) / mood.density);
      stars = Array.from({ length: n }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() < 0.74 ? 0.8 + Math.random() * 1 : 2.4 + Math.random() * 2,
        cross: Math.random() >= 0.74,           /* big ones are plus-shaped */
        ph: Math.random() * Math.PI * 2,        /* twinkle phase */
        sp: 0.25 + Math.random() * 0.55,        /* slow, calm shimmer */
      }));
      /* constellation threads: link a few close neighbours */
      threads = [];
      for (let i = 0; i < stars.length && threads.length < 8; i += 7) {
        const a = stars[i];
        let best = null, bd = 1e9;
        for (let j = i + 1; j < Math.min(i + 24, stars.length); j++) {
          const b = stars[j];
          const d = (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
          if (d < bd) { bd = d; best = b; }
        }
        if (best && bd < 240 * 240) threads.push([a, best]);
      }
    }

    function drawStatic(time) {
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = colLine;
      ctx.lineWidth = 0.6;
      ctx.globalAlpha = mood.alpha * 0.8;
      threads.forEach(([a, b]) => {
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      });
      /* small square stars: one flat-alpha pass — per-star alpha changes
         were the main paint cost on phones, and the tiny shimmer was
         barely visible on them anyway */
      ctx.globalAlpha = mood.alpha * 0.62;
      ctx.fillStyle = colStar;
      stars.forEach((s) => {
        if (!s.cross) ctx.fillRect(s.x - s.r / 2, s.y - s.r / 2, s.r, s.r);
      });
      /* plus-shaped stars keep their slow shimmer */
      stars.forEach((s) => {
        if (!s.cross) return;
        const tw = (0.3 + 0.7 * (0.5 + 0.5 * Math.sin(time * s.sp + s.ph))) * mood.alpha;
        ctx.globalAlpha = tw;
        ctx.strokeStyle = colStar;
        ctx.lineWidth = 1;
        const r = s.r * 2.1;
        ctx.beginPath();
        ctx.moveTo(s.x - r, s.y); ctx.lineTo(s.x + r, s.y);
        ctx.moveTo(s.x, s.y - r); ctx.lineTo(s.x, s.y + r);
        ctx.stroke();
        /* a tiny diamond core on the brightest crosses */
        if (tw > mood.alpha * 0.85) {
          ctx.fillStyle = colStar;
          ctx.beginPath();
          ctx.moveTo(s.x, s.y - 1.6); ctx.lineTo(s.x + 1.6, s.y);
          ctx.lineTo(s.x, s.y + 1.6); ctx.lineTo(s.x - 1.6, s.y);
          ctx.closePath(); ctx.fill();
        }
      });
      ctx.globalAlpha = 1;
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

    let dtDraw = 0;
    function tick(now) {
      requestAnimationFrame(tick);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (!visible) { dtDraw = 0; return; }
      frame++;
      if (frame % 45 === 0) themeColors();   /* pick up day/night flips */
      dtDraw += dt;
      /* phones: repaint at ~30fps — the sky is calm enough that nobody
         can tell, and scrolling stays butter-smooth */
      if (MOBILE && dtDraw < 1 / 30) return;
      const step = dtDraw; dtDraw = 0;
      const time = now / 1000;
      drawStatic(time);

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
        const fade = Math.sin((m.life / m.ttl) * Math.PI) * mood.meteorAlpha;
        const tailLen = m.big ? 0.42 : 0.3;
        const tx = m.x - m.vx * tailLen, ty = m.y - m.vy * tailLen;
        /* tapered tail: a wide faint stroke under a thin bright one */
        const g = ctx.createLinearGradient(m.x, m.y, tx, ty);
        g.addColorStop(0, colMeteor);
        g.addColorStop(1, 'transparent');
        ctx.strokeStyle = g;
        ctx.globalAlpha = fade * 0.45;
        ctx.lineWidth = m.big ? 3.2 : 2.2;
        ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.globalAlpha = fade;
        ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x - m.vx * tailLen * 0.6, m.y - m.vy * tailLen * 0.6); ctx.stroke();
        /* glowing head */
        const hr = m.big ? 7 : 4.5;
        const halo = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, hr);
        halo.addColorStop(0, colMeteor);
        halo.addColorStop(1, 'transparent');
        ctx.globalAlpha = fade * 0.8;
        ctx.fillStyle = halo;
        ctx.beginPath(); ctx.arc(m.x, m.y, hr, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      });
    }

    themeColors();
    seed();
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(seed, 180);   /* debounce: don't re-seed per pixel */
    }, { passive: true });
    document.addEventListener('visibilitychange', () => { visible = !document.hidden; });

    if (RM) { drawStatic(1); return; }   /* one calm frame, no motion */
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
