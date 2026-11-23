function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}})}
function safeEqual(a,b){if(!a||!b||a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0}
function authorized(request,env){return !!env.ADMIN_KEY&&safeEqual(request.headers.get("x-admin-key")||"",env.ADMIN_KEY)}
export async function onRequest({request,env}){
 if(!env.DB||!env.ADMIN_KEY)return json({ok:false,message:"Database or admin key is not configured."},503);
 if(!authorized(request,env))return json({ok:false,message:"Unauthorized."},401);
 if(request.method==="GET"){
  const products=await env.DB.prepare("SELECT p.id,p.name,p.reward_amount_paisa,p.active,COUNT(q.id) AS total_qr,SUM(CASE WHEN q.status='scanned' THEN 1 ELSE 0 END) AS scanned_qr FROM products p LEFT JOIN qr_codes q ON q.product_id=p.id GROUP BY p.id ORDER BY p.id DESC").all();
  const stats=await env.DB.prepare("SELECT COUNT(*) AS total_scans,COALESCE(SUM(reward_amount_paisa),0) AS total_rewards FROM scans").first();
  return json({ok:true,products:products.results||[],stats});
 }
 let body={};try{body=await request.json()}catch{return json({ok:false,message:"Invalid JSON."},400)}
 if(request.method==="POST"){
  const name=String(body.name||"").trim(),amount=Number(body.reward);
  if(name.length<2||name.length>100||!Number.isFinite(amount)||amount<0||amount>1000000)return json({ok:false,message:"Enter a product name and a valid reward amount."},400);
  const p=await env.DB.prepare("INSERT INTO products(name,reward_amount_paisa) VALUES(?,?) RETURNING id,name,reward_amount_paisa,active").bind(name,Math.round(amount*100)).first();
  return json({ok:true,product:p},201);
 }
 const id=Number(body.id);
 if(!Number.isInteger(id)||id<1)return json({ok:false,message:"Valid product ID is required."},400);
 if(request.method==="PUT"){
  const name=String(body.name||"").trim(),amount=Number(body.reward);
  if(name.length<2||name.length>100||!Number.isFinite(amount)||amount<0||amount>1000000)return json({ok:false,message:"Enter a valid product name and reward amount."},400);
  const p=await env.DB.prepare("UPDATE products SET name=?,reward_amount_paisa=? WHERE id=? RETURNING id,name,reward_amount_paisa,active").bind(name,Math.round(amount*100),id).first();
  return p?json({ok:true,product:p}):json({ok:false,message:"Product not found."},404);
 }
 if(request.method==="DELETE"){
  const product=await env.DB.prepare("SELECT id,name FROM products WHERE id=?").bind(id).first();
  if(!product)return json({ok:false,message:"Product not found."},404);
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS archived_scans (id INTEGER PRIMARY KEY, mechanic_name TEXT NOT NULL, product_name TEXT NOT NULL, reward_amount_paisa INTEGER NOT NULL, scanned_at TEXT NOT NULL)").run();
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS retired_qr_tokens (token TEXT PRIMARY KEY, retired_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))").run();
  await env.DB.batch([
   env.DB.prepare("INSERT OR IGNORE INTO archived_scans(id,mechanic_name,product_name,reward_amount_paisa,scanned_at) SELECT s.id,s.mechanic_name,?,s.reward_amount_paisa,s.scanned_at FROM scans s WHERE s.product_id=?").bind(product.name,id),
   env.DB.prepare("INSERT OR IGNORE INTO retired_qr_tokens(token) SELECT token FROM qr_codes WHERE product_id=?").bind(id),
   env.DB.prepare("DELETE FROM scans WHERE product_id=?").bind(id),
   env.DB.prepare("DELETE FROM qr_codes WHERE product_id=?").bind(id),
   env.DB.prepare("DELETE FROM products WHERE id=?").bind(id)
  ]);
  return json({ok:true,product:{id:product.id,name:product.name},message:"Product permanently deleted. Historical scans and rewards are archived; its QR codes are permanently retired."});
 }
 if(request.method==="PATCH"){
  const active=Number(body.active);
  if(![0,1].includes(active))return json({ok:false,message:"Active must be 0 or 1."},400);
  const p=await env.DB.prepare("UPDATE products SET active=? WHERE id=? RETURNING id,name,active").bind(active,id).first();
  return p?json({ok:true,product:p}):json({ok:false,message:"Product not found."},404);
 }
 return json({ok:false,message:"Method not allowed."},405);
}