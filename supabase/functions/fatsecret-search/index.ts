import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { query, type, maxResults } = await req.json();
    const clientId = Deno.env.get("FATSECRET_CLIENT_ID");
    const clientSecret = Deno.env.get("FATSECRET_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      console.error("[FatSecret] Missing env vars FATSECRET_CLIENT_ID / FATSECRET_CLIENT_SECRET");
      return new Response(JSON.stringify({ error: "Missing FatSecret credentials" }), { status: 500, headers: CORS });
    }

    // OAuth2 token
    const tokenRes = await fetch("https://oauth.fatsecret.com/connect/token", {
      method: "POST",
      headers: { "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials",
    });

    if (!tokenRes.ok) {
      const t = await tokenRes.text();
      console.error("[FatSecret] Token failed", tokenRes.status, t.slice(0, 200));
      return new Response(JSON.stringify({ error: "FatSecret auth failed", status: tokenRes.status, detail: t.slice(0, 200) }), { status: 502, headers: CORS });
    }

    const { access_token: token } = await tokenRes.json();
    if (!token) return new Response(JSON.stringify({ error: "No access_token returned" }), { status: 502, headers: CORS });

    console.log("[FatSecret] token OK. type:", type, "query:", query);

    let result;
    if (type === "nlp") {
      const r = await fetch("https://platform.fatsecret.com/rest/natural-language-processing/v1", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ user_input: query, include_food_data: false, region: "US", language: "en" }),
      });
      if (!r.ok) { console.error("[FatSecret] NLP failed", r.status); return new Response(JSON.stringify({ error: "NLP failed", status: r.status }), { status: 502, headers: CORS }); }
      result = await r.json();
      console.log("[FatSecret] NLP entries:", (result?.food_entries ?? []).length);
    } else {
      const params = new URLSearchParams({ method: "foods.search.v3", search_expression: query, format: "json", max_results: String(maxResults ?? 10), flag_default_serving: "true", region: "US" });
      const r = await fetch(`https://platform.fatsecret.com/rest/server.api?${params}`, { headers: { "Authorization": `Bearer ${token}` } });
      if (!r.ok) { console.error("[FatSecret] Search failed", r.status); return new Response(JSON.stringify({ error: "Search failed", status: r.status }), { status: 502, headers: CORS }); }
      result = await r.json();
      console.log("[FatSecret] Search results:", result?.foods_search?.results?.food?.length ?? 0, "for:", query);
    }

    return new Response(JSON.stringify(result), { headers: CORS });
  } catch (err) {
    console.error("[FatSecret] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});
