/* La FOULE des spectateurs d'un direct.
 *
 * Trois rangees de silhouettes pixel, en bas de l'ecran, qui se chevauchent
 * comme un public vu de loin. Le REMPLISSAGE est la metrique : on lit la taille
 * de l'audience sans qu'un chiffre soit ecrit. Peu de monde, une rangee
 * incomplete ; beaucoup, les trois rangees pleines.
 *
 * Quand quelqu'un reagit, SA silhouette saute et son emoji s'envole. C'est ce
 * qui rattache une reaction a quelqu'un sans jamais le nommer de force. Et
 * l'acteur R9 etant un pseudonyme derive de la cible, il n'y a rien a exposer.
 *
 * CANVAS et non DOM : trois cents elements qui sautent, c'est mort. Un canvas
 * qui dessine trois cents sprites est trivial, et c'est le meme choix que le
 * HUD Skia de la borne, dont ce fichier est le jumeau : l'un pour le web,
 * l'autre pour le marquee.
 *
 * La logique de placement, de niveau et de duree est PURE et exposee sous
 * `NelfeCrowd.calculs` : elle se verifie sans navigateur, et le marquee la
 * reimplementera a l'identique en la lisant ici.
 */
(function () {
  'use strict';

  var RANGEES = 3;
  var PAR_RANGEE = 100;
  var CAPACITE = RANGEES * PAR_RANGEE;

  /* Le GABARIT d'un spectateur : trente-deux pixels de cote, la taille des creatures
   * uniques derivees du pseudo.
   *
   * A trente-deux pixels, agrandir par un entier est exclu dans une bande de bas
   * d'ecran. Les seuls ratios propres vont donc vers le BAS, en divisant par des
   * entiers : un pixel de sortie vaut alors un bloc de deux par deux, il reste carre,
   * et on perd du detail, ce qui est exactement ce qu'on veut au fond.
   *
   * Memes valeurs que le jumeau C#. */
  var TAILLE_SPRITE = 32;
  var DIVISEURS = [1, 2, 2];
  var OPACITES = [1, 0.78, 0.59];
  var RECUL_PAR_RANGEE = 8;

  /* Le dessin de remplacement, huit lignes de huit pixels, en attendant les creatures.
   * Huit divise proprement trente-deux comme seize. Les deux trous de la troisieme
   * ligne sont les yeux : ils laissent voir le fond, donc un regard sans seconde
   * couleur. */
  var GABARIT = [0x24, 0x7E, 0xFF, 0xDB, 0xFF, 0x7E, 0x66, 0x66];

  function tailleRangee(rangee) {
    return TAILLE_SPRITE / DIVISEURS[Math.max(0, Math.min(DIVISEURS.length - 1, rangee))];
  }

  /* ── Les calculs, sans dessin ─────────────────────────────────────────── */

  /**
   * La PLACE de chaque spectateur, attribuee depuis la liste TRIEE des acteurs.
   *
   * Surtout pas un hachage de l'acteur vers une place : avec trois cents places
   * et vingt spectateurs, deux personnes tombent sur la meme une fois sur deux
   * (paradoxe des anniversaires). En triant, tout le monde attribue les places
   * dans le meme ordre : meme foule sur tous les ecrans, zero collision.
   */
  function places(acteurs) {
    var tries = acteurs.slice().sort();
    var out = {};
    for (var i = 0; i < tries.length && i < CAPACITE; i++) {
      // On remplit la rangee de DEVANT d'abord : « trois personnes devant moi »
      // se lit mieux que « trois personnes perdues au fond ».
      out[tries[i]] = { rangee: Math.floor(i / PAR_RANGEE), index: i % PAR_RANGEE };
    }
    return out;
  }

  /**
   * La COULEUR d'un spectateur, derivee de son acteur.
   *
   * Ici une collision n'est qu'une coincidence sans consequence : deux
   * silhouettes de la meme teinte ne genent personne, donc le hachage suffit.
   */
  function teinte(acteur) {
    var h = 0;
    for (var i = 0; i < acteur.length; i++) {
      h = (h * 31 + acteur.charCodeAt(i)) % 360;
    }
    return h;
  }

  /**
   * La DUREE d'affichage d'une etiquette, d'apres le nombre deja a l'ecran.
   *
   * Elle decroit : plus ca reagit, plus les noms s'effacent vite, donc plus de
   * monde est nomme et personne ne monopolise une place. Sous le plancher, on
   * rend zero. L'oeil n'attrape pas un mot en moins de quatre dixiemes, et
   * l'afficher serait du bruit qui pretend informer.
   */
  function dureeEtiquette(dejaAffichees) {
    var haut = 1800;
    var bas = 400;
    var plafond = 8;
    if (dejaAffichees >= plafond) { return 0; }
    var duree = haut - (haut - bas) * (dejaAffichees / plafond);
    return duree < bas ? 0 : Math.round(duree);
  }

  /**
   * La hauteur du saut, d'apres l'INTENSITE du geste (trois crans).
   *
   * Elle suivait le budget deja depense, ce qui n'avait pas de sens : celui qui
   * avait le plus parle sautait le plus haut. C'est la jauge de charge qu'on voit
   * se remplir en tenant le bouton qui doit se retrouver dans le saut.
   */
  function hauteurSaut(niveau) {
    var n = Math.max(1, Math.min(3, niveau || 1));
    return 4 * n;
  }

  /* ── Le rendu ─────────────────────────────────────────────────────────── */

  function monter(canvas, options) {
    options = options || {};
    var ctx = canvas.getContext('2d');
    var calme = false;
    try {
      calme = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (_) {}

    var etat = {
      acteurs: [],
      placement: {},
      vols: [],        // emojis en vol
      etiquettes: [],  // noms affiches
      sauts: {},       // acteur -> fin du saut
      total: 0
    };

    function dimensionner() {
      var ratio = window.devicePixelRatio || 1;
      var l = canvas.clientWidth || 600;
      var h = canvas.clientHeight || 90;
      canvas.width = Math.round(l * ratio);
      canvas.height = Math.round(h * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      // Les silhouettes sont faites de pixels : les lisser les trahirait.
      ctx.imageSmoothingEnabled = false;
    }

    /**
     * Le spectateur, dessine dans un carre de `taille` pixels.
     *
     * PROVISOIRE : la grille de huit sur huit tient la place des creatures uniques.
     * Positions et tailles ARRONDIES : un rectangle pose sur une demi-position se
     * fait interpoler, et un pixel interpole n'est plus un pixel. Quand la creature
     * arrivera, il suffira de remplacer ce corps.
     */
    function silhouette(x, y, taille, hue, opacite) {
      var bloc = Math.floor(taille / 8);
      if (bloc < 1) { return; }
      ctx.globalAlpha = opacite;
      ctx.fillStyle = 'hsl(' + hue + ' 62% 58%)';
      var ix = Math.round(x);
      var iy = Math.round(y);
      for (var ligne = 0; ligne < 8; ligne++) {
        var bits = GABARIT[ligne];
        for (var colonne = 0; colonne < 8; colonne++) {
          if ((bits & (1 << (7 - colonne))) === 0) { continue; }
          ctx.fillRect(ix + colonne * bloc, iy + ligne * bloc, bloc, bloc);
        }
      }
      ctx.globalAlpha = 1;
    }

    function dessiner(maintenant) {
      var l = canvas.clientWidth || 600;
      var h = canvas.clientHeight || 90;
      ctx.clearRect(0, 0, l, h);

      var visibles = Math.min(etat.acteurs.length, CAPACITE);
      var tries = etat.acteurs.slice().sort();

      // Les effectifs REELS par rangee : le pas s'y adapte, pour que les presents
      // occupent toute la largeur quel que soit leur nombre. Un pas fixe tassait
      // la foule a gauche et laissait le reste de l'ecran vide.
      var effectifs = [0, 0, 0];
      for (var e0 = 0; e0 < visibles; e0++) {
        var p0 = etat.placement[tries[e0]];
        if (p0) { effectifs[p0.rangee]++; }
      }

      for (var i = 0; i < visibles; i++) {
        var acteur = tries[i];
        var place = etat.placement[acteur];
        if (!place) { continue; }

        // Les rangees du fond sont plus petites et plus sombres : c'est ce qui
        // donne la profondeur d'un public vu de loin.
        var recul = place.rangee;
        var taille = tailleRangee(recul);
        var opacite = OPACITES[recul];

        // Le pas suit l'effectif de LA RANGEE, et chaque silhouette se pose au
        // centre de sa case : la foule est donc centree et etalee sur toute la
        // bande, quel que soit son effectif.
        var pas = l / Math.max(1, effectifs[recul]);
        var x = (place.index + 0.5) * pas - taille / 2
          + (recul % 2 ? pas * 0.22 : 0);
        var base = h - 4 - recul * RECUL_PAR_RANGEE;

        var saut = 0;
        var finSaut = etat.sauts[acteur];
        if (!calme && finSaut && finSaut.fin > maintenant) {
          var avancement = 1 - (finSaut.fin - maintenant) / finSaut.duree;
          // Arrondi et divise comme la rangee : une hauteur fractionnaire ferait
          // vibrer les bords du sprite.
          saut = Math.round(
            Math.sin(avancement * Math.PI) * finSaut.hauteur / DIVISEURS[recul]);
        }

        silhouette(x, base - taille - saut, taille, teinte(acteur), opacite);
      }

      // Les emojis en vol.
      ctx.textAlign = 'center';
      for (var v = etat.vols.length - 1; v >= 0; v--) {
        var vol = etat.vols[v];
        var age = (maintenant - vol.depuis) / vol.duree;
        if (age >= 1) { etat.vols.splice(v, 1); continue; }
        ctx.globalAlpha = 1 - age;
        ctx.font = Math.round(14 + vol.poids * 4) + 'px system-ui, sans-serif';
        ctx.fillText(vol.emoji, vol.x, vol.y - age * 46);
        ctx.globalAlpha = 1;
      }

      // Les etiquettes, au-dessus de tout, sur une plaque sombre pour tenir le
      // contraste par-dessus la foule.
      ctx.font = '600 11px system-ui, sans-serif';
      for (var e = etat.etiquettes.length - 1; e >= 0; e--) {
        var et = etat.etiquettes[e];
        if (et.jusqua <= maintenant) { etat.etiquettes.splice(e, 1); continue; }
        var largeur = ctx.measureText(et.texte).width + 10;
        var ex = Math.max(largeur / 2 + 2, Math.min(l - largeur / 2 - 2, et.x));
        ctx.globalAlpha = 0.82;
        ctx.fillStyle = '#0b1020';
        ctx.fillRect(ex - largeur / 2, et.y - 22, largeur, 15);
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#e8ecf6';
        ctx.fillText(et.texte, ex, et.y - 11);
      }
    }

    var anime = null;
    function boucle() {
      var maintenant = performance.now();
      dessiner(maintenant);
      // On ne redessine EN CONTINU que s'il se passe quelque chose. La lecon du
      // HUD de la borne : ce n'est pas le contenu qui coute, c'est le nombre de
      // recompositions par seconde.
      var actif = etat.vols.length > 0 || etat.etiquettes.length > 0
        || Object.keys(etat.sauts).some(function (a) { return etat.sauts[a].fin > maintenant; });
      anime = actif ? requestAnimationFrame(boucle) : null;
    }

    function reveiller() {
      if (anime === null) { anime = requestAnimationFrame(boucle); }
    }

    dimensionner();
    window.addEventListener('resize', function () { dimensionner(); dessiner(performance.now()); });

    return {
      /** Pose la liste des spectateurs. Le placement se recalcule : l'ordre trie fait loi. */
      poser: function (acteurs) {
        etat.acteurs = (acteurs || []).slice();
        etat.placement = places(etat.acteurs);
        etat.total = etat.acteurs.length;
        dessiner(performance.now());
      },

      /** Une reaction : la silhouette saute, l'emoji s'envole, le nom parait. */
      reagir: function (r) {
        if (!r || !r.actor) { return; }
        var place = etat.placement[r.actor];
        if (!place) { return; }
        var l = canvas.clientWidth || 600;
        var h = canvas.clientHeight || 90;
        // Le meme calcul qu'au dessin : deux formules pour une seule position
        // finiraient par ne plus donner le meme point.
        var effectifs = [0, 0, 0];
        var tries = etat.acteurs.slice().sort();
        for (var k = 0; k < tries.length && k < CAPACITE; k++) {
          var pk = etat.placement[tries[k]];
          if (pk) { effectifs[pk.rangee]++; }
        }
        var tr = tailleRangee(place.rangee);
        var pas = l / Math.max(1, effectifs[place.rangee]);
        var x = (place.index + 0.5) * pas - tr / 2
          + (place.rangee % 2 ? pas * 0.22 : 0);
        var y = h - 4 - place.rangee * RECUL_PAR_RANGEE - tr;

        var maintenant = performance.now();
        if (!calme) {
          etat.sauts[r.actor] = {
            fin: maintenant + 420,
            duree: 420,
            hauteur: hauteurSaut(r.level)
          };
          // Le plafond de sprites en vol : au-dela, on ne cumule plus.
          if (etat.vols.length < 60 && r.emoji) {
            etat.vols.push({ emoji: r.emoji, x: x + 4, y: y, depuis: maintenant, duree: 1400, poids: 0 });
          }
        }

        if (r.name) {
          var duree = dureeEtiquette(etat.etiquettes.length);
          if (duree > 0) {
            // Le filet : si le plafond est atteint malgre tout, on retire la plus
            // ancienne plutot que de refuser la nouvelle. Sinon la regle punirait
            // celui qui arrive tard.
            if (etat.etiquettes.length >= 8) { etat.etiquettes.shift(); }
            etat.etiquettes.push({
              texte: String(r.name).slice(0, 12),
              x: x, y: y,
              jusqua: maintenant + duree
            });
          }
        }
        reveiller();
      },

      /** Le nombre de spectateurs, pour l'afficher quand la foule sature. */
      total: function () { return etat.total; },

      redessiner: function () { dessiner(performance.now()); }
    };
  }

  /* ── La SOURCE vivante ────────────────────────────────────────────────
   *
   * Le vocabulaire est celui de la BORNE (ReplayReactionText), recopie et non
   * reinvente : neuf familles, trois niveaux d'emoji chacune. Un second
   * vocabulaire pour la meme chose finirait par dire autre chose.
   *
   * Le NIVEAU est l'intensite du geste, la duree d'appui sur la facade, de un a
   * trois. Il choisit l'emoji ET la hauteur du saut. Il ne se confond pas avec le
   * budget depense : melanger les deux ferait sauter le plus haut celui qui a
   * deja le plus parle, ce qui est l'inverse du sens.
   *
   * Les emoji sont ecrits en echappements et non en clair : un fichier source qui
   * transporte des paires de substitution s'est deja fait tronquer ici, et un
   * caractere invisible ne se relit pas.
   */
  var EMOJIS = {
    hype:        ['\uD83D\uDD25', '\u26A1', '\uD83D\uDE80'],
    wow:         ['\uD83D\uDE2E', '\uD83E\uDD2F', '\uD83D\uDC51'],
    respect:     ['\uD83D\uDC4F', '\uD83D\uDE0E', '\uD83E\uDEE1'],
    laugh:       ['\uD83D\uDE04', '\uD83D\uDE02', '\uD83E\uDD23'],
    tension:     ['\uD83D\uDE2C', '\uD83D\uDE30', '\uD83D\uDE31'],
    ouch:        ['\uD83D\uDE16', '\uD83D\uDCA5', '\uD83D\uDC80'],
    love:        ['\u2764\uFE0F', '\uD83E\uDD70', '\uD83E\uDD79'],
    rage:        ['\uD83E\uDDC2', '\uD83D\uDE24', '\uD83E\uDD2C'],
    celebrate:   ['\uD83C\uDF89', '\uD83C\uDF8A', '\uD83C\uDFC6'],
  };

  var REACTIONS = Object.keys(EMOJIS);

  /** L'emoji d'une famille au niveau demande, avec repli sur le premier cran. */
  function emojiDe(famille, niveau) {
    var echelle = EMOJIS[famille];
    if (!echelle) { return ''; }
    var i = Math.max(1, Math.min(echelle.length, niveau || 1)) - 1;
    return echelle[i];
  }

  var PERIODE = 2500;         // le battement quand la page est regardee
  var PERIODE_CACHEE = 15000; // et quand elle ne l'est pas

  /**
   * Branche une foule sur un direct : presence, flux des reactions, envoi.
   *
   * Un seul aller-retour porte la presence ET la lecture. Le POST dit « je suis
   * la » et rend l'etat ; un visiteur sans compte recoit 401 et bascule en GET,
   * ou il regarde la foule sans en faire partie. C'est exactement son cas, donc
   * ce n'est pas une degradation : c'est la bonne reponse.
   */
  function brancher(canvas, session, options) {
    options = options || {};
    var foule = monter(canvas, options);
    var curseur = 0;
    var vus = {};          // les reactions deja dessinees, par identifiant
    var anonyme = false;
    var arrete = false;
    var minuteur = null;
    var etat = { total: 0, capacite: CAPACITE, budget: 5, depense: 0, presence: false };

    function prevenir() {
      if (typeof options.onEtat === 'function') { options.onEtat(etat); }
    }

    function appliquer(p) {
      etat.total = p.total || 0;
      etat.capacite = p.capacity || CAPACITE;
      etat.budget = p.budget || 5;
      etat.depense = p.spent || 0;
      etat.presence = !anonyme;
      foule.poser(p.actors || []);
      (p.reactions || []).forEach(function (r) {
        // Une reaction deja dessinee ne se rejoue pas : son auteur l'a vue tout de
        // suite, et le flux la lui renverrait une seconde fois.
        if (vus[r.id]) { return; }
        vus[r.id] = 1;
        foule.reagir({
          actor: r.actor,
          name: r.name,
          emoji: emojiDe(r.reaction, r.level),
          level: r.level
        });
      });
      if (typeof p.cursor === 'number' && p.cursor > curseur) { curseur = p.cursor; }
      prevenir();
    }

    function planifier() {
      if (arrete) { return; }
      if (minuteur) { clearTimeout(minuteur); }
      minuteur = setTimeout(sonder, document.hidden ? PERIODE_CACHEE : PERIODE);
    }

    function sonder() {
      if (arrete) { return; }

      var adresse = '/api/v1/live/' + session + '/crowd?since=' + curseur;
      var lancer = function (methode) {
        return fetch(adresse, {
          method: methode,
          credentials: 'same-origin',
          headers: { 'Accept': 'application/json' }
        }).then(function (r) {
          if (r.status === 401 && methode === 'POST') {
            // Pas de compte : on regarde, on ne compose pas la foule. Et on lit
            // TOUT DE SUITE en visiteur, sans attendre le battement suivant.
            anonyme = true;
            etat.presence = false;
            return lancer('GET');
          }
          if (r.status === 410) {
            // Le direct n'est plus la : on cesse de sonder, et la presence affichee
            // s'eteint. Une page laissee ouverte sondait sinon un direct fini pour toujours.
            arrete = true;
            etat.presence = false;
            prevenir();
            return null;
          }
          return r.ok ? r.json() : null;
        });
      };

      lancer(anonyme ? 'GET' : 'POST').then(function (p) {
        if (p && p.ok) { appliquer(p); }
        planifier();
      }).catch(function () {
        // Un battement perdu ne casse rien : la foule garde son dernier etat et le
        // curseur n'a pas bouge, donc rien ne sera saute au prochain.
        planifier();
      });
    }

    function reagir(nom, niveau) {
      if (arrete || anonyme || !EMOJIS[nom]) { return Promise.resolve(null); }
      var corps = new URLSearchParams();
      corps.set('reaction', nom);
      corps.set('level', String(Math.max(1, Math.min(3, niveau || 1))));
      return fetch('/api/v1/live/' + session + '/react', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Accept': 'application/json' },
        body: corps
      }).then(function (r) {
        return r.json().catch(function () { return null; });
      }).then(function (p) {
        if (!p) { return null; }
        if (p.ok) {
          // On dessine sans attendre. Deux secondes et demie de silence apres un clic
          // se lisent comme un bouton qui ne marche pas.
          vus[p.id] = 1;
          etat.depense = p.spent;
          etat.presence = true;
          foule.reagir({
            actor: p.actor, name: p.name, emoji: emojiDe(nom, p.level), level: p.level
          });
        } else if (typeof p.spent === 'number') {
          etat.depense = p.spent;
        }
        prevenir();
        return p;
      }).catch(function () { return null; });
    }

    document.addEventListener('visibilitychange', function () {
      // Revenir sur l'onglet rafraichit tout de suite : l'affichage date d'un
      // battement lent, et une salle qui s'est remplie entre-temps se voit.
      if (!document.hidden && !arrete) { sonder(); }
    });

    sonder();

    return {
      reagir: reagir,
      etat: function () { return etat; },
      arreter: function () {
        arrete = true;
        if (minuteur) { clearTimeout(minuteur); minuteur = null; }
      }
    };
  }

  window.NelfeCrowd = {
    monter: monter,
    brancher: brancher,
    REACTIONS: REACTIONS,
    // Exposees pour etre verifiables sans navigateur, et pour que le module marquee
    // reimplemente exactement les memes regles.
    EMOJIS: EMOJIS,
    emojiDe: emojiDe,
    calculs: {
      places: places,
      teinte: teinte,
      dureeEtiquette: dureeEtiquette,
      hauteurSaut: hauteurSaut,
      RANGEES: RANGEES,
      PAR_RANGEE: PAR_RANGEE,
      CAPACITE: CAPACITE
    }
  };
})();
