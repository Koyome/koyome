/* ============================================================
   entry.js — Entry detail page: full entry view + media gallery
   + per-entry media upload (multiple images / videos)
   Text fields follow the active language (titleZh / descZh / bodyZh).
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

  async function init() {
    const list = await loadContent();
    entry = list.find((it) => it.id === entryId) || null;
    if (!entry) {
      $('entryHead').innerHTML = `<div class="empty">${esc(t('entry_not_found'))}</div>`;
      $('ownerTools').style.display = 'none';
      return;
    }
    normalize(entry);
    const title = loc(entry, 'title') || t('untitled');
    document.title = `${title} · Koyome`;
    renderHead(title);
    renderBody();
    renderMedia();
  }

  function renderHead(title) {
    $('entryHead').innerHTML = `
      <div class="card-meta">
        <span class="tag accent">${esc(typeLabel(entry.type))}</span>
        <span>${esc(loc(entry, 'category') || t('uncategorized'))}</span>
        <span>${esc(entry.date || '')}</span>
        ${entry.featured ? '<span>★</span>' : ''}
      </div>
      <h1>${esc(title)}</h1>
      ${loc(entry, 'desc') ? `<p class="desc">${esc(loc(entry, 'desc'))}</p>` : ''}`;
  }

  function renderBody() {
    const body = loc(entry, 'body');
    $('entryBody').innerHTML = entry.type === 'text' && body
      ? `<div class="entry-prose">${esc(body)}</div>`
      : '';
  }

  function renderMedia() {
    const wrap = $('entryMedia');
    if (!entry.media || !entry.media.length) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = entry.media.map((m, i) => `
      <div class="media-item">
        <span class="media-label">${esc(typeLabel(m.type))} ${String(i + 1).padStart(2, '0')}</span>
        ${m.type === 'video'
          ? `<video src="${esc(m.src)}" controls preload="metadata" playsinline></video>`
          : `<img src="${esc(m.src)}" alt="${esc(loc(entry, 'title'))} ${i + 1}" loading="lazy">`}
        <button class="media-del" data-index="${i}" title="${esc(t('del'))}">${esc(t('del'))} ✕</button>
      </div>`).join('');

    wrap.querySelectorAll('.media-del').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm(t('confirm_del'))) return;
        const index = parseInt(btn.dataset.index, 10);
        const api = await apiAvailable();
        if (api) {
          await fetch(`api/media?id=${encodeURIComponent(entry.id)}&index=${index}`, { method: 'DELETE' });
        }
        /* update local view (and static override if applicable) */
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
  }

  /* ---------- media upload ---------- */
  $('mediaUpload').addEventListener('click', async () => {
    const msg = $('mediaMsg');
    const files = $('mediaFiles').files;
    if (!files || !files.length) { msg.textContent = t('msg_no_file'); return; }
    msg.textContent = t('uploading');

    const payload = { id: entry.id, files: [] };
    try {
      for (const f of files) {
        payload.files.push({ file: await readAsDataURL(f), filename: f.name });
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
        entry.media.push(...payload.files.map((f) => ({
          type: f.file.startsWith('data:video/') ? 'video' : 'image',
          src: f.file,
        })));
        const list = await loadContent();
        const mine = list.find((it) => it.id === entry.id);
        if (mine) { mine.media = entry.media; mine.src = entry.media[0].src; saveOverride(list); }
      }
      entry.src = entry.media[0] ? entry.media[0].src : '';
      msg.textContent = t('msg_media_saved');
      $('mediaFiles').value = '';
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
