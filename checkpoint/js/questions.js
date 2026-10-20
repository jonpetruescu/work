'use strict';
/*
  Question types. Each built type defines:
    make()               new blank item
    edit(q, changed)     teacher editor (below the prompt); mutate q, then call changed()
    view(q, v, set, ro)  student answer UI; set(value) saves an answer; ro = read-only
    grade(q, v)          1 / 0 / fraction, or null when a teacher has to grade it
    text(q, v)           the answer as text (may contain $$math$$)
  Types marked `planned` show in the Add menu with the phase they're scheduled for.
*/
const QTypes = (() => {
  const opt = t => ({ id: uid(6), text: t || '' });
  const blank = v => v == null || v === '' || (Array.isArray(v) && !v.length);
  const norm = s => String(s == null ? '' : s).trim().toLowerCase().replace(/\$\$/g, '').replace(/\s+/g, '');
  const el = (tag, cls, htmlStr) => { const e = document.createElement(tag); if(cls) e.className = cls; if(htmlStr != null) e.innerHTML = htmlStr; return e; };
  const letter = i => String.fromCharCode(65 + i);
  function num(s){
    s = String(s == null ? '' : s).trim().replace(/,/g, '').replace(/\s+/g, '');
    const f = s.match(/^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/);
    if(f) return Number(f[2]) ? Number(f[1]) / Number(f[2]) : NaN;
    return s === '' ? NaN : Number(s);
  }

  function choiceEditor(q, changed, multi){
    const box = el('div');
    const draw = focusLast => {
      box.innerHTML = '';
      q.options.forEach((o, i) => {
        const row = el('div', 'opt');
        const right = multi ? q.correct.includes(o.id) : q.correct === o.id;
        const mark = el('button', 'mark' + (multi ? ' sq' : ''), icon('check', 'sm'));
        mark.type = 'button'; mark.setAttribute('aria-pressed', right);
        mark.setAttribute('aria-label', `Mark choice ${letter(i)} as correct`); mark.title = 'Mark as correct';
        mark.onclick = () => {
          if(multi) q.correct = right ? q.correct.filter(x => x !== o.id) : q.correct.concat(o.id);
          else q.correct = right ? null : o.id;
          changed(); draw();
        };
        const ed = MathText.editor(o.text, { oneLine: true, placeholder: 'Choice ' + letter(i), label: 'Choice ' + letter(i),
          onChange: v => { o.text = v; changed(); },
          onEnter: () => { const nx = box.querySelectorAll('.rte')[i + 1]; if(nx) nx.focus(); } });
        const del = el('button', 'ibtn sm', icon('trash', 'sm'));
        del.type = 'button'; del.setAttribute('aria-label', 'Remove choice ' + letter(i)); del.disabled = q.options.length <= 2;
        del.onclick = () => {
          q.options.splice(i, 1);
          if(multi) q.correct = q.correct.filter(x => x !== o.id); else if(q.correct === o.id) q.correct = null;
          changed(); draw();
        };
        row.append(mark, ed, del); box.appendChild(row);
      });
      const add = el('button', 'linkbtn', icon('plus', 'sm') + 'Add choice');
      add.type = 'button'; add.style.marginTop = '10px';
      add.onclick = () => { q.options.push(opt()); changed(); draw(true); };
      box.appendChild(add);
      const none = multi ? !q.correct.length : !q.correct;
      box.appendChild(el('div', 'hint', none
        ? `<b>No correct answer marked</b>, so this is graded by hand. Click a circle to mark the right ${multi ? 'answers' : 'answer'}.`
        : `${multi ? 'Students must pick every checked choice and nothing else.' : 'Students see the choices in this order.'}`));
      if(focusLast){ const eds = box.querySelectorAll('.rte'); eds[eds.length - 1].focus(); }
    };
    draw(); return box;
  }
  function choiceView(q, v, set, ro, multi){
    const box = el('div', 'choices');
    const picked = () => multi ? (Array.isArray(v) ? v : []) : v;
    q.options.forEach((o, i) => {
      const b = el('button', 'choice' + (multi ? ' sq' : ''), `<span class="key">${letter(i)}</span><span>${MathText.html(o.text)}</span>`);
      b.type = 'button'; b.disabled = ro;
      const on = () => multi ? picked().includes(o.id) : picked() === o.id;
      b.setAttribute('aria-pressed', on());
      b.onclick = () => {
        if(multi){ const cur = picked(); v = on() ? cur.filter(x => x !== o.id) : cur.concat(o.id); }
        else v = o.id;
        box.querySelectorAll('.choice').forEach((x, j) => x.setAttribute('aria-pressed', multi ? v.includes(q.options[j].id) : v === q.options[j].id));
        set(v);
      };
      box.appendChild(b);
    });
    return box;
  }
  function urlField(q, changed, label, ph, after){
    const w = el('div');
    w.innerHTML = `<label class="field">${esc(label)}</label><input class="input" type="url" placeholder="${esc(ph)}" value="${esc(q.url || '')}">`;
    const inp = w.querySelector('input'), prev = el('div'); prev.style.marginTop = '12px';
    const draw = () => { prev.innerHTML = ''; if(q.url) prev.appendChild(T[q.type].media(q)); };
    inp.addEventListener('input', debounce(() => { q.url = inp.value.trim(); changed(); draw(); }, 400));
    if(after) after(w, draw);
    w.appendChild(prev); draw(); return w;
  }
  function ytId(u){
    const m = String(u).match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
    return m ? m[1] : null;
  }
  function shrinkImage(file){
    return new Promise((ok, bad) => {
      const img = new Image(), fr = new FileReader();
      fr.onload = () => { img.src = fr.result; };
      fr.onerror = bad;
      img.onload = () => {
        const k = Math.min(1, 1200 / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        ok(c.toDataURL('image/jpeg', .85));
      };
      img.onerror = () => bad(new Error('That file is not an image.'));
      fr.readAsDataURL(file);
    });
  }

  const T = {
    text: { label: 'Text', icon: 'text', kind: 'content',
      make: () => ({ id: uid(8), type: 'text', prompt: '' }),
      edit: () => el('div', 'hint', 'Text shows to students between questions. Type <code>$$</code> to write math.') },
    image: { label: 'Image', icon: 'image', kind: 'content',
      make: () => ({ id: uid(8), type: 'image', prompt: '', url: '', alt: '' }),
      media: q => { const i = el('img', 'media'); i.src = q.url; i.alt = q.alt || ''; return i; },
      edit: (q, changed) => urlField(q, changed, 'Image link', 'https://…', (w, draw) => {
        const row = el('div', 'row', `<label class="btn ghost sm">${icon('upload', 'sm')}Upload image<input type="file" accept="image/*" hidden></label><input class="input" style="flex:1;min-width:200px" placeholder="Describe the image for screen readers" value="${esc(q.alt || '')}">`);
        row.querySelector('input[type=file]').onchange = async e => {
          const f = e.target.files[0]; if(!f) return;
          try{ q.url = await shrinkImage(f); w.querySelector('input[type=url]').value = ''; changed(); draw(); }
          catch(err){ toast(err.message); }
        };
        row.querySelector('input:not([type])').oninput = e => { q.alt = e.target.value; changed(); };
        w.appendChild(row);
      }) },
    video: { label: 'Video', icon: 'video', kind: 'content',
      make: () => ({ id: uid(8), type: 'video', prompt: '', url: '' }),
      media: q => {
        const id = ytId(q.url);
        if(id){ const f = el('iframe', 'vframe'); f.src = 'https://www.youtube-nocookie.com/embed/' + id; f.allow = 'encrypted-media; picture-in-picture; fullscreen'; f.title = 'Video'; return f; }
        if(/\.(mp4|webm|mov)(\?|$)/i.test(q.url)){ const v = el('video', 'media'); v.src = q.url; v.controls = true; return v; }
        return el('div', 'hint', 'Paste a YouTube link or a link to an .mp4 file.');
      },
      edit: (q, changed) => urlField(q, changed, 'YouTube or video link', 'https://www.youtube.com/watch?v=…') },
    embed: { label: 'Embed', icon: 'code', kind: 'content',
      make: () => ({ id: uid(8), type: 'embed', prompt: '', url: '' }),
      media: q => {
        if(!/^https:\/\//.test(q.url)) return el('div', 'hint', 'Paste a link that starts with https:// (Desmos, GeoGebra, Google Slides…).');
        const f = el('iframe', 'vframe'); f.src = q.url; f.title = 'Embedded content';
        f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-forms'); return f;
      },
      edit: (q, changed) => urlField(q, changed, 'Link to embed', 'https://www.desmos.com/calculator/…') },

    mc: { label: 'Multiple choice', icon: 'radio', kind: 'question',
      make: () => ({ id: uid(8), type: 'mc', prompt: '', points: 1, options: [opt(), opt(), opt(), opt()], correct: null }),
      edit: (q, ch) => choiceEditor(q, ch, false),
      view: (q, v, set, ro) => choiceView(q, v, set, ro, false),
      grade: (q, v) => q.correct ? (v === q.correct ? 1 : 0) : null,
      text: (q, v) => { const i = q.options.findIndex(o => o.id === v); return i < 0 ? '' : q.options[i].text || letter(i); },
      dist: q => q.options.map((o, i) => ({ key: o.id, label: `${letter(i)}. ${o.text}`, right: o.id === q.correct })) },
    multi: { label: 'Multiple selection', icon: 'checkbox', kind: 'question',
      make: () => ({ id: uid(8), type: 'multi', prompt: '', points: 1, options: [opt(), opt(), opt(), opt()], correct: [] }),
      edit: (q, ch) => choiceEditor(q, ch, true),
      view: (q, v, set, ro) => choiceView(q, v, set, ro, true),
      grade: (q, v) => {
        if(!q.correct.length) return null;
        const a = new Set(v || []); return q.correct.length === a.size && q.correct.every(x => a.has(x)) ? 1 : 0;
      },
      text: (q, v) => (v || []).map(id => { const i = q.options.findIndex(o => o.id === id); return i < 0 ? '' : q.options[i].text || letter(i); }).join(', '),
      dist: q => q.options.map((o, i) => ({ key: o.id, label: `${letter(i)}. ${o.text}`, right: q.correct.includes(o.id) })) },
    tf: { label: 'True or false', icon: 'tf', kind: 'question',
      make: () => ({ id: uid(8), type: 'tf', prompt: '', points: 1, answer: null }),
      edit: (q, changed) => {
        const w = el('div', '', '<label class="field">Correct answer</label><div class="tfopts"></div>');
        const box = w.querySelector('.tfopts');
        const draw = () => { box.innerHTML = ''; [true, false].forEach(val => {
          const b = el('button', '', val ? 'True' : 'False'); b.type = 'button'; b.setAttribute('aria-pressed', q.answer === val);
          b.onclick = () => { q.answer = q.answer === val ? null : val; changed(); draw(); }; box.appendChild(b); }); };
        draw(); return w;
      },
      view: (q, v, set, ro) => {
        const box = el('div', 'choices');
        [true, false].forEach((val, i) => {
          const b = el('button', 'choice', `<span class="key">${val ? 'T' : 'F'}</span><span>${val ? 'True' : 'False'}</span>`);
          b.type = 'button'; b.disabled = ro; b.setAttribute('aria-pressed', v === val);
          b.onclick = () => { box.querySelectorAll('.choice').forEach((x, j) => x.setAttribute('aria-pressed', j === i)); set(val); };
          box.appendChild(b);
        });
        return box;
      },
      grade: (q, v) => q.answer == null ? null : (v === q.answer ? 1 : 0),
      text: (q, v) => v === true ? 'True' : v === false ? 'False' : '',
      dist: q => [{ key: true, label: 'True', right: q.answer === true }, { key: false, label: 'False', right: q.answer === false }] },
    short: { label: 'Short answer', icon: 'lines', kind: 'question',
      make: () => ({ id: uid(8), type: 'short', prompt: '', points: 1, accept: [] }),
      edit: (q, changed) => {
        const w = el('div', '', `<label class="field">Accepted answers, one per line</label><textarea class="input" rows="3" placeholder="Leave empty to grade by hand"></textarea><div class="hint">Capital letters and spaces are ignored when checking.</div>`);
        const ta = w.querySelector('textarea'); ta.value = (q.accept || []).join('\n');
        ta.oninput = () => { q.accept = ta.value.split('\n').map(s => s.trim()).filter(Boolean); changed(); };
        return w;
      },
      view: (q, v, set, ro) => {
        const w = el('div', 'answer-area', '<input class="input" type="text" aria-label="Your answer" placeholder="Type your answer" autocomplete="off">');
        const i = w.firstChild; i.value = v || ''; i.disabled = ro; i.oninput = () => set(i.value); return w;
      },
      grade: (q, v) => (q.accept && q.accept.length) ? (q.accept.some(a => norm(a) === norm(v)) ? 1 : 0) : null,
      text: (q, v) => v || '' },
    numeric: { label: 'Numeric', icon: 'sqrt', kind: 'question',
      make: () => ({ id: uid(8), type: 'numeric', prompt: '', points: 1, answer: '', tolerance: 0 }),
      edit: (q, changed) => {
        const w = el('div', 'row', `<div><label class="field">Correct answer</label><input class="input" style="width:160px" inputmode="decimal" placeholder="e.g. 7 or 3/4"></div><div><label class="field">Allow ±</label><input class="input" style="width:110px" inputmode="decimal"></div>`);
        const [a, t] = w.querySelectorAll('input'); a.value = q.answer; t.value = q.tolerance || 0;
        a.oninput = () => { q.answer = a.value.trim(); changed(); };
        t.oninput = () => { q.tolerance = Math.abs(num(t.value)) || 0; changed(); };
        return w;
      },
      view: (q, v, set, ro) => {
        const w = el('div', 'answer-area', '<input class="input" style="max-width:240px" inputmode="decimal" aria-label="Your answer" placeholder="Number" autocomplete="off">');
        const i = w.firstChild; i.value = v || ''; i.disabled = ro; i.oninput = () => set(i.value); return w;
      },
      grade: (q, v) => {
        const key = num(q.answer); if(isNaN(key)) return null;
        const x = num(v); return !isNaN(x) && Math.abs(x - key) <= (Number(q.tolerance) || 0) + 1e-9 ? 1 : 0;
      },
      text: (q, v) => v || '' },
    free: { label: 'Free response', icon: 'wrap', kind: 'question',
      make: () => ({ id: uid(8), type: 'free', prompt: '', points: 1 }),
      edit: () => el('div', 'hint', 'You grade these by hand in the Responses tab.'),
      view: (q, v, set, ro) => {
        const w = el('div', 'answer-area', '<textarea aria-label="Your answer" placeholder="Type your answer"></textarea>');
        const t = w.firstChild; t.value = v || ''; t.disabled = ro; t.oninput = () => set(t.value); return w;
      },
      grade: () => null,
      text: (q, v) => v || '' },
  };

  /* Add-menu catalog, laid out like the screenshot: content | questions | more */
  const CATALOG = {
    content: [['audio', 'Audio', 'mic', 'Phase 3'], ['embed'], ['image'], ['passages', 'Paired passages', 'book', 'Phase 3'], ['slide', 'Slide', 'slide', 'Phase 3'], ['text'], ['video']],
    questions: [['drawing', 'Drawing', 'pencil', 'Phase 2'], ['free'], ['mc'], ['multi'], ['short'], ['tf'], ['numeric']],
    more: [['Audio response', 'mic', 3], ['Categorize', 'move', 3], ['Drag and drop', 'dragdrop', 3], ['Dropdown', 'equals', 2], ['File response', 'clip', 3],
      ['Fill in the blank', 'fill', 2], ['Graphing', 'table', 3], ['Hot spot', 'hotspot', 3], ['Hot text', 'sparkle', 3], ['Match table grid', 'table', 3],
      ['Matching', 'swap', 2], ['Number line', 'numline', 3], ['Resequence', 'reseq', 2], ['Video response', 'vresp', 3]],
  };

  /* Scoring for one question and one student's response. */
  function result(q, resp){
    const def = T[q.type]; if(!def || def.kind !== 'question') return null;
    const pts = Number(q.points) || 0;
    if(!resp) return { state: 'none', earned: 0, possible: 0, answered: false };
    const v = resp.answers ? resp.answers[q.id] : undefined, answered = !blank(v);
    const ov = resp.scores ? resp.scores[q.id] : null;
    if(ov != null){
      const e = Math.max(0, Math.min(pts, Number(ov)));
      return { state: e >= pts ? 'ok' : e <= 0 ? 'no' : 'part', earned: e, possible: pts, answered, override: true };
    }
    if(!answered) return resp.submitted ? { state: 'blank', earned: 0, possible: pts, answered: false } : { state: 'none', earned: 0, possible: 0, answered: false };
    const g = def.grade(q, v);
    if(g == null) return { state: 'ung', earned: 0, possible: 0, answered: true };
    return { state: g >= 1 ? 'ok' : g <= 0 ? 'no' : 'part', earned: g * pts, possible: pts, answered: true };
  }
  function total(questions, resp){
    let e = 0, p = 0;
    questions.forEach(q => { const r = result(q, resp); if(r){ e += r.earned; p += r.possible; } });
    return p ? Math.round(100 * e / p) : null;
  }
  const isQuestion = q => T[q.type] && T[q.type].kind === 'question';
  const answerText = (q, v) => blank(v) ? '' : T[q.type].text(q, v);

  return { T, CATALOG, result, total, isQuestion, answerText, blank, letter };
})();
