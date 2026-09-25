import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getRequestUser } from '@/lib/auth';
import { createAutomaticBusinessBackup } from '@/lib/businessBackup';

const allowed=['confirmed','packing','shipping','completed','cancelled'];
export async function PATCH(request:Request,context:RouteContext<'/api/sales/orders/[id]/status'>){const user=getRequestUser(request);if(!user)return NextResponse.json({detail:'Phiên đăng nhập không hợp lệ.'},{status:401});const {id}=await context.params,body=await request.json(),status=String(body.status||'');if(!allowed.includes(status))return NextResponse.json({detail:'Trạng thái không hợp lệ.'},{status:400});const order=await prisma.businessOrder.findFirst({where:{id,userId:user.id}});if(!order)return NextResponse.json({detail:'Không tìm thấy đơn.'},{status:404});const updated=await prisma.$transaction(async tx=>{const row=await tx.businessOrder.update({where:{id},data:{status}});await tx.businessOrderStatusHistory.create({data:{userId:user.id,orderId:id,fromStatus:order.status,toStatus:status,note:body.note||null}});return row;});await createAutomaticBusinessBackup(user.id,'Sau khi đổi trạng thái đơn');return NextResponse.json({id:updated.id,status:updated.status});}
