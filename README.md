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


## Extras added later

- **Accounts**: username + password (no email). Settings → Account has *Change password* and *Recovery code*; adults can set a new password for another member. Run `supabase/password_tools.sql` once.
- **Offline mode**: the last data is saved on the device; changes made offline are queued and uploaded when the connection returns (banner at the top shows the state).
- **Chore templates**: Chores → Templates adds ready-made chores in one tap.
- **Phone notifications**: run `supabase/push.sql`, insert your VAPID keys into `push_config`, deploy `supabase/functions/reminders`, and schedule it every minute (commands are in the SQL file). Each phone turns it on in Settings. On iPhone, add the app to the Home Screen first. The household timezone is `households.tz` (default `Europe/Tirane`).
- **AI helpers** (Google Gemini): a one-line daily summary above the chores, and *Tidy up* on the shopping list. Run `supabase/ai.sql`, store your key in `ai_config`, and deploy `supabase/functions/ai`. The key never reaches the browser. Each user is limited to 150 AI requests a day.

### Notifications
Each phone enables them in Settings → Notifications. Types: event reminders, chore due, **chore done (who + time)**, **new chore added**, and a **"Tomorrow" list at 19:00** (Tirana time). Activity messages arrive within ~1 minute and go to every subscribed device, including the one that made the change.
- **Air conditioner** (Tuya / Smart Life): a card on the home screen opens power, temperature, mode, fan speed and sleep. Run `supabase/ac.sql`, add your Tuya cloud credentials to `ac_config`, and deploy `supabase/functions/ac`. The Tuya developer trial must be renewed in the Tuya console every few months.

## News strip
The `news` edge function (cached 10 min) returns Euronews Albania headlines (RSS), Top Channel headlines (its feeds are blocked, so the homepage is scraped; this may need a fix if the site changes) and WTI/Brent prices (Yahoo chart API). The home screen shows one item at a time, rotating every 8 s; tap it for the full list. No setup or secrets needed.

## Albanian calendar
`js/holidays.js` holds the official holidays (fixed dates, both Easters computed, Bajram dates listed up to 2031 — check them each year against the Muslim Community of Albania announcement), the "first working day off" rule for weekend holidays, national days and traditional name days. Holidays show in red in the calendar and on the home strip; family members whose first name matches a name day are congratulated (on screen and with a morning notification). Name days can be hidden per device in Settings.

## Extras (supabase/extras.sql)
- **One AI summary per household**: the `ai` function stores the daily summary in `ai_summary` and reuses it for an hour, so every device shares it.
- **AC schedules**: managed in the air conditioner popup ("Orari"), stored in `ac_schedules`, run by the `reminders` function (within 10 minutes of the set time, once per day).
- **Morning weather alert**: at 7:30 each phone gets a notification only on days with rain, snow, storms, strong wind, frost or heat, for the place set on that phone. Switch it off in Settings → Notifications.
- `reminders?dry=1&at=07:35` (with the cron secret) shows what would be sent at that time without sending anything.

## Layout test
`node tests/layout.js [devices] [profiles] [routes]` opens the board on 9 screen sizes (iPhone SE/X, small Android, S25 Ultra, iPad and Tab A in both orientations, laptop) with 6 option sets (everything on, busy, everything off, all done, empty, defaults) and fails when blocks overlap, go off screen, hide under the tab bar or chores disappear without a "+N" chip. Screenshots go to `$SHOTS`.
The previous layout is kept on the branch `backup-layout-v1`.

## Calm screen photos
Settings → Home screen → *Calm screen photos*. Photos are shrunk on the device (longest side 1920 px, JPEG) and stored in the private Supabase Storage bucket `photos`, in a folder named after the household, so every screen in the family sees the same set. The calm screen cross-fades a new one every 20 seconds and checks for new or deleted photos every 3 minutes, with the clock moved to the bottom-left. The tap that wakes the calm or night screen is swallowed, so it never presses the button underneath. Test: `node tests/calm.js`.
