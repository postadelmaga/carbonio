/* Tema chiaro/scuro: lo stesso valore "tema" in localStorage usato da CO₂·info
   e l'Atlante del clima, cosi' la scelta vale su tutto il sito. */
(function () {
  var root = document.documentElement;
  function saved() { try { return localStorage.getItem('tema'); } catch (e) { return null; } }
  function dark() {
    var t = root.getAttribute('data-theme');
    if (t) return t === 'dark';
    return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;
  }
  var t = saved();
  if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t);
  document.addEventListener('DOMContentLoaded', function () {
    var b = document.getElementById('theme');
    if (!b) return;
    function label() { b.setAttribute('aria-label', dark() ? 'Tema chiaro' : 'Tema scuro'); b.title = b.getAttribute('aria-label'); }
    label();
    b.addEventListener('click', function () {
      var n = dark() ? 'light' : 'dark';
      root.setAttribute('data-theme', n);
      try { localStorage.setItem('tema', n); } catch (e) {}
      label();
    });
  });
})();
