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
    if (!entry.media || !entry.media.length) { wrap.innerHTML = ''; return; }
    const lays = layoutClasses();
    wrap.innerHTML = entry.media.map((m, i) => {
      const label = m.type === 'audio'
        ? `${esc(t('media_track'))} ${String(i + 1).padStart(2, '0')}`
        : `${esc(typeLabel(m.type))} ${String(i + 1).padStart(2, '0')}`;
      let inner;
      if (m.type === 'video') {
        inner = `<video src="${esc(m.src)}" controls preload="metadata" playsinline></video>`;
      } else if (m.type === 'audio') {
        inner = `
          <div class="track-card">
            <div class="track-cover"><img src="${esc(m.cover || PLACEHOLDER_COVER)}" alt=""></div>
            <div class="track-main">
              <div class="track-title">${esc(trackTitle(m, i))}</div>
              <audio src="${esc(m.src)}" controls preload="metadata"></audio>
            </div>
          </div>`;
      } else {
        inner = `<img src="${esc(m.src)}" alt="${esc(loc(entry, 'title'))} ${i + 1}" loading="lazy">`;
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
