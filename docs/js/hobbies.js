/* ============================================================
   hobbies.js — "My Hobbies" page, second form.
   Two fixed sections (favorite anime / anime characters), each a
   flowing river of image + text items. Everything is owner-
   editable in place: double-click names / intros, click an image
   frame to upload or replace a picture, add or remove items.
   Three chibi slots float around the page for cute characters.
   Static hosting: edits stay in the visitor's own localStorage.
   ============================================================ */
(function () {
  'use strict';
  const { loadHobbies, saveHobbiesOverride, escapeHtml, apiAvailable, loc } = window.Koyome;
  const { t } = window.I18N;
  const esc = escapeHtml;
  const $ = (id) => document.getElementById(id);

  const RM = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const SECTION_META = {
    anime: { zh: 'hob_sec_anime', en: 'hob_sec_anime_en' },
    chars: { zh: 'hob_sec_chars', en: 'hob_sec_chars_en' },
    galgame: { zh: 'hob_sec_galgame', en: 'hob_sec_galgame_en' },
  };
  /* where each chibi slot sits — PINNED TO THE VIEWPORT (position:fixed
     in CSS), so adding items never pushes a chibi down the page.
     R12: positions are chosen so a slot never lands on text or photos —
     wide screens park all six in the empty margins BESIDE the 1080px
     content column (CSS calc off the centre line); narrower windows get
     two small corner chibi; phones get a single tiny one tucked under
     the header. CSS hides the slots beyond each tier's count. */
  const VW = window.innerWidth || 1280;
  const DECO_POS = VW <= 720 ? [
    /* phones: every filled chibi gets its own perch in a slim vertical
       rail down the right edge — all of them fully on show (R13) */
    { top: '86px', right: '10px' },
    { top: '140px', right: '10px' },
    { top: '194px', right: '10px' },
    { top: '248px', right: '10px' },
    { top: '302px', right: '10px' },
    { top: '356px', right: '10px' },
  ] : VW < 1400 ? [
    { top: '86px', right: '10px' },         /* under the header, right corner */
    { bottom: '90px', left: '10px' },       /* above the footer, left corner */
  ] : [
    { top: '120px', left: 'calc(50% + 566px)' },   /* right margin, beside the intro */
    { top: '34%', right: 'calc(50% + 566px)' },    /* left margin, upper */
    { top: '52%', left: 'calc(50% + 572px)' },     /* right margin, midway */
    { bottom: '26%', right: 'calc(50% + 572px)' }, /* left margin, lower */
    { bottom: '96px', left: 'calc(50% + 566px)' }, /* right margin, near the footer */
    { bottom: '110px', right: 'calc(50% + 566px)' },/* left margin, near the footer */
  ];

  let doc = { intro: '', introZh: '', sections: [], deco: [] };
  let canEdit = false;
  let pendingUpload = null; /* { kind: 'item', secId, itemId } | { kind: 'deco', decoId } */

  function observeReveals(scope) {
    const els = [...scope.querySelectorAll('.reveal-row, [data-reveal]')];
    if (RM || !('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('in-view', 'settled'));
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
    els.forEach((el) => io.observe(el));
  }

  async function persist(msg) {
    const box = $('hobMsg');
    try {
      if (await apiAvailable()) {
        const r = await fetch('api/hobbies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(doc),
        });
        if (!r.ok) throw new Error('fail');
      } else {
        saveHobbiesOverride(doc);
      }
      if (msg) { box.textContent = t('msg_hob_saved'); setTimeout(() => { box.textContent = ''; }, 2600); }
    } catch (_) {
      box.textContent = t('msg_hob_fail');
    }
  }

  /* generic double-click inline editor (same behaviour as entry page) */
  function bindInlineText(el, getter, apply, multiline, emptyText) {
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
        if (!save || v === current) { el.textContent = current || emptyText || ''; return; }
        apply(v);
        el.textContent = v || emptyText || '';
        el.classList.toggle('is-empty', !v);
        persist(true);
      };
      input.addEventListener('keydown', (ev) => {
        if (!multiline && ev.key === 'Enter') { ev.preventDefault(); finish(true); }
        if (ev.key === 'Escape') { ev.preventDefault(); finish(false); }
      });
      input.addEventListener('blur', () => finish(true));
    });
  }

  /* ---------- uploads (item pictures & chibi) ---------- */
  function askUpload(target) {
    pendingUpload = target;
    const input = $('hobFile');
    input.value = '';
    input.click();
  }

  async function handleFile(file) {
    if (!file || !pendingUpload) return;
    const target = pendingUpload;
    pendingUpload = null;
    const dataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    let src = dataUrl;
    if (await apiAvailable()) {
      try {
        const r = await fetch('api/hobbies/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file: dataUrl, filename: file.name || 'image' }),
        });
        const j = await r.json();
        if (!r.ok || !j.src) throw new Error('upload failed');
        src = j.src;
      } catch (_) {
        $('hobMsg').textContent = t('msg_hob_fail');
        return;
      }
    }
    if (target.kind === 'item') {
      const sec = doc.sections.find((s) => s.id === target.secId);
      const it = sec && sec.items.find((x) => x.id === target.itemId);
      if (it) it.src = src;
    } else if (target.kind === 'deco') {
      const d = doc.deco.find((x) => x.id === target.decoId);
      if (d) d.src = src;
    }
    await persist(false);
    render();
  }

  /* ---------- five-axis anime ratings (anime section only) ----------
     Each anime item carries an optional ratings array
     [animation, character, story, pacing, sound] — 0..10, half steps.
     The owner drags the polygon's nodes (one axis follows the pointer)
     or its edges (both ends follow); visitors get the same chart
     read-only, and only once at least one axis is rated. */
  const RATE_DIMS = ['animation', 'character', 'story', 'pacing', 'sound'];
  const RATE_MAX = 10, RATE_STEP = 0.5;
  const RC = { x: 130, y: 88, r: 58, label: 79 };   /* geometry, viewBox 260×188 */

  function ratingsOf(it) {
    const r = Array.isArray(it.ratings) ? it.ratings : [];
    return [0, 1, 2, 3, 4].map((i) => {
      const v = Math.round(Number(r[i]) * 2) / 2;
      return Number.isFinite(v) ? Math.max(0, Math.min(RATE_MAX, v)) : 0;
    });
  }
  const axisAngle = (i) => (-90 + i * 72) * Math.PI / 180;
  const axisPoint = (i, v) => ({
    x: +(RC.x + Math.cos(axisAngle(i)) * RC.r * (v / RATE_MAX)).toFixed(1),
    y: +(RC.y + Math.sin(axisAngle(i)) * RC.r * (v / RATE_MAX)).toFixed(1),
  });
  const polyPoints = (vals) =>
    vals.map((v, i) => { const p = axisPoint(i, v); return p.x + ',' + p.y; }).join(' ');

  function renderRadar(it) {
    const vals = ratingsOf(it);
    const rated = vals.some((v) => v > 0);
    if (!canEdit && !rated) return '';   /* visitors never see an empty ghost */
    const gid = 'hrGrad-' + it.id;
    /* grid every 2 points + a dashed benchmark line at half scale (5) */
    const rings = [2, 4, 5, 6, 8, 10].map((k) =>
      `<polygon class="hr-ring${k === RATE_MAX ? ' outer' : k === 5 ? ' mid' : ''}" points="${polyPoints([k, k, k, k, k])}"/>`).join('');
    const spokes = [0, 1, 2, 3, 4].map((i) => {
      const p = axisPoint(i, RATE_MAX);
      return `<line class="hr-spoke" x1="${RC.x}" y1="${RC.y}" x2="${p.x}" y2="${p.y}"/>`;
    }).join('');
    const vticks = [0, 1, 2, 3, 4].map((i) => {
      const p = axisPoint(i, RATE_MAX);
      return `<circle class="hr-vtick" cx="${p.x}" cy="${p.y}" r="1.4"/>`;
    }).join('');
    const labels = RATE_DIMS.map((d, i) => {
      const a = axisAngle(i);
      const x = RC.x + Math.cos(a) * RC.label, y = RC.y + Math.sin(a) * RC.label + 3;
      const anchor = Math.abs(Math.cos(a)) < 0.3 ? 'middle' : (Math.cos(a) > 0 ? 'start' : 'end');
      return `<text class="hr-dim" data-rlab="${i}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}">${esc(t('hob_dim_' + d))}</text>`;
    }).join('');
    const dots = vals.map((v, i) => {
      const p = axisPoint(i, v);
      return canEdit
        ? `<g class="hr-pt"><circle class="hr-hit" data-rnode="${i}" cx="${p.x}" cy="${p.y}" r="15"/>` +
          `<circle class="hr-dot" data-rdot="${i}" cx="${p.x}" cy="${p.y}" r="3.4" pointer-events="none"/></g>`
        : `<circle class="hr-dot" data-rdot="${i}" cx="${p.x}" cy="${p.y}" r="3.4"/>`;
    }).join('');
    const edges = canEdit ? vals.map((v, i) => {
      const a = axisPoint(i, v), b = axisPoint((i + 1) % 5, vals[(i + 1) % 5]);
      return `<line class="hr-ehit" data-redge="${i}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`;
    }).join('') : '';
    const avg = vals.reduce((s, v) => s + v, 0) / RATE_DIMS.length;
    return `
    <div class="hob-radar${canEdit ? ' can' : ''}${rated ? '' : ' unrated'}" data-hrate="${esc(it.id)}">
      <div class="hr-cap">${esc(t('hob_rate'))}</div>
      <svg viewBox="0 0 260 188" role="img" aria-label="${esc(t('hob_rate'))}">
        <defs><radialGradient id="${gid}" cx="50%" cy="50%" r="68%">
          <stop offset="0%" class="hr-g0"/><stop offset="100%" class="hr-g1"/>
        </radialGradient></defs>
        ${rings}${spokes}${vticks}
        <polygon class="hr-poly" fill="url(#${gid})" points="${polyPoints(vals)}"/>
        ${edges}${dots}${labels}
        <text class="hr-val" x="${RC.x}" y="184" text-anchor="middle">${rated ? esc(t('hob_avg') + ' ' + avg.toFixed(1)) : ''}</text>
      </svg>
    </div>`;
  }

  /* in-place redraw during a drag — no re-render, pointer capture survives */
  function updateRadar(box, vals, active) {
    box.querySelector('.hr-poly').setAttribute('points', polyPoints(vals));
    vals.forEach((v, i) => {
      const p = axisPoint(i, v);
      ['[data-rdot="' + i + '"]', '[data-rnode="' + i + '"]'].forEach((sel) => {
        const el = box.querySelector(sel);
        if (el) { el.setAttribute('cx', p.x); el.setAttribute('cy', p.y); }
      });
      const eh = box.querySelector('[data-redge="' + i + '"]');
      if (eh) {
        const q = axisPoint((i + 1) % 5, vals[(i + 1) % 5]);
        eh.setAttribute('x1', p.x); eh.setAttribute('y1', p.y);
        eh.setAttribute('x2', q.x); eh.setAttribute('y2', q.y);
      }
    });
    const out = box.querySelector('.hr-val');
    box.querySelectorAll('[data-rlab]').forEach((el) => el.classList.remove('on'));
    if (active && active.kind === 'node') {
      out.textContent = t('hob_dim_' + RATE_DIMS[active.i]) + ' ' + vals[active.i].toFixed(1);
      const lab = box.querySelector('[data-rlab="' + active.i + '"]');
      if (lab) lab.classList.add('on');
    } else if (active && active.kind === 'edge') {
      out.textContent = vals[active.a].toFixed(1) + ' · ' + vals[active.b].toFixed(1);
      [active.a, active.b].forEach((i) => {
        const lab = box.querySelector('[data-rlab="' + i + '"]');
        if (lab) lab.classList.add('on');
      });
    } else {
      const any = vals.some((v) => v > 0);
      const avg = vals.reduce((s, v) => s + v, 0) / RATE_DIMS.length;
      out.textContent = any ? t('hob_avg') + ' ' + avg.toFixed(1) : '';
    }
  }

  function bindRadar(box) {
    const sec = doc.sections.find((s) => s.id === 'anime');
    const it = sec && sec.items.find((x) => x.id === box.dataset.hrate);
    if (!it) return;
    const svg = box.querySelector('svg');
    const vals = ratingsOf(it);
    let drag = null;   /* { kind:'node', i } | { kind:'edge', a, b } */

    const toLocal = (e) => {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      return pt.matrixTransform(svg.getScreenCTM().inverse());
    };
    /* pointer → value on axis i: projection onto the axis direction,
       snapped to half steps, clamped inside the grid */
    const axisVal = (p, i) => {
      const a = axisAngle(i);
      const proj = ((p.x - RC.x) * Math.cos(a) + (p.y - RC.y) * Math.sin(a)) / RC.r * RATE_MAX;
      return Math.max(0, Math.min(RATE_MAX, Math.round(proj / RATE_STEP) * RATE_STEP));
    };
    const applyDrag = (e) => {
      const p = toLocal(e);
      if (drag.kind === 'node') vals[drag.i] = axisVal(p, drag.i);
      else { vals[drag.a] = axisVal(p, drag.a); vals[drag.b] = axisVal(p, drag.b); }
      updateRadar(box, vals, drag);
    };
    svg.addEventListener('pointerdown', (e) => {
      const n = e.target.closest('[data-rnode]');
      const eg = e.target.closest('[data-redge]');
      if (!n && !eg) return;
      e.preventDefault();
      try { svg.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      drag = n
        ? { kind: 'node', i: +n.dataset.rnode }
        : { kind: 'edge', a: +eg.dataset.redge, b: (+eg.dataset.redge + 1) % RATE_DIMS.length };
      box.classList.add('dragging');
      applyDrag(e);
    });
    svg.addEventListener('pointermove', (e) => { if (drag) applyDrag(e); });
    const end = async () => {
      if (!drag) return;
      drag = null;
      box.classList.remove('dragging');
      it.ratings = vals.slice();
      updateRadar(box, vals, null);
      await persist(true);
    };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    updateRadar(box, vals, null);
  }

  /* ---------- rendering ---------- */
  function renderFigure(sec, it) {
    if (it.src) {
      return `
      <figure class="hflow-fig has-img${canEdit ? ' editable' : ''}" data-upitem="${esc(sec.id)}|${esc(it.id)}" title="${canEdit ? esc(t('hob_img_ph')) : ''}">
        <img src="${esc(it.src)}" alt="${esc(loc(it, 'name') || '')}" loading="lazy" />
      </figure>`;
    }
    /* no picture yet — a quiet geometric frame; owner clicks to fill it.
       Visitors get a plain circle (no "plus", nothing hinting at upload). */
    return `
    <figure class="hflow-fig is-empty${canEdit ? ' editable' : ''}" ${canEdit ? `data-upitem="${esc(sec.id)}|${esc(it.id)}"` : ''}>
      <svg viewBox="0 0 60 60" aria-hidden="true">
        <circle cx="30" cy="30" r="21" fill="none" stroke="currentColor" stroke-width="1.2"/>
        ${canEdit ? '<path d="M30 20 v20 M20 30 h20" stroke="currentColor" stroke-width="1.2"/>' : ''}
      </svg>
      ${canEdit ? `<span class="hflow-fig-ph">${esc(t('hob_img_ph'))}</span>` : ''}
    </figure>`;
  }

  function render() {
    const total = doc.sections.reduce((n, s) => n + s.items.length, 0);
    $('hobCount').textContent = String(total).padStart(2, '0') + ' ' + t('items');

    const introEl = $('hobIntro');
    introEl.textContent = loc(doc, 'intro') || t('hob_intro_fallback');

    $('hobSections').innerHTML = doc.sections.map((sec, si) => {
      const meta = SECTION_META[sec.id] || { zh: 'hob_sec_anime', en: 'hob_sec_anime_en' };
      const rows = sec.items.map((it, i) => {
        const d = Math.min(0.05 + i * 0.08, 0.45).toFixed(2) + 's';
        const name = loc(it, 'name');
        const text = loc(it, 'text');
        return `
        <div class="hflow-item reveal-row" style="--d:${d}" data-id="${esc(it.id)}">
          <span class="hflow-node" aria-hidden="true"></span>
          ${renderFigure(sec, it)}
          <div class="hflow-body">
            <span class="hflow-num">${String(i + 1).padStart(2, '0')}</span>
            <div class="hflow-name${name ? '' : ' is-empty'}" data-hname>${name ? esc(name) : (canEdit ? esc(t('hob_name_ph')) : '')}</div>
            <div class="hflow-text${text ? '' : ' is-empty'}" data-htext>${text ? esc(text) : (canEdit ? esc(t('hob_text_ph')) : '')}</div>
            ${sec.id === 'anime' ? renderRadar(it) : ''}
            ${canEdit ? `<button type="button" class="hflow-del" data-hdel="${esc(sec.id)}|${esc(it.id)}">${esc(t('del'))} ✕</button>` : ''}
          </div>
        </div>`;
      }).join('');
      return `
      <section class="hob-sec" data-sec="${esc(sec.id)}">
        <div class="section-head hob-sec-head" data-reveal>
          <span class="zh" data-i18n="${meta.zh}">${esc(t(meta.zh))}</span>
          <span class="en" data-i18n="${meta.en}">${esc(t(meta.en))}</span>
          <span class="count">${String(sec.items.length).padStart(2, '0')}</span>
        </div>
        <div class="hflow">
          ${rows || (!canEdit ? `<div class="empty">${esc(t('hob_empty_guest'))}</div>` : '')}
          ${canEdit ? `<button type="button" class="hflow-add reveal-row" style="--d:0.4s" data-hadd="${esc(sec.id)}">${esc(t('hob_add_item'))}</button>` : ''}
        </div>
      </section>${si < doc.sections.length - 1 ? '<div class="hob-river" aria-hidden="true"><span></span></div>' : ''}`;
    }).join('');

    /* chibi decoration slots */
    const layer = $('hdecoLayer');
    layer.innerHTML = doc.deco.map((d, i) => {
      const pos = DECO_POS[i % DECO_POS.length];
      const style = Object.entries(pos).map(([k, v]) => `${k}:${v}`).join(';');
      if (d.src) {
        return `
        <div class="hdeco-slot filled${canEdit ? ' editable' : ''}" style="${style}" data-slot="${esc(d.id)}">
          <img class="hdeco-img" src="${esc(d.src)}" alt="" />
          ${canEdit ? `<button type="button" class="hdeco-del" data-ddec="${esc(d.id)}" title="${esc(t('del'))}">✕</button>` : ''}
        </div>`;
      }
      if (!canEdit) return '';
      return `
      <button type="button" class="hdeco-slot empty editable" style="${style}" data-updeco="${esc(d.id)}" title="${esc(t('hob_deco_hint'))}">
        ${esc(t('hob_deco_ph'))}
      </button>`;
    }).join('');
    layer.setAttribute('aria-hidden', canEdit ? 'false' : 'true');

    /* ---------- bindings (owner mode) ---------- */
    if (canEdit) {
      bindInlineText(introEl,
        () => loc(doc, 'intro') || '',
        (v) => { doc[window.I18N.isZh ? 'introZh' : 'intro'] = v; },
        true, t('hob_intro_fallback'));

      doc.sections.forEach((sec) => {
        const secEl = document.querySelector(`[data-sec="${sec.id}"]`);
        if (!secEl) return;
        secEl.querySelectorAll('.hflow-item').forEach((row) => {
          const it = sec.items.find((x) => x.id === row.dataset.id);
          if (!it) return;
          bindInlineText(row.querySelector('[data-hname]'),
            () => loc(it, 'name') || '',
            (v) => { it[window.I18N.isZh ? 'nameZh' : 'name'] = v; },
            false, t('hob_name_ph'));
          bindInlineText(row.querySelector('[data-htext]'),
            () => loc(it, 'text') || '',
            (v) => { it[window.I18N.isZh ? 'textZh' : 'text'] = v; },
            true, t('hob_text_ph'));
        });
      });

      document.querySelectorAll('[data-hdel]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!confirm(t('confirm_hob_del'))) return;
          const [sid, iid] = btn.dataset.hdel.split('|');
          const sec = doc.sections.find((s) => s.id === sid);
          if (sec) sec.items = sec.items.filter((x) => x.id !== iid);
          await persist(false);
          render();
        });
      });

      document.querySelectorAll('[data-hadd]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const sec = doc.sections.find((s) => s.id === btn.dataset.hadd);
          if (!sec) return;
          sec.items.push({
            id: 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
            name: '', nameZh: '', text: '', textZh: '', src: '',
          });
          await persist(false);
          render();
        });
      });

      document.querySelectorAll('[data-upitem]').forEach((fig) => {
        fig.addEventListener('click', () => {
          const [sid, iid] = fig.dataset.upitem.split('|');
          askUpload({ kind: 'item', secId: sid, itemId: iid });
        });
      });

      document.querySelectorAll('[data-updeco]').forEach((slot) => {
        slot.addEventListener('click', () => askUpload({ kind: 'deco', decoId: slot.dataset.updeco }));
      });
      document.querySelectorAll('.hdeco-slot.filled.editable').forEach((slot) => {
        slot.addEventListener('click', (e) => {
          if (e.target.closest('.hdeco-del')) return;
          askUpload({ kind: 'deco', decoId: slot.dataset.slot });
        });
      });
      document.querySelectorAll('[data-ddec]').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const d = doc.deco.find((x) => x.id === btn.dataset.ddec);
          if (d) d.src = '';
          await persist(false);
          render();
        });
      });

      /* anime ratings radar — drag to score */
      document.querySelectorAll('.hob-radar.can').forEach(bindRadar);
    }

    observeReveals(document);
  }

  $('hobFile').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) handleFile(f);
  });

  (async function init() {
    doc = await loadHobbies();
    try { canEdit = await apiAvailable(); } catch (_) { canEdit = false; }
    if (canEdit) {
      const hint = $('hobEditHint');
      hint.hidden = false;
      hint.textContent = t('caption_edit_hint');
    }
    render();
  })();
})();
