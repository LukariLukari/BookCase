import { NextRequest, NextResponse } from 'next/server';
import { randomInt } from 'crypto';
import { prisma } from '@/lib/db';
import { verifyJwt } from '@/lib/auth';

export const dynamic = 'force-dynamic';

type Session = { id: string; username: string; role: string };
const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
const bad = (detail: string, status = 400) => json({ detail }, status);
const n = (value: unknown) => Math.max(0, Math.round(Number(value) || 0));

async function session(request: NextRequest): Promise<Session | null> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const payload = verifyJwt(token) as { id?: string; sub?: string } | null;
  if (!payload) return null;
  const user = payload.id
    ? await prisma.user.findUnique({ where: { id: payload.id } })
    : payload.sub ? await prisma.user.findUnique({ where: { username: payload.sub } }) : null;
  return user ? { id: user.id, username: user.username, role: user.role } : null;
}

const productJson = (p: any) => ({ id:p.id, name:p.name, sku:p.sku, category:p.category, image_url:p.imageUrl, selling_price:p.sellingPrice, unit_cost:p.unitCost, stock_quantity:p.stockQuantity, batch_id:p.batchId, batch_name:p.batch?.name||null, social_link:p.socialLink, supplier_info:p.supplierInfo, customer_info:p.customerInfo, notes:p.notes, is_active:p.isActive, created_at:p.createdAt, updated_at:p.updatedAt });
const ledgerJson = (l: any) => { const orders=(l.orders||[]).filter((o:any)=>o.status!=='cancelled'); const revenue=orders.reduce((s:number,o:any)=>s+orderTotals(o).total,0); const expenses=(l.expenses||[]).reduce((s:number,e:any)=>s+e.amount,0); return { id:l.id,user_id:l.userId,name:l.name,month:l.month,opening_cash:l.openingCash,note:l.note,is_closed:l.isClosed,order_count:orders.length,revenue,profit:orders.reduce((s:number,o:any)=>s+orderTotals(o).profit,0)-expenses,created_at:l.createdAt }; };
function orderTotals(o:any){const subtotal=(o.items||[]).reduce((s:number,i:any)=>s+i.quantity*i.unitPrice,0),capital=(o.items||[]).reduce((s:number,i:any)=>s+i.quantity*i.unitCost,0),total=subtotal+o.shippingFee-o.discount,profit=total-capital-o.shippingCost-o.otherFee;return{subtotal,capital_cost:capital,total,profit}}
const orderJson=(o:any)=>({...{id:o.id,user_id:o.userId,ledger_id:o.ledgerId,customer_id:o.customerId,code:o.code,customer_name:o.customerName,customer_contact:o.customerContact,social_link:o.socialLink,shipping_fee:o.shippingFee,shipping_cost:o.shippingCost,discount:o.discount,other_fee:o.otherFee,payment_status:o.paymentStatus,status:o.status,note:o.note,ordered_at:o.orderedAt,created_at:o.createdAt},...orderTotals(o),item_count:(o.items||[]).reduce((s:number,i:any)=>s+i.quantity,0),items:(o.items||[]).map((i:any)=>({id:i.id,product_id:i.productId,product_name:i.productName,quantity:i.quantity,unit_price:i.unitPrice,unit_cost:i.unitCost}))});
const receiptJson=(r:any)=>({id:r.id,user_id:r.userId,code:r.code,batch_id:r.batchId,batch_name:r.batch?.name||null,supplier_name:r.supplierName,extra_cost:r.extraCost,note:r.note,received_at:r.receivedAt,created_at:r.createdAt,total_quantity:(r.items||[]).reduce((s:number,i:any)=>s+i.quantity,0),total_cost:(r.items||[]).reduce((s:number,i:any)=>s+i.quantity*i.unitCost,0)+r.extraCost,items:(r.items||[]).map((i:any)=>({id:i.id,product_id:i.productId,product_name:i.product?.name||'',quantity:i.quantity,unit_cost:i.unitCost}))});
const batchJson=(b:any)=>({id:b.id,name:b.name,product_count:(b.products||[]).filter((p:any)=>p.isActive).length,stock_quantity:(b.products||[]).filter((p:any)=>p.isActive).reduce((s:number,p:any)=>s+p.stockQuantity,0),created_at:b.createdAt});

async function ensureInventoryBatch(userId:string){let batch=await prisma.businessInventoryBatch.findFirst({where:{userId},orderBy:{createdAt:'desc'}});if(!batch)batch=await prisma.businessInventoryBatch.create({data:{userId,name:'Lô hàng 1'}});await prisma.businessProduct.updateMany({where:{userId,batchId:null},data:{batchId:batch.id}});return batch;}
async function resolveOrderCustomer(tx:any,userId:string,body:any){const name=String(body.customer_name||'').trim(),contact=String(body.customer_contact||'').trim()||null,socialLink=String(body.social_link||'').trim()||null;let customer=body.customer_id?await tx.businessCustomer.findFirst({where:{id:body.customer_id,userId}}):null;if(!customer&&contact)customer=await tx.businessCustomer.findFirst({where:{userId,OR:[{phone:contact},{socialLink:contact}]},orderBy:{updatedAt:'desc'}});if(!customer&&socialLink)customer=await tx.businessCustomer.findFirst({where:{userId,socialLink},orderBy:{updatedAt:'desc'}});if(!customer&&!contact&&!socialLink&&name)customer=await tx.businessCustomer.findFirst({where:{userId,name:{equals:name,mode:'insensitive'}},orderBy:{updatedAt:'desc'}});if(customer)return tx.businessCustomer.update({where:{id:customer.id},data:{name:name||customer.name,phone:contact||customer.phone,socialLink:socialLink||customer.socialLink}});return tx.businessCustomer.create({data:{userId,name,phone:contact,socialLink}});}

function inviteCode(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';return 'BC-'+Array.from({length:12},()=>chars[randomInt(chars.length)]).join('')}

async function handle(request:NextRequest, context:RouteContext<'/api/backend/[...path]'>){
 try{
  const user=await session(request); if(!user)return bad('Phiên đăng nhập đã hết hạn.',401);
  const {path}=await context.params; const parts=path[0]==='api'?path.slice(1):path; const method=request.method; const body=method==='GET'||method==='HEAD'?{}:await request.json().catch(()=>({}));
  if(parts[0]==='admin'&&parts[1]==='registration-codes'){
   if(user.role!=='admin')return bad('Bạn không có quyền quản trị.',403);
   if(method==='GET')return json((await prisma.registrationCode.findMany({orderBy:{createdAt:'desc'}})).map(c=>({id:c.id,code:c.code,is_used:c.isUsed,used_by_username:c.usedByUsername,created_by:c.createdBy,created_at:c.createdAt})));
   if(method==='POST'){let code=inviteCode();while(await prisma.registrationCode.findUnique({where:{code}}))code=inviteCode();const c=await prisma.registrationCode.create({data:{code,createdBy:user.username}});return json({id:c.id,code:c.code,is_used:c.isUsed,used_by_username:c.usedByUsername,created_by:c.createdBy,created_at:c.createdAt});}
   const id=parts[2],current=await prisma.registrationCode.findUnique({where:{id}});if(!current)return bad('Mã không tồn tại.',404);if(current.isUsed)return bad('Không thể thay đổi mã đã sử dụng.');
   if(method==='DELETE'){await prisma.registrationCode.delete({where:{id}});return json({message:'Đã xóa mã.'});}
   if(method==='PUT'&&parts[3]==='regenerate'){let code=inviteCode();while(await prisma.registrationCode.findUnique({where:{code}}))code=inviteCode();const c=await prisma.registrationCode.update({where:{id},data:{code}});return json({id:c.id,code:c.code,is_used:c.isUsed,used_by_username:c.usedByUsername,created_by:c.createdBy,created_at:c.createdAt});}
  }
  if(parts[0]!=='business')return bad('API này chưa được chuyển sang Vercel.',404);
  const resource=parts[1],id=parts[2];
  if(resource==='ledgers'){
   if(method==='GET'){const rows=await prisma.businessLedger.findMany({where:{userId:user.id},include:{orders:{include:{items:true}},expenses:true},orderBy:{createdAt:'desc'}});return json(rows.map(ledgerJson));}
   if(method==='POST'){const row=await prisma.businessLedger.create({data:{userId:user.id,name:String(body.name||'').trim(),month:String(body.month||''),openingCash:n(body.opening_cash),note:body.note||null},include:{orders:{include:{items:true}},expenses:true}});return json(ledgerJson(row));}
  }
  if(resource==='inventory-batches'){
   if(method==='GET'){await ensureInventoryBatch(user.id);const rows=await prisma.businessInventoryBatch.findMany({where:{userId:user.id},include:{products:true},orderBy:{createdAt:'desc'}});return json(rows.map(batchJson));}
   if(method==='POST'){const name=String(body.name||'').trim();if(!name)return bad('Tên lô hàng không được để trống.');const row=await prisma.businessInventoryBatch.create({data:{userId:user.id,name},include:{products:true}});return json(batchJson(row));}
   const owned=await prisma.businessInventoryBatch.findFirst({where:{id,userId:user.id},include:{products:true}});if(!owned)return bad('Không tìm thấy lô hàng.',404);
   if(method==='PUT'){const name=String(body.name||'').trim();if(!name)return bad('Tên lô hàng không được để trống.');return json(batchJson(await prisma.businessInventoryBatch.update({where:{id:owned.id},data:{name},include:{products:true}})));}
   if(method==='DELETE'){const replacement=await prisma.businessInventoryBatch.findFirst({where:{userId:user.id,id:{not:owned.id}},orderBy:{createdAt:'desc'}});if(!replacement)return bad('Cần giữ lại ít nhất một lô hàng.');await prisma.$transaction([prisma.businessProduct.updateMany({where:{batchId:owned.id},data:{batchId:replacement.id}}),prisma.businessStockReceipt.updateMany({where:{batchId:owned.id},data:{batchId:replacement.id}}),prisma.businessInventoryBatch.delete({where:{id:owned.id}})]);return json({message:'Đã xóa lô hàng và chuyển sản phẩm sang lô gần nhất.',replacement_batch_id:replacement.id});}
  }
  if(resource==='products'){
   if(method==='GET'){await ensureInventoryBatch(user.id);return json((await prisma.businessProduct.findMany({where:{userId:user.id,isActive:true},include:{batch:true},orderBy:{createdAt:'desc'}})).map(productJson));}
   const requestedBatch=body.batch_id?await prisma.businessInventoryBatch.findFirst({where:{id:body.batch_id,userId:user.id}}):null;if(body.batch_id&&!requestedBatch)return bad('Không tìm thấy lô hàng.',404);
   const data={name:String(body.name||'').trim(),sku:body.sku||null,category:body.category||null,imageUrl:body.image_url||null,sellingPrice:n(body.selling_price),unitCost:n(body.unit_cost),stockQuantity:n(body.stock_quantity),notes:body.notes||null};
   if(method==='POST'){const batch=requestedBatch||await ensureInventoryBatch(user.id);return json(productJson(await prisma.businessProduct.create({data:{...data,batchId:batch.id,userId:user.id},include:{batch:true}})));}
   const owned=await prisma.businessProduct.findFirst({where:{id,userId:user.id}});if(!owned)return bad('Không tìm thấy sản phẩm.',404);
   if(method==='PUT')return json(productJson(await prisma.businessProduct.update({where:{id},data:{...data,batchId:requestedBatch?.id||owned.batchId},include:{batch:true}})));
   if(method==='DELETE'){await prisma.businessProduct.update({where:{id},data:{isActive:false}});return json({message:'Đã xóa sản phẩm.'});}
  }
  if(resource==='stock-receipts'){
   if(method==='GET'){const rows=await prisma.businessStockReceipt.findMany({where:{userId:user.id},include:{batch:true,items:{include:{product:true}}},orderBy:{receivedAt:'desc'}});return json(rows.map(receiptJson));}
   if(method==='POST'){const items=Array.isArray(body.items)?body.items:[],batch=body.batch_id?await prisma.businessInventoryBatch.findFirst({where:{id:body.batch_id,userId:user.id}}):await ensureInventoryBatch(user.id);if(!batch)return bad('Không tìm thấy lô hàng.',404);const result=await prisma.$transaction(async tx=>{for(const i of items){const p=await tx.businessProduct.findFirst({where:{id:i.product_id,userId:user.id}});if(!p)throw new Error('PRODUCT');await tx.businessProduct.update({where:{id:p.id},data:{stockQuantity:{increment:n(i.quantity)},unitCost:n(i.unit_cost),batchId:batch.id}})}const count=await tx.businessStockReceipt.count({where:{userId:user.id}});return tx.businessStockReceipt.create({data:{userId:user.id,batchId:batch.id,code:`PN-${String(count+1).padStart(4,'0')}`,supplierName:body.supplier_name||null,extraCost:n(body.extra_cost),note:body.note||null,receivedAt:new Date(body.received_at),items:{create:items.map((i:any)=>({productId:i.product_id,quantity:n(i.quantity),unitCost:n(i.unit_cost)}))}},include:{batch:true,items:{include:{product:true}}}})});return json(receiptJson(result));}
   if(method==='DELETE'&&id){const receipt=await prisma.businessStockReceipt.findFirst({where:{id,userId:user.id},include:{items:true}});if(!receipt)return bad('Không tìm thấy phiếu nhập.',404);await prisma.$transaction(async tx=>{for(const item of receipt.items){const product=await tx.businessProduct.findFirst({where:{id:item.productId,userId:user.id}});if(product&&product.stockQuantity<item.quantity)throw new Error('RECEIPT_USED');if(product)await tx.businessProduct.update({where:{id:product.id},data:{stockQuantity:{decrement:item.quantity}}});}await tx.businessStockReceipt.delete({where:{id:receipt.id}});});return json({message:'Đã xóa phiếu nhập và hoàn tác tồn kho.'});}
  }
  if(resource==='orders')return handleOrdersWithCustomers(request,user,id,body);
  if(resource==='expenses'&&method==='POST'){const ledger=await prisma.businessLedger.findFirst({where:{id:body.ledger_id,userId:user.id}});if(!ledger)return bad('Không tìm thấy sổ.',404);const e=await prisma.businessExpense.create({data:{userId:user.id,ledgerId:ledger.id,category:String(body.category||''),amount:n(body.amount),note:body.note||null,spentAt:new Date(body.spent_at)}});return json({id:e.id,category:e.category,amount:e.amount,note:e.note,spent_at:e.spentAt});}
  if(resource==='reports'&&id)return report(user.id,id);
  return bad('Đường dẫn API không tồn tại.',404);
 }catch(error){console.error('Vercel API error:',error);if(error instanceof Error&&error.message==='RECEIPT_USED')return bad('Không thể xóa vì một phần hàng trong phiếu đã được bán.',409);return bad(error instanceof Error&&error.message==='STOCK'?'Số lượng tồn kho không đủ.':'Không thể xử lý dữ liệu.',500)}
}

async function handleOrdersWithCustomers(request:NextRequest,user:Session,id:string|undefined,body:any){
 const method=request.method;
 if(method==='GET'){
  const ledger=request.nextUrl.searchParams.get('ledger_id'),limit=n(request.nextUrl.searchParams.get('limit'))||100;
  const rows=await prisma.businessOrder.findMany({where:{userId:user.id,...(ledger?{ledgerId:ledger}:{})},include:{items:true},orderBy:{orderedAt:'desc'},take:limit});
  return json(rows.map(orderJson));
 }
 if(method==='POST'){
  const ledger=await prisma.businessLedger.findFirst({where:{id:body.ledger_id,userId:user.id}});if(!ledger)return bad('Không tìm thấy sổ.',404);
  const items=Array.isArray(body.items)?body.items:[];
  const row=await prisma.$transaction(async tx=>{
   const customer=await resolveOrderCustomer(tx,user.id,body),lines=[];
   for(const item of items){const product=await tx.businessProduct.findFirst({where:{id:item.product_id,userId:user.id,isActive:true}});if(!product||product.stockQuantity<n(item.quantity))throw new Error('STOCK');lines.push({productId:product.id,productName:product.name,quantity:n(item.quantity),unitPrice:n(item.unit_price),unitCost:product.unitCost});await tx.businessProduct.update({where:{id:product.id},data:{stockQuantity:{decrement:n(item.quantity)}}});}
   const count=await tx.businessOrder.count({where:{userId:user.id}});
   return tx.businessOrder.create({data:{userId:user.id,ledgerId:ledger.id,customerId:customer.id,code:`DH-${String(count+1).padStart(4,'0')}`,customerName:String(body.customer_name||''),customerContact:body.customer_contact||null,socialLink:body.social_link||null,shippingFee:n(body.shipping_fee),shippingCost:n(body.shipping_cost),discount:n(body.discount),otherFee:n(body.other_fee),paymentStatus:body.payment_status||'paid',note:body.note||null,orderedAt:new Date(body.ordered_at),items:{create:lines}},include:{items:true}});
  });
  return json(orderJson(row));
 }
 const old=await prisma.businessOrder.findFirst({where:{id,userId:user.id},include:{items:true}});if(!old)return bad('Không tìm thấy đơn.',404);
 if(method==='PUT'){
  const items=Array.isArray(body.items)?body.items:[];
  const row=await prisma.$transaction(async tx=>{
   for(const item of old.items)await tx.businessProduct.update({where:{id:item.productId},data:{stockQuantity:{increment:item.quantity}}});
   const customer=await resolveOrderCustomer(tx,user.id,body),lines=[];
   for(const item of items){const product=await tx.businessProduct.findFirst({where:{id:item.product_id,userId:user.id,isActive:true}});if(!product||product.stockQuantity<n(item.quantity))throw new Error('STOCK');lines.push({productId:product.id,productName:product.name,quantity:n(item.quantity),unitPrice:n(item.unit_price),unitCost:product.unitCost});await tx.businessProduct.update({where:{id:product.id},data:{stockQuantity:{decrement:n(item.quantity)}}});}
   await tx.businessOrderItem.deleteMany({where:{orderId:old.id}});
   return tx.businessOrder.update({where:{id:old.id},data:{ledgerId:body.ledger_id||old.ledgerId,customerId:customer.id,customerName:String(body.customer_name||''),customerContact:body.customer_contact||null,socialLink:body.social_link||null,shippingFee:n(body.shipping_fee),shippingCost:n(body.shipping_cost),discount:n(body.discount),otherFee:n(body.other_fee),paymentStatus:body.payment_status||'paid',note:body.note||null,orderedAt:new Date(body.ordered_at),items:{create:lines}},include:{items:true}});
  });
  return json(orderJson(row));
 }
 if(method==='DELETE'){await prisma.$transaction(async tx=>{for(const item of old.items)await tx.businessProduct.update({where:{id:item.productId},data:{stockQuantity:{increment:item.quantity}}});await tx.businessOrder.delete({where:{id:old.id}})});return json({message:'Đã xóa đơn và hoàn kho.'});}
 return bad('Phương thức chưa được hỗ trợ.',405);
}

async function handleOrders(request:NextRequest,user:Session,id:string|undefined,body:any){const method=request.method;if(method==='GET'){const ledger=request.nextUrl.searchParams.get('ledger_id');const limit=n(request.nextUrl.searchParams.get('limit'))||100;const rows=await prisma.businessOrder.findMany({where:{userId:user.id,...(ledger?{ledgerId:ledger}:{})},include:{items:true},orderBy:{orderedAt:'desc'},take:limit});return json(rows.map(orderJson))}if(method==='POST'){const ledger=await prisma.businessLedger.findFirst({where:{id:body.ledger_id,userId:user.id}});if(!ledger)return bad('Không tìm thấy sổ.',404);const items=body.items||[];const row=await prisma.$transaction(async tx=>{const lines=[];for(const i of items){const p=await tx.businessProduct.findFirst({where:{id:i.product_id,userId:user.id,isActive:true}});if(!p||p.stockQuantity<n(i.quantity))throw new Error('STOCK');lines.push({productId:p.id,productName:p.name,quantity:n(i.quantity),unitPrice:n(i.unit_price),unitCost:p.unitCost});await tx.businessProduct.update({where:{id:p.id},data:{stockQuantity:{decrement:n(i.quantity)}}})}const count=await tx.businessOrder.count({where:{userId:user.id}});return tx.businessOrder.create({data:{userId:user.id,ledgerId:ledger.id,code:`DH-${String(count+1).padStart(4,'0')}`,customerName:String(body.customer_name||''),customerContact:body.customer_contact||null,socialLink:body.social_link||null,shippingFee:n(body.shipping_fee),shippingCost:n(body.shipping_cost),discount:n(body.discount),otherFee:n(body.other_fee),paymentStatus:body.payment_status||'paid',note:body.note||null,orderedAt:new Date(body.ordered_at),items:{create:lines}},include:{items:true}})});return json(orderJson(row))}const old=await prisma.businessOrder.findFirst({where:{id,userId:user.id},include:{items:true}});if(!old)return bad('Không tìm thấy đơn.',404);if(method==='PUT'){const items=Array.isArray(body.items)?body.items:[];const row=await prisma.$transaction(async tx=>{for(const i of old.items)await tx.businessProduct.update({where:{id:i.productId},data:{stockQuantity:{increment:i.quantity}}});const lines=[];for(const i of items){const p=await tx.businessProduct.findFirst({where:{id:i.product_id,userId:user.id,isActive:true}});if(!p||p.stockQuantity<n(i.quantity))throw new Error('STOCK');lines.push({productId:p.id,productName:p.name,quantity:n(i.quantity),unitPrice:n(i.unit_price),unitCost:p.unitCost});await tx.businessProduct.update({where:{id:p.id},data:{stockQuantity:{decrement:n(i.quantity)}}})}await tx.businessOrderItem.deleteMany({where:{orderId:old.id}});return tx.businessOrder.update({where:{id:old.id},data:{ledgerId:body.ledger_id||old.ledgerId,customerName:String(body.customer_name||''),customerContact:body.customer_contact||null,socialLink:body.social_link||null,shippingFee:n(body.shipping_fee),shippingCost:n(body.shipping_cost),discount:n(body.discount),otherFee:n(body.other_fee),paymentStatus:body.payment_status||'paid',note:body.note||null,orderedAt:new Date(body.ordered_at),items:{create:lines}},include:{items:true}})});return json(orderJson(row))}if(method==='DELETE'){await prisma.$transaction(async tx=>{for(const i of old.items)await tx.businessProduct.update({where:{id:i.productId},data:{stockQuantity:{increment:i.quantity}}});await tx.businessOrder.delete({where:{id:old.id}})});return json({message:'Đã xóa đơn và hoàn kho.'})}return bad('Phương thức chưa được hỗ trợ.',405)}

async function report(userId:string,ledgerId:string){const ledger=await prisma.businessLedger.findFirst({where:{id:ledgerId,userId},include:{orders:{where:{status:{not:'cancelled'}},include:{items:true}},expenses:true}});if(!ledger)return bad('Không tìm thấy sổ.',404);const totals=ledger.orders.map(orderTotals),revenue=totals.reduce((s,x)=>s+x.total,0),capital=totals.reduce((s,x)=>s+x.capital_cost,0),shipping=ledger.orders.reduce((s,o)=>s+o.shippingCost,0),other=ledger.orders.reduce((s,o)=>s+o.otherFee,0),operating=ledger.expenses.reduce((s,e)=>s+e.amount,0);const products=await prisma.businessProduct.findMany({where:{userId,isActive:true}});const daily=new Map<string,{orders:number;revenue:number;profit:number}>(),top=new Map<string,{name:string;quantity:number;revenue:number}>();ledger.orders.forEach((o,i)=>{const d=o.orderedAt.toISOString().slice(0,10),v=daily.get(d)||{orders:0,revenue:0,profit:0};v.orders++;v.revenue+=totals[i].total;v.profit+=totals[i].profit;daily.set(d,v);o.items.forEach(x=>{const v=top.get(x.productId)||{name:x.productName,quantity:0,revenue:0};v.quantity+=x.quantity;v.revenue+=x.quantity*x.unitPrice;top.set(x.productId,v)})});return json({revenue,capital_cost:capital,shipping_cost:shipping,other_order_fee:other,operating_expense:operating,profit:revenue-capital-shipping-other-operating,order_count:ledger.orders.length,sold_units:ledger.orders.flatMap(o=>o.items).reduce((s,i)=>s+i.quantity,0),average_order_value:ledger.orders.length?Math.round(revenue/ledger.orders.length):0,stock_units:products.reduce((s,p)=>s+p.stockQuantity,0),stock_value:products.reduce((s,p)=>s+p.stockQuantity*p.unitCost,0),daily:[...daily].map(([date,v])=>({date,...v})).sort((a,b)=>a.date.localeCompare(b.date)),top_products:[...top].map(([product_id,v])=>({product_id,...v})).sort((a,b)=>b.quantity-a.quantity).slice(0,10),expenses:ledger.expenses.map(e=>({id:e.id,category:e.category,amount:e.amount,note:e.note,spent_at:e.spentAt}))})}

export const GET=handle;export const POST=handle;export const PUT=handle;export const PATCH=handle;export const DELETE=handle;
