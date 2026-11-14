/*
 * NelfePay - widget d'overlay de paiement réutilisable (notre « lemon.js »).
 *
 * Utilisation sur n'importe quelle page (store nelfetech, futur store de jeux
 * nelfeplay, etc.) :
 *   <script src="https://nelfeplay.com/assets/js/nelfepay.js" defer></script>
 *   <button data-nelfepay="rc-launch">Acheter</button>
 *
 * Le SKU (donc le prix, dynamique) vient de l'attribut. Un clic ouvre un modal
 * avec la carte de checkout (iframe embed). Le paiement redirige ensuite vers
 * PayPal (plein écran), puis revient sur la page de remerciement.
 */
(function () {
  var script = document.currentScript || (function () {
    var all = document.getElementsByTagName('script');
    return all[all.length - 1];
  })();
  var base;
  try { base = new URL(script.src).origin; } catch (e) { base = 'https://nelfeplay.com'; }

  var STYLE =
    '.nfp-backdrop{position:fixed;inset:0;background:rgba(3,5,10,.74);' +
    'display:flex;align-items:center;justify-content:center;z-index:2147483000;' +
    'opacity:0;transition:opacity .18s ease;padding:16px;-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}' +
    '.nfp-backdrop.nfp-open{opacity:1}' +
    '.nfp-modal{position:relative;width:460px;max-width:94vw;height:660px;max-height:92vh;' +
    'border-radius:18px;overflow:hidden;background:#0c111d;box-shadow:0 30px 90px rgba(0,0,0,.55);' +
    'transform:translateY(10px);transition:transform .18s ease}' +
    '.nfp-backdrop.nfp-open .nfp-modal{transform:none}' +
    '.nfp-frame{border:0;width:100%;height:100%;display:block;background:#0c111d}' +
    '.nfp-close{position:absolute;top:10px;right:10px;z-index:2;width:32px;height:32px;border-radius:50%;' +
    'border:0;cursor:pointer;background:rgba(255,255,255,.14);color:#fff;font-size:20px;line-height:30px;text-align:center}' +
    '.nfp-close:hover{background:rgba(255,255,255,.24)}' +
    'body.nfp-locked{overflow:hidden}';

  function injectStyle() {
    if (document.getElementById('nfp-style')) { return; }
    var s = document.createElement('style');
    s.id = 'nfp-style';
    s.textContent = STYLE;
    (document.head || document.documentElement).appendChild(s);
  }

  function locale() {
    var l = (document.documentElement.lang || '').slice(0, 2).toLowerCase();
    return l === 'fr' ? 'fr' : 'en';
  }

  var current = null;

  function close() {
    if (!current) { return; }
    var bd = current;
    current = null;
    bd.classList.remove('nfp-open');
    document.body.classList.remove('nfp-locked');
    setTimeout(function () { if (bd.parentNode) { bd.parentNode.removeChild(bd); } }, 200);
  }

  function open(sku, opts) {
    if (!sku) { return; }
    injectStyle();
    close();
    var loc = (opts && opts.locale) || locale();
    var url = base + '/' + loc + '/checkout/' + encodeURIComponent(sku) + '?embed=1';

    var bd = document.createElement('div');
    bd.className = 'nfp-backdrop';
    bd.setAttribute('role', 'dialog');
    bd.setAttribute('aria-modal', 'true');

    var modal = document.createElement('div');
    modal.className = 'nfp-modal';

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'nfp-close';
    closeBtn.setAttribute('aria-label', loc === 'fr' ? 'Fermer' : 'Close');
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', close);

    var frame = document.createElement('iframe');
    frame.className = 'nfp-frame';
    frame.src = url;
    frame.setAttribute('title', 'Checkout');
    frame.setAttribute('allow', 'payment');

    modal.appendChild(closeBtn);
    modal.appendChild(frame);
    bd.appendChild(modal);
    bd.addEventListener('click', function (e) { if (e.target === bd) { close(); } });

    document.body.appendChild(bd);
    document.body.classList.add('nfp-locked');
    current = bd;
    void bd.offsetWidth;
    bd.classList.add('nfp-open');
  }

  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { close(); } });

  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-nelfepay]') : null;
    if (!el) { return; }
    var sku = el.getAttribute('data-nelfepay');
    if (!sku) { return; }
    e.preventDefault();
    open(sku, { locale: el.getAttribute('data-nelfepay-locale') || null });
  });

  window.NelfePay = { open: open, close: close };
})();
