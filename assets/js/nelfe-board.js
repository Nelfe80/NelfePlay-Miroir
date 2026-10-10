/*
 * nelfe-board.js : les briques d'une LIGNE de classement, les memes sur tout le site.
 *
 * Le classement general, la fiche d'un jeu, la page d'un lieu et celle d'un contest montrent
 * tous des scores. Chacun avait sa propre facon d'ecrire le joueur, le jeu et le score, et
 * elles avaient fini par se contredire : un pseudo cliquable ici, en gras la ; un sceau sur
 * l'un, pas sur l'autre. Une seule source, et les quatre tableaux disent la meme chose.
 *
 * Ce que le module attend de la page : le dictionnaire `window.NP_I18N` avec le vocabulaire des
 * classements (badge_home, badge_station, badge_stream, sealed, anonymous, watch_replay), et,
 * pour un pseudo cliquable, nelfe-follow.js charge avant. Pour la tete de l'avatar, le moteur
 * nelfe-avatar-head.js ; sans lui, l'ancienne image tient la place.
 *
 * Tout passe par textContent, jamais par innerHTML : un pseudo est choisi par un joueur, et
 * rien n'oblige un joueur a la bienveillance.
 */
(function () {
  'use strict';

  var I18N = window.NP_I18N || {};
  var LNG = document.documentElement.lang || 'fr';
  var BADGES = { station: 'badge_station', home: 'badge_home', stream: 'badge_stream' };

  function T(cle, repli) {
    var s = I18N[cle];
    return s === undefined ? (repli === undefined ? cle : repli) : s;
  }

  /* Le score se lit « 1 234 567 » en francais et « 1,234,567 » en anglais. */
  function nombre(v) { return Number(v).toLocaleString(LNG); }

  function noeud(balise, classe, texte) {
    var n = document.createElement(balise);
    if (classe) { n.className = classe; }
    if (texte !== undefined && texte !== null) { n.textContent = String(texte); }
    return n;
  }

  /* La tete de l'avatar du MOMENT (le sien, ou le champion qu'il porte), dessinee par le
   * moteur du site. Sans moteur, l'ancienne image : un portrait d'hier vaut mieux qu'un
   * cadre vide, et le manque se voit au lieu de se cacher. */
  function portrait(ligne) {
    if (!window.NelfeAvatar || !ligne.avatar_identity) {
      var img = document.createElement('img');
      img.className = 'rk-avatar';
      img.width = 28;
      img.height = 28;
      img.loading = 'lazy';
      img.alt = '';
      img.src = '/avatar/' + encodeURIComponent(ligne.avatar) + '.svg?c=4';
      return img;
    }
    var toile = document.createElement('canvas');
    toile.className = 'rk-avatar';
    toile.width = 32;
    toile.height = 32;
    toile.setAttribute('aria-hidden', 'true');
    window.NelfeAvatar.poser(toile, ligne.avatar_identity);
    return toile;
  }

  /* Le joueur : son portrait, puis son pseudo qui mene a sa fiche et porte sa case de suivi.
   * Un score anonyme n'a ni portrait ni lien, et c'est une information : il compte dans le
   * classement sans designer personne. */
  function joueur(ligne) {
    var bloc = noeud('span', 'rk-player');
    if (ligne.avatar_identity || ligne.avatar) { bloc.appendChild(portrait(ligne)); }
    var nom = ligne.player || T('anonymous');
    if (window.NelfeFollow && ligne.player) {
      bloc.appendChild(window.NelfeFollow.pseudo(nom, ligne.handle));
    } else {
      bloc.appendChild(noeud('b', ligne.player ? null : 'rk-anonymous', nom));
    }
    return bloc;
  }

  /* L'adresse de la fiche d'un jeu SUR SA MACHINE : un jeu = systeme + contenu, et deux Tetris
   * ont deux classements. Sans machine connue, l'ancienne adresse, qui mene a la plus recemment
   * ouverte. */
  function lienJeu(ligne) {
    var systeme = (ligne && ligne.system) || '';
    // Un jeu a MODES : la fiche s'ouvre sur l'onglet du mode du record.
    var mode = ligne && ligne.mode && !ligne.mode['default'] && ligne.ruleset
      ? '?mode=' + encodeURIComponent(ligne.ruleset) : '';
    return '/' + LNG + '/rankings/' + (systeme ? encodeURIComponent(systeme) + '/' : '')
      + encodeURIComponent((ligne && ligne.game) || '') + mode;
  }

  /* Un libelle par langue ({fr, en, ...}), tel qu'un profil le porte : celui de la page, sinon
   * l'anglais, sinon le premier venu. Une chaine seule passe telle quelle. */
  function libelle(table) {
    if (typeof table === 'string') { return table; }
    if (!table || typeof table !== 'object') { return ''; }
    if (table[LNG]) { return table[LNG]; }
    if (table.en) { return table.en; }
    var cles = Object.keys(table);
    return cles.length ? String(table[cles[0]]) : '';
  }

  /* LE MODE D'UN RECORD, quand le jeu en a plusieurs (Tetris Game Boy : type A, type B) : chacun
   * a son classement, et deux lignes « Tetris » ne se distingueraient pas sans lui. */
  function mode(ligne) {
    var nom = ligne && ligne.mode ? libelle(ligne.mode.label) : '';
    return nom ? noeud('span', 'rk-mode', nom) : null;
  }

  /* LA DIFFICULTE CHOISIE AU DEPART, libre et affichee (decision user 2026-09-29) : elle ne coupe
   * pas le classement, elle se lit a cote du score. « Niveau 5 · Hauteur 3 ». */
  function difficulte(ligne) {
    var champs = ligne && Array.isArray(ligne.difficulty) ? ligne.difficulty : [];
    var morceaux = champs.map(function (c) {
      var nom = libelle(c && c.label);
      var val = libelle(c && c.value);
      return nom && val ? nom + ' ' + val : val;
    }).filter(Boolean);
    return morceaux.length ? noeud('span', 'rk-difficulty', morceaux.join(' \u00b7 ')) : null;
  }

  /* Le jeu, qui mene a son classement. Son nom ne se traduit pas : c'est une donnee. */
  function jeu(ligne) {
    var a = document.createElement('a');
    a.className = 'rk-game-link';
    a.href = lienJeu(ligne);
    a.setAttribute('translate', 'no');
    a.textContent = ligne.game_name || ligne.game || '';
    return a;
  }

  /* LES EMPREINTES DE LA ROM DU JOUEUR, une cartouche par empreinte, sous le nom du jeu
   * (demande user 2026-09-28). Qui veut refaire un record verifie qu'il a la meme ROM : un clic
   * sur une cartouche affiche son empreinte et un bouton pour la copier. Seules les empreintes
   * que la partie a declarees sont la ; un record ancien peut n'en avoir aucune, et la ligne
   * n'affiche alors rien plutot que des cases vides. */
  var ALGOS = [['md5', 'MD5'], ['sha1', 'SHA-1'], ['sha256', 'SHA-256']];
  var SVG = 'http://www.w3.org/2000/svg';

  function iconeCartouche() {
    var svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('width', '14');
    svg.setAttribute('height', '14');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    [
      // Le boitier, son etiquette, puis les contacts.
      'M3.5 1.5h9v10.5l-1 1v1.5h-7V13l-1-1z',
      'M5.5 3.5h5v4h-5z',
      'M6 13.5v1M8 13.5v1M10 13.5v1'
    ].forEach(function (d) {
      var p = document.createElementNS(SVG, 'path');
      p.setAttribute('d', d);
      svg.appendChild(p);
    });
    return svg;
  }

  function copier(texte, bouton) {
    var fait = function () {
      bouton.textContent = T('rom_copied', 'OK');
      setTimeout(function () { bouton.textContent = T('rom_copy', 'Copy'); }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texte).then(fait, function () {});
    }
  }

  function cartouches(ligne) {
    var rom = (ligne && ligne.rom) || {};
    var presents = ALGOS.filter(function (a) { return typeof rom[a[0]] === 'string' && rom[a[0]] !== ''; });
    if (presents.length === 0) { return null; }

    var bloc = noeud('div', 'rk-rom');
    var rangee = noeud('div', 'rk-rom-carts');
    var detail = noeud('div', 'rk-rom-detail');
    detail.hidden = true;
    var valeur = noeud('code', 'rk-rom-value');
    valeur.setAttribute('translate', 'no');
    var bouton = noeud('button', 'rk-rom-copy', T('rom_copy', 'Copy'));
    bouton.type = 'button';
    detail.appendChild(valeur);
    detail.appendChild(bouton);

    var actif = null;
    var algo = '';
    presents.forEach(function (a) {
      var b = noeud('button', 'rk-rom-cart');
      b.type = 'button';
      b.setAttribute('aria-expanded', 'false');
      b.title = T('rom_hash', '{algo}').split('{algo}').join(a[1]);
      b.appendChild(iconeCartouche());
      b.appendChild(noeud('span', 'rk-rom-algo', a[1]));
      b.addEventListener('click', function () {
        if (actif) { actif.setAttribute('aria-expanded', 'false'); }
        if (actif === b) {
          actif = null;
          detail.hidden = true;
          return;
        }
        actif = b;
        algo = a[0];
        b.setAttribute('aria-expanded', 'true');
        valeur.textContent = rom[a[0]];
        valeur.title = b.title;
        bouton.textContent = T('rom_copy', 'Copy');
        detail.hidden = false;
      });
      rangee.appendChild(b);
    });
    bouton.addEventListener('click', function () { copier(rom[algo] || '', bouton); });

    bloc.appendChild(rangee);
    bloc.appendChild(detail);
    return bloc;
  }

  /* Le monde d'un score : maison, salle verifiee, direct. Le code couleur vient de la classe. */
  function badge(ligne) {
    return noeud('span', 'rk-badge rk-badge-' + (ligne.world || 'home'), T(BADGES[ligne.world] || 'badge_home'));
  }

  /* La cellule de provenance : le monde, et d'ou precisement quand la page ne le dit pas deja. */
  function provenance(ligne, avecDetail) {
    var cellule = noeud('td');
    cellule.appendChild(badge(ligne));
    var detail = ligne.venue || ligne.channel || '';
    if (detail && avecDetail !== false) { cellule.appendChild(noeud('span', 'rk-where', detail)); }
    return cellule;
  }

  /* Le sceau de scellement. Il n'apparait QUE sur un score scelle sur la blockchain :
   * « publie » et « scelle » ne sont pas la meme chose, et un sceau partout ne dirait plus
   * rien. Les scores recents attendent la prochaine ancre. */
  function sceau(ligne) {
    if (!ligne || !ligne.sealed) { return null; }
    var img = document.createElement('img');
    img.className = 'rk-seal';
    img.src = '/assets/brand/nelfe-verified.svg';
    img.width = 14;
    img.height = 14;
    img.alt = '';
    img.title = T('sealed');
    return img;
  }

  /* PAS de repere « ce que ce record dit de lui » sur les classements. Le seul drapeau qui se
   * declenchait en pratique, `emulator_partial`, est deduit du sha du coeur : une flotte sur le
   * meme build le porte en entier, donc chaque ligne affichait le meme « i » -- un repere que
   * tout le monde arbore ne designe plus personne (decision user 2026-09-25). Les drapeaux
   * restent dans la reponse du serveur ; c'est l'affichage qui tombe, pas la donnee.
   */

  /* Le bouton « Replay », quand un replay est disponible derriere ce score. Le funnel de la
   * borne (nelfe-runtime.js) lit `data-nelfe-replay` au clic. */
  function boutonReplay(ligne) {
    var r = ligne && ligne.replay;
    if (!r || !r.id) { return null; }
    // La lecture se fait SUR LA BORNE, donc sur un PC Windows : ailleurs, le
    // bouton menerait a une preparation qu'on ne peut pas suivre. La regle vit
    // dans app.js et se lit ici ; si elle manque (script absent), on montre -
    // meme defaut que partout ailleurs, priver un joueur Windows serait pire.
    if (window.NelfePlateforme && !window.NelfePlateforme.windows) { return null; }
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'rk-replay';
    b.textContent = '▷ Replay';
    b.setAttribute('data-nelfe-replay', r.id);
    // La regle de la ligne : un replay lance depuis un classement 1LC se fige a la premiere mort.
    if (ligne.ruleset) { b.setAttribute('data-nelfe-ruleset', ligne.ruleset); }
    // Le marqueur du site, au cas ou app.js s'executerait apres ce rendu.
    b.setAttribute('data-windows-only', '');
    if (r.object_sha256) { b.setAttribute('data-nelfe-sha', r.object_sha256); }
    b.title = T('watch_replay', LNG === 'fr' ? 'Revoir ce record sur la borne' : 'Watch this record on the cabinet');
    b.setAttribute('aria-label', b.title);
    return b;
  }

  /* Quand il n'y a PAS de replay et qu'on sait pourquoi : le moteur qui a mesure ce score
     n'enregistre pas de partie (MAME hors RetroArch). Rend null dans tous les autres cas -
     en particulier quand un replay EXISTE mais que le bouton est cache (hors Windows) :
     annoncer « sans replay » a un joueur sur telephone serait faux. */
  function sansReplay(ligne) {
    // Un replay qui existe mais que l'amorce ne sert pas encore : il est dit, sans bouton. Meme
    // regle de plateforme que le bouton, puisque la lecture se fait sur une borne Windows.
    if (ligne && ligne.replay_pending && !(ligne.replay && ligne.replay.id)
        && !(window.NelfePlateforme && !window.NelfePlateforme.windows)) {
      var attente = noeud('span', 'rk-no-replay', T('replay_pending', LNG === 'fr' ? 'Replay en attente' : 'Replay pending'));
      attente.title = T('replay_pending_why', LNG === 'fr'
        ? 'Ce replay n’est pas encore sur le miroir : la borne qui l’a enregistré doit le renvoyer.'
        : 'This replay is not on the mirror yet: the cabinet that recorded it has to send it again.');
      return attente;
    }
    if (!ligne || ligne.emulator_records !== false) { return null; }
    if (ligne.replay && ligne.replay.id) { return null; }
    var n = noeud('span', 'rk-no-replay', T('no_replay_standalone', 'No replay: MAME standalone'));
    n.title = T('no_replay_why', 'This engine measures the score but does not record the run.');
    return n;
  }

  /* La cellule du score : le sceau s'il est scelle, le nombre, le replay s'il y en a un. */
  function score(ligne) {
    var cellule = noeud('td', 'rk-score');
    var sc = sceau(ligne);
    if (sc) { cellule.appendChild(sc); }
    cellule.appendChild(document.createTextNode(nombre(ligne.value)));
    var rb = boutonReplay(ligne);
    if (rb) { cellule.appendChild(rb); }
    var sans = sansReplay(ligne);
    if (sans) { cellule.appendChild(sans); }
    // Le compteur se lit partout, meme la ou le bouton se retire : sur un telephone on ne
    // lance pas le replay, on peut savoir qu'il a ete regarde.
    var lectures = ligne && ligne.replay && window.NelfeLectures
      ? window.NelfeLectures.module(ligne.replay.plays)
      : null;
    if (lectures) { cellule.appendChild(lectures); }
    return cellule;
  }

  /* Est-ce ma ligne ? On compare en minuscules : un pseudo se saisit comme on veut, il
   * designe la meme personne. `moi` vient du serveur (data-me sur le tableau). */
  function cestMoi(ligne, moi) {
    return !!moi && (ligne.player || '').toLowerCase() === String(moi).toLowerCase();
  }

  window.NelfeBoard = {
    nombre: nombre,
    noeud: noeud,
    portrait: portrait,
    joueur: joueur,
    jeu: jeu,
    lienJeu: lienJeu,
    libelle: libelle,
    mode: mode,
    difficulte: difficulte,
    cartouches: cartouches,
    badge: badge,
    provenance: provenance,
    sceau: sceau,
    boutonReplay: boutonReplay,
    sansReplay: sansReplay,
    score: score,
    cestMoi: cestMoi
  };
})();
