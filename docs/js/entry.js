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
    renderTravelMap();
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

  /* ================= travel map (entry i1) =================
     A simplified line map: hand-drawn streets, one dashed route
     walking point to point through the places the photos were taken.
     Nodes come from the media captions — caption a photo with a
     place name below and it appears on the map by itself. */
  const TRAVEL_SPOTS = [
    { key: '东京塔',   en: 'TOKYO TOWER',            x: 448, y: 268,
      icon: 'M-4.5 5 L0 -6.5 L4.5 5 M-2.6 1 L2.6 1 M0 -6.5 L0 -9' },
    { key: '东京大学', en: 'THE UNIVERSITY OF TOKYO', x: 178, y: 86,
      icon: 'M-5.5 5 L-5.5 -1.5 A5.5 4.5 0 0 1 5.5 -1.5 L5.5 5 M-7.5 5 L7.5 5' },
    { key: '你的名字', en: 'SUGA SHRINE · YOUR NAME', x: 330, y: 178,
      icon: 'M-5.5 -4.5 L5.5 -4.5 M-4.5 -7 L4.5 -7 M-3.5 -4.5 L-3.5 5 M3.5 -4.5 L3.5 5' },
    { key: '新宿',     en: 'SHINJUKU',                x: 112, y: 212,
      icon: 'M-5 5 L-5 -3.5 L-1.5 -3.5 L-1.5 5 M0.5 5 L0.5 -6.5 L4.5 -6.5 L4.5 5' },
    { key: '涩谷',     en: 'SHIBUYA CROSSING',        x: 252, y: 302,
      icon: 'M-5.5 -5.5 L5.5 5.5 M-5.5 5.5 L5.5 -5.5 M0 -7.5 L0 7.5' },
  ];

  function renderTravelMap() {
    if (entry.id !== 'i1' || !entry.media || !entry.media.length) return;

    /* pair each spot with the media item whose caption names it */
    const stops = [];
    entry.media.forEach((m, mi) => {
      const cap = String(m.captionZh || m.caption || '');
      if (!cap) return;
      const spot = TRAVEL_SPOTS.find((s) => cap.includes(s.key));
      if (spot && !stops.some((st) => st.spot === spot)) {
        stops.push({ spot, mi, zh: cap.trim() });
      }
    });
    if (stops.length < 2) return;

    /* journey order follows the photo order in the entry */
    const route = stops.map((st, i) =>
      `${i ? 'L' : 'M'}${st.spot.x} ${st.spot.y}`).join(' ');

    const box = document.createElement('div');
    box.className = 'travel-map';
    box.innerHTML = `
      <div class="tm-head">
        <span>${esc(t('tm_title'))}</span>
        <span class="tm-hint">${esc(t('tm_hint'))}</span>
      </div>
      <svg viewBox="0 0 560 380" role="img" aria-label="${esc(t('tm_title'))}">
        <!-- hand-drawn street web -->
        <g aria-hidden="true">
          <path class="tm-street" d="M-10 70 C70 58 150 92 240 76 S420 46 575 78"/>
          <path class="tm-street" d="M-8 140 C90 128 180 162 280 142 S460 112 578 148"/>
          <path class="tm-street" d="M-12 236 C80 222 190 258 300 238 S470 208 580 240"/>
          <path class="tm-street" d="M-6 330 C90 318 200 350 320 332 S480 306 578 334"/>
          <path class="tm-street" d="M84 -8 C74 90 106 190 90 300 S84 350 92 392"/>
          <path class="tm-street" d="M252 -10 C244 100 276 200 260 316 S254 360 262 392"/>
          <path class="tm-street" d="M420 -6 C412 96 440 196 428 312 S422 358 430 392"/>
          <path class="tm-street" d="M-10 186 C120 172 300 200 575 180"/>
          <path class="tm-river" d="M-12 292 C110 276 210 312 330 296 S490 268 578 288"/>
        </g>
        <!-- the walk itself -->
        <path class="tm-route" d="${route}"/>
        ${stops.map((st, i) => `
        <g class="tm-node" data-mi="${st.mi}" tabindex="0" role="button"
           aria-label="${esc(st.zh)}">
          <circle class="halo" cx="${st.spot.x}" cy="${st.spot.y}" r="13"/>
          <circle class="core" cx="${st.spot.x}" cy="${st.spot.y}" r="4.5"/>
          <g class="tm-icon" transform="translate(${st.spot.x}, ${st.spot.y - 24})">
            <path d="${st.spot.icon}"/>
          </g>
          <text class="tm-zh" x="${st.spot.x + 16}" y="${st.spot.y + 4}">${esc(st.zh)}</text>
          <text class="tm-en" x="${st.spot.x + 16}" y="${st.spot.y + 16}">${esc(st.spot.en)}</text>
        </g>`).join('')}
      </svg>`;

    /* click / Enter on a stop → glide to its photograph */
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

    const media = $('entryMedia');
    media.parentNode.insertBefore(box, media);
  }

  /* ================= starfield (entry t2 — About Koyome) =================
     Geometric night sky behind the page: plus-shaped stars, a few
     faint constellation threads, and a meteor sweeping by now and
     then. Colors follow the theme variables; reduced motion gets a
     single static frame. */
  function renderStarfield() {
    if (entry.id !== 't2') return;
    const cv = document.createElement('canvas');
    cv.className = 'starfield';
    cv.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cv);
    const ctx = cv.getContext('2d');

    let W = 0, H = 0, stars = [], threads = [], meteors = [];
    let colStar = '#7d8798', colLine = 'rgba(110,118,132,0.32)', colMeteor = '#9e2b25';
    let frame = 0, visible = !document.hidden, nextMeteor = 2.5, last = performance.now();

    function themeColors() {
      const cs = getComputedStyle(document.documentElement);
      colStar = (cs.getPropertyValue('--star') || colStar).trim();
      colLine = (cs.getPropertyValue('--star-line') || colLine).trim();
      colMeteor = (cs.getPropertyValue('--meteor') || colMeteor).trim();
    }

    function seed() {
      W = cv.width = window.innerWidth;
      H = cv.height = window.innerHeight;
      const n = Math.round((W * H) / 16000);
      stars = Array.from({ length: n }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() < 0.72 ? 1 + Math.random() * 1.1 : 2.6 + Math.random() * 2.2,
        cross: Math.random() >= 0.72,           /* big ones are plus-shaped */
        ph: Math.random() * Math.PI * 2,        /* twinkle phase */
        sp: 0.4 + Math.random() * 0.8,
      }));
      /* constellation threads: link a few close neighbours */
      threads = [];
      for (let i = 0; i < stars.length && threads.length < 9; i += 7) {
        const a = stars[i];
        let best = null, bd = 1e9;
        for (let j = i + 1; j < Math.min(i + 24, stars.length); j++) {
          const b = stars[j];
          const d = (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
          if (d < bd) { bd = d; best = b; }
        }
        if (best && bd < 260 * 260) threads.push([a, best]);
      }
    }

    function drawStatic(time) {
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = colLine;
      ctx.lineWidth = 0.7;
      threads.forEach(([a, b]) => {
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      });
      stars.forEach((s) => {
        const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * s.sp + s.ph));
        ctx.globalAlpha = tw;
        ctx.strokeStyle = colStar;
        ctx.lineWidth = 1;
        if (s.cross) {
          const r = s.r * 2.1;
          ctx.beginPath();
          ctx.moveTo(s.x - r, s.y); ctx.lineTo(s.x + r, s.y);
          ctx.moveTo(s.x, s.y - r); ctx.lineTo(s.x, s.y + r);
          ctx.stroke();
        } else {
          ctx.fillStyle = colStar;
          ctx.fillRect(s.x - s.r / 2, s.y - s.r / 2, s.r, s.r);
        }
      });
      ctx.globalAlpha = 1;
    }

    function spawnMeteor() {
      const fromLeft = Math.random() < 0.5;
      meteors.push({
        x: fromLeft ? -40 : Math.random() * W * 0.7 + W * 0.3,
        y: Math.random() * H * 0.32 - 20,
        vx: (fromLeft ? 1 : -1) * (240 + Math.random() * 220),
        vy: 150 + Math.random() * 120,
        life: 0, ttl: 1.4 + Math.random() * 0.8,
      });
    }

    function tick(now) {
      requestAnimationFrame(tick);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (!visible) return;
      frame++;
      if (frame % 45 === 0) themeColors();   /* pick up day/night flips */
      const time = now / 1000;
      drawStatic(time);

      nextMeteor -= dt;
      if (nextMeteor <= 0) { spawnMeteor(); nextMeteor = 3 + Math.random() * 6; }
      meteors = meteors.filter((m) => m.life < m.ttl);
      meteors.forEach((m) => {
        m.life += dt;
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        const fade = Math.sin((m.life / m.ttl) * Math.PI);
        const tx = m.x - m.vx * 0.28, ty = m.y - m.vy * 0.28;
        const g = ctx.createLinearGradient(m.x, m.y, tx, ty);
        g.addColorStop(0, colMeteor);
        g.addColorStop(1, 'transparent');
        ctx.globalAlpha = fade * 0.9;
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.globalAlpha = fade;
        ctx.fillStyle = colMeteor;
        ctx.fillRect(m.x - 1.2, m.y - 1.2, 2.4, 2.4);
        ctx.globalAlpha = 1;
      });
    }

    themeColors();
    seed();
    window.addEventListener('resize', seed, { passive: true });
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
