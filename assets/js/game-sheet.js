/* La fiche d'un jeu : ce que le serveur ne pouvait pas rendre.
 *
 * Le haut de la page est rendu par le serveur - le record ne change qu'a la
 * partie suivante. Restent deux choses qui dependent du LECTEUR et non du
 * jeu : sait-on qui il suit, et la capture ouverte en grand.
 *
 * Le classement, lui, est rempli par rankings.js, verrouille sur ce jeu.
 */
(function () {
  'use strict';

  var I18N = window.NP_I18N || {};
  function T(cle, defaut) {
    var s = I18N[cle];
    return (s === undefined || s === '') ? defaut : s;
  }

  /* Le detenteur du record : son pseudo mene a sa fiche, et sa case de suivi
     vient du composant commun. La page ne se fabrique pas sa propre notion de
     « suivre », sinon deux comportements finiraient par diverger. */
  function poserDetenteur() {
    var emplacement = document.getElementById('gs-holder-slot');
    if (!emplacement || !window.NelfeFollow) { return; }
    var nom = emplacement.getAttribute('data-name') || T('anonymous', 'Anonyme');
    // En toutes lettres ici : il n'y a qu'un pseudo sur cette page, la place existe.
    emplacement.appendChild(
      window.NelfeFollow.pseudo(nom, emplacement.getAttribute('data-handle'), true));
  }

  /* La capture, ouverte en grand par le composant commun. Les gestes qu'elle
     propose sont deja dans la page, sous forme de boutons : la boite les
     reprend pour que le lecteur n'ait pas a la refermer pour agir. */
  function poserCapture() {
    var figure = document.querySelector('.gs-shot');
    if (!figure || !window.NelfeShotBox) { return; }
    var img = figure.querySelector('img');
    if (!img) { return; }

    figure.classList.add('is-clickable');
    var ouvrir = function () {
      var titre = document.querySelector('.gs-id h1');
      var score = document.querySelector('.gs-score');
      // Le sous-titre raconte la performance : combien, par qui, quand. C'est ce qu'on
      // veut lire sous une capture de record.
      var morceaux = [];
      if (score) { morceaux.push(score.textContent); }
      if (figure.getAttribute('data-player')) { morceaux.push(figure.getAttribute('data-player')); }
      var quand = figure.getAttribute('data-at');
      if (quand) {
        var d = new Date(quand.replace(' ', 'T') + 'Z');
        if (!isNaN(d.getTime())) {
          morceaux.push(d.toLocaleDateString(document.documentElement.lang || 'fr',
            { year: 'numeric', month: 'long', day: 'numeric' }));
        }
      }
      window.NelfeShotBox.ouvrir({
        src: img.getAttribute('src'),
        alt: img.getAttribute('alt') || '',
        title: titre ? titre.textContent : '',
        subtitle: morceaux.join(' \u00b7 '),
        proof: figure.getAttribute('data-certificate')
          ? { url: figure.getAttribute('data-certificate'), label: T('certificate', 'Certificat') }
          : null
      }, img);
    };

    img.addEventListener('click', ouvrir);
    // Une image cliquable doit s'atteindre au clavier : on lui donne un vrai
    // bouton plutot qu'un gestionnaire pose sur une image inerte.
    var bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'gs-zoom';
    bouton.textContent = T('enlarge', 'Agrandir');
    bouton.addEventListener('click', ouvrir);
    figure.appendChild(bouton);
  }

  /* Le score se lit « 1 234 567 » en francais et « 1,234,567 » en anglais. Le serveur
     rend le nombre brut : traduire les mots sans traduire les chiffres serait a
     moitie fait. */
  function poserScore() {
    var n = document.querySelector('.gs-score');
    if (!n) { return; }
    var v = Number(n.getAttribute('data-value'));
    if (!isNaN(v)) { n.textContent = v.toLocaleString(document.documentElement.lang || 'fr'); }
  }

  /* Le repli : une zone de texte invisible, selectionnee puis copiee. */
  function copierALAncienne(texte) {
    return new Promise(function (ok, ko) {
      var z = document.createElement('textarea');
      z.value = texte;
      z.setAttribute('readonly', 'readonly');
      z.style.position = 'fixed';
      z.style.left = '-9999px';
      document.body.appendChild(z);
      z.select();
      var fait = false;
      try { fait = document.execCommand('copy'); } catch (e) { fait = false; }
      document.body.removeChild(z);
      if (fait) { ok(); } else { ko(new Error('copy')); }
    });
  }

  /* Copier une empreinte.
   *
   * LE REPLI SERT AUSSI QUAND LE PRESSE-PAPIERS MODERNE REFUSE, et pas seulement quand il
   * manque : `writeText` existe partout mais rejette des qu'une permission est refusee - page
   * dans un cadre, reglage du navigateur, contexte automatise. Ne se replier que sur son
   * absence laissait le bouton sans effet dans ces cas-la, en silence (vu le 2026-09-23). */
  function copier(texte) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(texte).catch(function () {
        return copierALAncienne(texte);
      });
    }
    return copierALAncienne(texte);
  }

  function poserCopie() {
    document.addEventListener('click', function (ev) {
      var b = ev.target.closest('.gs-copy');
      if (!b) { return; }
      var valeur = b.getAttribute('data-copy') || '';
      if (valeur === '') { return; }
      copier(valeur).then(function () {
        // Le bouton dit lui-meme que c'est fait : pas de message ailleurs dans la page,
        // qu'il faudrait ensuite aller chercher des yeux.
        var avant = b.textContent;
        b.textContent = b.getAttribute('data-done') || '✓';
        b.classList.add('is-done');
        setTimeout(function () {
          b.textContent = avant;
          b.classList.remove('is-done');
        }, 1400);
      }).catch(function () {
        // Copie refusee par le navigateur : l'empreinte reste selectionnable a la main.
      });
    });
  }

  function demarrer() {
    poserScore();
    poserCopie();
    poserCapture();
    if (window.NelfeFollow) {
      window.NelfeFollow.charger().then(poserDetenteur);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', demarrer);
  } else {
    demarrer();
  }
})();
