'use client';

import { AnimatePresence, motion } from 'framer-motion';
import FinanceNav from './FinanceNav';
import FinanceBookPanel from './FinanceBookPanel';
import { accountDelta, categoryDelta, mergeTransaction, overlayTransactions } from './transactionUpdates';
import { ArrowRightLeft, BookOpen, Check, CreditCard, FileSpreadsheet, History, Landmark, Loader2, Minus, Plus, Pencil, ReceiptText, Trash2, Wallet } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import PieChart from '@/components/PieChart';
import Sidebar from '@/components/Sidebar';
import ModalShell from './FinanceDialog';
import { FinanceDatePicker, FinanceSelect } from './FinancePicker';
import FinanceCategoryIcon from './FinanceCategoryIcon';
import FinanceExportDialog from './FinanceExportDialog';
import type { FinanceCategory } from './categoryData';
import TransactionEntry from './TransactionEntry';
import { WriteQueue } from './writeQueue';

type AccountEdit = {id:string;previousName:string;newName:string;previousType:string;newType:string;previousCurrency:string;newCurrency:string;previousCreditLimit:number|null;newCreditLimit:number|null;previousBalance:number;newBalance:number;note:string;createdAt:string};
type Account = { id:string;name:string;type:string;currency:string;openingBalance:number;creditLimit:number|null;balance:number;transactionCount:number;editHistory:AccountEdit[] };
type Book = { id:string;name:string;defaultCurrency:string;note:string;createdAt:string;accounts:Account[] };
type Transaction = { id:string;type:'income'|'expense'|'transfer';amount:number;currency:string;categoryId:string|null;category:string;categoryIcon:string|null;categoryColor:string|null;description:string;date:string;createdAt:string;account:{id:string;name:string;type:string};destinationAccount:{id:string;name:string;type:string}|null };
type PendingWrite = { id:string;bookId:string;row:Transaction;body:Record<string,unknown>;status:'pending'|'failed';error:string;restored?:boolean };
type Modal = 'book'|'account'|'account-edit'|'transaction'|'transfer'|'transfer-history'|'export'|null;

const currencies = ['VND','USD','EUR','JPY','GBP','THB','AUD','SGD'];
const accountTypes = [{value:'cash',label:'Tiền mặt'},{value:'bank',label:'Tài khoản ngân hàng'},{value:'debit_card',label:'Thẻ ghi nợ'},{value:'credit_card',label:'Thẻ tín dụng'},{value:'e_wallet',label:'Ví điện tử'},{value:'other',label:'Khác'}];
const card = 'border-2 border-black bg-[#fffaf0] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]';
const field = 'h-12 w-full border-2 border-black bg-[#fffdf7] px-3 font-bold text-[#171513] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] outline-none focus:bg-[#fff3c4] focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]';
const button = 'inline-flex items-center justify-center gap-2 border-2 border-black px-4 font-black text-[#171513] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50';

const dayFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'});
const headingFormatter=new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'});
const timeFormatter=new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'});
const today=()=>dayFormatter.format(new Date());
const dateKey=(value:string)=>dayFormatter.format(new Date(value));
const dateText=(value:string)=>headingFormatter.format(new Date(value));
const dateTimeText=(value:string)=>timeFormatter.format(new Date(value));
const moneyFormatters=new Map<string,Intl.NumberFormat>();
const money=(value:number,currency='VND')=>{
  let formatter=moneyFormatters.get(currency);
  if(!formatter){formatter=new Intl.NumberFormat('vi-VN',{style:'currency',currency,maximumFractionDigits:currency==='VND'||currency==='JPY'?0:2});moneyFormatters.set(currency,formatter)}
  return formatter.format(value||0);
};
const amountText = (value:string) => {const [whole,decimal]=value.split('.');const grouped=whole.replace(/\B(?=(\d{3})+(?!\d))/g,',');return decimal===undefined?grouped:`${grouped}.${decimal}`};
const rawAmount = (value:string,allowNegative=false) => {const raw=value.replace(/,/g,'').trim();return (allowNegative?/^-?\d*(\.\d*)?$/:/^\d*(\.\d*)?$/).test(raw)?raw:null};
const accountLabel = (type:string) => accountTypes.find(item=>item.value===type)?.label || 'Tài khoản';

function PushButton({className='',children,...props}:React.ComponentProps<typeof motion.button>){return <motion.button whileHover={{y:-1}} whileTap={{scale:0.97,y:1}} className={`${button} ${className}`} {...props}>{children}</motion.button>}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="block"><span className="mb-2 block text-xs font-black uppercase tracking-wide">{label}</span>{children}</label>}


export default function FinanceClient({view}:{view:'statistics'|'transactions'|'accounts'}){
  const {token,user}=useAuth();
  const headers=useMemo(()=>({Authorization:`Bearer ${token}`,'Content-Type':'application/json'}),[token]);
  const [books,setBooks]=useState<Book[]>([]),[bookId,setBookId]=useState(''),[storedTransactions,setTransactions]=useState<Transaction[]>([]),[categories,setCategories]=useState<FinanceCategory[]>([]),[loading,setLoading]=useState(true),[mutating,setSaving]=useState(false),[modal,setModal]=useState<Modal>(null),[error,setError]=useState(''),[message,setMessage]=useState('');
  const outboxKey=`finance-outbox:${user?.id||''}`;
  const [pendingWrites,setPendingWrites]=useState<Map<string,PendingWrite>>(()=>{
    try{
      if(typeof window==='undefined')return new Map();
      const stored:unknown=JSON.parse(sessionStorage.getItem(outboxKey)||'[]');
      if(!Array.isArray(stored))return new Map();
      return new Map(stored.filter((write):write is PendingWrite=>!!write&&typeof write.id==='string'&&typeof write.bookId==='string'&&write.row?.id===write.id&&write.body?.clientId===write.id&&typeof write.row.amount==='number'&&!!write.row.account?.id).map(write=>[write.id,{...write,status:'failed' as const,restored:true,error:'Lần lưu trước chưa được xác nhận. Thử lại để kiểm tra và lưu an toàn.'}]));
    }catch{return new Map()}
  });
  useEffect(()=>{
    try{
      if(pendingWrites.size)sessionStorage.setItem(outboxKey,JSON.stringify([...pendingWrites.values()]));
      else sessionStorage.removeItem(outboxKey);
    }catch{/* Normal online saves still work when browser storage is unavailable. */}
  },[pendingWrites,outboxKey]);
  const queue=useRef(new WriteQueue(2));
  const activeWrites=useRef(new Set<string>());
  const hasPendingWrites=[...pendingWrites.values()].some(write=>write.status==='pending');
  const saving=mutating||pendingWrites.size>0;
  const pendingRows=useMemo(()=>[...pendingWrites.values()].filter(write=>write.bookId===bookId&&write.status==='pending'&&!write.restored).map(write=>write.row),[pendingWrites,bookId]);
  const transactions=useMemo(()=>overlayTransactions(storedTransactions,pendingRows),[storedTransactions,pendingRows]);
  const pendingIds=useMemo(()=>new Set(pendingRows.map(row=>row.id)),[pendingRows]);
  const [scrolling,setScrolling]=useState(false);
  const [bookForm,setBookForm]=useState({name:'',defaultCurrency:'VND',note:''});
  const [accountForm,setAccountForm]=useState({name:'',type:'cash',currency:'VND',openingBalance:'',creditLimit:''});
  const [accountEditForm,setAccountEditForm]=useState({name:'',type:'cash',currency:'VND',balance:'',creditLimit:'',note:''});
  const [editingAccount,setEditingAccount]=useState<Account|null>(null);
  const [deleteAccountTarget,setDeleteAccountTarget]=useState<Account|null>(null);
  const [transactionForm,setTransactionForm]=useState({type:'expense' as 'income'|'expense',accountId:'',amount:'',category:'',description:'',date:today()});
  const [transferForm,setTransferForm]=useState({accountId:'',destinationAccountId:'',amount:'',description:'',date:today()});
  const [editingTransaction,setEditingTransaction]=useState<Transaction|null>(null);
  const [deleteTarget,setDeleteTarget]=useState<Transaction|null>(null);
  const [selection,setSelection]=useState<{bookId:string;ids:Set<string>}|null>(null);
  const [bulkDeleteTarget,setBulkDeleteTarget]=useState<{bookId:string;ids:string[];all:boolean}|null>(null);
  const selectedCategoryByType=useRef<Record<'income'|'expense',string>>({income:'',expense:''});
  const current=useMemo(()=>{
    const book=books.find(item=>item.id===bookId);
    if(!book)return null;
    if(!pendingRows.length)return book;
    const deltas=new Map<string,{balance:number;count:number}>();
    for(const row of pendingRows)for(const id of [row.account.id,...(row.destinationAccount?[row.destinationAccount.id]:[])]){
      const delta=accountDelta(id,row),previous=deltas.get(id)||{balance:0,count:0};
      deltas.set(id,{balance:previous.balance+delta.balance,count:previous.count+delta.count});
    }
    return {...book,accounts:book.accounts.map(account=>{const delta=deltas.get(account.id);return delta?{...account,balance:account.balance+delta.balance,transactionCount:account.transactionCount+delta.count}:account})};
  },[books,bookId,pendingRows]);
  const activeBookId=useRef(bookId);
  useEffect(()=>{activeBookId.current=bookId},[bookId]);
  const canTransfer=!!current?.accounts.some((account,index)=>current.accounts.slice(index+1).some(other=>other.currency===account.currency));
  const categoriesFor=(type:'income'|'expense')=>categories.filter(category=>category.type===type).sort((a,b)=>(b.usageCount||0)-(a.usageCount||0));

  const loadBooks=useCallback(async()=>{if(!token)return;const response=await fetch('/api/business/finance/books',{headers});const data=await response.json();if(!response.ok)throw new Error(data.detail||'Không tải được sổ chi tiêu.');setBooks(data);setBookId(currentId=>data.some((book:Book)=>book.id===currentId)?currentId:(data[0]?.id||''));},[headers,token]);
  const transactionLoadVersion=useRef(0);
  const transactionLoadChanges=useRef<Map<string,Transaction>|null>(null);
  const loadTransactions=useCallback(async(id:string)=>{
    const version=++transactionLoadVersion.current;
    if(!token||!id){setTransactions([]);return}
    const changes=new Map<string,Transaction>();
    transactionLoadChanges.current=changes;
    const response=await fetch(`/api/business/finance/transactions?bookId=${encodeURIComponent(id)}`,{headers});
    const data=await response.json();
    if(!response.ok)throw new Error(data.detail||'Không tải được giao dịch.');
    if(version===transactionLoadVersion.current){
      // A save may finish while this snapshot is in flight. Keep confirmed changes.
      let items:Transaction[]=data.transactions;
      for(const saved of changes.values())items=mergeTransaction(items,saved);
      setTransactions(items);
      transactionLoadChanges.current=null;
    }
  },[headers,token]);
  const loadCategories=useCallback(async()=>{if(!token)return;const response=await fetch('/api/business/finance/categories',{headers});const data=await response.json();if(!response.ok)throw new Error(data.detail||'Không tải được danh mục.');setCategories(data);},[headers,token]);
  const refresh=useCallback(async()=>{setLoading(true);setError('');try{await Promise.all([loadBooks(),loadCategories()])}catch(reason){setError(reason instanceof Error?reason.message:'Không tải được dữ liệu.')}finally{setLoading(false)}},[loadBooks,loadCategories]);

  useEffect(()=>{const timer=window.setTimeout(refresh,0);return()=>window.clearTimeout(timer)},[refresh]);
  useEffect(()=>{if(!bookId)return;const timer=window.setTimeout(()=>loadTransactions(bookId).catch(reason=>setError(reason instanceof Error?reason.message:'Không tải được giao dịch.')),0);return()=>window.clearTimeout(timer)},[bookId,loadTransactions]);

  useEffect(()=>{
    let idleTimer:number|undefined;
    const onScroll=()=>{
      setScrolling(true);
      window.clearTimeout(idleTimer);
      idleTimer=window.setTimeout(()=>setScrolling(false),300);
    };
    window.addEventListener('scroll',onScroll,{passive:true,capture:true});
    return()=>{window.removeEventListener('scroll',onScroll,true);window.clearTimeout(idleTimer)};
  },[]);

  const notify=(text:string)=>{setMessage(text);window.setTimeout(()=>setMessage(''),2200)};
  const request=async(url:string,body:unknown)=>{if(saving)return;setSaving(true);setError('');try{const response=await fetch(url,{method:'POST',headers,body:JSON.stringify(body)}),data=await response.json();if(!response.ok)throw new Error(data.detail||'Không lưu được dữ liệu.');setModal(null);await loadBooks();const targetBook=url.endsWith('/books')?data.id:bookId;if(url.endsWith('/books'))setBookId(data.id);await loadTransactions(targetBook);notify('Đã lưu thành công.')}catch(reason){setError(reason instanceof Error?reason.message:'Không lưu được dữ liệu.')}finally{setSaving(false)}};
  const openAccountEdit=(account:Account)=>{
    if(saving)return;
    setEditingAccount(account);setAccountEditForm({name:account.name,type:account.type,currency:account.currency,balance:String(account.balance),creditLimit:account.creditLimit===null?'':String(account.creditLimit),note:''});setError('');setModal('account-edit');
  };
  const saveAccountEdit=async()=>{
    if(!editingAccount||saving)return;
    setSaving(true);setError('');
    try{
      const response=await fetch(`/api/business/finance/accounts/${editingAccount.id}`,{method:'PUT',headers,body:JSON.stringify(accountEditForm)}),data=await response.json();
      if(!response.ok)throw new Error(data.detail||'Không cập nhật được khoản tiền.');
      await Promise.all([loadBooks(),loadTransactions(bookId)]);setModal(null);setEditingAccount(null);notify('Đã cập nhật khoản tiền và lưu lịch sử chỉnh sửa.');
    }catch(reason){setError(reason instanceof Error?reason.message:'Không cập nhật được khoản tiền.')}finally{setSaving(false)}
  };
  const confirmDeleteAccount=async()=>{
    if(!deleteAccountTarget||saving)return;
    setSaving(true);setError('');
    try{
      const response=await fetch(`/api/business/finance/accounts/${deleteAccountTarget.id}`,{method:'DELETE',headers});
      if(!response.ok){const data=await response.json();throw new Error(data.detail||'Không xóa được khoản tiền.')}
      setDeleteAccountTarget(null);await Promise.all([loadBooks(),loadTransactions(bookId),loadCategories()]);notify('Đã xóa khoản tiền và dữ liệu liên quan.');
    }catch(reason){setError(reason instanceof Error?reason.message:'Không xóa được khoản tiền.')}finally{setSaving(false)}
  };
  const categoryMemory=useRef<Record<string,{income?:string;expense?:string;lastType?:'income'|'expense'}>>({});
  const preferenceKey=`finance-last-category:${user?.id || ''}:${bookId}`;
  const lastCategories=()=>{
    if(categoryMemory.current[preferenceKey])return categoryMemory.current[preferenceKey];
    try{
      const stored=JSON.parse(localStorage.getItem(preferenceKey)||'{}');
      if(stored&&typeof stored==='object')return {
        income:typeof stored.income==='string'?stored.income:undefined,
        expense:typeof stored.expense==='string'?stored.expense:undefined,
        lastType:stored.lastType==='income'?'income' as const:'expense' as const,
      };
    }catch{/* Keep session defaults when browser storage is unavailable. */}
    return {};
  };
  const rememberCategory=()=>{
    const value={...lastCategories(),[transactionForm.type]:transactionForm.category,lastType:transactionForm.type};
    categoryMemory.current[preferenceKey]=value;
    try{localStorage.setItem(preferenceKey,JSON.stringify(value))}catch{/* In-memory defaults still work. */}
  };
  const openTransaction=(accountId?:string,initialType?:'income'|'expense')=>{
    setEditingTransaction(null);
    if(!current?.accounts.length){setError('Hãy tạo ít nhất một tài khoản tiền trước.');return}
    const recent=lastCategories(),type=initialType||recent.lastType||'expense',available=categories.filter(category=>category.type===type);
    const selectedAccount=accountId&&current.accounts.some(account=>account.id===accountId)?accountId:current.accounts[0].id;
    const remembered=available.some(category=>category.id===recent[type])?recent[type]||'':'';
    selectedCategoryByType.current={income:categories.some(category=>category.type==='income'&&category.id===recent.income)?recent.income||'':'',expense:categories.some(category=>category.type==='expense'&&category.id===recent.expense)?recent.expense||'':''};
    selectedCategoryByType.current[type]=remembered;
    setTransactionForm({type,accountId:selectedAccount,amount:'',category:remembered,description:'',date:today()});
    setModal('transaction');setError('');setMessage('');
  };
  const openTransfer=useCallback((item?:Transaction)=>{
    if(!current||!canTransfer){setError('Hãy tạo ít nhất hai ví dùng cùng loại tiền tệ để chuyển tiền.');return}
    setEditingTransaction(item||null);
    const source=item?.account.id||current.accounts.find(account=>current.accounts.some(other=>other.id!==account.id&&other.currency===account.currency))!.id;
    const compatible=current.accounts.filter(account=>account.id!==source&&account.currency===current.accounts.find(value=>value.id===source)?.currency);
    setTransferForm({accountId:source,destinationAccountId:item?.destinationAccount?.id||compatible[0]?.id||'',amount:item?String(item.amount):'',description:item?.description||'',date:item?dateKey(item.date):today()});
    setError('');setMessage('');setModal('transfer');
  },[current,canTransfer,setEditingTransaction,setTransferForm,setError,setMessage,setModal]);
  const editTransaction=useCallback((item:Transaction)=>{
    if(saving)return;
    if(item.type==='transfer'){openTransfer(item);return}
    setEditingTransaction(item);
    selectedCategoryByType.current[item.type]=item.categoryId||'';
    setTransactionForm({type:item.type,accountId:item.account.id,amount:String(item.amount),category:item.categoryId||'',description:item.description,date:dateKey(item.date)});
    setError('');setModal('transaction');
  },[openTransfer,saving,setEditingTransaction,setTransactionForm,setError,setModal]);
  const applySavedTransaction=(saved:Transaction,previous:Transaction|null,targetBookId=bookId)=>{
    if(targetBookId===activeBookId.current){
      transactionLoadChanges.current?.set(saved.id,saved);
      setTransactions(items=>mergeTransaction(items,saved));
    }
    setBooks(items=>items.map(book=>book.id!==targetBookId?book:{...book,accounts:book.accounts.map(account=>{
      const delta=accountDelta(account.id,saved,previous);
      return {...account,balance:account.balance+delta.balance,transactionCount:account.transactionCount+delta.count};
    })}));
    setCategories(items=>items.map(category=>({...category,usageCount:(category.usageCount||0)+categoryDelta(category.id,saved,previous)})));
  };
  const sendWrite=(write:PendingWrite)=>{
    if(activeWrites.current.has(write.id))return;
    activeWrites.current.add(write.id);
    if(write.restored)setSaving(true);
    setPendingWrites(items=>new Map(items).set(write.id,{...write,status:'pending',error:''}));
    void queue.current.run(async()=>{
      const response=await fetch('/api/business/finance/transactions',{method:'POST',headers,body:JSON.stringify(write.body)});
      const data=await response.json();
      if(!response.ok)throw new Error(data.detail||'Không lưu được giao dịch.');
      return data as Transaction;
    }).then(async saved=>{
      // After navigation, balances may already include this UUID. Reconcile instead
      // of applying its delta again. Normal writes keep the fast local update.
      if(write.restored)await Promise.all([loadBooks(),loadTransactions(bookId),loadCategories()]);
      else applySavedTransaction(saved,null,write.bookId);
      setPendingWrites(items=>{const next=new Map(items);next.delete(write.id);return next});
      notify('Đã lưu giao dịch.');
    }).catch(reason=>{
      const detail=reason instanceof Error?reason.message:'Kết nối bị gián đoạn.';
      // Remove the optimistic row and its day totals, but retain the draft for safe retry.
      setPendingWrites(items=>new Map(items).set(write.id,{...write,status:'failed',error:detail}));
      setError(`${detail} Giao dịch chưa được xác nhận; có thể bấm Thử lưu lại.`);
    }).finally(()=>{activeWrites.current.delete(write.id);if(write.restored)setSaving(false)});
  };
  const enqueueCreate=(body:Record<string,unknown>,closeAfter:boolean)=>{
    if([...pendingWrites.values()].some(write=>write.restored)){
      setError('Hãy thử lưu lại hoặc đối soát các bản nhập từ lần trước trước khi tạo giao dịch mới.');return;
    }
    const account=current?.accounts.find(item=>item.id===body.accountId);
    if(!current||!account)return;
    const category=categories.find(item=>item.id===body.categoryId);
    const destination=current.accounts.find(item=>item.id===body.destinationAccountId);
    const id=crypto.randomUUID();
    const row:Transaction={id,type:body.type as Transaction['type'],amount:Number(body.amount),currency:account.currency,categoryId:category?.id||null,category:category?.name||'Chuyển tiền',categoryIcon:category?.icon||null,categoryColor:category?.color||null,description:String(body.description||''),date:new Date(`${body.date}T12:00:00+07:00`).toISOString(),createdAt:new Date().toISOString(),account:{id:account.id,name:account.name,type:account.type},destinationAccount:destination?{id:destination.id,name:destination.name,type:destination.type}:null};
    sendWrite({id,bookId,row,body:{...body,clientId:id},status:'pending',error:''});
    if(closeAfter)setModal(null);
    else if(body.type==='transfer')setTransferForm(form=>({...form,amount:'',description:''}));
    else setTransactionForm(form=>({...form,amount:'',description:''}));
    setError('');
    notify('Đang lưu giao dịch… Bạn có thể nhập tiếp.');
  };
  const reconcileFailedWrites=async()=>{
    if(hasPendingWrites||mutating)return;
    setSaving(true);setError('');
    try{
      // A disconnected response may already have committed. Read the source of truth
      // before discarding drafts or allowing balance edits and destructive actions.
      await Promise.all([loadBooks(),loadTransactions(bookId),loadCategories()]);
      setPendingWrites(new Map());
      notify('Đã đối soát dữ liệu từ máy chủ và bỏ các bản nhập chưa xác nhận.');
    }catch(reason){setError(reason instanceof Error?reason.message:'Không đối soát được dữ liệu.')}finally{setSaving(false)}
  };
  const saveTransfer=async(closeAfter=true)=>{
    if(mutating)return;
    const source=current?.accounts.find(account=>account.id===transferForm.accountId),destination=current?.accounts.find(account=>account.id===transferForm.destinationAccountId);
    if(!source||!destination||source.id===destination.id||!transferForm.date||!Number.isFinite(Number(transferForm.amount))||Number(transferForm.amount)<=0){setError('Vui lòng chọn hai ví khác nhau và nhập số tiền hợp lệ.');return}
    if(source.currency!==destination.currency){setError('Chỉ có thể chuyển tiền giữa hai ví cùng loại tiền tệ.');return}
    if(!editingTransaction){enqueueCreate({...transferForm,type:'transfer',bookId},closeAfter);return}
    if(hasPendingWrites)return;
    setSaving(true);setError('');
    try{
      const response=await fetch(editingTransaction?`/api/business/finance/transactions/${editingTransaction.id}`:'/api/business/finance/transactions',{method:editingTransaction?'PUT':'POST',headers,body:JSON.stringify({...transferForm,type:'transfer',bookId})}),data=await response.json();
      if(!response.ok)throw new Error(data.detail||'Không chuyển được tiền.');
      applySavedTransaction(data,editingTransaction);if(closeAfter||editingTransaction){setModal(null);setEditingTransaction(null)}else setTransferForm(form=>({...form,amount:'',description:''}));notify(editingTransaction?'Đã cập nhật khoản chuyển tiền.':'Đã chuyển tiền giữa hai ví.');
    }catch(reason){setError(reason instanceof Error?reason.message:'Không chuyển được tiền.')}finally{setSaving(false)}
  };
  const pressAmountKey=(key:string)=>{setTransactionForm(form=>{
    if(key==='backspace')return {...form,amount:form.amount.slice(0,-1)};
    if(key==='.'&&form.amount.includes('.'))return form;
    const raw=key==='.'&&!form.amount?'0.':`${form.amount}${key}`;
    const amount=raw.replace(/^0+(?=\d)/,'').slice(0,15);
    return {...form,amount};
  })};
  const saveTransaction=async(closeAfter:boolean)=>{
    if(mutating)return;
    if(!editingTransaction&&!transactionForm.amount&&!transactionForm.category&&closeAfter){setModal(null);setError('');return}
    if(!transactionForm.accountId||!transactionForm.category.trim()||!transactionForm.date||!Number.isFinite(Number(transactionForm.amount))||Number(transactionForm.amount)<=0){
      setError('Vui lòng nhập khoản tiền và chọn đầy đủ thông tin giao dịch.');
      return;
    }
    if(!editingTransaction){rememberCategory();enqueueCreate({...transactionForm,categoryId:transactionForm.category,bookId},closeAfter);return}
    if(hasPendingWrites)return;
    setSaving(true);setError('');
    try{
      const response=await fetch(editingTransaction?`/api/business/finance/transactions/${editingTransaction.id}`:'/api/business/finance/transactions',{method:editingTransaction?'PUT':'POST',headers,body:JSON.stringify({...transactionForm,categoryId:transactionForm.category,bookId})}),data=await response.json();
      if(!response.ok)throw new Error(data.detail||'Không lưu được giao dịch.');
      if(!editingTransaction)rememberCategory();
      applySavedTransaction(data,editingTransaction);
      if(closeAfter||editingTransaction){setModal(null);setEditingTransaction(null);}
      else setTransactionForm(form=>({...form,amount:'',description:''}));
      notify(editingTransaction?'Đã cập nhật giao dịch.':closeAfter?'Đã hoàn thành thêm giao dịch.':'Đã thêm giao dịch. Có thể nhập giao dịch tiếp theo.');
    }catch(reason){setError(reason instanceof Error?reason.message:'Không lưu được giao dịch.')}finally{setSaving(false)}
  };
  const remove=useCallback((item:Transaction)=>{if(saving)return;setDeleteTarget(item);setError('')},[saving,setDeleteTarget,setError]);
  const confirmRemove=async()=>{
    if(!deleteTarget||saving)return;
    setSaving(true);setError('');
    try{
      const response=await fetch(`/api/business/finance/transactions/${deleteTarget.id}`,{method:'DELETE',headers});
      if(!response.ok){const data=await response.json();throw new Error(data.detail||'Không xóa được giao dịch.')}
      setDeleteTarget(null);
      await Promise.all([loadBooks(),loadTransactions(bookId),loadCategories()]);
      notify('Đã xóa giao dịch.');
    }catch(reason){setError(reason instanceof Error?reason.message:'Không xóa được giao dịch.')}finally{setSaving(false)}
  };


  const confirmBulkRemove=async()=>{
    if(!bulkDeleteTarget||saving)return;
    setSaving(true);setError('');
    try{
      const response=await fetch('/api/business/finance/transactions',{method:'DELETE',headers,body:JSON.stringify({bookId:bulkDeleteTarget.bookId,ids:bulkDeleteTarget.ids})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.detail||'Không xóa được các giao dịch.');
      const removedIds=new Set(bulkDeleteTarget.ids);
      setTransactions(items=>items.filter(item=>!removedIds.has(item.id)));
      setBulkDeleteTarget(null);setSelection(null);
      await Promise.all([loadBooks(),loadTransactions(bookId),loadCategories()]);
      notify(`Đã xóa ${data.deletedCount} giao dịch và cập nhật số dư, thống kê.`);
    }catch(reason){setError(reason instanceof Error?reason.message:'Không xóa được các giao dịch.')}finally{setSaving(false)}
  };

  const accountHistory=useMemo(()=>current?.accounts.flatMap(account=>account.editHistory.map(edit=>({...edit,accountId:account.id}))).sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()).slice(0,30)||[],[current]);

  return <div className="business-shell min-h-screen bg-[#f4ead6] p-3 pb-16 pt-[calc(4.75rem+env(safe-area-inset-top,0px))] font-sans text-[#171513] md:flex md:gap-5 md:p-6" style={{paddingBottom:'calc(8rem + env(safe-area-inset-bottom,0px))',backgroundImage:'linear-gradient(rgba(23,21,19,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(23,21,19,.055) 1px,transparent 1px)',backgroundSize:'28px 28px'}}><Sidebar/><main className="business-main min-w-0 flex-1"><div className="business-content mx-auto max-w-7xl">
    <header className={`page-heading page-heading-panel ${card} p-5 md:p-7`}><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-black uppercase tracking-[.2em]">Tài chính cá nhân & cửa hàng</p><h1 className="mt-5 text-3xl font-black uppercase text-[#df5b2a] md:text-5xl">Quản lý chi tiêu</h1></div><div className="flex flex-wrap gap-3"><PushButton onClick={()=>setModal('export')} disabled={!current||!transactions.some(item=>item.type!=='transfer')} className="h-12 bg-[#8ee0a8]"><FileSpreadsheet size={18}/> Xuất Excel</PushButton><PushButton onClick={()=>{setBookForm({name:'',defaultCurrency:'VND',note:''});setModal('book');setError('')}} className="h-12 bg-[#ffd978]"><Plus size={18}/> Tạo sổ</PushButton><PushButton onClick={()=>{setError('');setModal('transfer-history')}} disabled={!current} aria-label="Lịch sử chuyển tiền" title="Lịch sử chuyển tiền" className="h-12 w-12 bg-[#c4a7ff] !px-0"><History size={20}/></PushButton><PushButton onClick={()=>openTransaction()} disabled={!current} className="h-12 bg-[#ef7c3b]"><Plus size={18}/> Thêm giao dịch</PushButton></div></div></header>
    <FinanceNav view={view}/>

    <FinanceBookPanel name={current?.name}>
      <div className="grid gap-3 md:grid-cols-[1fr_auto]"><Field label="Sổ chi tiêu đang mở"><FinanceSelect label="Chọn sổ chi tiêu" placeholder="Chọn sổ chi tiêu" value={bookId} onChange={id=>{if(saving)return;++transactionLoadVersion.current;setBookId(id);setTransactions([]);setSelection(null);setBulkDeleteTarget(null)}} options={books.map(book=>({value:book.id,label:`${book.name} · ${book.defaultCurrency}`}))}/></Field>{current&&<div className="self-end border-2 border-black bg-[#ffc857] px-4 py-3 text-sm font-black">{current.accounts.length} tài khoản · {transactions.length} giao dịch</div>}</div>
    </FinanceBookPanel>
    {pendingWrites.size>0&&<section className="finance-sync-panel" aria-label="Đồng bộ giao dịch">
      {hasPendingWrites&&<p role="status"><Loader2 size={15} className="animate-spin"/> Đang lưu {[...pendingWrites.values()].filter(write=>write.status==='pending').length} giao dịch. Bạn có thể tiếp tục nhập.</p>}
      {[...pendingWrites.values()].filter(write=>write.status==='failed').map(write=><div key={write.id} className="finance-sync-failed" role="alert">
        <div><b>{write.row.category} · {money(write.row.amount,write.row.currency)}</b><p>{write.error} Chưa xác nhận lưu.</p></div>
        <button type="button" disabled={mutating||(write.restored&&hasPendingWrites)} onClick={()=>{setError('');sendWrite(write)}}>Thử lưu lại</button>
      </div>)}
      {[...pendingWrites.values()].some(write=>write.status==='failed')&&<button type="button" className="finance-load-more" disabled={hasPendingWrites||mutating} onClick={()=>void reconcileFailedWrites()}>Bỏ bản nhập lỗi và tải lại dữ liệu</button>}
    </section>}
    {error&&<div role="alert" className="mt-5 border-2 border-black bg-[#ffc9ba] p-4 font-bold shadow-[4px_4px_0_0px_#000]">{error}</div>}
    {loading?<div className="mt-8 flex justify-center"><Loader2 className="animate-spin"/></div>:!current?<div className={`${card} mt-7 flex min-h-64 flex-col items-center justify-center p-6 text-center`}><BookOpen size={44}/><h2 className="mt-3 text-xl font-black uppercase">Chưa có sổ chi tiêu</h2><p className="mt-2 text-sm font-semibold">Tạo sổ đầu tiên để bắt đầu quản lý dòng tiền.</p></div>:view==='accounts'?<>
      <section className="mt-7 flex items-center justify-between gap-3"><h2 className="text-xl font-black uppercase">Khoản tiền</h2><PushButton onClick={()=>{setAccountForm({name:'',type:'cash',currency:current.defaultCurrency,openingBalance:'',creditLimit:''});setModal('account');setError('')}} className="h-11 shrink-0 whitespace-nowrap bg-[#fffaf0] px-3 text-xs sm:px-4 sm:text-sm"><Plus size={17}/> Thêm tài khoản</PushButton></section>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{current.accounts.map(account=><motion.article key={account.id} whileHover={{x:2,y:2,boxShadow:'2px 2px 0 rgba(0,0,0,1)'}} className={`${card} p-3 ${account.type==='credit_card'?'bg-[#ffd6c9]':'bg-[#fffaf0]'}`}><div className="flex items-start justify-between gap-3"><div className="flex h-11 w-11 items-center justify-center border-2 border-black bg-[#ffd978]">{account.type==='cash'?<Wallet/>:account.type==='bank'?<Landmark/>:<CreditCard/>}</div><div className="flex items-center gap-2"><span className="border-2 border-black bg-white px-2 py-1 text-[10px] font-black">{account.currency}</span><button type="button" onClick={()=>openAccountEdit(account)} aria-label={`Chỉnh sửa ${account.name}`} title="Chỉnh sửa khoản tiền" className="btn-push flex h-9 w-9 items-center justify-center bg-[#ffe69a]"><Pencil size={15}/></button></div></div><h3 className="mt-2 truncate text-sm font-black" title={account.name}>{account.name}</h3><p className="text-xs font-bold">{accountLabel(account.type)}</p><strong className={`mt-2 block break-words text-lg font-black underline decoration-2 underline-offset-4 ${account.balance<0?'text-red-700':'text-[#198754]'}`}>{money(account.balance,account.currency)}</strong>{account.creditLimit!==null&&<p className="mt-2 text-xs font-bold">Hạn mức: {money(account.creditLimit,account.currency)}</p>}<button type="button" onClick={()=>openTransaction(account.id,'income')} className="mt-2 inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wide text-[#df5b2a]"><Plus size={14}/> Ghi khoản thu</button></motion.article>)}</div>
      {accountHistory.length>0&&<section className={`${card} mt-8 overflow-hidden`}><div className="flex items-center gap-2 border-b-2 border-black bg-[#e8dcff] p-4"><History size={19}/><h2 className="font-black uppercase">Lịch sử chỉnh sửa khoản tiền</h2></div><div>{accountHistory.map(edit=><div key={edit.id} className="border-b-2 border-black p-4 last:border-b-0"><div className="flex flex-wrap items-center justify-between gap-2"><b className="text-sm">{edit.previousName===edit.newName?edit.newName:`${edit.previousName} → ${edit.newName}`}</b><time className="text-xs font-bold text-black/55">{dateTimeText(edit.createdAt)}</time></div><div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs font-semibold"><span>Số dư: <b>{money(edit.previousBalance,edit.previousCurrency)} → {money(edit.newBalance,edit.newCurrency)}</b></span>{edit.previousType!==edit.newType&&<span>Loại: <b>{accountLabel(edit.previousType)} → {accountLabel(edit.newType)}</b></span>}{edit.previousCurrency!==edit.newCurrency&&<span>Tiền tệ: <b>{edit.previousCurrency} → {edit.newCurrency}</b></span>}{edit.previousCreditLimit!==edit.newCreditLimit&&<span>Hạn mức: <b>{edit.previousCreditLimit===null?'Không có':money(edit.previousCreditLimit,edit.previousCurrency)} → {edit.newCreditLimit===null?'Không có':money(edit.newCreditLimit,edit.newCurrency)}</b></span>}</div>{edit.note&&<p className="mt-2 text-xs font-semibold text-black/65">Ghi chú: {edit.note}</p>}<p className="mt-2 text-[11px] font-black uppercase tracking-wide text-[#7046b5]">Điều chỉnh độc lập · không tính thu chi</p></div>)}</div></section>}

    </>:view==='statistics'?<>
      <div className="mt-7 space-y-6">{Array.from(new Set([...current.accounts.map(account=>account.currency),...transactions.map(item=>item.currency)])).map(currency=><section key={currency} className={`finance-panel ${card} grid gap-8 p-5 xl:grid-cols-2`}><PieChart title={`Thu & chi · ${currency}`} data={['income','expense'].map(type=>({label:type==='income'?'Khoản thu':'Khoản chi',value:transactions.filter(item=>item.type===type&&item.currency===currency).reduce((sum,item)=>sum+item.amount,0)}))} formatValue={value=>money(value,currency)}/><PieChart title={`Chi tiêu theo danh mục · ${currency}`} data={Array.from(new Set(transactions.filter(item=>item.type==='expense'&&item.currency===currency).map(item=>item.category))).map(category=>({label:category||'Chưa phân loại',value:transactions.filter(item=>item.type==='expense'&&item.currency===currency&&item.category===category).reduce((sum,item)=>sum+item.amount,0)}))} formatValue={value=>money(value,currency)}/></section>)}</div>
      <div className="finance-chart-grid mt-6 grid gap-6 xl:grid-cols-2">{Array.from(new Set(current.accounts.map(account=>account.currency))).map(currency=><section key={currency} className={`finance-panel ${card} p-5`}><PieChart title={`Phân bổ khoản tiền · ${currency}`} data={current.accounts.filter(account=>account.currency===currency).map(account=>({label:account.name,value:account.balance}))} formatValue={value=>money(value,currency)}/></section>)}</div>
    </>:<TransactionList key={bookId} transactions={transactions} saving={saving} bookId={bookId} selection={selection} setSelection={setSelection} setBulkDeleteTarget={setBulkDeleteTarget} setError={setError} remove={remove} editTransaction={editTransaction} pendingIds={pendingIds}/>}

  </div></main>
  <AnimatePresence>{modal==='book'&&<ModalShell key="book" title="Tạo sổ chi tiêu" close={()=>setModal(null)}><form className="space-y-5" onSubmit={event=>{event.preventDefault();request('/api/business/finance/books',bookForm)}}><Field label="Tên sổ"><input required value={bookForm.name} onChange={event=>setBookForm({...bookForm,name:event.target.value})} placeholder="Ví dụ: Chi tiêu cửa hàng" className={field}/></Field><Field label="Tiền tệ mặc định"><FinanceSelect label="Chọn tiền tệ mặc định" placeholder="Chọn tiền tệ" value={bookForm.defaultCurrency} onChange={defaultCurrency=>setBookForm({...bookForm,defaultCurrency})} options={currencies.map(currency=>({value:currency,label:currency}))}/></Field><Field label="Ghi chú"><textarea value={bookForm.note} onChange={event=>setBookForm({...bookForm,note:event.target.value})} className={`${field} min-h-24 py-3`}/></Field><PushButton disabled={saving} className="h-12 w-full bg-[#ef7c3b]">{saving?<Loader2 className="animate-spin"/>:<Plus/>} Tạo sổ</PushButton></form></ModalShell>}
  {modal==='account'&&current&&<ModalShell key="account" title="Thêm tài khoản tiền" close={()=>setModal(null)}><form className="space-y-5" onSubmit={event=>{event.preventDefault();request('/api/business/finance/accounts',{...accountForm,bookId})}}><Field label="Tên tài khoản"><input required value={accountForm.name} onChange={event=>setAccountForm({...accountForm,name:event.target.value})} placeholder="Tiền mặt, Visa, Vietcombank..." className={field}/></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Loại tài khoản"><FinanceSelect label="Chọn loại tài khoản" placeholder="Chọn loại" value={accountForm.type} onChange={type=>setAccountForm({...accountForm,type})} options={accountTypes}/></Field><Field label="Tiền tệ"><FinanceSelect label="Chọn tiền tệ" placeholder="Chọn tiền tệ" value={accountForm.currency} onChange={currency=>setAccountForm({...accountForm,currency})} options={currencies.map(currency=>({value:currency,label:currency}))}/></Field></div><Field label="Số dư ban đầu"><input type="text" inputMode="decimal" value={amountText(accountForm.openingBalance)} onFocus={()=>{if(Number(accountForm.openingBalance)===0)setAccountForm(form=>({...form,openingBalance:''}))}} onChange={event=>{const openingBalance=rawAmount(event.target.value,true);if(openingBalance!==null)setAccountForm({...accountForm,openingBalance})}} className={field}/></Field>{accountForm.type==='credit_card'&&<Field label="Hạn mức tín dụng"><input type="text" inputMode="decimal" value={amountText(accountForm.creditLimit)} onFocus={()=>{if(Number(accountForm.creditLimit)===0)setAccountForm(form=>({...form,creditLimit:''}))}} onChange={event=>{const creditLimit=rawAmount(event.target.value);if(creditLimit!==null)setAccountForm({...accountForm,creditLimit})}} className={field}/></Field>}<PushButton disabled={saving} className="h-12 w-full bg-[#ef7c3b]">{saving?<Loader2 className="animate-spin"/>:<Plus/>} Thêm tài khoản</PushButton></form></ModalShell>}
  {modal==='account-edit'&&editingAccount&&<ModalShell key="account-edit" title="Chỉnh sửa khoản tiền" busy={saving} close={()=>{if(!saving){setModal(null);setEditingAccount(null)}}}>
    <form className="space-y-5" onSubmit={event=>{event.preventDefault();void saveAccountEdit()}}><fieldset disabled={saving} className="space-y-5">
      <Field label="Tên khoản tiền"><input required value={accountEditForm.name} onChange={event=>setAccountEditForm({...accountEditForm,name:event.target.value})} className={field}/></Field>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Loại tài khoản"><FinanceSelect label="Chọn loại tài khoản" placeholder="Chọn loại" value={accountEditForm.type} onChange={type=>setAccountEditForm({...accountEditForm,type,creditLimit:type==='credit_card'?accountEditForm.creditLimit:''})} options={accountTypes}/></Field><Field label="Tiền tệ"><FinanceSelect label="Chọn tiền tệ" placeholder="Chọn tiền tệ" value={accountEditForm.currency} onChange={currency=>setAccountEditForm({...accountEditForm,currency})} options={currencies.map(currency=>({value:currency,label:currency}))}/></Field></div>
      {accountEditForm.currency!==editingAccount.currency&&<p className="border-2 border-black bg-[#ffe69a] p-3 text-xs font-bold">Đổi tiền tệ chỉ thay đơn vị của khoản tiền này, không tự quy đổi tỷ giá và không sửa loại tiền trên các giao dịch cũ.</p>}
      <Field label="Số dư hiện tại"><div className="relative"><input required type="text" inputMode="decimal" value={amountText(accountEditForm.balance)} onFocus={()=>{if(Number(accountEditForm.balance)===0)setAccountEditForm(form=>({...form,balance:''}))}} onChange={event=>{const balance=rawAmount(event.target.value,true);if(balance!==null)setAccountEditForm({...accountEditForm,balance})}} className={`${field} pr-20 text-right text-xl`}/><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-black">{accountEditForm.currency}</span></div></Field>
      {accountEditForm.type==='credit_card'&&<Field label="Hạn mức tín dụng"><input type="text" inputMode="decimal" value={amountText(accountEditForm.creditLimit)} onFocus={()=>{if(Number(accountEditForm.creditLimit)===0)setAccountEditForm(form=>({...form,creditLimit:''}))}} onChange={event=>{const creditLimit=rawAmount(event.target.value);if(creditLimit!==null)setAccountEditForm({...accountEditForm,creditLimit})}} className={field}/></Field>}
      <Field label="Ghi chú thay đổi"><textarea value={accountEditForm.note} onChange={event=>setAccountEditForm({...accountEditForm,note:event.target.value})} placeholder="Ví dụ: Đối soát lại số dư thực tế" className={`${field} min-h-20 py-3`}/></Field>
      {error&&<p role="alert" className="border-2 border-black bg-[#ffc9ba] p-3 text-sm font-bold">{error}</p>}
      <div className="grid grid-cols-[auto_1fr] gap-3"><PushButton type="button" onClick={()=>{setModal(null);setEditingAccount(null);setDeleteAccountTarget(editingAccount);setError('')}} className="h-12 bg-[#e65332] text-white"><Trash2 size={18}/> Xóa</PushButton><PushButton disabled={saving} className="h-12 bg-[#b99cff]">{saving?<Loader2 className="animate-spin"/>:<Check/>} Lưu thay đổi</PushButton></div>
    </fieldset></form>
  </ModalShell>}
  {modal==='transfer'&&current&&editingTransaction&&<ModalShell key="transfer" title={editingTransaction?'Chỉnh sửa chuyển tiền':'Chuyển tiền giữa các ví'} busy={saving} close={()=>{if(!saving){setModal(null);setEditingTransaction(null)}}}>
    <form className="space-y-5" onSubmit={event=>{event.preventDefault();void saveTransfer()}}><fieldset disabled={saving} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Từ ví"><FinanceSelect label="Chọn ví nguồn" placeholder="Chọn ví nguồn" value={transferForm.accountId} onChange={accountId=>{const source=current.accounts.find(account=>account.id===accountId);const destination=current.accounts.find(account=>account.id!==accountId&&account.currency===source?.currency);setTransferForm({...transferForm,accountId,destinationAccountId:destination?.id||''})}} options={current.accounts.map(account=>({value:account.id,label:`${account.name} · ${account.currency}`}))}/></Field><Field label="Đến ví"><FinanceSelect label="Chọn ví nhận" placeholder="Chọn ví cùng tiền tệ" value={transferForm.destinationAccountId} onChange={destinationAccountId=>setTransferForm({...transferForm,destinationAccountId})} options={current.accounts.filter(account=>account.id!==transferForm.accountId&&account.currency===current.accounts.find(source=>source.id===transferForm.accountId)?.currency).map(account=>({value:account.id,label:`${account.name} · ${account.currency}`}))}/></Field></div>
      <Field label="Ngày chuyển"><FinanceDatePicker label="Chọn ngày chuyển" value={transferForm.date} onChange={date=>setTransferForm({...transferForm,date})}/></Field>
      <Field label="Số tiền"><div className="relative"><input required type="text" inputMode="decimal" value={amountText(transferForm.amount)} onFocus={()=>{if(Number(transferForm.amount)===0)setTransferForm(form=>({...form,amount:''}))}} onChange={event=>{const amount=rawAmount(event.target.value);if(amount!==null)setTransferForm({...transferForm,amount})}} placeholder="0" className={`${field} pr-20 text-right text-2xl`}/><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-black">{current.accounts.find(account=>account.id===transferForm.accountId)?.currency}</span></div></Field>
      <Field label="Ghi chú"><textarea value={transferForm.description} onChange={event=>setTransferForm({...transferForm,description:event.target.value})} placeholder="Không bắt buộc" className={`${field} min-h-20 py-3`}/></Field>
      {error&&<p role="alert" className="border-2 border-black bg-[#ffc9ba] p-3 text-sm font-bold">{error}</p>}
      <PushButton disabled={saving||!transferForm.destinationAccountId} className="h-12 w-full bg-[#b99cff]">{saving?<Loader2 className="animate-spin"/>:<ArrowRightLeft/>} {editingTransaction?'Lưu thay đổi':'Chuyển tiền'}</PushButton>
    </fieldset></form>
  </ModalShell>}
  {(modal==='transaction'||modal==='transfer')&&current&&!editingTransaction&&<ModalShell key="transaction-entry" title="Thêm giao dịch" fullScreen busy={mutating} close={()=>{if(!mutating)setModal(null)}}>
    <TransactionEntry openTransfer={()=>{if(modal!=='transfer')openTransfer()}}
      transfer={modal==='transfer'?{destinationAccountId:transferForm.destinationAccountId,changeDestination:destinationAccountId=>setTransferForm(form=>({...form,destinationAccountId}))}:undefined}
      form={modal==='transfer'?{...transferForm,type:'expense',category:''}:transactionForm} accounts={current.accounts} categories={categoriesFor(transactionForm.type)} saving={mutating} error={error} message={message}
      change={patch=>{if(modal==='transfer'){setTransferForm(form=>{const source=current.accounts.find(account=>account.id===patch.accountId);return {...form,...patch,...(source?{destinationAccountId:current.accounts.find(account=>account.id!==source.id&&account.currency===source.currency)?.id||''}:{})}});return}setTransactionForm(form=>{if(typeof patch.category==='string')selectedCategoryByType.current[form.type]=patch.category;return {...form,...patch}})}}
      changeType={type=>{setModal('transaction');setError('');setTransactionForm(form=>{selectedCategoryByType.current[form.type]=form.category;return {...form,type,category:form.type===type?form.category:selectedCategoryByType.current[type]}})}}
      press={key=>{if(modal!=='transfer'){pressAmountKey(key);return}setTransferForm(form=>{if(key==='backspace')return {...form,amount:form.amount.slice(0,-1)};if(key==='.'&&form.amount.includes('.'))return form;return {...form,amount:(key==='.'&&!form.amount?'0.':`${form.amount}${key}`).replace(/^0+(?=\d)/,'').slice(0,15)}})}}
      save={closeAfter=>void (modal==='transfer'?saveTransfer(closeAfter):saveTransaction(closeAfter))} />
  </ModalShell>}
  {modal==='transaction'&&current&&editingTransaction&&<ModalShell key="transaction" title={editingTransaction?'Chỉnh sửa giao dịch':'Thêm giao dịch'} busy={saving} close={()=>{if(!mutating)setModal(null)}}><form onSubmit={event=>{event.preventDefault();if(editingTransaction)void saveTransaction(true)}}><fieldset disabled={saving} className="min-w-0 space-y-4"><div className="grid grid-cols-2 gap-3"><PushButton type="button" onClick={()=>setTransactionForm({...transactionForm,type:'income',category:transactionForm.type==='income'?transactionForm.category:''})} className={`h-12 ${transactionForm.type==='income'?'bg-[#8ee0a8]':'bg-white'}`}>Khoản thu</PushButton><PushButton type="button" onClick={()=>setTransactionForm({...transactionForm,type:'expense',category:transactionForm.type==='expense'?transactionForm.category:''})} className={`h-12 ${transactionForm.type==='expense'?'bg-[#ff9f87]':'bg-white'}`}>Khoản chi</PushButton></div><div className="grid grid-cols-2 gap-3"><Field label="Tài khoản tiền"><FinanceSelect compact label="Chọn tài khoản tiền" placeholder="Chọn tài khoản" value={transactionForm.accountId} onChange={accountId=>setTransactionForm({...transactionForm,accountId})} options={current.accounts.map(account=>({value:account.id,label:`${account.name} · ${account.currency}`}))}/></Field><Field label="Ngày giao dịch"><FinanceDatePicker compact label="Chọn ngày giao dịch" value={transactionForm.date} onChange={date=>setTransactionForm({...transactionForm,date})}/></Field></div><Field label="Danh mục"><FinanceSelect label="Chọn danh mục" placeholder="Chọn danh mục" value={transactionForm.category} onChange={category=>setTransactionForm({...transactionForm,category})} options={categoriesFor(transactionForm.type).map(category=>({value:category.id,label:category.name,icon:category.icon,color:category.color}))}/></Field><Field label="Ghi chú"><textarea aria-label="Ghi chú" value={transactionForm.description} onChange={event=>setTransactionForm({...transactionForm,description:event.target.value})} className={`${field} min-h-16 py-2`}/></Field>{error&&<div role="alert" className="border-2 border-black bg-[#ffc9ba] p-3 text-sm font-bold">{error}</div>}<Field label="Số tiền"><div className="relative"><input inputMode="decimal" onChange={event=>{const amount=rawAmount(event.target.value);if(amount!==null)setTransactionForm({...transactionForm,amount})}} value={amountText(transactionForm.amount)} onFocus={()=>{if(Number(transactionForm.amount)===0)setTransactionForm(form=>({...form,amount:''}))}} placeholder="0" aria-label="Số tiền" className={`${field} !h-16 pr-20 text-right text-3xl`}/><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-black">{current.accounts.find(account=>account.id===transactionForm.accountId)?.currency}</span></div></Field><PushButton type="submit" disabled={saving} className="h-12 w-full bg-[#ef7c3b]">{saving?<Loader2 className="animate-spin"/>:<Check/>} Lưu thay đổi</PushButton></fieldset></form></ModalShell>}
  {modal==='transfer-history'&&<ModalShell key="transfer-history" title="Lịch sử chuyển tiền" close={()=>setModal(null)}>
    {transactions.some(item=>item.type==='transfer')?transactions.filter(item=>item.type==='transfer').map(item=><section key={item.id} className="mb-3 border-2 border-black"><p className="border-b-2 border-black bg-[#e8dcff] px-4 py-2 text-xs font-bold">{dateText(item.date)}</p><TransactionRows items={[item]} remove={remove} edit={editTransaction}/></section>):<p className="py-8 text-center text-sm font-bold">Chưa có lịch sử chuyển tiền trong sổ này.</p>}
  </ModalShell>}
  {modal==='export'&&current&&<FinanceExportDialog key="export" bookId={bookId} transactions={transactions.filter((item):item is Transaction&{type:'income'|'expense'}=>item.type!=='transfer')} categories={categories} headers={headers} close={()=>setModal(null)} notify={notify}/>}
  {deleteAccountTarget&&<ModalShell key="delete-account" title="Xóa khoản tiền?" alert busy={saving} close={()=>{if(!saving)setDeleteAccountTarget(null)}}><div className="space-y-4"><p>Bạn sắp xóa <b>{deleteAccountTarget.name}</b>. Số dư, lịch sử chỉnh sửa và mọi giao dịch gắn với khoản tiền này sẽ bị xóa.</p>{deleteAccountTarget.transactionCount>0&&<p className="border-2 border-black bg-[#ffc9ba] p-3 text-sm font-bold">Có {deleteAccountTarget.transactionCount} giao dịch liên quan. Việc xóa có thể làm thay đổi lịch sử và số dư của ví nhận/chuyển liên quan.</p>}<div className="border-2 border-black bg-[#fff6d8] p-4"><p className="text-sm font-black">{accountLabel(deleteAccountTarget.type)} · {deleteAccountTarget.currency}</p><p className="mt-1 text-xl font-black">{money(deleteAccountTarget.balance,deleteAccountTarget.currency)}</p></div>{error&&<p role="alert" className="border-2 border-black bg-[#ffc9ba] p-3 font-bold">{error}</p>}<div className="grid grid-cols-2 gap-4"><PushButton type="button" data-dialog-initial-focus disabled={saving} onClick={()=>setDeleteAccountTarget(null)} className="h-12 bg-white">Hủy</PushButton><PushButton type="button" disabled={saving} onClick={()=>void confirmDeleteAccount()} className="h-12 bg-[#e65332] text-white">{saving?<Loader2 className="animate-spin"/>:<Trash2 size={18}/>} Xóa khoản tiền</PushButton></div></div></ModalShell>}
  {bulkDeleteTarget&&<ModalShell key="bulk-delete" title={bulkDeleteTarget.all?'Xóa toàn bộ giao dịch?':'Xóa các giao dịch đã chọn?'} alert busy={saving} close={()=>{if(!saving)setBulkDeleteTarget(null)}}>
    <div className="space-y-4">
      <p>Bạn sắp xóa <b>{bulkDeleteTarget.ids.length} giao dịch</b> trong sổ <b>{current?.name}</b>{bulkDeleteTarget.all?' (bao gồm cả chuyển tiền)':''}. Thao tác này không thể hoàn tác.</p>
      <p className="border-2 border-black bg-[#fff6d8] p-4 text-sm font-bold">Số dư các ví, tổng thu/chi và thống kê sẽ được tính lại từ các giao dịch còn lại. Khi xóa hết, số dư ví trở về số dư ban đầu, bao gồm các điều chỉnh số dư đã lưu.</p>
      {error&&<p role="alert" className="border-2 border-black bg-[#ffc9ba] p-3 font-bold">{error}</p>}
      <div className="flex flex-wrap gap-3"><PushButton type="button" data-dialog-initial-focus disabled={saving} onClick={()=>setBulkDeleteTarget(null)} className="h-12 bg-white">Hủy</PushButton><PushButton type="button" disabled={saving} onClick={()=>void confirmBulkRemove()} className="min-h-12 bg-[#e65332] text-white">{saving?<Loader2 className="animate-spin"/>:<Trash2 size={18}/>} Xóa {bulkDeleteTarget.ids.length} giao dịch</PushButton></div>
    </div>
  </ModalShell>}
  {deleteTarget&&<ModalShell key="delete" title="Xóa giao dịch?" alert busy={saving} close={()=>{if(!saving)setDeleteTarget(null)}}>
    <div className="space-y-4">
      <p>Bạn muốn xóa giao dịch này? Thao tác này không thể hoàn tác.</p>
      <div className="space-y-2 border-2 border-[#302d28] bg-[#fff6d8] p-4">
        <p className="font-black">{deleteTarget.type==='income'?'Khoản thu':deleteTarget.type==='expense'?'Khoản chi':'Chuyển tiền'} · {deleteTarget.category}</p>
        <p className="text-xl font-black">{money(deleteTarget.amount,deleteTarget.currency)}</p>
        <p>{deleteTarget.account.name}{deleteTarget.destinationAccount&&` → ${deleteTarget.destinationAccount.name}`} · {dateText(deleteTarget.date)}</p>
      </div>
      {error&&<p role="alert" className="border-2 border-black bg-[#ffc9ba] p-3 font-bold">{error}</p>}
      <div className="grid grid-cols-2 gap-4 pt-2">
        <PushButton type="button" data-dialog-initial-focus disabled={saving} onClick={()=>setDeleteTarget(null)} className="h-12 bg-white">Hủy</PushButton>
        <PushButton type="button" disabled={saving} onClick={()=>void confirmRemove()} className="h-12 bg-[#e65332] text-white">{saving?<Loader2 className="animate-spin"/>:<Trash2 size={18}/>} Xóa</PushButton>
      </div>
    </div>
  </ModalShell>}
  {message&&<motion.div key="notification" initial={{opacity:0,y:-12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-12}} className="fixed left-1/2 top-20 z-[130] -translate-x-1/2 border-2 border-black bg-[#ffd978] px-5 py-3 text-sm font-black shadow-[4px_4px_0_#000]">{message}</motion.div>}</AnimatePresence>
  {current&&<motion.button type="button" onClick={()=>openTransaction()} initial={false} animate={{scale:scrolling?0.625:1}} transition={{duration:0.18,ease:'easeOut'}} whileTap={{scale:scrolling?0.56:0.94}} aria-label="Thêm giao dịch" title="Thêm giao dịch" className="fixed bottom-[calc(7rem+env(safe-area-inset-bottom,0px))] right-5 z-[80] flex h-16 w-16 origin-bottom-right items-center justify-center rounded-full border-2 border-black bg-[#ef7c3b] text-white shadow-[6px_6px_0_#000] md:bottom-[calc(7rem+env(safe-area-inset-bottom,0px))] md:right-7"><Plus size={32} strokeWidth={3}/></motion.button>}
  </div>
}

const TransactionRows=memo(function TransactionRows({items,remove,edit,selection,pendingIds}:{items:Transaction[];remove:(item:Transaction)=>void;edit:(item:Transaction)=>void;selection?:{ids:Set<string>;toggle:(id:string)=>void};pendingIds?:Set<string>}){
  return items.length?<div>{items.map(item=><div key={item.id} className="finance-transaction-row flex flex-wrap items-center border-b-2 border-black last:border-b-0">
    {selection&&<label className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center"><input type="checkbox" className="h-6 w-6 accent-[#df5b2a]" aria-label={`Chọn ${item.category} · ${money(item.amount,item.currency)} · ${dateText(item.date)} · ${item.account.name}`} checked={selection.ids.has(item.id)} onChange={()=>selection.toggle(item.id)}/></label>}
    {item.type==='transfer'?<span className="finance-transaction-icon" data-type="transfer"><ArrowRightLeft aria-hidden="true"/></span>:item.categoryIcon?<FinanceCategoryIcon name={item.categoryIcon} color={item.categoryColor||undefined}/>:<span className="finance-transaction-icon" data-type={item.type}>{item.type==='income'?<Plus aria-hidden="true"/>:<Minus aria-hidden="true"/>}</span>}
    <div className="min-w-0 flex-1"><b className={`block truncate text-sm ${item.type==='transfer'?'text-[#7046b5]':''}`}>{item.category}</b><p className="truncate text-xs font-semibold">{item.account.name}{item.destinationAccount&&` → ${item.destinationAccount.name}`}{item.description&&` · ${item.description}`}</p></div>
    <div className="finance-transaction-actions ml-auto flex w-full max-w-full flex-wrap items-center justify-end sm:w-auto">
      <b className={`break-all text-sm ${item.type==='income'?'text-green-700':item.type==='expense'?'text-red-700':'text-[#7046b5]'}`}>{item.type==='income'?'+':item.type==='expense'?'-':'↔ '}{money(item.amount,item.currency)}</b>
      {pendingIds?.has(item.id)?<span role="status" className="finance-sync-pending"><Loader2 size={13} className="animate-spin"/> Đang lưu</span>:!selection&&<><button type="button" onClick={()=>edit(item)} aria-label="Chỉnh sửa giao dịch" title="Chỉnh sửa giao dịch" className="btn-push flex h-10 w-10 shrink-0 items-center justify-center"><Pencil size={17}/></button>
      <button type="button" onClick={()=>remove(item)} aria-label="Xóa giao dịch" title="Xóa giao dịch" className="btn-push flex h-10 w-10 shrink-0 items-center justify-center"><Trash2 size={17}/></button></>}
    </div>
  </div>)}</div>:<p className="p-8 text-center text-sm font-bold">Chưa có giao dịch trong sổ này.</p>
});


const TransactionList=memo(function TransactionList({transactions,saving,bookId,selection,setSelection,setBulkDeleteTarget,setError,remove,editTransaction,pendingIds}:{
  transactions:Transaction[];saving:boolean;bookId:string;
  selection:{bookId:string;ids:Set<string>}|null;
  setSelection:React.Dispatch<React.SetStateAction<{bookId:string;ids:Set<string>}|null>>;
  setBulkDeleteTarget:React.Dispatch<React.SetStateAction<{bookId:string;ids:string[];all:boolean}|null>>;
  setError:React.Dispatch<React.SetStateAction<string>>;
  remove:(item:Transaction)=>void;editTransaction:(item:Transaction)=>void;pendingIds:Set<string>;
}){
  const selecting=selection?.bookId===bookId;
  const selectedIds=selecting?selection!.ids:new Set<string>();
  const toggleSelection=(id:string)=>setSelection(previous=>{const ids=new Set(previous?.bookId===bookId?previous.ids:[]);if(ids.has(id))ids.delete(id);else ids.add(id);return {bookId,ids}});
  const allGroups=useMemo(()=>{const map=new Map<string,Transaction[]>();transactions.forEach(item=>{const key=dateKey(item.date);const items=map.get(key);if(items)items.push(item);else map.set(key,[item])});return [...map.entries()]},[transactions]);
  const [visibleCount,setVisibleCount]=useState(80);
  const loadMore=useRef<HTMLButtonElement>(null);
  const fullDayItems=useMemo(()=>new Map(allGroups),[allGroups]);
  const groups=useMemo(()=>{
    const visible:typeof allGroups=[];
    let remaining=visibleCount;
    for(const [day,items] of allGroups){
      if(remaining<=0)break;
      visible.push([day,items.length<=remaining?items:items.slice(0,remaining)]);
      remaining-=items.length;
    }
    return visible;
  },[allGroups,visibleCount]);
  useEffect(()=>{
    const button=loadMore.current;
    if(!button||!('IntersectionObserver' in window))return;
    const observer=new IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting)){observer.disconnect();setVisibleCount(count=>count+80)}
    },{rootMargin:'400px'});
    observer.observe(button);
    return()=>observer.disconnect();
  },[visibleCount,transactions.length]);
  const currencyTotals=(items:Transaction[],type:'income'|'expense')=>{const totals=new Map<string,number>();items.filter(item=>item.type===type).forEach(item=>totals.set(item.currency,(totals.get(item.currency)||0)+item.amount));return [...totals.entries()]};
  return <section className="mt-7 flex flex-col gap-[18px]">{transactions.length>0&&<div className={`${card} flex flex-wrap items-center gap-3 p-4`} role="region" aria-label="Chọn và thao tác giao dịch">
      {selecting?<>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 font-bold"><input type="checkbox" className="h-5 w-5 accent-[#df5b2a]" checked={transactions.every(item=>selectedIds.has(item.id))} ref={node=>{if(node)node.indeterminate=selectedIds.size>0&&!transactions.every(item=>selectedIds.has(item.id))}} onChange={event=>setSelection({bookId,ids:new Set(event.target.checked?transactions.map(item=>item.id):[])})}/> Chọn tất cả ({transactions.length})</label>
        <span aria-live="polite" className="text-sm font-bold">Đã chọn {selectedIds.size}</span>
        <PushButton disabled={saving||!selectedIds.size} onClick={()=>{setError('');setBulkDeleteTarget({bookId,ids:[...selectedIds],all:false})}} className="min-h-11 bg-[#ffc9ba]"><Trash2 size={18}/> Xóa đã chọn</PushButton>
        <PushButton disabled={saving} onClick={()=>setSelection(null)} className="min-h-11 bg-white">Hủy chọn</PushButton>
      </>:<PushButton onClick={()=>setSelection({bookId,ids:new Set()})} className="min-h-11 bg-[#ffe69a]"><Check size={18}/> Chọn giao dịch</PushButton>}
      <PushButton disabled={saving} onClick={()=>{setError('');setBulkDeleteTarget({bookId,ids:transactions.map(item=>item.id),all:true})}} className="min-h-11 bg-[#ffc9ba]"><Trash2 size={18}/> Xóa toàn bộ</PushButton>
    </div>}{groups.length?groups.map(([day,items])=><article key={day} className={`finance-day-group ${card} overflow-hidden`}><header className="finance-day-heading flex flex-col border-b-2 border-black bg-[#ffe69a] md:flex-row md:items-center md:justify-between"><div><p className="text-xs font-black uppercase tracking-wide">Giao dịch trong ngày</p><h2 className="mt-1 text-lg font-black capitalize">{dateText(items[0].date)}</h2></div><div className="flex flex-wrap gap-2">{currencyTotals(fullDayItems.get(day)||items,'income').map(([currency,total])=><span key={`i-${currency}`} className="border-2 border-black bg-[#c9f1d5] px-3 py-1 text-xs font-black text-green-800">Tổng thu +{money(total,currency)}</span>)}{currencyTotals(fullDayItems.get(day)||items,'expense').map(([currency,total])=><span key={`e-${currency}`} className="border-2 border-black bg-[#ffc9ba] px-3 py-1 text-xs font-black text-red-700">Tổng chi -{money(total,currency)}</span>)}</div></header><TransactionRows items={items} remove={remove} edit={editTransaction} pendingIds={pendingIds} selection={selecting?{ids:selectedIds,toggle:toggleSelection}:undefined}/></article>):<div className={`${card} flex min-h-64 flex-col items-center justify-center p-6 text-center`}><ReceiptText size={42}/><h2 className="mt-3 text-xl font-black uppercase">Chưa có giao dịch</h2></div>}{visibleCount<transactions.length&&<button ref={loadMore} type="button" onClick={()=>setVisibleCount(count=>count+80)} className="finance-load-more">{'Hiển thị thêm'} ({transactions.length-visibleCount})</button>}</section>;
});
