/*
 * nelfe-avatar-head.js : le MOTEUR d'avatar du site, et la tete qu'il dessine partout.
 *
 * Le site n'heberge aucune image d'avatar. Une planche se calcule ICI, dans le navigateur, a
 * partir d'un triplet (pseudo, famille, variation) : c'est la meme arithmetique que sur les
 * bornes, donc les memes pixels et les memes octets.
 *
 * Un seul moteur pour tout le site, parce qu'il y en avait trois qui divergeaient : la tete du
 * compte, la tete de la carte joueur, et le tirage du jour. Un seul worker, un seul cache, une
 * seule regle de decoupe.
 *
 * Ce qu'une page peut demander :
 *   - `data-nelfe-head` sur un <canvas> ou un <img> : la tete du compte connecte ;
 *     avec `data-nelfe-pseudo` + `data-nelfe-family` (+ `data-nelfe-variation`), la tete de
 *     CET avatar la, ce qui sert aux avatars de champion et au candidat du tirage ;
 *   - `NelfeAvatar.poser(element, identite)` pour un element cree apres coup par un script ;
 *   - `NelfeAvatar.moi()` et `NelfeAvatar.planche(identite)` pour qui a besoin des octets,
 *     c'est-a-dire de quoi declarer l'avatar a l'index et le deposer pour la borne.
 */
(function () {
  'use strict';

  var config = document.querySelector('[data-nelfe-head-config]') || document.querySelector('[data-nelfe-avatar]');
  if (!config) { return; }

  var ds = config.dataset;
  var URLS = { worker: ds.nelfeWorker, avatar64: ds.nelfeAvatar64, pako: ds.nelfePako, core: ds.nelfeCore };

  /* La version est dans le NOM du cache : une entree v1 gardait le portrait en entier, et
     servait donc un corps la ou on demande une tete. Un cache qui ne dit pas ce qu'il contient
     ne se corrige pas, il se remplace. */
  var PREFIXE = 'nelfe.av2.';
  var INDEX = 'nelfe.av2.index';
  var GARDE = 16;   // assez pour un compte et ses avatars de champion

  /* --- octets et base64 ----------------------------------------------------- */

  function base64(octets) {
    var s = '';
    for (var i = 0; i < octets.length; i += 0x8000) {
      s += String.fromCharCode.apply(null, octets.subarray(i, i + 0x8000));
    }
    return btoa(s);
  }
  function deBase64(s) {
    var b = atob(s), o = new Uint8Array(b.length);
    for (var i = 0; i < b.length; i++) { o[i] = b.charCodeAt(i); }
    return o;
  }

  /* --- le cache -------------------------------------------------------------- */

  /** Les adresses VERSIONNEES du generateur et du decoupeur entrent dans la clef : une nouvelle
   *  version de l'un ou de l'autre donne d'autres pixels, donc ce qui est garde ne vaut plus. */
  function clef(identite) {
    return [URLS.avatar64, URLS.core, identite.pseudo, identite.family, identite.variation || 0,
      couleursDe(identite).join(',')].join('|');
  }

  /** Les couleurs d'un logo que porte l'identite, ou aucune. */
  function couleursDe(identite) {
    return identite && Array.isArray(identite.palette) ? identite.palette : [];
  }

  /** Une tete doit faire exactement cote x cote x 4 octets : sinon `ImageData` refuse de la
   *  dessiner, et l'erreur se perdrait sans rien afficher. */
  function teteValide(tete, cote) {
    return !!tete && cote > 0 && tete.length === cote * cote * 4;
  }

  function index() {
    try { return JSON.parse(localStorage.getItem(INDEX) || '[]') || []; } catch (_) { return []; }
  }

  function noter(cle) {
    try {
      var liste = index().filter(function (c) { return c !== cle; });
      liste.push(cle);
      while (liste.length > GARDE) { localStorage.removeItem(PREFIXE + liste.shift()); }
      localStorage.setItem(INDEX, JSON.stringify(liste));
    } catch (_) {}
  }

  function lireCache(cle) {
    try {
      var d = JSON.parse(localStorage.getItem(PREFIXE + cle) || 'null');
      if (!d || !d.tete || !d.png || !d.sha256 || !d.generator) { return null; }
      var r = {
        png: deBase64(d.png), sha256: d.sha256, generator: d.generator,
        tete: deBase64(d.tete), cote: d.cote || 32
      };
      if (!teteValide(r.tete, r.cote)) { localStorage.removeItem(PREFIXE + cle); return null; }
      return r;
    } catch (_) { return null; }
  }

  function ecrireCache(cle, r) {
    try {
      localStorage.setItem(PREFIXE + cle, JSON.stringify({
        generator: r.generator, sha256: r.sha256,
        png: base64(r.png), tete: base64(r.tete), cote: r.cote
      }));
      noter(cle);
    } catch (_) {
      // Quota plein ou navigation privee : on recalculera, c'est tout ce que ca coute.
    }
  }

  /* --- le worker, un seul, en file ------------------------------------------ */

  var worker = null, suivant = 1, attentes = {}, extinction = null;

  function ouvrir() {
    if (worker) { return worker; }
    worker = new Worker(URLS.worker);
    worker.onmessage = function (e) {
      var m = e.data || {};
      if (m.type !== 'planche') { return; }
      var pret = attentes[m.id];
      delete attentes[m.id];
      if (!pret) { return; }
      if (m.ok) { pret.resoudre(m); } else { pret.rejeter(new Error(m.error || 'worker')); }
      programmerExtinction();
    };
    worker.onerror = function (e) {
      var tous = attentes;
      attentes = {};
      Object.keys(tous).forEach(function (k) { tous[k].rejeter(new Error(e.message || 'worker')); });
      fermer();
    };
    return worker;
  }

  function fermer() {
    if (worker) { worker.terminate(); worker = null; }
  }

  /** Le worker garde ses scripts charges : le rouvrir a chaque planche couterait le double.
   *  On le laisse donc vivre le temps d'une rafale, puis on le rend. */
  function programmerExtinction() {
    if (extinction) { clearTimeout(extinction); }
    extinction = setTimeout(function () {
      if (!Object.keys(attentes).length) { fermer(); }
    }, 5000);
  }

  function generer(identite) {
    return new Promise(function (resoudre, rejeter) {
      var w;
      try { w = ouvrir(); } catch (e) { rejeter(e); return; }
      var id = suivant++;
      attentes[id] = { resoudre: resoudre, rejeter: rejeter };
      w.postMessage({
        type: 'generer', id: id, urls: URLS,
        pseudo: identite.pseudo, family: identite.family, variation: identite.variation || 0,
        palette: couleursDe(identite)
      });
    });
  }

  /* --- les planches --------------------------------------------------------- */

  var enCours = {};   // une seule generation par identite, meme si trois elements la demandent

  /**
   * La planche d'un avatar : ses octets PNG, son empreinte, et sa tete deja decoupee.
   * @returns {Promise<{png:Uint8Array,sha256:string,generator:string,tete:Uint8Array,cote:number}>}
   */
  function planche(identite) {
    if (!identite || !identite.pseudo || !identite.family) {
      return Promise.reject(new Error('identite'));
    }
    var cle = clef(identite);
    var garde = lireCache(cle);
    if (garde) { noter(cle); return Promise.resolve(garde); }
    if (enCours[cle]) { return enCours[cle]; }

    enCours[cle] = generer(identite).then(function (m) {
      if (!m.portrait) { throw new Error('tete'); }
      var r = {
        png: new Uint8Array(m.png), sha256: m.sha256, generator: m.generator,
        tete: new Uint8Array(m.portrait), cote: m.size || 32
      };
      // Rien de mal forme n'entre dans le cache : il le servirait a chaque visite.
      if (!teteValide(r.tete, r.cote)) { throw new Error('tete ' + r.tete.length + ' octets pour ' + r.cote); }
      ecrireCache(cle, r);
      delete enCours[cle];
      return r;
    }, function (e) {
      delete enCours[cle];
      throw e;
    });
    return enCours[cle];
  }

  /* --- le dessin ------------------------------------------------------------- */

  /** Une image PNG de la tete, pour les <img> que les pages ont deja. Le canvas suffit ici :
   *  ces octets ne sont jamais declares ni partages, ils ne servent qu'a l'affichage. */
  function versUrl(rgba, cote) {
    var c = document.createElement('canvas');
    c.width = cote; c.height = cote;
    var ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), cote, cote), 0, 0);
    return c.toDataURL('image/png');
  }

  function dessiner(element, r) {
    if (element.tagName === 'CANVAS') {
      element.width = r.cote;
      element.height = r.cote;
      var ctx = element.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.putImageData(new ImageData(new Uint8ClampedArray(r.tete), r.cote, r.cote), 0, 0);
      element.hidden = false;
    } else {
      element.src = versUrl(r.tete, r.cote);
    }
    element.classList.add('nelfe-head--prete');
    // Ce qui tenait la place (une initiale, une ancienne image) s'efface : l'avatar est
    // transparent autour de sa silhouette, et on la verrait au travers.
    var cadre = element.parentNode;
    var initiale = cadre ? cadre.querySelector('.nelfe-head-initial, .account-hero-avatar-initial') : null;
    if (initiale) { initiale.hidden = true; }
  }

  /** L'identite ecrite sur l'element, s'il en porte une : l'avatar d'un jeu, un candidat. */
  function identiteDe(element) {
    var d = element.dataset || {};
    if (!d.nelfePseudo || !d.nelfeFamily) { return null; }
    return {
      pseudo: d.nelfePseudo, family: d.nelfeFamily, variation: parseInt(d.nelfeVariation || '0', 10) || 0,
      palette: d.nelfePalette ? d.nelfePalette.split(',') : []
    };
  }

  /**
   * Pose la tete sur un element. Sans identite, c'est celle du compte connecte.
   * @returns {Promise<void>} tenue pour qui veut enchainer, ignorable sinon.
   */
  var jetons = 0;

  function poser(element, identite) {
    if (!element) { return Promise.resolve(); }
    var voulue = identite || identiteDe(element);
    // Le DERNIER demandeur gagne : sans jeton, la tete du compte, lancee au chargement et plus
    // lente a venir, ecraserait l'avatar de champion qu'une page vient d'y poser.
    var jeton = ++jetons;
    element.__nelfeJeton = jeton;
    return (voulue ? Promise.resolve(voulue) : moi())
      .then(function (id) { return planche(id); })
      .then(function (r) { if (element.__nelfeJeton === jeton) { dessiner(element, r); } })
      .catch(function () {
        // Pas d'identite, ou un navigateur qui ne sait pas generer : la place tenue reste.
      });
  }

  /** (Re)pose tous les elements qui en demandent une : au chargement, et apres un changement. */
  function poserTout(racine) {
    var dans = racine || document;
    Array.prototype.forEach.call(dans.querySelectorAll('[data-nelfe-head]'), function (el) { poser(el); });
  }

  /* --- l'identite du compte -------------------------------------------------- */

  var lame = null;   // la promesse en cours ou tenue, pour ne demander /avatar/me qu'une fois

  /** L'avatar EFFECTIF du compte : celui qu'il porte, tirage adopte ou avatar de champion. */
  function moi() {
    if (lame) { return lame; }
    lame = fetch('/api/v1/avatar/me', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (id) {
        if (!id || id.ok !== true) { throw new Error('identity'); }
        return id;
      });
    return lame;
  }

  /** Apres un tirage adopte ou un avatar de champion porte : l'identite a change. */
  function oublierMoi() { lame = null; }

  /* --- la synchronisation : l'index, puis la borne ---------------------------- */

  function declarer(p) {
    return fetch('/api/v1/avatar/declare', {
      method: 'POST',
      credentials: 'same-origin',
      body: new URLSearchParams({
        family: p.family, generator: p.generator, variation: String(p.variation), sha256: p.sha256
      })
    }).then(function (r) { return r.json().catch(function () { return {}; }); })
      .catch(function () { return {}; });
  }

  /**
   * Depose la planche pour la borne du joueur, sauf si elle y est deja (`held`) ou si un depot
   * l'attend deja (`deposited`) : quelques kilo-octets, mais renvoyes a chaque visite ils
   * feraient du trafic pour rien.
   */
  function deposer(p, etat) {
    if (etat && (etat.held || etat.deposited)) { return Promise.resolve(etat); }
    var corps = new FormData();
    corps.append('family', p.family);
    corps.append('generator', p.generator);
    corps.append('variation', String(p.variation));
    corps.append('sha256', p.sha256);
    corps.append('sheet', new Blob([p.png], { type: 'image/png' }), p.sha256 + '.png');
    return fetch('/api/v1/avatar/deposit', { method: 'POST', credentials: 'same-origin', body: corps })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .catch(function () { return {}; });
  }

  /**
   * Declare l'avatar du compte a l'index, puis le depose pour sa borne s'il n'y est pas.
   *
   * Sans geste du joueur, depuis n'importe quelle page qui montre sa tete : une variation
   * adoptee sur /player doit arriver a la borne sans qu'il repasse par /account. Declarer a
   * chaque fois ne coute rien : une declaration identique CONFIRME, et c'est l'accord de
   * plusieurs clients qui fait la preuve.
   *
   * @returns {Promise<{held:boolean}>}
   */
  function synchroniser() {
    return moi().then(function (id) {
      return planche(id).then(function (r) {
        // Le generateur que la planche a vraiment eu, plus le suffixe de la palette d'un logo :
        // deux palettes font deux planches, et l'index doit les tenir pour deux identites.
        var p = {
          family: id.family, variation: id.variation || 0,
          generator: r.generator + (id.generatorSuffix || ''), sha256: r.sha256, png: r.png
        };
        return declarer(p).then(function (index) {
          return deposer(p, index).then(function (apres) {
            var etat = apres && apres.ok ? apres : index;
            return { held: !!(etat && etat.held) };
          });
        });
      });
    });
  }

  window.NelfeAvatar = {
    moi: moi,
    oublierMoi: oublierMoi,
    planche: planche,
    poser: poser,
    poserTout: poserTout,
    synchroniser: synchroniser,
    urlDe: versUrl
  };
  // L'ancien nom, le temps que les pages qui l'appelaient soient toutes passees au nouveau.
  window.NelfeAvatarHead = window.NelfeAvatar;

  poserTout();
})();
