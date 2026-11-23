/* كورة سمارت — settings you edit before publishing.
   Leave supabaseUrl empty to run in demo mode (data stays on one device).
   Fill both Supabase values to go live — see README.md. The anon key is
   meant to be public: the database rules in supabase/schema.sql protect
   the data. Never put the service_role key here. */
window.KORA_CONFIG = {
  supabaseUrl: "",
  supabaseAnonKey: "",
  // Demo mode only: the admin code. Change it before sharing the link.
  demoAdminPin: "1234",
};
