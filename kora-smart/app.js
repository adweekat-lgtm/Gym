/* كورة سمارت — UI. Hash routes:
   #/                 upcoming matches
   #/m/<id>           one match: pick a free place on the pitch
   #/pay/<code>       STC transfer instructions and booking status
   #/mine             this device's bookings
   #/admin[/<tab>]    admin: transfers · matches · settings
   #/admin/match/<id> roster · #/admin/new · #/admin/edit/<id> */
(function () {
  const K = window.Kora;
  const view = document.getElementById("view");
  let store = null;
  let settings = Object.assign({}, K.DEFAULT_SETTINGS);
  let timers = [];
  const justConfirmed = new Map(); // booking id -> booking, for the "notify on WhatsApp" list

  // ------------------------------------------------------------ helpers

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const riyal = (n) => `${Number(n).toLocaleString("en-US")} ريال`;

  const TZ = "Asia/Riyadh";
  const fDay = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
  const fTime = new Intl.DateTimeFormat("ar-SA-u-nu-latn", { hour: "numeric", minute: "2-digit", timeZone: TZ });
  const dayKey = (t) => new Date(new Date(t).getTime() + 3 * 3600e3).toISOString().slice(0, 10);
  function dayLabel(iso) {
    const k = dayKey(iso), today = dayKey(Date.now()), tmr = dayKey(Date.now() + 864e5);
    if (k === today) return "اليوم";
    if (k === tmr) return "بكرة";
    return fDay.format(new Date(iso));
  }
  const when = (iso) => `${dayLabel(iso)} · ${fTime.format(new Date(iso))}`;
  const whenLong = (iso) => `${fDay.format(new Date(iso))} · ${fTime.format(new Date(iso))}`;

  function toast(msg) {
    const t = document.createElement("div");
    t.className = "toast";
    t.setAttribute("role", "status");
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }

  function later(fn, ms) { const id = setInterval(fn, ms); timers.push(id); return id; }
  function clearTimers() { timers.forEach(clearInterval); timers = []; }

  function myCodes() { try { return JSON.parse(localStorage.getItem("kora_my_codes") || "[]"); } catch (_) { return []; } }
  function addMyCode(c) { const a = myCodes().filter((x) => x !== c); a.unshift(c); try { localStorage.setItem("kora_my_codes", JSON.stringify(a.slice(0, 50))); } catch (_) {} }
  function me() { try { return JSON.parse(localStorage.getItem("kora_me") || "{}"); } catch (_) { return {}; } }
  function saveMe(o) { try { localStorage.setItem("kora_me", JSON.stringify(o)); } catch (_) {} }

  function wa(phone, text) { return `https://wa.me/${K.waNumber(phone)}?text=${encodeURIComponent(text)}`; }
  const statusPill = (s) => `<span class="status s-${esc(s)}">${esc(K.STATUS_NAMES[s] || s)}</span>`;
  const posName = (p) => K.POSITION_NAMES[p] || p;
  const teamName = (t) => K.TEAM_NAMES[t] || "";

  function serviceTags(m) {
    const t = [];
    if (m.referee) t.push(`<span class="tag on">حكم</span>`);
    if (m.filming) t.push(`<span class="tag on">تصوير ومونتاج</span>`);
    if (m.live) t.push(`<span class="tag live">بث مباشر</span>`);
    if (!t.length) t.push(`<span class="tag">بدون خدمات إضافية</span>`);
    return t.join("");
  }

  function sheet(html) {
    const scrim = document.createElement("div");
    scrim.className = "scrim";
    scrim.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
    const close = () => { scrim.remove(); document.removeEventListener("keydown", onKey); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    scrim.addEventListener("click", (e) => { if (e.target === scrim) close(); });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(scrim);
    const first = scrim.querySelector("input,button");
    if (first) setTimeout(() => first.focus(), 50);
    return { el: scrim.firstChild, close };
  }

  function setTab(name) {
    $$("nav.tabs a").forEach((a) => {
      if (a.dataset.tab === name) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }

  const demoNote = () => store.mode === "demo"
    ? `<div class="demo"><b>وضع تجريبي:</b> البيانات محفوظة على هذا الجهاز بس. عشان يشوف اللاعبين والإدارة نفس الحجوزات من أجهزة مختلفة، اربط Supabase (الخطوات في README).</div>`
    : "";

  // ------------------------------------------------------------ pitch drawing

  const TEAM_FILL = { 1: "#f2f5f3", 2: "#3ccf7d" };
  // y for each line, bottom team (1) attacks upward; top team (2) mirrors it.
  const ROW_Y = { 1: { GK: 488, DEF: 424, MID: 360, FWD: 300 }, 2: { GK: 32, DEF: 96, MID: 160, FWD: 220 } };

  function pitchSvg(m, slots, selected) {
    const W = 360, H = 520;
    const takenCount = {};
    slots.forEach((s) => { const k = s.team + s.position; takenCount[k] = (takenCount[k] || 0) + 1; });
    const f = K.FORMATIONS[m.format] || K.FORMATIONS[5];
    let marks = "";
    [2, 1].forEach((team) => {
      K.POSITIONS.forEach((pos) => {
        const n = f[pos] || 0;
        const taken = takenCount[team + pos] || 0;
        for (let i = 0; i < n; i++) {
          const x = (W * (i + 1)) / (n + 1), y = ROW_Y[team][pos];
          const isTaken = i < taken;
          const isSel = selected && selected.team === team && selected.position === pos && !isTaken && i === taken;
          const label = `${teamName(team)} · ${posName(pos)}${isTaken ? " · محجوز" : " · فاضي"}`;
          if (isTaken) {
            marks += `<g aria-label="${esc(label)}" role="img"><circle cx="${x}" cy="${y}" r="17" fill="${TEAM_FILL[team]}" fill-opacity=".9"/><path d="M${x - 6} ${y + 1}l4 4 8-9" stroke="#0b1410" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><text x="${x}" y="${y + 33}" text-anchor="middle" font-size="11" fill="rgba(255,255,255,.55)">محجوز</text></g>`;
          } else {
            marks += `<g class="slot" role="button" tabindex="0" aria-label="${esc(label)}، اضغط للحجز" data-team="${team}" data-pos="${pos}">`
              + `<circle cx="${x}" cy="${y}" r="24" fill="transparent"/>`
              + `<circle class="ring" cx="${x}" cy="${y}" r="17" fill="${isSel ? "#c8f23a" : "rgba(200,242,58,.08)"}" stroke="#c8f23a" stroke-width="2" ${isSel ? "" : 'stroke-dasharray="4 3"'}/>`
              + `<text x="${x}" y="${y + 6}" text-anchor="middle" font-size="18" font-weight="800" fill="${isSel ? "#142000" : "#c8f23a"}">+</text>`
              + `<text x="${x}" y="${y + 33}" text-anchor="middle" font-size="12" font-weight="700" fill="#eef5f0">${esc(posName(pos))}</text></g>`;
          }
        }
      });
    });
    const stripes = Array.from({ length: 8 }, (_, i) => `<rect x="0" y="${i * 65}" width="${W}" height="65" fill="${i % 2 ? "#153824" : "#12301f"}"/>`).join("");
    const c = "rgba(255,255,255,.5)";
    return `<svg class="pitch" viewBox="0 0 ${W} ${H}" role="group" aria-label="الملعب: اختر مكان فاضي">
      ${stripes}
      <g fill="none" stroke="${c}" stroke-width="2">
        <rect x="10" y="10" width="${W - 20}" height="${H - 20}" rx="4"/>
        <line x1="10" y1="${H / 2}" x2="${W - 10}" y2="${H / 2}"/>
        <circle cx="${W / 2}" cy="${H / 2}" r="44"/>
        <rect x="${W / 2 - 80}" y="10" width="160" height="62"/><rect x="${W / 2 - 80}" y="${H - 72}" width="160" height="62"/>
        <rect x="${W / 2 - 36}" y="2" width="72" height="8"/><rect x="${W / 2 - 36}" y="${H - 10}" width="72" height="8"/>
      </g>
      <circle cx="${W / 2}" cy="${H / 2}" r="3" fill="${c}"/>
      <text x="${W - 62}" y="${H / 2 - 10}" text-anchor="middle" font-size="12" font-weight="700" fill="#3ccf7d">${esc(teamName(2))}</text>
      <text x="${W - 62}" y="${H / 2 + 22}" text-anchor="middle" font-size="12" font-weight="700" fill="#f2f5f3">${esc(teamName(1))}</text>
      ${marks}
    </svg>`;
  }

  // ------------------------------------------------------------ screens

  async function home(filter) {
    setTab("home");
    view.innerHTML = `<h1>المباريات الجاية</h1><p class="sub">احجز مكانك بنفسك، ما تحتاج فريق.</p><div class="card empty">جاري التحميل…</div>`;
    const list = await store.listMatches();
    const days = [];
    list.forEach((m) => { const k = dayKey(m.starts_at); if (!days.includes(k)) days.push(k); });
    const f = filter && days.includes(filter) ? filter : "all";
    const shown = f === "all" ? list : list.filter((m) => dayKey(m.starts_at) === f);
    const chip = (k, label) => `<button class="chip" data-day="${k}" aria-pressed="${k === f}">${esc(label)}</button>`;
    view.innerHTML = `
      <h1>المباريات الجاية</h1>
      <p class="sub">احجز مكانك بنفسك، ما تحتاج فريق.</p>
      ${demoNote()}
      <div class="chips" role="group" aria-label="اليوم">${chip("all", "الكل")}${days.map((k) => chip(k, dayLabel(list.find((m) => dayKey(m.starts_at) === k).starts_at))).join("")}</div>
      ${shown.length ? shown.map(matchCard).join("") : `<div class="card empty"><b>ما فيه مباريات حاليًا</b>ارجع بعدين، أو تابعنا عشان تعرف أول ما تنزل مباراة جديدة.</div>`}`;
    $$(".chip", view).forEach((b) => b.addEventListener("click", () => home(b.dataset.day)));
  }

  function matchCard(m) {
    const total = m.format * 2, taken = Number(m.taken || 0), left = total - taken;
    const per = K.priceBreakdown(m, settings, false).total;
    return `<a class="card match" href="#/m/${esc(m.id)}">
      <div class="mhead">
        <div><p class="mtitle">${esc(m.pitch)}</p><div class="mwhen">${esc(when(m.starts_at))}</div><div class="mwhere">${esc(m.area)} · ${m.format} ضد ${m.format}</div></div>
        <div class="price"><b>${per}</b><span>ريال للاعب</span></div>
      </div>
      <div class="tags">${serviceTags(m)}</div>
      <div class="fill"><div class="bar"><i style="width:${Math.round((taken / total) * 100)}%"></i></div>${left > 0 ? `باقي ${left} من ${total}` : "مكتملة"}</div>
    </a>`;
  }

  async function matchView(id, selected) {
    setTab("home");
    const [m, slots] = await Promise.all([store.getMatch(id), store.getSlots(id)]);
    if (!m || m.status !== "open" || new Date(m.starts_at).getTime() <= Date.now()) {
      view.innerHTML = `<div class="card empty"><b>المباراة مو متاحة</b>ممكن انلغت أو بدأت.<br><br><a href="#/">ارجع للمباريات</a></div>`;
      return;
    }
    const total = m.format * 2, left = total - slots.length;
    const per = K.priceBreakdown(m, settings, false);
    view.innerHTML = `
      <p><a href="#/">→ كل المباريات</a></p>
      <h1>${esc(m.pitch)}</h1>
      <p class="sub"><b style="color:var(--acc)">${esc(whenLong(m.starts_at))}</b><br>${esc(m.area)} · ${m.format} ضد ${m.format} · ${Number(m.duration_minutes || 60)} دقيقة${m.map_url ? ` · <a href="${esc(m.map_url)}" target="_blank" rel="noopener">الموقع على الخريطة</a>` : ""}</p>
      <div class="tags">${serviceTags(m)}</div>
      <div class="fill"><div class="bar"><i style="width:${Math.round(((total - left) / total) * 100)}%"></i></div>${left > 0 ? `باقي ${left} من ${total}` : "مكتملة"}</div>
      <h2>${left > 0 ? "اضغط على مكان فاضي عشان تحجزه" : "المباراة مكتملة"}</h2>
      <div class="pitchwrap">${pitchSvg(m, slots, selected)}</div>
      <div class="legend"><span><i style="border:2px dashed #c8f23a"></i>فاضي</span><span><i style="background:#f2f5f3"></i>${esc(teamName(1))}</span><span><i style="background:#3ccf7d"></i>${esc(teamName(2))}</span></div>
      <div class="card" style="margin-top:16px">
        <b>سعر اللاعب: ${riyal(per.total)}</b>
        <div class="lines">${per.lines.map((l) => `<div><span>${esc(l.label)}</span><span>${riyal(l.amount)}</span></div>`).join("")}</div>
        <small style="color:var(--mut)">${m.filming ? "المباراة مصوّرة، والفيديو يوصلك على واتساب بعد المونتاج. تقدر تضيف مقطع خاص بلقطاتك وقت الحجز." : "تقدر تطلب حكم أو تصوير للمباريات الجاية من الإدارة."}${m.live ? " والمباراة تنبث مباشرة على يوتيوب." : ""}</small>
      </div>`;
    $$(".slot", view).forEach((g) => {
      const pick = () => openBooking(m, Number(g.dataset.team), g.dataset.pos);
      g.addEventListener("click", pick);
      g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
    });
  }

  function openBooking(m, team, position) {
    const saved = me();
    const sh = sheet(`
      <h2 style="margin-top:4px">احجز مكانك</h2>
      <p class="sub">${esc(m.pitch)} · ${esc(when(m.starts_at))}<br><b style="color:var(--ink)">${esc(teamName(team))} · ${esc(posName(position))}</b></p>
      <form novalidate>
        <label class="f"><span>اسمك</span><input type="text" name="name" autocomplete="given-name" maxlength="40" required value="${esc(saved.name || "")}"></label>
        <label class="f"><span>رقم جوالك (واتساب)</span><input type="tel" name="phone" inputmode="tel" autocomplete="tel" placeholder="05XXXXXXXX" dir="ltr" style="text-align:right" required value="${esc(saved.phone || "")}"></label>
        ${m.filming ? `<label class="check"><input type="checkbox" name="clip"><span><b>مقطع خاص بلقطاتك (+${riyal(settings.clip_price)})</b><small>نقص لك أهدافك ولقطاتك من فيديو المباراة ونرسله لك.</small></span></label>` : ""}
        <div class="lines" id="lines"></div>
        <p class="err" id="err" role="alert"></p>
        <button class="btn" type="submit" id="go">احجز</button>
        <p class="sub" style="font-size:13px;margin-top:10px;text-align:center">بعدها تحوّل المبلغ على STC، ومكانك محجوز لك ${Number(settings.hold_minutes)} دقيقة.</p>
      </form>`);
    const form = $("form", sh.el), lines = $("#lines", sh.el), go = $("#go", sh.el), err = $("#err", sh.el);
    const render = () => {
      const clip = !!(form.clip && form.clip.checked);
      const p = K.priceBreakdown(m, settings, clip);
      lines.innerHTML = p.lines.map((l) => `<div><span>${esc(l.label)}</span><span>${riyal(l.amount)}</span></div>`).join("") + `<div class="t"><span>المجموع</span><span>${riyal(p.total)}</span></div>`;
      go.textContent = `احجز · ${riyal(p.total)}`;
    };
    if (form.clip) form.clip.addEventListener("change", render);
    render();
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      err.textContent = "";
      const name = form.name.value.trim();
      const phone = K.normalizePhone(form.phone.value);
      if (name.length < 2) { err.textContent = window.KoraStore.ERRORS.bad_name; form.name.focus(); return; }
      if (!phone) { err.textContent = window.KoraStore.ERRORS.bad_phone; form.phone.focus(); return; }
      go.disabled = true;
      try {
        const r = await store.book({ matchId: m.id, team, position, name, phone, clip: !!(form.clip && form.clip.checked) });
        saveMe({ name, phone });
        addMyCode(r.code);
        sh.close();
        location.hash = `#/pay/${r.code}`;
      } catch (ex) {
        err.textContent = ex.message;
        go.disabled = false;
        if (ex.code === "slot_taken") { sh.close(); toast(ex.message); matchView(m.id); }
      }
    });
  }

  async function payView(code) {
    setTab("mine");
    const [b] = await store.bookingStatus([code]);
    if (!b) { view.innerHTML = `<div class="card empty"><b>ما لقينا الحجز</b><a href="#/mine">حجوزاتي</a></div>`; return; }
    const m = b.match || {};
    const head = `
      <p><a href="#/mine">→ حجوزاتي</a></p>
      <h1>${esc(m.pitch || "")}</h1>
      <p class="sub">${esc(m.starts_at ? whenLong(m.starts_at) : "")}<br>${esc(teamName(b.team))} · ${esc(posName(b.position))} · ${esc(b.player_name)}</p>`;

    if (b.status === "held") {
      const hasNumber = !!String(settings.stc_number || "").trim();
      view.innerHTML = head + `
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">${statusPill("held")}<span>باقي <span class="timer" id="timer">--:--</span></span></div>
          <p class="amount" style="margin-top:10px">${Number(b.amount)} <small>ريال</small></p>
          ${hasNumber ? `
          <p class="sub" style="margin:0">حوّل المبلغ على STC للرقم:</p>
          <div class="copy"><b id="num">${esc(settings.stc_number)}</b><button class="btn small sec" id="cp" type="button">نسخ الرقم</button></div>
          ${settings.stc_name ? `<p class="sub" style="margin:0 0 6px">باسم: <b style="color:var(--ink)">${esc(settings.stc_name)}</b></p>` : ""}` : `<p class="err">رقم التحويل لسه ما انضاف. تواصل مع الإدارة.</p>`}
          <ol class="steps">
            <li>افتح تطبيق STC وحوّل <b style="color:var(--ink)">${Number(b.amount)} ريال</b> بالضبط.</li>
            <li>اكتب تحت اسمك اللي يطلع في التحويل، أو آخر 4 أرقام من الجوال اللي حوّلت منه.</li>
            <li>اضغط "حوّلت"، والإدارة تأكد حجزك أول ما يوصل المبلغ.</li>
          </ol>
          <form novalidate>
            <label class="f"><span>اسم المحوّل أو آخر 4 أرقام</span><input type="text" name="ref" maxlength="60" required></label>
            <p class="err" id="err" role="alert"></p>
            <button class="btn" type="submit" id="go">حوّلت</button>
          </form>
          <p class="sub" style="font-size:13px;margin:10px 0 0">رمز حجزك: <span class="code">${esc(b.code)}</span></p>
        </div>`;
      const cp = $("#cp");
      if (cp) cp.addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(settings.stc_number); toast("انتسخ الرقم"); } catch (_) { toast(settings.stc_number); }
      });
      const tEl = $("#timer"), end = new Date(b.expires_at).getTime();
      const tick = () => {
        const s = Math.max(0, Math.round((end - Date.now()) / 1000));
        tEl.textContent = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
        if (s === 0) { clearTimers(); payView(code); }
      };
      tick(); later(tick, 1000);
      const form = $("form", view);
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const err = $("#err"), go = $("#go");
        err.textContent = "";
        go.disabled = true;
        try { await store.submitPayment(code, form.ref.value); clearTimers(); payView(code); }
        catch (ex) { err.textContent = ex.message; go.disabled = false; if (ex.code === "expired") { clearTimers(); payView(code); } }
      });
      return;
    }

    let body = "";
    if (b.status === "paid") {
      body = `<div class="card">${statusPill("paid")}<p class="amount" style="margin-top:10px">${Number(b.amount)} <small>ريال</small></p>
        <p class="sub">وصلنا إنك حوّلت. أول ما نشوف المبلغ نأكد حجزك، وهالصفحة تتحدث لحالها.</p></div>`;
      later(async () => { const [x] = await store.bookingStatus([code]); if (x && x.status !== "paid") { clearTimers(); payView(code); } }, 20000);
    } else if (b.status === "confirmed") {
      body = `<div class="card">${statusPill("confirmed")}
        <h2 style="margin-top:12px">مكانك مضمون</h2>
        <dl class="kv"><dt>الفريق</dt><dd>${esc(teamName(b.team))}</dd><dt>المركز</dt><dd>${esc(posName(b.position))}</dd><dt>المدفوع</dt><dd>${riyal(b.amount)}</dd>${b.clip ? `<dt>مقطعك</dt><dd>يوصلك على واتساب بعد المباراة</dd>` : ""}</dl>
        <p class="sub">${m.filming ? "فيديو المباراة يوصلك على واتساب بعد المونتاج." : ""} تعال قبل المباراة بـ 10 دقايق.</p>
        ${m.map_url ? `<a class="btn sec" href="${esc(m.map_url)}" target="_blank" rel="noopener">الموقع على الخريطة</a>` : ""}
        ${m.live && m.youtube_url ? `<a class="btn sec" style="margin-top:8px" href="${esc(m.youtube_url)}" target="_blank" rel="noopener">البث المباشر على يوتيوب</a>` : ""}
      </div>`;
    } else {
      const msg = { expired: "خلصت مهلة التحويل وانفك الحجز. لو المكان لسه فاضي تقدر تحجزه من جديد.", rejected: "ما وصلنا التحويل، فانرفض الحجز. لو حوّلت فعلًا تواصل مع الإدارة.", cancelled: "انلغى هالحجز." }[b.status] || "";
      body = `<div class="card">${statusPill(b.status)}<p class="sub" style="margin-top:10px">${esc(msg)}</p>${m.id ? `<a class="btn" href="#/m/${esc(m.id)}">احجز من جديد</a>` : ""}</div>`;
    }
    view.innerHTML = head + body + `<p class="sub" style="font-size:13px">رمز حجزك: <span class="code">${esc(b.code)}</span></p>`;
  }

  async function mineView() {
    setTab("mine");
    const codes = myCodes();
    const list = codes.length ? await store.bookingStatus(codes) : [];
    view.innerHTML = `<h1>حجوزاتي</h1><p class="sub">الحجوزات اللي سويتها من هالجهاز.</p>${demoNote()}` + (list.length
      ? list.map((b) => `<a class="card match" href="#/pay/${esc(b.code)}">
          <div class="mhead"><div><p class="mtitle">${esc(b.match ? b.match.pitch : "")}</p><div class="mwhen">${esc(b.match ? when(b.match.starts_at) : "")}</div><div class="mwhere">${esc(teamName(b.team))} · ${esc(posName(b.position))}</div></div>
          <div class="price"><b>${Number(b.amount)}</b><span>ريال</span></div></div>
          <div style="margin-top:10px">${statusPill(b.status)}</div></a>`).join("")
      : `<div class="card empty"><b>ما عندك حجوزات</b><a href="#/">شوف المباريات الجاية</a></div>`);
  }

  // ------------------------------------------------------------ admin

  async function adminView(parts) {
    setTab("admin");
    if (!(await store.isAdmin())) return adminLogin();
    const tab = parts[0] || "transfers";
    const nav = (t, label, n) => `<button data-t="${t}" aria-pressed="${tab === t || (t === "matches" && ["match", "new", "edit"].includes(tab))}">${label}${n ? ` (${n})` : ""}</button>`;
    const bookings = await store.adminBookings();
    const paid = bookings.filter((b) => b.status === "paid");
    updateBadge(paid.length);
    view.innerHTML = `<h1>الإدارة</h1>${demoNote()}<div class="atabs">${nav("transfers", "التحويلات", paid.length)}${nav("matches", "المباريات")}${nav("settings", "الإعدادات")}</div><div id="adm"></div>`;
    $$(".atabs button").forEach((b) => b.addEventListener("click", () => { location.hash = `#/admin/${b.dataset.t}`; }));
    const box = $("#adm");
    if (tab === "transfers") return adminTransfers(box, bookings);
    if (tab === "matches") return adminMatches(box);
    if (tab === "match") return adminMatch(box, parts[1], bookings);
    if (tab === "new") return adminMatchForm(box, null);
    if (tab === "edit") {
      const m = await store.getMatch(parts[1]);
      if (m) m.taken = (await store.getSlots(m.id)).length;
      return adminMatchForm(box, m);
    }
    if (tab === "settings") return adminSettings(box);
  }

  function adminLogin() {
    const demo = store.mode === "demo";
    view.innerHTML = `<h1>دخول الإدارة</h1>${demoNote()}
      <form class="card" novalidate>
        ${demo ? "" : `<label class="f"><span>البريد الإلكتروني</span><input type="email" name="email" autocomplete="username" dir="ltr" required></label>`}
        <label class="f"><span>${demo ? "رمز الإدارة" : "كلمة المرور"}</span><input type="password" name="secret" autocomplete="current-password" ${demo ? 'inputmode="numeric"' : ""} dir="ltr" required></label>
        <p class="err" id="err" role="alert"></p>
        <button class="btn" type="submit">دخول</button>
        ${demo ? `<p class="sub" style="font-size:13px;margin:10px 0 0">في الوضع التجريبي الرمز هو اللي في <span class="code">config.js</span> (الافتراضي 1234). غيّره قبل ما تنشر الرابط.</p>` : ""}
      </form>`;
    const form = $("form", view);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      try { await store.login(form.email ? form.email.value.trim() : "", form.secret.value); adminView([]); }
      catch (ex) { $("#err").textContent = ex.message; }
    });
  }

  function bookingCard(b, actions) {
    const m = b.match || {};
    return `<div class="card" data-id="${esc(b.id)}">
      <div class="mhead"><div><p class="mtitle">${esc(b.player_name)}</p><div class="mwhere"><a href="tel:${esc(b.phone)}" dir="ltr">${esc(b.phone)}</a> · ${esc(teamName(b.team))} · ${esc(posName(b.position))}${b.clip ? " · مقطع خاص" : ""}</div></div>
      <div class="price"><b>${Number(b.amount)}</b><span>ريال</span></div></div>
      <dl class="kv">
        ${b.payer_ref ? `<dt>المحوّل</dt><dd><b>${esc(b.payer_ref)}</b></dd>` : ""}
        <dt>المباراة</dt><dd>${esc(m.pitch || "")} · ${esc(m.starts_at ? when(m.starts_at) : "")}</dd>
        <dt>الرمز</dt><dd><span class="code">${esc(b.code)}</span></dd>
        ${b.status === "held" ? `<dt>المهلة</dt><dd>تنتهي ${esc(fTime.format(new Date(b.expires_at)))}</dd>` : ""}
      </dl>
      <div class="btns">${actions}</div></div>`;
  }

  function adminTransfers(box, bookings) {
    const now = Date.now();
    const paid = bookings.filter((b) => b.status === "paid");
    const held = bookings.filter((b) => b.status === "held" && K.isActive(b, now));
    const confirmed = bookings.filter((b) => b.status === "confirmed" && b.match && new Date(b.match.starts_at).getTime() > now);
    const income = confirmed.reduce((s, b) => s + Number(b.amount), 0);
    const notify = Array.from(justConfirmed.values());
    const confirmMsg = (b) => `هلا ${b.player_name}، تم تأكيد حجزك في كورة سمارت.\n${b.match ? `${b.match.pitch} · ${whenLong(b.match.starts_at)}` : ""}\n${teamName(b.team)} · ${posName(b.position)}\nرمز الحجز: ${b.code}`;
    const rejectMsg = (b) => `هلا ${b.player_name}، ما وصلنا تحويل لحجزك (رمز ${b.code}) في كورة سمارت. لو حوّلت، رد علينا بصورة التحويل.`;
    box.innerHTML = `
      <div class="stat"><div><b>${paid.length}</b><span>بانتظار التأكيد</span></div><div><b>${held.length}</b><span>بانتظار التحويل</span></div><div><b>${income.toLocaleString("en-US")}</b><span>ريال مؤكد للمباريات الجاية</span></div></div>
      ${notify.length ? `<h2>بلّغ اللي أكدتهم</h2>${notify.map((b) => `<div class="card"><div class="mhead"><b>${esc(b.player_name)}</b><a class="btn small wa" target="_blank" rel="noopener" href="${esc(wa(b.phone, confirmMsg(b)))}">واتساب</a></div></div>`).join("")}` : ""}
      <h2>تحويلات بانتظار التأكيد</h2>
      <p class="sub" style="font-size:13px">قبل ما تأكد، افتح حسابك في STC وتأكد إن المبلغ وصل فعلًا من نفس الاسم. لا تعتمد على صورة التحويل.</p>
      ${paid.length ? paid.map((b) => bookingCard(b, `<button class="btn small ok" data-act="confirmed">وصل المبلغ · أكّد</button><button class="btn small bad" data-act="rejected">ما وصل · ارفض</button><a class="btn small sec" target="_blank" rel="noopener" href="${esc(wa(b.phone, rejectMsg(b)))}">راسله</a>`)).join("") : `<div class="card empty">ما فيه تحويلات تنتظر.</div>`}
      <h2>محجوز وبانتظار التحويل</h2>
      ${held.length ? held.map((b) => bookingCard(b, `<button class="btn small ok" data-act="confirmed">وصل المبلغ · أكّد</button><button class="btn small bad" data-act="cancelled">فك الحجز</button>`)).join("") : `<div class="card empty">لا شي.</div>`}`;
    $$("[data-act]", box).forEach((btn) => btn.addEventListener("click", async () => {
      const card = btn.closest("[data-id]"), id = card.dataset.id, act = btn.dataset.act;
      if (act !== "confirmed" && !confirm(act === "rejected" ? "ترفض الحجز؟ المكان يرجع فاضي." : "تفك الحجز؟ المكان يرجع فاضي.")) return;
      btn.disabled = true;
      try {
        await store.setBookingStatus(id, act);
        if (act === "confirmed") { const b = bookings.find((x) => x.id === id); if (b) justConfirmed.set(id, b); toast("تم التأكيد"); }
        else toast("تم");
        adminView(["transfers"]);
      } catch (ex) { toast(ex.message); btn.disabled = false; }
    }));
  }

  async function adminMatches(box) {
    const list = await store.adminMatches();
    const now = Date.now();
    const up = list.filter((m) => new Date(m.starts_at).getTime() > now).reverse();
    const past = list.filter((m) => new Date(m.starts_at).getTime() <= now);
    const row = (m) => `<a class="card match" href="#/admin/match/${esc(m.id)}"><div class="mhead"><div><p class="mtitle">${esc(m.pitch)}</p><div class="mwhen">${esc(when(m.starts_at))}</div><div class="mwhere">${m.format} ضد ${m.format} · ${Number(m.taken)} من ${m.format * 2}</div></div>${m.status === "cancelled" ? statusPill("cancelled") : ""}</div><div class="tags">${serviceTags(m)}</div></a>`;
    box.innerHTML = `<a class="btn" href="#/admin/new">+ مباراة جديدة</a>
      <h2>الجاية</h2>${up.length ? up.map(row).join("") : `<div class="card empty">ما فيه مباريات جاية.</div>`}
      ${past.length ? `<h2>السابقة</h2>${past.slice(0, 30).map(row).join("")}` : ""}`;
  }

  async function adminMatch(box, id, bookings) {
    const m = await store.getMatch(id);
    if (!m) { box.innerHTML = `<div class="card empty">ما لقينا المباراة.</div>`; return; }
    const now = Date.now();
    const rows = bookings.filter((b) => b.match_id === id && (b.status === "confirmed" || b.status === "paid" || (b.status === "held" && K.isActive(b, now))));
    const confirmedSum = rows.filter((b) => b.status === "confirmed").reduce((s, b) => s + Number(b.amount), 0);
    const clips = rows.filter((b) => b.clip && b.status === "confirmed").length;
    const videoMsg = (b) => `هلا ${b.player_name}، فيديو مباراة ${m.pitch} (${whenLong(m.starts_at)}) جاهز${m.youtube_url ? `:\n${m.youtube_url}` : "، بنرسله لك هنا."}${b.clip ? "\nومقطعك الخاص بلقطاتك مرفق." : ""}\nشكرًا إنك لعبت مع كورة سمارت.`;
    const team = (t) => {
      const r = rows.filter((b) => b.team === t).sort((a, z) => K.POSITIONS.indexOf(a.position) - K.POSITIONS.indexOf(z.position));
      return `<h3>${esc(teamName(t))} (${r.length} من ${m.format})</h3>` + (r.length ? r.map((b) => `<div class="pl"><span class="pos">${esc(posName(b.position))}</span><div class="who"><b>${esc(b.player_name)}${b.clip ? " · مقطع خاص" : ""}</b><small dir="ltr">${esc(b.phone)}</small> ${statusPill(K.effectiveStatus(b))}</div>${b.status === "confirmed" ? `<a class="btn small wa" target="_blank" rel="noopener" href="${esc(wa(b.phone, videoMsg(b)))}">أرسل الفيديو</a>` : ""}</div>`).join("") : `<p class="sub">ما فيه لاعبين.</p>`);
    };
    box.innerHTML = `
      <p><a href="#/admin/matches">→ المباريات</a></p>
      <div class="card">
        <div class="mhead"><div><p class="mtitle">${esc(m.pitch)}</p><div class="mwhen">${esc(whenLong(m.starts_at))}</div><div class="mwhere">${esc(m.area)} · ${m.format} ضد ${m.format}</div></div>${m.status === "cancelled" ? statusPill("cancelled") : ""}</div>
        <div class="tags">${serviceTags(m)}</div>
        <dl class="kv"><dt>المؤكد</dt><dd>${riyal(confirmedSum)}</dd><dt>مقاطع خاصة</dt><dd>${clips}</dd></dl>
        <div class="btns"><a class="btn small sec" href="#/admin/edit/${esc(m.id)}">تعديل</a>${m.status === "open" ? `<button class="btn small bad" id="cancel">إلغاء المباراة</button>` : ""}</div>
      </div>
      ${m.filming || m.live ? `<form class="card" id="yt" novalidate><label class="f"><span>رابط الفيديو أو البث على يوتيوب</span><input type="url" name="url" dir="ltr" placeholder="https://youtube.com/..." value="${esc(m.youtube_url || "")}"></label><button class="btn small" type="submit">حفظ الرابط</button></form>` : ""}
      <div class="card roster">${team(1)}${team(2)}</div>`;
    const cancel = $("#cancel");
    if (cancel) cancel.addEventListener("click", async () => {
      if (!confirm("تلغي المباراة؟ تختفي من التطبيق، ولازم ترجع فلوس اللي دفعوا بنفسك.")) return;
      await store.saveMatch({ id: m.id, status: "cancelled" });
      toast("انلغت المباراة");
      adminView(["match", id]);
    });
    const yt = $("#yt");
    if (yt) yt.addEventListener("submit", async (e) => {
      e.preventDefault();
      const url = yt.url.value.trim();
      if (url && !/^https:\/\//.test(url)) { toast("الرابط لازم يبدأ بـ https://"); return; }
      await store.saveMatch({ id: m.id, youtube_url: url });
      toast("انحفظ الرابط");
      adminView(["match", id]);
    });
  }

  function adminMatchForm(box, m) {
    const edit = !!m;
    const start = m ? new Date(new Date(m.starts_at).getTime() + 3 * 3600e3).toISOString() : null;
    const v = m || { pitch: "", area: "", map_url: "", format: 6, price: 25, duration_minutes: 60, referee: false, filming: false, live: false };
    let format = Number(v.format);
    box.innerHTML = `
      <p><a href="${edit ? `#/admin/match/${esc(m.id)}` : "#/admin/matches"}">→ رجوع</a></p>
      <form class="card" novalidate>
        <h2 style="margin-top:0">${edit ? "تعديل المباراة" : "مباراة جديدة"}</h2>
        <label class="f"><span>اسم الملعب</span><input type="text" name="pitch" maxlength="60" required value="${esc(v.pitch)}"></label>
        <label class="f"><span>الحي</span><input type="text" name="area" maxlength="60" value="${esc(v.area)}"></label>
        <label class="f"><span>رابط الموقع (قوقل ماب، اختياري)</span><input type="url" name="map_url" dir="ltr" value="${esc(v.map_url || "")}"></label>
        <div class="row2">
          <label class="f"><span>التاريخ</span><input type="date" name="date" required value="${start ? start.slice(0, 10) : dayKey(Date.now())}"></label>
          <label class="f"><span>الوقت (بتوقيت السعودية)</span><input type="time" name="time" required value="${start ? start.slice(11, 16) : "21:00"}"></label>
        </div>
        <span style="display:block;font-size:14px;color:var(--mut);margin-bottom:4px">عدد اللاعبين في كل فريق</span>
        <div class="toggle3" role="group">${[5, 6, 7, 8, 11].map((n) => `<button type="button" data-f="${n}" aria-pressed="${n === format}">${n}</button>`).join("")}</div>
        <div class="row2">
          <label class="f"><span>سعر الملعب للاعب (ريال)</span><input type="number" name="price" min="0" step="1" inputmode="numeric" required value="${Number(v.price)}"></label>
          <label class="f"><span>المدة</span><select name="duration">${[60, 90, 120].map((d) => `<option value="${d}" ${Number(v.duration_minutes) === d ? "selected" : ""}>${d} دقيقة</option>`).join("")}</select></label>
        </div>
        <label class="check"><input type="checkbox" name="referee" ${v.referee ? "checked" : ""}><span><b>حكم</b><small>${riyal(settings.referee_fee)} للمباراة، تتوزع على اللاعبين</small></span></label>
        <label class="check"><input type="checkbox" name="filming" ${v.filming ? "checked" : ""}><span><b>تصوير ومونتاج</b><small>${riyal(settings.filming_fee)} للمباراة، تتوزع على اللاعبين</small></span></label>
        <label class="check"><input type="checkbox" name="live" ${v.live ? "checked" : ""}><span><b>بث مباشر على يوتيوب</b><small>${riyal(settings.live_fee)} للمباراة، تتوزع على اللاعبين</small></span></label>
        <div class="lines" id="lines"></div>
        <p class="err" id="err" role="alert"></p>
        <button class="btn" type="submit">${edit ? "حفظ" : "انشر المباراة"}</button>
      </form>`;
    const form = $("form", box), lines = $("#lines", box);
    const current = () => ({ format, price: Number(form.price.value || 0), referee: form.referee.checked, filming: form.filming.checked, live: form.live.checked });
    const render = () => {
      const p = K.priceBreakdown(current(), settings, false);
      lines.innerHTML = `<div class="t"><span>سعر اللاعب</span><span>${riyal(p.total)}</span></div><div><span>دخل المباراة كاملة</span><span>${riyal(p.total * format * 2)}</span></div>`;
    };
    $$(".toggle3 button", box).forEach((b) => b.addEventListener("click", () => {
      format = Number(b.dataset.f);
      $$(".toggle3 button", box).forEach((x) => x.setAttribute("aria-pressed", x === b));
      render();
    }));
    form.addEventListener("input", render);
    render();
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = $("#err", box);
      const pitch = form.pitch.value.trim();
      const startsAt = new Date(`${form.date.value}T${form.time.value}:00+03:00`);
      const mapUrl = form.map_url.value.trim();
      if (pitch.length < 2) { err.textContent = "اكتب اسم الملعب"; return; }
      if (isNaN(startsAt.getTime())) { err.textContent = "اختر التاريخ والوقت"; return; }
      if (!edit && startsAt.getTime() <= Date.now()) { err.textContent = "الوقت لازم يكون في المستقبل"; return; }
      if (mapUrl && !/^https:\/\//.test(mapUrl)) { err.textContent = "رابط الموقع لازم يبدأ بـ https://"; return; }
      if (edit && format !== Number(m.format) && Number(m.taken || 0) > 0) { err.textContent = "ما تقدر تغيّر عدد اللاعبين بعد ما بدأ الحجز"; return; }
      const row = Object.assign(current(), { pitch, area: form.area.value.trim(), map_url: mapUrl, starts_at: startsAt.toISOString(), duration_minutes: Number(form.duration.value) });
      if (edit) row.id = m.id;
      try {
        await store.saveMatch(row);
        toast(edit ? "انحفظت التعديلات" : "انتشرت المباراة");
        location.hash = edit ? `#/admin/match/${m.id}` : "#/admin/matches";
      } catch (ex) { err.textContent = ex.message; }
    });
  }

  function adminSettings(box) {
    const s = settings;
    const num = (name, label, val) => `<label class="f"><span>${label}</span><input type="number" name="${name}" min="0" step="1" inputmode="numeric" value="${Number(val)}"></label>`;
    box.innerHTML = `
      <form class="card" novalidate>
        <h2 style="margin-top:0">التحويل</h2>
        <label class="f"><span>رقم STC اللي يحوّلون عليه</span><input type="tel" name="stc_number" dir="ltr" style="text-align:right" placeholder="05XXXXXXXX" value="${esc(s.stc_number)}"></label>
        <label class="f"><span>الاسم اللي يطلع للمحوّل</span><input type="text" name="stc_name" maxlength="60" value="${esc(s.stc_name)}"></label>
        ${num("hold_minutes", "مهلة التحويل (دقايق)", s.hold_minutes)}
        <h2>أسعار الخدمات (للمباراة كاملة)</h2>
        <div class="row2">${num("referee_fee", "الحكم", s.referee_fee)}${num("filming_fee", "التصوير والمونتاج", s.filming_fee)}</div>
        <div class="row2">${num("live_fee", "البث المباشر", s.live_fee)}${num("clip_price", "المقطع الخاص (للاعب)", s.clip_price)}</div>
        <p class="err" id="err" role="alert"></p>
        <button class="btn" type="submit">حفظ</button>
      </form>
      <div class="btns"><button class="btn sec" id="out">تسجيل خروج</button>${store.mode === "demo" ? `<button class="btn sec" id="reset">ارجع للبيانات التجريبية</button>` : ""}</div>`;
    const form = $("form", box);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = $("#err", box);
      const phone = form.stc_number.value.trim() ? K.normalizePhone(form.stc_number.value) : "";
      if (phone === null) { err.textContent = "رقم STC لازم يكون مثل 05XXXXXXXX"; return; }
      const hold = Number(form.hold_minutes.value);
      if (!(hold >= 5 && hold <= 120)) { err.textContent = "المهلة بين 5 و 120 دقيقة"; return; }
      const next = { stc_number: phone, stc_name: form.stc_name.value.trim(), hold_minutes: hold };
      ["referee_fee", "filming_fee", "live_fee", "clip_price"].forEach((k) => { next[k] = Math.max(0, Number(form[k].value || 0)); });
      try { await store.saveSettings(next); settings = await store.getSettings(); toast("انحفظت الإعدادات"); }
      catch (ex) { err.textContent = ex.message; }
    });
    $("#out", box).addEventListener("click", async () => { await store.logout(); updateBadge(0); adminView([]); });
    const reset = $("#reset", box);
    if (reset) reset.addEventListener("click", async () => {
      if (!confirm("تمسح كل الحجوزات والمباريات على هالجهاز وترجع البيانات التجريبية؟")) return;
      await store.resetDemo(); settings = await store.getSettings(); toast("رجعت البيانات التجريبية");
    });
  }

  function updateBadge(n) {
    const b = $("#adminBadge");
    b.hidden = !n;
    b.textContent = n;
  }

  // ------------------------------------------------------------ router

  async function route() {
    clearTimers();
    $$(".scrim").forEach((s) => s.remove());
    const parts = (location.hash.replace(/^#\/?/, "") || "").split("/").filter(Boolean).map(decodeURIComponent);
    window.scrollTo(0, 0);
    try {
      if (!parts.length) await home();
      else if (parts[0] === "m" && parts[1]) await matchView(parts[1]);
      else if (parts[0] === "pay" && parts[1]) await payView(parts[1].toUpperCase());
      else if (parts[0] === "mine") await mineView();
      else if (parts[0] === "admin") await adminView(parts.slice(1));
      else await home();
    } catch (ex) {
      console.error(ex);
      view.innerHTML = `<div class="card empty"><b>صار خطأ</b>${esc(ex.message || "")}<br><br><button class="btn small sec" id="retry">حاول مرة ثانية</button></div>`;
      $("#retry").addEventListener("click", route);
    }
  }

  async function boot() {
    try {
      store = await window.KoraStore.create(window.KORA_CONFIG || {});
      settings = await store.getSettings();
    } catch (ex) {
      view.innerHTML = `<div class="card empty"><b>ما قدرنا نشغّل التطبيق</b>${esc(ex.message)}</div>`;
      return;
    }
    window.addEventListener("hashchange", route);
    route();
    if ("serviceWorker" in navigator && location.protocol === "https:") {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  }

  boot();
})();
