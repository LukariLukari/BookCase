'use client';

import { isValidElement, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { ArrowLeft, BarChart3, Boxes, CalendarDays, Camera, Check, ChevronDown, CircleDollarSign, ClipboardList, Download, FileSpreadsheet, HelpCircle, Loader2, Minus, PackageOpen, Pencil, Plus, ReceiptText, RotateCcw, Search, ShieldAlert, ShieldCheck, ShoppingBag, Store, Trash2, TrendingUp, Upload, X } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/app/contexts/AuthContext';
import ResetAccountModal from '@/components/ResetAccountModal';
import { generateBankQrDataUrl, renderBankQrToCanvas, findBank, ensureMontserratLoaded, VIETNAM_BANKS } from '@/lib/vietqr';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
type View = 'dashboard' | 'inventory' | 'orders' | 'reports';
type Ledger = { id:string; name:string; month:string; opening_cash:number; order_count:number; revenue:number; profit:number };
type InventoryBatch = { id:string; name:string; product_count:number; stock_quantity:number; created_at:string };
type Product = { id:string; name:string; sku?:string; category?:string; image_url?:string; selling_price:number; unit_cost:number; stock_quantity:number; track_stock?:boolean; batch_id?:string; batch_name?:string; notes?:string };
type Receipt = { id:string; code:string; batch_id?:string; batch_name?:string; supplier_name?:string; received_at:string; total_cost:number; total_quantity:number; items:{product_id:string;product_name:string;quantity:number}[] };
type Order = { id:string; code:string; ledger_id:string; customer_id?:string; customer_name:string; customer_contact?:string; social_link?:string; shipping_fee:number; shipping_cost:number; discount:number; other_fee:number; payment_status:string; note?:string; ordered_at:string; total:number; profit:number; capital_cost:number; item_count:number; items:{product_id:string;product_name:string;quantity:number;unit_price:number;unit_cost:number}[] };
type Expense = { id:string; category:string; amount:number; note?:string; spent_at:string };
type Customer = { id:string; name:string; phone?:string; email?:string; social_link?:string; address?:string; order_count?:number };
type Report = { revenue:number; net_revenue:number; capital_cost:number; shipping_cost:number; other_order_fee:number; operating_expense:number; gross_profit:number; net_profit:number; profit_after_inventory:number; profit:number; order_count:number; sold_units:number; average_order_value:number; stock_units:number; stock_value:number; daily:{date:string;orders:number;revenue:number;profit:number}[]; top_products:{product_id:string;name:string;quantity:number;revenue:number}[]; expenses:Expense[] };
type BusinessBackup = { id:string; label:string; source:string; created_at:string; payload?:unknown };
type PaymentSettings = { shopName:string; bankName:string; bankCode?:string; accountNumber:string; accountName:string; qrImage?:string; note:string; tagline?:string };

type CacheEntry<T>={value:T;savedAt:number};
const businessMemoryCache=new Map<string,CacheEntry<unknown>>(),CACHE_MAX_AGE=5*60*1000,DURABLE_CACHE_MAX_AGE=30*24*60*60*1000;
const productSelectImages=new Map<string,string>();
const productSelectIds=new Set<string>();
function readBusinessCache<T>(key:string):T|null{const memory=businessMemoryCache.get(key) as CacheEntry<T>|undefined;if(memory&&Date.now()-memory.savedAt<DURABLE_CACHE_MAX_AGE)return memory.value;if(typeof window==='undefined')return null;try{const cacheKey=`billy:${key}`,legacyKey=`bookcase:${key}`,candidates:[[string|null,number],[string|null,number],[string|null,number],[string|null,number]]=[[sessionStorage.getItem(cacheKey),CACHE_MAX_AGE],[localStorage.getItem(cacheKey),DURABLE_CACHE_MAX_AGE],[sessionStorage.getItem(legacyKey),CACHE_MAX_AGE],[localStorage.getItem(legacyKey),DURABLE_CACHE_MAX_AGE]];for(const [rawValue,maxAge] of candidates){if(!rawValue)continue;const entry=JSON.parse(rawValue) as CacheEntry<T>;if(Date.now()-entry.savedAt<maxAge){businessMemoryCache.set(key,entry);return entry.value}}return null}catch{return null}}
function writeBusinessCache<T>(key:string,value:T){const entry={value,savedAt:Date.now()};businessMemoryCache.set(key,entry);if(typeof window!=='undefined')try{const serialized=JSON.stringify(entry);sessionStorage.setItem(`billy:${key}`,serialized);localStorage.setItem(`billy:${key}`,serialized)}catch{/* Bản sao bền vững là dự phòng; ứng dụng vẫn hoạt động nếu bộ nhớ trình duyệt đầy. */}}
function initialBusinessState(userId:string|undefined,view:View){if(!userId)return null;const prefix=`business:${userId}`,ledgers=readBusinessCache<Ledger[]>(`${prefix}:ledgers`);if(!ledgers)return null;const saved=typeof window!=='undefined'?localStorage.getItem('business_ledger_id'):null,ledger=ledgers.some(item=>item.id===saved)?saved!:(ledgers[0]?.id||''),products=(view==='inventory'||view==='orders')?(readBusinessCache<Product[]>(`${prefix}:products`)||[]):[],receipts=view==='inventory'?(readBusinessCache<Receipt[]>(`${prefix}:receipts`)||[]):[],batches=view==='inventory'?(readBusinessCache<InventoryBatch[]>(`${prefix}:batches`)||[]):[],bookPrefix=`${prefix}:ledger:${ledger}`,orders=ledger?readBusinessCache<Order[]>(`${bookPrefix}:orders`):null,report=ledger?readBusinessCache<Report>(`${bookPrefix}:report`):null;return{ledgers,ledger,products,receipts,batches,orders,report}}

const nowDate=()=>new Date().toISOString().slice(0,10), nowMonth=()=>new Date().toISOString().slice(0,7);
const raw=(v:string|number)=>String(v??'').replace(/\D/g,''), num=(v:string|number)=>Number(raw(v))||0;
const cash=(v=0)=>`${Math.round(v).toLocaleString('en-US')} đ`, cashInput=(v:string)=>raw(v)?Number(raw(v)).toLocaleString('en-US'):'';
const tracksStock=(product?:Pick<Product,'track_stock'>|null)=>product?.track_stock!==false;
const dateText=(v:string)=>new Intl.DateTimeFormat('vi-VN').format(new Date(v));
const exportOrdersExcel=(orders:Order[],ledgerName:string)=>{if(!orders.length)return;const esc=(value:unknown)=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');const rows=orders.map(order=>`<tr><td>${esc(order.code)}</td><td>${esc(dateText(order.ordered_at))}</td><td>${esc(order.customer_name)}</td><td>${esc(order.customer_contact)}</td><td>${esc(order.items.map(item=>`${item.product_name} x${item.quantity}`).join('; '))}</td><td>${order.total}</td><td>${order.capital_cost}</td><td>${order.shipping_fee}</td><td>${order.shipping_cost}</td><td>${order.discount}</td><td>${order.other_fee}</td><td>${order.profit}</td><td>${esc(order.payment_status)}</td><td>${esc(order.note)}</td></tr>`).join('');const html=`<html><head><meta charset="UTF-8"></head><body><table border="1"><tr><th>Mã đơn</th><th>Ngày</th><th>Khách hàng</th><th>Liên hệ</th><th>Sản phẩm</th><th>Khách trả</th><th>Giá vốn</th><th>Ship thu khách</th><th>Ship thực trả</th><th>Giảm giá</th><th>Phí khác</th><th>Lợi nhuận</th><th>Thanh toán</th><th>Ghi chú</th></tr>${rows}</table></body></html>`;const url=URL.createObjectURL(new Blob(['\ufeff',html],{type:'application/vnd.ms-excel;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download=`don-hang-${ledgerName||nowMonth()}.xls`;link.click();URL.revokeObjectURL(url)};
const defaultPaymentSettings:PaymentSettings={shopName:'Billy Shop',bankName:'MB Bank',bankCode:'MB',accountNumber:'',accountName:'',qrImage:'',note:'',tagline:'Coffeeshop and bakery'};
const paymentSettingsKey='billy:business:payment-settings';
function loadPaymentSettings():PaymentSettings{if(typeof window==='undefined')return defaultPaymentSettings;try{return {...defaultPaymentSettings,...JSON.parse(localStorage.getItem(paymentSettingsKey)||localStorage.getItem('bookcase:business:payment-settings')||'{}')}}catch{return defaultPaymentSettings}}
function loadCanvasImage(src:string){return new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();if(!src.startsWith('data:')&&!src.startsWith('blob:'))image.crossOrigin='anonymous';image.onload=()=>resolve(image);image.onerror=reject;image.src=src})}

function drawScallopedSeal(ctx:CanvasRenderingContext2D,cx:number,cy:number,shopName:string){
 ctx.save();
 ctx.beginPath();
 const lobes=24,rBase=52,rWave=4.5;
 for(let i=0;i<=360;i++){
  const angle=(i*Math.PI)/180,r=rBase+Math.sin(angle*lobes)*rWave,px=cx+r*Math.cos(angle),py=cy+r*Math.sin(angle);
  if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
 }
 ctx.closePath();
 ctx.fillStyle='#585556';
 ctx.fill();

 ctx.fillStyle='#fef9f4';
 ctx.textAlign='center';
 ctx.font='800 12px Montserrat, sans-serif';
 const shortShop=(shopName.split(' ')[0]||'SHOP').slice(0,10).toUpperCase();
 ctx.fillText(shortShop,cx,cy-14);

 ctx.strokeStyle='#fef9f4';
 ctx.lineWidth=1.6;
 ctx.beginPath();
 ctx.arc(cx,cy+2,4,0,Math.PI*2);
 ctx.stroke();
 ctx.beginPath();
 ctx.arc(cx,cy+2,11,-0.6,Math.PI+0.6);
 ctx.stroke();

 ctx.font='600 9px Montserrat, sans-serif';
 ctx.fillText('ORIGINAL',cx,cy+24);
 ctx.restore();
}

function drawFormattedQuote(ctx:CanvasRenderingContext2D,text:string,highlight:string,x:number,startY:number,maxWidth:number,lineHeight:number){
 ctx.save();
 ctx.textAlign='left';
 const words=text.split(/\s+/);
 let curX=x,curY=startY;
 const regFont='italic 500 21px Montserrat, sans-serif',boldFont='italic 800 21px Montserrat, sans-serif';
 const normHighlight=highlight.trim().toLowerCase();

 for(let i=0;i<words.length;i++){
  const rawWord=words[i],cleanWord=rawWord.toLowerCase().replace(/[^a-z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/g,'');
  const isHighlight=Boolean(normHighlight&&cleanWord&&(normHighlight.includes(cleanWord)||cleanWord.includes(normHighlight)));
  ctx.font=isHighlight?boldFont:regFont;
  ctx.fillStyle='#585556';
  const wordWidth=ctx.measureText(rawWord).width,spaceWidth=ctx.measureText(' ').width;
  if(curX+wordWidth>x+maxWidth&&curX>x){curX=x;curY+=lineHeight}
  ctx.fillText(rawWord,curX,curY);
  curX+=wordWidth+spaceWidth;
 }
 ctx.restore();
}

function drawRoundedRect(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){
 ctx.beginPath();
 ctx.moveTo(x+r,y);
 ctx.lineTo(x+w-r,y);
 ctx.quadraticCurveTo(x+w,y,x+w,y+r);
 ctx.lineTo(x+w,y+h-r);
 ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
 ctx.lineTo(x+r,y+h);
 ctx.quadraticCurveTo(x,y+h,x,y+h-r);
 ctx.lineTo(x,y+r);
 ctx.quadraticCurveTo(x,y,x+r,y);
 ctx.closePath();
}

function drawContainImage(ctx:CanvasRenderingContext2D,img:HTMLImageElement,x:number,y:number,w:number,h:number){
 const imgW=img.naturalWidth||img.width||1,imgH=img.naturalHeight||img.height||1;
 const scale=Math.min(w/imgW,h/imgH);
 const drawW=imgW*scale,drawH=imgH*scale;
 const drawX=x+(w-drawW)/2,drawY=y+(h-drawH)/2;
 ctx.drawImage(img,drawX,drawY,drawW,drawH);
}

async function createOrderCloseImageLegacy(order:Order,settings:PaymentSettings,ledgerName:string){
 await ensureMontserratLoaded();
 const navy='#585556',muted='rgba(88, 85, 86, 0.65)',paper='#fef9f4';
 const shopName=(settings.shopName||'Billy Shop').trim()||'Billy Shop';
 const width=800,xLeft=56,xQty=440,xRight=744;

 // Bottom-up layout calculations
 const brandSectionHeight=130;
 const gapBrandToQr=55;
 const qrCardSize=210;
 const hasBankText=Boolean(settings.accountNumber);
 const bankTextHeight=hasBankText?(settings.accountName?46:24):0;
 const qrBlockHeight=qrCardSize+(hasBankText?14+bankTextHeight:0);
 const gapQrToTotal=55;

 const hasSubtotal=order.shipping_fee>0||order.discount>0;
 let summaryLinesCount=0;
 if(hasSubtotal){
  summaryLinesCount=1;
  if(order.shipping_fee>0)summaryLinesCount++;
  if(order.discount>0)summaryLinesCount++;
 }
 const summaryHeight=hasSubtotal?(18+summaryLinesCount*36):0;
 const totalBlockHeight=44+summaryHeight;
 const gapTotalToItems=45;

 const itemRowHeight=52;
 const itemsCount=Math.max(order.items.length,1);
 const itemsBlockHeight=(itemsCount-1)*itemRowHeight;
 const gapItemsToHeader=55;
 const headerBlockHeight=38;

 const minTopPadding=140,bottomPadding=90;
 const totalContentHeight=headerBlockHeight+gapItemsToHeader+itemsBlockHeight+gapTotalToItems+totalBlockHeight+gapQrToTotal+qrBlockHeight+gapBrandToQr+brandSectionHeight;
 const height=Math.max(1600,Math.ceil(minTopPadding+totalContentHeight+bottomPadding));

 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas không khả dụng.');

 ctx.fillStyle=paper;
 ctx.fillRect(0,0,width,height);

 // Bottom-up Y coordinates:
 const bottomY=height-130;
 const brandTop=bottomY-65;

 const qrSectionBottom=brandTop-gapBrandToQr;
 const qrY=qrSectionBottom-qrBlockHeight;

 const totalLineY=qrY-gapQrToTotal;

 const lastItemY=(totalLineY-44-summaryHeight)-gapTotalToItems;
 const firstItemY=lastItemY-(itemsCount-1)*itemRowHeight;

 const headerY=firstItemY-gapItemsToHeader;

 // 1. Header (Items, Qty, Price)
 ctx.fillStyle=navy;
 ctx.font='800 38px Montserrat, sans-serif';
 ctx.textAlign='left';
 ctx.fillText('Items',xLeft,headerY);
 ctx.textAlign='center';
 ctx.fillText('Qty',xQty,headerY);
 ctx.textAlign='right';
 ctx.fillText('Price',xRight,headerY);

 // 2. Product Items
 ctx.font='500 28px Montserrat, sans-serif';
 let curY=firstItemY;
 for(const item of order.items){
  ctx.fillStyle=navy;
  ctx.textAlign='left';
  let name=item.product_name||'Sản phẩm';
  const maxNameW=340;
  if(ctx.measureText(name).width>maxNameW){
   while(name.length>3&&ctx.measureText(name+'...').width>maxNameW){name=name.slice(0,-1)}
   name=name+'...';
  }
  ctx.fillText(name,xLeft,curY);

  ctx.textAlign='center';
  ctx.fillText(String(item.quantity),xQty,curY);

  ctx.textAlign='right';
  ctx.fillText(cash(item.unit_price*item.quantity),xRight,curY);
  curY+=itemRowHeight;
 }

 // 3. Summary Lines (Tạm tính / Ship / Giảm giá) above Total line
 if(hasSubtotal){
  let sumY=totalLineY-44-(summaryLinesCount*36);
  ctx.font='500 24px Montserrat, sans-serif';
  ctx.fillStyle=muted;
  ctx.textAlign='right';
  const subtotal=order.total-order.shipping_fee+order.discount;
  ctx.fillText('Tạm tính',xQty+60,sumY);
  ctx.fillText(cash(subtotal),xRight,sumY);
  sumY+=36;
  if(order.shipping_fee>0){ctx.fillText('Phí ship',xQty+60,sumY);ctx.fillText(cash(order.shipping_fee),xRight,sumY);sumY+=36}
  if(order.discount>0){ctx.fillText('Giảm giá',xQty+60,sumY);ctx.fillText('-'+cash(order.discount),xRight,sumY);sumY+=36}
 }

 // 4. Total Line
 ctx.fillStyle=navy;
 ctx.font='900 44px Montserrat, sans-serif';
 ctx.textAlign='right';
 ctx.fillText('Total',xQty+60,totalLineY);
 ctx.fillText(cash(order.total),xRight,totalLineY);

 // 5. QR Code Card + Bank Information
 const qrX=xLeft;
 let qrDrawn=false;

 if(settings.qrImage){
  try{
   const userQrImg=await loadCanvasImage(settings.qrImage);
   ctx.save();
   ctx.fillStyle='#fef9f4';
   drawRoundedRect(ctx,qrX,qrY,qrCardSize,qrCardSize,16);
   ctx.fill();
   ctx.strokeStyle='#b9cddf';
   ctx.lineWidth=1.5;
   ctx.stroke();
   drawContainImage(ctx,userQrImg,qrX+12,qrY+12,qrCardSize-24,qrCardSize-24);
   ctx.restore();
   qrDrawn=true;
  }catch(err){
   console.error('Failed to load user QR image, falling back to VietQR:',err);
  }
 }

 if(!qrDrawn){
  try{
   const qrCanvas=document.createElement('canvas');
   await renderBankQrToCanvas(qrCanvas,{
    bankCodeOrName:settings.bankCode||settings.bankName,
    accountNumber:settings.accountNumber,
    accountName:settings.accountName,
    amount:order.total,
    memo:order.code,
    color:'#585556',
    width:qrCardSize-24
   });
   ctx.save();
   ctx.fillStyle='#fef9f4';
   drawRoundedRect(ctx,qrX,qrY,qrCardSize,qrCardSize,16);
   ctx.fill();
   ctx.strokeStyle='#b9cddf';
   ctx.lineWidth=1.5;
   ctx.stroke();
   ctx.drawImage(qrCanvas,qrX+12,qrY+12,qrCardSize-24,qrCardSize-24);
   ctx.restore();
   qrDrawn=true;
  }catch(err){
   console.error('QR generation error:',err);
   ctx.strokeStyle=navy;ctx.lineWidth=2;
   drawRoundedRect(ctx,qrX,qrY,qrCardSize,qrCardSize,16);
   ctx.stroke();
   ctx.font='700 20px Montserrat, sans-serif';ctx.fillStyle=navy;ctx.textAlign='center';
   ctx.fillText('QR CODE',qrX+qrCardSize/2,qrY+qrCardSize/2);
  }
 }

 if(settings.accountNumber){
  const bName=settings.bankName||settings.bankCode||'Ngân hàng';
  ctx.textAlign='left';
  ctx.font='700 15px Montserrat, sans-serif';
  ctx.fillStyle=navy;
  ctx.fillText(`${bName} · ${settings.accountNumber}`,qrX,qrY+qrCardSize+24);
  if(settings.accountName){
   ctx.font='600 13px Montserrat, sans-serif';
   ctx.fillStyle=muted;
   ctx.fillText(settings.accountName.toUpperCase(),qrX,qrY+qrCardSize+44);
  }
 }

 // 6. Quote / Thank you message beside QR
 const quoteX=qrX+qrCardSize+32,quoteY=qrY+28,maxQuoteWidth=xRight-quoteX;
 const quoteTemplate=settings.note&&settings.note.trim()?settings.note.trim():`Every visit to ${shopName} is a chance to slow down, savor quality, and enjoy life's fleeting moments.`;
 drawFormattedQuote(ctx,quoteTemplate,shopName,quoteX,quoteY,maxQuoteWidth,34);

 // 7. Bottom Branding (Shop Name, Tagline, Scalloped Badge)
 const brandX=xLeft,maxBrandW=480;
 let brandFontSize=84;
 ctx.font=`900 ${brandFontSize}px Montserrat, sans-serif`;
 while(ctx.measureText(shopName).width>maxBrandW&&brandFontSize>36){
  brandFontSize-=4;
  ctx.font=`900 ${brandFontSize}px Montserrat, sans-serif`;
 }
 ctx.fillStyle=navy;
 ctx.textAlign='left';
 ctx.fillText(shopName,brandX,bottomY);

 const tagline=(settings.tagline||'Coffeeshop and bakery').trim();
 ctx.font='italic 500 24px Montserrat, sans-serif';
 ctx.fillStyle='rgba(88, 85, 86, 0.85)';
 ctx.fillText(tagline,brandX+2,bottomY+44);

 const sealX=xRight-65,sealY=bottomY-10;
 drawScallopedSeal(ctx,sealX,sealY,shopName);

 return canvas.toDataURL('image/png');
}

async function createOrderCloseImage(order:Order,settings:PaymentSettings,ledgerName:string){
 await ensureMontserratLoaded();
 const navy='#585556',muted='rgba(88, 85, 86, 0.62)',paper='#fef9f4',line='#b9cddf',white='#fef9f4';
 const shopName=(settings.shopName||'Billy Shop').trim()||'Billy Shop';
 const width=800,pad=48,contentWidth=width-pad*2,qrSize=300,itemRowHeight=62;
 const rows=order.items.length?order.items:[{product_name:'Sản phẩm',quantity:1,unit_price:order.total}];
 const summaryLines=2+(order.shipping_fee>0?1:0)+(order.discount>0?1:0);
 const paymentTop=128,paymentHeight=440,orderTop=608;
 const orderCardHeight=130+rows.length*itemRowHeight+summaryLines*38+58;
 const footerHeight=settings.note?.trim()?170:126;
 const height=orderTop+orderCardHeight+footerHeight;
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas không khả dụng.');
 const text=(value:string,x:number,y:number,font:string,color=navy,align:CanvasTextAlign='left')=>{ctx.font=font;ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(value,x,y)};

 ctx.fillStyle=paper;ctx.fillRect(0,0,width,height);

 // Compact shop header
 let shopFont=34;ctx.font=`900 ${shopFont}px Montserrat, sans-serif`;
 while(ctx.measureText(shopName).width>430&&shopFont>22){shopFont-=2;ctx.font=`900 ${shopFont}px Montserrat, sans-serif`}
 text(shopName,pad,61,`900 ${shopFont}px Montserrat, sans-serif`);
 text((settings.tagline||'Coffeeshop and bakery').trim(),pad,88,'italic 500 15px Montserrat, sans-serif',muted);
 text(`ORDER  /  ${order.code}`,width-pad,62,'800 14px Montserrat, sans-serif',navy,'right');
 text(dateText(order.ordered_at),width-pad,88,'600 13px Montserrat, sans-serif',muted,'right');

 // Payment hero — the entire upper half focuses on payment.
 ctx.fillStyle=navy;drawRoundedRect(ctx,pad,paymentTop,contentWidth,paymentHeight,30);ctx.fill();
 const qrX=pad+30,qrY=paymentTop+70;
 ctx.fillStyle='rgba(254,249,244,.14)';drawRoundedRect(ctx,qrX-10,qrY-10,qrSize+20,qrSize+20,24);ctx.fill();
 let qrDrawn=false;
 if(settings.qrImage){
  try{const image=await loadCanvasImage(settings.qrImage);ctx.fillStyle=white;drawRoundedRect(ctx,qrX,qrY,qrSize,qrSize,18);ctx.fill();drawContainImage(ctx,image,qrX+16,qrY+16,qrSize-32,qrSize-32);qrDrawn=true}catch(err){console.error('Failed to load QR image:',err)}
 }
 if(!qrDrawn){
  try{const qrCanvas=document.createElement('canvas');await renderBankQrToCanvas(qrCanvas,{bankCodeOrName:settings.bankCode||settings.bankName,accountNumber:settings.accountNumber,accountName:settings.accountName,amount:order.total,memo:order.code,color:'#585556',width:qrSize-32});ctx.fillStyle=white;drawRoundedRect(ctx,qrX,qrY,qrSize,qrSize,18);ctx.fill();ctx.drawImage(qrCanvas,qrX+16,qrY+16,qrSize-32,qrSize-32);qrDrawn=true}catch(err){console.error('QR generation error:',err)}
 }
 if(!qrDrawn){ctx.fillStyle=white;drawRoundedRect(ctx,qrX,qrY,qrSize,qrSize,18);ctx.fill();text('QR CODE',qrX+qrSize/2,qrY+qrSize/2,'700 20px Montserrat, sans-serif',navy,'center')}
 text('QUÉT MÃ ĐỂ THANH TOÁN',qrX,qrY-27,'800 13px Montserrat, sans-serif','#fef9f4');

 const infoX=qrX+qrSize+42,infoRight=width-pad-30;
 text('SỐ TIỀN CẦN CHUYỂN',infoX,qrY+18,'700 11px Montserrat, sans-serif','rgba(254,249,244,.62)');
 let amountFont=35;ctx.font=`900 ${amountFont}px Montserrat, sans-serif`;
 while(ctx.measureText(cash(order.total)).width>infoRight-infoX&&amountFont>25){amountFont-=2;ctx.font=`900 ${amountFont}px Montserrat, sans-serif`}
 text(cash(order.total),infoX,qrY+60,`900 ${amountFont}px Montserrat, sans-serif`,'#fef9f4');
 ctx.strokeStyle='rgba(254,249,244,.18)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(infoX,qrY+90);ctx.lineTo(infoRight,qrY+90);ctx.stroke();
 const detail=(label:string,value:string,y:number)=>{text(label,infoX,y,'700 10px Montserrat, sans-serif','rgba(254,249,244,.55)');let shown=value||'Chưa cập nhật';ctx.font='800 16px Montserrat, sans-serif';while(shown.length>3&&ctx.measureText(shown+'…').width>infoRight-infoX)shown=shown.slice(0,-1);if(shown!==value&&value)shown+='…';text(shown,infoX,y+24,'800 16px Montserrat, sans-serif','#fef9f4')};
 detail('NGÂN HÀNG',settings.bankName||settings.bankCode||'',qrY+128);
 detail('SỐ TÀI KHOẢN',settings.accountNumber,qrY+193);
 detail('CHỦ TÀI KHOẢN',settings.accountName.toUpperCase(),qrY+258);
 detail('NỘI DUNG CHUYỂN KHOẢN',order.code,qrY+323);

 // Order information card
 ctx.fillStyle=white;drawRoundedRect(ctx,pad,orderTop,contentWidth,orderCardHeight,26);ctx.fill();ctx.strokeStyle=line;ctx.lineWidth=1.5;ctx.stroke();
 text('Chi tiết đơn hàng',pad+28,orderTop+45,'900 25px Montserrat, sans-serif');
 text(ledgerName||order.customer_name||'',width-pad-28,orderTop+43,'700 13px Montserrat, sans-serif',muted,'right');
 const tableLeft=pad+28,qtyX=540,priceX=width-pad-28,tableHeaderY=orderTop+92;
 text('SẢN PHẨM',tableLeft,tableHeaderY,'800 12px Montserrat, sans-serif',muted);
 text('SL',qtyX,tableHeaderY,'800 12px Montserrat, sans-serif',muted,'center');
 text('THÀNH TIỀN',priceX,tableHeaderY,'800 12px Montserrat, sans-serif',muted,'right');
 ctx.strokeStyle=line;ctx.beginPath();ctx.moveTo(tableLeft,tableHeaderY+19);ctx.lineTo(priceX,tableHeaderY+19);ctx.stroke();
 let y=tableHeaderY+58;
 for(const item of rows){
  ctx.font='700 17px Montserrat, sans-serif';let name=item.product_name||'Sản phẩm';while(name.length>3&&ctx.measureText(name+'…').width>390)name=name.slice(0,-1);if(name!==item.product_name)name+='…';
  text(name,tableLeft,y,'700 17px Montserrat, sans-serif');text(String(item.quantity),qtyX,y,'600 16px Montserrat, sans-serif',navy,'center');text(cash(item.unit_price*item.quantity),priceX,y,'600 16px Montserrat, sans-serif',navy,'right');y+=itemRowHeight;
 }
 ctx.strokeStyle=line;ctx.beginPath();ctx.moveTo(tableLeft,y-27);ctx.lineTo(priceX,y-27);ctx.stroke();
 const subtotal=order.total-order.shipping_fee+order.discount,summaryX=535;
 const summary=(label:string,value:string,strong=false)=>{text(label,summaryX,y,`${strong?900:600} ${strong?22:15}px Montserrat, sans-serif`,strong?navy:muted,'right');text(value,priceX,y,`${strong?900:600} ${strong?22:15}px Montserrat, sans-serif`,strong?navy:muted,'right');y+=strong?43:38};
 summary('Tạm tính',cash(subtotal));
 if(order.shipping_fee>0)summary('Phí ship',cash(order.shipping_fee));
 if(order.discount>0)summary('Giảm giá','-'+cash(order.discount));
 summary('Tổng cộng',cash(order.total),true);

 const footerTop=orderTop+orderCardHeight;
 if(settings.note?.trim())drawFormattedQuote(ctx,settings.note.trim(),shopName,pad,footerTop+52,560,27);
 const brandY=height-48;
 let footerShopFont=22;ctx.font=`900 ${footerShopFont}px Montserrat, sans-serif`;while(ctx.measureText(shopName).width>300&&footerShopFont>14){footerShopFont--;ctx.font=`900 ${footerShopFont}px Montserrat, sans-serif`}
 text(shopName,pad,brandY,`900 ${footerShopFont}px Montserrat, sans-serif`);
 text(`Cảm ơn ${order.customer_name||'bạn'} đã mua hàng`,width-pad-82,brandY-3,'600 12px Montserrat, sans-serif',muted,'right');
 drawScallopedSeal(ctx,width-pad-32,brandY-9,shopName);
 return canvas.toDataURL('image/png');
}
const input='input-push block h-12 min-w-0 max-w-full w-full px-4 text-[16px] font-semibold outline-none';
const area='card-push-subtle block min-h-24 min-w-0 max-w-full w-full resize-none p-3 text-[16px] font-semibold outline-none';

function Field({label,children}:{label:string;children:ReactNode}){return <label className="block"><span className="mb-2 block text-xs font-extrabold text-[#cecece]">{label}</span>{children}</label>}
function Money({label,value,set}:{label:string;value:string;set:(v:string)=>void}){return <Field label={label}><div className="relative"><CircleDollarSign size={18} className="absolute left-3 top-3.5 text-[#585556]/60"/><input value={cashInput(value)} onChange={e=>set(raw(e.target.value))} inputMode="numeric" placeholder="0" className={`${input} pl-10 pr-9 font-bold`}/><b className="absolute right-3 top-3.5 text-xs text-[#585556]/60">đ</b></div></Field>}
function DateField({label,value,set}:{label:string;value:string;set:(v:string)=>void}){const [open,setOpen]=useState(false);const dateObj=value?new Date(value):new Date();const [viewDate,setViewDate]=useState(new Date(dateObj.getFullYear(),dateObj.getMonth(),1));const year=viewDate.getFullYear(), month=viewDate.getMonth();const daysInMonth=new Date(year,month+1,0).getDate(), firstDay=new Date(year,month,1).getDay(), startOffset=firstDay===0?6:firstDay-1;const blanks=Array(startOffset).fill(null), dates=Array.from({length:daysInMonth},(_,i)=>i+1);const display=value?new Intl.DateTimeFormat('vi-VN',{day:'numeric',month:'short',year:'numeric'}).format(new Date(value+'T12:00:00')):'Chọn ngày';return <Field label={label}><div className="relative min-w-0"><button type="button" onClick={()=>setOpen(true)} className={`${input} flex items-center justify-between gap-2 text-left`}><span className={`min-w-0 flex-1 truncate ${value?'text-[#585556]':'text-[#585556]/50'}`}>{display}</span><CalendarDays size={18} className="shrink-0 text-[#585556]/60"/></button>{open&&<div className="fixed inset-0 z-[100] flex items-end bg-black/35 p-0 backdrop-blur-[2px] md:items-center md:justify-center md:p-5" onMouseDown={()=>setOpen(false)}><div className="card-push w-full rounded-t-3xl p-0 shadow-2xl md:max-w-sm md:rounded-2xl" onMouseDown={e=>e.stopPropagation()}><div className="flex items-center justify-between border-b border-[#585556]/30 px-5 py-4"><button onClick={()=>setViewDate(new Date(year,month-1,1))} className="btn-push flex h-10 w-10 items-center justify-center rounded-full"><ChevronDown className="rotate-90" size={18}/></button><b className="text-base text-[#585556]">Tháng {month+1}, {year}</b><button onClick={()=>setViewDate(new Date(year,month+1,1))} className="btn-push flex h-10 w-10 items-center justify-center rounded-full"><ChevronDown className="-rotate-90" size={18}/></button></div><div className="px-5 py-5"><div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black uppercase text-[#585556]/60 mb-3">{['T2','T3','T4','T5','T6','T7','CN'].map(d=><div key={d}>{d}</div>)}</div><div className="grid grid-cols-7 gap-1 text-center text-sm font-semibold text-[#585556]">{blanks.map((_,i)=><div key={`b-${i}`}/>)}{dates.map(d=>{const dStr=`${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;const isSel=value===dStr;return <button key={dStr} onClick={()=>{set(dStr);setOpen(false)}} className={`flex h-10 w-10 items-center justify-center rounded-full mx-auto ${isSel?'bg-[#585556] text-white font-black shadow-sm':'hover:bg-[#fef9f4] active:bg-[#fef9f4]'}`}>{d}</button>})}</div></div><div className="flex items-center gap-3 border-t border-[#585556]/30 px-5 py-4"><button onClick={()=>{set(nowDate());setOpen(false)}} className="btn-push flex-1 h-11 rounded-full text-sm font-black text-[#585556]">Hôm nay</button><button onClick={()=>setOpen(false)} className="btn-push-primary flex-1 h-11 rounded-full text-sm font-black text-white">Xong</button></div></div></div>}</div></Field>}
type SelectOption={value:string;label:string;description?:string;imageUrl?:string;disabled?:boolean};
function CustomSelect({value,onChange,options,placeholder='Chọn một mục'}:{value:string;onChange:(v:string)=>void;options:SelectOption[];placeholder?:string}){
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[preview,setPreview]=useState<{url:string;name:string}|null>(null);
 const selected=options.find(option=>option.value===value),selectedImage=selected?.imageUrl||productSelectImages.get(selected?.value||'');
 const shown=query?options.filter(option=>`${option.label} ${option.description||''}`.toLowerCase().includes(query.toLowerCase())):options;
 const productGrid=options.some(option=>productSelectIds.has(option.value));
 const choose=(option:SelectOption)=>{if(option.disabled)return;onChange(option.value);setOpen(false)};
 return <div className="min-w-0">
  <button type="button" onClick={()=>{setQuery('');setOpen(true)}} className={`${input} flex items-center justify-between gap-2 text-left`}>
   {selectedImage&&<img src={selectedImage} alt="" className="h-8 w-10 shrink-0 rounded-md border bg-white object-contain"/>}
   <span className={`min-w-0 flex-1 truncate ${selected?'text-[#585556]':'text-[#585556]/50'}`}>{selected?.label||placeholder}</span><ChevronDown size={18} className="shrink-0 text-[#585556]/60"/>
  </button>
  <AnimatePresence>{open&&<motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[100] flex items-end bg-black/35 backdrop-blur-[2px] md:items-center md:justify-center md:p-5" onMouseDown={()=>setOpen(false)}>
   <motion.div initial={{y:'100%',opacity:.7}} animate={{y:0,opacity:1}} exit={{y:'100%',opacity:.7}} transition={{type:'spring',stiffness:300,damping:30}} drag="y" dragConstraints={{top:0,bottom:0}} dragElastic={{top:0,bottom:.3}} onDragEnd={(_,info)=>{if(info.offset.y>120||info.velocity.y>800)setOpen(false)}} className="card-push flex h-auto max-h-[82dvh] w-full flex-col overflow-hidden rounded-t-3xl md:max-w-xl md:rounded-2xl" onMouseDown={event=>event.stopPropagation()}>
    <div className="flex shrink-0 items-center justify-between border-b border-[#585556]/30 px-5 py-4"><b>{placeholder}</b><button type="button" onClick={()=>setOpen(false)} className="btn-push flex h-10 w-10 items-center justify-center rounded-full"><X size={18}/></button></div>
    {options.length>6&&<div className="relative shrink-0 border-b border-[#585556]/30 p-3"><Search className="absolute left-6 top-6 h-5 text-[#585556]/60"/><input value={query} onChange={event=>setQuery(event.target.value)} autoFocus placeholder="Tìm nhanh sản phẩm" className={`${input} pl-10`}/></div>}
    <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(1rem+env(safe-area-inset-bottom))] ${productGrid?'grid grid-cols-2 content-start p-2':'p-2'}`}>
     {shown.length?shown.map((option,index)=>{const optionImage=option.imageUrl||productSelectImages.get(option.value),active=option.value===value;return productGrid?<div key={option.value} className={`relative min-w-0 p-2 ${index%2===0?'border-r border-[#585556]/20':''}`}><div className={`h-full rounded-xl p-2 transition ${active?'bg-[#585556] text-white':'bg-white'}`}>{optionImage?<button type="button" onClick={()=>setPreview({url:optionImage,name:option.label})} className="block aspect-[4/3] w-full overflow-hidden rounded-lg border border-black/10 bg-white" aria-label={`Xem ảnh ${option.label}`}><img src={optionImage} alt={option.label} className="h-full w-full object-contain"/></button>:<div className="flex aspect-[4/3] items-center justify-center rounded-lg border bg-[#fef9f4]"><PackageOpen className="text-[#585556]/60"/></div>}<button type="button" disabled={option.disabled} onClick={()=>choose(option)} className="mt-2 block w-full min-w-0 text-left disabled:opacity-35"><b className="block truncate text-[clamp(11px,3.2vw,14px)] leading-tight">{option.label}</b>{option.description&&<small className={`mt-1 block truncate text-[clamp(9px,2.7vw,12px)] font-semibold ${active?'text-white/70':'text-[#585556]/60'}`}>{option.description}</small>}</button>{active&&<Check size={17} className="absolute right-4 top-4 rounded-full bg-[#585556] p-0.5 text-white"/>}</div></div>:<button type="button" key={option.value} disabled={option.disabled} onClick={()=>choose(option)} className={`flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left disabled:opacity-35 ${active?'bg-[#585556] text-white':'hover:bg-white active:bg-white'}`}><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${active?'border-white bg-white text-[#585556]':'border-[#585556]/30'}`}>{active&&<Check size={14}/>}</span><span className="min-w-0 flex-1"><b className="block truncate text-sm">{option.label}</b>{option.description&&<small className={`mt-0.5 block truncate font-semibold ${active?'text-white/70':'text-[#585556]/60'}`}>{option.description}</small>}</span></button>}):<p className="col-span-2 p-6 text-center text-sm font-semibold text-[#585556]/60">Không tìm thấy sản phẩm phù hợp.</p>}
    </div>
   </motion.div>
  </motion.div>}</AnimatePresence>
  <AnimatePresence>{preview&&<motion.div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 p-5 backdrop-blur-sm" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setPreview(null)}><motion.div initial={{opacity:0,scale:.65,y:30}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:.75,y:20}} transition={{type:'spring',stiffness:260,damping:24}} className="relative max-h-[88dvh] w-full max-w-3xl overflow-hidden rounded-2xl bg-[#fef9f4] p-3 shadow-2xl" onClick={event=>event.stopPropagation()}><button type="button" onClick={()=>setPreview(null)} className="btn-push absolute right-5 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-full"><X size={20}/></button><img src={preview.url} alt={preview.name} className="max-h-[78dvh] w-full rounded-xl bg-white object-contain"/><p className="px-2 pb-1 pt-3 text-center text-sm font-black">{preview.name}</p></motion.div></motion.div>}</AnimatePresence>
 </div>
}
function Button({children,onClick,disabled=false,light=false}:{children:ReactNode;onClick:()=>void;disabled?:boolean;light?:boolean}){return <button type="button" onClick={onClick} disabled={disabled} className={`flex h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-black transition-all disabled:opacity-40 ${light?'btn-push text-[#585556]':'btn-push-primary'}`}>{children}</button>}
type MobileActionDetail={onClick:()=>void;disabled:boolean};
let currentMobileAction:MobileActionDetail|null=null;
const mobileActionListeners=new Set<()=>void>();
function getMobileAction(){return currentMobileAction}
function subscribeMobileAction(listener:()=>void){mobileActionListeners.add(listener);return()=>mobileActionListeners.delete(listener)}
function setMobileAction(action:MobileActionDetail|null){if(Object.is(currentMobileAction,action))return;currentMobileAction=action;mobileActionListeners.forEach(listener=>listener())}
function StickyActionBar({children,detail}:{children:ReactNode;detail?:ReactNode}){
 const childAction=isValidElement<{onClick:()=>void;disabled?:boolean}>(children)?children.props:null,onClickRef=useRef(childAction?.onClick);
 onClickRef.current=childAction?.onClick;
 const action=useMemo<MobileActionDetail|null>(()=>childAction?{onClick:()=>onClickRef.current?.(),disabled:!!childAction.disabled}:null,[!!childAction,childAction?.disabled]);
 useEffect(()=>{setMobileAction(action);return()=>{if(getMobileAction()===action)setMobileAction(null)}},[action]);
 return <motion.div initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} transition={{type:'spring',stiffness:320,damping:28}} className="sticky bottom-4 mt-5 hidden items-center justify-between gap-3 rounded-2xl border border-[#585556]/20 bg-[#fef9f4]/95 p-2.5 shadow-[0_16px_50px_rgba(88,85,86,.22)] backdrop-blur-xl md:flex"><div className="min-w-0 flex-1">{detail}</div><div className="shrink-0 [&>button]:min-w-[152px]">{children}</div></motion.div>
}

function MultiProductPicker({products,selected,onConfirm,purpose='stock'}:{products:Product[];selected:string[];onConfirm:(ids:string[])=>void;purpose?:'stock'|'order'}){
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[draft,setDraft]=useState<string[]>(selected);
 const forOrder=purpose==='order';
 const shown=products.filter(product=>`${product.name} ${product.sku||''} ${product.category||''}`.toLowerCase().includes(query.trim().toLowerCase()));
 const launch=()=>{setDraft(selected);setQuery('');setOpen(true)};
 const toggle=(id:string)=>setDraft(current=>current.includes(id)?current.filter(item=>item!==id):[...current,id]);
 return <>
  <button type="button" onClick={launch} className="btn-push flex h-11 items-center gap-2 rounded-full px-4 text-xs font-black text-[#585556]"><Boxes size={18}/> {forOrder?'Chọn nhiều sản phẩm':'Chọn sản phẩm'}</button>
  <AnimatePresence>{open&&<motion.div className="fixed inset-0 z-[110] flex items-end bg-black/40 backdrop-blur-[3px] md:items-center md:justify-center md:p-5" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onMouseDown={()=>setOpen(false)}>
   <motion.div initial={{y:'100%',opacity:.7}} animate={{y:0,opacity:1}} exit={{y:'100%',opacity:.7}} transition={{type:'spring',stiffness:300,damping:30}} drag="y" dragConstraints={{top:0,bottom:0}} dragElastic={{top:0,bottom:.35}} onDragEnd={(_,info)=>{if(info.offset.y>120||info.velocity.y>800)setOpen(false)}} className="card-push flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-3xl md:max-w-2xl md:rounded-2xl" onMouseDown={event=>event.stopPropagation()}>
    <div className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-[#585556]/30 md:hidden"/>
    <div className="flex shrink-0 items-center justify-between border-b border-[#585556]/30 px-5 py-4"><div><h2 className="font-black">{forOrder?'Sản phẩm trong đơn':'Chọn sản phẩm nhập kho'}</h2><p className="mt-0.5 text-xs font-semibold text-[#585556]/60">Đã chọn {draft.length} sản phẩm</p></div><button type="button" onClick={()=>setOpen(false)} className="btn-push flex h-10 w-10 items-center justify-center rounded-full"><X size={18}/></button></div>
    <div className="relative shrink-0 border-b border-[#585556]/30 p-3"><Search className="absolute left-6 top-6 h-5 text-[#585556]/60"/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Tìm tên, SKU hoặc nhóm hàng" className={`${input} pl-10`}/></div>
    <div className="grid min-h-0 flex-1 grid-cols-2 content-start overflow-y-auto overscroll-contain p-2">{shown.filter(product=>forOrder||tracksStock(product)).map((product,index)=>{const active=draft.includes(product.id),stocked=tracksStock(product);return <motion.button layout type="button" key={product.id} onClick={()=>toggle(product.id)} whileTap={{scale:.98}} className={`relative min-w-0 p-2 text-left ${index%2===0?'border-r border-[#585556]/20':''}`}><div className={`h-full rounded-xl border p-2 transition-colors ${active?'border-[#585556] bg-[#b9cddf]':'border-transparent bg-white'}`}><div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border bg-white">{product.image_url?<img src={product.image_url} alt={product.name} className="h-full w-full object-contain"/>:<PackageOpen className="text-[#585556]/60"/>}{active&&<motion.span initial={{scale:0}} animate={{scale:1}} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[#585556] text-white shadow"><Check size={16}/></motion.span>}</div><b className="mt-2 block truncate text-[clamp(11px,3.2vw,14px)]">{product.name}</b><small className="block truncate font-semibold text-[#585556]/60">{stocked?`Tồn ${product.stock_quantity}`:'Món bán không trừ tồn'} · {forOrder?'Giá':'Vốn'} {cash(forOrder?product.selling_price:product.unit_cost)}</small></div></motion.button>})}{!shown.length&&<p className="col-span-2 p-8 text-center text-sm font-semibold text-[#585556]/60">Không tìm thấy sản phẩm phù hợp.</p>}</div>
    <div className="shrink-0 border-t border-[#585556]/30 bg-[#fef9f4]/95 p-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] backdrop-blur"><Button onClick={()=>{onConfirm(draft);setOpen(false)}} disabled={!draft.length}><Check/> Thêm {draft.length} sản phẩm</Button></div>
   </motion.div>
  </motion.div>}</AnimatePresence>
 </>
}
function Empty({title,text,icon}:{title:string;text:string;icon:ReactNode}){return <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed border-[#585556]/25 bg-white/50 p-6 text-center"><span className="mb-3 text-[#585556]/60">{icon}</span><b>{title}</b><p className="mt-1 text-sm font-medium text-[#585556]/60">{text}</p></div>}
function Loading(){return <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-24 animate-pulse rounded-xl bg-white/60"/>)}</div>}
function Title({small,title,text}:{small:string;title:string;text:string}){return <header className="mb-6 flex items-start justify-between gap-3"><div className="min-w-0 flex-1"><p className="text-[11px] font-black uppercase tracking-[.18em] text-[#585556]/75">{small}</p><h1 className="mt-1.5 text-2xl font-black tracking-normal text-[#585556] md:text-3xl">{title}</h1><p className="mt-1.5 text-sm font-semibold leading-relaxed text-[#585556]/75">{text}</p></div><div className="flex shrink-0 items-center gap-2 pt-0.5">{small==='Đơn hàng'&&<button type="button" onClick={()=>window.dispatchEvent(new Event('export-orders'))} aria-label="Xuất Excel" title="Xuất Excel" className="btn-push flex h-10 w-10 items-center justify-center rounded-full text-emerald-800"><FileSpreadsheet size={18}/></button>}<HelpMenu/></div></header>}
function Nav({view}:{view:View}){
 const router=useRouter();
 const action=useSyncExternalStore(subscribeMobileAction,getMobileAction,()=>null);
 const left=[['dashboard','/business','Tổng quan',<Store key="1"/>],['inventory','/business/inventory','Kho hàng',<Boxes key="2"/>]],right=[['orders','/business/orders','Đơn hàng',<ReceiptText key="3"/>],['reports','/business/reports','Thống kê',<BarChart3 key="4"/>]];
 const mobileItem=([key,href,label,icon]:ReactNode[])=>{const active=view===key;return <Link key={String(key)} href={String(href)} onClick={()=>setMobileAction(null)} aria-label={String(label)} title={String(label)} aria-current={active?'page':undefined} className="relative z-10 flex h-full min-w-0 items-center justify-center pt-0.5"><motion.span animate={{y:active?-1:0,scale:active?1.06:1}} whileTap={{scale:.86}} transition={{type:'spring',stiffness:460,damping:28}} className={`relative flex h-11 w-11 items-center justify-center rounded-full transition-all [&_svg]:h-[22px] [&_svg]:w-[22px] ${active?'border-2 border-[#585556] bg-[#fef9f4] text-[#585556] shadow-[0_4px_0_0_#cecece]':'text-[#585556]/75 hover:text-[#585556]'}`}>{icon}</motion.span></Link>};
 const desktopItem=([key,href,label,icon]:ReactNode[]) => <Link key={String(key)} href={String(href)} onClick={()=>setMobileAction(null)} className={`flex h-12 min-w-0 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-black transition-all [&_svg]:h-[18px] [&_svg]:w-[18px] ${view===key?'border-2 border-[#585556] bg-[#fef9f4] text-[#585556] shadow-[0_4px_0_0_#cecece]':'text-[#585556]/75 hover:text-[#585556]'}`}>{icon}<span>{label}</span></Link>;
 const trigger=()=>{if(action){if(!action.disabled)action.onClick();return}if(view==='orders'){history.replaceState(null,'','/business/orders#new-order');window.dispatchEvent(new Event('quick-order'))}else router.push('/business/orders#new-order')};
 const actionIcon=<AnimatePresence mode="wait" initial={false}>{action?.disabled?<motion.span key="loading" initial={{opacity:0,scale:.5}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:.5}}><Loader2 size={22} className="animate-spin text-[#585556]"/></motion.span>:action?<motion.span key="check" initial={{opacity:0,scale:.45,rotate:-100}} animate={{opacity:1,scale:1,rotate:0}} exit={{opacity:0,scale:.45,rotate:100}} transition={{type:'spring',stiffness:500,damping:25}}><Check size={24} strokeWidth={3} className="text-[#585556]"/></motion.span>:<motion.span key="plus" initial={{opacity:0,scale:.45,rotate:100}} animate={{opacity:1,scale:1,rotate:0}} exit={{opacity:0,scale:.45,rotate:-100}} transition={{type:'spring',stiffness:500,damping:25}}><Plus size={24} strokeWidth={3.5} className="text-white"/></motion.span>}</AnimatePresence>;
 return <>
  <nav className="fixed left-1/2 z-40 grid h-[68px] w-[calc(100%_-_32px)] max-w-md -translate-x-1/2 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_76px_minmax(0,1fr)_minmax(0,1fr)] items-center overflow-visible rounded-full border-2 border-[#585556] bg-[#fef9f4] px-2 shadow-[0_5px_0_0_#585556] md:hidden" style={{bottom:'calc(16px + env(safe-area-inset-bottom))'}}>{left.map(mobileItem)}<div className="relative z-20 flex h-full w-full items-center justify-center"><motion.button type="button" onClick={trigger} disabled={action?.disabled} aria-label={action?'Xác nhận thao tác':'Tạo đơn nhanh'} title={action?'Xác nhận thao tác':'Tạo đơn nhanh'} whileTap={{scale:.92}} className="absolute -top-7 left-0 right-0 mx-auto flex h-[58px] w-[58px] items-center justify-center rounded-full border-2 border-transparent bg-[#b9cddf] shadow-[0_4px_0_0_#cecece] outline-none disabled:cursor-wait [&_svg]:h-7 [&_svg]:w-7">{actionIcon}</motion.button></div>{right.map(mobileItem)}</nav>
  <nav className="mb-5 hidden w-fit items-center gap-1.5 rounded-full border-2 border-[#585556] bg-[#fef9f4] p-1.5 shadow-[0_4px_0_0_#585556] md:flex">{left.map(desktopItem)}<motion.button type="button" onClick={trigger} disabled={action?.disabled} aria-label={action?'Xác nhận thao tác':'Tạo đơn nhanh'} whileTap={{scale:.9}} className="flex h-11 w-11 items-center justify-center rounded-full bg-[#b9cddf] shadow-[0_4px_0_0_#cecece] disabled:cursor-wait">{actionIcon}</motion.button>{right.map(desktopItem)}</nav>
 </>
}
function Picker({ledgers,id,set,add}:{ledgers:Ledger[];id:string;set:(v:string)=>void;add:()=>void}){return <div className="flex min-w-0 gap-2"><div className="min-w-0 flex-1 md:max-w-sm"><CustomSelect value={id} onChange={set} placeholder="Chọn sổ bán hàng" options={ledgers.map(x=>({value:x.id,label:x.name,description:`Sổ tháng ${x.month} · ${x.order_count} đơn`}))}/></div><button onClick={add} title="Tạo sổ" className="btn-push flex h-12 w-12 shrink-0 items-center justify-center rounded-full"><Plus/></button></div>}
function Panel({children,className=''}:{children:ReactNode;className?:string}){return <section className={`card-push p-5 md:p-6 ${className}`}>{children}</section>}

export default function BusinessClient({view='dashboard'}:{view?:View}){
 const {user,token:ctx,logout,isLoading:auth}=useAuth(),router=useRouter();
 const token=ctx||(typeof window!=='undefined'?(localStorage.getItem('token')||localStorage.getItem('access_token')):null), headers=useMemo(()=>({Authorization:`Bearer ${token}`}),[token]);
 const [initial]=useState(()=>initialBusinessState(user?.id,view));
 const [ledgers,setLedgers]=useState<Ledger[]>(initial?.ledgers||[]),[ledger,setLedger]=useState(initial?.ledger||''),[products,setProducts]=useState<Product[]>(initial?.products||[]),[receipts,setReceipts]=useState<Receipt[]>(initial?.receipts||[]),[batches,setBatches]=useState<InventoryBatch[]>(initial?.batches||[]),[orders,setOrders]=useState<Order[]>(initial?.orders||[]),[report,setReport]=useState<Report|null>(initial?.report||null);
 productSelectIds.clear();products.forEach(product=>{productSelectIds.add(product.id);if(product.image_url)productSelectImages.set(product.id,product.image_url);else productSelectImages.delete(product.id)});
 const [loading,setLoading]=useState(!initial),[loadingBook,setLoadingBook]=useState(Boolean(initial?.ledger&&((view==='orders'&&!initial.orders)||(view!=='inventory'&&view!=='orders'&&!initial.report)))),[toast,setToast]=useState(''),[bookForm,setBookForm]=useState(false),[book,setBook]=useState({name:'',month:nowMonth(),opening_cash:'',note:''}),[saving,setSaving]=useState(false);
 const notify=(s:string)=>{setToast(s);setTimeout(()=>setToast(''),2400)}, fail=(e:unknown,s:string)=>{if(axios.isAxiosError(e)&&e.response?.status===401)logout();notify(axios.isAxiosError(e)&&typeof e.response?.data?.detail==='string'?e.response.data.detail:s)};
 const choose=(id:string)=>{setLedger(id);if(id)localStorage.setItem('business_ledger_id',id)};
 useEffect(()=>{if(!auth&&!user)router.replace('/login')},[auth,user,router]);
 useEffect(()=>{if(!token||!user)return;router.prefetch('/business');router.prefetch('/business/inventory');router.prefetch('/business/orders');router.prefetch('/business/reports');let ok=true;const prefix=`business:${user.id}`,cachedLedgers=readBusinessCache<Ledger[]>(`${prefix}:ledgers`),cachedProducts=readBusinessCache<Product[]>(`${prefix}:products`),cachedReceipts=readBusinessCache<Receipt[]>(`${prefix}:receipts`),cachedBatches=readBusinessCache<InventoryBatch[]>(`${prefix}:batches`),hasCache=!!cachedLedgers;if(cachedLedgers){setLedgers(cachedLedgers);const saved=localStorage.getItem('business_ledger_id');setLedger(cachedLedgers.some(item=>item.id===saved)?saved!:(cachedLedgers[0]?.id||''))}if(cachedProducts&&(view==='inventory'||view==='orders'))setProducts(cachedProducts);if(cachedReceipts&&view==='inventory')setReceipts(cachedReceipts);if(cachedBatches&&view==='inventory')setBatches(cachedBatches);setLoading(!hasCache);(async()=>{try{const needProducts=view==='inventory'||view==='orders';const [ledgerResponse,productResponse,receiptResponse,batchResponse]=await Promise.all([axios.get<Ledger[]>(`${API}/api/business/ledgers`,{headers}),needProducts?axios.get<Product[]>(`${API}/api/business/products`,{headers}):Promise.resolve({data:[] as Product[]}),view==='inventory'?axios.get<Receipt[]>(`${API}/api/business/stock-receipts`,{headers}):Promise.resolve({data:[] as Receipt[]}),view==='inventory'?axios.get<InventoryBatch[]>(`${API}/api/business/inventory-batches`,{headers}):Promise.resolve({data:[] as InventoryBatch[]})]);if(!ok)return;setLedgers(ledgerResponse.data);writeBusinessCache(`${prefix}:ledgers`,ledgerResponse.data);if(needProducts){setProducts(productResponse.data);writeBusinessCache(`${prefix}:products`,productResponse.data)}if(view==='inventory'){setReceipts(receiptResponse.data);setBatches(batchResponse.data);writeBusinessCache(`${prefix}:receipts`,receiptResponse.data);writeBusinessCache(`${prefix}:batches`,batchResponse.data)}setLedger(current=>{if(current&&ledgerResponse.data.some(item=>item.id===current))return current;const saved=localStorage.getItem('business_ledger_id');return ledgerResponse.data.some(item=>item.id===saved)?saved!:(ledgerResponse.data[0]?.id||'')})}catch(e){if(!hasCache)fail(e,'Không tải được dữ liệu.')}finally{if(ok)setLoading(false)}})();return()=>{ok=false}},[token,user,view,headers,router]);
 useEffect(()=>{if(!ledger||loading||view==='inventory'||!user)return;let ok=true;const prefix=`business:${user.id}:ledger:${ledger}`,cachedOrders=readBusinessCache<Order[]>(`${prefix}:orders`),cachedReport=readBusinessCache<Report>(`${prefix}:report`),hasCache=view==='orders'?!!cachedOrders:!!cachedReport;if(cachedOrders)setOrders(view==='dashboard'?cachedOrders.slice(0,6):cachedOrders);if(cachedReport)setReport(cachedReport);setLoadingBook(!hasCache);(async()=>{try{if(view==='orders'){const response=await axios.get<Order[]>(`${API}/api/business/orders?ledger_id=${ledger}&limit=100`,{headers});if(ok){setOrders(response.data);writeBusinessCache(`${prefix}:orders`,response.data)}}else{const [reportResponse,ordersResponse]=await Promise.all([axios.get<Report>(`${API}/api/business/reports/${ledger}`,{headers}),view==='dashboard'?axios.get<Order[]>(`${API}/api/business/orders?ledger_id=${ledger}&limit=6`,{headers}):Promise.resolve({data:[] as Order[]})]);if(ok){setReport(reportResponse.data);writeBusinessCache(`${prefix}:report`,reportResponse.data);if(view==='dashboard'){setOrders(ordersResponse.data);writeBusinessCache(`${prefix}:orders`,ordersResponse.data)}}}}catch(e){if(!hasCache)fail(e,'Không tải được sổ.')}finally{if(ok)setLoadingBook(false)}})();return()=>{ok=false}},[ledger,loading,view,headers,user]);
 useEffect(()=>{if(!user||loading)return;const prefix=`business:${user.id}`;writeBusinessCache(`${prefix}:ledgers`,ledgers);if(view==='inventory'||view==='orders')writeBusinessCache(`${prefix}:products`,products);if(view==='inventory'){writeBusinessCache(`${prefix}:receipts`,receipts);writeBusinessCache(`${prefix}:batches`,batches)}},[user,loading,view,ledgers,products,receipts,batches]);
 useEffect(()=>{if(!user||!ledger||loadingBook||view==='inventory')return;const prefix=`business:${user.id}:ledger:${ledger}`;if(view==='orders')writeBusinessCache(`${prefix}:orders`,orders);if(report)writeBusinessCache(`${prefix}:report`,report)},[user,ledger,loadingBook,view,orders,report]);
 const saveBook=async()=>{if(!book.name||!book.month)return notify('Nhập tên sổ và tháng.');setSaving(true);try{const r=await axios.post<Ledger>(`${API}/api/business/ledgers`,{...book,opening_cash:num(book.opening_cash)},{headers});setLedgers(x=>[r.data,...x]);choose(r.data.id);setBookForm(false);setBook({name:'',month:nowMonth(),opening_cash:'',note:''});notify('Đã tạo sổ bán hàng.')}catch(e){fail(e,'Không tạo được sổ.')}finally{setSaving(false)}};
 const shell=(body:ReactNode)=><MotionConfig reducedMotion="user" transition={{duration:.22,ease:[.22,1,.36,1]}}><div className="min-h-screen w-full bg-[#fef9f4] p-3 pb-[calc(12rem+env(safe-area-inset-bottom))] pt-[calc(4.75rem+env(safe-area-inset-top,0px))] text-[#585556] md:flex md:gap-5 md:p-6 md:pb-8 md:pt-6"><Sidebar/><main className="min-w-0 max-w-full flex-1"><div className="mx-auto min-w-0 max-w-6xl"><Nav view={view}/><div>{body}</div><div className="h-10 md:hidden" aria-hidden="true"/></div></main><AnimatePresence>{toast&&<motion.div initial={{opacity:0,y:-16,scale:.96}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:-10,scale:.97}} className="btn-push-primary fixed left-1/2 top-20 z-[80] flex max-w-[calc(100vw-24px)] -translate-x-1/2 items-center gap-2 px-5 py-3 text-sm font-bold text-white"><Check size={17}/>{toast}</motion.div>}</AnimatePresence>{bookForm&&<Modal close={()=>setBookForm(false)} title="Tạo sổ bán hàng"><div className="space-y-4"><Field label="Tên sổ"><input value={book.name} onChange={e=>setBook({...book,name:e.target.value})} placeholder="Shop tháng 9" className={input}/></Field><Field label="Tháng"><input type="month" value={book.month} onChange={e=>setBook({...book,month:e.target.value})} className={input}/></Field><Money label="Tiền mặt đầu kỳ" value={book.opening_cash} set={v=>setBook({...book,opening_cash:v})}/><Field label="Ghi chú"><textarea value={book.note} onChange={e=>setBook({...book,note:e.target.value})} className={area}/></Field><Button onClick={saveBook} disabled={saving}>{saving?<Loader2 className="animate-spin"/>:<Plus/>} Tạo sổ</Button></div></Modal>}</div></MotionConfig>;
 if(auth||!user)return <div className="min-h-screen bg-[#fef9f4]"/>;if(loading)return shell(<Loading/>);
 const props={ledgers,ledger,choose,addBook:()=>setBookForm(true),headers,notify,fail};
 if(view==='inventory')return shell(<Inventory products={products} setProducts={setProducts} receipts={receipts} setReceipts={setReceipts} batches={batches} setBatches={setBatches} headers={headers} notify={notify} fail={fail}/>);
 if(view==='orders')return shell(<OrdersV3 {...props} products={products} setProducts={setProducts} orders={orders} setOrders={setOrders} loading={loadingBook}/>);
 if(view==='reports')return shell(<Reports {...props} report={report} setReport={setReport} loading={loadingBook}/>);
 return shell(<Dashboard {...props} report={report} orders={orders} loading={loadingBook}/>);
}

function Modal({close,title,children}:{close:()=>void;title:string;children:ReactNode}){return <motion.div initial={{opacity:0}} animate={{opacity:1}} className="fixed inset-0 z-[200] flex items-end bg-black/30 backdrop-blur-[2px] md:items-center md:justify-center md:p-5" onMouseDown={close}><motion.div initial={{y:'100%',opacity:.7}} animate={{y:0,opacity:1}} transition={{type:'spring',stiffness:300,damping:30}} drag="y" dragConstraints={{top:0,bottom:0}} dragElastic={{top:0,bottom:.3}} onDragEnd={(_,info)=>{if(info.offset.y>120||info.velocity.y>800)close()}} className="card-push flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden p-0 shadow-2xl md:h-auto md:max-h-[92vh] md:max-w-lg md:rounded-2xl" onMouseDown={e=>e.stopPropagation()}><div className="shrink-0 border-b border-[#585556]/30 bg-[#fef9f4] px-5 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] md:pt-5"><div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[#585556]/30 md:hidden"/><div className="flex items-center justify-between gap-3"><h2 className="min-w-0 truncate text-lg font-black">{title}</h2><button onClick={close} className="btn-push flex h-10 w-10 shrink-0 items-center justify-center rounded-full"><X/></button></div></div><div className="min-h-0 flex-1 overflow-y-auto p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">{children}</div></motion.div></motion.div>}

function MinimalEdit({ size = 15, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function MinimalTrash({ size = 15, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function ConfirmModal({
  title,
  message,
  confirmText = 'Xóa',
  cancelText = 'Hủy',
  isDanger = true,
  onConfirm,
  onClose
}: {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[3px]"
      onMouseDown={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: .92, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        className="card-push w-full max-w-sm p-6 text-center"
        onMouseDown={e => e.stopPropagation()}
      >
        <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl ${isDanger ? 'bg-[#b9cddf] text-[#585556]' : 'bg-[#b9cddf] text-[#cecece]'}`}>
          {isDanger ? <MinimalTrash size={22} /> : <Check size={22} />}
        </div>
        <h3 className="text-base font-black text-[#585556]">{title}</h3>
        {message && (
          <p className="mt-2 text-xs font-semibold leading-relaxed text-[#585556]/60">
            {message}
          </p>
        )}
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="btn-push h-11 rounded-full text-sm font-black text-[#585556]"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onConfirm();
            }}
            className={`${isDanger ? 'btn-push-danger' : 'btn-push-primary'} h-11 rounded-full text-sm font-black`}
          >
            {confirmText}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function SwipeableItem({
  children,
  onEdit,
  onDelete,
  editTitle = "Sửa",
  deleteTitle = "Xóa"
}: {
  children: ReactNode;
  onEdit?: () => void;
  onDelete: () => void;
  editTitle?: string;
  deleteTitle?: string;
}) {
  const [offsetX, setOffsetX] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const scrollDirectionRef = useRef<'horizontal' | 'vertical' | null>(null);
  const isSwipingRef = useRef(false);
  const mouseStartRef = useRef<{ x: number } | null>(null);

  const actionsWidth = onEdit ? 140 : 70;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
    isSwipingRef.current = false;
    scrollDirectionRef.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const dx = e.touches[0].clientX - touchStartRef.current.x;
    const dy = e.touches[0].clientY - touchStartRef.current.y;

    if (!scrollDirectionRef.current) {
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
        scrollDirectionRef.current = 'horizontal';
        isSwipingRef.current = true;
      } else if (Math.abs(dy) > 8) {
        scrollDirectionRef.current = 'vertical';
        return;
      }
    }

    if (scrollDirectionRef.current === 'horizontal') {
      const base = isOpen ? -actionsWidth : 0;
      let nextOffset = base + dx;
      if (nextOffset > 0) nextOffset = nextOffset * 0.15;
      if (nextOffset < -(actionsWidth + 25)) nextOffset = -actionsWidth - 25 + (nextOffset + actionsWidth + 25) * 0.15;
      setOffsetX(nextOffset);
    }
  };

  const handleTouchEnd = () => {
    if (scrollDirectionRef.current === 'horizontal') {
      if (offsetX < -actionsWidth * 0.4) {
        setOffsetX(-actionsWidth);
        setIsOpen(true);
      } else {
        setOffsetX(0);
        setIsOpen(false);
      }
    }
    touchStartRef.current = null;
    isSwipingRef.current = false;
    scrollDirectionRef.current = null;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, a, input, select, textarea')) return;
    mouseStartRef.current = { x: e.clientX };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!mouseStartRef.current) return;
    const dx = e.clientX - mouseStartRef.current.x;
    if (Math.abs(dx) > 5) {
      const base = isOpen ? -actionsWidth : 0;
      let nextOffset = base + dx;
      if (nextOffset > 0) nextOffset = nextOffset * 0.15;
      if (nextOffset < -(actionsWidth + 25)) nextOffset = -actionsWidth - 25;
      setOffsetX(nextOffset);
    }
  };

  const handleMouseUp = () => {
    if (mouseStartRef.current) {
      if (offsetX < -actionsWidth * 0.4) {
        setOffsetX(-actionsWidth);
        setIsOpen(true);
      } else {
        setOffsetX(0);
        setIsOpen(false);
      }
      mouseStartRef.current = null;
    }
  };

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-[#585556]/30 bg-[#fef9f4] select-none"
      style={{ touchAction: 'pan-y' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <div className="absolute inset-y-0 right-0 flex items-stretch z-0">
        {onEdit && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOffsetX(0);
              setIsOpen(false);
              onEdit();
            }}
            className="flex w-[70px] flex-col items-center justify-center gap-1 bg-[#585556] text-white hover:bg-[#585556] active:bg-[#585556] transition-colors cursor-pointer"
            title={editTitle}
          >
            <MinimalEdit size={16} />
            <span className="text-[10px] font-bold">Sửa</span>
          </button>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOffsetX(0);
            setIsOpen(false);
            onDelete();
          }}
          className="flex w-[70px] flex-col items-center justify-center gap-1 bg-[#585556] text-white hover:bg-[#585556] active:bg-[#585556] transition-colors cursor-pointer"
          title={deleteTitle}
        >
          <MinimalTrash size={16} />
          <span className="text-[10px] font-bold">Xóa</span>
        </button>
      </div>

      <div
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isSwipingRef.current ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          touchAction: 'pan-y'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => {
          if (isOpen) {
            setOffsetX(0);
            setIsOpen(false);
          }
        }}
        className="relative z-10 bg-white"
      >
        {children}
      </div>
    </div>
  );
}

function HelpMenu(){const [open,setOpen]=useState(false);const steps=[['1. Tạo sổ bán hàng','Mở Tổng quan, bấm dấu + cạnh ô chọn sổ và tạo một sổ cho tháng đang bán. Mọi đơn và chi phí trong tháng sẽ nằm trong sổ này.'],['2. Tạo danh mục sản phẩm','Vào Kho hàng → Sản phẩm mới. Thêm tên, ảnh, SKU, nhóm hàng, giá bán và giá vốn mặc định.'],['3. Nhập hàng vào kho','Trong Kho hàng, chọn Nhập lô hàng. Chọn ngày, nguồn hàng, từng sản phẩm, số lượng và vốn thực tế. Có thể thêm nhiều sản phẩm trong cùng một phiếu.'],['4. Chốt đơn cho khách','Bấm nút + lớn giữa thanh điều hướng. Chọn hàng từ kho, số lượng, giá bán, thông tin khách, ship và giảm giá rồi xác nhận. Kho sẽ tự trừ.'],['5. Sửa hoặc xóa đơn','Trong danh sách Đơn hàng, dùng nút bút để sửa hoặc thùng rác để xóa. Hệ thống tự hoàn tồn cũ và tính lại tồn mới.'],['6. Ghi các khoản chi','Vào Thống kê → Ghi chi phí để thêm quảng cáo, đóng gói, thuê kho hoặc chi phí vận hành khác.'],['7. Xem và xuất báo cáo','Thống kê hiển thị doanh thu, vốn, ship, lãi và sản phẩm bán tốt. Tại Đơn hàng, bấm Xuất Excel để lưu bảng dữ liệu về máy.']];return <><button type="button" onClick={()=>setOpen(true)} aria-label="Hướng dẫn sử dụng" title="Hướng dẫn sử dụng" className="btn-push flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#585556]"><HelpCircle size={19}/></button>{open&&<Modal close={()=>setOpen(false)} title="Hướng dẫn sử dụng"><p className="mb-4 text-sm font-medium leading-6 text-[#585556]/75">Làm lần lượt theo quy trình dưới đây để tồn kho và lợi nhuận luôn chính xác.</p><div className="space-y-3">{steps.map(([title,text],index)=><div key={title} className="flex gap-3 rounded-xl border border-[#585556]/30 bg-white p-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#585556] text-xs font-black text-white">{index+1}</span><div><b className="text-sm">{title}</b><p className="mt-1 text-sm font-medium leading-5 text-[#585556]/75">{text}</p></div></div>)}</div><div className="mt-4 rounded-xl bg-[#fef9f4] p-3 text-xs font-bold leading-5 text-[#585556]/70">Quy trình chuẩn: Tạo sổ → Tạo sản phẩm → Nhập kho → Tạo đơn → Ghi chi phí → Xem báo cáo.</div></Modal>}</>}
type Shared={ledgers:Ledger[];ledger:string;choose:(v:string)=>void;addBook:()=>void;headers:Record<string,string>;notify:(s:string)=>void;fail:(e:unknown,s:string)=>void};
function Dashboard({ledgers,ledger,choose,addBook,report,orders,loading}:Shared&{report:Report|null;orders:Order[];loading:boolean}){return <><Panel><Title small="Bán hàng" title="Hôm nay cần làm gì?" text="Chọn sổ tháng, nhập hàng vào kho rồi tạo đơn khi khách chốt."/><Picker ledgers={ledgers} id={ledger} set={choose} add={addBook}/>{!ledgers.length?<div className="mt-5"><Empty icon={<ClipboardList size={30}/>} title="Bắt đầu bằng một sổ bán hàng" text="Mỗi tháng dùng một sổ để số liệu không bị trộn."/></div>:loading?<div className="mt-5"><Loading/></div>:<div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">{[['Doanh thu',cash(report?.revenue),<TrendingUp key="1"/>],['Lợi nhuận ròng',cash(report?.net_profit),<CircleDollarSign key="2"/>],['Đơn hàng',`${report?.order_count||0} đơn`,<ReceiptText key="3"/>],['Tồn kho',`${report?.stock_units||0} món`,<Boxes key="4"/>]].map(x=><div key={String(x[0])} className="rounded-xl border bg-white p-3"><span className="text-[#585556] [&_svg]:h-5">{x[2]}</span><p className="mt-3 text-[11px] font-bold text-[#585556]/60">{x[0]}</p><b className="mt-1 block break-words">{x[1]}</b></div>)}</div>}</Panel><div className="mt-4 grid gap-3 md:grid-cols-3"><Action href="/business/inventory" n="1" title="Nhập kho" text="Tạo sản phẩm và nhập lô hàng" icon={<Boxes/>}/><Action href="/business/orders" n="2" title="Tạo đơn" text="Chọn hàng trong kho cho khách" icon={<ShoppingBag/>}/><Action href="/business/reports" n="3" title="Xem thống kê" text="Doanh thu, chi phí và lãi" icon={<BarChart3/>}/></div><Panel className="mt-4"><h2 className="mb-2 font-black">Đơn gần đây</h2>{orders.length?orders.map(o=><OrderRow key={o.id} o={o}/>):<p className="rounded-xl bg-white p-5 text-center text-sm font-semibold text-[#585556]/60">Chưa có đơn trong sổ này.</p>}</Panel></>}
function Action({href,n,title,text,icon}:{href:string;n:string;title:string;text:string;icon:ReactNode}){return <Link href={href} className="neu-surface-subtle neu-press flex items-center gap-3 p-4"><div className="relative flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#585556] bg-[#585556] text-white shadow-[0_6px_0_0_#cecece] [&_svg]:h-6 [&_svg]:w-6">{icon}<i className="absolute -right-1.5 -top-1.5 flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-[#fef9f4] bg-[#585556] text-[10px] font-black not-italic text-white shadow-[0_2px_0_0_#cecece]">{n}</i></div><div><b>{title}</b><p className="text-xs font-semibold text-[#585556]/60">{text}</p></div></Link>}

function Inventory({products,setProducts,receipts,setReceipts,batches,setBatches,headers,notify,fail}:{products:Product[];setProducts:React.Dispatch<React.SetStateAction<Product[]>>;receipts:Receipt[];setReceipts:React.Dispatch<React.SetStateAction<Receipt[]>>;batches:InventoryBatch[];setBatches:React.Dispatch<React.SetStateAction<InventoryBatch[]>>;headers:Record<string,string>;notify:(s:string)=>void;fail:(e:unknown,s:string)=>void}){
 const { user } = useAuth();
 const emptyProduct=(batchId=batches[0]?.id||'')=>({id:'',name:'',sku:'',category:'',image_url:'',selling_price:'',unit_cost:'',stock_quantity:'0',track_stock:true,batch_id:batchId,notes:''});
 const [mode,setMode]=useState<'list'|'product'|'stock'|'batches'>('list'),[saving,setSaving]=useState(false),[search,setSearch]=useState('');
 const [p,setP]=useState(emptyProduct()),[deleteTarget,setDeleteTarget]=useState<Product|null>(null),[deleteReceipt,setDeleteReceipt]=useState<Receipt|null>(null),[deleteBatch,setDeleteBatch]=useState<InventoryBatch|null>(null);
 const [backupOpen,setBackupOpen]=useState(false),[backups,setBackups]=useState<BusinessBackup[]>([]),[backupBusy,setBackupBusy]=useState(false),[resetModalOpen,setResetModalOpen]=useState(false);
 const [stock,setStock]=useState({batch_id:'',supplier_name:'',extra_cost:'',note:'',received_at:nowDate()}),[lines,setLines]=useState([{product_id:'',quantity:1,unit_cost:''}]);
 const [batchName,setBatchName]=useState(''),[editingBatch,setEditingBatch]=useState<InventoryBatch|null>(null);
 const latestBatch=batches[0];
 const refreshBatches=async()=>{const r=await axios.get<InventoryBatch[]>(`${API}/api/business/inventory-batches`,{headers});setBatches(r.data);return r.data};
 const refreshInventory=async()=>{const [productResponse,receiptResponse]=await Promise.all([axios.get<Product[]>(`${API}/api/business/products`,{headers}),axios.get<Receipt[]>(`${API}/api/business/stock-receipts`,{headers})]);setProducts(productResponse.data);setReceipts(receiptResponse.data);await refreshBatches()};
 const loadBackups=async()=>{const response=await axios.get<BusinessBackup[]>(`${API}/api/business/backups`,{headers});setBackups(response.data)};
 const openBackups=()=>{setBackupOpen(true);loadBackups().catch(error=>fail(error,'Không tải được lịch sử sao lưu.'))};
 const downloadBackup=async()=>{setBackupBusy(true);try{const response=await axios.post<BusinessBackup>(`${API}/api/business/backups`,{},{headers});const blob=new Blob([JSON.stringify(response.data.payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`billy-toan-bo-du-lieu-${nowDate()}.json`;link.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);notify('Đã sao lưu toàn bộ dữ liệu và tải file về máy.');loadBackups().catch(()=>notify('File đã tải về máy, nhưng chưa cập nhật được lịch sử sao lưu.'))}catch(error){fail(error,'Không tạo được bản sao lưu.')}finally{setBackupBusy(false)}};
 const restorePayload=async(payload:unknown)=>{if(!confirm('Phục hồi sẽ thay toàn bộ dữ liệu kinh doanh hiện tại bằng bản sao này. Tiếp tục?'))return;setBackupBusy(true);try{await axios.post(`${API}/api/business/backups/restore`,{payload},{headers});notify('Đã phục hồi dữ liệu nguyên trạng.');setBackupOpen(false);await refreshInventory();window.setTimeout(()=>window.location.reload(),500)}catch(error){fail(error,'Không phục hồi được dữ liệu.')}finally{setBackupBusy(false)}};
 const restoreFile=async(file?:File)=>{if(!file)return;try{await restorePayload(JSON.parse(await file.text()))}catch{notify('File sao lưu không phải JSON hợp lệ.')}};
 const restoreSaved=async(backup:BusinessBackup)=>{if(!confirm(`Phục hồi bản "${backup.label}" lúc ${new Intl.DateTimeFormat('vi-VN',{dateStyle:'short',timeStyle:'short'}).format(new Date(backup.created_at))}?`))return;setBackupBusy(true);try{await axios.post(`${API}/api/business/backups/${backup.id}/restore`,{},{headers});notify('Đã phục hồi dữ liệu nguyên trạng.');setBackupOpen(false);await refreshInventory();window.setTimeout(()=>window.location.reload(),500)}catch(error){fail(error,'Không phục hồi được bản sao lưu.')}finally{setBackupBusy(false)}};
 const openNewProduct=()=>{setP(emptyProduct(latestBatch?.id));setMode('product')};
 const editProduct=(product:Product)=>{setP({id:product.id,name:product.name,sku:product.sku||'',category:product.category||'',image_url:product.image_url||'',selling_price:String(product.selling_price),unit_cost:String(product.unit_cost),stock_quantity:String(product.stock_quantity??0),track_stock:tracksStock(product),batch_id:product.batch_id||latestBatch?.id||'',notes:product.notes||''});setMode('product')};
 const image=(file?:File)=>{if(!file)return;const r=new FileReader();r.onload=()=>{const img=new Image();img.onload=()=>{const scale=Math.min(1,1200/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));c.getContext('2d')?.drawImage(img,0,0,c.width,c.height);setP(x=>({...x,image_url:c.toDataURL('image/jpeg',.82)}))};img.src=String(r.result)};r.readAsDataURL(file)};
 const saveProduct=async()=>{if(!p.name.trim())return notify('Nhập tên sản phẩm.');setSaving(true);try{const payload={...p,track_stock:p.track_stock,batch_id:p.track_stock?p.batch_id||latestBatch?.id:null,selling_price:num(p.selling_price),unit_cost:num(p.unit_cost),stock_quantity:p.track_stock?Math.max(0,num(p.stock_quantity)):0};const r=p.id?await axios.put<Product>(`${API}/api/business/products/${p.id}`,payload,{headers}):await axios.post<Product>(`${API}/api/business/products`,{...payload,is_active:true},{headers});setProducts(old=>p.id?old.map(item=>item.id===p.id?r.data:item):[r.data,...old]);await refreshBatches();setMode('list');setP(emptyProduct());notify(p.id?'Đã sửa sản phẩm.':'Đã thêm sản phẩm.')}catch(e){fail(e,p.id?'Không sửa được sản phẩm.':'Không thêm được sản phẩm.')}finally{setSaving(false)}};
 const line=(i:number,v:object)=>setLines(old=>old.map((item,j)=>j===i?{...item,...v}:item));
 const addSelectedProducts=(ids:string[])=>setLines(current=>{
  const existing=new Map(current.filter(item=>item.product_id).map(item=>[item.product_id,item]));
  const merged=ids.map(id=>existing.get(id)||{product_id:id,quantity:1,unit_cost:String(products.find(product=>product.id===id)?.unit_cost||'')});
  return merged.length?merged:[{product_id:'',quantity:1,unit_cost:''}];
 });
 const openStock=()=>{setStock({batch_id:latestBatch?.id||'',supplier_name:'',extra_cost:'',note:'',received_at:nowDate()});setLines([{product_id:'',quantity:1,unit_cost:''}]);setMode('stock')};
 const saveStock=async()=>{const valid=lines.filter(item=>item.product_id&&item.quantity>0);if(!valid.length)return notify('Chọn sản phẩm cần nhập.');setSaving(true);try{const r=await axios.post<Receipt>(`${API}/api/business/stock-receipts`,{...stock,batch_id:stock.batch_id||latestBatch?.id,extra_cost:num(stock.extra_cost),received_at:new Date(stock.received_at+'T12:00:00').toISOString(),items:valid.map(item=>({...item,unit_cost:num(item.unit_cost)}))},{headers});setReceipts(old=>[r.data,...old]);setProducts(old=>old.map(item=>{const found=valid.find(value=>value.product_id===item.id);return found?{...item,batch_id:r.data.batch_id,batch_name:r.data.batch_name,stock_quantity:item.stock_quantity+found.quantity,unit_cost:num(found.unit_cost)}:item}));await refreshBatches();setMode('list');notify('Đã nhập hàng vào kho.')}catch(e){fail(e,'Không lưu được phiếu nhập.')}finally{setSaving(false)}};
 const saveBatch=async()=>{const name=batchName.trim();if(!name)return notify('Nhập tên lô hàng.');setSaving(true);try{if(editingBatch){const r=await axios.put<InventoryBatch>(`${API}/api/business/inventory-batches/${editingBatch.id}`,{name},{headers});setBatches(old=>old.map(item=>item.id===r.data.id?r.data:item));setProducts(old=>old.map(item=>item.batch_id===r.data.id?{...item,batch_name:r.data.name}:item));setReceipts(old=>old.map(item=>item.batch_id===r.data.id?{...item,batch_name:r.data.name}:item));notify('Đã đổi tên lô hàng.')}else{const r=await axios.post<InventoryBatch>(`${API}/api/business/inventory-batches`,{name},{headers});setBatches(old=>[r.data,...old]);notify('Đã thêm lô hàng.')}setBatchName('');setEditingBatch(null)}catch(e){fail(e,'Không lưu được lô hàng.')}finally{setSaving(false)}};
 const list=products.filter(item=>`${item.name} ${item.sku||''} ${item.category||''} ${item.batch_name||''}`.toLowerCase().includes(search.toLowerCase()));
 const stockProducts=products.filter(tracksStock);
 const productOptions=stockProducts.map(item=>({value:item.id,label:item.name,description:`Còn ${item.stock_quantity} · Giá ${cash(item.selling_price)}`,imageUrl:item.image_url}));
 return <>
  <Title small="Kho hàng" title="Sản phẩm & tồn kho" text="Quản lý sản phẩm theo từng lô hàng và theo dõi mọi lần nhập kho."/>
  {mode==='list'&&<><div className="mb-4 grid grid-cols-2 gap-2.5 md:flex"><Button onClick={openNewProduct}><Plus/> Sản phẩm / món mới</Button><Button light onClick={openStock} disabled={!stockProducts.length}><Boxes/> Nhập hàng</Button><Button light onClick={()=>setMode('batches')}><PackageOpen/> Quản lý lô</Button><Button light onClick={openBackups}><ShieldCheck/> Sao lưu</Button>{user?.role==='admin'&&<button type="button" onClick={()=>setResetModalOpen(true)} className="btn-push-danger col-span-2 flex h-12 items-center justify-center gap-2 rounded-full px-4 text-sm font-black md:col-auto" title="Xóa toàn bộ dữ liệu tài khoản này để đổi sang mô hình kinh doanh mới"><RotateCcw size={17}/><span>Đổi mô hình kinh doanh</span></button>}</div><div className="grid gap-4 lg:grid-cols-[1.25fr_.75fr]"><Panel><div className="relative mb-3"><Search className="absolute left-3 top-3.5 h-5 text-[#585556]/60"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm tên, SKU, nhóm hoặc lô hàng" className={`${input} pl-10`}/></div>{list.length?<div className="space-y-2">{list.map(item=>{const stocked=tracksStock(item);return <SwipeableItem key={item.id} onEdit={()=>editProduct(item)} onDelete={()=>setDeleteTarget(item)}><div className="flex cursor-pointer items-center gap-3 p-3 md:cursor-default" onClick={()=>{if(typeof window!=="undefined"&&window.innerWidth<768)editProduct(item)}}><div className="flex aspect-[4/3] h-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white text-[#585556]/60">{item.image_url?<img src={item.image_url} alt={item.name} className="h-full w-full object-contain"/>:<PackageOpen/>}</div><div className="min-w-0 flex-1"><b className="block truncate text-sm">{item.name}</b><p className="truncate text-xs font-semibold text-[#585556]/60">{item.sku||item.category||'Chưa phân loại'} · {stocked?(item.batch_name||'Lô hàng 1'):'Món bán / POS'}</p><p className="mt-1 text-xs font-bold text-[#585556]">Bán {cash(item.selling_price)} · Vốn {cash(item.unit_cost)}</p></div><div className="flex shrink-0 items-center gap-3"><div className={`min-w-[50px] rounded-xl px-2.5 py-1.5 text-center ${!stocked?'bg-[#fef9f4] text-[#585556]':item.stock_quantity<=5?'bg-[#b9cddf] text-[#585556]':'bg-[#b9cddf] text-[#cecece]'}`}><b className="block text-sm leading-tight">{stocked?item.stock_quantity:'POS'}</b><p className="text-[9px] font-black tracking-wider">{stocked?'TỒN':'MÓN'}</p></div><div className="hidden items-center gap-1.5 md:flex"><button type="button" onClick={event=>{event.stopPropagation();editProduct(item)}} className="btn-push flex h-9 w-9 items-center justify-center rounded-xl" title="Sửa sản phẩm"><MinimalEdit size={16}/></button><button type="button" onClick={event=>{event.stopPropagation();setDeleteTarget(item)}} className="btn-push-danger flex h-9 w-9 items-center justify-center rounded-xl text-[#585556]" title="Xóa sản phẩm"><MinimalTrash size={16}/></button></div></div></div></SwipeableItem>})}</div>:<Empty icon={<Boxes/>} title="Chưa có sản phẩm" text="Thêm sản phẩm đầu tiên; có thể là hàng tồn kho hoặc món bán không trừ tồn."/>}</Panel><Panel><h2 className="mb-3 font-black">Phiếu nhập gần đây</h2>{receipts.length?receipts.map(receipt=><div key={receipt.id} className="mb-2 rounded-xl bg-white p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><b className="text-sm">{receipt.code}</b><p className="truncate text-xs text-[#585556]/60">{dateText(receipt.received_at)} · {receipt.supplier_name||'Không ghi nguồn'}</p><p className="mt-1 text-[11px] font-bold text-[#585556]">{receipt.batch_name||'Lô hàng 1'}</p></div><div className="flex shrink-0 items-center gap-2"><b className="text-sm text-[#585556]">{cash(receipt.total_cost)}</b><button type="button" onClick={()=>setDeleteReceipt(receipt)} className="btn-push-danger flex h-9 w-9 items-center justify-center rounded-xl text-[#585556]" title="Xóa phiếu nhập"><MinimalTrash size={15}/></button></div></div><p className="mt-2 text-xs font-bold text-[#585556]/60">{receipt.total_quantity} món · {receipt.items.length} loại</p></div>):<p className="text-sm text-[#585556]/60">Chưa có phiếu nhập.</p>}</Panel></div></>}
   {mode==='product'&&<Panel><Back title={p.id?'Sửa sản phẩm':'Thêm sản phẩm'} go={()=>setMode('list')}/><div className="grid gap-4 md:grid-cols-2"><div className="md:row-span-3"><span className="mb-2 block text-xs font-extrabold">Ảnh sản phẩm (4:3)</span><input id="product-photo" type="file" accept="image/*" onChange={event=>image(event.target.files?.[0])} className="hidden"/><label htmlFor="product-photo" className="flex aspect-[4/3] w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed bg-white p-2">{p.image_url?<img src={p.image_url} alt="Xem trước sản phẩm" className="h-full w-full object-contain"/>:<span className="flex flex-col items-center gap-2 text-sm font-bold text-[#585556]/60"><Camera/> Chọn ảnh từ album hoặc chụp mới</span>}</label>{p.image_url&&<button type="button" onClick={()=>setP({...p,image_url:''})} className="mt-2 text-xs font-bold text-red-600">Xóa ảnh đã chọn</button>}</div><Field label="Tên sản phẩm / món"><input value={p.name} onChange={event=>setP({...p,name:event.target.value})} className={input}/></Field><Field label="Kiểu bán hàng"><div className="grid grid-cols-2 rounded-full border-2 border-[#585556] bg-[#fef9f4] p-1 shadow-[0_3px_0_0_#585556]"><button type="button" onClick={()=>setP({...p,track_stock:true})} className={`h-10 rounded-full text-xs font-black transition ${p.track_stock?'bg-[#585556] text-white':'text-[#585556]'}`}>Theo dõi tồn</button><button type="button" onClick={()=>setP({...p,track_stock:false,stock_quantity:'0',batch_id:''})} className={`h-10 rounded-full text-xs font-black transition ${!p.track_stock?'bg-[#fef9f4] text-[#585556] shadow-[0_2px_0_0_#cecece]':'text-[#585556]'}`}>Món bán / POS</button></div></Field><div className="grid grid-cols-2 gap-3"><Field label="Mã / SKU"><input value={p.sku} onChange={event=>setP({...p,sku:event.target.value})} className={input}/></Field><Field label="Nhóm"><input value={p.category} onChange={event=>setP({...p,category:event.target.value})} className={input}/></Field></div>{p.track_stock&&<Field label="Lô hàng"><CustomSelect value={p.batch_id} onChange={value=>setP({...p,batch_id:value})} placeholder="Chọn lô hàng" options={batches.map(batch=>({value:batch.id,label:batch.name,description:`${batch.product_count} sản phẩm · tồn ${batch.stock_quantity}`}))}/></Field>}<div className="grid grid-cols-2 gap-3"><Money label="Giá bán" value={p.selling_price} set={value=>setP({...p,selling_price:value})}/><Money label={p.track_stock?'Giá vốn':'Cost ước tính'} value={p.unit_cost} set={value=>setP({...p,unit_cost:value})}/></div>{p.track_stock&&<Field label="Số lượng tồn kho"><div className="space-y-2"><input type="number" min="0" value={p.stock_quantity} onChange={event=>setP({...p,stock_quantity:event.target.value})} placeholder="0" className={input}/><div className="flex flex-wrap items-center gap-1.5"><span className="text-xs font-bold text-[#585556]/60">Chọn nhanh:</span>{[0,1,2,3,5,10].map(quantity=><button key={quantity} type="button" onClick={()=>setP({...p,stock_quantity:String(quantity)})} className={`h-7 rounded-lg px-3 text-xs font-black ${String(p.stock_quantity)===String(quantity)?'bg-[#585556] text-white':'bg-[#fef9f4] text-[#585556]/75'}`}>{quantity}</button>)}</div></div></Field>}</div><div className="mt-4"><Field label="Ghi chú"><textarea value={p.notes} onChange={event=>setP({...p,notes:event.target.value})} className={area}/></Field></div><StickyActionBar detail={<><p className="text-[10px] font-black uppercase tracking-wider text-[#585556]/60">{p.track_stock?'Hàng tồn kho':'Món bán / POS'}</p><p className="truncate text-sm font-bold text-[#585556]">{p.name||'Chưa nhập tên'}</p></>}><Button onClick={saveProduct} disabled={saving}>{saving?<Loader2 className="animate-spin"/>:<Check/>} Lưu sản phẩm</Button></StickyActionBar></Panel>}
   {mode==='stock'&&<Panel><Back title="Nhập hàng vào lô" go={()=>setMode('list')}/><div className="grid min-w-0 gap-4 md:grid-cols-3"><Field label="Lô hàng"><CustomSelect value={stock.batch_id} onChange={value=>setStock({...stock,batch_id:value})} placeholder="Chọn lô hàng" options={batches.map(batch=>({value:batch.id,label:batch.name,description:`${batch.product_count} sản phẩm · tồn ${batch.stock_quantity}`}))}/></Field><DateField label="Ngày nhập" value={stock.received_at} set={value=>setStock({...stock,received_at:value})}/><Field label="Nguồn hàng"><input value={stock.supplier_name} onChange={event=>setStock({...stock,supplier_name:event.target.value})} className={input}/></Field></div><div className="mb-3 mt-5 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-black">Sản phẩm trong phiếu</h3><MultiProductPicker products={stockProducts} selected={lines.map(item=>item.product_id).filter(Boolean)} onConfirm={addSelectedProducts}/></div><AnimatePresence initial={false}><div className="min-w-0 space-y-3">{lines.map((item,index)=><motion.div layout initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,height:0}} key={item.product_id||`empty-${index}`} className="min-w-0 rounded-xl border bg-white p-3"><div className="flex min-w-0 gap-2"><div className="min-w-0 flex-1"><CustomSelect value={item.product_id} onChange={value=>{const product=products.find(candidate=>candidate.id===value);line(index,{product_id:value,unit_cost:String(product?.unit_cost||'')})}} placeholder="Chọn sản phẩm" options={productOptions.filter(option=>!lines.some((other,otherIndex)=>otherIndex!==index&&other.product_id===option.value))}/></div>{lines.length>1&&<button type="button" onClick={()=>setLines(old=>old.filter((_,lineIndex)=>lineIndex!==index))} className="btn-push-danger flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#585556]"><Trash2 className="h-5 w-5"/></button>}</div><div className="mt-3 grid min-w-0 grid-cols-2 gap-3"><Field label="Số lượng"><input type="number" min="1" value={item.quantity} onChange={event=>line(index,{quantity:Math.max(1,+event.target.value)})} className={input}/></Field><Money label="Vốn / món" value={item.unit_cost} set={value=>line(index,{unit_cost:value})}/></div></motion.div>)}</div></AnimatePresence><button type="button" onClick={()=>setLines(old=>[...old,{product_id:'',quantity:1,unit_cost:''}])} className="btn-push mt-3 inline-flex h-11 items-center gap-2 rounded-full px-4 text-xs font-black text-[#585556]"><Plus size={16}/> Thêm từng sản phẩm</button><div className="mt-4 grid min-w-0 gap-4 md:grid-cols-2"><Money label="Phí nhập khác" value={stock.extra_cost} set={value=>setStock({...stock,extra_cost:value})}/><Field label="Ghi chú"><textarea value={stock.note} onChange={event=>setStock({...stock,note:event.target.value})} className={area}/></Field></div><div className="mt-4 rounded-xl bg-[#fef9f4] p-3 text-right text-sm font-bold">Tổng vốn: <b className="ml-2 text-[#585556]">{cash(lines.reduce((sum,item)=>sum+item.quantity*num(item.unit_cost),num(stock.extra_cost)))}</b></div><StickyActionBar detail={<><p className="text-[10px] font-black uppercase tracking-wider text-[#585556]/60">{lines.filter(item=>item.product_id).length} sản phẩm</p><p className="truncate text-sm font-black text-[#585556]">{cash(lines.reduce((sum,item)=>sum+item.quantity*num(item.unit_cost),num(stock.extra_cost)))}</p></>}><Button onClick={saveStock} disabled={saving}>{saving?<Loader2 className="animate-spin"/>:<Check/>} Nhập kho</Button></StickyActionBar></Panel>}
   {mode==='batches'&&<Panel><Back title="Quản lý lô hàng" go={()=>setMode('list')}/><div className="mb-5 flex min-w-0 gap-2"><input value={batchName} onChange={event=>setBatchName(event.target.value)} placeholder={editingBatch?'Tên mới của lô hàng':'Tên lô hàng mới'} className={`${input} min-w-0 flex-1`}/><Button onClick={saveBatch} disabled={saving}>{editingBatch?<Check/>:<Plus/>}{editingBatch?'Lưu':'Thêm lô'}</Button>{editingBatch&&<button type="button" onClick={()=>{setEditingBatch(null);setBatchName('')}} className="btn-push h-12 rounded-full px-4 text-sm font-black text-[#585556]">Hủy</button>}</div><div className="space-y-3">{batches.map((batch,index)=><div key={batch.id} className="flex items-center gap-3 rounded-xl border bg-white p-4"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#fef9f4] font-black text-[#585556]">{batches.length-index}</div><div className="min-w-0 flex-1"><b className="block truncate">{batch.name}</b><p className="text-xs font-semibold text-[#585556]/60">{batch.product_count} sản phẩm · tồn {batch.stock_quantity}</p></div><button type="button" onClick={()=>{setEditingBatch(batch);setBatchName(batch.name)}} className="btn-push flex h-10 w-10 items-center justify-center rounded-xl" title="Sửa tên lô"><MinimalEdit size={16}/></button><button type="button" onClick={()=>setDeleteBatch(batch)} disabled={batches.length===1} className="btn-push-danger flex h-10 w-10 items-center justify-center rounded-xl text-[#585556] disabled:opacity-30" title="Xóa lô"><MinimalTrash size={16}/></button></div>)}</div><p className="mt-4 text-xs font-semibold leading-5 text-[#585556]/60">Khi xóa một lô, sản phẩm và phiếu nhập trong lô đó sẽ được chuyển sang lô được tạo gần nhất. Luôn cần giữ lại ít nhất một lô.</p></Panel>}
   {backupOpen&&<Modal close={()=>!backupBusy&&setBackupOpen(false)} title="Sao lưu & phục hồi"><div className="rounded-xl border border-[#585556]/30 bg-[#fef9f4] p-4"><div className="flex gap-3"><ShieldCheck className="shrink-0 text-[#585556]"/><div><b className="text-sm">Toàn bộ dữ liệu được sao lưu tự động</b><p className="mt-1 text-xs font-semibold leading-5 text-[#585556]/75">Bao gồm kho, phiếu nhập, đơn hàng, khách hàng, thanh toán, trạng thái, giao dịch và chi phí. Hệ thống giữ 20 bản gần nhất.</p></div></div></div><div className="mt-4 grid grid-cols-2 gap-2"><Button onClick={downloadBackup} disabled={backupBusy}>{backupBusy?<Loader2 className="animate-spin"/>:<Download/>} Tải bản sao</Button><label className="btn-push flex h-12 cursor-pointer items-center justify-center gap-2 rounded-full px-4 text-sm font-black text-[#585556]"><Upload size={18}/> Chọn file<input type="file" accept="application/json,.json" disabled={backupBusy} onChange={event=>{restoreFile(event.target.files?.[0]);event.currentTarget.value=''}} className="hidden"/></label></div><h3 className="mb-2 mt-5 text-sm font-black">Lịch sử gần đây</h3><div className="max-h-64 space-y-2 overflow-y-auto">{backups.length?backups.map(backup=><div key={backup.id} className="flex items-center gap-3 rounded-xl border bg-white p-3"><div className="min-w-0 flex-1"><b className="block truncate text-sm">{backup.label}</b><p className="text-xs font-semibold text-[#585556]/60">{new Intl.DateTimeFormat('vi-VN',{dateStyle:'short',timeStyle:'short'}).format(new Date(backup.created_at))} · {backup.source==='manual'?'Thủ công':backup.source==='pre_restore'?'Trước phục hồi':'Tự động'}</p></div><button type="button" onClick={()=>restoreSaved(backup)} disabled={backupBusy} className="btn-push flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#585556] disabled:opacity-40" title="Phục hồi bản này"><RotateCcw size={17}/></button></div>):<p className="rounded-xl bg-white p-4 text-center text-sm font-semibold text-[#585556]/60">Chưa có bản sao lưu.</p>}</div>{user?.role==='admin'&&<div className="mt-5 rounded-2xl border border-red-200 bg-red-50/70 p-4"><div className="flex gap-3"><ShieldAlert className="shrink-0 text-red-600 mt-0.5" size={20}/><div><b className="text-sm font-black text-red-950 block">Đổi mô hình kinh doanh (Chỉ Admin)</b><p className="mt-1 text-xs font-semibold leading-relaxed text-red-800">Xóa sạch toàn bộ sản phẩm, đơn hàng, khách hàng, kho và lịch sử của tài khoản này khi muốn đổi sang mô hình kinh doanh mới.<span className="block mt-1 font-bold text-emerald-800">Cam kết an toàn: Các tài khoản khác trên hệ thống không bị ảnh hưởng.</span></p><button type="button" onClick={()=>{setBackupOpen(false);setResetModalOpen(true);}} className="btn-push-danger mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-black text-[#585556]"><RotateCcw size={15}/> Xóa sạch & Bắt đầu mô hình mới</button></div></div></div>}</Modal>}
  {deleteTarget&&<ConfirmModal title="Xóa sản phẩm này?" message={`Sản phẩm "${deleteTarget.name}" sẽ bị xóa khỏi danh sách.`} confirmText="Xóa sản phẩm" cancelText="Hủy" isDanger onConfirm={async()=>{const id=deleteTarget.id;setDeleteTarget(null);try{await axios.delete(`${API}/api/business/products/${id}`,{headers});setProducts(old=>old.filter(item=>item.id!==id));await refreshBatches();notify('Đã xóa sản phẩm.')}catch(e){fail(e,'Không xóa được sản phẩm.')}}} onClose={()=>setDeleteTarget(null)}/>}
  {deleteReceipt&&<ConfirmModal title="Xóa phiếu nhập?" message={`Xóa ${deleteReceipt.code} sẽ trừ lại ${deleteReceipt.total_quantity} sản phẩm khỏi tồn kho. Phiếu đã có hàng bán ra sẽ không thể xóa.`} confirmText="Xóa phiếu nhập" cancelText="Hủy" isDanger onConfirm={async()=>{const receipt=deleteReceipt;setDeleteReceipt(null);try{await axios.delete(`${API}/api/business/stock-receipts/${receipt.id}`,{headers});await refreshInventory();notify('Đã xóa phiếu nhập và hoàn tác tồn kho.')}catch(e){fail(e,'Không xóa được phiếu nhập.')}}} onClose={()=>setDeleteReceipt(null)}/>}
  {deleteBatch&&<ConfirmModal title="Xóa lô hàng?" message={`Sản phẩm trong "${deleteBatch.name}" sẽ được chuyển sang lô gần nhất.`} confirmText="Xóa lô hàng" cancelText="Hủy" isDanger onConfirm={async()=>{const batch=deleteBatch;setDeleteBatch(null);try{await axios.delete(`${API}/api/business/inventory-batches/${batch.id}`,{headers});await refreshInventory();notify('Đã xóa lô hàng.')}catch(e){fail(e,'Không xóa được lô hàng.')}}} onClose={()=>setDeleteBatch(null)}/>}
  {resetModalOpen&&<ResetAccountModal isOpen={resetModalOpen} onClose={()=>setResetModalOpen(false)} targetUsername={user?.username||'admin'} targetUserId={user?.id} onSuccess={async(msg)=>{notify(msg);businessMemoryCache.clear();setProducts([]);setReceipts([]);await refreshInventory();window.setTimeout(()=>window.location.reload(),600);}}/>}
 </>;
}
function Back({title,go}:{title:string;go:()=>void}){const display=title==='Tạo đơn mới'&&typeof window!=='undefined'&&location.hash.startsWith('#edit-')?'Sửa đơn hàng':title;return <div className="mb-5 flex items-center gap-3"><button onClick={go} className="btn-push flex h-11 w-11 items-center justify-center rounded-full"><ArrowLeft/></button><h2 className="text-lg font-black">{display}</h2></div>}

function OrdersV3({ledgers,ledger,choose,addBook,headers,notify,fail,products,setProducts,orders,setOrders,loading}:Shared&{products:Product[];setProducts:React.Dispatch<React.SetStateAction<Product[]>>;orders:Order[];setOrders:React.Dispatch<React.SetStateAction<Order[]>>;loading:boolean}){
 const freshDraft=()=>({customer_id:'',customer_name:'',customer_contact:'',social_link:'',shipping_fee:'',shipping_cost:'',discount:'',other_fee:'',payment_status:'paid',note:'',ordered_at:nowDate()});
 const [creating,setCreating]=useState(false),[saving,setSaving]=useState(false),[search,setSearch]=useState(''),[editing,setEditing]=useState<Order|null>(null),[draft,setDraft]=useState(freshDraft),[lines,setLines]=useState([{product_id:'',quantity:1,unit_price:''}]);
 const [deleteOrderTarget,setDeleteOrderTarget]=useState<Order|null>(null),[customers,setCustomers]=useState<Customer[]>([]);
 const [paymentOpen,setPaymentOpen]=useState(false),[paymentSettings,setPaymentSettings]=useState<PaymentSettings>(()=>loadPaymentSettings()),[shareOrder,setShareOrder]=useState<Order|null>(null),[shareUrl,setShareUrl]=useState(''),[shareBusy,setShareBusy]=useState(false);
 const handledRoute=useRef('');
 const update=(index:number,value:object)=>setLines(old=>old.map((line,lineIndex)=>lineIndex===index?{...line,...value}:line));
 const selectOrderProducts=(ids:string[])=>setLines(current=>{const existing=new Map(current.filter(line=>line.product_id).map(line=>[line.product_id,line]));const selected=ids.map(id=>existing.get(id)||{product_id:id,quantity:1,unit_price:String(products.find(product=>product.id===id)?.selling_price||'')});return selected.length?selected:[{product_id:'',quantity:1,unit_price:''}]});
 const chosen=lines.filter(line=>line.product_id&&line.quantity>0),subtotal=lines.reduce((sum,line)=>sum+line.quantity*num(line.unit_price),0),total=subtotal+num(draft.shipping_fee)-num(draft.discount),cost=lines.reduce((sum,line)=>sum+line.quantity*(products.find(product=>product.id===line.product_id)?.unit_cost||0),0)+num(draft.shipping_cost)+num(draft.other_fee),expectedProfit=total-cost;
 const loadCustomers=()=>axios.get<Customer[]>('/api/sales/customers',{headers}).then(response=>setCustomers(response.data)).catch(()=>undefined);
 useEffect(()=>{loadCustomers()},[headers]);
 const ledgerName=ledgers.find(item=>item.id===ledger)?.name||nowMonth();
 const [previewQr,setPreviewQr]=useState('');
 useEffect(()=>{
  let active=true;
  generateBankQrDataUrl({
   bankCodeOrName:paymentSettings.bankCode||paymentSettings.bankName,
   accountNumber:paymentSettings.accountNumber,
   accountName:paymentSettings.accountName,
   amount:150000,
   memo:'BILLY',
   color:'#585556'
  }).then(url=>{if(active)setPreviewQr(url)}).catch(()=>undefined);
  return()=>{active=false};
 },[paymentSettings.bankCode,paymentSettings.bankName,paymentSettings.accountNumber,paymentSettings.accountName]);
 const savePaymentSettings=()=>{localStorage.setItem(paymentSettingsKey,JSON.stringify(paymentSettings));setPaymentOpen(false);notify('Đã lưu thông tin nhận chuyển khoản.')};
 useEffect(()=>{let active=true;if(!shareOrder){setShareUrl('');return}setShareBusy(true);createOrderCloseImage(shareOrder,paymentSettings,ledgerName).then(url=>{if(active)setShareUrl(url)}).catch(()=>notify('Không tạo được ảnh chốt đơn.')).finally(()=>{if(active)setShareBusy(false)});return()=>{active=false}},[shareOrder,paymentSettings,ledgerName]);
 const downloadCloseImage=()=>{if(!shareOrder||!shareUrl)return;const link=document.createElement('a');link.href=shareUrl;link.download=`hoa-don-${shareOrder.code}.png`;link.click();notify('Đã tải ảnh hoá đơn về máy.')};
 const shareCloseImage=async()=>{if(!shareOrder||!shareUrl)return;try{const blob=await (await fetch(shareUrl)).blob(),file=new File([blob],`hoa-don-${shareOrder.code}.png`,{type:'image/png'});if(navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:`Hoá đơn ${shareOrder.code}`});notify('Đã mở bảng chia sẻ ảnh.')}else downloadCloseImage()}catch{downloadCloseImage()}};
 const reset=()=>{handledRoute.current='';setDraft(freshDraft());setLines([{product_id:'',quantity:1,unit_price:''}]);setEditing(null);setCreating(false);if(typeof window!=='undefined')history.replaceState(null,'',location.pathname)};
 const selectCustomer=(customerId:string)=>{const customer=customers.find(item=>item.id===customerId);if(!customer){setDraft({...draft,customer_id:''});return}setDraft({...draft,customer_id:customer.id,customer_name:customer.name,customer_contact:customer.phone||'',social_link:customer.social_link||''})};
 const save=async()=>{
  if(!ledger)return notify('Chọn sổ bán hàng.');
  if(!draft.customer_name.trim()||!chosen.length)return notify('Nhập tên khách và chọn sản phẩm.');
  setSaving(true);
  try{
   const payload={...draft,ledger_id:ledger,shipping_fee:num(draft.shipping_fee),shipping_cost:num(draft.shipping_cost),discount:num(draft.discount),other_fee:num(draft.other_fee),ordered_at:new Date(draft.ordered_at+'T12:00:00').toISOString(),items:chosen.map(line=>({...line,unit_price:num(line.unit_price)}))};
   const response=editing?await axios.put<Order>(`${API}/api/business/orders/${editing.id}`,payload,{headers}):await axios.post<Order>(`${API}/api/business/orders`,payload,{headers});
   setOrders(old=>editing?old.map(order=>order.id===editing.id?response.data:order):[response.data,...old]);
   setProducts(old=>old.map(product=>{const before=editing?.items.find(item=>item.product_id===product.id)?.quantity||0,after=chosen.find(line=>line.product_id===product.id)?.quantity||0;return {...product,stock_quantity:product.stock_quantity+before-after}}));
   await loadCustomers();
   const message=editing?`Đã cập nhật đơn ${response.data.code}.`:`Đã tạo đơn ${response.data.code} và liên kết khách hàng.`;
   reset();setShareOrder(response.data);notify(message);
  }catch(error){fail(error,editing?'Không sửa được đơn.':'Không tạo được đơn.')}finally{setSaving(false)}
 };
 const shown=orders.filter(order=>`${order.code} ${order.customer_name} ${order.customer_contact||''}`.toLowerCase().includes(search.toLowerCase()));
 const editOrder=(order:Order)=>{setEditing(order);setDraft({customer_id:order.customer_id||'',customer_name:order.customer_name||'',customer_contact:order.customer_contact||'',social_link:order.social_link||'',shipping_fee:String(order.shipping_fee||''),shipping_cost:String(order.shipping_cost||''),discount:String(order.discount||''),other_fee:String(order.other_fee||''),payment_status:order.payment_status||'paid',note:order.note||'',ordered_at:order.ordered_at.slice(0,10)});setLines(order.items.map(item=>({product_id:item.product_id,quantity:item.quantity,unit_price:String(item.unit_price)})));setCreating(true);window.scrollTo({top:0,behavior:'smooth'})};
 useEffect(()=>{const quick=()=>{handledRoute.current=location.hash||'#new-order';setEditing(null);setDraft(freshDraft());setLines([{product_id:'',quantity:1,unit_price:''}]);setCreating(true)},exportFile=()=>{const name=ledgers.find(item=>item.id===ledger)?.name||nowMonth();if(!orders.length)return notify('Chưa có đơn để xuất.');exportOrdersExcel(orders,name)},route=()=>{const hash=location.hash;if(!hash||handledRoute.current===hash)return;if(hash==='#new-order')quick();else if(hash.startsWith('#edit-')){const order=orders.find(item=>item.id===hash.slice(6));if(order){handledRoute.current=hash;editOrder(order)}}};window.addEventListener('quick-order',quick);window.addEventListener('export-orders',exportFile);window.addEventListener('hashchange',route);route();return()=>{window.removeEventListener('quick-order',quick);window.removeEventListener('export-orders',exportFile);window.removeEventListener('hashchange',route)}},[orders,ledger,ledgers]);
 const paymentModals=<>{paymentOpen&&<Modal close={()=>setPaymentOpen(false)} title="Cài đặt hoá đơn & Nhận tiền"><div className="space-y-4 pb-24">
  <Field label="Tên shop hiển thị trên hoá đơn (thay chữ Mujo)"><input value={paymentSettings.shopName} onChange={event=>setPaymentSettings({...paymentSettings,shopName:event.target.value})} placeholder="VD: Billy Shop" className={input}/></Field>
  <Field label="Dòng phụ dưới tên shop (Tagline / Danh mục)"><input value={paymentSettings.tagline||''} onChange={event=>setPaymentSettings({...paymentSettings,tagline:event.target.value})} placeholder="VD: Coffeeshop and bakery" className={input}/></Field>
  <div className="grid gap-4 md:grid-cols-2">
   <Field label="Ngân hàng thụ hưởng">
    <CustomSelect value={paymentSettings.bankCode||findBank(paymentSettings.bankName)?.code||'MB'} onChange={val=>{const b=VIETNAM_BANKS.find(x=>x.code===val);setPaymentSettings({...paymentSettings,bankCode:val,bankName:b?.shortName||val})}} placeholder="Chọn ngân hàng" options={VIETNAM_BANKS.map(b=>({value:b.code,label:`${b.shortName} (${b.code})`,description:b.name}))}/>
   </Field>
   <Field label="Số tài khoản ngân hàng (STK)"><input value={paymentSettings.accountNumber} onChange={event=>setPaymentSettings({...paymentSettings,accountNumber:event.target.value.replace(/\D/g,'')})} placeholder="VD: 0123456789" className={input}/></Field>
  </div>
  <Field label="Tên chủ tài khoản"><input value={paymentSettings.accountName} onChange={event=>setPaymentSettings({...paymentSettings,accountName:event.target.value.toUpperCase()})} placeholder="VD: NGUYEN VAN A" className={input}/></Field>
  <Field label="Lời nhắn trích dẫn (bên cạnh mã QR)"><textarea value={paymentSettings.note} onChange={event=>setPaymentSettings({...paymentSettings,note:event.target.value})} placeholder={`Mặc định: Every visit to ${paymentSettings.shopName||'Shop'} is a chance to slow down, savor quality, and enjoy life's fleeting moments.`} className={area}/></Field>
  <div>
   <span className="mb-2 block text-xs font-extrabold text-[#cecece]">Ảnh mã QR thanh toán (Khuyên dùng)</span>
   <div className="rounded-2xl border border-[#585556]/20 bg-[#fef9f4] p-4 text-center shadow-xs">
    {paymentSettings.qrImage ? (
     <div className="flex flex-col items-center">
      <div className="relative flex aspect-square w-48 max-w-full items-center justify-center overflow-hidden rounded-xl border border-[#585556]/20 bg-white p-2">
       <img src={paymentSettings.qrImage} alt="QR thanh toán" className="h-full w-full object-contain" />
      </div>
      <div className="mt-3 flex items-center justify-center gap-2">
       <label className="btn-push flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-black text-[#585556]">
        <Upload size={14}/> Đổi ảnh QR khác
        <input type="file" accept="image/*" className="hidden" onChange={e=>{
         const file=e.target.files?.[0];
         if(!file)return;
         const reader=new FileReader();
         reader.onload=ev=>setPaymentSettings(prev=>({...prev,qrImage:ev.target?.result as string}));
         reader.readAsDataURL(file);
         e.target.value='';
        }}/>
       </label>
       <button type="button" onClick={()=>setPaymentSettings(prev=>({...prev,qrImage:''}))} className="btn-push-danger flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-black text-[#585556]">
        <Trash2 size={14}/> Xóa ảnh
       </button>
      </div>
      <p className="mt-2 text-[11px] font-semibold text-[#cecece]">✓ Đang ưu tiên dùng ảnh QR này trên hoá đơn.</p>
     </div>
    ) : (
     <div>
      <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#cecece] bg-white/80 p-5 transition hover:border-[#585556] hover:bg-white">
       <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#fef9f4] text-[#585556]">
        <Upload size={20}/>
       </div>
       <b className="mt-2 text-sm text-[#585556]">Tải ảnh mã QR từ app ngân hàng</b>
       <p className="mt-1 text-xs text-[#585556]/60">Chụp màn hình mã QR tài khoản trong app Techcombank, MB, VCB... rồi bấm vào đây để tải lên</p>
       <input type="file" accept="image/*" className="hidden" onChange={e=>{
        const file=e.target.files?.[0];
        if(!file)return;
        const reader=new FileReader();
        reader.onload=ev=>setPaymentSettings(prev=>({...prev,qrImage:ev.target?.result as string}));
        reader.readAsDataURL(file);
        e.target.value='';
       }}/>
      </label>
     </div>
    )}
   </div>
  </div>
  <div>
   <span className="mb-2 block text-xs font-extrabold text-[#cecece]">{paymentSettings.qrImage ? 'Xem trước VietQR tự động (Dự phòng)' : 'Hoặc mã QR tự động theo STK (VietQR)'}</span>
   <div className="flex flex-col items-center justify-center rounded-2xl border border-[#585556]/20 bg-[#fef9f4] p-5 text-center shadow-xs">
    {previewQr?<div className="relative flex aspect-square w-48 max-w-full items-center justify-center rounded-xl border border-[#585556]/20 bg-white p-2"><img src={previewQr} alt="QR ngân hàng" className="h-full w-full object-contain"/></div>:<div className="flex h-48 w-48 items-center justify-center rounded-xl border border-dashed border-[#585556]/20 text-xs font-bold text-[#585556]/60">Nhập STK để xem trước QR</div>}
    <div className="mt-3">
     <b className="block text-sm text-[#585556]">{paymentSettings.bankName||'Ngân hàng'} · {paymentSettings.accountNumber||'Chưa nhập STK'}</b>
     {paymentSettings.accountName&&<p className="text-xs font-bold text-[#585556]/75">{paymentSettings.accountName.toUpperCase()}</p>}
     <p className="mt-1 text-[11px] font-medium text-[#585556]/60">{paymentSettings.qrImage ? 'Khi có ảnh QR tải lên ở trên, hoá đơn sẽ ưu tiên dùng ảnh bạn tải lên.' : 'QR tự động tạo theo STK. Nếu app quét khó nhận diện, hãy tải ảnh chụp QR từ app ngân hàng ở phía trên.'}</p>
    </div>
   </div>
  </div>
  <div className="sticky bottom-[-1.25rem] -mx-5 border-t border-[#585556]/30 bg-[#fef9f4]/95 px-5 py-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] backdrop-blur">
   <button type="button" onClick={savePaymentSettings} className="btn-push-primary flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-black"><Check size={20} strokeWidth={3}/> Lưu thông tin</button>
  </div>
 </div></Modal>}
 {shareOrder&&<Modal close={()=>setShareOrder(null)} title={`Hoá đơn ${shareOrder.code}`}><div className="space-y-4">
  <div className="rounded-xl border bg-white p-2">
   {shareBusy?<div className="flex h-80 items-center justify-center"><Loader2 className="animate-spin text-[#585556]"/></div>:shareUrl?<img src={shareUrl} alt={`Hoá đơn ${shareOrder.code}`} className="max-h-[58dvh] w-full rounded-lg object-contain md:max-h-[70vh]"/>:<p className="p-8 text-center text-sm font-semibold text-[#585556]/60">Chưa tạo được ảnh hoá đơn.</p>}
  </div>
  <div className="grid grid-cols-2 gap-2">
   <Button light onClick={()=>setPaymentOpen(true)}><ReceiptText/> Sửa QR/STK</Button>
   <Button onClick={shareCloseImage} disabled={!shareUrl||shareBusy}><Download/> Gửi / chia sẻ</Button>
  </div>
  <button type="button" onClick={downloadCloseImage} disabled={!shareUrl||shareBusy} className="btn-push h-11 w-full rounded-full text-sm font-black text-[#585556] disabled:opacity-40">Tải ảnh PNG về máy</button>
 </div></Modal>}</>;
 if(creating)return <><Title small="Đơn hàng" title="Chốt đơn cho khách" text="Chọn khách có sẵn hoặc nhập khách mới; dữ liệu khách hàng sẽ được liên kết tự động."/><Panel><Back title="Tạo đơn mới" go={reset}/>
  <div className="mb-4 rounded-xl border border-[#585556]/30 bg-[#fef9f4] p-3"><Field label="Chọn khách hàng có sẵn (không bắt buộc)"><CustomSelect value={draft.customer_id} onChange={selectCustomer} placeholder="Tìm và chọn khách hàng" options={customers.map(customer=>({value:customer.id,label:customer.name,description:[customer.phone,customer.email,customer.order_count?`${customer.order_count} đơn`:null].filter(Boolean).join(' · ')}))}/></Field></div>
  <div className="grid min-w-0 gap-4 md:grid-cols-2"><DateField label="Ngày chốt" value={draft.ordered_at} set={value=>setDraft({...draft,ordered_at:value})}/><Field label="Tên khách"><input value={draft.customer_name} onChange={event=>setDraft({...draft,customer_name:event.target.value})} placeholder="Tên để tìm lại" className={input}/></Field><Field label="SĐT / tài khoản social"><input value={draft.customer_contact} onChange={event=>setDraft({...draft,customer_contact:event.target.value})} className={input}/></Field><Field label="Link tin nhắn"><input value={draft.social_link} onChange={event=>setDraft({...draft,social_link:event.target.value})} className={input}/></Field></div>
  {/*
  <div className="mb-3 mt-5 flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-black">Sản phẩm khách mu    <div className="mt-3 grid min-w-0 grid-cols-[minmax(0,140px)_minmax(0,1fr)] gap-3"><Field label="Số lượng"><div className="space-y-2"><div className="flex h-12 min-w-0 items-center rounded-xl border bg-white"><button type="button" onClick={()=>update(index,{quantity:Math.max(1,line.quantity-1)})} className="flex w-9 shrink-0 items-center justify-center text-[#585556]/75 hover:text-[#585556]"><Minus className="h-4"/></button><input value={line.quantity} onChange={event=>update(index,{quantity:Math.min(Math.max(1,+event.target.value),available||9999)})} inputMode="numeric" className="min-w-0 flex-1 text-center font-black outline-none"/><button type="button" onClick={()=>update(index,{quantity:Math.min(available||9999,line.quantity+1)})} className="flex w-9 shrink-0 items-center justify-center text-[#585556]/75 hover:text-[#585556]"><Plus className="h-4"/></button></div><div className="flex flex-wrap items-center gap-1.5"><span className="text-[10px] font-bold text-[#585556]/60">Nhanh:</span>{[1,2,3,5,10].map(quantity=><button key={quantity} type="button" onClick={()=>update(index,{quantity:Math.min(quantity,available||quantity)})} className={`h-8 rounded-lg px-2.5 text-xs font-bold transition-all ${line.quantity===quantity?'bg-[#585556] text-white shadow-xs':'bg-[#fef9f4] text-[#585556]/75 hover:bg-[#b9cddf]'}`}>{quantity}</button>)}</div></div></Field><Money label="Giá / món" value={line.unit_price} set={value=>update(index,{unit_price:value})}/></div>{product&&<p className="mt-2 text-xs font-bold text-[#585556]/60">Kho còn {available} · vốn {cash(product.unit_cost)}</p>}</div>})}</div>grid min-w-0 grid-cols-[minmax(0,120px)_minmax(0,1fr)] gap-3"><Field label="Số lượng"><div className="space-y-2"><div className="flex h-12 min-w-0 items-center rounded-xl border bg-white"><button type="button" onClick={()=>update(index,{quantity:Math.max(1,line.quantity-1)})} className="flex w-9 shrink-0 items-center justify-center text-[#585556]/75"><Minus className="h-4"/></button><input value={line.quantity} onChange={event=>update(index,{quantity:Math.min(Math.max(1,+event.target.value),available||9999)})} inputMode="numeric" className="min-w-0 flex-1 text-center font-black outline-none"/><button type="button" onClick={()=>update(index,{quantity:Math.min(available||9999,line.quantity+1)})} className="flex w-9 shrink-0 items-center justify-center text-[#585556]/75"><Plus className="h-4"/></button></div><div className="grid grid-cols-[auto_repeat(5,minmax(14px,1fr))] items-center gap-0.5 whitespace-nowrap"><span className="text-[8px] font-bold text-[#585556]/60">Nhanh:</span>{[1,2,3,5,10].map(quantity=><button key={quantity} type="button" onClick={()=>update(index,{quantity:Math.min(quantity,available||quantity)})} className={`h-7 rounded-md px-0.5 text-[9px] font-bold ${line.quantity===quantity?'bg-[#585556] text-white':'bg-[#fef9f4] text-[#585556]/75'}`}>{quantity}</button>)}</div></div></Field><Money label="Giá / món" value={line.unit_price} set={value=>update(index,{unit_price:value})}/></div>{product&&<p className="mt-2 text-xs font-bold text-[#585556]/60">Kho còn {available} · vốn {cash(product.unit_cost)}</p>}</div>})}</div>
  */}
  <div className="mb-3 mt-5 flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-black">Sản phẩm khách mua</h3><p className="mt-1 text-xs font-semibold text-[#585556]/60">Chọn từng món hoặc chọn nhiều sản phẩm cùng lúc.</p></div><MultiProductPicker products={products} selected={lines.map(line=>line.product_id).filter(Boolean)} onConfirm={selectOrderProducts} purpose="order"/></div>
  <div className="min-w-0 space-y-3">{lines.map((line,index)=>{const product=products.find(candidate=>candidate.id===line.product_id),stocked=tracksStock(product),available=stocked?(product?.stock_quantity||0)+(editing?.items.find(item=>item.product_id===line.product_id)?.quantity||0):9999;return <div key={line.product_id||`order-line-${index}`} className="min-w-0 rounded-xl border bg-white p-3"><div className="flex min-w-0 gap-2"><div className="min-w-0 flex-1"><CustomSelect value={line.product_id} onChange={value=>{const picked=products.find(candidate=>candidate.id===value);update(index,{product_id:value,unit_price:String(picked?.selling_price||'')})}} placeholder="Chọn món / sản phẩm" options={products.filter(candidate=>(!tracksStock(candidate)||candidate.stock_quantity>0)&&!lines.some((other,otherIndex)=>otherIndex!==index&&other.product_id===candidate.id)).map(candidate=>({value:candidate.id,label:candidate.name,description:`${tracksStock(candidate)?`Còn ${candidate.stock_quantity}`:'Không trừ tồn'} · Giá ${cash(candidate.selling_price)}`,imageUrl:candidate.image_url}))}/></div>{lines.length>1&&<button type="button" onClick={()=>setLines(old=>old.filter((_,lineIndex)=>lineIndex!==index))} className="btn-push-danger flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#585556]"><Trash2 className="h-5 w-5"/></button>}</div><div className="mt-3 grid min-w-0 grid-cols-[minmax(0,140px)_minmax(0,1fr)] gap-3"><Field label="Số lượng"><div className="space-y-2"><div className="flex h-12 min-w-0 items-center rounded-xl border bg-white"><button type="button" onClick={()=>update(index,{quantity:Math.max(1,line.quantity-1)})} className="flex w-9 shrink-0 items-center justify-center text-[#585556]/75"><Minus className="h-4"/></button><input value={line.quantity} onChange={event=>update(index,{quantity:Math.min(Math.max(1,+event.target.value),available||9999)})} inputMode="numeric" className="min-w-0 flex-1 text-center font-black outline-none"/><button type="button" onClick={()=>update(index,{quantity:Math.min(available||9999,line.quantity+1)})} className="flex w-9 shrink-0 items-center justify-center text-[#585556]/75"><Plus className="h-4"/></button></div><div className="flex flex-wrap items-center gap-1.5"><span className="text-[10px] font-bold text-[#585556]/60">Nhanh:</span>{[1,2,3,5,10].map(quantity=><button key={quantity} type="button" onClick={()=>update(index,{quantity:Math.min(quantity,available||quantity)})} className={`h-8 rounded-lg px-2.5 text-xs font-bold ${line.quantity===quantity?'bg-[#585556] text-white':'bg-[#fef9f4] text-[#585556]/75'}`}>{quantity}</button>)}</div></div></Field><Money label="Giá / món" value={line.unit_price} set={value=>update(index,{unit_price:value})}/></div>{product&&<p className="mt-2 text-xs font-bold text-[#585556]/60">{stocked?`Kho còn ${available}`:'Món POS không trừ tồn'} · vốn {cash(product.unit_cost)}</p>}</div>})}</div>
  <button type="button" onClick={()=>setLines(old=>[...old,{product_id:'',quantity:1,unit_price:''}])} className="btn-push mt-3 inline-flex h-11 items-center gap-2 rounded-full px-4 text-xs font-black text-[#585556]"><Plus size={16}/> Thêm từng sản phẩm</button>
  <div className="mt-4 grid min-w-0 grid-cols-2 gap-4 lg:grid-cols-4"><Money label="Ship thu khách" value={draft.shipping_fee} set={value=>setDraft({...draft,shipping_fee:value})}/><Money label="Ship thực trả" value={draft.shipping_cost} set={value=>setDraft({...draft,shipping_cost:value})}/><Money label="Giảm giá" value={draft.discount} set={value=>setDraft({...draft,discount:value})}/><Money label="Phí khác" value={draft.other_fee} set={value=>setDraft({...draft,other_fee:value})}/></div>
  <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-2"><Field label="Thanh toán"><CustomSelect value={draft.payment_status} onChange={value=>setDraft({...draft,payment_status:value})} placeholder="Trạng thái thanh toán" options={[{value:'paid',label:'Đã thanh toán'},{value:'pending',label:'Chưa thanh toán'},{value:'partial',label:'Thanh toán một phần'}]}/></Field><Field label="Ghi chú"><textarea value={draft.note} onChange={event=>setDraft({...draft,note:event.target.value})} className={area}/></Field></div>
  <div className="mt-4 grid grid-cols-2 rounded-xl bg-[#fef9f4] p-4"><div><p className="text-xs font-bold">Khách trả</p><b className="break-words text-lg text-[#585556]">{cash(total)}</b></div><div><p className="text-xs font-bold">Lãi dự kiến</p><b className={`break-words text-lg ${expectedProfit<0?'text-red-600':'text-[#cecece]'}`}>{cash(expectedProfit)}</b></div></div><div className="mt-4"><Button light onClick={()=>setPaymentOpen(true)}><ReceiptText/> QR / STK nhận tiền</Button></div><StickyActionBar detail={<><p className="text-[10px] font-black uppercase tracking-wider text-[#585556]/60">Khách trả</p><p className="truncate text-sm font-black text-[#585556]">{cash(total)}</p></>}><Button onClick={save} disabled={saving}>{saving?<Loader2 className="animate-spin"/>:<Check/>} {editing?'Lưu thay đổi':'Tạo đơn'}</Button></StickyActionBar>
 </Panel>{paymentModals}</>;
 return <><Title small="Đơn hàng" title="Chốt đơn cho khách" text="Mỗi đơn tự trừ tồn kho với hàng tồn; món POS sẽ không ảnh hưởng số lượng kho."/><div className="mb-4 flex min-w-0 flex-col gap-3 md:flex-row md:justify-between"><Picker ledgers={ledgers} id={ledger} set={choose} add={addBook}/><div className="grid grid-cols-2 gap-2 md:flex"><Button light onClick={()=>setPaymentOpen(true)}><ReceiptText/> Thanh toán</Button><Button onClick={()=>{setDraft(freshDraft());setCreating(true)}} disabled={!ledger||!products.length}><Plus/> Tạo đơn mới</Button></div></div>{!ledger?<Empty icon={<ClipboardList/>} title="Chưa có sổ bán hàng" text="Tạo sổ tháng trước khi chốt đơn."/>:<Panel><div className="relative mb-3"><Search className="absolute left-3 top-3.5 h-5"/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Tìm mã đơn, tên khách" className={`${input} pl-10`}/></div>{loading?<Loading/>:shown.length?<div className="space-y-2">{shown.map(order=><SwipeableItem key={order.id} onEdit={()=>editOrder(order)} onDelete={()=>setDeleteOrderTarget(order)}><div className="flex min-w-0 cursor-pointer items-center gap-3 p-3 md:cursor-default" onClick={()=>{if(typeof window!=="undefined"&&window.innerWidth<768)editOrder(order)}}><div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${order.payment_status==='paid'?'bg-[#b9cddf] text-[#cecece]':'bg-[#b9cddf] text-[#585556]'}`}><ReceiptText className="h-5"/></div><div className="min-w-0 flex-1"><b className="block truncate text-sm">{order.customer_name} <small className="text-[#585556]/60">{order.code}</small></b><p className="truncate text-xs font-semibold text-[#585556]/60">{dateText(order.ordered_at)} · {order.item_count} món · {order.items.map(item=>item.product_name).join(', ')}</p></div><div className="shrink-0 text-right"><b className="text-sm text-[#585556]">{cash(order.total)}</b><p className={`text-[10px] font-black ${order.profit<0?'text-red-600':'text-[#cecece]'}`}>Lãi {cash(order.profit)}</p></div><div className="ml-2 hidden shrink-0 items-center gap-1.5 md:flex"><button type="button" onClick={event=>{event.stopPropagation();setShareOrder(order)}} className="btn-push flex h-9 w-9 items-center justify-center rounded-xl text-[#585556]" title="Tạo ảnh chốt đơn"><Download size={16}/></button><button type="button" onClick={event=>{event.stopPropagation();editOrder(order)}} className="btn-push flex h-9 w-9 items-center justify-center rounded-xl" title="Sửa đơn"><MinimalEdit size={16}/></button><button type="button" onClick={event=>{event.stopPropagation();setDeleteOrderTarget(order)}} className="btn-push-danger flex h-9 w-9 items-center justify-center rounded-xl text-[#585556]" title="Xóa đơn"><MinimalTrash size={16}/></button></div></div></SwipeableItem>)}</div>:<Empty icon={<ReceiptText/>} title="Chưa có đơn" text="Bấm Tạo đơn mới khi khách chốt mua."/>}</Panel>}{deleteOrderTarget&&<ConfirmModal title="Xóa đơn hàng?" message={`Xóa đơn ${deleteOrderTarget.code}? Chỉ hàng có theo dõi tồn mới được hoàn kho.`} confirmText="Xóa đơn" cancelText="Hủy" isDanger onConfirm={async()=>{const order=deleteOrderTarget;setDeleteOrderTarget(null);try{await axios.delete(`${API}/api/business/orders/${order.id}`,{headers});setOrders(old=>old.filter(item=>item.id!==order.id));setProducts(old=>old.map(product=>{if(!tracksStock(product))return product;const sold=order.items.find(item=>item.product_id===product.id);return sold?{...product,stock_quantity:product.stock_quantity+sold.quantity}:product}));await loadCustomers();notify('Đã xóa đơn và hoàn kho hàng tồn.')}catch(error){fail(error,'Không xóa được đơn.')}}} onClose={()=>setDeleteOrderTarget(null)}/>}{paymentModals}</>;
}

function OrdersV2({ledgers,ledger,choose,addBook,headers,notify,fail,products,setProducts,orders,setOrders,loading}:Shared&{products:Product[];setProducts:React.Dispatch<React.SetStateAction<Product[]>>;orders:Order[];setOrders:React.Dispatch<React.SetStateAction<Order[]>>;loading:boolean}){
 const blank={customer_name:'',customer_contact:'',social_link:'',shipping_fee:'',shipping_cost:'',discount:'',other_fee:'',payment_status:'paid',note:'',ordered_at:nowDate()};
 const [creating,setCreating]=useState(false),[saving,setSaving]=useState(false),[search,setSearch]=useState(''),[editing,setEditing]=useState<Order|null>(null),[draft,setDraft]=useState(blank),[lines,setLines]=useState([{product_id:'',quantity:1,unit_price:''}]);
 const [deleteOrderTarget,setDeleteOrderTarget]=useState<Order|null>(null);
 const update=(i:number,v:object)=>setLines(old=>old.map((line,index)=>index===i?{...line,...v}:line));
 const chosen=lines.filter(line=>line.product_id&&line.quantity>0),subtotal=lines.reduce((sum,line)=>sum+line.quantity*num(line.unit_price),0),total=subtotal+num(draft.shipping_fee)-num(draft.discount),cost=lines.reduce((sum,line)=>sum+line.quantity*(products.find(p=>p.id===line.product_id)?.unit_cost||0),0)+num(draft.shipping_cost)+num(draft.other_fee);
 const reset=()=>{setDraft(blank);setLines([{product_id:'',quantity:1,unit_price:''}]);setEditing(null);setCreating(false);if(typeof window!=='undefined')history.replaceState(null,'',location.pathname)};
 const save=async()=>{if(!ledger)return notify('Chọn sổ bán hàng.');if(!draft.customer_name.trim()||!chosen.length)return notify('Nhập tên khách và chọn sản phẩm.');setSaving(true);try{const payload={...draft,ledger_id:ledger,shipping_fee:num(draft.shipping_fee),shipping_cost:num(draft.shipping_cost),discount:num(draft.discount),other_fee:num(draft.other_fee),ordered_at:new Date(draft.ordered_at+'T12:00:00').toISOString(),items:chosen.map(line=>({...line,unit_price:num(line.unit_price)}))};const response=editing?await axios.put<Order>(`${API}/api/business/orders/${editing.id}`,payload,{headers}):await axios.post<Order>(`${API}/api/business/orders`,payload,{headers});setOrders(old=>editing?old.map(order=>order.id===editing.id?response.data:order):[response.data,...old]);setProducts(old=>old.map(product=>{if(!tracksStock(product))return product;const before=editing?.items.find(item=>item.product_id===product.id)?.quantity||0,after=chosen.find(line=>line.product_id===product.id)?.quantity||0;return {...product,stock_quantity:product.stock_quantity+before-after}}));const message=editing?`Đã cập nhật đơn ${response.data.code}.`:`Đã tạo đơn ${response.data.code}.`;reset();notify(message)}catch(error){fail(error,editing?'Không sửa được đơn.':'Không tạo được đơn.')}finally{setSaving(false)}};
 const shown=orders.filter(order=>`${order.code} ${order.customer_name} ${order.customer_contact||''}`.toLowerCase().includes(search.toLowerCase()));
 const editOrder=(order:Order)=>{setEditing(order);setDraft({customer_name:order.customer_name||'',customer_contact:order.customer_contact||'',social_link:order.social_link||'',shipping_fee:String(order.shipping_fee||''),shipping_cost:String(order.shipping_cost||''),discount:String(order.discount||''),other_fee:String(order.other_fee||''),payment_status:order.payment_status||'paid',note:order.note||'',ordered_at:order.ordered_at.slice(0,10)});setLines(order.items.map(item=>({product_id:item.product_id,quantity:item.quantity,unit_price:String(item.unit_price)})));setCreating(true);window.scrollTo({top:0,behavior:'smooth'})};
 useEffect(()=>{const quick=()=>{setEditing(null);setDraft(blank);setLines([{product_id:'',quantity:1,unit_price:''}]);setCreating(true)},exportFile=()=>{const name=ledgers.find(item=>item.id===ledger)?.name||nowMonth();if(!orders.length)return notify('Chưa có đơn để xuất.');exportOrdersExcel(orders,name)},route=()=>{if(location.hash==='#new-order')quick();else if(location.hash.startsWith('#edit-')){const order=orders.find(item=>item.id===location.hash.slice(6));if(order)editOrder(order)}};window.addEventListener('quick-order',quick);window.addEventListener('export-orders',exportFile);window.addEventListener('hashchange',route);route();return()=>{window.removeEventListener('quick-order',quick);window.removeEventListener('export-orders',exportFile);window.removeEventListener('hashchange',route)}},[orders,ledger,ledgers]);
 if(creating)return <><Title small="Đơn hàng" title="Chốt đơn cho khách" text="Mỗi đơn tự trừ tồn kho và vào thống kê đúng ngày."/><Panel><Back title="Tạo đơn mới" go={reset}/><div className="grid min-w-0 gap-4 md:grid-cols-2"><DateField label="Ngày chốt" value={draft.ordered_at} set={v=>setDraft({...draft,ordered_at:v})}/><Field label="Tên khách"><input value={draft.customer_name} onChange={e=>setDraft({...draft,customer_name:e.target.value})} placeholder="Tên để tìm lại" className={input}/></Field><Field label="SĐT / tài khoản social"><input value={draft.customer_contact} onChange={e=>setDraft({...draft,customer_contact:e.target.value})} className={input}/></Field><Field label="Link tin nhắn"><input value={draft.social_link} onChange={e=>setDraft({...draft,social_link:e.target.value})} className={input}/></Field></div><h3 className="mb-3 mt-5 text-sm font-black">Sản phẩm khách mua</h3><div className="min-w-0 space-y-3">{lines.map((line,index)=>{const product=products.find(p=>p.id===line.product_id);return <div key={index} className="min-w-0 rounded-xl border bg-white p-3"><div className="flex min-w-0 gap-2"><div className="min-w-0 flex-1"><CustomSelect value={line.product_id} onChange={value=>{const picked=products.find(p=>p.id===value);update(index,{product_id:value,unit_price:String(picked?.selling_price||'')})}} placeholder="Chọn hàng trong kho" options={products.filter(p=>p.stock_quantity>0&&!lines.some((item,i)=>i!==index&&item.product_id===p.id)).map(p=>({value:p.id,label:p.name,description:`Còn ${p.stock_quantity} · Giá ${cash(p.selling_price)}`}))}/></div>{lines.length>1&&<button onClick={()=>setLines(old=>old.filter((_,i)=>i!==index))} className="w-12 shrink-0 rounded-xl border text-red-600"><Trash2 className="mx-auto h-5"/></button>}</div><div className="mt-3 grid min-w-0 grid-cols-[minmax(0,140px)_minmax(0,1fr)] gap-3"><Field label="Số lượng"><div className="space-y-1.5"><div className="flex h-12 min-w-0 items-center rounded-xl border bg-white"><button type="button" onClick={()=>update(index,{quantity:Math.max(1,line.quantity-1)})} className="w-9 shrink-0 flex items-center justify-center text-[#585556]/75 hover:text-[#585556]"><Minus className="mx-auto h-4"/></button><input value={line.quantity} onChange={e=>update(index,{quantity:Math.max(1,+e.target.value)})} inputMode="numeric" className="min-w-0 flex-1 text-center font-black outline-none"/><button type="button" onClick={()=>update(index,{quantity:Math.min(product?.stock_quantity||9999,line.quantity+1)})} className="w-9 shrink-0 flex items-center justify-center text-[#585556]/75 hover:text-[#585556]"><Plus className="mx-auto h-4"/></button></div><div className="flex flex-wrap items-center gap-1.5"><span className="text-[10px] font-bold text-[#585556]/60">Chọn nhanh:</span>{[1,2,3,5,10].map(qty=><button key={qty} type="button" onClick={()=>update(index,{quantity:qty})} className={`h-8 px-2.5 rounded-lg text-xs font-bold transition-all ${line.quantity===qty?'bg-[#585556] text-white shadow-xs':'bg-[#fef9f4] text-[#585556]/75 hover:bg-[#b9cddf]'}`}>{qty}</button>)}</div></div></Field><Money label="Giá / món" value={line.unit_price} set={value=>update(index,{unit_price:value})}/></div>{product&&<p className="mt-2 text-xs font-bold text-[#585556]/60">Kho còn {product.stock_quantity} · vốn {cash(product.unit_cost)}</p>}</div>})}</div><button onClick={()=>setLines(old=>[...old,{product_id:'',quantity:1,unit_price:''}])} className="mt-3 flex h-11 items-center gap-2 text-sm font-black text-[#585556]"><Plus/> Thêm món</button><div className="mt-4 grid min-w-0 grid-cols-2 gap-4 lg:grid-cols-4"><Money label="Ship thu khách" value={draft.shipping_fee} set={value=>setDraft({...draft,shipping_fee:value})}/><Money label="Ship thực trả" value={draft.shipping_cost} set={value=>setDraft({...draft,shipping_cost:value})}/><Money label="Giảm giá" value={draft.discount} set={value=>setDraft({...draft,discount:value})}/><Money label="Phí khác" value={draft.other_fee} set={value=>setDraft({...draft,other_fee:value})}/></div><div className="mt-4 grid min-w-0 gap-4 md:grid-cols-2"><Field label="Thanh toán"><CustomSelect value={draft.payment_status} onChange={value=>setDraft({...draft,payment_status:value})} placeholder="Trạng thái thanh toán" options={[{value:'paid',label:'Đã thanh toán'},{value:'pending',label:'Chưa thanh toán'},{value:'partial',label:'Thanh toán một phần'}]}/></Field><Field label="Ghi chú"><textarea value={draft.note} onChange={e=>setDraft({...draft,note:e.target.value})} className={area}/></Field></div><div className="mt-4 grid grid-cols-2 rounded-xl bg-[#fef9f4] p-4"><div><p className="text-xs font-bold">Khách trả</p><b className="break-words text-lg text-[#585556]">{cash(total)}</b></div><div><p className="text-xs font-bold">Lãi dự kiến</p><b className="break-words text-lg text-[#cecece]">{cash(total-cost)}</b></div></div><div className="mb-12 mt-5"><Button onClick={save} disabled={saving}>{saving?<Loader2 className="animate-spin"/>:<Check/>} Xác nhận tạo đơn</Button></div></Panel></>;
 return <><Title small="Đơn hàng" title="Chốt đơn cho khách" text="Mỗi đơn tự trừ tồn kho và vào thống kê đúng ngày."/><div className="mb-4 flex min-w-0 flex-col gap-3 md:flex-row md:justify-between"><Picker ledgers={ledgers} id={ledger} set={choose} add={addBook}/><Button onClick={()=>setCreating(true)} disabled={!ledger||!products.length}><Plus/> Tạo đơn mới</Button></div>{!ledger?<Empty icon={<ClipboardList/>} title="Chưa có sổ bán hàng" text="Tạo sổ tháng trước khi chốt đơn."/>:<Panel><div className="relative mb-3"><Search className="absolute left-3 top-3.5 h-5"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm mã đơn, tên khách" className={`${input} pl-10`}/></div>{loading?<Loading/>:shown.length?<div className="space-y-2">{shown.map(order=><SwipeableItem key={order.id} onEdit={()=>editOrder(order)} onDelete={()=>setDeleteOrderTarget(order)}><div className="flex min-w-0 items-center gap-3 p-3 cursor-pointer md:cursor-default" onClick={()=>{if(typeof window!=="undefined"&&window.innerWidth<768){editOrder(order)}}}><div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${order.payment_status==='paid'?'bg-[#b9cddf] text-[#cecece]':'bg-[#b9cddf] text-[#585556]'}`}><ReceiptText className="h-5"/></div><div className="min-w-0 flex-1"><b className="block truncate text-sm">{order.customer_name} <small className="text-[#585556]/60">{order.code}</small></b><p className="truncate text-xs font-semibold text-[#585556]/60">{dateText(order.ordered_at)} · {order.item_count} món · {order.items.map(x=>x.product_name).join(', ')}</p></div><div className="shrink-0 text-right"><b className="text-sm text-[#585556]">{cash(order.total)}</b><p className="text-[10px] font-black text-[#cecece]">Lãi {cash(order.profit)}</p></div><div className="hidden md:flex items-center gap-1.5 shrink-0 ml-2"><button type="button" onClick={(e)=>{e.stopPropagation();editOrder(order)}} className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#b9cddf] bg-white text-[#585556]/75 hover:border-[#585556] hover:text-[#585556] hover:bg-[#fef9f4] active:scale-95 transition-all shadow-xs cursor-pointer" title="Sửa đơn"><MinimalEdit size={16}/></button><button type="button" onClick={(e)=>{e.stopPropagation();setDeleteOrderTarget(order)}} className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-white text-[#585556] hover:border-red-400 hover:bg-[#b9cddf] hover:text-[#585556] active:scale-95 transition-all shadow-xs cursor-pointer" title="Xóa đơn"><MinimalTrash size={16}/></button></div></div></SwipeableItem>)}</div>:<Empty icon={<ReceiptText/>} title="Chưa có đơn" text="Bấm Tạo đơn mới khi khách chốt mua."/>}</Panel>}{deleteOrderTarget&&<ConfirmModal title="Xóa đơn hàng?" message={`Xóa đơn ${deleteOrderTarget.code}? Tồn kho các sản phẩm trong đơn sẽ được tự động hoàn lại.`} confirmText="Xóa đơn" cancelText="Hủy" isDanger onConfirm={async()=>{const order=deleteOrderTarget;setDeleteOrderTarget(null);try{await axios.delete(`${API}/api/business/orders/${order.id}`,{headers});setOrders(old=>old.filter(item=>item.id!==order.id));setProducts(old=>old.map(product=>{const sold=order.items.find(item=>item.product_id===product.id);return sold?{...product,stock_quantity:product.stock_quantity+sold.quantity}:product}));notify('Đã xóa đơn và hoàn kho.')}catch(error){fail(error,'Không xóa được đơn.')}}} onClose={()=>setDeleteOrderTarget(null)}/>}</>;
}
function Orders({ledgers,ledger,choose,addBook,headers,notify,fail,products,setProducts,orders,setOrders,loading}:Shared&{products:Product[];setProducts:React.Dispatch<React.SetStateAction<Product[]>>;orders:Order[];setOrders:React.Dispatch<React.SetStateAction<Order[]>>;loading:boolean}){
 const blank={customer_name:'',customer_contact:'',social_link:'',shipping_fee:'',shipping_cost:'',discount:'',other_fee:'',payment_status:'paid',note:'',ordered_at:nowDate()};
 const [create,setCreate]=useState(false),[saving,setSaving]=useState(false),[search,setSearch]=useState(''),[d,setD]=useState(blank),[lines,setLines]=useState([{product_id:'',quantity:1,unit_price:''}]);
 const line=(i:number,v:object)=>setLines(x=>x.map((a,j)=>j===i?{...a,...v}:a)), valid=lines.filter(x=>x.product_id&&x.quantity>0);
 const subtotal=lines.reduce((s,x)=>s+x.quantity*num(x.unit_price),0),total=subtotal+num(d.shipping_fee)-num(d.discount),cost=lines.reduce((s,x)=>s+x.quantity*(products.find(p=>p.id===x.product_id)?.unit_cost||0),0)+num(d.shipping_cost)+num(d.other_fee);
 const reset=()=>{setD(blank);setLines([{product_id:'',quantity:1,unit_price:''}]);setCreate(false)};
 const save=async()=>{if(!ledger)return notify('Chọn sổ bán hàng.');if(!d.customer_name.trim()||!valid.length)return notify('Nhập tên khách và chọn sản phẩm.');setSaving(true);try{const r=await axios.post<Order>(`${API}/api/business/orders`,{...d,ledger_id:ledger,shipping_fee:num(d.shipping_fee),shipping_cost:num(d.shipping_cost),discount:num(d.discount),other_fee:num(d.other_fee),ordered_at:new Date(d.ordered_at+'T12:00:00').toISOString(),items:valid.map(x=>({...x,unit_price:num(x.unit_price)}))},{headers});setOrders(x=>[r.data,...x]);setProducts(old=>old.map(p=>{const l=valid.find(x=>x.product_id===p.id);return l?{...p,stock_quantity:p.stock_quantity-l.quantity}:p}));reset();notify(`Đã tạo đơn ${r.data.code}.`)}catch(e){fail(e,'Không tạo được đơn.')}finally{setSaving(false)}};
 const remove=async(o:Order)=>{if(!confirm(`Xóa đơn ${o.code}? Tồn kho sẽ được hoàn lại.`))return;try{await axios.delete(`${API}/api/business/orders/${o.id}`,{headers});setOrders(x=>x.filter(a=>a.id!==o.id));setProducts(old=>old.map(p=>{const l=o.items.find(x=>x.product_id===p.id);return l?{...p,stock_quantity:p.stock_quantity+l.quantity}:p}));notify('Đã xóa đơn và hoàn kho.')}catch(e){fail(e,'Không xóa được đơn.')}};
 const shown=orders.filter(o=>`${o.code} ${o.customer_name} ${o.customer_contact||''}`.toLowerCase().includes(search.toLowerCase()));
 return <><Title small="Đơn hàng" title="Chốt đơn cho khách" text="Mỗi đơn tự trừ tồn kho và vào thống kê đúng ngày."/><div className="mb-4 flex flex-col gap-3 md:flex-row md:justify-between"><Picker ledgers={ledgers} id={ledger} set={choose} add={addBook}/><Button onClick={()=>setCreate(true)} disabled={!ledger||!products.length}><Plus/> Tạo đơn mới</Button></div>{!ledger?<Empty icon={<ClipboardList/>} title="Chưa có sổ bán hàng" text="Tạo sổ tháng trước khi chốt đơn."/>:create?<Panel><Back title="Tạo đơn mới" go={reset}/><div className="grid gap-4 md:grid-cols-2"><Field label="Ngày chốt"><input type="date" value={d.ordered_at} onChange={e=>setD({...d,ordered_at:e.target.value})} className={input}/></Field><Field label="Tên khách"><input value={d.customer_name} onChange={e=>setD({...d,customer_name:e.target.value})} placeholder="Tên để tìm lại" className={input}/></Field><Field label="SĐT / tài khoản social"><input value={d.customer_contact} onChange={e=>setD({...d,customer_contact:e.target.value})} className={input}/></Field><Field label="Link tin nhắn"><input value={d.social_link} onChange={e=>setD({...d,social_link:e.target.value})} className={input}/></Field></div><h3 className="mb-3 mt-5 text-sm font-black">Sản phẩm khách mua</h3><div className="space-y-3">{lines.map((x,i)=>{const picked=products.find(p=>p.id===x.product_id);return <div key={i} className="rounded-xl border bg-white p-3"><div className="flex gap-2"><select value={x.product_id} onChange={e=>{const p=products.find(a=>a.id===e.target.value);line(i,{product_id:e.target.value,unit_price:String(p?.selling_price||'')})}} className={`${input} min-w-0 flex-1`}><option value="">Chọn hàng trong kho</option>{products.filter(p=>p.stock_quantity>0&&!lines.some((a,j)=>j!==i&&a.product_id===p.id)).map(p=><option key={p.id} value={p.id}>{p.name} · còn {p.stock_quantity}</option>)}</select>{lines.length>1&&<button onClick={()=>setLines(a=>a.filter((_,j)=>j!==i))} className="w-12 rounded-xl border text-red-600"><Trash2 className="mx-auto"/></button>}</div><div className="mt-3 grid grid-cols-[120px_1fr] gap-3"><Field label="Số lượng"><div className="flex h-12 items-center rounded-xl border"><button onClick={()=>line(i,{quantity:Math.max(1,x.quantity-1)})} className="w-10"><Minus className="mx-auto h-4"/></button><input value={x.quantity} onChange={e=>line(i,{quantity:Math.max(1,+e.target.value)})} className="min-w-0 flex-1 text-center font-black outline-none"/><button onClick={()=>line(i,{quantity:Math.min(picked?.stock_quantity||1,x.quantity+1)})} className="w-10"><Plus className="mx-auto h-4"/></button></div></Field><Money label="Giá / món" value={x.unit_price} set={v=>line(i,{unit_price:v})}/></div>{picked&&<p className="mt-2 text-xs font-bold text-[#585556]/60">Kho còn {picked.stock_quantity} · vốn {cash(picked.unit_cost)}</p>}</div>})}</div><button onClick={()=>setLines(x=>[...x,{product_id:'',quantity:1,unit_price:''}])} className="mt-3 flex h-11 items-center gap-2 text-sm font-black text-[#585556]"><Plus/> Thêm món</button><div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4"><Money label="Ship thu khách" value={d.shipping_fee} set={v=>setD({...d,shipping_fee:v})}/><Money label="Ship thực trả" value={d.shipping_cost} set={v=>setD({...d,shipping_cost:v})}/><Money label="Giảm giá" value={d.discount} set={v=>setD({...d,discount:v})}/><Money label="Phí khác" value={d.other_fee} set={v=>setD({...d,other_fee:v})}/></div><div className="mt-4 grid gap-4 md:grid-cols-2"><Field label="Thanh toán"><select value={d.payment_status} onChange={e=>setD({...d,payment_status:e.target.value})} className={input}><option value="paid">Đã thanh toán</option><option value="pending">Chưa thanh toán</option><option value="partial">Một phần</option></select></Field><Field label="Ghi chú"><textarea value={d.note} onChange={e=>setD({...d,note:e.target.value})} className={area}/></Field></div><div className="mt-4 grid grid-cols-2 rounded-xl bg-[#fef9f4] p-4"><div><p className="text-xs font-bold">Khách trả</p><b className="text-lg text-[#585556]">{cash(total)}</b></div><div><p className="text-xs font-bold">Lãi dự kiến</p><b className="text-lg text-[#cecece]">{cash(total-cost)}</b></div></div><div className="mt-5"><Button onClick={save} disabled={saving}>{saving?<Loader2 className="animate-spin"/>:<Check/>} Xác nhận tạo đơn</Button></div></Panel>:<Panel><div className="relative mb-3"><Search className="absolute left-3 top-3.5 h-5"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm mã đơn, tên khách" className={`${input} pl-10`}/></div>{loading?<Loading/>:shown.length?shown.map(o=><div key={o.id} className="flex items-center gap-2 border-b last:border-0"><div className="min-w-0 flex-1"><OrderRow o={o}/></div><button onClick={()=>remove(o)} className="flex h-10 w-10 items-center justify-center rounded-xl border text-red-600"><Trash2 className="h-4"/></button></div>):<Empty icon={<ReceiptText/>} title="Chưa có đơn" text="Bấm Tạo đơn mới khi khách chốt mua."/>}</Panel>}</>;
}
function OrderRow({o}:{o:Order}){return <div className="flex min-w-0 items-center gap-2 py-3"><div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${o.payment_status==='paid'?'bg-[#b9cddf] text-[#cecece]':'bg-[#b9cddf] text-[#585556]'}`}><ReceiptText className="h-5"/></div><div className="min-w-0 flex-1"><b className="block truncate text-sm">{o.customer_name} <small className="text-[#585556]/60">{o.code}</small></b><p className="truncate text-xs font-semibold text-[#585556]/60">{dateText(o.ordered_at)} · {o.item_count} món · {o.items.map(x=>x.product_name).join(', ')}</p></div><div className="shrink-0 text-right"><b className="text-sm text-[#585556]">{cash(o.total)}</b><p className="text-[10px] font-black text-[#cecece]">Lãi {cash(o.profit)}</p></div><Link href={`/business/orders#edit-${o.id}`} aria-label={`Sửa đơn ${o.code}`} title="Sửa đơn" className="btn-push flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"><MinimalEdit size={14}/></Link></div>}

function Reports({ledgers,ledger,choose,addBook,headers,notify,fail,report,setReport,loading}:Shared&{report:Report|null;setReport:React.Dispatch<React.SetStateAction<Report|null>>;loading:boolean}){
 const [open,setOpen]=useState(false),[saving,setSaving]=useState(false),[e,setE]=useState({category:'',amount:'',note:'',spent_at:nowDate()});
 const save=async()=>{if(!ledger||!e.category||!num(e.amount))return notify('Nhập loại chi phí và số tiền.');setSaving(true);try{const r=await axios.post<Expense>(`${API}/api/business/expenses`,{...e,ledger_id:ledger,amount:num(e.amount),spent_at:new Date(e.spent_at+'T12:00:00').toISOString()},{headers});setReport(x=>x?{...x,operating_expense:x.operating_expense+r.data.amount,net_profit:x.net_profit-r.data.amount,profit_after_inventory:x.profit_after_inventory-r.data.amount,profit:x.profit-r.data.amount,expenses:[r.data,...x.expenses]}:x);setOpen(false);setE({category:'',amount:'',note:'',spent_at:nowDate()});notify('Đã ghi khoản chi.')}catch(err){fail(err,'Không lưu được khoản chi.')}finally{setSaving(false)}};
 const max=Math.max(...(report?.daily.map(x=>x.revenue)||[1]),1), costs=report?report.capital_cost+report.shipping_cost+report.other_order_fee+report.operating_expense:0;
 return <><Title small="Thống kê" title="Hiệu quả bán hàng" text="Theo dõi doanh thu, chi phí, lợi nhuận gộp, lợi nhuận ròng và lợi nhuận sau tồn theo tháng."/><div className="mb-4 flex flex-col gap-3 md:flex-row md:justify-between"><Picker ledgers={ledgers} id={ledger} set={choose} add={addBook}/><Button light onClick={()=>setOpen(true)} disabled={!ledger}><Minus/> Ghi chi phí</Button></div>{!ledger?<Empty icon={<BarChart3/>} title="Chưa có dữ liệu" text="Tạo sổ bán hàng để theo dõi số liệu."/>:loading||!report?<Loading/>:<><div className="grid grid-cols-2 gap-3 lg:grid-cols-6">{[['Doanh thu',report.revenue],['Tổng chi phí',costs],['Lợi nhuận gộp',report.gross_profit],['Lợi nhuận ròng',report.net_profit],['Lợi nhuận sau tồn',report.profit_after_inventory],['Giá trị tồn',report.stock_value]].map((x,i)=><Panel key={String(x[0])} className="!p-4"><p className="text-xs font-bold text-[#585556]/60">{x[0]}</p><b className={`mt-2 block break-words text-lg ${i>=2&&i<=4?(Number(x[1])<0?'text-red-600':'text-[#cecece]'):'text-[#585556]'}`}>{cash(Number(x[1]))}</b></Panel>)}</div><div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_.8fr]"><Panel><h2 className="font-black">Doanh thu theo ngày</h2><p className="text-xs font-semibold text-[#585556]/60">{report.order_count} đơn · trung bình {cash(report.average_order_value)}/đơn</p>{report.daily.length?<div className="mt-5 flex h-52 items-end gap-2 overflow-x-auto">{report.daily.map(x=><div key={x.date} className="flex h-full min-w-11 flex-1 flex-col justify-end"><p className="mb-1 text-center text-[9px] font-black">{cash(x.revenue).replace(' đ','')}</p><div className="mx-auto w-full max-w-12 rounded-t bg-[#585556]" style={{height:`${Math.max(8,x.revenue/max*145)}px`}}/><p className="mt-2 text-center text-[10px] font-bold">{new Date(x.date+'T12:00:00').getDate()}</p></div>)}</div>:<div className="mt-4"><Empty icon={<BarChart3/>} title="Chưa có doanh thu" text="Biểu đồ xuất hiện sau đơn đầu tiên."/></div>}</Panel><Panel><h2 className="mb-2 font-black">Cơ cấu chi phí</h2>{[['Giá vốn',report.capital_cost],['Ship thực trả',report.shipping_cost],['Phí theo đơn',report.other_order_fee],['Chi phí vận hành',report.operating_expense]].map(x=><div key={String(x[0])} className="flex justify-between border-b py-3 last:border-0"><span className="text-sm font-semibold">{x[0]}</span><b className="text-sm">{cash(Number(x[1]))}</b></div>)}</Panel></div><div className="mt-4 grid gap-4 lg:grid-cols-2"><Panel><h2 className="mb-2 font-black">Sản phẩm bán tốt</h2>{report.top_products.length?report.top_products.map((x,i)=><div key={x.product_id} className="flex items-center gap-3 border-b py-3 last:border-0"><i className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#fef9f4] text-xs font-black not-italic">{i+1}</i><div className="min-w-0 flex-1"><b className="block truncate text-sm">{x.name}</b><p className="text-xs">Đã bán {x.quantity}</p></div><b className="text-sm text-[#585556]">{cash(x.revenue)}</b></div>):<p className="text-sm text-[#585556]/60">Chưa có sản phẩm đã bán.</p>}</Panel><Panel><h2 className="mb-2 font-black">Chi phí vận hành</h2>{report.expenses.length?report.expenses.map(x=><div key={x.id} className="flex justify-between gap-3 border-b py-3 last:border-0"><div><b className="text-sm">{x.category}</b><p className="text-xs text-[#585556]/60">{dateText(x.spent_at)} {x.note&&`· ${x.note}`}</p></div><b className="text-sm text-red-700">-{cash(x.amount)}</b></div>):<p className="text-sm text-[#585556]/60">Chưa ghi chi phí ngoài đơn.</p>}</Panel></div></>}{open&&<Modal close={()=>setOpen(false)} title="Ghi chi phí vận hành"><div className="space-y-4"><DateField label="Ngày chi" value={e.spent_at} set={a=>setE({...e,spent_at:a})}/><Field label="Loại chi phí"><input value={e.category} onChange={a=>setE({...e,category:a.target.value})} placeholder="Quảng cáo, đóng gói..." className={input}/></Field><Money label="Số tiền" value={e.amount} set={v=>setE({...e,amount:v})}/><Field label="Ghi chú"><textarea value={e.note} onChange={a=>setE({...e,note:a.target.value})} className={area}/></Field><Button onClick={save} disabled={saving}>{saving?<Loader2 className="animate-spin"/>:<Check/>} Lưu khoản chi</Button></div></Modal>}</>;
}
