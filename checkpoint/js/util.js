'use strict';
/* Small helpers shared by every screen. Loaded first. */

const ICONS = {
  home:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
  grid:'<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  classes:'<rect x="7" y="3" width="14" height="14" rx="2"/><path d="M3 7v12a2 2 0 0 0 2 2h12"/><path d="M11 8h6M11 12h6"/>',
  chart:'<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>',
  download:'<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
  upload:'<path d="M12 21V9"/><path d="m7 14 5-5 5 5"/><path d="M5 3h14"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  back:'<path d="m15 18-6-6 6-6"/>',
  chevD:'<path d="m6 9 6 6 6-6"/>', chevU:'<path d="m18 15-6-6-6 6"/>', chevR:'<path d="m9 18 6-6-6-6"/>',
  caret:'<path d="M7 10h10l-5 5z" fill="currentColor" stroke="none"/>',
  caretU:'<path d="M7 14h10l-5-5z" fill="currentColor" stroke="none"/>',
  eye:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  users:'<circle cx="9" cy="8" r="4"/><path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1"/><path d="M16 4.1a4 4 0 0 1 0 7.8M22 21v-1a6 6 0 0 0-4-5.6"/>',
  kebab:'<circle cx="12" cy="5" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="19" r="1.4" fill="currentColor"/>',
  lock:'<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/><path d="M12 15v2"/>',
  unlock:'<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.8-1.3"/>',
  bolt:'<path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="currentColor"/>',
  present:'<rect x="2" y="4" width="20" height="13" rx="1.5"/><path d="M8 21h8"/><path d="m10 8 4.5 2.5L10 13z" fill="currentColor"/>',
  goto:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M16 12H8m3-3-3 3 3 3"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  checkAll:'<path d="m2 12 5 5L17 7"/><path d="m11 16 1 1L22 7"/>',
  pause:'<path d="M8 5v14M16 5v14"/>',
  play:'<path d="M7 4v16l13-8z" fill="currentColor"/>',
  prev:'<path d="m15 18-6-6 6-6"/>', next:'<path d="m9 18 6-6-6-6"/>',
  spin:'<circle cx="12" cy="12" r="2"/><path d="M12 10c0-4 1-7 4-7s2 5-4 7M14 12c4 0 7 1 7 4s-5 2-7-4M12 14c0 4-1 7-4 7s-2-5 4-7M10 12c-4 0-7-1-7-4s5-2 7 4"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  circle:'<circle cx="12" cy="12" r="5"/>',
  ban:'<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
  copy:'<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  trash:'<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/>',
  link:'<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  stop:'<rect x="5" y="5" width="14" height="14" rx="2"/>',
  x:'<path d="M18 6 6 18M6 6l12 12"/>',
  sortAZ:'<path d="M3 17 6 7l3 10M4 14h4"/><path d="M14 7h6l-6 10h6"/>',
  grading:'<path d="M3 6h10M3 12h7M3 18h10"/><path d="m15 14 6 6M21 14l-6 6"/>',
  refresh:'<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  wifi:'<path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r=".9" fill="currentColor"/>',
  globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  mic:'<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/>',
  code:'<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  book:'<path d="M2 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H2zM22 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8z"/>',
  slide:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m10 9 5 3-5 3z"/>',
  text:'<path d="M5 5h14M12 5v15"/>',
  video:'<rect x="2" y="6" width="14" height="12" rx="2"/><path d="m16 10 6-3v10l-6-3"/>',
  pencil:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/>',
  wrap:'<path d="M3 6h18M3 12h15a3 3 0 0 1 0 6h-4"/><path d="m16 16-2 2 2 2"/><path d="M3 18h7"/>',
  radio:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4" fill="currentColor"/>',
  checkbox:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m8 12 3 3 5-6"/>',
  lines:'<path d="M3 9h18M3 15h12"/>',
  tf:'<path d="M3 6h7M6.5 6v12"/><path d="M14 18V6h6M14 12h5"/>',
  sqrt:'<path d="M2 13h3l3 7 4-16h10"/><path d="m15 9 5 6M20 9l-5 6"/>',
  move:'<path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>',
  dragdrop:'<rect x="3" y="3" width="12" height="12" rx="2" stroke-dasharray="3 3"/><rect x="9" y="9" width="12" height="12" rx="2"/>',
  equals:'<path d="M4 9h16M4 15h16"/>',
  clip:'<path d="m21 11-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7"/>',
  fill:'<path d="M4 21h16M7 17 15 6l3 3-8 11H7z"/>',
  table:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
  hotspot:'<rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="3 3"/><path d="m11 11 8 3-3 2-2 3z"/>',
  sparkle:'<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  swap:'<path d="M4 8h15l-3-3M20 16H5l3 3"/>',
  numline:'<path d="M2 12h20"/><circle cx="6" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18" cy="12" r="1.6"/>',
  reseq:'<path d="M3 6h18M3 12h12M3 18h7"/><path d="m16 15 3 3-3 3"/>',
  vresp:'<circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4z"/>',
  hash:'<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>',
};
function icon(name, cls){ return `<svg class="ico ${cls||''}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]||''}</svg>`; }

function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function uid(n){ const a='abcdefghjkmnpqrstuvwxyz23456789'; let s=''; for(let i=0;i<(n||10);i++) s+=a[Math.floor(Math.random()*a.length)]; return s; }
function joinCode(){ const a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s=''; for(let i=0;i<6;i++) s+=a[Math.floor(Math.random()*a.length)]; return s; }
function debounce(fn, ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }
function timeAgo(ts){
  if(!ts) return 'never';
  const s=Math.max(0,(Date.now()-ts)/1000);
  if(s<45) return 'just now';
  if(s<90) return '1 minute ago';
  const m=s/60; if(m<45) return Math.round(m)+' minutes ago';
  const h=m/60; if(h<1.5) return 'about 1 hour ago'; if(h<22) return 'about '+Math.round(h)+' hours ago';
  const d=h/24; if(d<1.5) return '1 day ago'; return Math.round(d)+' days ago';
}
function initials(name){ const p=String(name||'?').trim().split(/\s+/); return ((p[0]||'?')[0]+(p.length>1?p[p.length-1][0]:'')).toUpperCase(); }
const AVATAR_COLORS=['#4F7DC9','#D9822B','#3D9A6A','#8A5CC2','#C2475C','#2F8C9E','#7A6A3A','#5D6B82'];
function avatar(name, size){
  let h=0; for(const c of String(name)) h=(h*31+c.charCodeAt(0))>>>0;
  const sz=size?`;width:${size}px;height:${size}px;font-size:${Math.round(size*.38)}px`:'';
  return `<span class="avatar" style="background:${AVATAR_COLORS[h%AVATAR_COLORS.length]}${sz}">${esc(initials(name))}</span>`;
}
function pctClass(p){ return p==null?'':p<60?'lo':p<80?'mid':'hi'; }

let toastTimer;
function toast(msg){
  let t=document.querySelector('.toast');
  if(!t){ t=document.createElement('div'); t.className='toast'; t.setAttribute('role','status'); document.body.appendChild(t); }
  t.textContent=msg; t.hidden=false;
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>{ t.hidden=true; }, 2600);
}
async function copyText(text, what){
  try{ await navigator.clipboard.writeText(text); toast((what||'Link')+' copied'); }
  catch(e){ window.prompt('Copy this:', text); }
}
function downloadFile(name, text, type){
  const blob=new Blob([text], {type:type||'text/plain'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
}
function toCSV(rows){
  return rows.map(r=>r.map(v=>{
    const s=v==null?'':String(v);
    return /[",\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
  }).join(',')).join('\r\n');
}
function fileSafe(s){ return String(s).replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'-')||'export'; }

/* Popover menu anchored to a button. items: {icon,label,onClick} | '-' | {header} */
let openMenu=null;
function closeMenu(){ if(openMenu){ openMenu.el.remove(); openMenu.anchor.setAttribute('aria-expanded','false'); openMenu=null; } }
function showMenu(anchor, items){
  const same=openMenu&&openMenu.anchor===anchor;
  closeMenu(); if(same) return;
  const el=document.createElement('div'); el.className='menu'; el.setAttribute('role','menu');
  items.forEach(it=>{
    if(it==='-'){ el.appendChild(document.createElement('hr')); return; }
    if(it.header){ const h=document.createElement('div'); h.className='mh'; h.textContent=it.header; el.appendChild(h); return; }
    const b=document.createElement('button'); b.type='button'; b.setAttribute('role','menuitem');
    b.innerHTML=(it.icon?icon(it.icon):'')+'<span>'+esc(it.label)+'</span>';
    b.addEventListener('click', e=>{ e.stopPropagation(); closeMenu(); it.onClick(); });
    el.appendChild(b);
  });
  document.body.appendChild(el);
  const r=anchor.getBoundingClientRect(), w=el.offsetWidth, hgt=el.offsetHeight;
  let left=Math.min(r.left, window.innerWidth-w-8), top=r.bottom+6;
  if(top+hgt>window.innerHeight-8) top=Math.max(8, r.top-hgt-6);
  el.style.left=Math.max(8,left)+'px'; el.style.top=top+'px';
  anchor.setAttribute('aria-expanded','true');
  openMenu={el, anchor};
  const first=el.querySelector('button'); if(first) first.focus({preventScroll:true});
}
document.addEventListener('click', e=>{ if(openMenu&&!openMenu.el.contains(e.target)&&!openMenu.anchor.contains(e.target)) closeMenu(); });
document.addEventListener('keydown', e=>{ if(e.key==='Escape'){ if(openMenu){ const a=openMenu.anchor; closeMenu(); a.focus(); } else closeModal(); } });
window.addEventListener('resize', closeMenu);
window.addEventListener('scroll', closeMenu, true);

/* Modal dialog. body: html string. actions: [{label, cls, onClick(modalEl) -> return false to keep open}] */
function closeModal(){ const m=document.querySelector('.modal-back'); if(m) m.remove(); }
function showModal(opts){
  closeModal();
  const back=document.createElement('div'); back.className='modal-back';
  back.innerHTML=`<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(opts.title)}"><h2>${esc(opts.title)}</h2><div class="mbody">${opts.body||''}</div><div class="actions"></div></div>`;
  const acts=back.querySelector('.actions');
  (opts.actions||[{label:'Close', cls:'ghost'}]).forEach(a=>{
    const b=document.createElement('button'); b.type='button'; b.className='btn '+(a.cls||''); b.textContent=a.label;
    b.addEventListener('click', ()=>{ if(a.onClick&&a.onClick(back)===false) return; closeModal(); });
    acts.appendChild(b);
  });
  back.addEventListener('mousedown', e=>{ if(e.target===back) closeModal(); });
  document.body.appendChild(back);
  const f=back.querySelector('input,textarea,select')||acts.lastElementChild; if(f) f.focus();
  if(opts.onOpen) opts.onOpen(back);
  return back;
}
