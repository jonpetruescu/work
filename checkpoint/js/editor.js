'use strict';
/* Activity page: top bar + Edit / Responses tabs, and the Edit tab itself. */

const ActivityPage = {
  frame(id, tab){
    const act = Store.get('activities/' + id);
    const live = DB.assignmentsFor(id).some(g => g.open);
    const main = Shell.mount('activities', `
      <div class="topbar">
        <button class="ibtn" data-drawer aria-label="Menu">${icon('menu')}</button>
        <a class="ibtn" href="#/activities" aria-label="Back to activities">${icon('back')}</a>
        <input class="t" value="${esc(act.title)}" aria-label="Activity title">
        <div class="end">
          <span class="savestate hide-sm" aria-live="polite"></span>
          <a class="ibtn" href="#/preview/${id}" aria-label="Preview as a student" title="Preview as a student">${icon('eye')}</a>
          <button class="ibtn" data-more aria-label="More options" aria-haspopup="menu">${icon('kebab')}</button>
          <button class="btn" data-assign>Assign</button>
        </div>
      </div>
      <div class="tabwrap"><nav class="segtabs" aria-label="Activity views">
        <a href="#/a/${id}/edit"${tab === 'edit' ? ' aria-current="page"' : ''}>Edit</a>
        <a href="#/a/${id}/responses"${tab === 'responses' ? ' aria-current="page"' : ''}>Responses${live ? '<span class="dot" title="Open in at least one class"></span>' : ''}</a>
      </nav></div>
      <div class="tabbody"></div>`, true);
    const title = main.querySelector('.t');
    const saveTitle = debounce(() => { Store.update('activities/' + id, { title: title.value.trim() || 'Untitled activity', updatedAt: Date.now() }); ActivityPage.saved('Saved'); }, 400);
    title.addEventListener('input', () => { ActivityPage.saved('Saving…'); saveTitle(); });
    title.addEventListener('keydown', e => { if(e.key === 'Enter') title.blur(); });
    main.querySelector('[data-assign]').onclick = () => Assign.dialog(id);
    main.querySelector('[data-more]').onclick = e => showMenu(e.currentTarget, [
      { icon: 'copy', label: 'Duplicate activity', onClick: () => { location.hash = '#/a/' + Activities.duplicate(id) + '/edit'; } },
      { icon: 'download', label: 'Export responses (CSV)', onClick: () => Responses.exportCSV(id) },
      '-',
      { icon: 'trash', label: 'Delete activity', onClick: () => {
        const gs = DB.assignmentsFor(id);
        showModal({ title: 'Delete “' + Store.get('activities/' + id).title + '”?', body: `<p>This can't be undone.${gs.length ? ' Responses from ' + gs.length + ' class' + (gs.length > 1 ? 'es' : '') + ' will be deleted too.' : ''}</p>`,
          actions: [{ label: 'Cancel', cls: 'ghost' }, { label: 'Delete', cls: 'danger', onClick: () => { gs.forEach(g => DB.unassign(g.id)); Store.remove('activities/' + id); location.hash = '#/activities'; } }] });
      } },
    ]);
    return main.querySelector('.tabbody');
  },
  saved(text){ const s = document.querySelector('.savestate'); if(s) s.textContent = text; },
};

const Editor = (() => {
  function render(id){
    if(!Store.get('activities/' + id)){ location.hash = '#/activities'; return; }
    const body = ActivityPage.frame(id, 'edit');
    const act = JSON.parse(JSON.stringify(Store.get('activities/' + id)));
    let timer = null;
    const write = () => { Store.update('activities/' + id, { questions: act.questions, updatedAt: Date.now() }); ActivityPage.saved('Saved'); };
    const flush = () => { if(timer){ clearTimeout(timer); timer = null; write(); } };
    const changed = () => { ActivityPage.saved('Saving…'); clearTimeout(timer); timer = setTimeout(() => { timer = null; write(); }, 500); };
    App.onLeave(flush);
    window.addEventListener('pagehide', flush);
    App.onLeave(() => window.removeEventListener('pagehide', flush));

    const ex = MathText.tex('\\frac{3}{4}');
    body.innerHTML = `<div class="editor">
      <div class="hint" style="margin:0 0 16px;font-size:.88rem">Math: type <code>$$</code>, then LaTeX, then <code>$$</code> again. <code>$$\\frac{3}{4}$$</code> becomes ${ex}. Click a formula to change it.</div>
      <div class="qlist"></div>
      <h2 style="font-size:1rem;margin:24px 0 10px">Add to this activity</h2>
      <div class="palette">${palette()}</div></div>`;
    const list = body.querySelector('.qlist');

    function draw(focusId){
      list.innerHTML = '';
      if(!act.questions.length) list.innerHTML = '<div class="empty" style="padding:30px">Nothing here yet. Pick a question type below.</div>';
      act.questions.forEach((q, i) => list.appendChild(card(q, i)));
      if(focusId){
        const c = list.querySelector(`[data-qid="${focusId}"]`);
        if(c){ c.scrollIntoView({ block: 'center', behavior: 'smooth' }); const r = c.querySelector('.rte'); if(r) r.focus(); }
      }
    }
    function card(q, i){
      const def = QTypes.T[q.type], isQ = def.kind === 'question';
      const c = document.createElement('section'); c.className = 'qcard'; c.dataset.qid = q.id;
      c.setAttribute('aria-label', `Item ${i + 1}: ${def.label}`);
      c.innerHTML = `<div class="qhead"><span class="n">${i + 1}</span><span class="type">${icon(def.icon, 'sm')}${esc(def.label)}</span>
        <div class="tools">
          ${isQ ? `<label class="pts">Points <input class="input" type="number" min="0" step="0.5" value="${esc(q.points)}"></label>` : ''}
          <button class="ibtn sm" data-t="up" aria-label="Move up"${i ? '' : ' disabled'}>${icon('chevU', 'sm')}</button>
          <button class="ibtn sm" data-t="down" aria-label="Move down"${i < act.questions.length - 1 ? '' : ' disabled'}>${icon('chevD', 'sm')}</button>
          <button class="ibtn sm" data-t="dup" aria-label="Duplicate">${icon('copy', 'sm')}</button>
          <button class="ibtn sm" data-t="del" aria-label="Delete">${icon('trash', 'sm')}</button>
        </div></div><div class="qbody"></div>`;
      const qb = c.querySelector('.qbody');
      const ph = q.type === 'text' ? 'Type text for students…' : isQ ? 'Type your question…' : 'Caption (optional)';
      qb.appendChild(MathText.editor(q.prompt, { placeholder: ph, label: isQ ? 'Question' : 'Text', onChange: v => { q.prompt = v; changed(); } }));
      const extra = def.edit(q, changed);
      if(extra){ extra.style.marginTop = extra.style.marginTop || '12px'; qb.appendChild(extra); }
      const pts = c.querySelector('.pts input');
      if(pts) pts.oninput = () => { q.points = Math.max(0, Number(pts.value) || 0); changed(); };
      c.addEventListener('focusin', () => c.classList.add('focus'));
      c.addEventListener('focusout', e => { if(!c.contains(e.relatedTarget)) c.classList.remove('focus'); });
      c.querySelector('.tools').addEventListener('click', e => {
        const b = e.target.closest('[data-t]'); if(!b) return;
        const k = act.questions.indexOf(q);
        if(b.dataset.t === 'up' && k > 0){ act.questions.splice(k - 1, 0, act.questions.splice(k, 1)[0]); changed(); draw(); }
        if(b.dataset.t === 'down' && k < act.questions.length - 1){ act.questions.splice(k + 1, 0, act.questions.splice(k, 1)[0]); changed(); draw(); }
        if(b.dataset.t === 'dup'){ const d = JSON.parse(JSON.stringify(q)); d.id = uid(8); act.questions.splice(k + 1, 0, d); changed(); draw(d.id); }
        if(b.dataset.t === 'del') removeItem(q);
      });
      return c;
    }
    function removeItem(q){
      const n = DB.assignmentsFor(id).reduce((s, g) => s + Object.values(DB.responses(g.id)).filter(r => r.answers && !QTypes.blank(r.answers[q.id])).length, 0);
      const go = () => { act.questions.splice(act.questions.indexOf(q), 1); changed(); flush(); draw(); };
      if(!n) return go();
      showModal({ title: 'Delete this question?', body: `<p>${n} student answer${n > 1 ? 's' : ''} to it will no longer count. Export first if you need them.</p>`,
        actions: [{ label: 'Cancel', cls: 'ghost' }, { label: 'Delete', cls: 'danger', onClick: go }] });
    }
    body.querySelector('.palette').addEventListener('click', e => {
      const b = e.target.closest('[data-add]'); if(!b) return;
      const q = QTypes.T[b.dataset.add].make(); act.questions.push(q); changed(); draw(q.id);
    });
    draw();
  }

  function palette(){
    const pick = ([type, label, ic, phase]) => {
      const def = QTypes.T[type];
      if(def) return `<button type="button" class="pick" data-add="${type}">${icon(def.icon)}${esc(def.label)}</button>`;
      return `<button type="button" class="pick" aria-disabled="true" title="Planned for ${phase}">${icon(ic)}${esc(label)}<small>${phase.replace('Phase ', 'P')}</small></button>`;
    };
    return `<div class="col"><h3>Content</h3>${QTypes.CATALOG.content.map(pick).join('')}</div>
      <div class="col"><h3>Questions</h3>${QTypes.CATALOG.questions.map(pick).join('')}</div>
      <div class="col more"><h3>Planned question types</h3><div class="chips">${QTypes.CATALOG.more.map(([l, ic, p]) =>
        `<span class="chip" title="Planned for Phase ${p}">${icon(ic, 'sm')}${esc(l)}<small>P${p}</small></span>`).join('')}</div>
        <p class="hint" style="margin-top:12px">Grey items are on the roadmap in PLAN.md, with the phase they're planned for.</p></div>`;
  }
  return { render };
})();
