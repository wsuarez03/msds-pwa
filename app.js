/***********************************************
 * MSDS PWA - app.js
 * - IndexDB caching (IndexedDB) para PDFs
 * - loadCatalog() con fallback a cache
 * - Subida a GitHub (Admin token ingresado en UI)
 ***********************************************/

/* ========== CONFIG (editar GITHUB_OWNER y GITHUB_REPO) ========== */
const GITHUB_OWNER = "wsuarez03";      // <-- cambia por tu usuario/organización
const GITHUB_REPO = "msds-pwa";        // <-- cambia por el nombre de tu repo
const GITHUB_BRANCH = "main";          // <-- branch (main o master)
/* Nota: NO pongas el token aquí. Usa "Admin (Ingresar token)" en la UI. */

/* ---------------- IndexedDB simple ---------------- */
const DB_NAME='msds-db', DB_VER=1, STORE_DOCS='docs';
function openDB(){ return new Promise((res,rej)=>{
  const r = indexedDB.open(DB_NAME, DB_VER);
  r.onupgradeneeded = e => {
    const db = e.target.result;
    if(!db.objectStoreNames.contains(STORE_DOCS)){
      db.createObjectStore(STORE_DOCS, {keyPath:'id'});
    }
  };
  r.onsuccess = ()=> res(r.result);
  r.onerror = ()=> rej(r.error);
});}
async function putDoc(doc){ const db=await openDB(); return new Promise((r,j)=>{
  const tx=db.transaction(STORE_DOCS,'readwrite'); tx.objectStore(STORE_DOCS).put(doc);
  tx.oncomplete = ()=> r(true); tx.onerror = ()=> j(tx.error);
});}
async function getDoc(id){ const db=await openDB(); return new Promise((r,j)=>{
  const tx=db.transaction(STORE_DOCS,'readonly'); const req=tx.objectStore(STORE_DOCS).get(id);
  req.onsuccess = ()=> r(req.result); req.onerror = ()=> j(req.error);
});}
async function getAllDocs(){ const db=await openDB(); return new Promise((r,j)=>{
  const tx=db.transaction(STORE_DOCS,'readonly'); const req=tx.objectStore(STORE_DOCS).getAll();
  req.onsuccess = ()=> r(req.result); req.onerror = ()=> j(req.error);
});}

/* -------------- util arrayBuffer -> base64 ------------- */
function arrayBufferToBase64(buffer){
  // safe for large buffers
  const chunkSize = 0x8000;
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

/* ------------------ Catalog loader (remote || cached) ------------------ */
let catalog = [], catalogById = {};
async function loadCatalog(){
  try {
    const res = await fetch('catalog.json', {cache:'no-store'});
    if(!res.ok) throw new Error(`catalog.json not found (status ${res.status})`);
    catalog = await res.json();
    catalogById = {}; for(const e of catalog) catalogById[e.id]=e;
    // save lightweight copy locally for offline fallback
    await putDoc({ id:'_catalog', blob:null, meta:{catalog, updatedAt: new Date().toISOString()} });
    return catalog;
  } catch (err) {
    console.warn('loadCatalog: remote failed, trying local cache...', err);
    // fallback to local cached catalog in IndexedDB
    try {
      const local = await getDoc('_catalog');
      if(local && local.meta && local.meta.catalog){
        catalog = local.meta.catalog;
        catalogById = {}; for(const e of catalog) catalogById[e.id]=e;
        return catalog;
      }
    } catch(e){ console.warn('loadCatalog: local cache read failed', e); }
    catalog = []; catalogById = {};
    return [];
  }
}

/* -------------------- UI: render list -------------------- */
const listEl = document.getElementById('list');
const searchEl = document.getElementById('search');
async function renderList(){
  try {
    listEl.innerHTML = 'Cargando...';
    const arr = await loadCatalog();
    const q = (searchEl.value||'').toLowerCase();
    const filtered = arr.filter(i => !q || i.name.toLowerCase().includes(q));
    if(!filtered.length){ listEl.innerHTML = '<i>No hay documentos</i>'; return; }
    listEl.innerHTML = '';
    for(const it of filtered){
      const item = document.createElement('div'); item.className='item';
      const left = document.createElement('div'); left.className='left';
      left.innerHTML = `<strong>${it.name}</strong> · v${it.version} · ${new Date(it.date).toLocaleDateString()}`;
      const right = document.createElement('div'); right.className='right';
      const btnOpen = document.createElement('button'); btnOpen.textContent='Abrir';
      const btnQR = document.createElement('button'); btnQR.textContent='QR';
      right.appendChild(btnOpen); right.appendChild(btnQR);
      item.appendChild(left); item.appendChild(right); listEl.appendChild(item);

      btnOpen.addEventListener('click', ()=> openDocById(it.id));
      btnQR.addEventListener('click', ()=> openQRWindow(it.id, it.name));
    }
  } catch(e){
    console.error('renderList error', e);
    listEl.innerHTML = '<i>Error cargando lista. Revisa consola.</i>';
  }
}

/* ---------------- open document (local or fetch and cache) ---------------- */
const viewer = document.getElementById('viewer');
const vtitle = document.getElementById('v-title');
const vmeta = document.getElementById('v-meta');
const vpdf = document.getElementById('v-pdf');
const btnClose = document.getElementById('btn-close');
const btnDownload = document.getElementById('btn-download');

async function openDocById(id){
  viewer.style.display='block';
  vpdf.innerHTML = 'Cargando...';
  try {
    const local = await getDoc(id);
    if(local && local.blob){
      displayPDF(local.blob, local.name || (catalogById[id] && catalogById[id].name));
      return;
    }
    const entry = catalogById[id];
    if(!entry){ vpdf.innerHTML = 'Documento no encontrado'; return; }
    const res = await fetch(`pdfs/${entry.filename}`);
    if(!res.ok) throw new Error(`No se pudo descargar PDF (status ${res.status})`);
    const blob = await res.blob();
    await putDoc({ id: entry.id, name: entry.name, blob, date: entry.date, version: entry.version });
    displayPDF(blob, entry.name);
  } catch(err){
    console.error('openDocById error', err);
    vpdf.innerHTML = 'No fue posible descargar el PDF. Conéctate a internet e intenta de nuevo.';
  }
}

function displayPDF(blob, title){
  vtitle.textContent = title || 'Ficha';
  vmeta.textContent = '';
  vpdf.innerHTML = '';
  const url = URL.createObjectURL(blob);
  const emb = document.createElement('embed');
  emb.type='application/pdf';
  emb.src = url;
  emb.width='100%';
  emb.height='600px';
  vpdf.appendChild(emb);
  btnDownload.onclick = ()=> {
    const a = document.createElement('a'); a.href = url; a.download = (title || 'doc') + '.pdf';
    document.body.appendChild(a); a.click(); a.remove();
  };
}

btnClose.addEventListener('click', ()=> { viewer.style.display='none'; vpdf.innerHTML=''; });

/* ---------------- QR generator ---------------- */
function openQRWindow(id, name){
  const payload = location.origin + location.pathname + '#/doc/' + id;
  const w = window.open('', '_blank', 'width=420,height=520');
  w.document.title = 'QR - ' + (name||id);
  w.document.body.style.fontFamily='system-ui,Segoe UI,Roboto';
  w.document.body.style.padding='12px';
  w.document.body.innerHTML = `<h3>${name || id}</h3><div id="qr"></div><p>URL: <small>${payload}</small></p>`;
  QRCode.toDataURL(payload, {width:360}).then(url=>{
    const d = w.document.getElementById('qr');
    const img = w.document.createElement('img'); img.src = url; img.width=360;
    d.appendChild(img);
    const dl = w.document.createElement('a'); dl.href = url; dl.download = id + '-qr.png'; dl.textContent='Descargar QR';
    dl.style.display='block'; dl.style.marginTop='8px'; d.appendChild(dl);
  });
}

/* ---------------- Router: open by hash #/doc/<id> ---------------- */
async function handleRoute(){
  const hash = location.hash || '';
  if(hash.startsWith('#/doc/')){
    const id = hash.split('/')[2];
    await loadCatalog();
    openDocById(id);
  } else {
    viewer.style.display='none';
  }
}
window.addEventListener('hashchange', handleRoute);

/* ---------------- Expiry check (5 años) ---------------- */
async function checkExpirations(){
  try{
    const docs = (await getAllDocs()).filter(d => d.id && d.id !== '_catalog');
    const now = new Date();
    for(const d of docs){
      const base = d.date ? new Date(d.date) : (d.createdAt ? new Date(d.createdAt) : null);
      if(!base) continue;
      const expiry = new Date(base.getTime() + 5*365*24*60*60*1000);
      const daysLeft = Math.ceil((expiry - now) / (1000*60*60*24));
      if(daysLeft <= 0) notifyLocal(`Documento "${d.name}" ha vencido (${base.toLocaleDateString()})`);
      else if(daysLeft <= 30) notifyLocal(`Documento "${d.name}" vence en ${daysLeft} días`);
    }
  }catch(e){ console.warn('checkExpirations error', e); }
}
async function notifyLocal(msg){
  if(!("Notification" in window)) return;
  if(Notification.permission === 'granted') new Notification('MSDS', {body: msg});
  else if(Notification.permission !== 'denied'){
    const p = await Notification.requestPermission();
    if(p==='granted') new Notification('MSDS', {body: msg});
  }
}

/* ---------------- Admin: token (session only) ---------------- */
let adminToken = null;
document.getElementById('btnAdminLogin').addEventListener('click', async ()=>{
  const t = prompt('Pega tu GitHub Personal Access Token (no se guarda en el repo):\n- permiso recomendado: public_repo si repo público, o repo si privado');
  if(t){ adminToken = t.trim(); sessionStorage.setItem('msds_admin_token_present','1'); alert('Token guardado en sesión.'); }
});

/* ---------------- Upload form handler ---------------- */
document.getElementById('uploadForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  if(!adminToken){ alert('Debes ingresar el token con "Admin (Ingresar token)" antes de subir.'); return; }
  const file = document.getElementById('pdfFile').files[0];
  const name = document.getElementById('pdfName').value.trim();
  const version = document.getElementById('pdfVersion').value.trim();
  const dateInput = document.getElementById('pdfDate').value;
  const date = dateInput ? new Date(dateInput).toISOString() : new Date().toISOString();
  if(!file || !name || !version){ alert('Completa todos los campos.'); return; }
  const metadata = { id: crypto.randomUUID(), name, filename: file.name, date, version };
  try {
    await uploadToGitHub(file, metadata, adminToken);
    await loadCatalog(); await renderList();
    alert('Subida completada ✔️');
  } catch(err){
    console.error('upload error', err);
    alert('Error durante la subida: ' + (err.message || err));
  }
});

/* ---------------- GitHub content API helpers & upload ---------------- */
async function apiGetContent(path, token){
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;
  const res = await fetch(url, { headers: { Authorization: `token ${token}` } });
  if(res.status === 404) return null;
  if(!res.ok) throw new Error(`GET content failed: ${res.status} ${res.statusText}`);
  return await res.json();
}

async function uploadToGitHub(file, metadata, token){
  // 1) Subir/actualizar PDF en repo (pdfs/<filename>)
  const pathPdf = `pdfs/${file.name}`;
  const existingPdf = await apiGetContent(pathPdf, token); // null o objeto
  const arrBuf = await file.arrayBuffer();
  const base64Pdf = arrayBufferToBase64(arrBuf);
  const putPdfBody = {
    message: existingPdf ? `Update ${file.name}` : `Add ${file.name}`,
    content: base64Pdf,
    branch: GITHUB_BRANCH
  };
  if(existingPdf && existingPdf.sha) putPdfBody.sha = existingPdf.sha;
  const putPdfRes = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${pathPdf}`, {
    method:'PUT', headers:{ Authorization:`token ${token}`, 'Content-Type':'application/json' }, body: JSON.stringify(putPdfBody)
  });
  if(!putPdfRes.ok){
    const txt = await putPdfRes.text();
    throw new Error('Error subiendo PDF: ' + putPdfRes.status + ' ' + txt);
  }

  // 2) Obtener catalog.json
  const catalogRes = await apiGetContent('catalog.json', token);
  if(!catalogRes) throw new Error('catalog.json no encontrado en el repo. Debe existir en la raíz.');
  const catalogArr = JSON.parse(atob(catalogRes.content));

  // 3) Añadir o actualizar metadata
  const existingIndex = catalogArr.findIndex(x => x.filename === metadata.filename);
  if(existingIndex >= 0) catalogArr[existingIndex] = {...catalogArr[existingIndex], ...metadata};
  else catalogArr.push(metadata);

  // 4) Subir catalog.json actualizado
  const newCatalogBase64 = btoa(JSON.stringify(catalogArr, null, 2));
  const putCatalogBody = { message: `Update catalog.json (${metadata.filename})`, content: newCatalogBase64, branch: GITHUB_BRANCH, sha: catalogRes.sha };
  const putCatRes = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/catalog.json`, {
    method:'PUT', headers:{ Authorization:`token ${token}`, 'Content-Type':'application/json' }, body: JSON.stringify(putCatalogBody)
  });
  if(!putCatRes.ok){
    const txt = await putCatRes.text();
    throw new Error('Error actualizando catalog.json: ' + putCatRes.status + ' ' + txt);
  }

  // 5) guardar copia local en IndexedDB
  await putDoc({ id: metadata.id, name: metadata.name, blob: new Blob([arrBuf], {type:'application/pdf'}), date: metadata.date, version: metadata.version });
  await putDoc({ id:'_catalog', blob:null, meta:{catalog: catalogArr, updatedAt: new Date().toISOString()} });
}

/* ---------------- Install PWA prompt ---------------- */
let deferredPrompt;
const btnInstall = document.getElementById('btnInstall');
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; btnInstall.style.display='inline-block'; });
btnInstall.addEventListener('click', async ()=> { if(!deferredPrompt) return; deferredPrompt.prompt(); const choice = await deferredPrompt.userChoice; deferredPrompt = null; btnInstall.style.display='none'; });

/* ---------------- Init ---------------- */
window.addEventListener('load', async ()=> {
  // service worker
  if('serviceWorker' in navigator){
    try { await navigator.serviceWorker.register('sw.js'); console.log('SW registrado'); } catch(e){ console.warn('SW no registrado', e); }
  }
  await loadCatalog(); await renderList();
  searchEl.addEventListener('input', renderList);
  setInterval(checkExpirations, 1000*60*60*12);
  handleRoute();
});
