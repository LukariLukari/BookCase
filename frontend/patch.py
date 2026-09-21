import re

with open('/Users/lukarilukari/Documents/GitHub/BookCase/frontend/src/app/business/BusinessClient.tsx', 'r') as f:
    content = f.read()

# 1. z-[70] -> z-[100]
content = content.replace('className="fixed inset-0 z-[70]', 'className="fixed inset-0 z-[100]')

# 2. Add id to p state
content = content.replace("const [p,setP]=useState({name:'',sku:'',category:'',image_url:'',selling_price:'',unit_cost:'',notes:''});",
                          "const [p,setP]=useState({id:'',name:'',sku:'',category:'',image_url:'',selling_price:'',unit_cost:'',notes:''});")

# 3. Update saveProduct
old_saveProduct = "const saveProduct=async()=>{if(!p.name.trim())return notify('Nhập tên sản phẩm.');setSaving(true);try{const r=await axios.post<Product>(`${API}/api/business/products`,{...p,selling_price:num(p.selling_price),unit_cost:num(p.unit_cost),stock_quantity:0,is_active:true},{headers});setProducts(x=>[r.data,...x]);setMode('list');setP({name:'',sku:'',category:'',image_url:'',selling_price:'',unit_cost:'',notes:''});notify('Đã thêm sản phẩm.')}catch(e){fail(e,'Không thêm được sản phẩm.')}finally{setSaving(false)}};"
new_saveProduct = "const saveProduct=async()=>{if(!p.name.trim())return notify('Nhập tên sản phẩm.');setSaving(true);try{const payload={...p,selling_price:num(p.selling_price),unit_cost:num(p.unit_cost)};const r=p.id?await axios.put<Product>(`${API}/api/business/products/${p.id}`,payload,{headers}):await axios.post<Product>(`${API}/api/business/products`,{...payload,stock_quantity:0,is_active:true},{headers});setProducts(x=>p.id?x.map(item=>item.id===p.id?r.data:item):[r.data,...x]);setMode('list');setP({id:'',name:'',sku:'',category:'',image_url:'',selling_price:'',unit_cost:'',notes:''});notify(p.id?'Đã sửa sản phẩm.':'Đã thêm sản phẩm.')}catch(e){fail(e,p.id?'Không sửa được sản phẩm.':'Không thêm được sản phẩm.')}finally{setSaving(false)}};\n const deleteProduct=async(id:string)=>{if(!confirm('Xóa sản phẩm này?'))return;try{await axios.delete(`${API}/api/business/products/${id}`,{headers});setProducts(x=>x.filter(item=>item.id!==id));notify('Đã xóa sản phẩm.')}catch(e){fail(e,'Không xóa được sản phẩm.')}};"
content = content.replace(old_saveProduct, new_saveProduct)

# 4. Update "Sản phẩm mới" button
old_new_product_btn = "<Button light onClick={()=>setMode('product')}><Plus/> Sản phẩm mới</Button>"
new_new_product_btn = "<Button light onClick={()=>{setP({id:'',name:'',sku:'',category:'',image_url:'',selling_price:'',unit_cost:'',notes:''});setMode('product')}}><Plus/> Sản phẩm mới</Button>"
content = content.replace(old_new_product_btn, new_new_product_btn)

# 5. Add edit/delete buttons
old_list_item = "<div className={`rounded-lg px-2 py-1 text-center ${x.stock_quantity<=5?'bg-[#FFF0EE] text-[#A53B35]':'bg-[#EAF3ED] text-[#277044]'}`}><b>{x.stock_quantity}</b><p className=\"text-[9px] font-black\">TỒN</p></div>"
new_list_item = "<div className=\"flex flex-col gap-1 items-end\"><div className={`rounded-lg px-2 py-1 text-center ${x.stock_quantity<=5?'bg-[#FFF0EE] text-[#A53B35]':'bg-[#EAF3ED] text-[#277044]'}`}><b>{x.stock_quantity}</b><p className=\"text-[9px] font-black\">TỒN</p></div><div className=\"flex gap-1 mt-1\"><button onClick={()=>{setP({id:x.id,name:x.name,sku:x.sku||'',category:x.category||'',image_url:x.image_url||'',selling_price:String(x.selling_price),unit_cost:String(x.unit_cost),notes:x.notes||''});setMode('product')}} className=\"p-1.5 text-[#57534E] hover:text-[#1C1917] hover:bg-gray-100 rounded-lg cursor-pointer\" title=\"Sửa\"><Pencil size={14}/></button><button onClick={()=>deleteProduct(x.id)} className=\"p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg cursor-pointer\" title=\"Xóa\"><Trash2 size={14}/></button></div></div>"
content = content.replace(old_list_item, new_list_item)


with open('/Users/lukarilukari/Documents/GitHub/BookCase/frontend/src/app/business/BusinessClient.tsx', 'w') as f:
    f.write(content)
