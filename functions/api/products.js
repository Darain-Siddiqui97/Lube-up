function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}
function safeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}
function authorized(request, env) {
  return env.ADMIN_KEY && safeEqual(request.headers.get("x-admin-key") || "", env.ADMIN_KEY);
}
export async function onRequest({ request, env }) {
  if (!env.DB || !env.ADMIN_KEY) return json({ ok:false, message:"Database or admin key is not configured." },503);
  if (!authorized(request,env)) return json({ok:false,message:"Unauthorized."},401);
  if (request.method === "GET") {
    const products = await env.DB.prepare(
      "SELECT p.id,p.name,p.reward_amount_paisa,p.active,COUNT(q.id) AS total_qr, SUM(CASE WHEN q.status='scanned' THEN 1 ELSE 0 END) AS scanned_qr FROM products p LEFT JOIN qr_codes q ON q.product_id=p.id GROUP BY p.id ORDER BY p.id DESC"
    ).all();
    const stats = await env.DB.prepare(
      "SELECT COUNT(*) AS total_scans, COALESCE(SUM(reward_amount_paisa),0) AS total_rewards FROM scans"
    ).first();
    return json({ok:true,products:products.results || [],stats});
  }
  if (request.method === "POST") {
    let body;
    try { body = await request.json(); } catch { return json({ok:false,message:"Invalid JSON."},400); }
    const name = String(body.name || "").trim();
    const amount = Number(body.reward);
    if (name.length < 2 || name.length > 100 || !Number.isFinite(amount) || amount < 0 || amount > 1000000)
      return json({ok:false,message:"Enter a product name and a valid reward amount."},400);
    const result = await env.DB.prepare(
      "INSERT INTO products(name,reward_amount_paisa) VALUES(?,?) RETURNING id,name,reward_amount_paisa,active"
    ).bind(name,Math.round(amount*100)).first();
    return json({ok:true,product:result},201);
  }
  return json({ok:false,message:"Method not allowed."},405);
}
