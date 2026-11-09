// Runs every minute (pg_cron). Sends: event reminders, "chore is due", "chore done by X", "new chore added",
// and an evening list of tomorrow's events.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import "./shared.js";

const FB = (globalThis as any).FB;
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const DIGEST_HOUR = 19; // local time of the "tomorrow" message

const TXT: Record<string, Record<string, string>> = {
  en: { chore: "is due", event: "starts in {n} min", now: "starts now", doneBy: "Done by {who} at {time}", someone: "someone",
        doneMany: "{n} chores done", newChore: "New chore", newMany: "{n} new chores", tomorrow: "Tomorrow", allDay: "all day" },
  sq: { chore: "duhet bërë tani", event: "fillon pas {n} min", now: "fillon tani", doneBy: "E ka bërë {who} në {time}", someone: "dikush",
        doneMany: "{n} detyra u bënë", newChore: "Detyrë e re", newMany: "{n} detyra të reja", tomorrow: "Nesër", allDay: "gjithë ditën" },
};
const tx = (l: string, k: string, v: Record<string, string | number> = {}) =>
  Object.keys(v).reduce((s, x) => s.replace("{" + x + "}", String(v[x])), (TXT[l] || TXT.en)[k]);

function localNow(tz: string, at = new Date()) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const p: Record<string, string> = {};
  f.formatToParts(at).forEach((x) => (p[x.type] = x.value));
  return { date: `${p.year}-${p.month}-${p.day}`, min: Number(p.hour) * 60 + Number(p.minute), hhmm: `${p.hour}:${p.minute}` };
}
const addDay = (d: string) => { const t = new Date(d + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() + 1); return t.toISOString().slice(0, 10); };

type Item = { key: string; title: string; body: (l: string) => string; skipUser?: string | null; digest?: any[]; many?: any[] };

Deno.serve(async (req) => {
  const { data: cfg } = await sb.from("push_config").select("*").eq("id", 1).single();
  if (!cfg || req.headers.get("x-cron-secret") !== cfg.cron_secret) return new Response("forbidden", { status: 403 });
  webpush.setVapidDetails("mailto:" + cfg.contact, cfg.vapid_public, cfg.vapid_private);
  const dry = new URL(req.url).searchParams.get("dry") === "1";

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
          items.push({ key: `dn:${rows[0].c.id}`, title: "✅", body: (l) => tx(l, "doneMany", { n: rows.length }), skipUser: rows[0].e.actor });
        } else rows.forEach((r) => {
          const t = localNow(tz, new Date(r.c.done_at)).hhmm;
          items.push({ key: `dn:${r.c.id}`, title: "✅ " + (r.chore.emoji ? r.chore.emoji + " " : "") + r.chore.title,
            body: (l) => tx(l, "doneBy", { who: nameOf(r.c.done_by) || tx(l, "someone"), time: t }), skipUser: r.e.actor });
        });
      }
      const addEv = mine.filter((e) => e.kind === "added");
      if (addEv.length) {
        const added = (chores || []).filter((c) => addEv.some((e) => e.ref === c.id));
        if (added.length === 1) items.push({ key: `ad:${added[0].id}`, title: "🆕 " + (added[0].emoji ? added[0].emoji + " " : "") + added[0].title, body: (l) => tx(l, "newChore"), skipUser: addEv[0].actor });
        else if (added.length > 1) items.push({ key: `ad:${added[0].id}`, title: "", body: () => "", skipUser: addEv[0].actor, many: added });
      }
    }

    for (const it of items) {
      const { error } = await sb.from("push_log").insert({ key: it.key });
      if (error) continue; // already sent
      sent.push(it.key);
      if (dry) continue;
      await Promise.all(list.filter((s) => !it.skipUser || s.user_id !== it.skipUser).map(async (s) => {
        try {
          const l = TXT[s.lang] ? s.lang : "en";
          let title = it.title, body = it.body(l);
          if (it.digest) {
            title = "📅 " + tx(l, "tomorrow");
            body = it.digest.slice(0, 5).map((e: any) => (e.kind === "birthday" ? "🎂 " : "") + (e.start_time && e.all_day === false ? e.start_time + " " : "") + e.title).join(" · ");
          }
          if (it.many) { title = "🆕 " + tx(l, "newMany", { n: it.many.length }); body = it.many.slice(0, 5).map((c: any) => (c.emoji ? c.emoji + " " : "") + c.title).join(" · "); }
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title, body, tag: it.key }));
        } catch (err: any) {
          if (err.statusCode === 404 || err.statusCode === 410) await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      }));
    }
  }
  const old = new Date(Date.now() - 3 * 86400e3).toISOString();
  await sb.from("push_log").delete().lt("sent_at", old);
  await sb.from("push_events").delete().lt("created_at", old);
  return new Response(JSON.stringify({ sent }), { headers: { "content-type": "application/json" } });
});
