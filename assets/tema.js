/* tema.js — il pulsante chiaro/scuro. Sta a parte perche' lo usano sia la
   pagina principale sia la bacheca, e la seconda non ha grafici. */
(function(){
  "use strict";
  var root = document.documentElement;
  var btn  = document.getElementById('theme-toggle');
  if(!btn) return;

  function current(){
    var set = root.getAttribute('data-theme');
    if(set) return set;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function paint(){
    var d = current() === 'dark';
    btn.setAttribute('aria-pressed', String(d));
    btn.title = d ? 'Passa al tema chiaro' : 'Passa al tema scuro';
  }
  btn.addEventListener('click', function(){
    var next = current() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try{ localStorage.setItem('tema', next); }catch(e){}
    paint();
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', paint);
  paint();
})();
