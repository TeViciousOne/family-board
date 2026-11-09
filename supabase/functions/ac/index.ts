// Air conditioner control through the Tuya (Smart Life) cloud API.
// Credentials live in the private table public.ac_config, never in the app.
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });
const ENDPOINTS = ["https://openapi.tuyaeu.com", "https://openapi-weaz.tuyaeu.com", "https://openapi.tuyaus.com", "https://openapi-ueaz.tuyaus.com", "https://openapi.tuyain.com", "https://openapi.tuyacn.com"];

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const sha256 = async (s: string) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
async function hmac(key: string, msg: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg))).toUpperCase();
}

let tokenCache: { token: string; exp: number; endpoint: string } | null = null;

async function call(cfg: any, endpoint: string, method: string, path: string, body: unknown, token: string | null) {
  const t = String(Date.now()), nonce = crypto.randomUUID();
  const payload = body ? JSON.stringify(body) : "";
  const stringToSign = [method, await sha256(payload), "", path].join("\n");
  const sign = await hmac(cfg.access_secret, cfg.access_id + (token || "") + t + nonce + stringToSign);
  const headers: Record<string, string> = { client_id: cfg.access_id, sign, t, nonce, sign_method: "HMAC-SHA256", "content-type": "application/json" };
  if (token) headers.access_token = token;
  const r = await fetch(endpoint + path, { method, headers, body: payload || undefined });
  return await r.json();
}

async function getToken(cfg: any) {
  if (tokenCache && tokenCache.exp > Date.now() + 60000) return tokenCache;
  const tried: string[] = [];
  for (const ep of [cfg.endpoint, ...ENDPOINTS.filter((e) => e !== cfg.endpoint)]) {
    const r = await call(cfg, ep, "GET", "/v1.0/token?grant_type=1", null, null);
    if (r.success) {
      tokenCache = { token: r.result.access_token, exp: Date.now() + (r.result.expire_time - 120) * 1000, endpoint: ep };
      if (ep !== cfg.endpoint) await sb.from("ac_config").update({ endpoint: ep }).eq("id", 1);
      return tokenCache;
    }
    tried.push(ep + " -> " + r.code + " " + r.msg);
  }
  throw new Error("tuya_token: " + tried.join(" | "));
}

async function tuya(cfg: any, method: string, path: string, body?: unknown) {
  const tk = await getToken(cfg);
  const r = await call(cfg, tk.endpoint, method, path, body || null, tk.token);
  if (!r.success) { if (r.code === 1010 || r.code === 1011) tokenCache = null; throw new Error("tuya " + r.code + " " + r.msg); }
  return r.result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { data: cfg } = await sb.from("ac_config").select("*").eq("id", 1).maybeSingle();
    const secret = req.headers.get("x-cron-secret");
    let admin = false;
    if (secret) {
      const { data: pc } = await sb.from("push_config").select("cron_secret").eq("id", 1).single();
      admin = !!pc && pc.cron_secret === secret;
      if (!admin) return json({ error: "auth" }, 401);
    } else {
      const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const { data: u } = await sb.auth.getUser(jwt);
      if (!u?.user) return json({ error: "auth" }, 401);
      const { data: member } = await sb.from("members").select("id").eq("user_id", u.user.id).limit(1).maybeSingle();
      if (!member) return json({ error: "auth" }, 403);
    }
    if (!cfg) return json({ error: "config" }, 500);
    const b = await req.json().catch(() => ({}));
    const dev = encodeURIComponent(cfg.device_id);

    if (b.action === "info") { /* what the air conditioner supports and its current state */
      const [details, specs, status] = await Promise.all([
        tuya(cfg, "GET", `/v1.0/devices/${dev}`), tuya(cfg, "GET", `/v1.0/devices/${dev}/specifications`), tuya(cfg, "GET", `/v1.0/devices/${dev}/status`),
      ]);
      return json({ ok: true, data: { name: details.name, online: details.online, category: details.category, functions: specs.functions, status } });
    }
    if (b.action === "status") {
      const [details, status] = await Promise.all([tuya(cfg, "GET", `/v1.0/devices/${dev}`), tuya(cfg, "GET", `/v1.0/devices/${dev}/status`)]);
      return json({ ok: true, data: { online: details.online, status } });
    }
    if (b.action === "set") {
      const specs = await tuya(cfg, "GET", `/v1.0/devices/${dev}/specifications`);
      const allowed = new Set((specs.functions || []).map((f: any) => f.code));
      const commands = (Array.isArray(b.commands) ? b.commands : []).filter((c: any) => c && allowed.has(c.code)).slice(0, 6);
      if (!commands.length) return json({ error: "command" }, 400);
      await tuya(cfg, "POST", `/v1.0/devices/${dev}/commands`, { commands });
      return json({ ok: true });
    }
    return json({ error: "action" }, 400);
  } catch (e) {
    console.error(String((e as Error).message || e));
    return json({ error: "failed", detail: admin_detail(e) }, 500);
  }
});
function admin_detail(e: unknown) { return String((e as Error).message || e).slice(0, 300); }
