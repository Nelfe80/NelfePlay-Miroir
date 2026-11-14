/* LE JOUR ET LA NUIT (2026-10-17). Le site s'ouvre de jour ; la nuit choisie est retenue dans le navigateur.
 * Ce script est charge en tete, sans defer : il pose data-theme="nuit" sur <html> avant le premier affichage, pour
 * que la page n'apparaisse pas un instant en blanc. Le bouton [data-theme-toggle] de l'en-tete bascule ; ses deux
 * libelles (data-label-jour, data-label-nuit) disent ce que fait le clic. La CSP interdit tout script en ligne : d'ou
 * ce fichier. */
(function () {
    'use strict';
    var CLE = 'nelfe-theme';
    var racine = document.documentElement;
    var COULEURS = { jour: '#ffffff', nuit: '#070a12' };

    function lu() {
        try { return localStorage.getItem(CLE) === 'nuit' ? 'nuit' : 'jour'; } catch (e) { return 'jour'; }
    }

    function retenir(theme) {
        try { localStorage.setItem(CLE, theme); } catch (e) { /* navigation privee : le choix vaut pour la page */ }
    }

    function poser(theme) {
        if (theme === 'nuit') racine.setAttribute('data-theme', 'nuit');
        else racine.removeAttribute('data-theme');
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', COULEURS[theme]);
        var boutons = document.querySelectorAll('[data-theme-toggle]');
        for (var i = 0; i < boutons.length; i++) {
            var b = boutons[i];
            var libelle = theme === 'nuit' ? b.getAttribute('data-label-jour') : b.getAttribute('data-label-nuit');
            b.setAttribute('aria-pressed', theme === 'nuit' ? 'true' : 'false');
            if (libelle) {
                b.setAttribute('aria-label', libelle);
                b.setAttribute('title', libelle);
            }
        }
    }

    function actuel() {
        return racine.getAttribute('data-theme') === 'nuit' ? 'nuit' : 'jour';
    }

    if (lu() === 'nuit') racine.setAttribute('data-theme', 'nuit');

    document.addEventListener('DOMContentLoaded', function () { poser(actuel()); });
    document.addEventListener('click', function (e) {
        var b = e.target && e.target.closest ? e.target.closest('[data-theme-toggle]') : null;
        if (!b) return;
        var suivant = actuel() === 'nuit' ? 'jour' : 'nuit';
        retenir(suivant);
        poser(suivant);
    });
    // Un autre onglet a change de theme : celui-ci suit.
    window.addEventListener('storage', function (e) {
        if (e.key === CLE) poser(lu());
    });
})();
