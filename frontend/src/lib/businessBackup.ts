import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/db';

export const BUSINESS_BACKUP_FORMAT = 'bookcase-business-backup';
export const BUSINESS_BACKUP_VERSION = 2;

const tableNames = [
  'inventoryBatches','products','transactions','ledgers','customers','stockReceipts',
  'stockReceiptItems','orders','orderItems','expenses','orderPayments',
  'orderStatusHistory','inventoryMovements',
] as const;

type BackupData = Record<(typeof tableNames)[number], Record<string, unknown>[]>;
export type BusinessBackupPayload = {
  format: typeof BUSINESS_BACKUP_FORMAT;
  version: typeof BUSINESS_BACKUP_VERSION;
  exportedAt: string;
  data: BackupData;
};

type DbClient = PrismaClient | Prisma.TransactionClient;
const plain = <T>(value:T):T => JSON.parse(JSON.stringify(value)) as T;

export async function buildBusinessBackup(client:DbClient,userId:string):Promise<BusinessBackupPayload>{
  const [inventoryBatches,products,transactions,ledgers,customers,stockReceipts,stockReceiptItems,orders,orderItems,expenses,orderPayments,orderStatusHistory,inventoryMovements]=await Promise.all([
    client.businessInventoryBatch.findMany({where:{userId}}),
    client.businessProduct.findMany({where:{userId}}),
    client.businessTransaction.findMany({where:{userId}}),
    client.businessLedger.findMany({where:{userId}}),
    client.businessCustomer.findMany({where:{userId}}),
    client.businessStockReceipt.findMany({where:{userId}}),
    client.businessStockReceiptItem.findMany({where:{receipt:{userId}}}),
    client.businessOrder.findMany({where:{userId}}),
    client.businessOrderItem.findMany({where:{order:{userId}}}),
    client.businessExpense.findMany({where:{userId}}),
    client.businessOrderPayment.findMany({where:{userId}}),
    client.businessOrderStatusHistory.findMany({where:{userId}}),
    client.businessInventoryMovement.findMany({where:{userId}}),
  ]);
  return plain({format:BUSINESS_BACKUP_FORMAT,version:BUSINESS_BACKUP_VERSION,exportedAt:new Date().toISOString(),data:{inventoryBatches,products,transactions,ledgers,customers,stockReceipts,stockReceiptItems,orders,orderItems,expenses,orderPayments,orderStatusHistory,inventoryMovements}});
}

export async function createBusinessBackup(userId:string,label='Tự động',source='automatic'){
  const payload=await buildBusinessBackup(prisma,userId);
  const backup=await prisma.businessDataBackup.create({data:{userId,label,source,payload:payload as unknown as Prisma.InputJsonValue}});
  const expired=await prisma.businessDataBackup.findMany({where:{userId},orderBy:[{createdAt:'desc'},{id:'desc'}],skip:20,select:{id:true}});
  if(expired.length)await prisma.businessDataBackup.deleteMany({where:{id:{in:expired.map(item=>item.id)}}});
  return {...backup,payload};
}

export async function createAutomaticBusinessBackup(userId:string,label='Sau khi thay đổi dữ liệu'){
  try{return await createBusinessBackup(userId,label,'automatic')}catch(error){console.error('[Business Backup] automatic snapshot failed:',error);return null}
}

const dateFields:Record<string,string[]>={
  inventoryBatches:['createdAt','updatedAt'],products:['createdAt','updatedAt'],transactions:['transactionDate','createdAt','updatedAt'],
  ledgers:['createdAt','updatedAt'],customers:['createdAt','updatedAt'],stockReceipts:['receivedAt','createdAt'],orders:['orderedAt','createdAt','updatedAt'],
  expenses:['spentAt','createdAt'],orderPayments:['paidAt','createdAt'],orderStatusHistory:['createdAt'],inventoryMovements:['createdAt'],
};

function validatePayload(value:unknown):asserts value is BusinessBackupPayload{
  if(!value||typeof value!=='object')throw new Error('File sao lưu không hợp lệ.');
  const payload=value as Partial<BusinessBackupPayload>;
  if(payload.format!==BUSINESS_BACKUP_FORMAT||payload.version!==BUSINESS_BACKUP_VERSION||!payload.data)throw new Error('File sao lưu không đúng phiên bản toàn bộ dữ liệu.');
  for(const table of tableNames)if(!Array.isArray(payload.data[table]))throw new Error(`File sao lưu thiếu bảng ${table}.`);
  const ids=Object.fromEntries(tableNames.map(table=>[table,new Set(payload.data![table].map(row=>row.id))])) as Record<string,Set<unknown>>;
  for(const table of tableNames)if(ids[table].size!==payload.data[table].length||ids[table].has(undefined))throw new Error(`Bảng ${table} có ID không hợp lệ.`);
  const refs:[string,string,string,boolean?][]=[
    ['products','batchId','inventoryBatches',true],['transactions','productId','products',true],['stockReceipts','batchId','inventoryBatches',true],
    ['stockReceiptItems','receiptId','stockReceipts'],['stockReceiptItems','productId','products'],['orders','ledgerId','ledgers'],['orders','customerId','customers',true],
    ['orderItems','orderId','orders'],['orderItems','productId','products'],['expenses','ledgerId','ledgers'],['orderPayments','orderId','orders'],
    ['orderStatusHistory','orderId','orders'],['inventoryMovements','productId','products'],
  ];
  for(const [table,field,target,nullable] of refs)for(const row of payload.data[table as keyof BackupData]){const id=row[field];if(nullable&&(id===null||id===undefined))continue;if(!ids[target].has(id))throw new Error(`Liên kết ${table}.${field} không hợp lệ.`)}
}

function rowsFor(payload:BusinessBackupPayload,table:keyof BackupData,userId:string){
  return payload.data[table].map(raw=>{const row={...raw};if('userId'in row)row.userId=userId;for(const field of dateFields[table]||[])if(typeof row[field]==='string')row[field]=new Date(row[field] as string);return row});
}

export async function restoreBusinessBackup(userId:string,value:unknown){
  validatePayload(value);
  await createBusinessBackup(userId,'Trước khi phục hồi','pre_restore');
  const payload=value;
  await prisma.$transaction(async tx=>{
    await tx.businessInventoryMovement.deleteMany({where:{userId}});
    await tx.businessOrderPayment.deleteMany({where:{userId}});
    await tx.businessOrderStatusHistory.deleteMany({where:{userId}});
    await tx.businessStockReceiptItem.deleteMany({where:{receipt:{userId}}});
    await tx.businessOrderItem.deleteMany({where:{order:{userId}}});
    await tx.businessExpense.deleteMany({where:{userId}});
    await tx.businessOrder.deleteMany({where:{userId}});
    await tx.businessStockReceipt.deleteMany({where:{userId}});
    await tx.businessTransaction.deleteMany({where:{userId}});
    await tx.businessProduct.deleteMany({where:{userId}});
    await tx.businessCustomer.deleteMany({where:{userId}});
    await tx.businessLedger.deleteMany({where:{userId}});
    await tx.businessInventoryBatch.deleteMany({where:{userId}});

    const create=async(name:keyof BackupData,model:{createMany:(args:{data:any[]})=>Promise<unknown>})=>{const data=rowsFor(payload,name,userId);if(data.length)await model.createMany({data})};
    await create('inventoryBatches',tx.businessInventoryBatch);
    await create('products',tx.businessProduct);
    await create('transactions',tx.businessTransaction);
    await create('ledgers',tx.businessLedger);
    await create('customers',tx.businessCustomer);
    await create('stockReceipts',tx.businessStockReceipt);
    await create('stockReceiptItems',tx.businessStockReceiptItem);
    await create('orders',tx.businessOrder);
    await create('orderItems',tx.businessOrderItem);
    await create('expenses',tx.businessExpense);
    await create('orderPayments',tx.businessOrderPayment);
    await create('orderStatusHistory',tx.businessOrderStatusHistory);
    await create('inventoryMovements',tx.businessInventoryMovement);
  },{timeout:30000});
}
