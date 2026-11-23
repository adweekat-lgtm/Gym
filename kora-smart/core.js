/* كورة سمارت — shared rules used by both the demo store and the UI.
   The Supabase SQL (supabase/schema.sql) applies the same pricing and
   position rules on the server; keep the two in step when changing them. */
(function () {
  // Positions a team needs, by players per side.
  const FORMATIONS = {
    5: { GK: 1, DEF: 2, MID: 1, FWD: 1 },
    6: { GK: 1, DEF: 2, MID: 2, FWD: 1 },
    7: { GK: 1, DEF: 2, MID: 2, FWD: 2 },
    8: { GK: 1, DEF: 3, MID: 2, FWD: 2 },
    11: { GK: 1, DEF: 4, MID: 4, FWD: 2 },
  };
  const POSITIONS = ["GK", "DEF", "MID", "FWD"];
  const POSITION_NAMES = { GK: "حارس", DEF: "دفاع", MID: "وسط", FWD: "هجوم" };
  const TEAM_NAMES = { 1: "الفريق الأبيض", 2: "الفريق الأخضر" };

  const DEFAULT_SETTINGS = {
    stc_number: "",
    stc_name: "",
    hold_minutes: 15,
    referee_fee: 150,
    filming_fee: 300,
    live_fee: 100,
    clip_price: 15,
  };

  function capacity(format, position) {
    const f = FORMATIONS[format];
    return f && f[position] ? f[position] : 0;
  }

  // Match services are split evenly across every player on the pitch,
  // rounded up to a whole riyal; the personal clip is per player.
  function priceBreakdown(match, settings, clip) {
    const n = match.format * 2;
    const lines = [{ key: "pitch", label: "مكانك في المباراة", amount: Number(match.price) }];
    if (match.referee) lines.push({ key: "referee", label: "حصتك من الحكم", amount: Math.ceil(settings.referee_fee / n) });
    if (match.filming) lines.push({ key: "filming", label: "حصتك من التصوير والمونتاج", amount: Math.ceil(settings.filming_fee / n) });
    if (match.live) lines.push({ key: "live", label: "حصتك من البث المباشر", amount: Math.ceil(settings.live_fee / n) });
    if (clip) lines.push({ key: "clip", label: "مقطع خاص بلقطاتك", amount: Number(settings.clip_price) });
    const total = lines.reduce((s, l) => s + l.amount, 0);
    return { lines, total };
  }

  // Accepts 05XXXXXXXX, 5XXXXXXXX, +9665XXXXXXXX, 009665XXXXXXXX (spaces allowed).
  // Arabic-Indic digits are converted first. Returns "05XXXXXXXX" or null.
  function normalizePhone(raw) {
    if (!raw) return null;
    let s = String(raw)
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
      .replace(/[\s\-()]/g, "");
    if (s.startsWith("+966")) s = "0" + s.slice(4);
    else if (s.startsWith("00966")) s = "0" + s.slice(5);
    else if (s.startsWith("966")) s = "0" + s.slice(3);
    else if (s.startsWith("5") && s.length === 9) s = "0" + s;
    return /^05\d{8}$/.test(s) ? s : null;
  }

  function waNumber(phone05) {
    return "966" + phone05.slice(1);
  }

  // A booking holds its place while waiting for the transfer, while the
  // admin checks a reported transfer, and once confirmed.
  function isActive(b, now) {
    const t = now || Date.now();
    if (b.status === "paid" || b.status === "confirmed") return true;
    return b.status === "held" && new Date(b.expires_at).getTime() > t;
  }

  function effectiveStatus(b, now) {
    if (b.status === "held" && !isActive(b, now)) return "expired";
    return b.status;
  }

  const STATUS_NAMES = {
    held: "بانتظار التحويل",
    paid: "بانتظار تأكيد الإدارة",
    confirmed: "مؤكد",
    rejected: "مرفوض",
    expired: "انتهت مهلة التحويل",
    cancelled: "ملغي",
  };

  window.Kora = {
    FORMATIONS, POSITIONS, POSITION_NAMES, TEAM_NAMES, DEFAULT_SETTINGS, STATUS_NAMES,
    capacity, priceBreakdown, normalizePhone, waNumber, isActive, effectiveStatus,
  };
})();
