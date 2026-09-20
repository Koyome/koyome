/* ============================================================
   gb-config.js — Guestbook cloud backend (Supabase PostgREST).
   These are PUBLIC values by design: the anon key is meant to
   ship in browsers, and the table's row-level security allows
   only SELECT + INSERT — nobody can edit or delete messages
   through it. Fill both in once the Supabase project exists;
   while empty the site quietly uses its local fallbacks.
   ============================================================ */
window.GB_CLOUD = {
  url: 'https://hvywwgbzzqrwjrxiwfhx.supabase.co',
  anonKey: 'sb_publishable_szeepgUvtUbWYEV2Ii7UAA_YLGMHNp_',
};
