/* ============================================================
   i18n.js — Language system: English (default) + 繁體中文
   Switch lives top-left · persisted in localStorage · full reload
   Every visible UI string lives in DICT below, so nothing is left
   untranslated. Content itself gets its own *Zh fields (see data.js).
   ============================================================ */
(function (global) {
  'use strict';

  const LS_LANG = 'koyome_lang';

  const DICT = {
    /* ---------------- English (default) ---------------- */
    en: {
      _html: 'en',
      title_home: 'Koyome · a quiet corner',
      title_catalog: 'Catalog · Koyome',
      title_admin: 'Admin · Koyome',
      title_guestbook: 'Guestbook · Koyome',
      title_entry: 'Entry · Koyome',

      nav_home: 'Home', nav_catalog: 'Catalog', nav_admin: 'Admin', nav_guestbook: 'Guestbook',
      nav_hobbies: 'Hobbies',
      menu_label: 'Pages', loader_word: 'ENTERING KOYOME...',
      home_title_suffix: ' · a quiet corner',
      footer: '© 2026 KOYOME. ALL RIGHTS RESERVED.', items: 'ITEMS',

      home_eyebrow: 'WELCOME',
      home_fig: 'FIG. 01 — KOYOME',

      sec_catalog: 'Catalog', sec_catalog_en: 'INDEX',
      catalog_intro: 'Everything I have kept so far, grouped by category. Click any title to open its own page.',
      cat_edit_hint: 'OWNER MODE — DOUBLE-CLICK ANY TITLE TO RENAME IT RIGHT HERE.',
      cat_edit_saved: '✓ renamed', cat_edit_fail: '✕ rename failed',

      title_hobbies: 'Hobbies · Koyome',
      hob_title: 'Hobbies', hob_en: 'THINGS I LOVE',
      hob_intro_fallback: 'Anime I love, and the characters who stayed with me.',
      hob_sec_anime: 'Favorite Anime', hob_sec_anime_en: 'FAVORITE ANIME',
      hob_sec_chars: 'Anime Characters', hob_sec_chars_en: 'CHARACTERS',
      hob_add_item: '+ ADD ONE', hob_name_ph: 'name it…', hob_text_ph: 'a few words about it…',
      hob_img_ph: 'click to upload an image',
      hob_empty_sec: 'Nothing here yet — add the first one below.',
      hob_empty_guest: 'Nothing here yet.',
      hob_deco_ph: '+ CHIBI', hob_deco_hint: 'chibi slot — click to place a cute character here',
      msg_hob_saved: '✓ Hobbies updated.', msg_hob_fail: 'Could not save, please try again.',
      confirm_hob_del: 'Remove this one?',
      home_catalog_more: 'OPEN FULL CATALOG',
      hh_title: 'Hobbies', hh_en: 'THINGS I LOVE',
      hh_intro: 'A corner for the anime and characters I love — come see if we share a favorite.',
      hh_go: 'BROWSE MY HOBBIES', hh_bridge: '— spot a favorite? come say hi —',
      hh_gb: 'LEAVE A NOTE',
      caption_label: 'CAPTION',
      caption_empty: 'double-click to describe this piece…',
      caption_edit_hint: 'OWNER MODE — DOUBLE-CLICK A TITLE, DESCRIPTION OR CAPTION TO EDIT IT IN PLACE.',
      msg_caption_saved: '✓ caption saved', msg_caption_fail: '✕ could not save',
      uncategorized: 'Uncategorized', no_content: 'No content yet',

      type_text: 'Text', type_image: 'Image', type_video: 'Video', type_entry: 'Entry',
      type_audio: 'Audio', media_track: 'TRACK', note_label: 'NOTE',
      untitled: 'Untitled', del: 'DELETE',

      back: '← Catalog',
      owner_tools: 'OWNER TOOLS',
      add_media: 'Add media to this entry — images, videos or MP3 tracks, as many as you like. Track covers are read from the file automatically, or picked by hand.',
      upload: 'UPLOAD', uploading: 'Uploading…',
      msg_media_saved: '✓ Media added.',
      msg_no_file: 'Choose at least one file first (image, video or MP3).',
      msg_media_fail: 'Upload failed, please try again.',
      cover_pick: 'CHOOSE COVER', cover_auto: '✓ embedded cover', cover_manual: '✓ custom cover',
      cover_reading: 'reading cover…', cover_none: 'no cover found — pick one',
      media_label: 'MEDIA',
      entry_not_found: 'Entry not found. It may have been deleted.',

      gb_title: 'Guestbook', gb_en: 'LEAVE A NOTE',
      gb_intro: 'Say something — every note is visible to everyone, me included.',
      gb_name: 'NAME', gb_msg: 'MESSAGE', gb_send: 'SEND', gb_sending: 'Sending…',
      gb_empty: 'No messages yet — be the first to say hi.',
      ph_name: 'your name', ph_msg: 'write something…',
      msg_gb_sent: '✓ Thanks for the note!',
      msg_gb_fail: 'Could not post the message, please try again.',
      gb_slow: 'Easy there — one note every 20 seconds.',
      confirm_gb_del: 'Delete this message?',
      msg_name: 'Please leave a name.', msg_text: 'Please write something first.',

      prof_title: 'Homepage', prof_en: 'PROFILE',
      prof_note: 'This is what visitors see first: your portrait, your welcome line and your self-introduction. Leave the 繁體中文 fields empty and the English text is shown instead.',
      f_avatar: 'PORTRAIT IMAGE',
      f_name: 'NAME', f_tagline: 'WELCOME LINE', f_intro: 'SELF INTRODUCTION',
      f_zh: '繁體中文 (OPTIONAL)', btn_save_prof: 'SAVE PROFILE',
      msg_prof_saved: '✓ Homepage updated.',
      ph_name_prof: 'Koyome', ph_tagline: 'welcome — make yourself at home.',
      ph_intro: 'Tell visitors who you are… blank line = new paragraph.',
      msg_prof_fail: 'Could not save, please try again.',

      admin_title: 'Content Manager', admin_import: 'IMPORT & MANAGE',
      admin_note: 'Insert text, images or videos here — they appear on the catalog the moment you submit.<br />· Images / videos: pick one or more local files (stored in <code>public/assets/</code>), or paste a direct media URL.<br />· More media can be added anytime on the entry page itself.<br />· Large files (&gt;150MB): drop them into <code>assets/</code> manually, then fill in <code>/assets/filename</code> under "Source URL".<br />· You can also edit <code>public/data/content.json</code> by hand — the result is the same.',
      f_type: 'TYPE', f_title: 'TITLE', f_category: 'CATEGORY', f_date: 'DATE',
      f_body: 'BODY', f_body_media: 'TEXT (OPTIONAL — ACCOMPANIES THE MEDIA)', f_files: 'UPLOAD FILES', f_src: 'OR SOURCE URL (OPTIONAL)',
      f_desc: 'DESCRIPTION (OPTIONAL, SHOWN ON CARDS)',
      f_featured: 'Mark as featured (shows a ★ on the entry page)',
      btn_add: 'ADD ENTRY', btn_reset: 'RESET',
      btn_edit: 'EDIT', btn_save_changes: 'SAVE CHANGES', btn_cancel_edit: 'CANCEL',
      msg_editing: 'Editing entry', msg_updated: '✓ Entry updated.',
      lib_title: 'Library', lib_en: 'COLLECTED',
      msg_saving: 'Saving…',
      msg_body_empty: 'Body text cannot be empty.',
      msg_no_media: 'Choose at least one file to upload, or provide a source URL.',
      msg_read_fail: 'Could not read the file, please try again.',
      msg_static_big: 'Static preview mode cannot store large files — run node server.js and try again.',
      msg_saved: '✓ Saved — visible in the catalog right away.',
      msg_submit_fail: 'Submit failed',
      empty_admin: 'The library is empty — add your first entry above.',
      confirm_del: 'Delete this entry?',
      ph_title: 'Name this entry', ph_category: 'e.g. Essays / Sketches / Film',
      ph_body: 'Write or paste the text you want to keep…',
      ph_title_zh: 'Title in Traditional Chinese (optional)',
      ph_category_zh: 'Category in Traditional Chinese (optional)',
      ph_desc_zh: 'Description in Traditional Chinese (optional)',
      ph_body_zh: 'Body text in Traditional Chinese (optional)',
      ph_tagline_zh: 'Welcome line in Traditional Chinese (optional)',
      ph_intro_zh: 'Self introduction in Traditional Chinese (optional)',
      ph_src: 'assets/xxx.jpg or https://...', ph_desc: 'One line about this entry',
      f_src_zh_note: 'Entries show the 繁體中文 version when the site is in 繁體中文 and the field is filled in.',
    },

    /* ---------------- 繁體中文 ---------------- */
    zh: {
      _html: 'zh-Hant',
      title_home: 'Koyome · 安靜的一角',
      title_catalog: '目錄 · Koyome',
      title_admin: '管理 · Koyome',
      title_guestbook: '留言板 · Koyome',
      title_entry: '內容 · Koyome',

      nav_home: '首頁', nav_catalog: '目錄', nav_admin: '管理', nav_guestbook: '留言板',
      nav_hobbies: '愛好',
      menu_label: '頁面', loader_word: '進入 KOYOME...',
      home_title_suffix: ' · 安靜的一角',
      footer: '© 2026 KOYOME. 版權所有。', items: '則',

      home_eyebrow: '歡迎',
      home_fig: '圖 01 — KOYOME',

      sec_catalog: '目錄', sec_catalog_en: 'INDEX',
      catalog_intro: '目前收藏的一切，依分類整理。點開任一標題，進入它自己的頁面。',
      cat_edit_hint: '站長模式——雙擊任一標題，即可直接在這裡改名。',
      cat_edit_saved: '✓ 已改名', cat_edit_fail: '✕ 改名失敗',

      title_hobbies: '愛好 · Koyome',
      hob_title: '愛好', hob_en: '我熱愛的事',
      hob_intro_fallback: '喜歡的動漫，和那些留在我心裡的角色。',
      hob_sec_anime: '喜歡的動漫', hob_sec_anime_en: 'FAVORITE ANIME',
      hob_sec_chars: '動漫角色', hob_sec_chars_en: 'CHARACTERS',
      hob_add_item: '+ 添加一個', hob_name_ph: '寫下名字……', hob_text_ph: '寫幾句介紹……',
      hob_img_ph: '點擊上傳圖片',
      hob_empty_sec: '還是空的——從下方添加第一個吧。',
      hob_empty_guest: '這裡還是空的。',
      hob_deco_ph: '+ Q版人物', hob_deco_hint: 'Q版裝飾位——點擊放一隻可愛角色在這裡',
      msg_hob_saved: '✓ 愛好已更新。', msg_hob_fail: '儲存失敗，請重試。',
      confirm_hob_del: '確定移除這一條嗎？',
      home_catalog_more: '打開完整目錄',
      hh_title: '愛好', hh_en: '我熱愛的事',
      hh_intro: '這裡放著我喜歡的動漫和角色——來看看我們是不是同好吧。',
      hh_go: '逛逛我的愛好', hh_bridge: '— 看到同好了嗎？來留言板聊兩句 —',
      hh_gb: '去留言板',
      caption_label: '描繪',
      caption_empty: '雙擊為這份素材寫段描繪……',
      caption_edit_hint: '站長模式——雙擊標題、簡介或描繪，即可直接修改。',
      msg_caption_saved: '✓ 描繪已儲存', msg_caption_fail: '✕ 儲存失敗',
      uncategorized: '未分類', no_content: '暫無內容',

      type_text: '文字', type_image: '圖片', type_video: '影片', type_entry: '內容',
      type_audio: '音訊', media_track: '曲目', note_label: '手記',
      untitled: '無標題', del: '刪除',

      back: '← 目錄',
      owner_tools: '站長工具',
      add_media: '為這條內容加入素材——圖片、影片或 MP3 音軌，數量不限。歌曲封面會自動從檔案讀取，也可以手動選擇。',
      upload: '上傳', uploading: '上傳中…',
      msg_media_saved: '✓ 素材已加入。',
      msg_no_file: '請先選擇至少一個檔案（圖片、影片或 MP3）。',
      msg_media_fail: '上傳失敗，請重試。',
      cover_pick: '選擇封面', cover_auto: '✓ 內嵌封面', cover_manual: '✓ 自訂封面',
      cover_reading: '讀取封面…', cover_none: '沒有封面——請選一張',
      media_label: '素材',
      entry_not_found: '找不到這條內容，可能已被刪除。',

      gb_title: '留言板', gb_en: '寫下隻字片語',
      gb_intro: '說點什麼吧——每一則留言，我和訪客都看得到。',
      gb_name: '暱稱', gb_msg: '留言內容', gb_send: '送出', gb_sending: '送出中…',
      gb_empty: '還沒有留言——成為第一個打招呼的人吧。',
      ph_name: '你的暱稱', ph_msg: '寫點什麼……',
      msg_gb_sent: '✓ 謝謝你的留言！',
      msg_gb_fail: '留言送出失敗，請重試。',
      gb_slow: '別急——每 20 秒可以留言一次。',
      confirm_gb_del: '確定刪除這則留言嗎？',
      msg_name: '請留下暱稱。', msg_text: '請先寫點什麼再送出。',

      prof_title: '首頁', prof_en: '個人資料',
      prof_note: '這是訪客最先看到的內容：你的形象圖、歡迎標語與自我介紹。繁體中文欄位留空時，會自動顯示英文版本。',
      f_avatar: '形象圖片',
      f_name: '名稱', f_tagline: '歡迎標語', f_intro: '自我介紹',
      f_zh: '繁體中文（可留空）', btn_save_prof: '儲存資料',
      msg_prof_saved: '✓ 首頁已更新。',
      ph_name_prof: 'Koyome', ph_tagline: '歡迎——就把這裡當成自己的家。',
      ph_intro: '向大家介紹一下你自己……空一行代表新段落。',
      msg_prof_fail: '儲存失敗，請重試。',

      admin_title: '內容管理', admin_import: '匯入與管理',
      admin_note: '在這裡插入文字、圖片或影片——提交後立即出現在目錄頁。<br />· 圖片／影片：可一次選擇多個本地檔案（存入 <code>public/assets/</code>），或直接貼上素材網址。<br />· 之後也可以隨時在內容頁裡繼續加入素材。<br />· 大檔案（&gt;150MB）建議直接放進 <code>assets/</code>，再於「素材網址」填 <code>/assets/檔名</code>。<br />· 也可以直接編輯 <code>public/data/content.json</code>，效果相同。',
      f_type: '類型', f_title: '標題', f_category: '分類', f_date: '日期',
      f_body: '正文', f_body_media: '文字描寫（可選——與素材相互呼應）', f_files: '上傳檔案', f_src: '或填素材網址（可選）',
      f_desc: '簡介（可選，顯示於列表）',
      f_featured: '設為精選（內容頁會顯示 ★）',
      btn_add: '收錄', btn_reset: '清空',
      btn_edit: '編輯', btn_save_changes: '儲存修改', btn_cancel_edit: '取消',
      msg_editing: '正在編輯', msg_updated: '✓ 內容已更新。',
      lib_title: '內容庫', lib_en: '已收錄',
      msg_saving: '儲存中…',
      msg_body_empty: '正文不能是空的。',
      msg_no_media: '請選擇至少一個檔案，或填寫素材網址。',
      msg_read_fail: '讀取檔案失敗，請重試。',
      msg_static_big: '靜態預覽模式存不下大檔案——請先執行 node server.js 再上傳。',
      msg_saved: '✓ 已收錄——目錄頁即刻可見。',
      msg_submit_fail: '提交失敗',
      empty_admin: '內容庫是空的——從上方表單收錄第一條吧。',
      confirm_del: '確定刪除這條內容嗎？',
      ph_title: '為這條內容起個名字', ph_category: '如：隨筆 / 繪畫 / 影像',
      ph_body: '在這裡寫下想收藏的文字……',
      ph_title_zh: '繁體中文標題（可留空）',
      ph_category_zh: '繁體中文分類（可留空）',
      ph_desc_zh: '繁體中文簡介（可留空）',
      ph_body_zh: '繁體中文正文（可留空）',
      ph_tagline_zh: '繁體中文歡迎標語（可留空）',
      ph_intro_zh: '繁體中文自我介紹（可留空）',
      ph_src: 'assets/xxx.jpg 或 https://...', ph_desc: '一句話說明這條內容',
      f_src_zh_note: '當網站切換到繁體中文、且此欄位有填寫時，內容會顯示繁體中文版本。',
    },
  };

  let lang = (() => {
    const saved = localStorage.getItem(LS_LANG);
    return saved === 'zh' ? 'zh' : 'en'; /* default: English */
  })();

  function t(key) {
    const d = DICT[lang] || DICT.en;
    return d[key] != null ? d[key] : (DICT.en[key] != null ? DICT.en[key] : key);
  }

  function applyStatic() {
    document.documentElement.lang = t('_html');
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-html]').forEach((el) => {
      el.innerHTML = t(el.dataset.i18nHtml);
    });
    document.querySelectorAll('[data-i18n-ph]').forEach((el) => {
      el.setAttribute('placeholder', t(el.dataset.i18nPh));
    });
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
      el.setAttribute('aria-label', t(el.dataset.i18nAria));
    });
    if (document.body && document.body.dataset.titleKey) {
      document.title = t(document.body.dataset.titleKey);
    }
  }

  function setLang(l) {
    if (l !== 'en' && l !== 'zh') return;
    localStorage.setItem(LS_LANG, l);
    location.reload();
  }

  /* bind the top-left switch (safe to call more than once) */
  function bind() {
    document.querySelectorAll('.lang-switch button').forEach((btn) => {
      if (btn.dataset.lang === lang) btn.classList.add('active');
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', () => setLang(btn.dataset.lang));
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    applyStatic();
    bind();
  });

  global.I18N = { t, applyStatic, bind, get lang() { return lang; } };
})(window);
