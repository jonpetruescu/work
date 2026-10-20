'use strict';
/*
  Student screens. Join link → pick your name → see what's open for the class.
  A student screen is always drawn from the current lesson state, never from a cached copy, and it
  reports which version of that state it is showing (presence), so a stuck screen is visible to the teacher.
  In this prototype "who am I" is kept per browser tab, so several tabs can be different students.
*/
const Student = (() => {
  const meKey = cid => 'checkpoint:me:' + cid;
  const getMe = cid => { try{ return sessionStorage.getItem(meKey(cid)); } catch(e){ return null; } };
  const setMe = (cid, sid) => { try{ sid ? sessionStorage.setItem(meKey(cid), sid) : sessionStorage.removeItem(meKey(cid)); } catch(e){} };
  const teacher = () => (Store.get('teacher') || {}).name || 'your teacher';
  const first = n => String(n).trim().split(/\s+/)[0];

  function frame(cls, s, inner){
    App.root.innerHTML = `<div class="stu">
      <header class="stu-top"><span class="brand" style="padding:0;font-size:1.05rem"><span class="mark" style="width:24px;height:24px">${icon('check', 'sm')}</span>Checkpoint</span>
        ${cls ? `<span class="muted small hide-sm" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(cls.name)}</span>` : ''}
        <span class="who">${s ? `<span class="conn" aria-live="polite"></span>${avatar(s.name, 28)}<span class="hide-sm">${esc(s.name)}</span>
          <button class="linkbtn small" data-notme>Not you?</button>` : ''}</span></header>
      <div class="banner-slot"></div><main class="stu-wrap">${inner}</main></div>`;
    const nm = App.root.querySelector('[data-notme]');
    if(nm) nm.onclick = () => { setMe(cls.id, null); App.route(); };
    const conn = () => {
      const c = App.root.querySelector('.conn'), slot = App.root.querySelector('.banner-slot'); if(!c) return;
      const on = navigator.onLine;
      c.innerHTML = on ? `<span class="dot on"></span>Connected` : `<span class="dot stale"></span>Reconnecting…`;
      slot.innerHTML = on ? '' : '<div class="banner warn">You\'re offline. Keep going: your answers send when the connection comes back.</div>';
    };
    conn();
    // Coming back to the tab (e.g. from Zoom): re-read the lesson state right away instead of waiting for a timer.
    const back = () => { if(!document.hidden) Store.refresh(); };
    window.addEventListener('online', conn); window.addEventListener('offline', conn);
    document.addEventListener('visibilitychange', back);
    App.onLeave(() => { window.removeEventListener('online', conn); window.removeEventListener('offline', conn); document.removeEventListener('visibilitychange', back); });
    return App.root.querySelector('.stu-wrap');
  }

  function join(code, gid){
    const cls = DB.classByCode(code);
    if(!cls){ frame(null, null, `<div class="stu-card"><h1>This join link isn't working</h1><p class="muted">Ask ${esc(teacher())} for the current link for your class.</p></div>`); return; }
    const sid = getMe(cls.id), s = sid && Store.get(`classes/${cls.id}/students/${sid}`);
    if(!s) return pickName(cls);
    if(gid) return work(cls, s, gid);
    home(cls, s);
  }

  function pickName(cls){
    const wrap = frame(cls, null, `<div class="stu-card"><h1>${esc(cls.name)}</h1><p class="muted">Tap your name.</p>
      <div class="namepick">${DB.students(cls.id).map(s => `<button type="button" data-sid="${s.id}">${avatar(s.name, 28)}${esc(s.name)}</button>`).join('')}</div>
      <details style="margin-top:20px"><summary class="linkbtn" style="cursor:pointer">I'm not on the list</summary>
        <form style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><input class="input" name="n" style="flex:1;min-width:200px" placeholder="First and last name" autocomplete="name" required><button class="btn">Join</button></form></details>
      <p class="hint" style="margin-top:20px">In the hosted version you'll also make a 4-digit PIN the first time, so no one else can answer as you.</p></div>`);
    wrap.addEventListener('click', e => { const b = e.target.closest('[data-sid]'); if(b){ setMe(cls.id, b.dataset.sid); App.route(); } });
    wrap.querySelector('form').addEventListener('submit', e => {
      e.preventDefault();
      const name = e.target.n.value.trim().replace(/\s+/g, ' '); if(!name) return;
      const dupe = DB.students(cls.id).find(s => s.name.toLowerCase() === name.toLowerCase());
      const id = dupe ? dupe.id : 's_' + uid(8);
      if(!dupe) Store.set(`classes/${cls.id}/students/${id}`, { id, name, added: true });
      setMe(cls.id, id); App.route();
    });
  }

  function home(cls, s){
    const wrap = frame(cls, s, '<div class="list"></div>');
    const draw = () => {
      const gs = Store.list('assignments').filter(g => g.classId === cls.id && g.open && Store.get('activities/' + g.activityId));
      const live = gs.filter(g => g.mode === 'teacher');
      if(live.length === 1){ location.replace('#/j/' + cls.code + '/' + live[0].id); return; }
      const rs = g => DB.responses(g.id)[s.id];
      wrap.querySelector('.list').innerHTML = gs.length ? `<div class="stu-card"><h1>Hi, ${esc(first(s.name))}</h1><p class="muted">Here's what's open for ${esc(cls.name)}.</p>
        <div class="alist">${gs.map(g => { const a = Store.get('activities/' + g.activityId), r = rs(g);
          return `<a href="#/j/${esc(cls.code)}/${g.id}">${icon(g.mode === 'teacher' ? 'present' : 'bolt')}<span><b>${esc(a.title)}</b></span>
            <span class="meta">${g.mode === 'teacher' ? 'Live lesson' : r && r.submitted ? icon('check', 'sm') + 'Submitted' : r ? 'In progress' : 'Not started'}${icon('chevR', 'sm')}</span></a>`; }).join('')}</div></div>`
        : `<div class="stu-card waiting"><span class="pulse" aria-hidden="true"></span><div class="big">Nothing is open right now</div>
          <p class="muted">Keep this page open. It updates by itself when ${esc(teacher())} opens an activity.</p></div>`;
    };
    draw();
    ['assignments', 'live', 'activities'].forEach(p => App.onLeave(Store.subscribe(p, debounce(draw, 60))));
  }

  /* ---------- Working on one assignment (also used for the teacher's preview) ---------- */
  function storeIO(gid, sid){
    const base = `responses/${gid}/${sid}`;
    const ensure = () => { if(!Store.get(base)) Store.set(base, { answers: {}, scores: {}, submitted: false, startedAt: Date.now(), updatedAt: Date.now() }); };
    return {
      g: () => Store.get('assignments/' + gid),
      live: () => Store.get('live/' + gid) || { index: -1, rev: 0 },
      resp: () => DB.responses(gid)[sid],
      answer: (qid, v) => { ensure(); Store.set(`${base}/answers/${qid}`, v); Store.update(base, { updatedAt: Date.now() }); },
      submit: () => { ensure(); Store.update(base, { submitted: true, updatedAt: Date.now() }); },
      beat: rev => Store.set(`presence/${gid}/${sid}`, { at: Date.now(), rev }),
      leave: () => Store.set(`presence/${gid}/${sid}`, { at: 0, rev: 0 }),
    };
  }
  function memoryIO(act){
    const r = { answers: {}, scores: {}, submitted: false };
    return { g: () => ({ id: 'preview', activityId: act.id, open: true, paused: false, mode: 'student' }), live: () => ({ index: -1, rev: 0 }),
      resp: () => r, answer: (qid, v) => { r.answers[qid] = v; }, submit: () => { r.submitted = true; }, beat: () => {}, leave: () => {} };
  }

  function item(q, r, ro, onAnswer){
    const def = QTypes.T[q.type], box = document.createElement('div');
    box.innerHTML = `<div class="prompt">${MathText.html(q.prompt)}</div>`;
    if(def.media && q.url){ const m = document.createElement('div'); m.style.marginTop = '14px'; m.appendChild(def.media(q)); box.appendChild(m); }
    if(def.kind === 'question') box.appendChild(def.view(q, r && r.answers ? r.answers[q.id] : undefined, onAnswer, ro));
    return box;
  }

  function work(cls, s, gid, preview){
    const io = preview ? memoryIO(preview) : storeIO(gid, s.id);
    const posKey = 'checkpoint:pos:' + gid;
    let pos = 0; try{ pos = Number(sessionStorage.getItem(posKey)) || 0; } catch(e){}
    let reviewing = false, sig = null, lastBeat = 0, lastRev = -1;
    const wrap = preview ? (App.root.innerHTML = `<div class="stu"><div class="banner info">Preview: this is what students see. Answers aren't saved.
        <a href="#/a/${preview.id}/edit" style="margin-left:10px">Back to editing</a></div><main class="stu-wrap"></main></div>`, App.root.querySelector('.stu-wrap'))
      : frame(cls, s, '');
    const pending = new Map();
    const flush = () => { pending.forEach((v, qid) => io.answer(qid, v)); pending.clear(); };
    const later = debounce(flush, 400);
    const saved = () => { const el = wrap.querySelector('.saved'); if(el){ el.textContent = preview ? 'Preview: not saved' : 'Saved ✓'; } };
    const onAnswer = q => v => {
      if(typeof v === 'string'){ pending.set(q.id, v); later(); setTimeout(saved, 450); }
      else { io.answer(q.id, v); saved(); }
    };
    App.onLeave(() => { flush(); io.leave(); });
    const hide = () => { flush(); io.leave(); };
    window.addEventListener('pagehide', hide); App.onLeave(() => window.removeEventListener('pagehide', hide));

    const setPos = p => { flush(); pos = p; try{ sessionStorage.setItem(posKey, p); } catch(e){} draw(true); window.scrollTo(0, 0); };
    const card = html => { wrap.innerHTML = `<div class="stu-card">${html}</div>`; return wrap.firstChild; };
    const back = cls ? `<a class="btn ghost" href="#/j/${esc(cls.code)}">Back to ${esc(cls.name)}</a>` : '';

    function draw(force){
      const g = io.g(), live = io.live(), act = g && Store.get('activities/' + g.activityId), r = io.resp();
      const gone = !g || !act || (!preview && g.classId !== cls.id);
      const key = gone ? 'gone' : [g.open, g.mode, live.ended, g.mode === 'teacher' ? live.index : pos, !!(r && r.submitted), reviewing].join('|');
      if(key !== sig || force){ sig = key; body(g, live, act, r, gone); }
      const wall = document.querySelector('.pausewall');
      const paused = !gone && g.open && g.paused && !live.ended;
      if(paused && !wall){ const w = document.createElement('div'); w.className = 'pausewall'; w.setAttribute('role', 'alert');
        w.innerHTML = `<div><div class="big">Paused</div><p>Eyes on ${esc(teacher())}. You'll pick up where you left off.</p></div>`; document.body.appendChild(w); }
      if(!paused && wall) wall.remove();
      if(!gone && (live.rev !== lastRev || Date.now() - lastBeat > 3500)){ lastRev = live.rev; lastBeat = Date.now(); io.beat(live.rev); }
      const chk = wrap.querySelector('.checked'); if(chk) chk.textContent = 'Last checked ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
    }

    function body(g, live, act, r, gone){
      if(gone) return card(`<h1>This activity isn't available</h1><p class="muted">It may have been removed. ${back}</p>`);
      const items = act.questions;
      if(g.mode === 'teacher'){
        if(live.ended) return card(`<div class="waiting"><span class="st-open">${icon('checkAll', 'lg')}</span><div class="big">Lesson finished</div><p class="muted">Nice work. Your answers were turned in.</p>${back}</div>`);
        if(!g.open) return card(`<div class="waiting"><div class="big">This lesson is closed</div><p class="muted">${r ? 'Your answers were saved.' : ''}</p>${back}</div>`);
        if(live.index < 0) return card(`<div class="waiting"><span class="pulse" aria-hidden="true"></span><div class="big">You're in, ${esc(first(s.name))}!</div>
          <p class="muted">Waiting for ${esc(teacher())} to start the lesson. This screen changes by itself.</p>
          <p class="small faint"><span class="checked"></span> · <button class="linkbtn small" data-check>Check again</button></p></div>`);
        const q = items[Math.min(live.index, items.length - 1)]; if(!q) return card('<p>Waiting for the next question…</p>');
        const c = card(`<div class="small muted" style="margin-bottom:12px">${live.index + 1} of ${items.length} · ${esc(teacher())} moves everyone ahead</div>`);
        c.appendChild(item(q, r, false, onAnswer(q)));
        c.insertAdjacentHTML('beforeend', `<div class="stu-foot"><span class="saved" aria-live="polite"></span><span class="small faint" style="margin-left:auto"><span class="checked"></span></span></div>`);
        return;
      }
      if(!g.open) return card(`<div class="waiting"><div class="big">${esc(teacher())} closed this activity</div><p class="muted">${r ? 'Your answers were saved.' : ''}</p>${back}</div>`);
      const answered = items.filter(q => QTypes.isQuestion(q) && r && r.answers && !QTypes.blank(r.answers[q.id])).length, nq = items.filter(QTypes.isQuestion).length;
      if(r && r.submitted && !reviewing){
        const c = card(`<div class="waiting"><span class="st-open">${icon('checkAll', 'lg')}</span><div class="big">Submitted</div><p class="muted">You answered ${answered} of ${nq} question${nq === 1 ? '' : 's'}.</p>
          <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><button class="btn outline" data-review>Look over my answers</button>${back}</div></div>`);
        c.querySelector('[data-review]').onclick = () => { reviewing = true; pos = 0; draw(true); };
        return;
      }
      pos = Math.max(0, Math.min(pos, items.length - 1));
      const ro = !!(r && r.submitted);
      const c = card(`<h1 style="font-size:1.15rem">${esc(act.title)}</h1><nav class="bubbles" aria-label="Questions" style="margin-top:12px">${items.map((q, i) =>
        `<button type="button" data-go="${i}" class="${QTypes.isQuestion(q) && r && r.answers && !QTypes.blank(r.answers[q.id]) ? 'done' : ''}"${i === pos ? ' aria-current="step"' : ''} aria-label="Item ${i + 1}">${i + 1}</button>`).join('')}</nav>`);
      if(!items.length){ c.insertAdjacentHTML('beforeend', '<p class="muted">This activity is empty.</p>'); return; }
      c.appendChild(item(items[pos], r, ro, onAnswer(items[pos])));
      const lastOne = pos === items.length - 1;
      c.insertAdjacentHTML('beforeend', `<div class="stu-foot"><span class="saved" aria-live="polite"></span><div class="end">
        <button class="btn ghost" data-step="-1"${pos ? '' : ' disabled'}>${icon('prev', 'sm')}Back</button>
        ${lastOne ? (ro ? `<button class="btn" data-done>Done</button>` : `<button class="btn" data-submit>Submit</button>`) : `<button class="btn" data-step="1">Next${icon('next', 'sm')}</button>`}</div></div>`);
    }

    wrap.addEventListener('click', e => {
      const b = e.target.closest('button'); if(!b) return;
      if(b.dataset.go != null) setPos(Number(b.dataset.go));
      else if(b.dataset.step) setPos(pos + Number(b.dataset.step));
      else if(b.dataset.check != null){ Store.refresh(); draw(true); toast('Up to date'); }
      else if(b.dataset.done != null){ reviewing = false; draw(true); }
      else if(b.dataset.submit != null){
        flush();
        const act = Store.get('activities/' + io.g().activityId), r = io.resp();
        const qs = act.questions.filter(QTypes.isQuestion), left = qs.filter(q => !(r && r.answers && !QTypes.blank(r.answers[q.id]))).length;
        showModal({ title: 'Turn it in?', body: left ? `<p>You skipped ${left} question${left > 1 ? 's' : ''}. You can go back, or submit now.</p>` : '<p>You answered every question.</p>',
          actions: [{ label: 'Go back', cls: 'ghost' }, { label: 'Submit', onClick: () => { io.submit(); reviewing = false; draw(true); } }] });
      }
    });
    draw(true);
    if(!preview){
      const redraw = debounce(() => draw(), 40);
      ['assignments/' + gid, 'live/' + gid, 'activities'].forEach(p => App.onLeave(Store.subscribe(p, redraw)));
      const t = setInterval(() => draw(), 4000);
      App.onLeave(() => clearInterval(t));
    }
    App.onLeave(() => { const w = document.querySelector('.pausewall'); if(w) w.remove(); });
  }

  function preview(activityId){
    const act = Store.get('activities/' + activityId);
    if(!act){ location.hash = '#/activities'; return; }
    try{ sessionStorage.removeItem('checkpoint:pos:preview'); } catch(e){}
    work(null, { id: 'preview', name: 'Preview Student' }, 'preview', act);
  }
  return { join, preview };
})();
