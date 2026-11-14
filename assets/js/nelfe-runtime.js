/*
 * nelfe-runtime.js — Le « funnel » runtime NelfePlay.
 *
 * Rôle : depuis une page web (nelfeplay.com), transformer un clic « ▷ REPLAY »
 * en une lecture réelle sur la borne locale — SANS jamais tomber sur une page
 * d'erreur du navigateur quand APIExpose n'est pas lancé.
 *
 * DÉTECTION SANS FETCH (contournement Local Network Access) :
 *   Les navigateurs bloquent un fetch/XHR HTTPS→loopback (LNA). Mais une
 *   NAVIGATION vers le loopback reste autorisée. Au clic (geste utilisateur), on
 *   ouvre une POPUP sur http://127.0.0.1:12345/nelfeplay/detect :
 *     - APIExpose répond → il REDIRIGE la popup (302) vers nelfeplay.com/apiexpose-ok
 *       (NOTRE origine) avec le statut en query ; cette page signale « présent »
 *       (+ device_id, paired…) au parent via BroadcastChannel puis se ferme.
 *     - APIExpose absent → la popup tombe sur ERR_CONNECTION_REFUSED (contenu DANS
 *       la popup) ; aucun signal n'arrive → au bout d'un court timeout = « absent ».
 *   Puis : présent → on NAVIGUE vers /replay/watch (la borne joue) ; absent → /setup.
 *   Aucun fetch, aucun CORS, aucun bouton, aucune page d'erreur pour l'utilisateur.
 *
 * L'état login vient des attributs data-nelfe-* de <html> (server-rendu ; la CSP
 * `script-src 'self'` interdit un <script> inline).
 *
 * API publique : window.NelfeRuntime = { watchReplay, detectRuntime, config }.
 */
(function () {
  'use strict';

  var _root = (typeof document !== 'undefined' && document.documentElement) ? document.documentElement : null;
  var _ds = (_root && _root.dataset) ? _root.dataset : {};
  var CFG = window.__NELFE__ || {
    locale: _ds.nelfeLocale,
    loggedIn: _ds.nelfeLogged === '1',
    loginUrl: _ds.nelfeLogin,
    setupUrl: _ds.nelfeSetup,
    viewerToken: _ds.nelfeViewer
  };

  var LOCAL = CFG.localBase || 'http://127.0.0.1:12345';
  var WATCH = LOCAL + '/replay/watch';
  var DETECT = LOCAL + '/nelfeplay/detect';
  var LAUNCH = LOCAL + '/nelfeplay/launch';
  var JOIN = LOCAL + '/nelfeplay/join';
  var AVATAR_RECEIVE = LOCAL + '/nelfeplay/avatar/receive';
  var CHECK = '/apiexpose-check';   // popup brandée (MÊME origine) qui rebondit ensuite vers DETECT
  var CHANNEL = 'nelfe-runtime';
  var MACHINE_KEY = 'nelfe.machine.current';
  var LNG_KEY = 'nelfe.lng';
  // Un essai doit laisser passer une chaine qui MARCHE : rebond de la popup (200 ms), sonde ES
  // par la borne (jusqu'a 700 ms), 302, chargement HTTPS de /apiexpose-ok. A 1600 ms, une chaine
  // saine echouait une fois sur quelques-unes et envoyait vers /setup une borne bien presente.
  var DETECT_TIMEOUT_MS = 2500;
  // Cinq essais avant de conclure « absent » : la popup est renvoyee sur /apiexpose-check, qui
  // rebondit a nouveau vers la borne. Une borne vraiment absente coute donc au plus 12,5 s.
  var DETECT_ESSAIS = 5;
  // L'INTENTION de lancer, deposee par la page avant d'ouvrir la popup et relue PAR la popup.
  // Elle passe par localStorage parce que c'est le seul canal partage entre deux fenetres de
  // meme origine : la borne, elle, ne peut rien transporter pour nous (elle ne garde de
  // l'adresse de retour que son origine, pour ne pas devenir un tremplin).
  var INTENT_KEY = 'nelfe.launch.intent';
  var INTENT_TTL_MS = 60000;

  /* --- utilitaires ------------------------------------------------------- */

  function locale() {
    if (CFG.locale) { return CFG.locale; }
    var seg = (location.pathname.split('/')[1] || '').toLowerCase();
    return /^[a-z]{2}$/.test(seg) ? seg : 'fr';
  }
  function loggedIn() { return CFG.loggedIn === true; }

  // Anti-imbrication du return (sinon 414) : réutilise un ?return= existant.
  function currentReturn() {
    try {
      var existing = new URLSearchParams(location.search).get('return');
      if (existing) { return existing; }
    } catch (_) {}
    return location.pathname + location.search;
  }
  function withReturn(base, ret) {
    var url = base || '';
    var r = ret || currentReturn();
    return url + (url.indexOf('?') === -1 ? '?' : '&') + 'return=' + encodeURIComponent(r);
  }
  function loginUrl(ret) { return withReturn(CFG.loginUrl || ('/' + locale() + '/account'), ret); }
  function setupUrl(ret) { return withReturn(CFG.setupUrl || ('/' + locale() + '/setup'), ret); }
  function absoluteReturn(ret) { return ret || (location.origin + location.pathname + location.search); }

  function emit(detail) {
    try { window.dispatchEvent(new CustomEvent('nelfe:runtime', { detail: detail })); } catch (_) {}
    return detail;
  }
  function watchUrl(replayId, ret, regle) {
    var url = WATCH + '?replay_id=' + encodeURIComponent(replayId)
      + '&return=' + encodeURIComponent(absoluteReturn(ret));
    // La regle du classement d'ou part la lecture : un 1LC se fige a la premiere mort (2026-10-10).
    // Une borne qui ne la lit pas l'ignore, et joue le replay entier.
    if (regle) { url += '&ruleset=' + encodeURIComponent(regle); }
    // Jeton de spectateur : il fait descendre l'IDENTITE du visionneur jusqu'a la borne, qui
    // sans lui ne sait pas QUI regarde. Opaque, donc rien n'est expose au passage.
    if (CFG.viewerToken) { url += '&viewer=' + encodeURIComponent(CFG.viewerToken); }
    return url;
  }
  function appendQuery(url, q) {
    if (!q) { return url; }
    return url + (url.indexOf('?') === -1 ? '?' : '&') + q;
  }
  // Résultat de détection → query pour /setup : il affiche rb (RetroBat/ES) + api
  // (APIExpose) + paired À PARTIR DE CE PING, sans re-sonder (donc sans page d'erreur).
  // Absente = tout à 0.
  function statusQuery(res) {
    if (!res || !res.up) { return 'rb=0&api=0&paired=0'; }
    var q = 'rb=' + (res.rb === '1' ? '1' : '0') + '&api=1&paired=' + (res.paired === '1' ? '1' : '0');
    if (res.pseudo) { q += '&pseudo=' + encodeURIComponent(res.pseudo); }
    if (res.deviceId) { q += '&device_id=' + encodeURIComponent(res.deviceId); }
    return q;
  }

  /* --- détection APIExpose par popup + 302 + signal --------------------- */

  // La page /apiexpose-ok (servie par NOTRE site après le 302 du loopback) POSTE son
  // statut (lu en query) au parent. La fermeture de la popup est gérée par runOkPage
  // (elle laisse le ✓ visible un court instant avant de se fermer).
  function signalApiExposePresence() {
    var p = null;
    try { p = new URLSearchParams(location.search); } catch (_) {}
    var msg = {
      nelfe: 'apiexpose-ok',
      rb: p ? p.get('rb') : null,
      api: p ? p.get('api') : null,
      paired: p ? p.get('paired') : null,
      pseudo: p ? p.get('pseudo') : null,
      deviceId: p ? p.get('device_id') : null,
      token: p ? p.get('token') : null   // launch_token à usage unique → autorise l'AUTO-lancement de /replay/watch
    };
    try { var bc = new BroadcastChannel(CHANNEL); bc.postMessage(msg); } catch (_) {}
    try { if (window.opener) { window.opener.postMessage(msg, location.origin); } } catch (_) {}
  }

  // detectRuntime(cb) : ouvre la popup (à faire dans un geste utilisateur), attend
  // le signal, ou conclut « absent » au timeout. cb reçoit { up, paired, deviceId }.
  function detectRuntime(cb) {
    var done = false, bc = null, pop = null, timer = null;
    function finish(res) {
      if (done) { return; } done = true;
      try { if (bc) { bc.close(); } } catch (_) {}
      try { window.removeEventListener('message', onMsg); } catch (_) {}
      if (timer) { clearTimeout(timer); }
      // « présent » : la popup affiche le ✓ puis se ferme d'elle-même (runOkPage).
      // « absent »/bloquée : on ferme nous-mêmes (la popup est sur la page d'erreur loopback).
      if (!res.up) { try { if (pop && !pop.closed) { pop.close(); } } catch (_) {} }
      cb(res);
    }
    function handle(data) {
      if (data && data.nelfe === 'apiexpose-ok') {
        finish({ up: true, rb: data.rb, api: data.api, paired: data.paired, pseudo: data.pseudo, deviceId: data.deviceId || '', token: data.token || '' });
      }
    }
    function onMsg(e) { handle(e && e.data); }
    try { bc = new BroadcastChannel(CHANNEL); bc.onmessage = function (e) { handle(e && e.data); }; } catch (_) {}
    window.addEventListener('message', onMsg, false);

    var essai = 0;
    function urlEssai() {
      return CHECK + '?lng=' + encodeURIComponent(locale()) + '&try=' + essai + '&of=' + DETECT_ESSAIS;
    }
    function tenter() {
      essai++;
      if (essai === 1) {
        // On ouvre NOTRE page brandée (même origine), centrée : elle montre « Vérification… »
        // puis rebondit vers le loopback (voir runCheckPage). Pas d'ouverture directe du loopback
        // (première frame moche). La popup exige un geste utilisateur (appelé depuis un clic).
        try { pop = window.open(urlEssai(), 'nelfe-detect', centeredFeatures(420, 360)); } catch (_) { pop = null; }
        if (!pop) { finish({ up: false, blocked: true }); return; }   // popup bloquée → on suppose absent (aucune erreur affichée)
      } else {
        // La popup fermée par la personne : elle a répondu, on n'insiste pas.
        if (!pop || pop.closed) { finish({ up: false }); return; }
        // On la RENVOIE sur notre page de vérification. Assigner location d'une fenêtre qu'on a
        // ouverte reste permis même quand elle est sur la page d'erreur du loopback ; à défaut,
        // window.open sur le même nom navigue la fenêtre existante sans ouvrir de popup.
        var relancee = false;
        try { pop.location.href = urlEssai(); relancee = true; } catch (_) {}
        if (!relancee) { try { var p2 = window.open(urlEssai(), 'nelfe-detect'); if (p2) { pop = p2; relancee = true; } } catch (_) {} }
        if (!relancee) { finish({ up: false }); return; }
      }
      timer = setTimeout(function () {
        if (done) { return; }
        if (essai < DETECT_ESSAIS) { tenter(); } else { finish({ up: false }); }
      }, DETECT_TIMEOUT_MS);
    }
    tenter();
  }

  // Caractéristiques d'une popup CENTRÉE sur l'écran courant (multi-moniteur).
  function centeredFeatures(w, h) {
    var dl = (window.screenLeft != null ? window.screenLeft : window.screenX) || 0;
    var dt = (window.screenTop != null ? window.screenTop : window.screenY) || 0;
    var vw = window.innerWidth || (document.documentElement && document.documentElement.clientWidth) || screen.width;
    var vh = window.innerHeight || (document.documentElement && document.documentElement.clientHeight) || screen.height;
    var left = Math.max(0, Math.round(dl + (vw - w) / 2));
    var top = Math.max(0, Math.round(dt + (vh - h) / 2));
    return 'scrollbars=no,resizable=no,width=' + w + ',height=' + h + ',left=' + left + ',top=' + top;
  }

  /* --- le funnel : lancer un jeu ---------------------------------------- */

  function poserIntention(system, game, partage, rejoindre) {
    try {
      localStorage.setItem(INTENT_KEY, JSON.stringify({
        system: system || '', game: game, shared: !!partage,
        join: rejoindre || 'none', at: Date.now()
      }));
    } catch (_) {}
  }

  /* La case de diffusion commande le choix d'autorisation : sans diffusion, il ne
     commande rien, et l'afficher laisserait croire qu'il agit. */
  function brancherPartage() {
    var cases = document.querySelectorAll('[data-nelfe-share]');
    Array.prototype.forEach.call(cases, function (c) {
      var bloc = c.closest('p, div, form') || document;
      var choix = bloc.querySelector('[data-nelfe-join]');
      if (!choix) { return; }
      var suivre = function () { choix.hidden = !c.checked; };
      c.addEventListener('change', suivre);
      suivre();
    });
  }

  /* L'annonce se fait quand la borne a CONFIRME le lancement, pas au clic : annoncer un
     direct qui n'a pas demarre serait envoyer les gens vers rien. Entre les deux il y a un
     aller-retour vers la borne, d'ou ce relais. */
  var LIVE_KEY = 'nelfe.live.pending';
  // L'intention de REJOINDRE. Separee de celle de lancer : les deux parcours ne portent pas
  // la meme chose et se melangeraient dans une seule cle.
  var JOIN_KEY = 'nelfe.join.intent';
  // L'intention de REMETTRE une planche d'avatar a la borne (posee par nelfe-avatar.js). La
  // planche voyage dans le FRAGMENT de l'adresse de la borne : il ne quitte pas le navigateur.
  var AVATAR_KEY = 'nelfe.avatar.intent';
  var AVATAR_TTL_MS = 120000;

  function annoncerPlusTard(intention) {
    try {
      localStorage.setItem(LIVE_KEY, JSON.stringify({
        system: intention.system, game: intention.game, join: intention.join || 'none'
      }));
    } catch (_) {}
  }

  function annoncerMaintenant() {
    var brut = null;
    try { brut = localStorage.getItem(LIVE_KEY); localStorage.removeItem(LIVE_KEY); } catch (_) {}
    if (!brut) { return; }
    var o;
    try { o = JSON.parse(brut); } catch (_) { return; }
    if (!o || !o.game) { return; }

    var corps = new URLSearchParams();
    corps.set('kind', 'game');
    corps.set('game', o.game);
    corps.set('system', o.system || '');
    corps.set('join', o.join || 'none');
    // Meme origine, session du site : rien a signer, rien a joindre.
    fetch('/api/v1/live/announce', { method: 'POST', body: corps, credentials: 'same-origin' })
      .catch(function () { /* une annonce ratee ne doit pas gener la partie qui demarre */ });
  }

  // Une intention se REPREND : elle ne vaut qu'une fois, et un reliquat d'un clic
  // abandonne ne doit pas lancer un jeu au prochain passage.
  function prendreIntention() {
    var brut = null;
    try { brut = localStorage.getItem(INTENT_KEY); localStorage.removeItem(INTENT_KEY); } catch (_) {}
    if (!brut) { return null; }
    try {
      var o = JSON.parse(brut);
      return (o && o.game && (Date.now() - o.at) < INTENT_TTL_MS) ? o : null;
    } catch (_) { return null; }
  }

  // launchGame(system, game, opts?) : meme parcours que la lecture d'un replay.
  //   - pas connecte -> login (un score sans compte ne se rattache a personne) ;
  //   - connecte -> detection de la borne (popup). Presente : la popup elle-meme
  //     enchaine sur la borne, avec le jeton qu'elle vient de recevoir. Absente : /setup.
  //
  // C'est la POPUP qui lance, pas cette fenetre : le jeton de lancement est a usage
  // unique et n'arrive que la, et la page du jeu doit rester ou elle est.
  function launchGame(system, game, opts) {
    opts = opts || {};
    if (!game) { return emit({ status: 'error', reason: 'no_game' }); }

    if (!loggedIn()) {
      var to = loginUrl(opts.return);
      emit({ status: 'redirect', to: 'login', game: game, url: to });
      if (!opts.noNav) { toast(t('login_game')); location.href = to; }
      return { status: 'redirect', to: 'login', url: to };
    }

    if (opts.noNav) { return emit({ status: 'detect', game: game }); }

    poserIntention(system, game, opts.shared, opts.join);
    toast(t('detect'));
    detectRuntime(function (res) {
      if (res && res.up) {
        if (res.deviceId) { try { localStorage.setItem(MACHINE_KEY, res.deviceId); } catch (_) {} }
        emit({ status: 'launching', game: game });
      } else {
        prendreIntention();   // rien ne la consommera : on ne la laisse pas trainer
        emit({ status: 'redirect', to: 'setup', game: game });
        location.href = appendQuery(setupUrl(opts.return), statusQuery(res));
      }
    });
    return { status: 'detect', game: game };
  }

  /* --- le funnel : rejoindre la partie de quelqu'un ---------------------- */

  /* L'URL qui part vers la borne ne porte QUE l'identifiant de session. Les mots de
     passe, la borne les demande elle-meme : dans une URL de navigateur ils finiraient
     dans l'historique et dans les journaux. */
  function joinSession(sessionId, opts) {
    opts = opts || {};
    if (!sessionId) { return emit({ status: 'error', reason: 'no_session' }); }

    if (!loggedIn()) {
      var to = loginUrl(opts.return);
      emit({ status: 'redirect', to: 'login', session: sessionId, url: to });
      if (!opts.noNav) { location.href = to; }
      return { status: 'redirect', to: 'login', url: to };
    }
    if (opts.noNav) { return emit({ status: 'detect', session: sessionId }); }

    // LA PLACE DE JOUEUR (1CC MULTI) : lue avant de lancer, sans la reserver. Une place qui attend
    // encore son joueur fait patienter quelques secondes ; plus de place, on previent qu'on regardera.
    if (!opts.placeVue && typeof fetch === 'function') {
      fetch('/api/v1/live/' + encodeURIComponent(sessionId) + '/join', { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; })
        .then(function (d) {
          if (d && d.can_play && d.seat_state === 'wait') { toast(t('seat_wait')); return; }
          if (d && d.can_play && d.seat_state === 'full') { toast(t('seat_full')); }
          opts.placeVue = true;
          joinSession(sessionId, opts);
        });
      return { status: 'detect', session: sessionId };
    }

    try { localStorage.setItem(JOIN_KEY, JSON.stringify({ session: sessionId, at: Date.now() })); } catch (_) {}
    toast(t('detect'));
    detectRuntime(function (res) {
      if (res && res.up) {
        if (res.deviceId) { try { localStorage.setItem(MACHINE_KEY, res.deviceId); } catch (_) {} }
        emit({ status: 'joining', session: sessionId });
      } else {
        try { localStorage.removeItem(JOIN_KEY); } catch (_) {}
        emit({ status: 'redirect', to: 'setup', session: sessionId });
        location.href = appendQuery(setupUrl(opts.return), statusQuery(res));
      }
    });
    return { status: 'detect', session: sessionId };
  }

  function prendreIntentionAvatar() {
    var brut = null;
    try { brut = localStorage.getItem(AVATAR_KEY); localStorage.removeItem(AVATAR_KEY); } catch (_) {}
    if (!brut) { return null; }
    try {
      var d = JSON.parse(brut);
      if (!d || typeof d.png !== 'string' || !d.sha256 || Date.now() - (d.at || 0) > AVATAR_TTL_MS) { return null; }
      return d;
    } catch (_) { return null; }
  }

  function prendreIntentionJoin() {
    var brut = null;
    try { brut = localStorage.getItem(JOIN_KEY); localStorage.removeItem(JOIN_KEY); } catch (_) {}
    if (!brut) { return null; }
    try {
      var o = JSON.parse(brut);
      return (o && o.session && (Date.now() - o.at) < INTENT_TTL_MS) ? o : null;
    } catch (_) { return null; }
  }

  /* --- le funnel : regarder un replay ----------------------------------- */

  // watchReplay(replayId, opts?) :
  //   - pas connecté → login ;
  //   - connecté → détecte la borne (popup) : présente → /replay/watch ; absente → /setup.
  //   opts.noNav : ne rien faire (tests) — renvoie l'action prévue.
  function watchReplay(replayId, opts) {
    opts = opts || {};
    if (!replayId) { return emit({ status: 'error', reason: 'no_replay_id' }); }

    if (!loggedIn()) {
      var to = loginUrl(opts.return);
      emit({ status: 'redirect', to: 'login', url: to, replayId: replayId });
      if (!opts.noNav) { location.href = to; }
      return { status: 'redirect', to: 'login', url: to };
    }

    if (opts.noNav) { return emit({ status: 'detect', replayId: replayId }); }

    toast(t('detect'));
    detectRuntime(function (res) {
      if (res && res.up) {
        if (res.deviceId) { try { localStorage.setItem(MACHINE_KEY, res.deviceId); } catch (_) {} }
        emit({ status: 'navigate', to: 'watch', replayId: replayId });
        // On JOINT le launch_token : /replay/watch AUTO-lance seulement avec un jeton valide.
        location.href = appendQuery(watchUrl(replayId, opts.return, opts.ruleset), res.token ? 'token=' + encodeURIComponent(res.token) : '');
      } else {
        emit({ status: 'redirect', to: 'setup', replayId: replayId });
        location.href = appendQuery(setupUrl(opts.return), statusQuery(res));
      }
    });
    return { status: 'detect', replayId: replayId };
  }

  /* --- habillage : toast + clic + /account ⚡ --------------------------- */

  var STR = {
    fr: { cooldown: 'Ta borne a déjà reçu ta demande', login: 'Connexion à NelfePlay requise pour lancer un replay…', detect: 'Détection de ta borne…', checking: 'Vérification de ta borne…', wait: 'Un instant', connected: 'Borne connectée', launching: 'Lancement du replay…', login_game: 'Connexion \u00e0 NelfePlay requise pour lancer un jeu\u2026', starting_game: 'Lancement du jeu\u2026', started: 'C\u2019est parti, regarde ta borne', not_installed: 'Ce jeu n\u2019est pas install\u00e9 sur ta borne', joining: 'On te connecte a la partie\u2026', avatar_sending: 'Remise de ton avatar a ta borne\u2026', avatar_stored: 'Avatar remis a ta borne', avatar_refused: 'Ta borne n\u2019a pas garde l\u2019avatar', seat_wait: 'Une place de joueur attend encore son joueur : réessaie dans quelques secondes', seat_full: 'Toutes les places de joueur sont prises : tu rejoins en spectateur' },
    en: { cooldown: 'Your cabinet already got your request', login: 'Sign in to NelfePlay to start a replay…', detect: 'Detecting your cabinet…', checking: 'Checking your cabinet…', wait: 'One moment', connected: 'Cabinet connected', launching: 'Starting the replay…', login_game: 'Sign in to NelfePlay to start a game\u2026', starting_game: 'Starting the game\u2026', started: 'Off you go, look at your cabinet', not_installed: 'That game is not installed on your cabinet', joining: 'Connecting you to the game\u2026', avatar_sending: 'Handing your avatar to your cabinet\u2026', avatar_stored: 'Avatar stored on your cabinet', avatar_refused: 'Your cabinet did not keep the avatar', seat_wait: 'A player seat is still waiting for its player: try again in a few seconds', seat_full: 'All player seats are taken: you join as a spectator' },
    es: { cooldown: 'Tu máquina ya recibió tu petición', login: 'Inicia sesión en NelfePlay para lanzar un replay…', detect: 'Detectando tu máquina…', checking: 'Comprobando tu máquina…', wait: 'Un momento', connected: 'Máquina conectada', launching: 'Iniciando el replay…', login_game: 'Inicia sesi\u00f3n en NelfePlay para lanzar un juego\u2026', starting_game: 'Iniciando el juego\u2026', started: '\u00a1Listo! Mira tu m\u00e1quina', not_installed: 'Ese juego no est\u00e1 instalado en tu m\u00e1quina', joining: 'Conectandote a la partida\u2026', avatar_sending: 'Entregando tu avatar a tu m\u00e1quina\u2026', avatar_stored: 'Avatar guardado en tu m\u00e1quina', avatar_refused: 'Tu m\u00e1quina no guard\u00f3 el avatar', seat_wait: 'Un puesto de jugador aún espera a su jugador: vuelve a intentarlo en unos segundos', seat_full: 'Todos los puestos de jugador están ocupados: te unes como espectador' },
    ja: { cooldown: '筐体はすでにリクエストを受け取っています', login: 'リプレイの再生には NelfePlay へのログインが必要です…', detect: '筐体を検出しています…', checking: '筐体を確認しています…', wait: '少々お待ちください', connected: '筐体に接続しました', launching: 'リプレイを起動しています…', login_game: '\u30b2\u30fc\u30e0\u306e\u8d77\u52d5\u306b\u306f NelfePlay \u3078\u306e\u30ed\u30b0\u30a4\u30f3\u304c\u5fc5\u8981\u3067\u3059\u2026', starting_game: '\u30b2\u30fc\u30e0\u3092\u8d77\u52d5\u3057\u3066\u3044\u307e\u3059\u2026', started: '\u958b\u59cb\u3057\u307e\u3057\u305f\u3002\u7b50\u4f53\u3092\u3054\u89a7\u304f\u3060\u3055\u3044', not_installed: '\u3053\u306e\u30b2\u30fc\u30e0\u306f\u7b50\u4f53\u306b\u30a4\u30f3\u30b9\u30c8\u30fc\u30eb\u3055\u308c\u3066\u3044\u307e\u305b\u3093', joining: '\u30b2\u30fc\u30e0\u306b\u63a5\u7d9a\u3057\u3066\u3044\u307e\u3059\u2026', avatar_sending: '\u30a2\u30d0\u30bf\u30fc\u3092\u7b50\u4f53\u306b\u9001\u3063\u3066\u3044\u307e\u3059\u2026', avatar_stored: '\u30a2\u30d0\u30bf\u30fc\u3092\u7b50\u4f53\u306b\u4fdd\u5b58\u3057\u307e\u3057\u305f', avatar_refused: '\u7b50\u4f53\u306f\u30a2\u30d0\u30bf\u30fc\u3092\u4fdd\u5b58\u3057\u307e\u305b\u3093\u3067\u3057\u305f', seat_wait: 'プレイヤー席がまだ別のプレイヤーを待っています。数秒後にもう一度お試しください', seat_full: 'プレイヤー席はすべて埋まっています。観戦者として参加します' },
    zh: { cooldown: '你的机台已经收到请求', login: '登录 NelfePlay 才能播放回放…', detect: '正在检测你的机台…', checking: '正在检查你的机台…', wait: '请稍候', connected: '机台已连接', launching: '正在启动回放…', login_game: '\u767b\u5f55 NelfePlay \u624d\u80fd\u542f\u52a8\u6e38\u620f\u2026', starting_game: '\u6b63\u5728\u542f\u52a8\u6e38\u620f\u2026', started: '\u5df2\u542f\u52a8\uff0c\u8bf7\u770b\u4f60\u7684\u673a\u53f0', not_installed: '\u4f60\u7684\u673a\u53f0\u672a\u5b89\u88c5\u8be5\u6e38\u620f', joining: '\u6b63\u5728\u8fde\u63a5\u5230\u6e38\u620f\u2026', avatar_sending: '\u6b63\u5728\u5c06\u5934\u50cf\u4f20\u9001\u5230\u4f60\u7684\u673a\u53f0\u2026', avatar_stored: '\u5934\u50cf\u5df2\u4fdd\u5b58\u5230\u4f60\u7684\u673a\u53f0', avatar_refused: '\u4f60\u7684\u673a\u53f0\u672a\u4fdd\u5b58\u5934\u50cf', seat_wait: '一个玩家席位仍在等待其玩家：请几秒后重试', seat_full: '所有玩家席位已满：你将以观众身份加入' },
    ko: { cooldown: '기기가 이미 요청을 받았습니다', login: '리플레이를 재생하려면 NelfePlay 로그인이 필요합니다…', detect: '기기를 감지하는 중…', checking: '기기를 확인하는 중…', wait: '잠시만요', connected: '기기 연결됨', launching: '리플레이 실행 중…', login_game: '\uac8c\uc784\uc744 \uc2e4\ud589\ud558\ub824\uba74 NelfePlay \ub85c\uadf8\uc778\uc774 \ud544\uc694\ud569\ub2c8\ub2e4\u2026', starting_game: '\uac8c\uc784 \uc2e4\ud589 \uc911\u2026', started: '\uc2dc\uc791\ud588\uc2b5\ub2c8\ub2e4. \uae30\uae30\ub97c \ubcf4\uc138\uc694', not_installed: '\uc774 \uac8c\uc784\uc740 \uae30\uae30\uc5d0 \uc124\uce58\ub418\uc5b4 \uc788\uc9c0 \uc54a\uc2b5\ub2c8\ub2e4', joining: '\uac8c\uc784\uc5d0 \uc5f0\uacb0 \uc911\u2026', avatar_sending: '\uc544\ubc14\ud0c0\ub97c \uae30\uae30\uc5d0 \uc804\ub2ec\ud558\ub294 \uc911\u2026', avatar_stored: '\uc544\ubc14\ud0c0\uac00 \uae30\uae30\uc5d0 \uc800\uc7a5\ub418\uc5c8\uc2b5\ub2c8\ub2e4', avatar_refused: '\uae30\uae30\uac00 \uc544\ubc14\ud0c0\ub97c \uc800\uc7a5\ud558\uc9c0 \uc54a\uc558\uc2b5\ub2c8\ub2e4', seat_wait: '플레이어 자리가 아직 다른 플레이어를 기다리고 있습니다: 몇 초 후 다시 시도하세요', seat_full: '모든 플레이어 자리가 찼습니다: 관전자로 참여합니다' }
  };
  function tl(key, lng) { var d = STR[lng] || STR.en; return (d[key] != null ? d[key] : (STR.en[key] != null ? STR.en[key] : key)); }
  function t(key) { return tl(key, locale()); }

  var _toastHost = null;
  function toast(msg) {
    if (typeof document === 'undefined' || !document.body) { return; }
    if (!_toastHost) {
      _toastHost = document.createElement('div');
      _toastHost.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483000;pointer-events:none;font:600 14px/1.35 system-ui,Segoe UI,Roboto,sans-serif';
      document.body.appendChild(_toastHost);
    }
    var el = document.createElement('div');
    el.style.cssText = 'max-width:min(92vw,520px);padding:11px 16px;border-radius:12px;color:#fff;background:#5B34D6;box-shadow:0 10px 30px rgba(0,0,0,.35)';
    el.textContent = msg;
    _toastHost.appendChild(el);
    setTimeout(function () { if (el.parentNode) { el.parentNode.removeChild(el); } }, 2600);
  }

  /* ── UN GESTE A LA FOIS VERS LA BORNE ──────────────────────────────────────
     Constat du 2026-09-19 : les visiteurs cliquent plusieurs fois sur « Lancer le
     jeu » ou « Replay ». Chaque clic repartait vers la borne - popup de detection,
     intention posee, lancement - et la borne recevait trois demandes pour une envie.

     Le verrou est GLOBAL, pas par bouton : enchainer deux jeux differents en une
     seconde est le meme probleme pour la borne. Le bouton clique se grise pour que
     l'attente se VOIE, et un clic pendant ce temps repond au lieu de ne rien faire.

     Il tombe tout seul, et aucun etat ne survit a la page : un rechargement suffit
     a repartir si quelque chose s'est mal passe.

     Huit secondes : le temps qu'une borne saisisse la demande et rende la main.
     Au-dela, reessayer est legitime - c'est que la premiere fois n'a pas pris. */
  var VERROU_MS = 8000;
  var _verrouJusqua = 0;

  function verrouille() { return Date.now() < _verrouJusqua; }

  function verrouiller(el) {
    _verrouJusqua = Date.now() + VERROU_MS;
    if (!el) { return; }
    var avant = el.getAttribute('aria-disabled');
    if (el.classList) { el.classList.add('is-cooling'); }
    el.setAttribute('aria-disabled', 'true');
    // Un bouton se desactive vraiment ; un lien n'a pas cet attribut, le verrou global
    // s'en charge et le clic recoit une reponse.
    if ('disabled' in el) { try { el.disabled = true; } catch (_) {} }
    setTimeout(function () {
      if (el.classList) { el.classList.remove('is-cooling'); }
      if (avant === null) { el.removeAttribute('aria-disabled'); } else { el.setAttribute('aria-disabled', avant); }
      if ('disabled' in el) { try { el.disabled = false; } catch (_) {} }
    }, VERROU_MS);
  }

  function onClick(ev) {
    var tgt = ev.target;
    if (!tgt || !tgt.closest) { return; }
    var rep = tgt.closest('[data-nelfe-replay]');
    if (rep) {
      var id = rep.getAttribute('data-nelfe-replay');
      if (id) {
        ev.preventDefault();
        if (verrouille()) { toast(t('cooldown')); return; }
        verrouiller(rep);
        watchReplay(id, { ruleset: rep.getAttribute('data-nelfe-ruleset') || '' });
      }
      return;
    }
    // Rejoindre la partie de quelqu'un. Le marqueur est distinct de `data-nelfe-join`,
    // qui porte le groupe d'autorisations sur la fiche de jeu : `closest()` matcherait
    // sinon le mauvais element, comme cela s'est deja produit avec `data-nelfe-setup`.
    var rej = tgt.closest('[data-nelfe-joinsession]');
    if (rej) {
      ev.preventDefault();
      if (verrouille()) { toast(t('cooldown')); return; }
      verrouiller(rej);
      joinSession(rej.getAttribute('data-nelfe-joinsession') || '');
      return;
    }
    // « Lancer le jeu » et « Defier ce score » sont le MEME geste : seul le libelle
    // change avec le contexte.
    var lan = tgt.closest('[data-nelfe-launch]');
    if (lan) {
      ev.preventDefault();
      if (verrouille()) { toast(t('cooldown')); return; }
      verrouiller(lan);
      // La case de partage vit a cote du bouton, dans le meme bloc d'actions : on la lit
      // au clic plutot que de la recopier sur chaque bouton.
      var bloc = lan.parentNode;
      var part = bloc && bloc.querySelector ? bloc.querySelector('[data-nelfe-share]') : null;
      var choisi = bloc && bloc.querySelector
        ? bloc.querySelector('[data-nelfe-join] input:checked')
        : null;
      launchGame(
        lan.getAttribute('data-nelfe-system') || '',
        lan.getAttribute('data-nelfe-launch') || '',
        {
          shared: !!(part && part.checked),
          // Sans diffusion, l'autorisation n'a pas de sens : on ne la transporte pas.
          join: (part && part.checked && choisi) ? choisi.value : 'none'
        }
      );
      return;
    }
    // NB : marqueur = data-nelfe-setup-LINK (distinct de data-nelfe-setup, qui est
    // la CONFIG portée par <html> = l'URL de /setup ; sinon closest() matcherait la
    // racine à chaque clic et enverrait tout le site sur /setup).
    var su = tgt.closest('[data-nelfe-setup-link]');
    if (su) { ev.preventDefault(); detectThenSetup(su.getAttribute('href') || setupUrl()); }
  }

  // Un lien vers /setup qui veut afficher l'état : on PING d'abord (popup, dans le geste
  // du clic), puis on navigue vers /setup en portant le statut → /setup affiche rb/api/
  // paired À PARTIR DE CE PING, sans re-sonder (donc sans page d'erreur si APIExpose éteint).
  function detectThenSetup(href) {
    toast(t('detect'));
    detectRuntime(function (res) {
      if (res && res.up && res.deviceId) { try { localStorage.setItem(MACHINE_KEY, res.deviceId); } catch (_) {} }
      location.href = appendQuery(href, statusQuery(res));
    });
  }

  // Au retour d'une sonde, l'URL peut porter device_id : on le retient.
  function captureMachineId() {
    try {
      var id = new URLSearchParams(location.search).get('device_id');
      if (id) { localStorage.setItem(MACHINE_KEY, id); }
    } catch (_) {}
  }

  // /account : marque la machine appairée COURANTE (celle dont la détection a
  // renvoyé le device_id) — pastille verte + éclair ⚡, DEVANT le nom. Styles en
  // JS (la CSP `style-src 'self'` interdit l'inline HTML, pas le CSSOM).
  function markCurrentMachine() {
    var id = null;
    try { id = localStorage.getItem(MACHINE_KEY); } catch (_) {}
    if (!id) { return; }
    var rows = document.querySelectorAll('[data-nelfe-device]');
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].getAttribute('data-nelfe-device') !== id) { continue; }
      var name = rows[i].querySelector('strong');
      if (!name || name.parentNode.querySelector('.nelfe-here')) { continue; }
      var badge = document.createElement('span');
      badge.className = 'nelfe-here';
      badge.textContent = '⚡';
      badge.title = (locale() === 'fr') ? 'Cette machine' : 'This machine';
      badge.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;margin-right:8px;border-radius:50%;background:#2ec77a;color:#04210f;font-size:.78rem;vertical-align:middle';
      name.parentNode.insertBefore(badge, name);
      name.style.color = '#2ec77a';
    }
  }

  /* --- pages de la popup officielle (check / ok) ------------------------ */

  function setText(sel, text) {
    try { var el = document.querySelector(sel); if (el) { el.textContent = text; } } catch (_) {}
  }
  // Langue de la popup : ?lng= (posé par le parent sur /apiexpose-check), mémorisé pour
  // /apiexpose-ok (le 302 du loopback perd la query). Repli fr.
  function popupLng() {
    var q = null;
    try { q = new URLSearchParams(location.search).get('lng'); } catch (_) {}
    if (q) { try { sessionStorage.setItem(LNG_KEY, q); } catch (_) {} return q; }
    try { return sessionStorage.getItem(LNG_KEY) || 'fr'; } catch (_) { return 'fr'; }
  }
  // /apiexpose-check : « Vérification… », puis rebond vers le loopback (navigation autorisée).
  // APIExpose présent → il REDIRIGE (302) la popup vers /apiexpose-ok ; absent → page d'erreur
  // loopback CONTENUE dans la popup, le parent conclut « absent » au timeout.
  function runCheckPage() {
    var lng = popupLng();
    var q = null;
    try { q = new URLSearchParams(location.search); } catch (_) {}
    var essai = q ? parseInt(q.get('try'), 10) : 0;
    var total = q ? parseInt(q.get('of'), 10) : 0;
    // Au-delà du premier essai, on le dit : une vérification qui recommence sans le dire
    // ressemble à une vérification qui n'aboutit pas.
    setText('.nc-status', tl('checking', lng) + (essai > 1 && total > 1 ? ' (' + essai + '/' + total + ')' : ''));
    setText('.nc-sub', tl('wait', lng));
    setTimeout(function () { location.href = DETECT + '?to=' + encodeURIComponent(location.origin); }, 200);
  }
  // /apiexpose-ok : « Borne connectée », signale au parent, puis se ferme (✓ laissé visible).
  function runOkPage() {
    var lng = popupLng();
    var q = null;
    try { q = new URLSearchParams(location.search); } catch (_) {}

    // RETOUR de la remise d'une planche : la borne dit si elle l'a gardee, et pourquoi sinon.
    var avatar = q ? q.get('avatar') : null;
    if (avatar !== null) {
      setText('.nc-status', avatar === 'stored' ? tl('avatar_stored', lng) : tl('avatar_refused', lng) + ' (' + avatar + ')');
      setText('.nc-sub', '');
      // Le parent (/account) lit aussi ce resultat : on le lui dit par le meme canal que la presence.
      try { var bc = new BroadcastChannel(CHANNEL); bc.postMessage({ nelfe: 'avatar', state: avatar }); bc.close(); } catch (_) {}
      setTimeout(function () { try { window.close(); } catch (_) {} }, avatar === 'stored' ? 1200 : 3000);
      return;
    }

    // DEUXIEME passage : la borne nous a renvoyes ici apres avoir lance, ou explique
    // pourquoi elle n'a pas pu. On le dit avant de fermer.
    var lance = q ? q.get('launched') : null;
    if (lance !== null) {
      // La borne a confirme : c'est le moment d'annoncer, si le partage etait demande.
      if (lance === '1') { annoncerMaintenant(); }
      setText('.nc-status', lance === '1' ? tl('started', lng) : tl('not_installed', lng));
      setText('.nc-sub', '');
      setTimeout(function () { try { window.close(); } catch (_) {} }, lance === '1' ? 1000 : 2800);
      return;
    }

    setText('.nc-status', tl('connected', lng));
    signalApiExposePresence();

    var jetonBrut = q ? q.get('token') : null;

    // REMETTRE UNE PLANCHE : la borne est la, on lui porte l'avatar dans le fragment. Aucun
    // jeton : la borne ne garde que ce que l'index de la plateforme confirme.
    var planche = prendreIntentionAvatar();
    if (planche) {
      setText('.nc-sub', tl('avatar_sending', lng));
      var charge = { pseudo: planche.pseudo, family: planche.family, variation: planche.variation,
        generator: planche.generator, sha256: planche.sha256, png: planche.png };
      setTimeout(function () {
        location.href = AVATAR_RECEIVE
          + '?to=' + encodeURIComponent(location.origin + '/apiexpose-ok')
          + '#' + encodeURIComponent(JSON.stringify(charge));
      }, 300);
      return;
    }

    // REJOINDRE : meme mecanique que lancer, autre destination.
    var versQui = prendreIntentionJoin();
    if (versQui && jetonBrut) {
      setText('.nc-sub', tl('joining', lng));
      setTimeout(function () {
        location.href = JOIN
          + '?session=' + encodeURIComponent(versQui.session)
          + '&token=' + encodeURIComponent(jetonBrut)
          + '&to=' + encodeURIComponent(location.origin + '/apiexpose-ok');
      }, 300);
      return;
    }

    // PREMIER passage avec une intention de lancer : c'est ici, et seulement ici, que le
    // jeton a usage unique existe. La popup enchaine donc elle-meme vers la borne.
    var intention = prendreIntention();
    var jeton = q ? q.get('token') : null;
    if (intention && jeton) {
      if (intention.shared) { annoncerPlusTard(intention); }
      setText('.nc-sub', tl('starting_game', lng));
      setTimeout(function () {
        // « share » fait heberger la partie en netplay au lieu de la lancer ordinairement,
        // et « play » decide si la borne rapporte le mot de passe des joueurs. Absents, la
        // borne lance comme d'habitude : c'est le cas de la grande majorite des clics.
        var extra = '';
        if (intention.shared) {
          extra += '&share=1';
          if (intention.join && intention.join !== 'none') { extra += '&play=1'; }
        }
        location.href = LAUNCH
          + '?system=' + encodeURIComponent(intention.system || '')
          + '&game=' + encodeURIComponent(intention.game)
          + '&token=' + encodeURIComponent(jeton)
          + extra
          + '&to=' + encodeURIComponent(location.origin + '/apiexpose-ok');
      }, 300);
      return;
    }

    setText('.nc-sub', tl('launching', lng));
    setTimeout(function () { try { window.close(); } catch (_) {} }, 850);
  }

  function endsWith(path, suffix) {
    var p = (path || '').replace(/\/+$/, '');
    return p.slice(-suffix.length) === suffix;
  }

  function boot() {
    // Pages de la popup (servies sur NOTRE origine) : elles pilotent la détection.
    if (endsWith(location.pathname, '/apiexpose-check')) { runCheckPage(); return; }
    if (endsWith(location.pathname, '/apiexpose-ok')) { runOkPage(); return; }
    document.addEventListener('click', onClick, false);
    brancherPartage();
    captureMachineId();
    markCurrentMachine();
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', boot, false); }
    else { boot(); }
  }

  window.NelfeRuntime = { watchReplay: watchReplay, launchGame: launchGame, joinSession: joinSession, detectRuntime: detectRuntime, config: CFG };
})();
