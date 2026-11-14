/* Les invites de NelfePlay TV (admin/antenne, 17 octobre 2026).
 *
 * Dans un fichier : le site interdit les scripts en ligne (Content-Security-Policy script-src 'self').
 *
 * « Sans fin » coche grise la date de fin : un champ grise ne part pas avec le formulaire, ce qu'on voit est donc ce
 * qui s'enregistre. Retirer un invite se confirme. */
(function () {
    'use strict';

    function suivre(caseSansFin) {
        var form = caseSansFin.form;
        var fin = form ? form.querySelector('input[name="ends_at"]') : null;
        if (fin) {
            fin.disabled = caseSansFin.checked;
        }
    }

    document.querySelectorAll('input[name="no_end"]').forEach(function (caseSansFin) {
        suivre(caseSansFin);
        caseSansFin.addEventListener('change', function () {
            suivre(caseSansFin);
        });
    });

    document.addEventListener('submit', function (ev) {
        var form = ev.target.closest('form[data-confirmer]');
        if (form && !window.confirm(form.getAttribute('data-confirmer') || '')) {
            ev.preventDefault();
        }
    });
})();
