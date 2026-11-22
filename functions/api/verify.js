function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}})}
function safeEqual(a,b){if(!a||!b||a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0}
export async function onRequestPost({request,env}){
 if(!env.DB)return json({ok:false,message:"Database is not configured."},503);
 if(!env.ADMIN_KEY)return json({ok:false,message:"Admin key is not configured."},503);
 if(!safeEqual(request.headers.get("x-admin-key")||"",env.ADMIN_KEY))return json({ok:false,message:"Unauthorized."},401);
 let body;try{body=await request.json()}catch{return json({ok:false,message:"Invalid JSON."},400)}
 const token=String(body.token||"").trim(),mechanicName=String(body.mechanicName||"").trim();
 if(!/^[A-Za-z0-9_-]{20,120}$/.test(token))return json({ok:false,message:"Invalid QR code."},400);
 if(mechanicName.length<2||mechanicName.length>80)return json({ok:false,message:"Select a saved mechanic."},400);
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS mechanics (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL COLLATE NOCASE UNIQUE,active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))").run();
 const mechanic=await env.DB.prepare("SELECT name FROM mechanics WHERE name=? COLLATE NOCASE AND active=1").bind(mechanicName).first();
 if(!mechanic)return json({ok:false,message:"Select an active mechanic from the saved list."},400);
 const now=new Date().toISOString();
 const result=await env.DB.prepare("UPDATE qr_codes SET status='scanned',mechanic_name=?,scanned_at=? WHERE token=? AND status='unused' AND EXISTS(SELECT 1 FROM products WHERE products.id=qr_codes.product_id AND products.active=1) RETURNING id,product_id").bind(mechanic.name,now,token).first();
 if(!result){
  const existing=await env.DB.prepare("SELECT status FROM qr_codes WHERE token=?").bind(token).first();
  if(!existing)return json({ok:false,status:"invalid",message:"QR code not recognized."},404);
  if(existing.status==="scanned")return json({ok:false,status:"already_scanned",message:"ALREADY SCANNED — reward already claimed."},409);
  return json({ok:false,status:existing.status,message:"This QR code is disabled or its product is inactive."},409);
 }
 const scan=await env.DB.prepare("SELECT s.id,p.name AS product_name,s.mechanic_name,s.reward_amount_paisa,s.scanned_at FROM scans s JOIN products p ON p.id=s.product_id WHERE s.qr_code_id=?").bind(result.id).first();
 if(!scan)return json({ok:false,message:"Scan was recorded but its receipt could not be loaded. Check scan history."},500);
 return json({ok:true,status:"valid",message:"VALID QR — reward approved.",scan:{id:scan.id,product:scan.product_name,mechanic:scan.mechanic_name,reward:(scan.reward_amount_paisa/100).toFixed(2),scannedAt:scan.scanned_at}});
}