/**
 * LES DEUX PAGES SANS GABARIT D'UNE COPIE DU SITE (CDC infra §7 bis, 2026-10-07).
 *
 * La racine : sur le central, « / » choisit la langue du visiteur a chaque visite. Une copie figee
 * ne calcule rien : sa racine le fait ici, dans le navigateur, parmi les langues qu'elle porte.
 * Sans script, la page propose les langues et mene a l'anglais.
 *
 * La page « introuvable » : ce que la copie ne porte pas (un compte, une page a donnees vivantes)
 * existe sur le central. Elle y mene, a la meme adresse. Servie par le central lui-meme, elle ne
 * renvoie nulle part : elle tournerait en rond. Arrivee par le secours du navigateur (« #nelfe-secours »,
 * le central ne repond plus), elle reste : le renvoi ramenerait au central, qui renverrait ici.
 */
(function () {
  'use strict';

  var racine = document.documentElement;
  var central = String(racine.getAttribute('data-nelfe-central') || '');

  if (central !== '') {
    if (location.origin !== central && location.hash !== '#nelfe-secours') {
      location.replace(central + location.pathname + location.search + location.hash);
    }
    return;
  }

  var portees = String(racine.getAttribute('data-nelfe-langues') || 'en').split(',');
  var voulues = navigator.languages && navigator.languages.length
    ? navigator.languages
    : [navigator.language || 'en'];
  var choisie = portees.indexOf('en') !== -1 ? 'en' : portees[0];

  for (var i = 0; i < voulues.length; i++) {
    var code = String(voulues[i]).slice(0, 2).toLowerCase();
    if (portees.indexOf(code) !== -1) {
      choisie = code;
      break;
    }
  }
  location.replace('/' + choisie + '/');
})();
