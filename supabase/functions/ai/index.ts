// AI helpers for the family board: daily summary and shopping list tidy-up.
// The Gemini key lives in the private table public.ai_config, never in the app.
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });
const DAILY_LIMIT = 150;

async function gemini(cfg: any, system: string, parts: any[], asJson: boolean) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent`;
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts }],
    generationConfig: asJson ? { responseMimeType: "application/json", temperature: 0.2 } : { temperature: 0.6 },
  };
  for (let i = 0; i < 2; i++) {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": cfg.gemini_key }, body: JSON.stringify(body) });
    if (r.status === 429) throw new Error("busy");
    if (r.status >= 500 && i === 0) { await new Promise((x) => setTimeout(x, 800)); continue; }
    if (!r.ok) throw new Error("ai_" + r.status);
    const j = await r.json();
    const text = (j.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || "").join("").trim();
    if (!text) throw new Error("empty");
    return text;
  }
  throw new Error("ai_failed");
}
const parse = (s: string) => JSON.parse(s.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim());

const LANG: Record<string, string> = { en: "English", sq: "Albanian (Shqip)" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await sb.auth.getUser(jwt);
    if (!u?.user) return json({ error: "auth" }, 401);
    const { data: member } = await sb.from("members").select("id,household_id").eq("user_id", u.user.id).limit(1).maybeSingle();
    if (!member) return json({ error: "auth" }, 403);
    const b = await req.json();
    const lang = LANG[b.lang] || LANG.en;

    /* one summary per household and language: reuse it for an hour (and only for the same day) */
    if (b.action === "summary") {
      const day = String((b.context && b.context.date) || new Date().toISOString().slice(0, 10)).slice(0, 10);
      const { data: cached } = await sb.from("ai_summary").select("*").eq("household_id", member.household_id).eq("lang", b.lang === "sq" ? "sq" : "en").maybeSingle();
      if (cached && cached.day === day && Date.now() - new Date(cached.at).getTime() < 60 * 60 * 1000) {
        return json({ ok: true, data: { text: cached.text, shared: true } });
      }
    }

    const { data: use } = await sb.from("ai_usage").select("n").eq("user_id", u.user.id).eq("day", new Date().toISOString().slice(0, 10)).maybeSingle();
    if ((use?.n || 0) >= DAILY_LIMIT) return json({ error: "limit" }, 429);
    await sb.from("ai_usage").upsert({ user_id: u.user.id, day: new Date().toISOString().slice(0, 10), n: (use?.n || 0) + 1 });

    const { data: cfg } = await sb.from("ai_config").select("*").eq("id", 1).single();
    if (!cfg) return json({ error: "config" }, 500);

    if (b.action === "summary") {
      const sys = `You write the one-line daily summary shown on a family's wall tablet in Albania. Write in ${lang}, warm and plain, at most 2 short sentences (about 30 words). Mention only what matters today: a public holiday or a family member's name day if there is one (congratulate them), events (with times), chores still to do, weather only if notable (rain, cold, hot), and shopping only if the list is not empty. No greetings, no emojis, no lists, no markdown.`;
      const text = (await gemini(cfg, sys, [{ text: JSON.stringify(b.context).slice(0, 4000) }], false)).replace(/\s+/g, " ").slice(0, 300);
      const day = String((b.context && b.context.date) || new Date().toISOString().slice(0, 10)).slice(0, 10);
      await sb.from("ai_summary").upsert({ household_id: member.household_id, lang: b.lang === "sq" ? "sq" : "en", day, text, at: new Date().toISOString() });
      return json({ ok: true, data: { text } });
    }
    if (b.action === "tidy") {
      const sys = `You tidy a family shopping list. Items may be in Albanian or English. For each item give a cleaned-up short name in the same language (fix typos, capitalise the first letter, keep quantities like "2 litra qumësht") and a category. Detect duplicates (same product, even if spelled differently) and list them in "merge" as groups of ids, the first id being the one to keep.
Reply with JSON only: {"items":[{"id":string,"title":string,"category":"produce"|"dairy"|"bakery"|"meat"|"pantry"|"frozen"|"drinks"|"household"|"personal"|"other"}],"merge":[string[]]}. Every input id must appear in "items".`;
      const out = parse(await gemini(cfg, sys, [{ text: JSON.stringify(b.items || []).slice(0, 6000) }], true));
      return json({ ok: true, data: { items: out.items || [], merge: out.merge || [] } });
    }
    return json({ error: "action" }, 400);
  } catch (e) {
    const m = String((e as Error).message || e);
    if (m === "busy") return json({ error: "busy" }, 429);
    console.error(m);
    return json({ error: "failed" }, 500);
  }
});
