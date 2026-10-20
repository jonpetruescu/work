'use strict';
/* Router. Each screen registers clean-up work (listeners, timers) with App.onLeave. */
const App = {
  root: null,
  cleanups: [],
  onLeave(fn){ this.cleanups.push(fn); },
  leave(){
    closeMenu(); closeModal();
    this.cleanups.splice(0).forEach(f => { try{ f(); } catch(e){ console.error(e); } });
    document.querySelectorAll('.mathpop,.pausewall').forEach(e => e.remove());
  },
  route(){
    this.leave();
    const p = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    const titles = { classes: 'Classes', reports: 'Reports & export', a: p[2] === 'responses' ? 'Responses' : 'Edit', live: 'Live lesson', preview: 'Preview', j: 'Join' };
    document.title = (titles[p[0]] || 'Activities') + ' · Checkpoint';
    window.scrollTo(0, 0);
    try{
      if(p[0] === 'j' && p[1]) return Student.join(p[1], p[2]);
      if(p[0] === 'a' && p[1]) return p[2] === 'responses' ? Responses.render(p[1]) : Editor.render(p[1]);
      if(p[0] === 'live' && p[1]) return Live.render(p[1]);
      if(p[0] === 'preview' && p[1]) return Student.preview(p[1]);
      if(p[0] === 'classes') return Classes.render();
      if(p[0] === 'reports') return Reports.render();
      if(p[0] !== 'activities'){ location.replace('#/activities'); return; }
      Activities.render();
    } catch(err){
      console.error(err);
      this.root.innerHTML = `<div class="page"><h1>Something went wrong</h1><p class="muted">${esc(err.message)}</p><p><a href="#/activities">Back to activities</a></p></div>`;
    }
  },
};
App.root = document.getElementById('app');
window.addEventListener('hashchange', () => App.route());
App.route();
