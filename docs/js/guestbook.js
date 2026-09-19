/* ============================================================
   guestbook.js — Guests leave notes; every note is visible to
   everyone (owner and visitors alike)
   ============================================================ */
(function () {
  'use strict';
  const { loadGuestbook, saveGuestbookOverride, escapeHtml, apiAvailable } = window.Koyome;
  const { t } = window.I18N;
  const esc = escapeHtml;
  const $ = (id) => document.getElementById(id);

  let messages = [];
  let canEdit = false; /* owner mode — deleting notes is an admin operation */

  function render() {
    $('gbCount').textContent = String(messages.length).padStart(2, '0') + ' ' + t('items');
    const list = $('gbList');
    list.innerHTML = messages.length
      ? messages.map((m) => `
          <div class="gb-item" data-id="${esc(m.id)}">
            <div class="gb-meta">
              <span class="gb-name">${esc(m.name)}</span>
              <span class="gb-date">${esc(m.date || '')}</span>
            </div>
            <div class="gb-text">${esc(m.text)}</div>
            ${canEdit ? `<button class="gb-del" data-id="${esc(m.id)}" title="${esc(t('del'))}">${esc(t('del'))}</button>` : ''}
          </div>`).join('')
      : `<div class="empty">${esc(t('gb_empty'))}</div>`;

    list.querySelectorAll('.gb-del').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm(t('confirm_gb_del'))) return;
        if (await apiAvailable()) {
          await fetch('api/guestbook?id=' + encodeURIComponent(btn.dataset.id), { method: 'DELETE' });
        } else {
          messages = messages.filter((m) => m.id !== btn.dataset.id);
          saveGuestbookOverride(messages);
        }
        refresh();
      });
    });
  }

  async function refresh() {
    messages = await loadGuestbook();
    try { canEdit = await apiAvailable(); } catch (_) { canEdit = false; }
    render();
  }

  $('gbForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('gbMsg');
    const name = $('gbName').value.trim();
    const text = $('gbText').value.trim();
    if (!name) { msg.textContent = t('msg_name'); return; }
    if (!text) { msg.textContent = t('msg_text'); return; }

    msg.textContent = t('gb_sending');
    const entry = {
      id: 'g' + Date.now().toString(36),
      name, text,
      date: new Date().toISOString().slice(0, 16).replace('T', ' '),
    };

    try {
      if (await apiAvailable()) {
        const r = await fetch('api/guestbook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, text }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'failed');
      } else {
        messages.unshift(entry);
        saveGuestbookOverride(messages);
      }
      msg.textContent = t('msg_gb_sent');
      $('gbForm').reset();
      refresh();
    } catch {
      msg.textContent = t('msg_gb_fail');
    }
  });

  refresh();
})();
