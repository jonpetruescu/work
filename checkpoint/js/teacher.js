'use strict';
/* Teacher screens: shell, Activities list, Classes, Reports & export, and shared assignment actions. */

const Shell = {
  side(active){
    const links = [['activities', 'grid', 'Activities'], ['classes', 'classes', 'Classes'], ['reports', 'chart', 'Reports & export']];
    const name = (Store.get('teacher') || {}).name || 'Teacher';
    return `<aside class="side" aria-label="Main menu">
      <div class="brand"><span class="mark">${icon('check', 'sm')}</span><div>Checkpoint<small>mrpetruescu.com</small></div></div>
      <nav class="nav">${links.map(([k, ic, l]) => `<a href="#/${k}"${k === active ? ' aria-current="page"' : ''}>${icon(ic)}${l}</a>`).join('')}</nav>
      <div class="grow"></div>
      <div class="acct"><div class="who">${avatar(name)}${esc(name)}</div>
        <span class="pill">Prototype · saved in this browser</span></div>
    </aside>`;
  },
  mount(active, html, bare){
    App.root.innerHTML = `<div class="app${bare ? ' bare' : ''}">${this.side(active)}<div class="scrim" data-drawer></div><main class="main" id="main">${html}</main></div>`;
    return App.root.querySelector('#main');
  },
  head(inner){ return `<div class="pagehead"><button class="ibtn menu-toggle" data-drawer aria-label="Menu">${icon('menu')}</button>${inner}</div>`; },
};
document.addEventListener('click', e => {
  if(e.target.closest('[data-drawer]')){ const a = document.querySelector('.app'); if(a) a.classList.toggle('drawer'); }
  else if(e.target.closest('.side a')){ const a = document.querySelector('.app'); if(a) a.classList.remove('drawer'); }
});

/* ---------- Assignment actions, shared by the Activities grid, Responses and Live screens ---------- */
const Assign = {
  menu(anchor, g){
    const cls = Store.get('classes/' + g.classId) || { name: 'Class' };
    const st = DB.status(g), items = [{ header: cls.name + ' · ' + st.label }];
    if(g.mode === 'teacher') items.push({ icon: 'present', label: g.open ? 'Run live lesson' : 'Open and run live lesson', onClick: () => { Assign.setOpen(g, true); location.hash = '#/live/' + g.id; } });
    items.push(
      { icon: 'gear', label: 'Adjust settings', onClick: () => Assign.settings(g) },
      { icon: 'checkAll', label: 'Submit for students', onClick: () => Assign.submitAll(g) },
      g.paused ? { icon: 'play', label: 'Resume assignment', onClick: () => Assign.pause(g, false) }
               : { icon: 'pause', label: 'Pause assignment', onClick: () => Assign.pause(g, true) },
      g.mode === 'teacher' ? { icon: 'bolt', label: 'Switch to student-paced', onClick: () => Assign.mode(g, 'student') }
                           : { icon: 'present', label: 'Switch to teacher-paced', onClick: () => Assign.mode(g, 'teacher') },
      g.open ? { icon: 'lock', label: 'Lock assignment', onClick: () => Assign.setOpen(g, false) }
             : { icon: 'bolt', label: 'Open assignment', onClick: () => Assign.setOpen(g, true) },
      { icon: 'spin', label: 'Spin for a student', onClick: () => Assign.spin(g) },
      { icon: 'link', label: 'Copy join link', onClick: () => copyText(DB.joinLink(cls), 'Join link') },
      { icon: 'users', label: 'Manage class', onClick: () => { location.hash = '#/classes'; } },
      '-',
      { icon: 'download', label: 'Export this class (CSV)', onClick: () => Responses.exportCSV(g.activityId, [g.classId]) },
      { icon: 'trash', label: 'Unassign from this class', onClick: () => Assign.unassign(g) },
    );
    showMenu(anchor, items);
  },
  setOpen(g, open){ Store.update('assignments/' + g.id, { open, paused: open ? g.paused : false }); DB.setLive(g.id, {}); toast(open ? 'Assignment open' : 'Assignment locked'); },
  pause(g, paused){ Store.update('assignments/' + g.id, { paused }); DB.setLive(g.id, {}); toast(paused ? 'Students paused' : 'Students resumed'); },
  mode(g, mode){
    Store.update('assignments/' + g.id, { mode });
    DB.setLive(g.id, { index: -1, startedAt: null, ended: false });
    toast(mode === 'teacher' ? 'Now teacher-paced' : 'Now student-paced');
  },
  submitAll(g){
    const rs = DB.responses(g.id), ids = Object.keys(rs).filter(id => !rs[id].submitted);
    if(!ids.length){ toast('Everyone who started has already submitted'); return; }
    showModal({ title: 'Submit for students?', body: `<p>This turns in the work of ${ids.length} student${ids.length > 1 ? 's' : ''} who started but haven't submitted.</p>`,
      actions: [{ label: 'Cancel', cls: 'ghost' }, { label: 'Submit', onClick: () => { ids.forEach(id => Store.update(`responses/${g.id}/${id}`, { submitted: true })); toast('Submitted'); } }] });
  },
  spin(g){
    const names = DB.students(g.classId).map(s => s.name);
    if(!names.length){ toast('This class has no students yet'); return; }
    const pick = () => names[Math.floor(Math.random() * names.length)];
    showModal({ title: 'Spin for a student', body: `<p class="spinname" style="font-size:2rem;font-weight:800;text-align:center;margin:20px 0">${esc(pick())}</p>`,
      actions: [{ label: 'Close', cls: 'ghost' }, { label: 'Spin again', onClick: m => { m.querySelector('.spinname').textContent = pick(); return false; } }] });
  },
  settings(g){
    const cls = Store.get('classes/' + g.classId);
    showModal({ title: 'Settings · ' + cls.name, body: `
      <label class="field">Pacing</label>
      <select class="select" name="mode"><option value="student">Student-paced: students move at their own pace</option><option value="teacher">Teacher-paced: you control the question</option></select>
      <p class="hint">Show correct answers to students after they submit, due dates and time limits are planned for Phase 2 (see PLAN.md).</p>`,
      onOpen: m => { m.querySelector('[name=mode]').value = g.mode; },
      actions: [{ label: 'Cancel', cls: 'ghost' }, { label: 'Save', onClick: m => { const v = m.querySelector('[name=mode]').value; if(v !== g.mode) Assign.mode(g, v); } }] });
  },
  unassign(g){
    const n = Object.keys(DB.responses(g.id)).length, cls = Store.get('classes/' + g.classId);
    showModal({ title: 'Unassign from ' + cls.name + '?', body: n ? `<p><b>${n} student response${n > 1 ? 's' : ''} will be deleted.</b> Export first if you want to keep them.</p>` : '<p>No one has responded yet.</p>',
      actions: [{ label: 'Cancel', cls: 'ghost' }, { label: 'Unassign', cls: 'danger', onClick: () => { DB.unassign(g.id); toast('Unassigned'); } }] });
  },
  /* Choose classes for an activity. */
  dialog(activityId, onlyClass){
    const act = Store.get('activities/' + activityId), classes = DB.classes();
    const rows = classes.map(c => {
      const g = DB.assignment(activityId, c.id), on = g || c.id === onlyClass;
      return `<label style="display:flex;gap:12px;align-items:center;padding:8px 0;border-bottom:1px solid var(--line)">
        <input type="checkbox" name="c" value="${c.id}"${on ? ' checked' : ''} style="width:18px;height:18px">
        <span class="cbadge sm">${esc(c.short)}</span><span style="flex:1">${esc(c.name)}</span>
        <span class="small muted">${g ? esc(DB.status(g).label) : ''}</span></label>`;
    }).join('');
    showModal({ title: 'Assign “' + act.title + '”', body: `${rows || '<p>Make a class first on the Classes page.</p>'}
      <div style="margin-top:16px"><label class="field">For newly assigned classes</label>
      <select class="select" name="mode"><option value="student">Student-paced</option><option value="teacher">Teacher-paced</option></select>
      <label style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" name="open" checked> Open it now</label></div>`,
      actions: [{ label: 'Cancel', cls: 'ghost' }, { label: 'Save', onClick: m => {
        const mode = m.querySelector('[name=mode]').value, open = m.querySelector('[name=open]').checked;
        const want = new Set([...m.querySelectorAll('[name=c]:checked')].map(i => i.value));
        let drop = [];
        classes.forEach(c => {
          const g = DB.assignment(activityId, c.id);
          if(want.has(c.id) && !g){ const id = DB.assign(activityId, c.id, mode); if(open) Store.update('assignments/' + id, { open: true }); }
          if(!want.has(c.id) && g) drop.push(g);
        });
        DB.touch(activityId);
        if(drop.length === 1) setTimeout(() => Assign.unassign(drop[0]));
        else if(drop.length) drop.forEach(g => DB.unassign(g.id));
        if(open && mode === 'teacher' && want.size === 1 && !drop.length){
          const g = DB.assignment(activityId, [...want][0]); if(g && g.mode === 'teacher') location.hash = '#/live/' + g.id;
        }
      } }] });
  },
};

/* ---------- Activities ---------- */
const Activities = (() => {
  let q = '', sort = 'updated', show = 'all';
  const selected = new Set();
  function rowsHtml(){
    const classes = DB.classes();
    let acts = DB.activities().filter(a => a.title.toLowerCase().includes(q.toLowerCase()));
    if(show === 'open') acts = acts.filter(a => DB.assignmentsFor(a.id).some(g => g.open));
    if(sort === 'oldest') acts.reverse();
    if(sort === 'title') acts.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }));
    if(!acts.length) return `<tr><td colspan="${classes.length + 1}"><div class="empty">${q ? 'No activities match “' + esc(q) + '”.' : 'No activities yet. Press <b>Create</b> to make one.'}</div></td></tr>`;
    return acts.map(a => `<tr>
      <td><div class="title"><input type="checkbox" aria-label="Select ${esc(a.title)}" data-sel="${a.id}"${selected.has(a.id) ? ' checked' : ''}>
        ${icon('lines', 'sm')}<div><a href="#/a/${a.id}/edit">${esc(a.title)}</a><div class="sub">Last updated ${timeAgo(a.updatedAt)}</div></div></div></td>
      ${classes.map(c => {
        const g = DB.assignment(a.id, c.id);
        if(!g) return `<td class="cls"><button class="assign-here" data-assign="${a.id}" data-cls="${c.id}" aria-label="Assign ${esc(a.title)} to ${esc(c.name)}">+ Assign</button></td>`;
        const st = DB.status(g), rs = DB.responses(g.id);
        const n = Object.values(rs).filter(r => r.answers && Object.keys(r.answers).length).length;
        return `<td class="cls"><div class="acell">
          <button class="st-${st.key}" data-menu="${g.id}" aria-haspopup="menu" aria-label="${esc(c.name)}: ${st.label}. Change" title="${st.label}">${icon(st.icon, 'sm')}</button>
          <span class="count" title="${n} student${n === 1 ? '' : 's'} responded">${n}</span>
          <button class="goto" data-go="${g.mode === 'teacher' && g.open ? '#/live/' + g.id : '#/a/' + a.id + '/responses'}" aria-label="Open responses for ${esc(c.name)}" title="${g.mode === 'teacher' && g.open ? 'Run live lesson' : 'Responses'}">${icon(g.mode === 'teacher' && g.open ? 'present' : 'goto', 'sm')}</button>
        </div></td>`;
      }).join('')}</tr>`).join('');
  }
  function bulkHtml(){
    if(!selected.size) return '';
    return `<span class="small muted">${selected.size} selected</span><button class="btn ghost sm" data-bulk="dup">${icon('copy', 'sm')}Duplicate</button><button class="btn ghost sm" data-bulk="del">${icon('trash', 'sm')}Delete</button>`;
  }
  function render(){
    const classes = DB.classes();
    const main = Shell.mount('activities', Shell.head(`
      <label class="search">${icon('search')}<span class="sr">Search activities</span><input type="search" placeholder="Search activities" value="${esc(q)}"></label>
      <div class="end"><span class="bulk" style="display:flex;gap:8px;align-items:center">${bulkHtml()}</span><button class="btn" data-create>Create ${icon('plus', 'sm')}</button></div>`) + `
      <div class="filters">
        <select class="select" aria-label="Show" name="show"><option value="all">All activities</option><option value="open">Open in at least one class</option></select>
        <select class="select" aria-label="Sort" name="sort"><option value="updated">Date updated: Newest first</option><option value="oldest">Date updated: Oldest first</option><option value="title">Title: A–Z</option></select>
      </div>
      <div class="scrollx"><table class="agrid"><thead><tr><th class="titlecol"><span class="sr">Activity</span></th>
        ${classes.map(c => `<th class="cls"><a href="#/classes" class="cbadge" title="${esc(c.name)}" style="text-decoration:none">${esc(c.short)}</a></th>`).join('')}
      </tr></thead><tbody>${rowsHtml()}</tbody></table></div>
      ${classes.length ? '' : '<div class="empty">Add a class on the <a href="#/classes">Classes</a> page to assign activities.</div>'}`);
    main.querySelector('[name=sort]').value = sort;
    main.querySelector('[name=show]').value = show;
    const tbody = main.querySelector('tbody'), refresh = () => { tbody.innerHTML = rowsHtml(); main.querySelector('.bulk').innerHTML = bulkHtml(); };
    main.querySelector('input[type=search]').addEventListener('input', e => { q = e.target.value; refresh(); });
    main.querySelector('[name=sort]').onchange = e => { sort = e.target.value; refresh(); };
    main.querySelector('[name=show]').onchange = e => { show = e.target.value; refresh(); };
    main.addEventListener('click', e => {
      const t = e.target.closest('button,input'); if(!t) return;
      if(t.dataset.create != null) create();
      else if(t.dataset.menu) Assign.menu(t, Store.get('assignments/' + t.dataset.menu));
      else if(t.dataset.go) location.hash = t.dataset.go;
      else if(t.dataset.assign) Assign.dialog(t.dataset.assign, t.dataset.cls);
      else if(t.dataset.sel){ t.checked ? selected.add(t.dataset.sel) : selected.delete(t.dataset.sel); main.querySelector('.bulk').innerHTML = bulkHtml(); }
      else if(t.dataset.bulk === 'dup'){ selected.forEach(id => duplicate(id)); selected.clear(); }
      else if(t.dataset.bulk === 'del') removeSelected();
    });
    App.onLeave(Store.subscribe('activities', refresh));
    App.onLeave(Store.subscribe('assignments', refresh));
    App.onLeave(Store.subscribe('responses', refresh));
  }
  function create(){
    const n = DB.activities().filter(a => /^Untitled activity/.test(a.title)).length + 1;
    const id = 'a_' + uid(8);
    Store.set('activities/' + id, { id, title: 'Untitled activity ' + n, createdAt: Date.now(), updatedAt: Date.now(), questions: [QTypes.T.mc.make()] });
    location.hash = '#/a/' + id + '/edit';
  }
  function duplicate(id){
    const a = JSON.parse(JSON.stringify(Store.get('activities/' + id))), nid = 'a_' + uid(8);
    a.id = nid; a.title += ' (copy)'; a.createdAt = a.updatedAt = Date.now();
    a.questions.forEach(x => { x.id = uid(8); });
    Store.set('activities/' + nid, a); toast('Duplicated'); return nid;
  }
  function removeSelected(){
    const ids = [...selected], n = ids.reduce((s, id) => s + DB.assignmentsFor(id).reduce((t, g) => t + Object.keys(DB.responses(g.id)).length, 0), 0);
    showModal({ title: `Delete ${ids.length} activit${ids.length > 1 ? 'ies' : 'y'}?`, body: `<p>This can't be undone.${n ? ` <b>${n} student response${n > 1 ? 's' : ''} will be deleted too.</b>` : ''}</p>`,
      actions: [{ label: 'Cancel', cls: 'ghost' }, { label: 'Delete', cls: 'danger', onClick: () => {
        ids.forEach(id => { DB.assignmentsFor(id).forEach(g => DB.unassign(g.id)); Store.remove('activities/' + id); });
        selected.clear(); toast('Deleted');
      } }] });
  }
  return { render, create, duplicate };
})();

/* ---------- Classes ---------- */
const Classes = (() => {
  function card(c){
    const sts = DB.students(c.id);
    return `<section class="card" data-cid="${c.id}">
      <h3><span class="cbadge sm">${esc(c.short)}</span><span style="flex:1">${esc(c.name)}</span>
        <button class="ibtn sm" data-act="menu" aria-label="Class options">${icon('kebab', 'sm')}</button></h3>
      <div class="small muted" style="margin-top:4px">${sts.length} student${sts.length === 1 ? '' : 's'} · join code <b>${esc(c.code)}</b></div>
      <div class="linkrow"><code>${esc(DB.joinLink(c))}</code><button class="btn ghost sm" data-act="copy">${icon('copy', 'sm')}Copy</button></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
        <a class="btn outline sm" href="${esc(DB.joinLink(c))}" target="_blank" rel="noopener">${icon('eye', 'sm')}Open as a student</a>
      </div>
      <label class="field" for="r_${c.id}">Roster, one name per line</label>
      <textarea id="r_${c.id}" spellcheck="false">${esc(sts.map(s => s.name).join('\n'))}</textarea>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;gap:8px;flex-wrap:wrap">
        <span class="small muted">${sts.some(s => s.added) ? 'Names students typed in themselves are kept here too.' : 'Students pick their name when they join.'}</span>
        <button class="btn sm" data-act="save">Save roster</button></div>
    </section>`;
  }
  function render(){
    const main = Shell.mount('classes', Shell.head(`<h1 style="font-size:1.2rem;margin:0">Classes</h1><div class="end"><button class="btn" data-act="add">Add class ${icon('plus', 'sm')}</button></div>`)
      + `<div class="page"><p class="muted" style="margin:0 0 16px;max-width:720px">Give each class its join link. Students open it, pick their name, and see whatever you've opened for that class. Once this is hosted, links will look like <b>checkpoint.mrpetruescu.com/j/CODE</b>.</p><div class="cards"></div></div>`);
    const draw = () => { main.querySelector('.cards').innerHTML = DB.classes().map(card).join('') || '<div class="empty">No classes yet.</div>'; };
    draw();
    main.addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if(!b) return;
      const cid = b.closest('[data-cid]') && b.closest('[data-cid]').dataset.cid, c = cid && Store.get('classes/' + cid);
      if(b.dataset.act === 'add') edit(null);
      if(b.dataset.act === 'copy') copyText(DB.joinLink(c), 'Join link');
      if(b.dataset.act === 'save') saveRoster(c, b.closest('.card').querySelector('textarea').value);
      if(b.dataset.act === 'menu') showMenu(b, [
        { icon: 'pencil', label: 'Rename', onClick: () => edit(c) },
        { icon: 'refresh', label: 'Make a new join link', onClick: () => showModal({ title: 'Make a new join link?', body: '<p>The old link stops working. Students already signed in stay signed in.</p>',
          actions: [{ label: 'Cancel', cls: 'ghost' }, { label: 'New link', onClick: () => Store.update('classes/' + c.id, { code: c.short.replace(/\W/g, '').toUpperCase().slice(0, 2) + uid(4).toUpperCase() }) }] }) },
        '-',
        { icon: 'trash', label: 'Delete class', onClick: () => removeClass(c) },
      ]);
    });
    App.onLeave(Store.subscribe('classes', () => { if(!main.contains(document.activeElement) || document.activeElement.tagName !== 'TEXTAREA') draw(); }));
  }
  function saveRoster(c, text){
    const names = [...new Set(text.split('\n').map(s => s.trim()).filter(Boolean))];
    const cur = DB.students(c.id), byName = new Map(cur.map(s => [s.name.toLowerCase(), s]));
    const next = {};
    names.forEach(n => { const s = byName.get(n.toLowerCase()); const id = s ? s.id : 's_' + uid(8); next[id] = Object.assign({}, s || {}, { id, name: n }); });
    const gone = cur.filter(s => !next[s.id]);
    const apply = () => { Store.set(`classes/${c.id}/students`, next); toast('Roster saved'); };
    if(gone.length) showModal({ title: `Remove ${gone.length} student${gone.length > 1 ? 's' : ''}?`, body: `<p>${gone.map(s => esc(s.name)).join(', ')}</p><p class="muted">Their answers stay saved, but they won't show in Responses or exports.</p>`,
      actions: [{ label: 'Cancel', cls: 'ghost' }, { label: 'Remove', cls: 'danger', onClick: apply }] });
    else apply();
  }
  function edit(c){
    showModal({ title: c ? 'Rename class' : 'Add class', body: `<label class="field">Class name</label><input class="input" name="n" value="${esc(c ? c.name : '')}" placeholder="IM1A Intervention: Thursday">
      <label class="field" style="margin-top:12px">Short label for column headers (2–3 letters)</label><input class="input" name="s" maxlength="3" style="width:100px" value="${esc(c ? c.short : '')}" placeholder="TH">`,
      actions: [{ label: 'Cancel', cls: 'ghost' }, { label: c ? 'Save' : 'Add', onClick: m => {
        const name = m.querySelector('[name=n]').value.trim(), short = (m.querySelector('[name=s]').value.trim() || name.slice(0, 2)).toUpperCase();
        if(!name){ toast('Give the class a name'); return false; }
        if(c) Store.update('classes/' + c.id, { name, short });
        else { const id = 'c_' + uid(8); Store.set('classes/' + id, { id, name, short, code: short.replace(/\W/g, '').slice(0, 2) + uid(4).toUpperCase(), order: DB.classes().length, students: {} }); }
      } }] });
  }
  function removeClass(c){
    const gs = Store.list('assignments').filter(g => g.classId === c.id);
    showModal({ title: 'Delete ' + c.name + '?', body: `<p>This removes the class, its roster, and its responses on ${gs.length} activit${gs.length === 1 ? 'y' : 'ies'}. Export first to keep them.</p>`,
      actions: [{ label: 'Cancel', cls: 'ghost' }, { label: 'Delete', cls: 'danger', onClick: () => { gs.forEach(g => DB.unassign(g.id)); Store.remove('classes/' + c.id); } }] });
  }
  return { render };
})();

/* ---------- Reports & export ---------- */
const Reports = (() => {
  function gradebook(){
    const acts = DB.activities().slice().reverse(), rows = [['Class', 'Student'].concat(acts.map(a => a.title + ' (%)'))];
    DB.classes().forEach(c => DB.students(c.id).forEach(s => {
      rows.push([c.name, s.name].concat(acts.map(a => {
        const g = DB.assignment(a.id, c.id); if(!g) return '';
        const t = QTypes.total(a.questions, DB.responses(g.id)[s.id]); return t == null ? '' : t;
      })));
    }));
    downloadFile('gradebook-' + new Date().toISOString().slice(0, 10) + '.csv', toCSV(rows), 'text/csv');
  }
  function render(){
    const acts = DB.activities();
    const main = Shell.mount('reports', Shell.head('<h1 style="font-size:1.2rem;margin:0">Reports &amp; export</h1>') + `<div class="page"><div class="exports">
      <div class="card"><div class="txt"><b>Gradebook</b><p>Every student in every class, one column per activity, as a percent. Opens in Excel or Google Sheets.</p></div><button class="btn" data-x="gb">${icon('download', 'sm')}Download CSV</button></div>
      <div class="card"><div class="txt"><b>One activity, every answer</b><p>Each student's answer and points on every question, for all classes.</p>
        <select class="select" name="act" style="margin-top:10px" aria-label="Activity">${acts.map(a => `<option value="${a.id}">${esc(a.title)}</option>`).join('')}</select></div>
        <button class="btn" data-x="one"${acts.length ? '' : ' disabled'}>${icon('download', 'sm')}Download CSV</button></div>
      <div class="card"><div class="txt"><b>Full backup</b><p>Everything (classes, activities, responses) as one file you can restore later or move to the hosted version.</p></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn outline" data-x="bak">${icon('download', 'sm')}Backup</button>
        <label class="btn ghost">${icon('upload', 'sm')}Restore<input type="file" accept="application/json,.json" hidden data-x="restore"></label></div></div>
      <div class="card"><div class="txt"><b>Start over with sample data</b><p>Replaces everything in this browser with the demo classes and activities.</p></div><button class="btn ghost" data-x="reset">Reset</button></div>
    </div></div>`);
    main.addEventListener('click', e => {
      const b = e.target.closest('button[data-x]'); if(!b) return;
      if(b.dataset.x === 'gb') gradebook();
      if(b.dataset.x === 'one') Responses.exportCSV(main.querySelector('[name=act]').value);
      if(b.dataset.x === 'bak') downloadFile('checkpoint-backup-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(Store.exportAll(), null, 1), 'application/json');
      if(b.dataset.x === 'reset') showModal({ title: 'Replace everything with sample data?', body: '<p>Download a backup first if you want to keep what is here.</p>',
        actions: [{ label: 'Cancel', cls: 'ghost' }, { label: 'Reset', cls: 'danger', onClick: () => { Store.reset(); App.route(); toast('Sample data loaded'); } }] });
    });
    main.querySelector('[data-x=restore]').addEventListener('change', async e => {
      const f = e.target.files[0]; if(!f) return;
      try{ Store.importAll(JSON.parse(await f.text())); toast('Backup restored'); App.route(); }
      catch(err){ toast(err.message || 'That file could not be read'); }
    });
  }
  return { render };
})();
