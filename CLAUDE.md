# Dweekat Fitness — project notes

Arabic-first (Levantine dialect) fitness PWA, owned by Ahmad and Hani Mustafa. Live at
https://adweekat-lgtm.github.io/Gym/ (GitHub Pages, deployed from branch `claude/practical-hypatia-hfkyoi`).

## Hard rules
- **Nothing may depend on Claude or any AI service at runtime.** The coach, food estimates and
  feedback are all offline/rule-based. (Earlier versions used `window.claude`; it was removed on purpose.)
- Every user-facing string exists in Arabic and English (`STR.ar` / `STR.en`, `tr([ar,en])`).
  New keys go near `pickDay:` in both dictionaries; check for duplicate keys (a later duplicate wins).
- After changing `index.html`, bump `const V="dweekat-vN"` in `sw.js` so phones pick up the update.
- Validate: extract the big `<script>` block and run `node --check`, then drive the app with
  Playwright at iPhone size (onboarding → tabs) and check for page errors.

## Layout
- `index.html` — the whole app (CSS + one block-scoped script). Main sections, in order:
  data (`EXD` exercises, `DAYS` programme, `WARM`, `CARDIO`, `METCON`), `HOW` step-by-step,
  strings, storage (localStorage, key `coachapp:v1`), training logic, food (`FOODS` offline
  database + `localEstimate`), daily tips (`TIPS`), sounds (`tapSfx`, `winSfx`, `cheerVoice`,
  `introSfx`), offline coach (`coachReply`), meals (`MEALT`, `mealPlan`), audio library
  (radio-browser, mp3quran, iTunes podcasts; broken items auto-hidden 7 days), coaching card,
  team (`TEAM`, live hours from Google Sheet `AVAIL_CSV`), women's programmes (`WEX`, `WPROG`),
  stats (`GA_ID`, Google Analytics 4), gender (`FIMG` = keys that have female photos in `img/exf/`).
- `img/ex/<key>-0.jpg / -1.jpg` — start/end photos (public domain, free-exercise-db), shown as a
  crossfade "animation". `img/team/` — expert photos.
- `sounds/cheer1-3.m4a` — men's cheer voices after a workout.
- `sw.js` — offline cache (network-first for the page, cache-first for assets).
- `manifest.webmanifest`, `icons/` — install as a phone app.

## Config waiting for the owners
- `GA_ID` — GA4 Measurement ID (G-XXXX) for user counts / gender / time in app.
- `AVAIL_CSV` — published-to-web CSV link of the experts' availability sheet
  (columns: id, الاسم, الحالة, الأحد … السبت, ملاحظة).
- `TEAM` — profiles for the 3rd trainer, 2 female trainers, dietitian, psychologist (status "soon" until filled).
- Female exercise photos — the free library is men only; to add them put files in `img/exf/` and list the keys in `FIMG`.

## Business
- Coaching offer: first month $1, then $18/month; bookings go to the expert's WhatsApp.
- WhatsApp: Ahmad 966548818695, Hani 966542079230.
