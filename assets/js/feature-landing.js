/*
 * LE RETOUR D'UNE PAGE DE FONCTIONNALITE (12/11/2026, option A du user).
 *
 * La page montre « < Accueil » par defaut (sans script aussi). Venue de l'espace presse, elle montre « < Espace presse » :
 * les liens de /press portent la marque #from-press, et la page precedente /press (meme site) vaut la meme chose. Une
 * marque dans l'ancre plutot qu'un parametre : le site statique sert la page telle quelle et garde l'ancre des liens.
 * Fichier a part : la CSP du site refuse le JavaScript en ligne.
 */
(function () {
    'use strict';
    var accueil = document.querySelector('a[data-fl-retour="accueil"]');
    var presse = document.querySelector('a[data-fl-retour="presse"]');
    if (!accueil || !presse) {
        return;
    }
    var precedenteEstLaPresse = false;
    if (document.referrer) {
        try {
            var precedente = new URL(document.referrer);
            precedenteEstLaPresse = precedente.origin === window.location.origin
                && /^\/[a-z]{2}\/press\/?(?:index\.html)?$/.test(precedente.pathname);
        } catch (e) {
            precedenteEstLaPresse = false;
        }
    }
    var choisir = function () {
        if (precedenteEstLaPresse || window.location.hash === '#from-press') {
            presse.hidden = false;
            accueil.hidden = true;
        }
    };
    choisir();
    window.addEventListener('hashchange', choisir);
}());
