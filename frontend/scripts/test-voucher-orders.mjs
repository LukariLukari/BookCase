import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(path, imports) {
  const source = fs.readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, Date, URL, console, require: name => { assert.ok(name in imports, name); return imports[name]; } });
  return exports;
}
function fixture() {
  const rows = [];
  let writes = 0;
  const db = {
    user: { findUnique: async ({where}) => ({id:where.id,username:where.id,role:'user'}) },
    businessVoucher: { findFirst: async ({where}) => where.userId==='alice'&&(where.code==='CAMON'||where.id==='voucher-alice')?{id:'voucher-alice',code:'CAMON',note:null}:null },
    businessLedger: { findFirst: async () => ({id:'ledger'}) },
    businessCustomer: { findFirst: async () => null, create: async () => ({id:'customer'}) },
    businessOrderItem: { deleteMany: async () => {} },
    businessOrder: {
      count: async () => rows.length,
      findMany: async ({where}) => rows.filter(row=>row.userId===where.userId),
      findFirst: async ({where}) => rows.find(row=>row.userId===where.userId&&row.id===where.id),
      create: async ({data}) => {writes++;const row={...data,id:'order',items:[],createdAt:new Date()};rows.push(row);return row;},
      update: async ({where,data}) => {writes++;const index=rows.findIndex(row=>row.id===where.id);rows[index]={...rows[index],...data,items:[]};return rows[index];},
    },
    $transaction: async callback => callback(db),
  };
  const util=load('lib/vouchers.ts',{});
  const lookup=load('lib/voucherLookup.ts',{'./vouchers':util});
  const route=load('app/api/backend/[...path]/route.ts',{
    'next/server':{NextResponse:{json:(body,options)=>Response.json(body,options)}},
    crypto:{randomInt:()=>1}, '@/lib/db':{prisma:db}, '@/lib/voucherLookup':lookup,
    '@/lib/auth':{verifyJwt:token=>({id:token})},
    '@/lib/businessBackup':{createAutomaticBusinessBackup:async()=>null},
  });
  const call=async(method,code,id,owner='alice',omit=false)=>{
    const body={ledger_id:'ledger',customer_name:'An',items:[],discount:5000,...(!omit?{voucher_code:code}:{})};
    const req=new Request('https://test.local/api/backend/api/business/orders'+(id?'/'+id:''),{method,headers:{authorization:'Bearer '+owner},...(method==='GET'?{}:{body:JSON.stringify(body)})});
    req.nextUrl=new URL(req.url);
    return route[method](req,{params:Promise.resolve({path:['api','business','orders',...(id?[id]:[])]})});
  };
  return {call,rows,writes:()=>writes};
}

test('A valid voucher is saved with the order, returned after reload, preserved on edit and removable',async()=>{
  const f=fixture();
  const created=await f.call('POST','camon');
  assert.equal(created.status,200);
  assert.equal((await created.json()).voucher_code,'CAMON');
  assert.equal(f.rows[0].discount,5000);
  assert.equal((await f.call('GET').then(r=>r.json()))[0].voucher_code,'CAMON');
  assert.equal((await f.call('PUT',undefined,'order','alice',true).then(r=>r.json())).voucher_code,'CAMON');
  assert.equal((await f.call('PUT',null,'order').then(r=>r.json())).voucher_code,null);
});

test('Invalid, forged and foreign vouchers are rejected before any order or stock mutations',async()=>{
  const f=fixture();
  for(const value of ['UNKNOWN','BV:foreign',123,'','x'.repeat(129)])assert.equal((await f.call('POST',value)).status,400);
  assert.equal((await f.call('POST','CAMON',undefined,'bob')).status,400);
  assert.equal(f.writes(),0);
  assert.equal(f.rows.length,0);
});
