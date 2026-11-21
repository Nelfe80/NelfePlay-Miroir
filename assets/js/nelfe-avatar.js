/*
 * nelfe-avatar.js : sur /account, la mise en depot de l'avatar, sans rien demander au joueur.
 *
 * Le dessin de la tete, la declaration a l'index et le depot pour la borne vivent dans
 * nelfe-avatar-head.js, qui tient le moteur pour tout le site. Il reste a cette page ce
 * qu'elle seule montre : le contour violet quand une borne detient la planche, donc quand la
 * foule la verra.
 *
 * Aucun bouton, aucune fenetre : la borne peut etre eteinte, et le joueur peut etre sur son
 * telephone. Le depot n'est pas de l'hebergement : la plateforme garde les octets le temps
 * qu'une borne appairee au compte les prenne, comme le transit des replays, et s'en defait.
 */
(function () {
  'use strict';

  var racine = document.querySelector('[data-nelfe-avatar]');
  if (!racine || !window.NelfeAvatar) { return; }

  var TITRE_BORNE = racine.dataset.nelfeHeldTitle || '';

  /** Le contour violet : la planche est chez une borne, donc la foule la verra. */
  function marquerSurBorne(oui) {
    racine.classList.toggle('account-hero-avatar--sur-borne', !!oui);
    if (oui && TITRE_BORNE) { racine.setAttribute('title', TITRE_BORNE); }
  }

  window.NelfeAvatar.moi().then(function (id) {
    marquerSurBorne(id.held);
    return window.NelfeAvatar.synchroniser();
  }).then(function (etat) {
    marquerSurBorne(etat && etat.held);
  }).catch(function () {
    // Un navigateur qui ne peut pas generer garde l'initiale : rien a expliquer, rien a faire.
  });
})();
