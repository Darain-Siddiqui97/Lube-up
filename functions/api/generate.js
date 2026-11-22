function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}})}
function safeEqual(a,b){if(!a||!b||a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0}
function token(){const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);return Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("")}
export async function onRequestPost({request,env}){
 if(!env.DB||!env.ADMIN_KEY)return json({ok:false,message:"Database or admin key is not configured."},503);
 if(!safeEqual(request.headers.get("x-admin-key")||"",env.ADMIN_KEY))return json({ok:false,message:"Unauthorized."},401);
 let body;try{body=await request.json()}catch{return json({ok:false,message:"Invalid JSON."},400)}
 const productId=Number(body.productId), quantity=Number(body.quantity);
 if(!Number.isInteger(productId)||productId<1||!Number.isInteger(quantity)||quantity<1||quantity>500)return json({ok:false,message:"Choose a product and quantity from 1 to 500."},400);
 const product=await env.DB.prepare("SELECT id,name FROM products WHERE id=? AND active=1").bind(productId).first();
 if(!product)return json({ok:false,message:"Product not found or inactive."},404);
 const stmt=env.DB.prepare("INSERT INTO qr_codes(token,product_id) VALUES(?,?)");
 const batch=[];
 const created=[];
 for(let i=0;i<quantity;i++){const t=token();created.push(t);batch.push(stmt.bind(t,productId))}
 await env.DB.batch(batch);
 return json({ok:true,product:product.name,quantity,tokens:created},201);
}
