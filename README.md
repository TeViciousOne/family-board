# Family Board

A wall-tablet household board: chores per person, shared calendar, weather, shopping list, notes, countdowns, night screen and sounds. English and Albanian. Works in any modern browser; installs as an app (PWA). No build step.

## 1. Try it now (demo mode)

Open `index.html` through any static server, for example:

    python3 -m http.server 8123      # then visit http://localhost:8123

With `config.js` empty, everything runs with sample data stored in that browser only. Settings > "Reset demo" restores it.

## 2. Share it with phones (live sync)

1. Create a free project at supabase.com.
2. SQL Editor > paste `supabase/schema.sql` > Run.
3. Authentication > Providers > Email: turn **off** "Confirm email" (simplest for a family; otherwise each person must click an email link first).
4. Project Settings > API: copy the Project URL and the `anon` / publishable key into `config.js`.
   The key is public by design; the row-level security rules in `schema.sql` are what protect your data.
5. Host the folder (it is plain static files): Vercel, Netlify or Cloudflare Pages all work for free. Drag and drop the folder, or connect a repo.
6. Open the site. The first person taps **Create account > Create household**. The others sign up and choose **Join** with the 6-letter invite code shown in Settings.

Each adult has their own login. People without a phone (or kids) can still be added as family members in Settings and assigned chores.

## 3. Set up the tablet

1. Install **Fully Kiosk Browser** (from Aurora Store or fully-kiosk.com).
2. Start URL: your hosted address. Turn on: Keep Screen On, Launch on Boot, Fullscreen, Autoplay media.
   Also allow audio without a tap, otherwise sounds start only after the first touch.
3. Sign in once with your account. In Settings (inside the app) pick: language, "Who did it?" behaviour, sound volume, night hours, and your city for the weather.
4. Mount it, keep it on the charger. To protect the battery, many people use a smart plug that cuts power at 80%.

On phones: open the site in Chrome > menu > "Install app" / "Add to Home screen".

## Features

- Home: big clock, date, weather (Open-Meteo, no key), one shared chore list with a coloured person tag on each chore, coming up, countdowns, notes, shopping count.
- Chores: tap to complete; overdue highlighting; "last done by" and a History tab; completions are unique per chore per day.
- Repeats (chores and events): once, daily, weekly (chosen weekdays), monthly (day of month, nth weekday, last weekday, last day), yearly, every N, with an end date. The 31st falls back to the month's last day.
- Events: multi-day, birthdays (shows age), countdowns, reminder chimes.
- Night screen: dims and moves a small clock to avoid burn-in; touch wakes it for 60 seconds. Reloads itself around 04:00 to stay fresh.

## Tests

    node --test tests/recur.test.js      # repeat rules
    node scripts/keys.js check           # English/Albanian keys match
    NODE_PATH=<playwright> node tests/browser.js   # browser smoke test (needs Chrome)

## Notes

- Free Supabase projects pause after a week of no activity; a tablet that is always on keeps it awake.
- Fonts load from Google Fonts; offline the app falls back to system fonts.
