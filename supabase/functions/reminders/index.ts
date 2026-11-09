// Runs every minute (pg_cron). Sends event reminders and "chore is due" pushes.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import "./shared.js";

const FB = (globalThis as any).FB;
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const TXT: Record<string, Record<string, string>> = {
  en: { chore: "is due", event: "starts in {n} min", now: "starts now", app: "Family Board" },
  sq: { chore: "duhet bërë tani", event: "fillon pas {n} min", now: "fillon tani", app: "Family Board" },
};

function localNow(tz: string) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const p: Record<string, string> = {};
  f.formatToParts(new Date()).forEach((x) => (p[x.type] = x.value));
  return { date: `${p.year}-${p.month}-${p.day}`, min: Number(p.hour) * 60 + Number(p.minute) };
}

Deno.serve(async (req) => {
  const { data: cfg } = await sb.from("push_config").select("*").eq("id", 1).single();
  if (!cfg || req.headers.get("x-cron-secret") !== cfg.cron_secret) return new Response("forbidden", { status: 403 });
  webpush.setVapidDetails("mailto:" + cfg.contact, cfg.vapid_public, cfg.vapid_private);
  const dry = new URL(req.url).searchParams.get("dry") === "1";

  const { data: subs } = await sb.from("push_subscriptions").select("*");
  const byHh = new Map<string, any[]>();
  (subs || []).forEach((s) => byHh.set(s.household_id, [...(byHh.get(s.household_id) || []), s]));
  const sent: string[] = [];

  for (const [hid, list] of byHh) {
    const { data: hh } = await sb.from("households").select("tz").eq("id", hid).single();
    const now = localNow(hh?.tz || "Europe/Tirane");
    const items: { key: string; title: string; body: (l: string) => string }[] = [];

    const { data: events } = await sb.from("events").select("*").eq("household_id", hid).not("remind_minutes", "is", null).not("start_time", "is", null);
    for (const e of events || []) {
      const today = e.rule ? FB.recur.occursOn(Object.assign({}, e.rule, { start: e.rule.start || e.on_date }), now.date) : e.on_date === now.date;
      if (!today) continue;
      const start = FB.util.minutesOf(e.start_time), at = start - Number(e.remind_minutes);
      if (now.min >= at && now.min < start + 1) {
        const left = start - now.min;
        items.push({ key: `e:${e.id}:${now.date}`, title: e.title, body: (l) => left > 0 ? TXT[l].event.replace("{n}", String(left)) : TXT[l].now });
      }
    }

    const { data: chores } = await sb.from("chores").select("*").eq("household_id", hid).eq("active", true).not("due_time", "is", null);
    const { data: done } = await sb.from("chore_completions").select("chore_id").eq("on_date", now.date).eq("household_id", hid);
    const doneSet = new Set((done || []).map((d) => d.chore_id));
    for (const c of chores || []) {
      if (doneSet.has(c.id) || !FB.recur.occursOn(c.rule, now.date)) continue;
      const due = FB.util.minutesOf(c.due_time);
      if (now.min >= due && now.min < due + 30) items.push({ key: `c:${c.id}:${now.date}`, title: (c.emoji ? c.emoji + " " : "") + c.title, body: (l) => TXT[l].chore });
    }

    for (const it of items) {
      const { error } = await sb.from("push_log").insert({ key: it.key });
      if (error) continue; // already sent
      sent.push(it.key);
      if (dry) continue;
      await Promise.all(list.map(async (s) => {
        try {
          const l = TXT[s.lang] ? s.lang : "en";
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({ title: it.title, body: it.body(l), tag: it.key }));
        } catch (err: any) {
          if (err.statusCode === 404 || err.statusCode === 410) await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      }));
    }
  }
  await sb.from("push_log").delete().lt("sent_at", new Date(Date.now() - 3 * 86400e3).toISOString());
  return new Response(JSON.stringify({ sent }), { headers: { "content-type": "application/json" } });
});
