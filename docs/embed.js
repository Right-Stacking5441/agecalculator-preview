/* agecalculator.com embed loader: replaces each [data-agecalculator] with the widget iframe and keeps its height in step. */
(function () {
  var ORIGIN = 'https://agecalculator.com';
  document.querySelectorAll('[data-agecalculator]').forEach(function (el, i) {
    var f = document.createElement('iframe');
    f.src = ORIGIN + '/widget/?embed=' + i; f.title = 'Age calculator'; f.loading = 'lazy';
    f.style.cssText = 'border:0;width:100%;max-width:440px;height:760px;display:block';
    el.appendChild(f);
    window.addEventListener('message', function (e) {
      if (e.origin === ORIGIN && e.data && e.data.agecalcHeight && e.source === f.contentWindow) f.style.height = e.data.agecalcHeight + 'px';
    });
  });
})();
