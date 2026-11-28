/*
 * Checkout hébergé NelfePlay. Le formulaire collecte l'email de livraison + les
 * infos de facture ; au clic sur « Payer », on crée la commande PayPal côté
 * serveur (/api/v1/checkout/create-order) et on REDIRIGE vers PayPal. Au retour,
 * le serveur capture et le webhook émet la clé. Aucun SDK PayPal, aucun inline.
 */
(function () {
  function ready(fn) {
    if (document.readyState !== 'loading') { fn(); }
    else { document.addEventListener('DOMContentLoaded', fn); }
  }

  ready(function () {
    var form = document.getElementById('checkout-form');
    var btn = document.getElementById('co-pay');
    var errEl = document.getElementById('checkout-error');
    if (!form || !btn) { return; }

    // Affiche/masque les champs entreprise.
    var biz = document.getElementById('co-business');
    var bizFields = document.querySelectorAll('.co-business');
    function syncBiz() {
      var on = !!(biz && biz.checked);
      for (var i = 0; i < bizFields.length; i++) { bizFields[i].hidden = !on; }
    }
    if (biz) { biz.addEventListener('change', syncBiz); syncBiz(); }

    function val(name) {
      var el = form.querySelector('[name="' + name + '"]');
      return el ? String(el.value || '').trim() : '';
    }
    function showErr(msg) { if (errEl) { errEl.textContent = msg || 'Error'; errEl.classList.add('show'); } }
    function clearErr() { if (errEl) { errEl.textContent = ''; errEl.classList.remove('show'); } }

    function collect() {
      return {
        _token: btn.getAttribute('data-token'),
        sku: btn.getAttribute('data-sku'),
        locale: location.pathname.slice(1, 3),
        email: val('email'),
        full_name: val('full_name'),
        country: val('country'),
        is_business: !!(biz && biz.checked),
        company: val('company'),
        vat: val('vat'),
        consent: (function () { var c = document.getElementById('co-consent'); return !!(c && c.checked); })()
      };
    }

    function valid(d) {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) { showErr(btn.getAttribute('data-msg-email')); return false; }
      if (d.full_name.length < 2 || !d.country) { showErr(btn.getAttribute('data-msg-name')); return false; }
      if (d.is_business && !d.company) { showErr(btn.getAttribute('data-msg-company')); return false; }
      if (!d.consent) { showErr(btn.getAttribute('data-msg-consent')); return false; }
      clearErr();
      return true;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var d = collect();
      if (!valid(d)) { return; }
      btn.disabled = true;
      fetch('/api/v1/checkout/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d)
      }).then(function (r) { return r.json(); })
        .then(function (j) {
          if (!j || !j.approve_url) { throw new Error((j && j.error) || 'order_failed'); }
          // En overlay (iframe), on sort au niveau supérieur : PayPal interdit
          // d'être affiché en iframe.
          (window.top || window).location.href = j.approve_url;
        })
        .catch(function () { btn.disabled = false; showErr(btn.getAttribute('data-msg-generic')); });
    });
  });
})();
