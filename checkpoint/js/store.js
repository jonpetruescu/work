'use strict';
/*
  Data layer. In this prototype everything lives in localStorage and is synced between
  tabs of the same browser with BroadcastChannel, so a "student" tab and the "teacher" tab
  update each other live. The API is shaped like the hosted version (see PLAN.md):
    get(path) · set(path, value) · update(path, patch) · remove(path) · list(path) · subscribe(prefix, cb)
  Swapping in Firebase means re-implementing these six functions; screens don't change.
  Values returned by get/list are live references: treat them as read-only.
*/
const Store = (() => {
  const KEY = 'checkpoint:v1';
  const chan = ('BroadcastChannel' in window) ? new BroadcastChannel('checkpoint') : null;
  const subs = new Set();
  let pending = new Map();
  let data = load();

  function load(){ try{ const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch(e){ return null; } }
  function persist(){
    try{ localStorage.setItem(KEY, JSON.stringify(data)); }
    catch(e){ toast('Could not save. Browser storage is blocked or full.'); }
  }
  const parts = p => String(p).split('/').filter(Boolean);
  const clone = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));

  function get(path){
    let n = data;
    for(const p of parts(path)){ if(n == null) return undefined; n = n[p]; }
    return n;
  }
  function list(path){ return Object.values(get(path) || {}); }

  function write(path, fn){
    const fresh = load(); if(fresh) data = fresh;   // pick up other tabs' writes first
    const ps = parts(path); let n = data;
    for(let i = 0; i < ps.length - 1; i++){
      if(n[ps[i]] == null || typeof n[ps[i]] !== 'object') n[ps[i]] = {};
      n = n[ps[i]];
    }
    fn(n, ps[ps.length - 1]);
    persist(); notify(path);
    if(chan) chan.postMessage({ path });
  }
  const set = (path, value) => write(path, (n, k) => { n[k] = clone(value); });
  const update = (path, patch) => write(path, (n, k) => {
    n[k] = Object.assign((n[k] && typeof n[k] === 'object') ? n[k] : {}, clone(patch));
  });
  const remove = path => write(path, (n, k) => { delete n[k]; });

  function subscribe(prefix, cb){
    const s = { prefix: String(prefix), cb };
    subs.add(s);
    return () => subs.delete(s);
  }
  function notify(path){
    subs.forEach(s => {
      if(!(path.startsWith(s.prefix) || s.prefix.startsWith(path))) return;
      if(pending.has(s)) return;
      pending.set(s, true);
      queueMicrotask(() => { pending.delete(s); if(subs.has(s)) s.cb(); });
    });
  }
  function onRemote(path){ const fresh = load(); if(fresh) data = fresh; notify(path || ''); }
  if(!data){ data = seed(); persist(); }
  if(chan) chan.onmessage = e => onRemote(e.data && e.data.path);
  window.addEventListener('storage', e => { if(e.key === KEY) onRemote(''); });

  function reset(){ data = seed(); persist(); notify(''); if(chan) chan.postMessage({ path: '' }); }
  function exportAll(){ return clone(data); }
  function importAll(obj){
    if(!obj || typeof obj !== 'object' || !obj.activities || !obj.classes) throw new Error('This file is not a Checkpoint backup.');
    data = obj; persist(); notify(''); if(chan) chan.postMessage({ path: '' });
  }

  /* ---------- Sample data (made-up students) ---------- */
  function seed(){
    let r = 7; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
    const now = Date.now(), H = 3600e3, D = 24 * H;
    const opt = (text, extra) => Object.assign({ id: uid(6), text }, extra || {});
    const d = { version: 1, teacher: { name: 'Mr. Petruescu' }, classes: {}, activities: {}, assignments: {}, live: {}, presence: {}, responses: {} };

    const rosters = {
      MO: ['Ava Martinez','Ben Okafor','Carmen Liu','Diego Reyes','Elena Petrova','Felix Nguyen','Grace Kim','Hector Silva'],
      TU: ['Isla Brooks','Jamal Carter','Kenji Watanabe','Lena Fischer','Mateo Alvarez','Nora Haddad','Omar Siddiqui'],
      WE: ['Priya Shah','Quinn Taylor','Rosa Delgado','Sam Whitfield','Talia Cohen','Uriel Mendoza','Vera Popescu','Wes Johnson'],
    };
    const days = { MO: 'Monday', TU: 'Tuesday', WE: 'Wednesday' };
    Object.keys(rosters).forEach((short, i) => {
      const id = 'c_' + short.toLowerCase();
      d.classes[id] = { id, short, name: 'IM1A Intervention: ' + days[short], code: short + uid(4).toUpperCase(), order: i,
        students: Object.fromEntries(rosters[short].map(n => { const sid = 's_' + uid(8); return [sid, { id: sid, name: n }]; })) };
    });

    const mc = (prompt, opts, correct) => { const o = opts.map(t => opt(t)); return { id: uid(8), type: 'mc', prompt, points: 1, options: o, correct: o[correct].id }; };
    const multi = (prompt, opts, correct) => { const o = opts.map(t => opt(t)); return { id: uid(8), type: 'multi', prompt, points: 1, options: o, correct: correct.map(i => o[i].id) }; };
    const week9 = { id: 'a_week9', title: 'IM1Aint Week 9', updatedAt: now - H, createdAt: now - 3 * D, questions: [
      { id: uid(8), type: 'text', prompt: 'Warm-up: today we solve two-step equations.\nUndo adding or subtracting first, then multiplying or dividing.' },
      mc('Solve $$2x + 3 = 11$$', ['$$x = 4$$', '$$x = 7$$', '$$x = 5.5$$', '$$x = 16$$'], 0),
      multi('Which values are solutions to $$x^2 = 9$$? Select all that apply.', ['$$3$$', '$$-3$$', '$$9$$', '$$\\sqrt{3}$$'], [0, 1]),
      { id: uid(8), type: 'tf', prompt: 'True or false: $$\\frac{1}{2} + \\frac{1}{3} = \\frac{2}{5}$$', points: 1, answer: false },
      { id: uid(8), type: 'numeric', prompt: 'If $$f(x) = 3x - 5$$, what is $$f(4)$$?', points: 1, answer: '7', tolerance: 0 },
      { id: uid(8), type: 'short', prompt: 'What is the slope of the line $$y = -2x + 6$$?', points: 1, accept: ['-2'] },
      { id: uid(8), type: 'free', prompt: 'Explain how you know your answer to question 2 is correct.', points: 2 },
    ]};
    const hdyk = { id: 'a_hdyk1', title: 'How Do You Know? #1', updatedAt: now - 6 * D, createdAt: now - 7 * D, questions: [
      mc('Which is greater?', ['$$\\frac{3}{4}$$', '$$\\frac{2}{3}$$', 'They are equal'], 0),
      { id: uid(8), type: 'free', prompt: 'How do you know? Use a picture, numbers, or words.', points: 1 },
    ]};
    const week8 = { id: 'a_week8', title: 'IM1Aint Week 8', updatedAt: now - 7 * D, createdAt: now - 10 * D, questions: [
      mc('Which expression is equivalent to $$3(x + 4)$$?', ['$$3x + 4$$', '$$3x + 12$$', '$$x + 12$$', '$$7x$$'], 1),
      { id: uid(8), type: 'numeric', prompt: 'Evaluate $$5a - 2$$ when $$a = 3$$.', points: 1, answer: '13', tolerance: 0 },
    ]};
    [week9, hdyk, week8].forEach(a => { d.activities[a.id] = a; });

    const assign = (act, cls, mode, open, extra) => {
      const id = 'g_' + uid(8);
      d.assignments[id] = Object.assign({ id, activityId: act.id, classId: cls, mode, open, paused: false, createdAt: act.createdAt }, extra || {});
      d.live[id] = { index: -1, rev: 1, startedAt: null, ended: false };
      return id;
    };
    const fill = (gid, act, cls, share, when) => {
      const students = Object.values(d.classes[cls].students);
      d.responses[gid] = {};
      students.forEach(s => {
        if(rnd() > share) return;
        const answers = {};
        act.questions.forEach(q => {
          const good = rnd() < .62;
          if(q.type === 'mc') answers[q.id] = good ? q.correct : q.options[1 + Math.floor(rnd() * (q.options.length - 1))].id;
          else if(q.type === 'multi') answers[q.id] = good ? q.correct.slice() : [q.options[0].id];
          else if(q.type === 'tf') answers[q.id] = good ? q.answer : !q.answer;
          else if(q.type === 'numeric') answers[q.id] = good ? q.answer : String(Number(q.answer) + 2);
          else if(q.type === 'short') answers[q.id] = good ? q.accept[0] : '2';
          else if(q.type === 'free') answers[q.id] = good ? 'I plugged it back in and both sides came out the same.' : 'I just knew it.';
        });
        d.responses[gid][s.id] = { answers, scores: {}, submitted: rnd() < .85, startedAt: when, updatedAt: when + 20 * 60e3 };
      });
    };
    assign(week9, 'c_mo', 'teacher', true);
    fill(assign(week9, 'c_tu', 'teacher', false), week9, 'c_tu', .8, now - 2 * D);
    fill(assign(week9, 'c_we', 'student', false), week9, 'c_we', .7, now - D);
    ['c_mo', 'c_tu', 'c_we'].forEach(c => fill(assign(hdyk, c, 'student', true), hdyk, c, .9, now - 6 * D));
    ['c_mo', 'c_tu', 'c_we'].forEach(c => fill(assign(week8, c, 'student', false), week8, c, .75, now - 8 * D));
    return d;
  }

  /* Re-read from storage. The hosted version does a forced server read here. */
  const refresh = () => onRemote('');
  return { get, list, set, update, remove, subscribe, refresh, reset, exportAll, importAll, mode: 'local' };
})();

/* Convenience lookups used across screens */
const DB = {
  classes(){ return Store.list('classes').sort((a, b) => (a.order ?? 0) - (b.order ?? 0)); },
  students(classId){ return Object.values(Store.get(`classes/${classId}/students`) || {}).sort((a, b) => a.name.localeCompare(b.name)); },
  activities(){ return Store.list('activities').sort((a, b) => b.updatedAt - a.updatedAt); },
  assignmentsFor(activityId){ return Store.list('assignments').filter(g => g.activityId === activityId); },
  assignment(activityId, classId){ return Store.list('assignments').find(g => g.activityId === activityId && g.classId === classId); },
  classByCode(code){ return Store.list('classes').find(c => c.code.toUpperCase() === String(code).toUpperCase()); },
  joinLink(cls){ return location.origin + location.pathname + '#/j/' + cls.code; },
  responses(gid){ return Store.get('responses/' + gid) || {}; },
  touch(activityId){ Store.update('activities/' + activityId, { updatedAt: Date.now() }); },
  assign(activityId, classId, mode){
    const existing = DB.assignment(activityId, classId); if(existing) return existing.id;
    const id = 'g_' + uid(8);
    Store.set('assignments/' + id, { id, activityId, classId, mode: mode || 'student', open: false, paused: false, createdAt: Date.now() });
    Store.set('live/' + id, { index: -1, rev: 1, startedAt: null, ended: false });
    return id;
  },
  unassign(gid){ ['assignments/', 'live/', 'presence/', 'responses/'].forEach(p => Store.remove(p + gid)); },
  /* Live lesson state: every change bumps rev so the teacher can see which students have it. */
  setLive(gid, patch){
    const cur = Store.get('live/' + gid) || { index: -1, rev: 0 };
    Store.set('live/' + gid, Object.assign({}, cur, patch, { rev: (cur.rev || 0) + 1, at: Date.now() }));
  },
  status(g){
    if(!g) return null;
    if(!g.open) return { key: 'locked', icon: 'lock', label: 'Locked' };
    if(g.paused) return { key: 'paused', icon: 'pause', label: 'Paused' };
    if(g.mode === 'teacher') return { key: 'teacher', icon: 'present', label: 'Teacher-paced' };
    return { key: 'open', icon: 'bolt', label: 'Open, student-paced' };
  },
};
