/* كورة سمارت — data layer.
   Two stores share one interface:
   - DemoStore keeps everything in this browser (localStorage). It is for
     trying the app before a Supabase project exists: players and admin must
     use the same device to see each other's bookings.
   - SupabaseStore talks to the database set up by supabase/schema.sql.
   Every method is async and throws an Error whose message is one of the
   codes in ERRORS (or a plain message). */
(function () {
  const K = window.Kora;

  const ERRORS = {
    match_closed: "المباراة ملغية أو غير موجودة",
    match_started: "المباراة بدأت، ما يمديك تحجز",
    bad_team: "اختر فريق",
    bad_position: "اختر مركز",
    bad_name: "اكتب اسمك (حرفين على الأقل)",
    bad_phone: "رقم الجوال لازم يكون مثل 05XXXXXXXX",
    slot_taken: "هالمكان انحجز للتو، اختر مكان ثاني",
    already_booked: "هالرقم عنده حجز في نفس المباراة",
    bad_ref: "اكتب اسم المحوّل أو آخر 4 أرقام من جواله",
    expired: "انتهت مهلة التحويل، احجز من جديد",
    bad_pin: "الرمز غير صحيح",
    not_admin: "هذا الحساب مو مسجّل كمدير",
  };

  function fail(code) {
    const e = new Error(ERRORS[code] || code);
    e.code = code;
    throw e;
  }

  // ------------------------------------------------------------ demo store

  const LS = {
    get(k, d) {
      try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (_) { return d; }
    },
    set(k, v) {
      try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* private mode: keep in memory */ }
      LS.mem[k] = v;
    },
    mem: {},
  };
  function lsGet(k, d) { return k in LS.mem ? LS.mem[k] : LS.get(k, d); }

  function uid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return "id-" + Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
  function newCode() {
    const a = new Uint8Array(4);
    crypto.getRandomValues(a);
    return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  }

  // Riyadh is UTC+3 all year.
  function riyadhAt(dayOffset, hh, mm) {
    const now = new Date();
    const r = new Date(now.getTime() + 3 * 3600e3);
    const d = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth(), r.getUTCDate() + dayOffset, hh - 3, mm));
    return d.toISOString();
  }

  function seedDemo() {
    const matches = [
      { pitch: "ملعب النخيل", area: "حي الملقا", d: 0, h: 23, m: 0, format: 6, price: 25, referee: true, filming: true, live: false },
      { pitch: "ملاعب الريان", area: "حي النرجس", d: 1, h: 21, m: 0, format: 5, price: 30, referee: false, filming: true, live: true },
      { pitch: "ملعب الصقر", area: "حي الياسمين", d: 1, h: 22, m: 30, format: 7, price: 20, referee: true, filming: false, live: false },
      { pitch: "ملعب الواحة", area: "حي العارض", d: 2, h: 20, m: 0, format: 5, price: 25, referee: false, filming: false, live: false },
    ].map((x) => ({
      id: uid(), pitch: x.pitch, area: x.area, map_url: "", starts_at: riyadhAt(x.d, x.h, x.m),
      duration_minutes: 60, format: x.format, price: x.price, referee: x.referee, filming: x.filming,
      live: x.live, youtube_url: "", status: "open", created_at: new Date().toISOString(),
    }));
    // A few confirmed players so the pitch does not look empty.
    const names = ["عبدالله", "فيصل", "سلطان", "تركي", "نواف", "ماجد", "بندر"];
    const picks = [[0, 1, "GK"], [0, 1, "DEF"], [0, 2, "MID"], [0, 2, "FWD"], [1, 1, "GK"], [1, 2, "DEF"], [2, 1, "MID"]];
    const far = new Date(Date.now() + 365 * 864e5).toISOString();
    const bookings = picks.map(([mi, team, position], i) => ({
      id: uid(), match_id: matches[mi].id, team, position, player_name: names[i],
      phone: "05000000" + String(10 + i), clip: false, amount: matches[mi].price, code: newCode(),
      status: "confirmed", payer_ref: "تجربة", expires_at: far, paid_at: null, created_at: new Date().toISOString(),
    }));
    LS.set("kora_matches", matches);
    LS.set("kora_bookings", bookings);
    LS.set("kora_settings", Object.assign({}, K.DEFAULT_SETTINGS, { stc_number: "0500000000", stc_name: "كورة سمارت (تجربة)" }));
    LS.set("kora_seeded", 1);
  }

  const DemoStore = {
    mode: "demo",
    _admin: false,

    async init(cfg) {
      this._pin = String(cfg.demoAdminPin || "1234");
      this._admin = sessionStorage.getItem("kora_demo_admin") === "1";
      if (!lsGet("kora_seeded", 0)) seedDemo();
    },
    _m() { return lsGet("kora_matches", []); },
    _b() { return lsGet("kora_bookings", []); },

    async getSettings() { return Object.assign({}, K.DEFAULT_SETTINGS, lsGet("kora_settings", {})); },

    async listMatches() {
      const now = Date.now(), b = this._b();
      return this._m()
        .filter((m) => m.status === "open" && new Date(m.starts_at).getTime() > now)
        .sort((a, z) => a.starts_at.localeCompare(z.starts_at))
        .map((m) => Object.assign({}, m, { taken: b.filter((x) => x.match_id === m.id && K.isActive(x, now)).length }));
    },

    async getMatch(id) {
      const m = this._m().find((x) => x.id === id);
      return m ? Object.assign({}, m) : null;
    },

    async getSlots(matchId) {
      const now = Date.now();
      return this._b().filter((x) => x.match_id === matchId && K.isActive(x, now)).map((x) => ({ team: x.team, position: x.position }));
    },

    async book({ matchId, team, position, name, phone, clip }) {
      const m = this._m().find((x) => x.id === matchId);
      const now = Date.now();
      if (!m || m.status !== "open") fail("match_closed");
      if (new Date(m.starts_at).getTime() <= now) fail("match_started");
      if (team !== 1 && team !== 2) fail("bad_team");
      if (!K.capacity(m.format, position)) fail("bad_position");
      const nm = String(name || "").trim();
      if (nm.length < 2 || nm.length > 40) fail("bad_name");
      if (!/^05\d{8}$/.test(phone || "")) fail("bad_phone");
      const all = this._b();
      const active = all.filter((x) => x.match_id === matchId && K.isActive(x, now));
      if (active.filter((x) => x.team === team && x.position === position).length >= K.capacity(m.format, position)) fail("slot_taken");
      if (active.some((x) => x.phone === phone)) fail("already_booked");
      const s = await this.getSettings();
      const amount = K.priceBreakdown(m, s, !!clip).total;
      const b = {
        id: uid(), match_id: matchId, team, position, player_name: nm, phone, clip: !!clip, amount,
        code: newCode(), status: "held", payer_ref: "", expires_at: new Date(now + s.hold_minutes * 60e3).toISOString(),
        paid_at: null, created_at: new Date().toISOString(),
      };
      all.push(b);
      LS.set("kora_bookings", all);
      return { code: b.code, amount, expires_at: b.expires_at, team, position };
    },

    async submitPayment(code, ref) {
      const r = String(ref || "").trim();
      if (r.length < 2 || r.length > 60) fail("bad_ref");
      const all = this._b();
      const b = all.find((x) => x.code === String(code).toUpperCase());
      if (!b || b.status !== "held" || !K.isActive(b)) fail("expired");
      b.status = "paid"; b.payer_ref = r; b.paid_at = new Date().toISOString();
      LS.set("kora_bookings", all);
    },

    async bookingStatus(codes) {
      const ms = this._m(), set = new Set(codes);
      return this._b()
        .filter((b) => set.has(b.code))
        .map((b) => ({
          code: b.code, status: K.effectiveStatus(b), amount: b.amount, team: b.team, position: b.position,
          clip: b.clip, player_name: b.player_name, expires_at: b.expires_at, match: ms.find((m) => m.id === b.match_id) || null,
        }))
        .sort((a, z) => (z.match ? z.match.starts_at : "").localeCompare(a.match ? a.match.starts_at : ""));
    },

    // ---- admin
    async isAdmin() { return this._admin; },
    async login(_email, secret) {
      if (String(secret) !== this._pin) fail("bad_pin");
      this._admin = true;
      sessionStorage.setItem("kora_demo_admin", "1");
    },
    async logout() { this._admin = false; sessionStorage.removeItem("kora_demo_admin"); },
    _needAdmin() { if (!this._admin) fail("not_admin"); },

    async adminBookings() {
      this._needAdmin();
      const ms = this._m();
      return this._b()
        .map((b) => Object.assign({}, b, { match: ms.find((m) => m.id === b.match_id) || null }))
        .sort((a, z) => z.created_at.localeCompare(a.created_at));
    },
    async adminMatches() {
      this._needAdmin();
      const b = this._b(), now = Date.now();
      return this._m()
        .map((m) => Object.assign({}, m, { taken: b.filter((x) => x.match_id === m.id && K.isActive(x, now)).length }))
        .sort((a, z) => z.starts_at.localeCompare(a.starts_at));
    },
    async setBookingStatus(id, status) {
      this._needAdmin();
      const all = this._b(), b = all.find((x) => x.id === id);
      if (b) { b.status = status; LS.set("kora_bookings", all); }
    },
    async saveMatch(m) {
      this._needAdmin();
      const all = this._m();
      if (m.id) {
        const i = all.findIndex((x) => x.id === m.id);
        if (i >= 0) all[i] = Object.assign({}, all[i], m);
      } else {
        all.push(Object.assign({ id: uid(), status: "open", youtube_url: "", map_url: "", duration_minutes: 60, created_at: new Date().toISOString() }, m));
      }
      LS.set("kora_matches", all);
    },
    async saveSettings(s) {
      this._needAdmin();
      LS.set("kora_settings", Object.assign({}, await this.getSettings(), s));
    },
    async resetDemo() { seedDemo(); },
  };

  // ------------------------------------------------------------ supabase store

  function sbError(error) {
    const msg = (error && (error.message || error.details)) || "تعذّر الاتصال";
    const code = Object.keys(ERRORS).find((k) => msg.includes(k));
    fail(code || msg);
  }

  const SupabaseStore = {
    mode: "supabase",

    async init(cfg) {
      await new Promise((ok, no) => {
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";
        s.onload = ok;
        s.onerror = () => no(new Error("تعذّر تحميل مكتبة Supabase"));
        document.head.appendChild(s);
      });
      this.sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    },

    async _rpc(fn, args) {
      const { data, error } = await this.sb.rpc(fn, args || {});
      if (error) sbError(error);
      return data;
    },

    async getSettings() {
      const { data, error } = await this.sb.from("settings").select("*").eq("id", 1).maybeSingle();
      if (error) sbError(error);
      return Object.assign({}, K.DEFAULT_SETTINGS, data || {});
    },
    async listMatches() { return (await this._rpc("match_list")) || []; },
    async getMatch(id) {
      const { data, error } = await this.sb.from("matches").select("*").eq("id", id).maybeSingle();
      if (error) sbError(error);
      return data;
    },
    async getSlots(matchId) { return (await this._rpc("match_slots", { p_match: matchId })) || []; },
    async book({ matchId, team, position, name, phone, clip }) {
      return this._rpc("book_slot", { p_match: matchId, p_team: team, p_position: position, p_name: name, p_phone: phone, p_clip: !!clip });
    },
    async submitPayment(code, ref) { await this._rpc("submit_payment", { p_code: code, p_ref: ref }); },
    async bookingStatus(codes) { return codes.length ? (await this._rpc("booking_status", { p_codes: codes })) || [] : []; },

    // ---- admin
    async isAdmin() {
      const { data } = await this.sb.auth.getSession();
      if (!data.session) return false;
      const { data: row } = await this.sb.from("admins").select("user_id").eq("user_id", data.session.user.id).maybeSingle();
      return !!row;
    },
    async login(email, password) {
      const { error } = await this.sb.auth.signInWithPassword({ email, password });
      if (error) fail("البريد أو كلمة المرور غير صحيحة");
      if (!(await this.isAdmin())) { await this.sb.auth.signOut(); fail("not_admin"); }
    },
    async logout() { await this.sb.auth.signOut(); },
    async adminBookings() {
      const { data, error } = await this.sb.from("bookings").select("*, match:matches(*)").order("created_at", { ascending: false }).limit(500);
      if (error) sbError(error);
      return data;
    },
    async adminMatches() {
      const { data, error } = await this.sb.from("matches").select("*, bookings(status, expires_at)").order("starts_at", { ascending: false }).limit(200);
      if (error) sbError(error);
      const now = Date.now();
      return data.map((m) => {
        const taken = (m.bookings || []).filter((b) => K.isActive(b, now)).length;
        delete m.bookings;
        return Object.assign(m, { taken });
      });
    },
    async setBookingStatus(id, status) {
      const { error } = await this.sb.from("bookings").update({ status }).eq("id", id);
      if (error) sbError(error);
    },
    async saveMatch(m) {
      const row = Object.assign({}, m);
      delete row.taken;
      const q = row.id ? this.sb.from("matches").update(row).eq("id", row.id) : this.sb.from("matches").insert(row);
      const { error } = await q;
      if (error) sbError(error);
    },
    async saveSettings(s) {
      const { error } = await this.sb.from("settings").update(s).eq("id", 1);
      if (error) sbError(error);
    },
  };

  window.KoraStore = {
    ERRORS,
    async create(cfg) {
      const useSb = cfg && cfg.supabaseUrl && cfg.supabaseAnonKey;
      const store = useSb ? SupabaseStore : DemoStore;
      await store.init(cfg || {});
      return store;
    },
  };
})();
