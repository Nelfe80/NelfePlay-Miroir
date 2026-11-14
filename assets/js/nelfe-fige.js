/**
 * LA COPIE FIGEE DU SITE (CDC infra §7 bis, 2026-10-07).
 *
 * Charge seulement par les pages du site statique, celles que servent les miroirs, et avant tout
 * autre script. Une copie se lit ; ce qui demande le central y renvoie :
 *
 *   - un formulaire d'envoi mene a la meme page sur nelfeplay.com, ou il existe avec sa session ;
 *   - les classements (/api/v1/scores/board*) se lisent dans des fichiers de la copie : chaque
 *     reponse de l'API y est un fichier, a une adresse calculee depuis la requete. Les scripts des
 *     pages ne changent pas : ils appellent l'API, la copie repond ;
 *   - tout autre appel a l'API recoit tout de suite une reponse « copie figee » (503), au lieu
 *     d'aller chercher sur le miroir une adresse qui n'y existe pas. Les scripts des pages savent
 *     deja vivre sans l'API : ils n'affichent alors rien qui mentirait.
 *
 * Sans script, le formulaire part vers le central, qui renvoie sur sa page : rien ne se perd.
 *
 * L'ADRESSE D'UNE DONNEE suit la meme regle que SiteStatique\Donnees (PHP), qui ecrit les fichiers :
 * tests/site-statique-donnees.php verifie que les deux s'accordent. Ne pas changer l'une sans l'autre.
 */
(function () {
  'use strict';

  var racine = document.documentElement;
  if (racine.getAttribute('data-nelfe-fige') !== '1') { return; }

  var canonique = document.querySelector('link[rel="canonical"]');
  var pageCentrale = canonique && canonique.href
    ? canonique.href
    : 'https://nelfeplay.com' + location.pathname;

  /* ── Les formulaires ────────────────────────────────────────────────────── */

  function estUnEnvoi(formulaire) {
    return !!formulaire && String(formulaire.getAttribute('method') || '').toLowerCase() === 'post';
  }

  function versLeCentral(depuis) {
    var ancre = depuis && depuis.closest ? depuis.closest('[id]') : null;
    location.href = pageCentrale + (ancre && ancre.id ? '#' + ancre.id : '');
  }

  /* Capte en premier : les scripts des pages qui envoient eux-memes le formulaire (le vote de la
     programmation) n'ont pas a connaitre la copie. */
  document.addEventListener('click', function (evenement) {
    var cible = evenement.target;
    var bouton = cible && cible.closest ? cible.closest('button, input[type="submit"]') : null;
    if (!bouton) { return; }
    var type = String(bouton.getAttribute('type') || (bouton.tagName === 'BUTTON' ? 'submit' : '')).toLowerCase();
    if (type !== 'submit' || !estUnEnvoi(bouton.form)) { return; }
    evenement.preventDefault();
    evenement.stopImmediatePropagation();
    versLeCentral(bouton);
  }, true);

  document.addEventListener('submit', function (evenement) {
    if (!estUnEnvoi(evenement.target)) { return; }
    evenement.preventDefault();
    evenement.stopImmediatePropagation();
    versLeCentral(evenement.target);
  }, true);

  /* Ce qui passe par la borne du joueur (defier un score, regarder un replay, diffuser sa partie,
     rejoindre celle d'un autre, verifier son installation) parle au compte et a la borne depuis
     nelfeplay.com : sur une copie, le geste mene a la meme page du central, ou il marche. Capte
     avant nelfe-runtime.js, qui ecoute le document. */
  var GESTES_DU_CENTRAL = '[data-nelfe-launch], [data-nelfe-replay], [data-nelfe-joinsession], '
    + '[data-nelfe-setup-link], [data-nelfe-share]';
  document.addEventListener('click', function (evenement) {
    var cible = evenement.target;
    var geste = cible && cible.closest ? cible.closest(GESTES_DU_CENTRAL) : null;
    if (!geste) { return; }
    evenement.preventDefault();
    evenement.stopImmediatePropagation();
    location.href = pageCentrale;
  }, true);

  /* ── Les donnees : un fichier par reponse de l'API ──────────────────────── */

  /* Un parametre dans une adresse de fichier : vide = « _ » ; tout octet hors [a-z0-9-] = ~XX. */
  function segment(valeur) {
    valeur = valeur === null || valeur === undefined ? '' : String(valeur);
    if (valeur === '') { return '_'; }
    var octets = new TextEncoder().encode(valeur);
    var ecrit = '';
    for (var i = 0; i < octets.length; i++) {
      var o = octets[i];
      if ((o >= 97 && o <= 122) || (o >= 48 && o <= 57) || o === 45) {
        ecrit += String.fromCharCode(o);
      } else {
        ecrit += '~' + (o < 16 ? '0' : '') + o.toString(16).toUpperCase();
      }
    }
    return ecrit;
  }

  /* Le fichier de la copie qui porte la reponse a cette requete, ou null si ce point n'en a pas. */
  function cheminDeDonnee(point, q) {
    function s(cle) { return segment(q.get(cle) || ''); }
    switch (point) {
      case '/api/v1/scores/board-scopes':
        return 'data/scores/board-scopes/' + s('world') + '.json';
      // Le type de defi (challenge) change de fichier : chacun est un classement officiel.
      case '/api/v1/scores/board-games':
        return 'data/scores/board-games/' + s('world') + '/' + s('challenge') + '.json';
      case '/api/v1/scores/board-players':
        return 'data/scores/board-players/' + s('world') + '/' + s('challenge') + '/' + s('scope') + '/' + s('value') + '.json';
      case '/api/v1/scores/board':
        if (q.get('contest')) {
          return 'data/scores/board-contest/' + s('contest') + '/' + s('limit') + '.json';
        }
        return 'data/scores/board/' + s('world') + '/' + s('system') + '/' + s('game') + '/' + s('ruleset')
          + '/' + s('scope') + '/' + s('value') + '.json';
      case '/api/v1/scores/board-pending':
        return 'data/scores/board-pending/' + s('system') + '/' + s('game') + '/' + s('ruleset') + '.json';
      case '/api/v1/scores/board-venue':
        return 'data/scores/board-venue/' + s('venue') + '/' + s('limit') + '.json';
      case '/venues/data':
        return 'data/venues/liste.json';
      case '/contests/data':
        return 'data/contests/liste/' + s('status') + '/' + s('host') + '/' + s('limit') + '.json';
    }
    var m = /^\/venues\/([^/]+)\/data$/.exec(point);
    if (m) { return 'data/venues/' + segment(decodeURIComponent(m[1])) + '.json'; }
    m = /^\/contests\/([^/]+)\/standings$/.exec(point);
    if (m) { return 'data/contests/' + segment(decodeURIComponent(m[1])) + '/standings.json'; }
    return null;
  }

  /* Le detail d'une salle ou le classement d'un contest qui n'est pas dans la copie : la page le dit
     comme le central le dirait, par une absence (404), pas par une liste vide. */
  function estUnDetail(point) {
    return /^\/venues\/[^/]+\/data$/.test(point) || /^\/contests\/[^/]+\/standings$/.test(point);
  }

  /* La copie n'ecrit que les reponses qui portent quelque chose : pour les autres, ce que l'API
     aurait rendu, un classement vide. */
  function reponseVide(point, q) {
    var monde = q.get('world') || '';
    switch (point) {
      case '/api/v1/scores/board-scopes': return { scopes: {} };
      case '/api/v1/scores/board-games': return { total: 0, games: [] };
      case '/api/v1/scores/board-players':
        return { ok: true, world: monde, challenge: q.get('challenge') || '', points: [], rows: [] };
      case '/api/v1/scores/board': return { ok: true, world: monde, rows: [] };
      case '/api/v1/scores/board-pending': return { ok: true, rows: [] };
      case '/api/v1/scores/board-venue': return { ok: true, rows: [] };
      case '/venues/data': return { total: 0, venues: [] };
      case '/contests/data': return { total: 0, contests: [] };
    }
    return null;
  }

  /* La recherche d'un jeu : la copie porte la liste, le tri par nom se fait ici. */
  function jeuxCherches(liste, terme, limite) {
    var gardes = [];
    var rangs = {};
    var combien = 0;
    (liste.games || []).forEach(function (jeu) {
      var nom = String(jeu.game_name || '').toLowerCase();
      if (String(jeu.game || '').toLowerCase().indexOf(terme) < 0 && nom.indexOf(terme) < 0) { return; }
      var cle = String(jeu.system || '') + '/' + String(jeu.game || '');
      if (rangs[cle] === undefined) { rangs[cle] = combien++; }
      if (rangs[cle] < limite) { gardes.push(jeu); }
    });
    return { total: combien, games: gardes };
  }

  function enJson(donnee, statut) {
    return new Response(JSON.stringify(donnee), {
      status: statut || 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  if (typeof window.fetch === 'function' && typeof window.Response === 'function') {
    var appelReel = window.fetch;
    window.fetch = function (ressource, options) {
      var adresse = typeof ressource === 'string' ? ressource : (ressource && ressource.url) || '';
      var url = null;
      try { url = new URL(adresse, location.href); } catch (erreur) { url = null; }
      var methode = String((options && options.method) || (ressource && ressource.method) || 'GET').toUpperCase();
      var fichier = url && url.origin === location.origin && methode === 'GET'
        ? cheminDeDonnee(url.pathname, url.searchParams) : null;
      if (!url || url.origin !== location.origin || (fichier === null && url.pathname.indexOf('/api/') !== 0)) {
        return appelReel.apply(this, arguments);
      }
      if (fichier === null) {
        return Promise.resolve(enJson({ ok: false, error: 'static_copy' }, 503));
      }
      return appelReel.call(window, '/' + fichier).then(function (reponse) {
        var type = String(reponse.headers.get('Content-Type') || '');
        if (reponse.status === 404 || (reponse.ok && type.indexOf('json') < 0)) {
          return estUnDetail(url.pathname)
            ? enJson({ ok: false, error: 'not_found' }, 404)
            : enJson(reponseVide(url.pathname, url.searchParams));
        }
        var terme = url.pathname === '/api/v1/scores/board-games'
          ? String(url.searchParams.get('q') || '').trim().toLowerCase() : '';
        if (!reponse.ok || terme === '') { return reponse; }
        var limite = Math.max(1, Math.min(50, parseInt(url.searchParams.get('limit') || '25', 10) || 25));
        return reponse.json().then(function (liste) { return enJson(jeuxCherches(liste, terme, limite)); });
      });
    };
  }

  /* ── La fiche d'un jeu : une page par mode ou par regle ─────────────────── */

  /* Sur le central, ?mode= ou ?regle= choisit le classement que la fiche montre. Une page figee ne
     lit pas de requete : chaque classement a sa page, <fiche>/<regle>/, et ses onglets y menent.
     Un lien bati par un script (le Hall of Fame) arrive encore avec la requete : on suit l'onglet. */
  (function () {
    var voulu = '';
    try {
      var requete = new URLSearchParams(location.search);
      voulu = requete.get('mode') || requete.get('regle') || '';
    } catch (erreur) { voulu = ''; }
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(voulu)) { return; }
    var onglets = document.querySelectorAll('.gs-machines a[href]');
    for (var i = 0; i < onglets.length; i++) {
      var lien = String(onglets[i].getAttribute('href') || '');
      if (lien.charAt(0) === '/' && lien.replace(/\/+$/, '').split('/').pop() === voulu) {
        location.replace(lien + location.hash);
        return;
      }
    }
  })();

  /* Pour les essais : la regle d'adresse, a comparer a celle de SiteStatique\Donnees. */
  window.NelfeFige = { segment: segment, cheminDeDonnee: cheminDeDonnee };
})();
