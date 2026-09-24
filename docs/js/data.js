/* ============================================================
   data.js — Data layer.
   Talks to the local server API when it exists; on static hosting
   (GitHub Pages) or offline files it falls back to the baked JSON
   in data/ plus a localStorage override for edits.

   Bilingual model — any text field may carry a 繁體中文 twin:
     title / titleZh · category / categoryZh · desc / descZh · body / bodyZh
   loc() picks the right one for the current language and quietly
   falls back to English when the twin is empty.
   ============================================================ */
(function (global) {
  'use strict';

  const LS_KEY = 'koyome_content_override';
  const LS_GB = 'koyome_guestbook';
  const LS_PROFILE = 'koyome_profile';
  const LS_HOBBIES = 'koyome_hobbies';

  /* Built-in seed (kept in sync with docs/data/content.json) */
  const SEED = [
    {
      id: 't1', type: 'text', title: 'Night Radio', category: 'Essays', date: '2026-09-12',
      featured: true, desc: 'A few lines written late at night.',
      titleZh: '深夜電台', categoryZh: '隨筆', descZh: '寫在深夜的幾行字。',
      body: 'The radio crackles in the small hours, like someone gently knocking on a door far away.\n\nI think everyone carries a lighthouse inside — dark most days, lighting up only on certain nights, for whoever happens to be passing.\n\n(This is a sample text entry. Open the Admin page to replace it with your own words.)',
      bodyZh: '凌晨的電台沙沙作響，像有人在很遠的地方輕輕敲門。\n\n我想每個人心裡都有一座燈塔——大部分日子是暗的，只在某些夜晚亮起來，給剛好路過的人看。\n\n（這是一則範例文字。到管理頁把它換成你自己的話吧。）',
    },
    {
      id: 'i1', type: 'image', title: 'Bloom · Line Study', category: 'Sketches', date: '2026-09-10',
      featured: true, desc: 'A geometric line illustration.',
      titleZh: '綻放 · 線條練習', categoryZh: '繪畫', descZh: '一張幾何線稿。',
      src: 'assets/seed-01.svg',
      media: [{ type: 'image', src: 'assets/seed-01.svg' }]
    },
    {
      id: 't2', type: 'text', title: 'About Koyome', category: 'About', date: '2026-09-01',
      featured: false, desc: 'What this little site is for.',
      titleZh: '關於 Koyome', categoryZh: '關於', descZh: '這個小站是為了什麼。',
      body: 'Koyome (koyome.me) is a small plot of internet to call my own:\n\n· keeping the words worth keeping\n· storing the pictures worth revisiting\n· archiving the videos worth watching again\n\nNo chasing trends — only collecting signals.',
      bodyZh: 'Koyome（koyome.me）是我在網路上的一小塊地：\n\n· 留下值得留下的字\n· 存放值得回頭看的圖\n· 收藏值得再看一次的影像\n\n不追什麼潮流——只是收集訊號。',
    },
    {
      id: 'v1', type: 'video', title: 'Sample Video (replace me)', category: 'Film', date: '2026-09-08',
      featured: true, desc: 'A demo of how video entries are displayed and played.',
      titleZh: '範例影片（請替換我）', categoryZh: '影像', descZh: '示範影片內容如何呈現與播放。',
      src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
      media: [{ type: 'video', src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4' }]
    }
  ];

  const GB_SEED = [
    { id: 'g1', name: 'koyome', text: 'welcome to the guestbook — leave a note ◡̈', date: '2026-09-19 19:00' }
  ];

  const PROFILE_SEED = {
    name: 'Koyome',
    nameZh: 'Koyome',
    tagline: 'welcome — make yourself at home.',
    taglineZh: '歡迎——就把這裡當成自己的家。',
    intro: "Koyome here — this is my own small corner of the internet.\n\nI keep the words worth re-reading, the pictures worth looking at twice, and the videos I don't want to forget. Nothing here is finished, and nothing here is in a hurry.\n\nHave a look around — stay as long as you like.",
    introZh: '我是 Koyome，這裡是我在網路上的一小塊地。\n\n值得重讀的文字、值得多看兩眼的畫面，還有不想忘記的影片，我都放在這裡。這裡的東西都還沒完成，也沒有任何東西在趕路。\n\n隨便逛逛——想待多久都可以。',
    avatar: 'assets/avatar.jpg',
    figNote: '',
    figNoteZh: '',
  };

  /* true when served over http(s) — but that alone doesn't mean the
     Node API exists (GitHub Pages is also http). apiAvailable()
     probes the API once and caches the answer. */
  const hasAPI = location.protocol.startsWith('http');
  let _api = null; /* null = not probed yet */

  async function tryApi(path) {
    try {
      const r = await fetch(path, { cache: 'no-store' });
      if (r.ok) { _api = true; return await r.json(); }
    } catch (_) { /* ignore */ }
    _api = false;
    return null;
  }

  async function apiAvailable() {
    if (_api !== null) return _api;
    if (!hasAPI) { _api = false; return _api; }
    await tryApi('api/content');
    return _api;
  }

  async function fetchJson(path) {
    try {
      const r = await fetch(path, { cache: 'no-store' });
      if (r.ok) return await r.json();
    } catch (_) { /* ignore */ }
    return null;
  }

  function readLS(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  /* ---------- localization helper ---------- */
  function loc(item, field) {
    if (!item) return '';
    const lang = global.I18N && global.I18N.lang;
    const zhVal = item[field + 'Zh'];
    if (lang === 'zh' && zhVal) return zhVal;
    /* 简体中文 derives from the 繁體中文 field at runtime — the *Zh fields
       stay the single Chinese source of truth, nothing is duplicated */
    if (lang === 'zhcn') return zhVal ? global.I18N.t2s(zhVal) : (item[field] || '');
    return item[field] || '';
  }

  /* ---------- content ---------- */
  async function loadContent() {
    if (hasAPI) {
      const viaApi = await tryApi('api/content');
      if (viaApi) return viaApi;
      /* static hosting (e.g. GitHub Pages): local edits win, then baked JSON */
      const local = readLS(LS_KEY);
      if (local) return normalizeAll(local);
      const baked = await fetchJson('data/content.json');
      if (baked) return normalizeAll(baked);
      return SEED.map((it) => ({ ...it }));
    }
    const local = readLS(LS_KEY);
    if (local) return normalizeAll(local);
    return SEED.map((it) => ({ ...it }));
  }

  function saveOverride(list) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch (_) { /* ignore */ }
  }

  /* ---------- profile (homepage) ---------- */
  async function loadProfile() {
    if (hasAPI) {
      const viaApi = await tryApi('api/profile');
      if (viaApi) return viaApi;
      const local = readLS(LS_PROFILE);
      if (local) return { ...PROFILE_SEED, ...local };
      const baked = await fetchJson('data/profile.json');
      if (baked) return { ...PROFILE_SEED, ...baked };
      return { ...PROFILE_SEED };
    }
    const local = readLS(LS_PROFILE);
    if (local) return { ...PROFILE_SEED, ...local };
    return { ...PROFILE_SEED };
  }

  function saveProfileOverride(profile) {
    try { localStorage.setItem(LS_PROFILE, JSON.stringify(profile)); } catch (_) { /* ignore */ }
  }

  /* ---------- guestbook ---------- */
  /* Shared cloud backend (Supabase PostgREST) — when configured it is
     THE guestbook for every visitor on every device, replacing the
     per-browser localStorage fallback. Config lives in gb-config.js. */
  function gbCloud() {
    const c = global.GB_CLOUD;
    return c && c.url && c.anonKey ? c : null;
  }

  async function loadGuestbookCloud() {
    const c = gbCloud();
    if (!c) return null;
    try {
      const r = await fetch(
        c.url.replace(/\/+$/, '') + '/rest/v1/guestbook?select=id,name,text,created_at&order=created_at.desc&limit=200',
        { headers: { apikey: c.anonKey, Authorization: 'Bearer ' + c.anonKey }, cache: 'no-store' }
      );
      if (!r.ok) return null;
      const rows = await r.json();
      if (!Array.isArray(rows)) return null;
      return rows.map((row) => ({
        id: 'sb' + row.id,
        name: row.name,
        text: row.text,
        /* cloud timestamps are UTC — show them in the visitor's local time */
        date: (() => {
          const d = new Date(row.created_at || '');
          if (isNaN(d)) return String(row.created_at || '').slice(0, 16).replace('T', ' ');
          const p = (n) => String(n).padStart(2, '0');
          return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
            ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
        })(),
      }));
    } catch (_) { return null; }
  }

  async function postGuestbookCloud(name, text) {
    const c = gbCloud();
    if (!c) return false;
    const r = await fetch(c.url.replace(/\/+$/, '') + '/rest/v1/guestbook', {
      method: 'POST',
      headers: {
        apikey: c.anonKey,
        Authorization: 'Bearer ' + c.anonKey,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ name, text }),
    });
    if (!r.ok) throw new Error('cloud post failed: ' + r.status);
    return true;
  }

  async function loadGuestbook() {
    if (hasAPI) {
      const cloud = await loadGuestbookCloud();
      if (cloud) return cloud;
      const viaApi = await tryApi('api/guestbook');
      if (viaApi) return viaApi;
      const local = readLS(LS_GB);
      if (local) return local;
      const baked = await fetchJson('data/guestbook.json');
      if (baked) return baked;
      return GB_SEED.map((it) => ({ ...it }));
    }
    const local = readLS(LS_GB);
    if (local) return local;
    return GB_SEED.map((it) => ({ ...it }));
  }

  function saveGuestbookOverride(list) {
    try { localStorage.setItem(LS_GB, JSON.stringify(list)); } catch (_) { /* ignore */ }
  }

  /* ---------- hobbies page ----------
     Fixed sections (anime / characters / galgame), each a free-form
     list of image + text items, plus chibi decoration slots (deco). */
  const HOBBIES_SEED = {
    intro: 'Anime I love, and the characters who stayed with me.',
    introZh: '喜歡的動漫，和那些留在我心裡的角色。',
    sections: [
      { id: 'anime', items: [] },
      { id: 'chars', items: [] },
      { id: 'galgame', items: [] },
    ],
    deco: [
      { id: 'd1', src: '' },
      { id: 'd2', src: '' },
      { id: 'd3', src: '' },
      { id: 'd4', src: '' },
      { id: 'd5', src: '' },
      { id: 'd6', src: '' },
    ],
  };

  function normalizeHobbies(doc) {
    const out = (doc && typeof doc === 'object') ? doc : {};
    if (!Array.isArray(out.sections)) out.sections = [];
    ['anime', 'chars', 'galgame'].forEach((sid) => {
      if (!out.sections.some((s) => s && s.id === sid)) out.sections.push({ id: sid, items: [] });
    });
    out.sections.forEach((s) => { if (!Array.isArray(s.items)) s.items = []; });
    if (!Array.isArray(out.deco)) out.deco = [];
    while (out.deco.length < 6) out.deco.push({ id: 'd' + (out.deco.length + 1), src: '' });
    return out;
  }

  async function loadHobbies() {
    const ok = (d) => d && Array.isArray(d.sections);
    if (hasAPI) {
      const viaApi = await tryApi('api/hobbies');
      if (ok(viaApi)) return normalizeHobbies(viaApi);
      /* static hosting (GitHub Pages): visitors are read-only, so a
         localStorage snapshot can only be STALE (a fossil from an old
         edit). The baked JSON always carries the newest uploads —
         it must win, otherwise freshly added pictures never reach the
         homepage TODAY'S PICKS pool. LS stays as the last resort. */
      const baked = await fetchJson('data/hobbies.json');
      if (ok(baked)) return normalizeHobbies(baked);
      const local = readLS(LS_HOBBIES);
      if (ok(local)) return normalizeHobbies(local);
      return normalizeHobbies(JSON.parse(JSON.stringify(HOBBIES_SEED)));
    }
    const local = readLS(LS_HOBBIES);
    if (ok(local)) return normalizeHobbies(local);
    return normalizeHobbies(JSON.parse(JSON.stringify(HOBBIES_SEED)));
  }

  function saveHobbiesOverride(doc) {
    try { localStorage.setItem(LS_HOBBIES, JSON.stringify(doc)); } catch (_) { /* ignore */ }
  }

  /* ---------- helpers ---------- */
  function normalize(item) {
    if (!Array.isArray(item.media)) {
      item.media = (item.type === 'image' || item.type === 'video') && item.src
        ? [{ type: item.type, src: item.src }]
        : [];
    }
    return item;
  }

  function normalizeAll(list) {
    return Array.isArray(list) ? list.map(normalize) : list;
  }

  function firstMedia(item) {
    if (Array.isArray(item.media) && item.media.length) return item.media[0];
    if ((item.type === 'image' || item.type === 'video') && item.src) {
      return { type: item.type, src: item.src };
    }
    return null;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* localized type label */
  function typeLabel(type) {
    const key = { text: 'type_text', image: 'type_image', video: 'type_video', audio: 'type_audio' }[type];
    return global.I18N ? global.I18N.t(key || 'type_entry') : type;
  }

  function excerpt(item, n) {
    const base = item.type === 'text' ? loc(item, 'body') : (loc(item, 'desc') || loc(item, 'title'));
    const plain = String(base).replace(/\s+/g, ' ').trim();
    return plain.length > n ? plain.slice(0, n) + '…' : plain;
  }

  global.Koyome = {
    loc, loadContent, saveOverride, normalize, normalizeAll, firstMedia,
    loadProfile, saveProfileOverride,
    loadGuestbook, saveGuestbookOverride,
    gbCloud, loadGuestbookCloud, postGuestbookCloud,
    loadHobbies, saveHobbiesOverride,
    escapeHtml, typeLabel, excerpt, hasAPI, apiAvailable,
    PROFILE_SEED,
  };
})(window);
