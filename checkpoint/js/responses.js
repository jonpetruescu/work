'use strict';
/* Responses tab: every class on one page, expandable to students, plus CSV export. */

const Responses = (() => {
  const KEY = 'checkpoint:expanded';
  let expanded; try{ expanded = new Set(JSON.parse(sessionStorage.getItem(KEY) || '[]')); } catch(e){ expanded = new Set(); }
  let sort = 'first';
  const keep = () => { try{ sessionStorage.setItem(KEY, JSON.stringify([...expanded])); } catch(e){} };
  const last = n => { const p = n.trim().split(/\s+/); return p[p.length - 1]; };

  function keyText(q){
    if(q.type === 'mc'){ const i = q.options.findIndex(o => o.id === q.correct); return i < 0 ? '' : `${QTypes.letter(i)}. ${q.options[i].text}`; }
    if(q.type === 'multi') return q.options.map((o, i) => q.correct.includes(o.id) ? `${QTypes.letter(i)}. ${o.text}` : null).filter(Boolean).join(', ');
    if(q.type === 'tf') return q.answer == null ? '' : q.answer ? 'True' : 'False';
    if(q.type === 'numeric') return q.answer ? q.answer + (Number(q.tolerance) ? ' ± ' + q.tolerance : '') : '';
    if(q.type === 'short') return (q.accept || []).join(' or ');
    return '';
  }
  function classes(act){
    return DB.assignmentsFor(act.id).map(g => ({ g, c: Store.get('classes/' + g.classId) })).filter(x => x.c)
      .sort((a, b) => (a.c.order ?? 0) - (b.c.order ?? 0));
  }
  function avg(q, rs){ let e = 0, p = 0; rs.forEach(r => { const x = QTypes.result(q, r); if(x){ e += x.earned; p += x.possible; } }); return p ? Math.round(100 * e / p) : null; }
  function avgTotal(items, rs){ let e = 0, p = 0; items.forEach(q => rs.forEach(r => { const x = QTypes.result(q, r); if(x){ e += x.earned; p += x.possible; } })); return p ? Math.round(100 * e / p) : null; }
  const pc = p => `<td class="pc ${pctClass(p)}">${p == null ? '' : p + '%'}</td>`;

  function table(act){
    const items = act.questions, groups = classes(act);
    if(!groups.length) return `<tbody><tr><td><div class="empty">Not assigned to any class yet. <button class="linkbtn" data-assign>Assign it</button></div></td></tr></tbody>`;
    const rosterResp = ({ g, c }) => { const rs = DB.responses(g.id); return DB.students(c.id).map(s => rs[s.id]).filter(Boolean); };
    const all = groups.flatMap(rosterResp);
    const qcells = rs => items.map(q => QTypes.isQuestion(q) ? pc(avg(q, rs)) : '<td></td>').join('');
    let html = `<thead><tr><th class="namecol" style="background:var(--panel)"><span class="sr">Name</span></th><th class="tot">TOTALS</th>${items.map((q, i) =>
      `<th class="qh"><button data-q="${q.id}" title="${esc(MathText.plain(q.prompt).slice(0, 80))}" aria-label="Question ${i + 1} details">${i + 1}</button></th>`).join('')}</tr></thead><tbody>
      <tr class="avg"><td class="namecol" style="padding-left:24px">Average</td>${pc(avgTotal(items, all))}${qcells(all)}</tr>`;
    groups.forEach(grp => {
      const { g, c } = grp, st = DB.status(g), open = expanded.has(c.id), rs = DB.responses(g.id);
      html += `<tr><td class="namecol"><div class="rname">
        <button class="caret" data-exp="${c.id}" aria-expanded="${open}" aria-label="${open ? 'Hide' : 'Show'} students in ${esc(c.name)}">${icon(open ? 'chevU' : 'chevD', 'sm')}</button>
        <span class="cbadge sm">${esc(c.short)}</span><span class="lbl" title="${esc(c.name)}">${esc(c.name)}</span>
        <button class="stpill st-${st.key}" data-menu="${g.id}" aria-haspopup="menu" aria-label="${esc(st.label)}. Assignment options" title="${esc(st.label)}">${icon(st.icon, 'sm')}${icon('caret', 'sm')}</button>
      </div></td>${pc(avgTotal(items, rosterResp(grp)))}${qcells(rosterResp(grp))}</tr>`;
      if(!open) return;
      let sts = DB.students(c.id);
      if(sort === 'last') sts.sort((a, b) => last(a.name).localeCompare(last(b.name)));
      if(sort === 'high' || sort === 'low'){
        const t = s => { const v = QTypes.total(items, rs[s.id]); return v == null ? -1 : v; };
        sts.sort((a, b) => sort === 'high' ? t(b) - t(a) : t(a) - t(b));
      }
      if(!sts.length) html += `<tr><td class="namecol"><div class="rname sub muted">No students yet. <a href="#/classes">Add a roster</a></div></td><td colspan="${items.length + 1}"></td></tr>`;
      sts.forEach(s => {
        const r = rs[s.id], tot = r ? QTypes.total(items, r) : null;
        const ss = !r ? '' : r.submitted ? `<span class="sstat done" title="Submitted">${icon('check', 'sm')}</span>` : `<span class="sstat prog" title="In progress">${icon('circle', 'sm')}</span>`;
        html += `<tr><td class="namecol"><div class="rname sub">${avatar(s.name, 26)}<span class="lbl">${esc(s.name)}${s.added ? ' <span class="small faint">(joined)</span>' : ''}</span>${ss}</div></td>
          <td>${tot == null ? '' : tot + '%'}</td>${items.map((q, i) => QTypes.isQuestion(q) ? `<td>${cell(g, s, q, i, r)}</td>` : '<td></td>').join('')}</tr>`;
      });
    });
    return html + '</tbody>';
  }
  function cell(g, s, q, i, r){
    const x = QTypes.result(q, r);
    if(!x || x.state === 'none') return '';
    const v = r.answers ? r.answers[q.id] : undefined, txt = QTypes.answerText(q, v);
    const words = { ok: 'correct', no: 'incorrect', part: 'partly correct', ung: 'needs grading', blank: 'no answer' };
    const inner = x.state === 'blank' ? icon('ban') : x.state === 'ung' ? `${icon('pencil', 'sm')}<span>${MathText.html(txt)}</span>` : `<span>${MathText.html(txt)}</span>`;
    return `<button class="rc ${x.state}" data-cell="${g.id}|${s.id}|${q.id}" aria-label="${esc(s.name)}, question ${i + 1}: ${esc(MathText.plain(txt) || 'no answer')}, ${words[x.state]}">${inner}</button>`;
  }

  function gradeModal(gid, sid, qid){
    const g = Store.get('assignments/' + gid), act = Store.get('activities/' + g.activityId);
    const q = act.questions.find(x => x.id === qid), n = act.questions.indexOf(q) + 1;
    const s = Store.get(`classes/${g.classId}/students/${sid}`) || { name: 'Student' };
    const r = DB.responses(gid)[sid] || {}, x = QTypes.result(q, r), key = keyText(q);
    const v = r.answers ? r.answers[qid] : undefined;
    showModal({ title: `${s.name} · Question ${n}`, body: `
      <div class="prompt" style="font-size:1rem">${MathText.html(q.prompt)}</div>
      <p><b>Answer:</b> ${QTypes.blank(v) ? '<span class="muted">no answer</span>' : MathText.html(QTypes.answerText(q, v))}</p>
      ${key ? `<p><b>Correct answer:</b> ${MathText.html(key)}</p>` : ''}
      <p class="muted">${x.state === 'ung' ? 'Not graded yet.' : `Score: ${x.earned} of ${q.points} point${q.points == 1 ? '' : 's'}${x.override ? ' (set by you)' : ''}.`}</p>
      <label class="field">Points</label><input class="input" type="number" name="pts" min="0" max="${q.points}" step="0.5" style="width:120px" value="${x.state === 'ung' ? '' : x.earned}">`,
      actions: [
        ...(x.override ? [{ label: 'Use automatic grade', cls: 'ghost', onClick: () => Store.remove(`responses/${gid}/${sid}/scores/${qid}`) }] : []),
        { label: 'Incorrect', cls: 'ghost', onClick: () => Store.set(`responses/${gid}/${sid}/scores/${qid}`, 0) },
        { label: 'Correct', cls: 'ghost', onClick: () => Store.set(`responses/${gid}/${sid}/scores/${qid}`, Number(q.points) || 0) },
        { label: 'Save points', onClick: m => {
          const p = Number(m.querySelector('[name=pts]').value);
          if(isNaN(p) || p < 0 || p > Number(q.points)){ toast('Enter 0 to ' + q.points); return false; }
          Store.set(`responses/${gid}/${sid}/scores/${qid}`, p);
        } },
      ] });
  }
  function questionModal(act, qid){
    const q = act.questions.find(x => x.id === qid), n = act.questions.indexOf(q) + 1, key = QTypes.isQuestion(q) ? keyText(q) : '';
    const rows = classes(act).map(({ g, c }) => {
      const rs = DB.students(c.id).map(s => DB.responses(g.id)[s.id]).filter(Boolean);
      const answered = rs.filter(r => r.answers && !QTypes.blank(r.answers[q.id])).length, p = avg(q, rs);
      return `<tr><td style="padding:6px 12px 6px 0">${esc(c.name)}</td><td style="padding:6px 12px">${answered} answered</td><td style="padding:6px 0">${p == null ? '' : p + '% correct'}</td></tr>`;
    }).join('');
    showModal({ title: `Question ${n} · ${QTypes.T[q.type].label}`, body: `<div class="prompt" style="font-size:1rem">${MathText.html(q.prompt) || '<span class="muted">(no text)</span>'}</div>
      ${key ? `<p><b>Correct answer:</b> ${MathText.html(key)}</p>` : ''}
      ${QTypes.isQuestion(q) ? `<table class="small" style="border-collapse:collapse;margin-top:8px">${rows}</table>` : ''}`,
      actions: [{ label: 'Edit question', cls: 'ghost', onClick: () => { location.hash = '#/a/' + act.id + '/edit'; } }, { label: 'Close' }] });
  }

  function render(id){
    if(!Store.get('activities/' + id)){ location.hash = '#/activities'; return; }
    const body = ActivityPage.frame(id, 'responses');
    body.innerHTML = `<div class="rtools">
        <label style="display:flex;align-items:center;gap:8px;color:var(--blue-text);font-weight:600">${icon('sortAZ')}<span class="sr">Sort students</span>
          <select class="select" name="sort" style="width:auto;border:0;background-color:transparent;color:inherit;font-weight:600">
            <option value="first">First name</option><option value="last">Last name</option><option value="high">Score: high to low</option><option value="low">Score: low to high</option></select></label>
        <button class="btn outline" data-csv>${icon('download', 'sm')}Export CSV</button>
      </div>
      <div class="legend"><span><i style="background:var(--green-bar)"></i>Correct</span><span><i style="background:var(--red-bar)"></i>Incorrect</span>
        <span><i style="background:var(--amber-bar)"></i>Partly correct</span><span><i style="background:var(--chip)"></i>Needs grading</span>
        <span>${icon('ban', 'sm')} Submitted with no answer</span><span>Click any answer to change its points.</span></div>
      <div class="scrollx" style="padding:0 24px"><table class="rgrid"></table></div>`;
    const tbl = body.querySelector('.rgrid');
    const draw = () => { const act = Store.get('activities/' + id); if(act) tbl.innerHTML = table(act); };
    body.querySelector('[name=sort]').value = sort;
    body.querySelector('[name=sort]').onchange = e => { sort = e.target.value; draw(); };
    body.querySelector('[data-csv]').onclick = () => exportCSV(id);
    body.addEventListener('click', e => {
      const b = e.target.closest('button'); if(!b) return;
      if(b.dataset.exp){ expanded.has(b.dataset.exp) ? expanded.delete(b.dataset.exp) : expanded.add(b.dataset.exp); keep(); draw();
        const nb = tbl.querySelector(`[data-exp="${b.dataset.exp}"]`); if(nb) nb.focus(); }
      else if(b.dataset.menu) Assign.menu(b, Store.get('assignments/' + b.dataset.menu));
      else if(b.dataset.cell){ const [g, s, q] = b.dataset.cell.split('|'); gradeModal(g, s, q); }
      else if(b.dataset.q) questionModal(Store.get('activities/' + id), b.dataset.q);
      else if(b.dataset.assign != null) Assign.dialog(id);
    });
    draw();
    const redraw = debounce(draw, 120);
    ['responses', 'assignments', 'classes', 'activities/' + id].forEach(p => App.onLeave(Store.subscribe(p, redraw)));
  }

  function exportCSV(activityId, classIds){
    const act = Store.get('activities/' + activityId); if(!act) return;
    const items = act.questions.map((q, i) => ({ q, n: i + 1 })).filter(x => QTypes.isQuestion(x.q));
    const head = ['Class', 'Student', 'Status', 'Score (%)', 'Points', 'Possible'];
    items.forEach(({ q, n }) => head.push(`Q${n}: ${MathText.plain(q.prompt).replace(/\s+/g, ' ').slice(0, 60)}`, `Q${n} points (of ${q.points})`));
    const rows = [head];
    classes(act).filter(({ c }) => !classIds || classIds.includes(c.id)).forEach(({ g, c }) => {
      const rs = DB.responses(g.id);
      DB.students(c.id).forEach(s => {
        const r = rs[s.id]; let e = 0, p = 0;
        const cells = items.flatMap(({ q }) => {
          const x = QTypes.result(q, r); if(x){ e += x.earned; p += x.possible; }
          const v = r && r.answers ? r.answers[q.id] : undefined;
          return [MathText.plain(QTypes.answerText(q, v)), !x || x.state === 'none' ? '' : x.state === 'ung' ? 'needs grading' : x.earned];
        });
        rows.push([c.name, s.name, !r ? 'Not started' : r.submitted ? 'Submitted' : 'In progress', p ? Math.round(100 * e / p) : '', r ? e : '', r ? p : ''].concat(cells));
      });
    });
    const suffix = classIds && classIds.length === 1 ? '-' + fileSafe(Store.get('classes/' + classIds[0]).short) : '';
    downloadFile(fileSafe(act.title) + suffix + '-responses.csv', '﻿' + toCSV(rows), 'text/csv');
    toast('CSV downloaded');
  }
  return { render, exportCSV, keyText };
})();
