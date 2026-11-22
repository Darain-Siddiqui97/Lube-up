function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}})}
function safeEqual(a,b){if(!a||!b||a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0}
async function setup(DB){
 await DB.prepare("CREATE TABLE IF NOT EXISTS mechanics (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL COLLATE NOCASE UNIQUE, active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))").run();
 await DB.prepare("INSERT OR IGNORE INTO mechanics(name) SELECT DISTINCT TRIM(mechanic_name) FROM scans WHERE TRIM(mechanic_name)<>''").run();
}
export async function onRequest({request,env}){
 if(!env.DB||!env.ADMIN_KEY)return json({ok:false,message:"Database or admin key is not configured."},503);
 if(!safeEqual(request.headers.get("x-admin-key")||"",env.ADMIN_KEY))return json({ok:false,message:"Unauthorized."},401);
 await setup(env.DB);
 if(request.method==="GET"){
  const r=await env.DB.prepare("SELECT id,name,active,created_at FROM mechanics ORDER BY active DESC,name COLLATE NOCASE").all();
  return json({ok:true,mechanics:r.results||[]});
 }
 let body={};try{body=await request.json()}catch{return json({ok:false,message:"Invalid JSON."},400)}
 if(request.method==="POST"){
  const name=String(body.name||"").trim();
  if(name.length<2||name.length>80)return json({ok:false,message:"Mechanic name must be 2–80 characters."},400);
  try{const m=await env.DB.prepare("INSERT INTO mechanics(name) VALUES(?) RETURNING id,name,active").bind(name).first();return json({ok:true,mechanic:m},201)}
  catch(e){return json({ok:false,message:"This mechanic already exists."},409)}
 }
 const id=Number(body.id);
 if(!Number.isInteger(id)||id<1)return json({ok:false,message:"Valid mechanic ID is required."},400);
 if(request.method==="PUT"){
  const name=String(body.name||"").trim();
  if(name.length<2||name.length>80)return json({ok:false,message:"Mechanic name must be 2–80 characters."},400);
  try{const m=await env.DB.prepare("UPDATE mechanics SET name=? WHERE id=? RETURNING id,name,active").bind(name,id).first();return m?json({ok:true,mechanic:m}):json({ok:false,message:"Mechanic not found."},404)}
  catch(e){return json({ok:false,message:"This mechanic name already exists."},409)}
 }
 if(request.method==="DELETE"){
  const m=await env.DB.prepare("UPDATE mechanics SET active=0 WHERE id=? RETURNING id,name,active").bind(id).first();
  return m?json({ok:true,mechanic:m,message:"Mechanic deactivated; old scan history is preserved."}):json({ok:false,message:"Mechanic not found."},404);
 }
 if(request.method==="PATCH"){
  const active=Number(body.active);
  if(![0,1].includes(active))return json({ok:false,message:"Active must be 0 or 1."},400);
  const m=await env.DB.prepare("UPDATE mechanics SET active=? WHERE id=? RETURNING id,name,active").bind(active,id).first();
  return m?json({ok:true,mechanic:m}):json({ok:false,message:"Mechanic not found."},404);
 }
 return json({ok:false,message:"Method not allowed."},405);
}