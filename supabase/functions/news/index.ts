// News strip for the family board: Euronews Albania (RSS), Top Channel (homepage scrape,
// its feeds are blocked) and crude oil prices (Yahoo chart API). Cached in memory for 10 min.
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "content-type": "application/json" } });
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";
const TTL = 10 * 60 * 1000;
let cache: { at: number; data: any } | null = null;

const dec = (s: string) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const get = (u: string) => fetch(u, { headers: { "user-agent": UA, "accept-language": "sq,en;q=0.8" }, signal: AbortSignal.timeout(8000) });

async function euronews() {
  const r = await get("https://euronews.al/feed");
  if (!r.ok) throw new Error("euronews " + r.status);
  const x = await r.text();
  const out: any[] = [];
  for (const m of x.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const b = m[1];
    const t = dec((b.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "");
    const l = dec((b.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || "");
    const d = Date.parse(dec((b.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || ""));
    if (t && l) out.push({ s: "euronews", t, l, ts: d || 0 });
    if (out.length >= 8) break;
  }
  return out;
}

async function topchannel() {
  const r = await get("https://top-channel.tv/");
  if (!r.ok) throw new Error("top " + r.status);
  const h = await r.text();
  const seen = new Set<string>();
  const out: any[] = [];
  for (const m of h.matchAll(/<a\s[^>]*href="(https:\/\/top-channel\.tv\/(\d{4})\/(\d\d)\/(\d\d)\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const t = dec(m[5]);
    if (t.length < 25 || seen.has(m[1])) continue;
    seen.add(m[1]);
    out.push({ s: "top", t, l: m[1], ts: Date.parse(`${m[2]}-${m[3]}-${m[4]}T12:00:00Z`) || 0 });
    if (out.length >= 8) break;
  }
  return out;
}

async function oil(sym: string) {
  const r = await get(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=5d`);
  if (!r.ok) throw new Error("oil " + r.status);
  const m = (await r.json())?.chart?.result?.[0]?.meta;
  const p = m?.regularMarketPrice, prev = m?.chartPreviousClose ?? m?.previousClose;
  if (typeof p !== "number") throw new Error("oil_empty");
  return { p: Math.round(p * 100) / 100, c: typeof prev === "number" && prev ? Math.round(((p - prev) / prev) * 1000) / 10 : null };
}

async function load() {
  const [a, b, w, br] = await Promise.allSettled([euronews(), topchannel(), oil("CL=F"), oil("BZ=F")]);
  const val = (x: PromiseSettledResult<any>) => (x.status === "fulfilled" ? x.value : null);
  const items = [...(val(a) || []), ...(val(b) || [])];
  return { items, oil: { wti: val(w), brent: val(br) }, at: Date.now() };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await sb.auth.getUser(jwt);
    if (!u?.user) return json({ error: "auth" }, 401);
    const { data: member } = await sb.from("members").select("id").eq("user_id", u.user.id).limit(1).maybeSingle();
    if (!member) return json({ error: "auth" }, 403);
    if (!cache || Date.now() - cache.at > TTL) {
      const data = await load();
      // keep the old copy if everything failed
      if (data.items.length || data.oil.wti || data.oil.brent || !cache) cache = { at: Date.now(), data };
    }
    return json({ ok: true, data: cache.data });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
