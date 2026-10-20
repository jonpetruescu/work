'use strict';
/*
  Math text. Stored as plain text where $$...$$ marks LaTeX, e.g. "Solve $$2x+3=11$$".
  - MathText.html(s): render for display (KaTeX if loaded, monospace TeX otherwise).
  - MathText.editor(value, opts): a text box where typing $$...$$ turns into rendered math
    the moment the closing $$ is typed. Click a formula to edit its TeX again.
*/
const MathText = (() => {
  const RE = /\$\$([\s\S]+?)\$\$/g;
  const ZW = '\u200B', OBJ = '\uFFFC';

  function tex(src){
    src = String(src).trim();
    if(window.katex){
      try{ return katex.renderToString(src, { throwOnError: false, displayMode: false, output: 'html', strict: 'ignore' }); }
      catch(e){ /* fall through */ }
    }
    return `<span class="mathraw">${esc(src)}</span>`;
  }
  function html(s){
    s = String(s == null ? '' : s); let out = '', last = 0;
    s.replace(RE, (m, t, i) => { out += esc(s.slice(last, i)); out += tex(t); last = i + m.length; return m; });
    return out + esc(s.slice(last));
  }
  /* For CSV cells: keep the TeX readable without the delimiters. */
  function plain(s){ return String(s == null ? '' : s).replace(RE, (m, t) => t.trim()); }

  /* ---------- editor internals ---------- */
  function chip(t){
    const c = document.createElement('span');
    c.className = 'mathchip'; c.contentEditable = 'false'; c.dataset.tex = t;
    c.title = 'Click to edit'; c.innerHTML = tex(t);
    return c;
  }
  function build(el, s){
    el.textContent = '';
    const frag = document.createDocumentFragment();
    const addText = t => t.split('\n').forEach((line, i) => {
      if(i) frag.appendChild(document.createElement('br'));
      if(line) frag.appendChild(document.createTextNode(line));
    });
    let last = 0;
    s.replace(RE, (m, t, i) => {
      addText(s.slice(last, i));
      if(!(frag.lastChild && frag.lastChild.nodeType === 3)) frag.appendChild(document.createTextNode(ZW));
      frag.appendChild(chip(t));
      last = i + m.length; return m;
    });
    addText(s.slice(last));
    // Keep a text node beside every formula so the caret can always sit next to it.
    [...frag.childNodes].forEach(n => {
      if(n.classList && n.classList.contains('mathchip') && !(n.nextSibling && n.nextSibling.nodeType === 3))
        n.after(document.createTextNode(ZW));
    });
    if(s.endsWith('\n')) frag.appendChild(document.createElement('br'));
    el.appendChild(frag);
  }
  /* mode 'full': formulas count as $$tex$$. mode 'flat': formulas count as one placeholder char. */
  function ser(root, mode, raw){
    let s = '';
    const walk = n => n.childNodes.forEach(c => {
      if(c.nodeType === 3) s += c.nodeValue.split(ZW).join('');
      else if(c.nodeType === 1){
        if(c.classList.contains('mathchip')) s += mode === 'flat' ? OBJ : '$$' + c.dataset.tex + '$$';
        else if(c.tagName === 'BR') s += '\n';
        else { if((c.tagName === 'DIV' || c.tagName === 'P') && s && !s.endsWith('\n')) s += '\n'; walk(c); }
      }
    });
    walk(root);
    return raw ? s : s.replace(/\n$/, '');
  }
  function caretOffset(root, mode){
    const sel = getSelection(); if(!sel.rangeCount) return -1;
    const r = sel.getRangeAt(0); if(!root.contains(r.endContainer)) return -1;
    const pre = document.createRange(); pre.selectNodeContents(root); pre.setEnd(r.endContainer, r.endOffset);
    const tmp = document.createElement('div'); tmp.appendChild(pre.cloneContents());
    return ser(tmp, mode, true).length;
  }
  function posIn(text, logical){
    let real = 0, l = 0;
    while(real < text.length && l < logical){ if(text[real] !== ZW) l++; real++; }
    while(real < text.length && text[real] === ZW) real++;
    return real;
  }
  function setCaret(root, off){
    let acc = 0, placed = false; const range = document.createRange();
    const walk = n => { for(const c of [...n.childNodes]){
      if(placed) return;
      if(c.nodeType === 3){
        const L = c.nodeValue.split(ZW).join('').length;
        if(acc + L >= off){ range.setStart(c, posIn(c.nodeValue, off - acc)); placed = true; return; }
        acc += L;
      } else if(c.classList && c.classList.contains('mathchip')){
        acc += c.dataset.tex.length + 4;
        if(acc >= off){
          const nx = c.nextSibling;
          if(nx && nx.nodeType === 3) range.setStart(nx, posIn(nx.nodeValue, 0)); else range.setStartAfter(c);
          placed = true; return;
        }
      } else if(c.tagName === 'BR'){
        acc += 1; if(acc >= off){ range.setStartAfter(c); placed = true; return; }
      } else walk(c);
    }};
    walk(root);
    if(!placed){ range.selectNodeContents(root); range.collapse(false); }
    range.collapse(true);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
  }
  function convert(el, force){
    const flat = ser(el, 'flat', true);
    const re = /\$\$([^\uFFFC\n]+?)\$\$/g; let m, any = false;
    const caret = force ? -1 : caretOffset(el, 'flat');
    while((m = re.exec(flat))){
      if(caret > m.index && caret < m.index + m[0].length) return false; // still typing inside it
      any = true;
    }
    if(!any) return false;
    const full = force ? -1 : caretOffset(el, 'full');
    build(el, ser(el, 'full'));
    if(full >= 0) setCaret(el, full);
    return true;
  }
  function expand(el, c){
    const pre = document.createRange(); pre.selectNodeContents(el); pre.setEndBefore(c);
    const tmp = document.createElement('div'); tmp.appendChild(pre.cloneContents());
    const off = ser(tmp, 'full', true).length;
    const t = c.dataset.tex;
    c.replaceWith(document.createTextNode('$$' + t + '$$'));
    el.normalize();
    el.focus(); setCaret(el, off + 2 + t.length);
  }

  let pop = null;
  function hidePreview(){ if(pop){ pop.remove(); pop = null; } }
  function preview(el){
    const flat = ser(el, 'flat', true), caret = caretOffset(el, 'flat');
    if(caret < 0){ hidePreview(); return; }
    const segStart = Math.max(flat.lastIndexOf('\n', caret - 1), flat.lastIndexOf(OBJ, caret - 1)) + 1;
    const before = flat.slice(segStart, caret);
    const opens = (before.match(/\$\$/g) || []).length;
    if(opens % 2 === 0){ hidePreview(); return; }
    const from = segStart + before.lastIndexOf('$$') + 2;
    const close = flat.indexOf('$$', caret);
    const lineEnd = [flat.indexOf('\n', caret), flat.indexOf(OBJ, caret)].filter(i => i >= 0);
    const stop = Math.min(close >= 0 ? close : Infinity, ...lineEnd, flat.length);
    const src = flat.slice(from, stop);
    if(!pop || !pop.isConnected){ pop = document.createElement('div'); pop.className = 'mathpop'; pop.setAttribute('aria-live', 'polite'); document.body.appendChild(pop); }
    pop.innerHTML = `<div class="lbl">Math preview</div><div>${src.trim() ? tex(src) : '<span class="faint">Type LaTeX, e.g. \\frac{1}{2}</span>'}</div>`
      + `<div class="hint">${close >= 0 ? 'Click outside the formula to finish' : 'Type <code>$$</code> to finish'}</div>`;
    const sel = getSelection(); let rect = sel.rangeCount ? sel.getRangeAt(0).getBoundingClientRect() : null;
    if(!rect || (!rect.width && !rect.height && !rect.left)) rect = el.getBoundingClientRect();
    const top = rect.bottom + 8 + pop.offsetHeight > window.innerHeight ? rect.top - pop.offsetHeight - 8 : rect.bottom + 8;
    pop.style.top = Math.max(8, top) + 'px';
    pop.style.left = Math.max(8, Math.min(rect.left - 12, window.innerWidth - pop.offsetWidth - 8)) + 'px';
  }
  function insertText(t){
    if(!document.execCommand('insertText', false, t)){
      const sel = getSelection(); if(!sel.rangeCount) return;
      const r = sel.getRangeAt(0); r.deleteContents(); const n = document.createTextNode(t); r.insertNode(n);
      r.setStartAfter(n); r.collapse(true); sel.removeAllRanges(); sel.addRange(r);
    }
  }

  function editor(value, opts){
    opts = opts || {};
    const el = document.createElement('div');
    el.className = 'rte' + (opts.oneLine ? ' one' : '');
    el.contentEditable = 'true';
    el.setAttribute('role', 'textbox');
    if(!opts.oneLine) el.setAttribute('aria-multiline', 'true');
    if(opts.label) el.setAttribute('aria-label', opts.label);
    if(opts.placeholder) el.dataset.placeholder = opts.placeholder;
    build(el, String(value || ''));
    let last = ser(el, 'full');
    const emit = () => { const v = ser(el, 'full'); if(v !== last){ last = v; if(opts.onChange) opts.onChange(v); } };
    el.addEventListener('input', () => {
      convert(el);
      if(!ser(el, 'full', true).replace(/\n/g, '')) el.textContent = ''; // let the placeholder show
      emit(); preview(el);
    });
    el.addEventListener('keydown', e => {
      if(e.key === 'Enter'){
        e.preventDefault();
        if(opts.oneLine){ if(opts.onEnter) opts.onEnter(); return; }
        if(!document.execCommand('insertLineBreak')) insertText('\n');
      }
    });
    el.addEventListener('keyup', e => { if(e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End'){ if(convert(el)) emit(); preview(el); } });
    el.addEventListener('mouseup', () => setTimeout(() => preview(el)));
    el.addEventListener('paste', e => {
      e.preventDefault();
      let t = (e.clipboardData || window.clipboardData).getData('text/plain');
      if(opts.oneLine) t = t.replace(/\s*\n\s*/g, ' ');
      insertText(t);
    });
    el.addEventListener('click', e => { const c = e.target.closest('.mathchip'); if(c && el.contains(c)){ expand(el, c); preview(el); } });
    el.addEventListener('focus', () => preview(el));
    el.addEventListener('blur', () => { if(convert(el, true)) emit(); hidePreview(); });
    el.getValue = () => ser(el, 'full');
    return el;
  }

  return { html, plain, editor, tex };
})();
