const API = window.location.hostname === 'localhost' ? 'http://localhost:8000' : `http://${window.location.hostname}:8000`;
let productos = [], editingId = null, ajusteId = null;

// Parámetros de paginación simples
let skipMovimientos = 0;
let limitMovimientos = 200;

async function req(method, path, body){
  const opts = { method, headers: {'Content-Type':'application/json'} };
  if(body) opts.body = JSON.stringify(body);
  const r = await fetch(API + path, opts);
  if(!r.ok){ const e = await r.json().catch(()=>({detail:'Error'})); throw new Error(e.detail||'Error'); }
  if(r.status===204) return null;
  return r.json();
}

function toast(msg, ok=true){
  const t = document.getElementById('toast');
  t.textContent = (ok?'✅ ':'❌ ') + msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 3000);
}

async function loadProductos(){
  try { 
    // Usando paginación para obtener 1000 productos como máximo para el MVP
    productos = await req('GET','/productos?skip=0&limit=1000'); 
  } catch(e){ toast(e.message,false); }
}

function getStatus(qty,min){ return qty<=0?'out':qty<=min?'low':'ok'; }

function statusBadge(qty,min){
  const s=getStatus(qty,min);
  if(s==='out') return '<span class="badge badge-out">Sin stock</span>';
  if(s==='low') return '<span class="badge badge-low">Stock bajo</span>';
  return '<span class="badge badge-ok">En stock</span>';
}

function mxn(v){ return '$'+Number(v).toLocaleString('es-MX',{minimumFractionDigits:2}); }

function renderInventario(){
  const search=document.getElementById('search').value.toLowerCase();
  const cat=document.getElementById('filter-cat').value;
  const status=document.getElementById('filter-status').value;
  let filtered=productos.filter(p=>{
    const ms=p.nombre.toLowerCase().includes(search)||(p.sku||'').toLowerCase().includes(search);
    return ms&&(!cat||p.categoria===cat)&&(!status||getStatus(p.qty,p.min_stock)===status);
  });
  
  const tbody=document.getElementById('inv-body');
  tbody.innerHTML='';
  if(filtered.length===0){
    document.getElementById('inv-empty').style.display='block';
    document.getElementById('inv-table').style.display='none';
  } else {
    document.getElementById('inv-empty').style.display='none';
    document.getElementById('inv-table').style.display='';
    filtered.forEach(p=>{
      const vars=(p.variantes||[]).map(v=>`<span class="chip">${v}</span>`).join('');
      const tr=document.createElement('tr');
      tr.innerHTML=`
        <td><strong>${p.nombre}</strong>${p.sku?'<br><small style="color:#aaa">'+p.sku+'</small>':''}</td>
        <td>${p.categoria}</td>
        <td>${vars||'<span style="color:#ccc;font-size:0.78rem">—</span>'}</td>
        <td><div class="qty-controls">
          <button onclick="quickQty(${p.id},-1)">−</button>
          <span>${p.qty}</span>
          <button onclick="quickQty(${p.id},1)">+</button>
        </div></td>
        <td>${mxn(p.costo)}</td><td>${mxn(p.venta)}</td>
        <td>${statusBadge(p.qty,p.min_stock)}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="editProducto(${p.id})">✏️</button>
          <button class="btn btn-sm btn-warning" onclick="openAjuste(${p.id})" title="Ajuste">📥</button>
          <button class="btn btn-sm btn-danger" onclick="deleteProducto(${p.id})">🗑️</button>
        </td>`;
      tbody.appendChild(tr);
    });
  }
  document.getElementById('s-total').textContent=productos.length;
  document.getElementById('s-stock').textContent=productos.filter(p=>p.qty>0).length;
  document.getElementById('s-low').textContent=productos.filter(p=>getStatus(p.qty,p.min_stock)!=='ok').length;
  const val=productos.reduce((a,p)=>a+(p.qty*p.costo),0);
  document.getElementById('s-valor').textContent=mxn(val);
}

async function quickQty(id,delta){
  try{ 
    const p=await req('PATCH',`/productos/${id}/qty?delta=${delta}`); 
    const idx=productos.findIndex(x=>x.id===id); 
    if(idx>=0) productos[idx]=p; 
    renderInventario(); 
  }
  catch(e){ toast(e.message,false); }
}

function openModal(type){ 
  document.getElementById('overlay-'+type).classList.add('active'); 
  if(type==='producto' && !editingId) {
    const c=document.getElementById('mp-cat');
    if(c){ c.value=''; if(window.verificarAsistenteRopa) verificarAsistenteRopa(); }
  }
}
function closeModal(type){ document.getElementById('overlay-'+type).classList.remove('active'); editingId=null; }

function addVariantField(val=''){
  const div=document.createElement('div');div.className='variant-row';
  div.innerHTML=`<input type="text" placeholder="Ej: Talla M / Color negro" value="${val}"/><button onclick="this.parentNode.remove()">×</button>`;
  document.getElementById('variants-list').appendChild(div);
}

async function saveProducto(){
  const nombre=document.getElementById('mp-nombre').value.trim();
  if(!nombre){toast('El nombre es obligatorio',false);return;}
  const variantes=[...document.querySelectorAll('#variants-list .variant-row input')].map(i=>i.value.trim()).filter(Boolean);
  const data={nombre,sku:document.getElementById('mp-sku').value.trim(),
    categoria:document.getElementById('mp-cat').value,
    qty:parseInt(document.getElementById('mp-qty').value)||0,
    min_stock:parseInt(document.getElementById('mp-min').value)||0,
    costo:parseFloat(document.getElementById('mp-costo').value)||0,
    venta:parseFloat(document.getElementById('mp-venta').value)||0,variantes};
  try{
    if(editingId){ 
      const p=await req('PUT',`/productos/${editingId}`,data); 
      const idx=productos.findIndex(x=>x.id===editingId); 
      if(idx>=0) productos[idx]=p; 
      toast('Producto actualizado'); 
    }
    else{ 
      if (variantes.length > 0) {
        for (const v of variantes) {
           const vSku = data.sku ? data.sku + '-' + v.split('-')[0].trim().replace(/[^a-zA-Z0-9]/g, '') : '';
           const vName = nombre + ' - ' + v;
           const p_data = { ...data, nombre: vName, sku: vSku, variantes: [] };
           const p=await req('POST','/productos',p_data); 
           productos.push(p); 
        }
        toast(variantes.length + ' Productos agregados individualmente', true);
      } else {
        const p=await req('POST','/productos',data); 
        productos.push(p); 
        toast('Producto agregado', true); 
      }
    }
    closeModal('producto'); renderInventario();
  }catch(e){toast(e.message,false);}
}

function editProducto(id){
  const p=productos.find(x=>x.id===id);if(!p)return;
  editingId=id;
  document.getElementById('mp-title').textContent='Editar Producto';
  document.getElementById('mp-nombre').value=p.nombre;
  document.getElementById('mp-sku').value=p.sku||'';
  document.getElementById('mp-cat').value=p.categoria;
  if(window.verificarAsistenteRopa) verificarAsistenteRopa();
  document.getElementById('mp-qty').value=p.qty;
  document.getElementById('mp-min').value=p.min_stock;
  document.getElementById('mp-costo').value=p.costo;
  document.getElementById('mp-venta').value=p.venta;
  document.getElementById('variants-list').innerHTML='';
  (p.variantes||[]).forEach(v=>addVariantField(v));
  openModal('producto');
}

async function deleteProducto(id){
  if(!confirm('¿Eliminar este producto?'))return;
  try{ 
    await req('DELETE',`/productos/${id}`); 
    productos=productos.filter(p=>p.id!==id); 
    renderInventario(); 
    toast('Producto eliminado'); 
  }
  catch(e){toast(e.message,false);}
}

function openAjuste(id){
  const p=productos.find(x=>x.id===id);if(!p)return;
  ajusteId=id;
  document.getElementById('aj-nombre').value=p.nombre;
  document.getElementById('aj-actual').value=p.qty;
  document.getElementById('aj-nueva').value=p.qty;
  document.getElementById('aj-notas').value='';
  openModal('ajuste');
}

async function saveAjuste(){
  try{
    const p=await req('POST',`/productos/${ajusteId}/ajuste`,{
      nueva_qty:parseInt(document.getElementById('aj-nueva').value)||0,
      motivo:document.getElementById('aj-motivo').value,
      notas:document.getElementById('aj-notas').value
    });
    const idx=productos.findIndex(x=>x.id===ajusteId);
    if(idx>=0)productos[idx].qty=parseInt(document.getElementById('aj-nueva').value)||0;
    closeModal('ajuste');renderInventario();toast('Ajuste aplicado');
  }catch(e){toast(e.message,false);}
}

async function renderVentas(){
  const hoy=new Date().toDateString();
  const mes=new Date().getMonth();
  try{
    const movs=await req('GET',`/movimientos?tipo=venta&skip=0&limit=1000`);
    const ventasHoy=movs.filter(h=>new Date(h.fecha).toDateString()===hoy);
    const ventasMes=movs.filter(h=>new Date(h.fecha).getMonth()===mes);
    document.getElementById('v-hoy').textContent=ventasHoy.reduce((a,h)=>a+h.qty,0);
    document.getElementById('v-ing-hoy').textContent=mxn(ventasHoy.reduce((a,h)=>a+(h.precio*h.qty),0));
    document.getElementById('v-mes').textContent=ventasMes.reduce((a,h)=>a+h.qty,0);
    document.getElementById('v-ing-mes').textContent=mxn(ventasMes.reduce((a,h)=>a+(h.precio*h.qty),0));
  }catch(e){}
  
  if (window.onFiltrarCategoria) {
      onFiltrarCategoria();
  } else {
      const sel=document.getElementById('v-producto');
      sel.innerHTML='<option value="">-- Selecciona --</option>';
      productos.forEach(p=>{
        const o=document.createElement('option');
        o.value=p.id;
        o.textContent=p.nombre+' (Stock: '+p.qty+')';
        sel.appendChild(o);
      });
  }
}

window.onBuscarSKU = function(val) {
   const sku = val.trim().toLowerCase();
   if (!sku) { onFiltrarCategoria(); return; }
   
   const p = productos.find(x => (x.sku||'').toLowerCase() === sku);
   if (p) {
      document.getElementById('v-producto').value = p.id;
      onProductoVenta();
   } else {
      onFiltrarCategoria();
   }
};

window.onFiltrarCategoria = function() {
   const text = (document.getElementById('v-filtro-cat')?.value || '').trim().toLowerCase();
   const skuText = (document.getElementById('v-scan-sku')?.value || '').trim().toLowerCase();
   
   const sel = document.getElementById('v-producto');
   const oldVal = sel.value;
   sel.innerHTML = '<option value="">-- Selecciona --</option>';
   
   let matches = productos;
   if(text) matches = matches.filter(p => p.nombre.toLowerCase().includes(text) || p.categoria.toLowerCase().includes(text));
   if(skuText) matches = matches.filter(p => (p.sku||'').toLowerCase().includes(skuText));
   
   matches.forEach(p => {
       const o = document.createElement('option');
       o.value = p.id;
       o.textContent = p.nombre + ' (' + (p.sku||'Sin SKU') + ') - Stock: ' + p.qty;
       sel.appendChild(o);
   });
   
   if (oldVal && matches.find(p => p.id == oldVal)) sel.value = oldVal;
};

function onProductoVenta(){
  const id=parseInt(document.getElementById('v-producto').value);
  const p=productos.find(x=>x.id===id);
  const vg=document.getElementById('v-variante-group');
  if(p&&p.variantes&&p.variantes.length>0){
    const vsel=document.getElementById('v-variante');
    vsel.innerHTML='<option value="">Sin especificar</option>';
    p.variantes.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;vsel.appendChild(o);});
    vg.style.display='block';
  } else {vg.style.display='none';}
  if(p)document.getElementById('v-precio').value=p.venta;
}

window.cart = [];

window.agregarAlCarrito = function() {
  const id=parseInt(document.getElementById('v-producto').value);
  if(!id){toast('Selecciona un producto',false);return;}
  const p=productos.find(x=>x.id===id);
  const qty=parseInt(document.getElementById('v-qty').value)||1;
  const precio=parseFloat(document.getElementById('v-precio').value)||0;
  
  window.cart.push({ producto_id: p.id, nombre: p.nombre, sku: p.sku || '', qty, precio });
  renderCarritoUI();
  
  document.getElementById('v-scan-sku').value = '';
  document.getElementById('v-qty').value = 1;
  document.getElementById('v-precio').value = 0;
  document.getElementById('v-producto').value = '';
  const f = document.getElementById('v-filtro-cat');
  if(f) f.value = '';
  if(window.onFiltrarCategoria) onFiltrarCategoria();
};

window.eliminarDelCarrito = function(index) {
  window.cart.splice(index, 1);
  renderCarritoUI();
};

window.renderCarritoUI = function() {
  const list = document.getElementById('cart-list');
  const totEl = document.getElementById('cart-total');
  if(!list) return;
  list.innerHTML = '';
  if(window.cart.length === 0) {
    list.innerHTML = '<div style="color:#aaa; text-align:center; padding: 20px;">Carrito vacío</div>';
    totEl.textContent = '$0.00';
    return;
  }
  let total = 0;
  window.cart.forEach((c, i) => {
    total += (c.qty * c.precio);
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.justifyContent = 'space-between';
    div.style.alignItems = 'center';
    div.style.padding = '8px 0';
    div.style.borderBottom = '1px dashed #eee';
    
    div.innerHTML = `
      <div style="flex:1">
         <div style="font-size:0.9rem; font-weight:600">${c.nombre} <small>(${c.sku})</small></div>
         <div style="font-size:0.8rem; color:#666">${c.qty}x ${mxn(c.precio)} = <strong>${mxn(c.qty*c.precio)}</strong></div>
      </div>
      <button class="btn btn-sm btn-outline" style="padding: 2px 6px; border-color: red; color: red;" onclick="eliminarDelCarrito(${i})">🗑️</button>
    `;
    list.appendChild(div);
  });
  totEl.textContent = mxn(total);
};

window.procesarCobro = async function() {
  if(window.cart.length === 0){toast('El carrito está vacío',false);return;}
  const canal=document.getElementById('v-canal').value;
  const userNotas=document.getElementById('v-notas').value.trim();
  const ticketId = 'TICKET-' + Date.now().toString(36).toUpperCase();
  const finalNotas = ticketId + (userNotas ? ' | ' + userNotas : '');
  
  toast('Procesando cobro...');
  try {
    for (const c of window.cart) {
       const data={
         producto_id: c.producto_id,
         variante: '',
         qty: c.qty,
         precio: c.precio,
         canal,
         notas: finalNotas
       };
       await req('POST','/ventas',data);
    }
    
    const ticketData = {
       fecha: new Date().toISOString(),
       canal,
       notas: finalNotas,
       detalles: window.cart.map(c => ({ producto_nombre: c.nombre, sku: c.sku, qty: c.qty, precio: c.precio }))
    };
    generarTicketMulti(ticketData);
    
    await loadProductos();
    renderVentas();
    renderInventario();
    document.getElementById('v-notas').value='';
    window.cart = [];
    renderCarritoUI();
    toast('Venta múltiple registrada con éxito', true);
  } catch(e) {
    toast('Error en cobro: ' + e.message, false);
  }
};

window.descargarTicketMulti = function(h_json) {
  const h = JSON.parse(decodeURIComponent(h_json));
  generarTicketMulti(h);
};

window.generarTicketMulti = function(h) {
  if (!window.jspdf) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: [80, 250] });

  const buildPDF = (hasLogo, imgElement) => {
    let currentY = 15;
    if (hasLogo && imgElement) {
      doc.addImage(imgElement, 'PNG', 20, 5, 40, 40);
      currentY = 50;
    } else {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Kromo Pinceles", 40, currentY, { align: "center" });
      currentY += 7;
    }

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("TICKET DE COMPRA", 40, currentY, { align: "center" });
    currentY += 6;
    
    const fechaStr = h.fecha ? new Date(h.fecha).toLocaleString('es-MX') : new Date().toLocaleString('es-MX');
    doc.setFontSize(8);
    doc.text("Fecha: " + fechaStr, 40, currentY, { align: "center" });
    currentY += 4;
    
    doc.line(5, currentY, 75, currentY);
    currentY += 6;

    doc.setFont("helvetica", "bold");
    doc.text("Detalle de la compra:", 5, currentY);
    doc.setFont("helvetica", "normal");
    currentY += 6;
    
    let totalGrid = 0;
    
    (h.detalles || []).forEach(d => {
       const prodName = d.producto_nombre || "Producto";
       const splitName = doc.splitTextToSize("Prod: " + prodName, 70);
       doc.text(splitName, 5, currentY);
       currentY += splitName.length * 4;
       
       if (d.sku) { doc.text("SKU: " + d.sku, 5, currentY); currentY += 4; }
       if (d.variante) { doc.text("Variante: " + d.variante, 5, currentY); currentY += 4; }
       
       const subtotal = d.qty * d.precio;
       totalGrid += subtotal;
       doc.text(`${d.qty}x ${mxn(d.precio)} = ${mxn(subtotal)}`, 5, currentY);
       currentY += 6;
       
       doc.setLineDashPattern([1, 1], 0);
       doc.line(5, currentY, 75, currentY);
       doc.setLineDashPattern([], 0);
       currentY += 4;
    });

    currentY += 2;
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL: " + mxn(totalGrid), 75, currentY, { align: "right" });
    
    if (h.notas) {
      currentY += 8;
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7);
      const splitNotas = doc.splitTextToSize("Notas: " + h.notas, 70);
      doc.text(splitNotas, 5, currentY);
      currentY += splitNotas.length * 4;
    }

    currentY += 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("¡Gracias por su compra!", 40, currentY, { align: "center" });

    const timestamp = h.fecha ? new Date(h.fecha).getTime() : new Date().getTime();
    doc.save("Ticket_Venta_" + timestamp + ".pdf");
  };

  const logo = new Image();
  logo.crossOrigin = "Anonymous";
  logo.src = 'logo.png';
  logo.onload = () => buildPDF(true, logo);
  logo.onerror = () => buildPDF(false, null);
};

window.descargarTicketListado = function(h_json) {
  const h = JSON.parse(decodeURIComponent(h_json));
  generarTicketPDF(h);
};

function generarTicketPDF(h) {
  if (!window.jspdf) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: [80, 150] });

  const buildPDF = (hasLogo, imgElement) => {
    let currentY = 15;
    if (hasLogo && imgElement) {
      doc.addImage(imgElement, 'PNG', 20, 5, 40, 40);
      currentY = 50;
    } else {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Kromo Pinceles", 40, currentY, { align: "center" });
      currentY += 7;
    }

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("TICKET DE COMPRA", 40, currentY, { align: "center" });
    currentY += 6;
    
    const fechaStr = h.fecha ? new Date(h.fecha).toLocaleString('es-MX') : new Date().toLocaleString('es-MX');
    doc.setFontSize(8);
    doc.text("Fecha: " + fechaStr, 40, currentY, { align: "center" });
    currentY += 4;
    
    doc.line(5, currentY, 75, currentY);
    currentY += 6;

    doc.setFont("helvetica", "bold");
    doc.text("Detalle de la compra:", 5, currentY);
    doc.setFont("helvetica", "normal");
    currentY += 6;
    
    const p = productos.find(x => x.nombre === h.producto_nombre) || {};
    doc.text("SKU: " + (p.sku || 'N/A'), 5, currentY);
    currentY += 6;
    
    const prodName = h.producto_nombre || "Producto desconocido";
    const splitName = doc.splitTextToSize("Producto: " + prodName, 70);
    doc.text(splitName, 5, currentY);
    currentY += splitName.length * 4;
    
    if (h.variante) {
      doc.text("Variante: " + h.variante, 5, currentY);
      currentY += 6;
    }
    
    const qty = h.qty || 1;
    const precio = h.precio || 0;
    doc.text("Cantidad: " + qty, 5, currentY);
    currentY += 6;
    doc.text("Precio Unit: " + mxn(precio), 5, currentY);
    currentY += 6;

    doc.line(5, currentY + 2, 75, currentY + 2);
    currentY += 8;

    const total = qty * precio;
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL: " + mxn(total), 75, currentY, { align: "right" });
    
    if (h.notas) {
      currentY += 8;
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7);
      const splitNotas = doc.splitTextToSize("Notas: " + h.notas, 70);
      doc.text(splitNotas, 5, currentY);
    }

    currentY += 15;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("¡Gracias por su compra!", 40, currentY, { align: "center" });

    const timestamp = h.fecha ? new Date(h.fecha).getTime() : new Date().getTime();
    doc.save("Ticket_Venta_" + timestamp + ".pdf");
  };

  const logo = new Image();
  logo.crossOrigin = "Anonymous";
  logo.src = 'logo.png';
  logo.onload = () => buildPDF(true, logo);
  logo.onerror = () => buildPDF(false, null);
}

async function renderHistorial(){
  const tipo=document.getElementById('h-tipo').value;
  const search=document.getElementById('h-search').value.toLowerCase();
  const query = `/movimientos?skip=${skipMovimientos}&limit=${limitMovimientos}` + (tipo ? `&tipo=${tipo}` : '');
  
  try{
    let items=await req('GET', query);
    if(search) items=items.filter(h=>h.producto_nombre.toLowerCase().includes(search)||(h.notas||'').toLowerCase().includes(search));
    
    const ticketsG = {};
    const finalItems = [];
    
    items.forEach(h=>{
       if (h.tipo === 'venta' && h.notas && h.notas.startsWith('TICKET-')) {
          const tid = h.notas.split(' | ')[0];
          if(!ticketsG[tid]) {
             ticketsG[tid] = { ...h, isGroup: true, detalles: [], totalPrecio: 0, producto_nombre: 'Múltiples Artículos' };
             finalItems.push(ticketsG[tid]);
          }
          ticketsG[tid].detalles.push({ producto_nombre: h.producto_nombre, sku: (productos.find(x=>x.id===h.producto_id)||{}).sku, qty: h.qty, precio: h.precio, variante: h.variante });
          ticketsG[tid].totalPrecio += (h.precio * h.qty);
       } else {
          finalItems.push(h);
       }
    });

    const list=document.getElementById('hist-list');
    list.innerHTML='';
    if(finalItems.length===0){document.getElementById('hist-empty').style.display='block';return;}
    document.getElementById('hist-empty').style.display='none';
    
    finalItems.forEach(h=>{
      const icon=h.tipo==='venta'?'💰':h.tipo==='entrada'?'📦':'🔧';
      const badge=h.tipo==='venta'?'badge-sale':h.tipo==='entrada'?'badge-in':'badge-adj';
      const label=h.tipo==='venta'?'Venta':h.tipo==='entrada'?'Entrada':'Ajuste';
      const fecha=new Date(h.fecha).toLocaleString('es-MX',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
      const div=document.createElement('div');div.className='hist-item';
      
      let p_name = h.isGroup ? `Folio: ${h.notas.split(' | ')[0]} (${h.detalles.length} acts)` : `${h.producto_nombre}${h.variante?' — '+h.variante:''}`;
      let p_val = h.isGroup ? mxn(h.totalPrecio) : (h.precio>0?mxn(h.precio*h.qty):'');
      
      let t_btn = '';
      if (h.tipo === 'venta') {
         if (h.isGroup) {
            t_btn = `<button class="btn btn-sm btn-outline" style="margin-top:5px; font-size:0.7rem; padding: 3px 6px;" onclick="descargarTicketMulti('${encodeURIComponent(JSON.stringify(h))}')">📄 Ticket Múltiple</button>`;
         } else {
            h.detalles = [{ producto_nombre: h.producto_nombre, sku: (productos.find(x=>x.id===h.producto_id)||{}).sku, qty: h.qty, precio: h.precio, variante: h.variante }];
            t_btn = `<button class="btn btn-sm btn-outline" style="margin-top:5px; font-size:0.7rem; padding: 3px 6px;" onclick="descargarTicketMulti('${encodeURIComponent(JSON.stringify(h))}')">📄 Ticket</button>`;
         }
      }
      
      div.innerHTML=`<div class="hist-icon">${icon}</div>
        <div class="hist-info"><strong>${p_name}</strong>
        <small>${h.canal}${h.notas?' · '+h.notas:''}</small></div>
        <div class="hist-meta"><span class="badge ${badge}">${label}</span><br>
        <span style="font-weight:600">${h.tipo==='venta'?'-':'+'}${h.isGroup ? '' : h.qty + ' uds'}</span><br>
        ${p_val}<br>
        <small style="color:#bbb">${fecha}</small><br>
        ${t_btn}
        </div>`;
      list.appendChild(div);
    });
  }catch(e){toast(e.message,false);}
}

async function renderReporte(){
  try{
    const r=await req('GET','/reporte');
    document.getElementById('r-ingresos').textContent=mxn(r.ingresos);
    document.getElementById('r-costo').textContent=mxn(r.costo_vendido);
    document.getElementById('r-ganancia').textContent=mxn(r.ganancia);
    document.getElementById('r-unidades').textContent=r.unidades;
    const tbody=document.getElementById('r-body');tbody.innerHTML='';
    if(r.top_productos.length===0){document.getElementById('r-empty').style.display='block';document.getElementById('r-table').style.display='none';return;}
    document.getElementById('r-empty').style.display='none';document.getElementById('r-table').style.display='';
    r.top_productos.forEach(p=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`<td><strong>${p.nombre}</strong></td><td>${p.qty}</td><td>${mxn(p.ingresos)}</td><td style="color:#16a34a;font-weight:600">${mxn(p.ingresos-p.costo)}</td>`;
      tbody.appendChild(tr);
    });
  }catch(e){toast(e.message,false);}
}

async function showPage(id,btn){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(b=>b.classList.remove('active'));
  document.getElementById('page-'+id).classList.add('active');
  if(btn)btn.classList.add('active');
  if(id==='ventas') await renderVentas();
  if(id==='historial') await renderHistorial();
  if(id==='reporte') await renderReporte();
}

// Exponer globalmente las funciones necesarias en HTML debido al no-módulo momentáneo:
window.showPage = showPage;
window.renderInventario = renderInventario;
window.exportCSV = exportCSV;
window.openModal = openModal;
window.closeModal = closeModal;
window.saveProducto = saveProducto;
window.quickQty = quickQty;
window.editProducto = editProducto;
window.deleteProducto = deleteProducto;
window.openAjuste = openAjuste;
window.saveAjuste = saveAjuste;
window.onProductoVenta = onProductoVenta;
window.registrarVenta = registrarVenta;
window.renderHistorial = renderHistorial;
window.addVariantField = addVariantField;
window.descargarPlantillaCSV = descargarPlantillaCSV;
window.procesarImportacionCSV = procesarImportacionCSV;
window.verificarAsistenteRopa = verificarAsistenteRopa;
window.updateRopaForms = updateRopaForms;
window.aplicarRopa = aplicarRopa;

function verificarAsistenteRopa() {
  const cat = document.getElementById('mp-cat').value.trim();
  const ropaFields = document.getElementById('mp-ropa-fields');
  if (cat.startsWith('Playera') || cat.startsWith('Sudadera')) {
    ropaFields.style.display = 'block';
    if (cat === 'Playera' || cat === 'Sudadera') updateRopaForms(cat);
  } else {
    ropaFields.style.display = 'none';
  }
}

function updateRopaForms(forcePadre) {
  const catInput = document.getElementById('mp-cat').value.trim();
  const padre = forcePadre || (catInput.startsWith('Sudadera') ? 'Sudadera' : 'Playera');

  if (padre === 'Sudadera') {
     document.getElementById('mp-publico').value = 'Adulto';
     document.getElementById('mp-publico').disabled = true;
     document.getElementById('mp-genero').value = 'Unisex';
     document.getElementById('mp-genero').disabled = true;
     document.getElementById('mp-manga').value = 'Manga Larga';
     document.getElementById('mp-manga').disabled = true;
  } else {
     document.getElementById('mp-publico').disabled = false;
     const pub = document.getElementById('mp-publico').value;
     
     if (pub !== 'Adulto') {
       document.getElementById('mp-genero').value = 'Unisex';
       document.getElementById('mp-genero').disabled = true;
     } else {
       document.getElementById('mp-genero').disabled = false;
       if(document.getElementById('mp-genero').value === 'Unisex') {
         document.getElementById('mp-genero').value = 'Caballero';
       }
     }
     document.getElementById('mp-manga').disabled = false;
  }
}

function aplicarRopa(e) {
  if (e) e.preventDefault();
  const catInput = document.getElementById('mp-cat').value.trim();
  const padre = catInput.startsWith('Sudadera') ? 'Sudadera' : 'Playera';
  
  const pub = document.getElementById('mp-publico').value;
  const gen = document.getElementById('mp-genero').value;
  const man = document.getElementById('mp-manga').value;
  const col = document.getElementById('mp-color').value.trim();
  
  let tallas = [];
  if (padre === 'Sudadera') {
    tallas = ['S', 'M', 'L', 'XL', 'XXL'];
  } else if (padre === 'Playera') {
    if (pub === 'Adulto' && gen === 'Caballero') {
       if (man === 'Manga Corta') {
         tallas = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
       } else {
         tallas = ['S', 'M', 'L', 'XL', 'XXL'];
       }
    } else if (pub === 'Adulto' && gen === 'Dama') {
       tallas = ['S', 'M', 'L', 'XL'];
    } else {
       tallas = ['S', 'M', 'L', 'XL'];
    }
  }
  
  const suffix = col ? ` - ${col}` : '';
  document.getElementById('variants-list').innerHTML = '';
  tallas.forEach(t => {
     addVariantField(t + suffix);
  });
  
  let catStr = padre;
  if (padre === 'Playera') {
      catStr += ` › ${pub} › ${gen === 'Unisex' ? 'Unisex' : gen} › ${man}`;
  } else {
      catStr += ` › Unisex`;
  }
  document.getElementById('mp-cat').value = catStr;
  
  const nameInput = document.getElementById('mp-nombre');
  if (!nameInput.value || nameInput.value.startsWith('Playera') || nameInput.value.startsWith('Sudadera')) {
     const nParts = [padre];
     if(padre==='Playera') nParts.push(pub, gen==='Unisex'?'':gen, man);
     if(col) nParts.push(col);
     nameInput.value = nParts.filter(Boolean).join(' ').replace(/\s+/g, ' ');
  }
  
  toast('Tallas aplicadas con éxito', true);
}

function descargarPlantillaCSV() {
  const headers = ['CategoriaPadre', 'Publico', 'Genero', 'Manga', 'Color', 'Nombre', 'SKU', 'Variantes', 'Cantidad', 'StockMin', 'Costo', 'PrecioVenta'];
  const csv = headers.join(',') + '\n"Playera","Adulto","Caballero","Manga Corta","Negro","","SKU-AUTO-1","",10,5,150.00,250.00\n"","","","","","Taza Custom","SKU-TZ-1","Variante Unica",20,5,50.00,100.00\n';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'Plantilla_Inventario.csv';
  a.click();
}

async function procesarImportacionCSV() {
  const fileInput = document.getElementById('csv-file');
  if(!fileInput.files.length) {
    toast('Selecciona un archivo CSV', false);
    return;
  }
  const file = fileInput.files[0];
  
  if (!window.Papa) {
    toast('Error cargando PapaParse', false);
    return;
  }

  toast('Procesando... no cierres la ventana');
  document.getElementById('overlay-importar').classList.remove('active');

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: async function(results) {
      const data = results.data;
      if (data.length === 0) {
        toast('El CSV está vacío', false);
        return;
      }
      
      let creados = 0;
      let actualizados = 0;
      let errores = 0;

      for (const row of data) {
        let nombre = row['Nombre'] ? row['Nombre'].trim() : '';
        const padre = row['CategoriaPadre'] || row['Categoria'] || '';
        const pub = row['Publico'] ? row['Publico'].trim() : '';
        const gen = row['Genero'] ? row['Genero'].trim() : '';
        const man = row['Manga'] ? row['Manga'].trim() : '';
        const col = row['Color'] ? row['Color'].trim() : '';

        if (!nombre && (padre === 'Playera' || padre === 'Sudadera')) {
           const nParts = [padre];
           if(padre==='Playera') nParts.push(pub, gen==='Unisex'?'':gen, man);
           if(col) nParts.push(col);
           nombre = nParts.filter(Boolean).join(' ').replace(/\s+/g, ' ');
        }
        
        if (!nombre) continue;
        
        const sku = row['SKU'] ? row['SKU'].trim() : '';
        const qty = parseInt(row['Cantidad']) || 0;
        
        let p = null;
        if (sku) p = productos.find(x => x.sku === sku);
        if (!p) p = productos.find(x => x.nombre.toLowerCase() === nombre.toLowerCase());

        try {
          if (p) {
            if (qty > 0) {
              await req('PATCH', `/productos/${p.id}/qty?delta=${qty}`);
            }
            actualizados++;
          } else {
            let variantes = row['Variantes'] ? row['Variantes'].split('|').map(v=>v.trim()).filter(Boolean) : [];
            let rCat = padre || 'Otro';
            
            if (variantes.length === 0 && (padre === 'Playera' || padre === 'Sudadera')) {
               let tallas = [];
               if (padre === 'Sudadera') tallas = ['S', 'M', 'L', 'XL', 'XXL'];
               else if (pub === 'Adulto' && gen === 'Caballero') tallas = (man === 'Manga Corta') ? ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'] : ['S', 'M', 'L', 'XL', 'XXL'];
               else if (pub === 'Adulto' && gen === 'Dama') tallas = ['S', 'M', 'L', 'XL'];
               else tallas = ['S', 'M', 'L', 'XL'];
               
               const suffix = col ? ` - ${col}` : '';
               variantes = tallas.map(t => t + suffix);
               
               if (padre === 'Playera') rCat = `${padre} › ${pub} › ${gen === 'Unisex' ? 'Unisex' : gen} › ${man}`;
               else rCat = `${padre} › Unisex`;
            }

            const nuevoData = {
              nombre,
              sku: sku || "",
              categoria: rCat,
              qty,
              min_stock: parseInt(row['StockMin']) || 0,
              costo: parseFloat(row['Costo']) || 0,
              venta: parseFloat(row['PrecioVenta']) || 0,
              variantes: []
            };
            
            if (variantes.length > 0) {
               for (const v of variantes) {
                  const vSku = sku ? sku + '-' + v.split('-')[0].trim().replace(/[^a-zA-Z0-9]/g, '') : '';
                  const vName = nombre + ' - ' + v;
                  await req('POST', '/productos', { ...nuevoData, nombre: vName, sku: vSku });
                  creados++;
               }
            } else {
               await req('POST', '/productos', nuevoData);
               creados++;
            }
          }
        } catch (err) {
          console.error("Error fila:", row, err);
          errores++;
        }
      }
      
      await loadProductos();
      renderInventario();
      renderVentas();
      
      fileInput.value = '';
      const msg = `Completado. Creados: ${creados}, Actualizados: ${actualizados}${errores > 0 ? `, Errores: ${errores}` : ''}`;
      toast(msg, errores === 0);
    },
    error: function(error) {
      toast('Error al leer el CSV: ' + error.message, false);
    }
  });
}

function exportCSV(){
  const headers=['Nombre','SKU','Categoría','Variantes','Cantidad','StockMin','Costo','Venta'];
  const rows=productos.map(p=>[p.nombre,p.sku,p.categoria,(p.variantes||[]).join(' | '),p.qty,p.min_stock,p.costo,p.venta].map(v=>`"${v}"`).join(','));
  const csv=[headers.join(','),...rows].join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='inventario.csv';a.click();
}

['overlay-producto','overlay-ajuste','overlay-importar'].forEach(id=>{
  document.getElementById(id).addEventListener('click',function(e){if(e.target===this)this.classList.remove('active');});
});

// Init
window.addEventListener('DOMContentLoaded', async () => {
  try{
    await req('GET','/health');
    document.getElementById('api-status').textContent='🟢 API conectada';
  }catch(e){
    document.getElementById('api-status').textContent='🔴 API desconectada';
  }
  await loadProductos();
  renderInventario();
  document.getElementById('mp-title').textContent='Agregar Producto';
});
