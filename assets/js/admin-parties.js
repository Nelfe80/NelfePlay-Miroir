/* Le détail d'une partie, ouvert au clic sur sa ligne.
 *
 * Dans un fichier et non dans la page : le site interdit les scripts en ligne
 * (Content-Security-Policy script-src 'self'), et un <script> inline y est
 * silencieusement ignoré — le bouton ne faisait donc rien (2026-09-22).
 *
 * Ce qui s'affiche est ce que la plateforme a reçu, tel quel : on ne met pas en
 * forme un diagnostic, on le montre. */
(function () {
    'use strict';

    var dlg = document.getElementById('partie-detail');
    if (!dlg) {
        return;
    }

    var corps = document.getElementById('partie-corps');
    var titre = document.getElementById('partie-titre');
    var base = dlg.getAttribute('data-base') || '';
    var enCours = dlg.getAttribute('data-loading') || '…';
    var echec = dlg.getAttribute('data-error') || '';

    /* Les champs qui n'apprennent rien à l'écran : identifiants internes et
       colonnes vides. Les empreintes, elles, restent entières : c'est ce qu'on
       recopie dans une recherche. */
    function lisible(partie) {
        var sortie = {};
        Object.keys(partie).forEach(function (cle) {
            var v = partie[cle];
            if (v === null || v === '' || cle === 'account_id' || cle === 'device_id') {
                return;
            }
            sortie[cle] = v;
        });
        return sortie;
    }

    document.addEventListener('click', function (ev) {
        var bouton = ev.target.closest('[data-partie]');
        if (bouton) {
            titre.textContent = enCours;
            corps.textContent = '';
            if (typeof dlg.showModal === 'function') {
                dlg.showModal();
            } else {
                dlg.setAttribute('open', 'open');
            }
            fetch(base + '/' + encodeURIComponent(bouton.getAttribute('data-partie')), {
                headers: { Accept: 'application/json' },
                credentials: 'same-origin',
                cache: 'no-store'
            })
                .then(function (r) {
                    if (!r.ok) { throw new Error('HTTP ' + r.status); }
                    return r.json();
                })
                .then(function (d) {
                    var joueur = d.pseudo || d.player_label || '';
                    titre.textContent = (d.rom_group || '') + (joueur ? ' — ' + joueur : '');
                    corps.textContent = JSON.stringify(lisible(d), null, 2);
                })
                .catch(function (e) {
                    titre.textContent = echec;
                    corps.textContent = String(e && e.message ? e.message : e);
                });
            return;
        }

        if (ev.target.closest('[data-fermer]')) {
            dlg.close();
        }
    });

    /* Accepter une partie la fait entrer au classement et prévient le joueur :
       le geste se confirme, avec le joueur, le jeu, le score et le motif d'origine. */
    document.addEventListener('submit', function (ev) {
        var form = ev.target.closest('form[data-confirmer]');
        if (form && !window.confirm(form.getAttribute('data-confirmer') || '')) {
            ev.preventDefault();
        }
    });

    /* Cliquer à côté referme : une fenêtre de lecture ne doit pas retenir. */
    dlg.addEventListener('click', function (ev) {
        if (ev.target === dlg) {
            dlg.close();
        }
    });
})();
