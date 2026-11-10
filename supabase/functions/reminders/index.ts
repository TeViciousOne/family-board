// Runs every minute (pg_cron). Sends: event reminders, "chore is due", "chore done by X", "new chore added",
// and an evening list of tomorrow's events.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import "./shared.js";
import "./holidays.js";

const FB = (globalThis as any).FB;
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const DIGEST_HOUR = 19; // local time of the "tomorrow" message

const TXT: Record<string, Record<string, string>> = {
  en: { chore: "is due", event: "starts in {n} min", now: "starts now", doneBy: "Done by {who} at {time}", someone: "someone",
        doneMany: "{n} chores done", newChore: "New chore", newMany: "{n} new chores", tomorrow: "Tomorrow", allDay: "all day",
        holiday: "Public holiday today", off: "Day off today", nameday: "Happy name day, {name}!", namedayBody: "Today is {saint}. Wish them well!",
        wxTitle: "Today's weather", rain: "☔ Rain from {h}:00 ({p}%), take an umbrella", storm: "⛈️ Thunderstorms from {h}:00", snow: "❄️ Snow from {h}:00",
        frost: "🥶 Frost this morning, down to {t}°", heat: "🥵 Hot day, up to {t}°", wind: "💨 Strong wind, gusts up to {w} km/h" },
  sq: { chore: "duhet bërë tani", event: "fillon pas {n} min", now: "fillon tani", doneBy: "E ka bërë {who} në {time}", someone: "dikush",
        doneMany: "{n} detyra u bënë", newChore: "Detyrë e re", newMany: "{n} detyra të reja", tomorrow: "Nesër", allDay: "gjithë ditën",
        holiday: "Sot është festë zyrtare", off: "Sot është ditë pushimi", nameday: "Urime për emrin, {name}!", namedayBody: "Sot është {saint}. Uroje!",
        wxTitle: "Moti sot", rain: "☔ Shi nga ora {h}:00 ({p}%), merr çadrën", storm: "⛈️ Stuhi nga ora {h}:00", snow: "❄️ Borë nga ora {h}:00",
        frost: "🥶 Ngricë në mëngjes, deri {t}°", heat: "🥵 Vapë sot, deri {t}°", wind: "💨 Erë e fortë, me shpejtësi deri {w} km/h" },
};
const tx = (l: string, k: string, v: Record<string, string | number> = {}) =>
  Object.keys(v).reduce((s, x) => s.replace("{" + x + "}", String(v[x])), (TXT[l] || TXT.en)[k]);

let forceMin: number | null = null; // dry runs only: ?dry=1&at=07:35
function localNow(tz: string, at = new Date()) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const p: Record<string, string> = {};
  f.formatToParts(at).forEach((x) => (p[x.type] = x.value));
  return { date: `${p.year}-${p.month}-${p.day}`, min: forceMin ?? Number(p.hour) * 60 + Number(p.minute), hhmm: `${p.hour}:${p.minute}` };
}
const addDay = (d: string) => { const t = new Date(d + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() + 1); return t.toISOString().slice(0, 10); };

type Item = { key: string; title: string; body: (l: string) => string; skipUser?: string | null; digest?: any[]; many?: any[] };

const tzCache = new Map<string, string>();
async function tzOf(hid: string) {
  if (!tzCache.has(hid)) { const { data } = await sb.from("households").select("tz").eq("id", hid).single(); tzCache.set(hid, data?.tz || "Europe/Tirane"); }
  return tzCache.get(hid)!;
}
const weekdayOf = (d: string) => new Date(d + "T12:00:00Z").getUTCDay();

/* air conditioner schedules: run each one once on its day, within 10 minutes of its time */
async function runAcSchedules(secret: string, dry: boolean) {
  const { data: list } = await sb.from("ac_schedules").select("*").eq("enabled", true);
  const ran: string[] = [];
  for (const x of list || []) {
    const now = localNow(await tzOf(x.household_id));
    const at = FB.util.minutesOf(x.at);
    if (x.last_run === now.date || !(x.days || []).includes(weekdayOf(now.date)) || now.min < at || now.min >= at + 10) continue;
    ran.push("ac:" + x.id);
    if (dry) continue;
    await sb.from("ac_schedules").update({ last_run: now.date }).eq("id", x.id);
    const commands = x.action === "off" ? [{ code: "switch", value: false }]
      : [{ code: "switch", value: true }, ...(x.mode ? [{ code: "mode", value: x.mode }] : []), ...(x.temp ? [{ code: "temp_set", value: x.temp }] : [])];
    const r = await fetch(Deno.env.get("SUPABASE_URL") + "/functions/v1/ac", { method: "POST", headers: { "content-type": "application/json", "x-cron-secret": secret }, body: JSON.stringify({ action: "set", commands }) });
    console.log("ac schedule", x.id, x.action, r.status);
  }
  return ran;
}

/* morning weather alert: only when there is something worth knowing */
const wxCache = new Map<string, any>();
async function forecast(lat: number, lon: number) {
  const k = lat.toFixed(2) + "," + lon.toFixed(2);
  if (!wxCache.has(k)) {
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation_probability,weather_code,wind_gusts_10m&timezone=auto&forecast_days=1`;
    try { const r = await fetch(u); wxCache.set(k, r.ok ? await r.json() : null); } catch { wxCache.set(k, null); }
  }
  return wxCache.get(k);
}
function wxLines(f: any, l: string) {
  const H = f?.hourly; if (!H?.time) return [];
  const hours = H.time.map((t: string, i: number) => ({ h: Number(t.slice(11, 13)), temp: H.temperature_2m[i], p: H.precipitation_probability?.[i] ?? 0, code: H.weather_code[i], gust: H.wind_gusts_10m?.[i] ?? 0 }));
  const day = hours.filter((x: any) => x.h >= 7 && x.h <= 22);
  const out: string[] = [];
  const storm = day.find((x: any) => x.code >= 95);
  const snow = day.find((x: any) => (x.code >= 71 && x.code <= 77) || x.code === 85 || x.code === 86);
  const rain = day.find((x: any) => x.p >= 60 || (((x.code >= 51 && x.code <= 67) || (x.code >= 80 && x.code <= 82)) && x.p >= 40));
  if (storm) out.push(tx(l, "storm", { h: String(storm.h).padStart(2, "0") }));
  else if (snow) out.push(tx(l, "snow", { h: String(snow.h).padStart(2, "0") }));
  else if (rain) out.push(tx(l, "rain", { h: String(rain.h).padStart(2, "0"), p: Math.max(...day.filter((x: any) => x.h >= rain.h).map((x: any) => x.p)) }));
  const minMorning = Math.min(...hours.filter((x: any) => x.h <= 10).map((x: any) => x.temp));
  const maxDay = Math.max(...day.map((x: any) => x.temp));
  const gust = Math.max(...day.map((x: any) => x.gust));
  if (minMorning <= 0) out.push(tx(l, "frost", { t: Math.round(minMorning) }));
  if (maxDay >= 35) out.push(tx(l, "heat", { t: Math.round(maxDay) }));
  if (gust >= 60) out.push(tx(l, "wind", { w: Math.round(gust) }));
  return out;
}
const hashKey = (s: string) => { let x = 0; for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0; return (x >>> 0).toString(36); };

Deno.serve(async (req) => {
  const { data: cfg } = await sb.from("push_config").select("*").eq("id", 1).single();
  if (!cfg || req.headers.get("x-cron-secret") !== cfg.cron_secret) return new Response("forbidden", { status: 403 });
  webpush.setVapidDetails("mailto:" + cfg.contact, cfg.vapid_public, cfg.vapid_private);
  const dry = new URL(req.url).searchParams.get("dry") === "1";
  const atq = new URL(req.url).searchParams.get("at");
  forceMin = dry && atq && /^\d\d:\d\d$/.test(atq) ? Number(atq.slice(0, 2)) * 60 + Number(atq.slice(3)) : null;
  let acRan: string[] = [];
  try { acRan = await runAcSchedules(cfg.cron_secret, dry); } catch (e) { console.error("ac schedules", String(e)); }

  const { data: subs } = await sb.from("push_subscriptions").select("*");
  const byHh = new Map<string, any[]>();
  (subs || []).forEach((s) => byHh.set(s.household_id, [...(byHh.get(s.household_id) || []), s]));
  const sent: string[] = [];

  /* activity events queued by database triggers (wait 20 s so quick undos and bulk adds can settle) */
  const { data: queued } = await sb.from("push_events").select("*").eq("sent", false)
    .lt("created_at", new Date(Date.now() - 20000).toISOString()).order("id").limit(300);
  const ev = queued || [];
  if (ev.length && !dry) await sb.from("push_events").update({ sent: true }).in("id", ev.map((e) => e.id));

  for (const [hid, list] of byHh) {
    const { data: hh } = await sb.from("households").select("tz").eq("id", hid).single();
    const tz = hh?.tz || "Europe/Tirane";
    const now = localNow(tz);
    const items: Item[] = [];

    /* event reminders */
    const { data: events } = await sb.from("events").select("*").eq("household_id", hid);
    for (const e of events || []) {
      if (e.remind_minutes == null || !e.start_time) continue;
      const today = e.rule ? FB.recur.occursOn(Object.assign({}, e.rule, { start: e.rule.start || e.on_date }), now.date) : e.on_date === now.date;
      if (!today) continue;
      const start = FB.util.minutesOf(e.start_time), at = start - Number(e.remind_minutes);
      if (now.min >= at && now.min < start + 1) {
        const left = start - now.min;
        items.push({ key: `e:${e.id}:${now.date}`, title: e.title, body: (l) => left > 0 ? tx(l, "event", { n: left }) : tx(l, "now") });
      }
    }

    /* chores that are due */
    const { data: chores } = await sb.from("chores").select("*").eq("household_id", hid);
    const { data: done } = await sb.from("chore_completions").select("chore_id").eq("on_date", now.date).eq("household_id", hid);
    const doneSet = new Set((done || []).map((d) => d.chore_id));
    for (const c of (chores || []).filter((x) => x.active && x.due_time)) {
      if (doneSet.has(c.id) || !FB.recur.occursOn(c.rule, now.date)) continue;
      const due = FB.util.minutesOf(c.due_time);
      if (now.min >= due && now.min < due + 30) items.push({ key: `c:${c.id}:${now.date}`, title: (c.emoji ? c.emoji + " " : "") + c.title, body: (l) => tx(l, "chore") });
    }

    /* tomorrow's events, once in the evening */
    if (now.min >= DIGEST_HOUR * 60 && now.min < DIGEST_HOUR * 60 + 30) {
      const tom = addDay(now.date);
      const lines = (events || []).filter((e) => e.kind !== "countdown" && (e.rule && e.kind === "event"
        ? FB.recur.occursOn(Object.assign({}, e.rule, { start: e.rule.start || e.on_date }), tom)
        : e.kind === "birthday" ? e.on_date.slice(5) === tom.slice(5) : tom >= e.on_date && tom <= (e.end_date || e.on_date)))
        .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
      if (lines.length) {
        items.push({ key: `dg:${hid}:${tom}`, title: "", body: () => "", digest: lines });
      }
    }

    /* public holidays and family name days, once in the morning */
    if (now.min >= 8 * 60 && now.min < 8 * 60 + 30 && FB.holidays) {
      const sp = FB.holidays.on(now.date);
      const hol = sp.filter((x: any) => x.type === "holiday" || x.type === "off");
      if (hol.length) items.push({ key: `hol:${hid}:${now.date}`, title: "", body: () => "", hol } as any);
      const { data: mem } = await sb.from("members").select("id,name").eq("household_id", hid);
      const saint = sp.find((x: any) => x.type === "nameday");
      for (const m of FB.holidays.celebrants(now.date, mem || [])) {
        items.push({ key: `nd:${m.id}:${now.date}`, title: "", body: () => "", nd: { name: m.name, saint: saint ? saint.sq : "" } } as any);
      }
    }

    /* "chore done" and "new chore" from the activity queue */
    const mine = ev.filter((e) => e.household_id === hid);
    if (mine.length) {
      const { data: members } = await sb.from("members").select("id,name").eq("household_id", hid);
      const nameOf = (id: string | null) => (members || []).find((m) => m.id === id)?.name || null;
      const doneEv = mine.filter((e) => e.kind === "done");
      if (doneEv.length) {
        const { data: comps } = await sb.from("chore_completions").select("*").in("id", doneEv.map((e) => e.ref));
        const rows = (comps || []).map((c) => ({ c, e: doneEv.find((x) => x.ref === c.id)!, chore: (chores || []).find((x) => x.id === c.chore_id) })).filter((r) => r.chore);
        if (rows.length > 3) {
          items.push({ key: `dn:${rows[0].c.id}`, title: "✅", body: (l) => tx(l, "doneMany", { n: rows.length }) });
        } else rows.forEach((r) => {
          const t = localNow(tz, new Date(r.c.done_at)).hhmm;
          items.push({ key: `dn:${r.c.id}`, title: "✅ " + (r.chore.emoji ? r.chore.emoji + " " : "") + r.chore.title,
            body: (l) => tx(l, "doneBy", { who: nameOf(r.c.done_by) || tx(l, "someone"), time: t }) });
        });
      }
      const addEv = mine.filter((e) => e.kind === "added");
      if (addEv.length) {
        const added = (chores || []).filter((c) => addEv.some((e) => e.ref === c.id));
        if (added.length === 1) items.push({ key: `ad:${added[0].id}`, title: "🆕 " + (added[0].emoji ? added[0].emoji + " " : "") + added[0].title, body: (l) => tx(l, "newChore") });
        else if (added.length > 1) items.push({ key: `ad:${added[0].id}`, title: "", body: () => "", many: added });
      }
    }

    for (const it of items) {
      if (dry) { const { data: was } = await sb.from("push_log").select("key").eq("key", it.key).maybeSingle(); if (!was) sent.push(it.key); continue; }
      const { error } = await sb.from("push_log").insert({ key: it.key });
      if (error) continue; // already sent
      sent.push(it.key);
      if (dry) continue;
      await Promise.all(list.map(async (s) => {
        try {
          const l = TXT[s.lang] ? s.lang : "en";
          let title = it.title, body = it.body(l);
          if (it.digest) {
            title = "📅 " + tx(l, "tomorrow");
            body = it.digest.slice(0, 5).map((e: any) => (e.kind === "birthday" ? "🎂 " : "") + (e.start_time && e.all_day === false ? e.start_time + " " : "") + e.title).join(" · ");
          }
          const anyIt = it as any;
          if (anyIt.hol) { const x = anyIt.hol[0]; title = x.icon + " " + (l === "sq" ? x.sq : x.en); body = tx(l, x.type === "off" ? "off" : "holiday"); }
          if (anyIt.nd) { title = "🎉 " + tx(l, "nameday", { name: anyIt.nd.name }); body = tx(l, "namedayBody", { saint: anyIt.nd.saint }); }
          if (it.many) { title = "🆕 " + tx(l, "newMany", { n: it.many.length }); body = it.many.slice(0, 5).map((c: any) => (c.emoji ? c.emoji + " " : "") + c.title).join(" · "); }
          const r = await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title, body, tag: it.key }), { urgency: "high", TTL: 3600 });
          console.log("push sent", it.key, r.statusCode);
        } catch (err: any) {
          console.error("push failed", it.key, err.statusCode, String(err.body || err.message).slice(0, 200));
          if (err.statusCode === 404 || err.statusCode === 410) await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      }));
    }
  }
  /* morning weather alert, per phone (each phone has its own place) */
  for (const sub of (subs || []).filter((x) => x.wx_alert !== false)) {
    const now = localNow(await tzOf(sub.household_id));
    if (now.min < 7 * 60 + 30 || now.min >= 8 * 60) continue;
    const key = `wx:${hashKey(sub.endpoint)}:${now.date}`;
    const { data: seen } = await sb.from("push_log").select("key").eq("key", key).maybeSingle();
    if (seen) continue;
    const l = TXT[sub.lang] ? sub.lang : "en";
    const lines = wxLines(await forecast(sub.lat ?? 41.3275, sub.lon ?? 19.8187), l);
    if (!lines.length) continue;
    if (dry) { sent.push(key + " " + lines.join(" | ")); continue; }
    const { error } = await sb.from("push_log").insert({ key });
    if (error) continue;
    sent.push(key);
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title: "🌦️ " + tx(l, "wxTitle") + (sub.place ? " · " + sub.place : ""), body: lines.join("\n"), tag: key }), { urgency: "high", TTL: 3600 });
      console.log("push sent", key);
    } catch (err: any) { console.error("push failed", key, err.statusCode); }
  }

  const old = new Date(Date.now() - 3 * 86400e3).toISOString();
  await sb.from("push_log").delete().lt("sent_at", old);
  await sb.from("push_events").delete().lt("created_at", old);
  return new Response(JSON.stringify({ sent, ac: acRan }), { headers: { "content-type": "application/json" } });
});
