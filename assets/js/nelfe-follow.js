/* Suivre un joueur, partout où son pseudo s'affiche.
 *
 * UN SEUL composant, employé par toutes les pages qui montrent un pseudo :
 * classements, contests, salles, fiche de jeu, fiche joueur. Un suivi qui
 * n'existerait qu'au classement obligerait à retourner au classement pour
 * suivre quelqu'un croisé ailleurs, ce qui n'a pas de sens.
 *
 * ON SUIT UNE POIGNÉE, jamais un pseudo. Le pseudo change, et deux personnes
 * peuvent en porter un semblable : on relierait deux identités par coïncidence
 * de nom. La poignée accompagne donc chaque ligne qui porte un pseudo, et le
 * nom n'est qu'un libellé.
 *
 * Un score ANONYME n'a pas de poignée, et c'est une information : il compte au
 * classement sans désigner personne. On ne rend alors ni lien ni case.
 *
 * L'état est chargé UNE fois par page. Sans cela, une page de cinquante lignes
 * poserait cinquante questions au serveur pour afficher cinquante cases.
 */
(function () {
  'use strict';

  var I18N = window.NP_I18N || {};
  function T(cle, defaut) {
    var s = I18N[cle];
    return (s === undefined || s === '') ? defaut : s;
  }

  var suivis = null;        // Set des poignées suivies, null tant qu'on ne sait pas
  var connecte = false;
  var chargement = null;

  function charger() {
    if (chargement) { return chargement; }
    chargement = fetch('/api/v1/follows', { headers: { 'Accept': 'application/json' } })
      .then(function (r) {
        if (r.status === 401) { connecte = false; suivis = new Set(); return; }
        if (!r.ok) { throw new Error('follows'); }
        return r.json().then(function (d) {
          connecte = true;
          suivis = new Set((d.follows || [])
            .filter(function (f) { return f.kind === 'player'; })
            .map(function (f) { return String(f.ref).toLowerCase(); }));
        });
      })
      .catch(function () {
        // Hors ligne ou point indisponible : on n'affiche aucune case plutôt
        // qu'une case qui mentirait sur l'état.
        suivis = null;
        connecte = false;
      });
    return chargement;
  }

  var SVG_NS = 'http://www.w3.org/2000/svg';

  /* Le signe, en TRACE et non en caractere. Un « + » de fonte se cale sur l'axe
     mathematique, au-dessus du centre geometrique : dans un rond, il parait toujours
     un peu haut, et le rattraper au pixel dependrait de la fonte servie. */
  function signe(suit) {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    var trait = document.createElementNS(SVG_NS, 'path');
    trait.setAttribute('d', suit ? 'M3.5 8.5 L6.5 11.5 L12.5 4.5' : 'M8 3.5 L8 12.5 M3.5 8 L12.5 8');
    trait.setAttribute('fill', 'none');
    trait.setAttribute('stroke', 'currentColor');
    trait.setAttribute('stroke-width', '2.4');
    trait.setAttribute('stroke-linecap', 'round');
    trait.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(trait);
    return svg;
  }

  function poser(bouton, poignee, mot) {
    var suit = suivis !== null && suivis.has(poignee);
    bouton.textContent = '';
    bouton.appendChild(signe(suit));
    // Au fil d'une liste, la case reste un signe : cinquante fois « Suivre » dans une colonne
    // noierait les pseudos. Sur une fiche il n'y en a qu'une, et la place existe pour le dire.
    if (mot) {
      bouton.appendChild(document.createTextNode(suit ? T('followed', 'Suivi') : T('follow', 'Suivre')));
    }
    bouton.className = 'nf-follow' + (suit ? ' is-on' : '') + (mot ? ' nf-wide' : '');
    // L'ALT dit l'ACTION, pas l'état : c'est ce sur quoi on va cliquer.
    var action = suit ? T('unfollow', 'Ne plus suivre') : T('follow', 'Suivre');
    bouton.setAttribute('aria-label', action);
    bouton.setAttribute('title', action);
  }

  function basculer(bouton, poignee, mot) {
    if (!connecte) {
      window.location.href = '/' + (document.documentElement.lang || 'fr') + '/account';
      return;
    }
    var suit = suivis.has(poignee);
    var chemin = suit ? '/api/v1/follows/remove' : '/api/v1/follows/add';
    bouton.disabled = true;
    fetch(chemin + '?kind=player&ref=' + encodeURIComponent(poignee), { method: 'POST' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('follow')); })
      .then(function () {
        if (suit) { suivis.delete(poignee); } else { suivis.add(poignee); }
        poser(bouton, poignee, mot);
      })
      .catch(function () { /* on laisse l'état d'avant : mieux qu'un état faux */ })
      .then(function () { bouton.disabled = false; });
  }

  /**
   * La case à cocher seule. Rend null si rien n'est suivable.
   *
   * `mot` à vrai ajoute l'état en toutes lettres, pour une fiche où la case est seule.
   */
  function bouton(poignee, mot) {
    var h = String(poignee || '').toLowerCase();
    if (!/^[0-9a-f]{16}$/.test(h) || suivis === null) { return null; }
    var b = document.createElement('button');
    b.type = 'button';
    poser(b, h, mot);
    b.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      basculer(b, h, mot);
    });
    return b;
  }

  /**
   * Le pseudo tel qu'il doit s'afficher : cliquable vers sa fiche, suivi de sa
   * case. Un anonyme reste du texte, sans lien ni case.
   */
  function pseudo(nom, poignee, mot) {
    var frag = document.createDocumentFragment();
    var h = String(poignee || '').toLowerCase();
    var suivable = /^[0-9a-f]{16}$/.test(h);

    if (suivable) {
      var a = document.createElement('a');
      a.className = 'nf-pseudo';
      a.href = '/' + (document.documentElement.lang || 'fr') + '/players/' + h;
      a.textContent = nom;
      frag.appendChild(a);
    } else {
      var b = document.createElement('b');
      b.textContent = nom;
      frag.appendChild(b);
    }

    var case_ = suivable ? bouton(h, mot) : null;
    if (case_) { frag.appendChild(case_); }
    return frag;
  }

  /**
   * Les emplacements poses par un GABARIT : `data-nf-handle` porte la poignee,
   * `data-nf-wide` demande l'etat en toutes lettres.
   *
   * Une page rendue par le serveur n'a ainsi rien a ecrire : elle marque l'endroit,
   * le composant s'y installe. Sans cela, chaque page qui affiche un pseudo
   * porterait sa propre poignee de main avec ce fichier, et elles finiraient par
   * ne plus se ressembler.
   */
  function poserLesEmplacements() {
    var cibles = document.querySelectorAll('[data-nf-handle]');
    if (cibles.length === 0) { return; }
    charger().then(function () {
      Array.prototype.forEach.call(cibles, function (cible) {
        var b = bouton(cible.getAttribute('data-nf-handle'), cible.hasAttribute('data-nf-wide'));
        if (b) { cible.appendChild(b); }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', poserLesEmplacements);
  } else {
    poserLesEmplacements();
  }

  window.NelfeFollow = {
    charger: charger,
    bouton: bouton,
    pseudo: pseudo,
    /** Vrai quand l'état est connu : une page peut attendre avant de peindre. */
    pret: function () { return suivis !== null; }
  };
})();
