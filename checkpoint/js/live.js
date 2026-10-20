'use strict';
/*
  Teacher-paced lesson. The lesson state (which item, paused, ended) is one record, live/{gid}.
  Every change bumps its `rev`. Each student screen reports the rev it is showing (presence/{gid}/{sid}),
  so this screen can say exactly who has the current question and who is stuck on an old one.
*/
const Live = (() => {
  const ONLINE_MS = 12000;
  let hideNames = false;

  function who(gid, live, sid){
    const p = (Store.get('presence/' + gid) || {})[sid];
    if(!p || Date.now() - p.at > ONLINE_MS) return 'off';
    return p.rev >= live.rev ? 'synced' : 'behind';
  }
  function rosterHtml(gid, g, live){
    return DB.students(g.classId).map(s => {
      const st = who(gid, live, s.id);
      const tag = st === 'synced' ? '<span class="sync ok">Up to date</span>' : st === 'behind' ? '<span class="sync wait">Updating…</span>' : '<span class="small faint">Not here</span>';
      return `<div class="rost${st === 'off' ? ' off' : ''}"><span class="dot${st === 'off' ? '' : st === 'synced' ? ' on' : ' stale'}" aria-hidden="true"></span>${avatar(s.name, 26)}<span class="nm">${esc(s.name)}</span>${tag}</div>`;
    }).join('') || '<p class="muted">No students on the roster yet. They\'re added when they join with the link.</p>';
  }
  function counts(gid, g, live){
    const sts = DB.students(g.classId), states = sts.map(s => who(gid, live, s.id));
    return { total: sts.length, here: states.filter(x => x !== 'off').length, behind: sts.filter((s, i) => states[i] === 'behind') };
  }

  function barHtml(g, live, act){
    const n = act.questions.length;
    if(g.mode !== 'teacher') return `<span>This assignment is student-paced.</span><div class="end"><button class="btn" data-do="teacher">Switch to teacher-paced</button></div>`;
    if(live.ended) return `<span class="qpos">Lesson ended</span><div class="end"><button class="btn ghost" data-do="restart">${icon('refresh', 'sm')}Run it again</button><a class="btn" href="#/a/${act.id}/responses">See responses</a></div>`;
    if(!g.open) return `<span class="qpos">${icon('lock', 'sm')} Locked</span><span class="muted">Students can't join yet.</span><div class="end"><button class="btn" data-do="open">Open the waiting room</button></div>`;
    if(live.index < 0) return `<span class="qpos">Waiting room</span><span class="herecount muted"></span><div class="end"><button class="btn" data-do="start"${n ? '' : ' disabled'}>${icon('play', 'sm')}Start lesson</button></div>`;
    return `<span class="qpos">${live.index + 1} of ${n}</span>
      <button class="btn ghost" data-do="prev"${live.index > 0 ? '' : ' disabled'} aria-label="Previous question">${icon('prev', 'sm')}Back</button>
      <button class="btn" data-do="next"${live.index < n - 1 ? '' : ' disabled'} aria-label="Next question">Next${icon('next', 'sm')}</button>
      ${g.paused ? '<span class="badge-paused">Students paused</span>' : ''}<span class="herecount muted small"></span>
      <div class="end"><button class="btn ${g.paused ? '' : 'ghost'}" data-do="pause">${icon(g.paused ? 'play' : 'pause', 'sm')}${g.paused ? 'Resume students' : 'Pause students'}</button>
      <button class="btn ghost" data-do="end">${icon('stop', 'sm')}End lesson</button></div>`;
  }

  function itemHtml(q){
    const def = QTypes.T[q.type];
    let h = `<div class="prompt">${MathText.html(q.prompt)}</div>`;
    if(def.media && q.url) h += '<div class="mediaslot" style="margin-top:12px"></div>';
    if(q.options) h += `<div class="choices">${q.options.map((o, i) => {
      const right = q.type === 'mc' ? o.id === q.correct : q.correct.includes(o.id);
      return `<div class="choice"${right ? ' style="border-color:var(--green)"' : ''}><span class="key">${QTypes.letter(i)}</span><span style="flex:1">${MathText.html(o.text)}</span>${right ? `<span class="st-open" title="Correct">${icon('check')}</span>` : ''}</div>`;
    }).join('')}</div>`;
    const key = QTypes.isQuestion(q) && !q.options ? Responses.keyText(q) : '';
    if(key) h += `<p style="margin-top:14px"><b>Answer key:</b> ${MathText.html(key)}</p>`;
    return h;
  }
  function answersHtml(gid, g, q){
    if(!QTypes.isQuestion(q)) return '<p class="muted">This is a content slide, so there\'s nothing to answer. Press Next when you\'re ready.</p>';
    const def = QTypes.T[q.type], rs = DB.responses(gid), sts = DB.students(g.classId);
    const got = sts.map(s => ({ s, r: rs[s.id], v: rs[s.id] && rs[s.id].answers ? rs[s.id].answers[q.id] : undefined })).filter(x => !QTypes.blank(x.v));
    let h = '';
    if(def.dist){
      const bars = def.dist(q).map(d => ({ ...d, n: got.filter(x => Array.isArray(x.v) ? x.v.includes(d.key) : x.v === d.key).length }));
      h += `<div class="dist">${bars.map(b => `<div class="bar${b.right ? ' right' : ''}"><div class="track"><div class="fill" style="width:${got.length ? Math.round(100 * b.n / got.length) : 0}%"></div>
        <div class="lab">${b.right ? icon('check', 'sm') : ''}<span>${MathText.html(b.label)}</span></div></div><b>${b.n}</b></div>`).join('')}</div>`;
    }
    h += `<div class="feed">${got.map(({ s, r, v }) => {
      const x = QTypes.result(q, r), cls = x.state === 'ok' ? 'ok' : x.state === 'no' ? 'no' : '';
      const mark = x.state === 'ok' ? `<span class="st-open" title="Correct">${icon('check', 'sm')}</span>` : x.state === 'no' ? `<span class="st-locked" title="Incorrect">${icon('x', 'sm')}</span>` : '';
      return `<div class="it ${cls}"><span class="nm">${hideNames ? 'Student' : esc(s.name)}</span><span class="ans">${MathText.html(QTypes.answerText(q, v))}</span>${mark}</div>`;
    }).join('') || '<p class="muted">No answers yet. They show up here as students send them.</p>'}</div>`;
    const missing = sts.filter(s => !got.some(x => x.s.id === s.id));
    if(got.length && missing.length) h += `<p class="small muted" style="margin-top:12px">Still working: ${hideNames ? missing.length + ' students' : missing.map(s => esc(s.name)).join(', ')}</p>`;
    return { html: h, n: got.length, of: sts.length };
  }

  function render(gid){
    const g0 = Store.get('assignments/' + gid);
    if(!g0){ location.hash = '#/activities'; return; }
    const act0 = Store.get('activities/' + g0.activityId), cls = Store.get('classes/' + g0.classId);
    const main = Shell.mount('activities', `
      <div class="topbar">
        <button class="ibtn" data-drawer aria-label="Menu">${icon('menu')}</button>
        <a class="ibtn" href="#/a/${act0.id}/responses" aria-label="Back to responses">${icon('back')}</a>
        <div style="min-width:0;flex:1"><div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(act0.title)}</div>
          <div class="small muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(cls.name)} · Teacher-paced</div></div>
        <div class="end"><a class="btn ghost hide-sm" href="#/a/${act0.id}/responses">Responses</a>
          <button class="ibtn" data-menu aria-haspopup="menu" aria-label="Assignment options">${icon('kebab')}</button></div>
      </div>
      <div class="livebar" role="toolbar" aria-label="Lesson controls"></div><div class="livebody"></div>`, true);
    const bar = main.querySelector('.livebar'), body = main.querySelector('.livebody');
    let sig = '';

    const draw = () => {
      const g = Store.get('assignments/' + gid), act = Store.get('activities/' + (g && g.activityId));
      if(!g || !act){ location.hash = '#/activities'; return; }
      const live = Store.get('live/' + gid) || { index: -1, rev: 0 };
      const s = [g.open, g.paused, g.mode, live.index, live.ended, act.questions.length].join('|');
      if(s !== sig){ sig = s; bar.innerHTML = barHtml(g, live, act); }
      const c = counts(gid, g, live), hc = bar.querySelector('.herecount');
      if(hc) hc.textContent = `${c.here} of ${c.total} students here`;

      if(g.mode !== 'teacher' || !g.open || live.ended){
        body.innerHTML = `<div class="lobby"><h1>${live.ended ? 'Lesson finished' : g.mode !== 'teacher' ? 'Student-paced' : 'Locked'}</h1>
          <p class="muted">${live.ended ? 'Students see a “lesson finished” screen. Their answers are in Responses.' : g.mode !== 'teacher' ? 'Students move through this activity on their own.' : 'Open the waiting room so students can join.'}</p></div>`;
        return;
      }
      if(live.index < 0){
        const link = DB.joinLink(cls);
        body.innerHTML = `<div class="lobby"><h1>Waiting for students</h1>
          <p class="muted">Students open the class link and pick their name. They'll see a waiting screen until you start.</p>
          <div class="joinbox"><code>${esc(link)}</code><button class="btn ghost sm" data-do="copy">${icon('copy', 'sm')}Copy</button></div>
          <div class="roster">${rosterHtml(gid, g, live)}</div>
          <button class="btn big" data-do="start"${act.questions.length ? '' : ' disabled'}>${icon('play')}Start lesson</button></div>`;
        return;
      }
      const q = act.questions[Math.min(live.index, act.questions.length - 1)];
      if(!q){ body.innerHTML = '<div class="lobby"><h1>This activity has no items</h1></div>'; return; }
      const a = answersHtml(gid, g, q), behind = c.behind;
      body.innerHTML = `<div class="livegrid">
        <section class="panel"><h2>${icon(QTypes.T[q.type].icon, 'sm')}On students' screens <span class="small muted" style="font-weight:400">${esc(QTypes.T[q.type].label)}</span></h2>${itemHtml(q)}</section>
        <section class="panel"><h2>Responses ${typeof a === 'object' ? `<span class="muted" style="font-weight:400">${a.n} of ${a.of}</span>` : ''}
          <label class="small muted" style="margin-left:auto;font-weight:400;display:flex;gap:6px;align-items:center"><input type="checkbox" data-do="names"${hideNames ? ' checked' : ''}> Hide names</label></h2>
          ${typeof a === 'object' ? a.html : a}</section>
        <section class="panel" style="grid-column:1/-1"><h2>Who's here</h2>
          ${behind.length ? `<p class="banner warn" style="border-radius:6px;margin:0 0 12px">${behind.length} student${behind.length > 1 ? "s haven't" : " hasn't"} loaded this question yet: ${behind.map(s => esc(s.name)).join(', ')}. If it lasts more than a few seconds, ask them to refresh.</p>` : ''}
          <div class="roster" style="margin:0">${rosterHtml(gid, g, live)}</div></section></div>`;
      const slot = body.querySelector('.mediaslot'); if(slot) slot.appendChild(QTypes.T[q.type].media(q));
    };

    main.addEventListener('click', e => {
      const b = e.target.closest('[data-do],[data-menu]'); if(!b) return;
      const g = Store.get('assignments/' + gid), live = Store.get('live/' + gid), act = Store.get('activities/' + g.activityId), n = act.questions.length;
      if(b.dataset.menu != null) return Assign.menu(b, g);
      switch(b.dataset.do){
        case 'copy': return copyText(DB.joinLink(cls), 'Join link');
        case 'teacher': return Assign.mode(g, 'teacher');
        case 'open': return Assign.setOpen(g, true);
        case 'start': Store.update('assignments/' + gid, { open: true, paused: false }); return DB.setLive(gid, { index: 0, startedAt: Date.now(), ended: false });
        case 'prev': return DB.setLive(gid, { index: Math.max(0, live.index - 1) });
        case 'next': return DB.setLive(gid, { index: Math.min(n - 1, live.index + 1) });
        case 'pause': return Assign.pause(g, !g.paused);
        case 'restart': Store.update('assignments/' + gid, { open: true, paused: false }); return DB.setLive(gid, { index: -1, startedAt: null, ended: false });
        case 'names': hideNames = b.checked; sig = ''; return draw();
        case 'end': return showModal({ title: 'End the lesson?', body: '<p>Students see a “lesson finished” screen and everyone\'s answers are turned in. The assignment locks.</p>',
          actions: [{ label: 'Cancel', cls: 'ghost' }, { label: 'End lesson', onClick: () => {
            Object.keys(DB.responses(gid)).forEach(sid => Store.update(`responses/${gid}/${sid}`, { submitted: true }));
            Store.update('assignments/' + gid, { open: false, paused: false });
            DB.setLive(gid, { ended: true });
          } }] });
      }
    });
    const keys = e => {
      if(e.target.closest('input,textarea,select,[contenteditable]') || document.querySelector('.modal-back')) return;
      const k = { ArrowRight: 'next', ArrowLeft: 'prev' }[e.key];
      const b = k && bar.querySelector(`[data-do="${k}"]:not([disabled])`); if(b){ e.preventDefault(); b.click(); }
    };
    document.addEventListener('keydown', keys);
    App.onLeave(() => document.removeEventListener('keydown', keys));
    draw();
    const redraw = debounce(draw, 80);
    ['live/' + gid, 'assignments/' + gid, 'presence/' + gid, 'responses/' + gid, 'classes/' + cls.id, 'activities/' + act0.id].forEach(p => App.onLeave(Store.subscribe(p, redraw)));
    const tick = setInterval(draw, 3000);
    App.onLeave(() => clearInterval(tick));
  }
  return { render, ONLINE_MS };
})();
