/* ============================================================
   admin.js — Content manager.
   1) Homepage profile: portrait + name + welcome line + intro
      (each text field has an optional 繁體中文 twin).
   2) Library: add text / images / videos (multiple files at once),
      EDIT existing entries (title, category, body, description…),
      and delete. Server mode writes the json files; static mode
      (GitHub Pages / offline) uses localStorage.
   ============================================================ */
(function () {
  'use strict';
  const {
    loadContent, saveOverride, loadProfile, saveProfileOverride,
    escapeHtml, typeLabel, apiAvailable, loc,
  } = window.Koyome;
  const { t } = window.I18N;
  const esc = escapeHtml;
  const $ = (id) => document.getElementById(id);

  let library = [];
  let editingId = null; /* when set, the form edits this entry instead of adding */

  /* ================= 1. Homepage profile ================= */
  let avatarData = null; /* a freshly picked file, as a dataURL */

  loadProfile().then((p) => {
    $('pName').value = p.name || '';
    $('pNameZh').value = p.nameZh || '';
    $('pTagline').value = p.tagline || '';
    $('pTaglineZh').value = p.taglineZh || '';
    $('pIntro').value = p.intro || '';
    $('pIntroZh').value = p.introZh || '';
    if (p.avatar) $('avatarPreview').src = p.avatar;
  });

  $('pAvatar').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      avatarData = await readAsDataURL(file);
      $('avatarPreview').src = avatarData;
    } catch {
      $('profMsg').textContent = t('msg_read_fail');
    }
  });

  $('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('profMsg');
    msg.textContent = t('msg_saving');

    const payload = {
      name: $('pName').value.trim(),
      nameZh: $('pNameZh').value.trim(),
      tagline: $('pTagline').value.trim(),
      taglineZh: $('pTaglineZh').value.trim(),
      intro: $('pIntro').value,
      introZh: $('pIntroZh').value,
    };

    try {
      if (await apiAvailable()) {
        if (avatarData) payload.avatarFile = avatarData;
        const r = await fetch('api/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || t('msg_prof_fail'));
        if (data.profile && data.profile.avatar) $('avatarPreview').src = data.profile.avatar;
      } else {
        const current = await loadProfile();
        if (avatarData) {
          if (avatarData.length > 3 * 1024 * 1024) { msg.textContent = t('msg_static_big'); return; }
          payload.avatar = avatarData;
        } else {
          payload.avatar = current.avatar;
        }
        saveProfileOverride({ ...current, ...payload });
      }
      avatarData = null;
      $('pAvatar').value = '';
      msg.textContent = t('msg_prof_saved');
    } catch (err) {
      msg.textContent = '✕ ' + err.message;
    }
  });

  /* ================= 2. Library ================= */
  $('adminNote').innerHTML = t('admin_note');

  const fType = $('fType');
  function syncTypeUI() {
    const isText = fType.value === 'text';
    $('fBodyWrap').style.display = isText ? '' : 'none';
    $('fFileWrap').style.display = isText ? 'none' : '';
    $('fSrcWrap').style.display = isText ? 'none' : '';
    $('fBodyZh').style.display = isText ? '' : 'none';
  }
  fType.addEventListener('change', syncTypeUI);
  syncTypeUI();

  $('fDate').value = new Date().toISOString().slice(0, 10);

  $('entryForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('formMsg');
    msg.textContent = t('msg_saving');

    const entry = {
      type: fType.value,
      title: $('fTitle').value.trim() || t('untitled'),
      category: $('fCategory').value.trim() || t('uncategorized'),
      date: $('fDate').value,
      featured: $('fFeatured').checked,
      desc: $('fDesc').value.trim(),
      titleZh: $('fTitleZh').value.trim(),
      categoryZh: $('fCategoryZh').value.trim(),
      descZh: $('fDescZh').value.trim(),
    };

    const editing = editingId ? library.find((it) => it.id === editingId) : null;

    if (entry.type === 'text') {
      entry.body = $('fBody').value;
      entry.bodyZh = $('fBodyZh').value;
      if (!entry.body.trim() && !entry.bodyZh.trim()) {
        msg.textContent = t('msg_body_empty');
        return;
      }
    } else {
      const files = $('fFile').files;
      const srcInput = $('fSrc').value.trim();
      /* when editing, existing media is kept — new files are appended */
      if (!editing && (!files || !files.length) && !srcInput) { msg.textContent = t('msg_no_media'); return; }
      if (files && files.length) {
        entry.files = [];
        try {
          for (const f of files) {
            entry.files.push({ file: await readAsDataURL(f), filename: f.name });
          }
        } catch {
          msg.textContent = t('msg_read_fail');
          return;
        }
      }
      if (srcInput) entry.src = srcInput;
    }

    try {
      const api = await apiAvailable();
      if (editing) {
        /* ---------- update an existing entry ---------- */
        if (api) {
          const r = await fetch('api/content?id=' + encodeURIComponent(editingId), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(entry),
          });
          const data = await r.json();
          if (!r.ok) throw new Error(data.error || t('msg_submit_fail'));
          /* files / url picked during edit → append as media */
          if ((entry.files && entry.files.length) || entry.src) {
            const mr = await fetch('api/media', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: editingId, files: entry.files, src: entry.src }),
            });
            if (!mr.ok) throw new Error(t('msg_media_fail'));
          }
        } else {
          const i = library.findIndex((it) => it.id === editingId);
          if (i >= 0) {
            const prev = library[i];
            const media = (prev.media || []).slice();
            (entry.files || []).forEach((f) => {
              if (f.file.length <= 3 * 1024 * 1024) {
                media.push({ type: f.file.startsWith('data:video/') ? 'video' : 'image', src: f.file });
              }
            });
            if (entry.src) media.push({ type: prev.type === 'video' ? 'video' : 'image', src: entry.src });
            delete entry.files;
            library[i] = {
              ...prev, ...entry, type: prev.type,
              media, src: media.length ? media[0].src : prev.src,
            };
            saveOverride(library);
          }
        }
        msg.textContent = t('msg_updated');
        exitEditMode();
      } else {
        /* ---------- add a new entry ---------- */
        if (api) {
          const r = await fetch('api/content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(entry),
          });
          const data = await r.json();
          if (!r.ok) throw new Error(data.error || t('msg_submit_fail'));
        } else {
          /* static mode: localStorage can't hold large files */
          const big = (entry.files || []).some((f) => f.file.length > 3 * 1024 * 1024);
          if (big) { msg.textContent = t('msg_static_big'); return; }
          const media = (entry.files || []).map((f) => ({
            type: f.file.startsWith('data:video/') ? 'video' : 'image',
            src: f.file,
          }));
          if (entry.src) media.push({ type: entry.type, src: entry.src });
          delete entry.files;
          library.unshift({
            ...entry,
            media,
            src: media.length ? media[0].src : '',
            id: 'l' + Date.now().toString(36),
          });
          saveOverride(library);
        }
        msg.textContent = t('msg_saved');
      }
      $('entryForm').reset();
      $('fDate').value = new Date().toISOString().slice(0, 10);
      syncTypeUI();
      refresh();
    } catch (err) {
      msg.textContent = '✕ ' + err.message;
    }
  });

  /* ---------- edit mode ---------- */
  function enterEditMode(item) {
    editingId = item.id;
    fType.value = item.type;
    fType.disabled = true; /* type stays; media itself is managed on the entry page */
    $('fTitle').value = item.title || '';
    $('fCategory').value = item.category || '';
    $('fDate').value = item.date || '';
    $('fFeatured').checked = !!item.featured;
    $('fDesc').value = item.desc || '';
    $('fTitleZh').value = item.titleZh || '';
    $('fCategoryZh').value = item.categoryZh || '';
    $('fDescZh').value = item.descZh || '';
    $('fBody').value = item.body || '';
    $('fBodyZh').value = item.bodyZh || '';
    $('fSrc').value = '';
    $('fFile').value = '';
    syncTypeUI();

    const banner = $('editBanner');
    banner.textContent = '✎ ' + t('msg_editing') + ' — ' + (item.title || item.id);
    banner.style.display = '';
    const submit = $('btnSubmit');
    submit.removeAttribute('data-i18n');
    submit.textContent = t('btn_save_changes');
    $('btnCancelEdit').style.display = '';
    if (banner.scrollIntoView) banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function exitEditMode() {
    editingId = null;
    fType.disabled = false;
    $('editBanner').style.display = 'none';
    const submit = $('btnSubmit');
    submit.setAttribute('data-i18n', 'btn_add');
    submit.textContent = t('btn_add');
    $('btnCancelEdit').style.display = 'none';
    $('entryForm').reset();
    $('fDate').value = new Date().toISOString().slice(0, 10);
    syncTypeUI();
  }

  $('btnCancelEdit').addEventListener('click', exitEditMode);

  function readAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
  }

  /* ---------- library list ---------- */
  async function refresh() {
    library = await loadContent();
    $('libCount').textContent = String(library.length).padStart(2, '0') + ' ' + t('items');

    const cats = new Set();
    library.forEach((it) => { if (it.category) cats.add(it.category); if (it.categoryZh) cats.add(it.categoryZh); });
    $('catList').innerHTML = [...cats].map((c) => `<option value="${esc(c)}">`).join('');

    const wrap = $('libList');
    wrap.innerHTML = library.length
      ? library.map((it, i) => `
          <div class="admin-item">
            <span class="idx">${String(i + 1).padStart(2, '0')}</span>
            <span class="tag ${it.featured ? 'accent' : ''}">${esc(typeLabel(it.type))}</span>
            <span class="t">
              <a href="entry.html?id=${encodeURIComponent(it.id)}">${esc(loc(it, 'title') || t('untitled'))}</a>
              ${it.titleZh ? '<span class="zh-flag" title="繁體中文">繁</span>' : ''}
            </span>
            <span class="d">${(it.media || []).length ? (it.media.length + ' ' + t('media_label')) + ' · ' : ''}${esc(it.date || '')}</span>
            <button class="edit" data-id="${esc(it.id)}">${esc(t('btn_edit'))}</button>
            <button class="del" data-id="${esc(it.id)}">${esc(t('del'))}</button>
          </div>`).join('')
      : `<div class="empty">${esc(t('empty_admin'))}</div>`;

    wrap.querySelectorAll('.edit').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = library.find((it) => it.id === btn.dataset.id);
        if (item) enterEditMode(item);
      });
    });

    wrap.querySelectorAll('.del').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm(t('confirm_del'))) return;
        if (editingId === btn.dataset.id) exitEditMode();
        if (await apiAvailable()) {
          await fetch('api/content?id=' + encodeURIComponent(btn.dataset.id), { method: 'DELETE' });
        } else {
          library = library.filter((it) => it.id !== btn.dataset.id);
          saveOverride(library);
        }
        refresh();
      });
    });
  }

  refresh();
})();
