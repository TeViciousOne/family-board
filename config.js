/*
 * Leave both values empty to run in demo mode (data stays in this browser only).
 * The anon / publishable key is meant to be public; the database rules in supabase/schema.sql protect the data.
 */
window.FB_CONFIG = {
  SUPABASE_URL: 'https://xmmhojvlzmteygxbspki.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_SXCJoFEZ047KMx2GApkE2A_YPmZFh-6',
  /* public key for phone notifications (the private half lives in the database, see supabase/push.sql) */
  VAPID_PUBLIC_KEY: 'BFtk8icNFrIWCY3iPY9leIi0nNOFkhHDYWJ4P1xZYrlZhDIMk6Mo-LgSoqgHhkXoTT0yF5y_XeQ4ZOUGaBwWLwE'
};
