function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}})}
function safeEqual(a,b){if(!a||a.length!==b.length)return false;let out=0;for(let i=0;i<a.length;i++)out|=a.charCodeAt(i)^b.charCodeAt(i);return out===0}
function authorized(request,env){return !!env.ADMIN_KEY&&safeEqual(request.headers.get("x-admin-key")||"",env.ADMIN_KEY)}
export async function onRequest({request,env}){
 if(!env.DB||!env.ADMIN_KEY)return json({ok:false,message:"Database or admin key is not configured."},503);
 if(!authorized(request,env))return json({ok:false,message:"Unauthorized."},401);
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS archived_scans (id INTEGER PRIMARY KEY, mechanic_name TEXT NOT NULL, product_name TEXT NOT NULL, reward_amount_paisa INTEGER NOT NULL, scanned_at TEXT NOT NULL)").run();
 if(request.method==="GET"){
  const url=new URL(request.url);
  const limit=Math.min(100,Math.max(1,Number.parseInt(url.searchParams.get("limit")||"100",10)||100));
  const offset=Math.max(0,Number.parseInt(url.searchParams.get("offset")||"0",10)||0);
  const mechanic=(url.searchParams.get("mechanic")||"").trim().slice(0,80);
  const from=url.searchParams.get("from")||"";
  const to=url.searchParams.get("to")||"";
  if((from&&!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(from))||(to&&!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(to)))return json({ok:false,message:"Invalid date filter."},400);
  let where=" WHERE 1=1";
  const args=[];
  if(mechanic){where+=" AND h.mechanic_name LIKE ?";args.push("%"+mechanic+"%");}
  if(from){where+=" AND h.scanned_at >= ?";args.push(from+"T00:00:00");}
  if(to){const end=new Date(to+"T00:00:00Z");end.setUTCDate(end.getUTCDate()+1);where+=" AND h.scanned_at < ?";args.push(end.toISOString().slice(0,10)+"T00:00:00");}
  const source="(SELECT s.id,s.mechanic_name,p.name AS product_name,s.reward_amount_paisa,s.scanned_at FROM scans s JOIN products p ON p.id=s.product_id UNION ALL SELECT a.id,a.mechanic_name,a.product_name,a.reward_amount_paisa,a.scanned_at FROM archived_scans a)";
  const total=await env.DB.prepare("SELECT COUNT(*) AS total FROM "+source+" h"+where).bind(...args).first();
  const rows=await env.DB.prepare("SELECT h.id,h.mechanic_name,h.product_name,h.reward_amount_paisa,h.scanned_at FROM "+source+" h"+where+" ORDER BY h.scanned_at DESC,h.id DESC LIMIT ? OFFSET ?").bind(...args,limit,offset).all();
  return json({ok:true,rows:rows.results||[],total:total.total||0,limit,offset});
 }
 if(request.method==="DELETE"){
  let body;try{body=await request.json()}catch{return json({ok:false,message:"Invalid JSON."},400)}
  if(body.all===true){
   const results=await env.DB.batch([env.DB.prepare("DELETE FROM scans"),env.DB.prepare("DELETE FROM archived_scans")]);
   const deleted=results.reduce((sum,r)=>sum+(r.meta?.changes||0),0);
   return json({ok:true,deleted,message:"History deleted. QR codes remain permanently scanned or retired."});
  }
  const ids=Array.isArray(body.ids)?[...new Set(body.ids.map(Number).filter(n=>Number.isSafeInteger(n)&&n>0))]:[];
  if(!ids.length||ids.length>100)return json({ok:false,message:"Select between 1 and 100 valid history records."},400);
  const placeholders=ids.map(()=>"?").join(",");
  const results=await env.DB.batch([
   env.DB.prepare("DELETE FROM scans WHERE id IN ("+placeholders+")").bind(...ids),
   env.DB.prepare("DELETE FROM archived_scans WHERE id IN ("+placeholders+")").bind(...ids)
  ]);
  const deleted=results.reduce((sum,r)=>sum+(r.meta?.changes||0),0);
  return json({ok:true,deleted,message:"History deleted. QR codes remain permanently scanned or retired."});
 }
 return json({ok:false,message:"Method not allowed."},405);
}