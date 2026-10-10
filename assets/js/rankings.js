/* Classements certifies, par monde de jeu.
 *
 * La page est rendue vide par le serveur et remplie ici. Le classement change
 * a chaque partie publiee : le figer cote serveur afficherait des scores
 * perimes.
 *
 * SOURCE UNIQUE. Tout vient de /api/v1/scores/board*, qui lit les memes
 * enregistrements que l'index signe. Le classement et l'index ne peuvent donc
 * pas se contredire. Ce fut un temps deux sources - les scores du hub pour la
 * salle, l'index certifie pour le reste - et un joueur qui jouait chez lui
 * avait des scores certifies qui n'apparaissaient nulle part.
 *
 * TROIS MONDES, JAMAIS MELANGES. Salle, maison et contest n'offrent pas les
 * memes garanties : en salle, la mesure se fait sur une borne que le joueur ne
 * controle pas. Les classer ensemble ferait perdre a la plus stricte ce qui la
 * rend stricte. La vue « tout » existe pour PARCOURIR, et montre alors le
 * monde de chaque ligne.
 *
 * Les textes arrivent par i18n.js, qui pose window.NP_I18N. Les emplacements
 * s'ecrivent {nom} : leur ordre dans la phrase change d'une langue a l'autre,
 * et une concatenation ne saurait pas suivre.
 */
const LNG = document.documentElement.lang || 'fr';
const I18N = window.NP_I18N || {};

function T(cle, valeurs) {
  let s = I18N[cle];
  if (s === undefined) { return cle; }
  if (valeurs) {
    for (const nom in valeurs) { s = s.split('{' + nom + '}').join(valeurs[nom]); }
  }
  return s;
}

/* Un texte du dictionnaire, ou rien s'il n'y est pas encore : un navigateur garde le dictionnaire dix
 * minutes, il peut donc preceder les mots d'une nouveaute, et le nom d'une cle ne se montre pas. */
function Tsi(cle, valeurs) { return I18N[cle] === undefined ? '' : T(cle, valeurs); }

function el(id) { return document.getElementById(id); }

/* Le score se lit « 1 234 567 » en francais et « 1,234,567 » en anglais.
 * Traduire les mots sans traduire les chiffres serait a moitie fait. */
function nombre(v) { return Number(v).toLocaleString(LNG); }

/* Le texte passe par textContent, jamais par innerHTML : un pseudo est choisi
 * par un joueur, et rien n'oblige un joueur a la bienveillance. */
function noeud(balise, classe, texte) {
  const n = document.createElement(balise);
  if (classe) { n.className = classe; }
  if (texte !== undefined && texte !== null) { n.textContent = String(texte); }
  return n;
}

/* ── Etat ───────────────────────────────────────────────────────────────── */

// « Tout » par defaut : quelqu'un qui arrive sans rien demander doit voir ce
// qui existe, pas un seul perimetre. Les mondes restent cloisonnes des qu'on
// en choisit un, et le badge de provenance reste sur chaque ligne.
let MONDE = '';   // '' = tous les mondes

/* La fiche d'un jeu reutilise ce script, VERROUILLE sur son jeu : elle porte alors
   `data-game` sur le tableau. Le classement d'un jeu et le classement general sont le
   meme tableau, avec les memes mondes et les memes perimetres ; en ecrire un second
   garantirait qu'ils finissent par se contredire.

   Verrouille, la page ne propose pas de filtre de jeu, et le tableau ne repete ni le
   nom du jeu ni son systeme : son en-tete les porte deja. */
const BOARD = document.querySelector('.rk-board');
/* LE JEU EST UNE CLE « systeme/jeu » : un jeu = systeme + contenu, et le meme nom peut exister
   sur deux machines (Tetris d'arcade, Tetris Game Boy). Une cle sans systeme reste comprise :
   le serveur prend alors la machine ouverte le plus recemment. */
const SYSTEME_VERROU = (BOARD && BOARD.getAttribute('data-system')) || '';
const JEU_VERROU = (BOARD && BOARD.getAttribute('data-game'))
  ? (SYSTEME_VERROU ? SYSTEME_VERROU + '/' : '') + BOARD.getAttribute('data-game')
  : '';
const COLONNES = JEU_VERROU ? 4 : 6;
/* UN JEU A MODES a un classement par mode : la fiche verrouille aussi le mode qu'elle montre. */
const REGLE_VERROU = (BOARD && BOARD.getAttribute('data-ruleset')) || '';

function cleJeu(jeu) { return (jeu.system ? jeu.system + '/' : '') + jeu.game; }
function decouperJeu(cle) {
  const i = cle.indexOf('/');
  return i < 0 ? { system: '', game: cle } : { system: cle.slice(0, i), game: cle.slice(i + 1) };
}
/* Le libelle d'un jeu dans le filtre : sa machine s'ajoute quand son nom n'est pas seul. Un jeu
   y paraît UNE fois, quelles que soient ses regles. */
function libellesDistincts(jeux) {
  const vus = new Map();
  jeux.forEach((jeu) => { const n = libelle(jeu); vus.set(n, (vus.get(n) || 0) + 1); });
  return (jeu) => (vus.get(libelle(jeu)) > 1 && jeu.system ? libelle(jeu) + ' · ' + jeu.system : libelle(jeu));
}
/* Un jeu par cle : la liste du serveur en porte une entree par regle. */
function unParJeu(jeux) {
  const vus = new Map();
  jeux.forEach((jeu) => { if (!vus.has(cleJeu(jeu))) { vus.set(cleJeu(jeu), jeu); } });
  return Array.from(vus.values());
}

/* LES REGLES D'UN JEU (2026-10-02) : 1CC, 1LC, 1CC MULTI, un classement chacune, le 1CC par
   defaut. Le Hall of Fame les propose en filtre quand le jeu choisi en a plusieurs ; la fiche d'un
   jeu les montre en onglets et verrouille la sienne (data-ruleset). */
const REGLE_PAR_DEFAUT = '1cc';
const ORDRE_DES_REGLES = { '1cc': 0, '1lc': 1, '1cc-multi': 2 };
/* Le nom d'une regle tel qu'on l'ecrit partout : 1cc-multi -> 1CC MULTI. Il ne se traduit pas. */
function nomDeRegle(regle) { return regle.toUpperCase().replace(/-/g, ' '); }
const REGLES_PAR_JEU = new Map();
let REGLE = '';
function retenirLesRegles(jeux) {
  jeux.forEach((jeu) => {
    const cle = cleJeu(jeu);
    const regles = REGLES_PAR_JEU.get(cle) || [];
    if (jeu.ruleset && !regles.includes(jeu.ruleset)) { regles.push(jeu.ruleset); }
    regles.sort((a, b) => ((ORDRE_DES_REGLES[a] ?? 9) - (ORDRE_DES_REGLES[b] ?? 9)) || a.localeCompare(b));
    REGLES_PAR_JEU.set(cle, regles);
  });
}
function poserLesRegles() {
  const regles = (JEU && !REGLE_VERROU && REGLES_PAR_JEU.get(JEU)) || [];
  if (!regles.includes(REGLE)) { REGLE = regles.includes(REGLE_PAR_DEFAUT) ? REGLE_PAR_DEFAUT : (regles[0] || ''); }
  const wrap = el('rk-rule-wrap');
  if (!wrap) { return; }
  wrap.hidden = regles.length < 2;
  const liste = el('rk-rule');
  liste.textContent = '';
  regles.forEach((regle) => {
    const o = document.createElement('option');
    o.value = regle;
    o.textContent = nomDeRegle(regle);
    o.setAttribute('translate', 'no');
    liste.appendChild(o);
  });
  liste.value = REGLE;
}

/* LES CLASSEMENTS OFFICIELS, UN PAR TYPE DE DEFI (decision user 2026-10-09) : 1CC (sans les modes
   speciaux d'un jeu), 1CC MULTI, 1CC MM (« Multi Modes » : le 1CC et les modes speciaux, cumules),
   1LC, SPEEDRUN. Le Hall of Fame les propose en filtre et s'ouvre sur le premier ; le serveur decide
   de ce qui entre dans chacun (ScoringRepository::DEFIS, meme liste, meme ordre). La fiche d'un jeu
   n'a pas ce filtre : elle montre un seul classement, celui de sa regle.

   Le defi se lit aussi dans l'adresse (/rankings#1cc-multi) : un classement officiel se partage. */
const DEFIS = ['1cc', '1cc-multi', '1cc-mm', '1lc', 'speedrun'];
let DEFI = '';

function defiDeLAdresse() {
  const voulu = (window.location.hash || '').replace(/^#/, '').toLowerCase();
  return DEFIS.includes(voulu) ? voulu : '';
}

/* Ce que le defi choisi classe, en une phrase sous les filtres. */
function decrireLeDefi() {
  const note = el('rk-challenge-note');
  if (note) { note.textContent = DEFI ? Tsi('challenge_' + DEFI.replace(/-/g, '_')) : ''; }
}

function poserLesDefis() {
  const liste = el('rk-challenge');
  if (!liste) { return; }
  DEFI = defiDeLAdresse() || DEFIS[0];
  DEFIS.forEach((defi) => {
    const o = document.createElement('option');
    o.value = defi;
    o.textContent = nomDeRegle(defi);
    liste.appendChild(o);
  });
  liste.value = DEFI;
  decrireLeDefi();
}

async function changerDefi(defi) {
  if (defi === DEFI || !DEFIS.includes(defi)) { return; }
  DEFI = defi;
  // Le jeu ne survit pas au changement de defi : un jeu sans partie a plusieurs n'a rien a montrer
  // au 1CC MULTI. Ses regles se relisent dans le nouveau defi.
  JEU = '';
  REGLE = '';
  REGLES_PAR_JEU.clear();
  CLES_PAR_LIBELLE.clear();
  el('rk-challenge').value = DEFI;
  decrireLeDefi();
  // L'adresse suit, sans ajouter d'etape au bouton « precedent » ; le defi de l'arrivee n'y ecrit rien.
  try {
    window.history.replaceState(null, '', DEFI === DEFIS[0]
      ? window.location.pathname + window.location.search
      : '#' + DEFI);
  } catch (e) {
    // Une adresse qui ne se reecrit pas n'empeche pas de lire le classement.
  }
  await preparerFiltreJeu();
  charger();
}

let JEU = JEU_VERROU;
let PORTEE = '';         // country | venue | channel, ou '' pour le monde entier
let VALEUR = '';
let PORTEES = {};        // ce que le monde courant propose reellement

/* Au-dela de ce nombre de jeux, la liste deroulante devient une chasse au
 * defilement et le champ de recherche prend le relais. En-deca, la liste
 * gagne : tout est visible, un clic suffit, rien a taper. 50 (demande user
 * 2026-10-07, il etait a 10 et la recherche arrivait des le 11e jeu) : c'est
 * aussi le plus que l'API rend d'un coup (ScoringRepository::boardGames). */
const SEUIL_RECHERCHE = 50;

/* Le libelle affiche vers la cle du jeu : un champ de recherche rend du TEXTE,
 * cette table le ramene a une identite. */
const CLES_PAR_LIBELLE = new Map();

/* L'ordre des onglets suit ce que les gens CHERCHENT, et non la hierarchie des
 * garanties : la maison d'abord, parce que c'est de la que joue la plupart du
 * monde ; « tout » en dernier, parce qu'il ne departage rien.
 *
 * La garantie, elle, ne depend pas de cet ordre : elle se lit sur le badge de
 * provenance porte par CHAQUE ligne. Un onglet ne classe pas, il filtre. */
const MONDES = [
  ['home', 'world_home'],
  ['stream', 'world_stream'],
  ['station', 'world_station'],
  ['', 'world_all'],
];

const PORTEES_CONNUES = [
  ['country', 'scope_country'],
  // « Par ville » est RETIRE DU SELECTEUR pour le moment (demande user 2026-09-23).
  // Rien d'autre ne bouge : le serveur continue de servir cette portee, ses libelles
  // restent traduits, et la remettre tient en une ligne ici.
  // ['city', 'scope_city'],
  ['venue', 'scope_venue'],
  ['channel', 'scope_channel'],
];


/* Le pseudo du lecteur connecte, pose par le serveur sur la section. On
 * compare en minuscules : un pseudo se saisit comme on veut, il designe la
 * meme personne. */
const MOI = (document.querySelector('.rk-board')?.dataset.me || '').toLowerCase();

function cestMoi(ligne) {
  return MOI !== '' && (ligne.player || '').toLowerCase() === MOI;
}

/* ── Le joueur ──────────────────────────────────────────────────────────── */

/* Le joueur (portrait + pseudo cliquable) est une brique commune a tous les tableaux du site :
 * nelfe-board.js. L'ecrire ici aussi, c'est garantir qu'un jour les deux se contrediront. */
function joueur(ligne) { return NelfeBoard.joueur(ligne); }

/* La provenance : le monde, et le lieu ou la chaine quand il y en a un. */
/* Le detail (salle, chaine) ne s'ecrit que quand tous les mondes sont melanges : un monde
 * choisi le dit deja en tete de page. */
function provenance(ligne) { return NelfeBoard.provenance(ligne, MONDE === ''); }

/* ── Les mondes ─────────────────────────────────────────────────────────── */

function poserMondes() {
  const barre = el('rk-worlds');
  MONDES.forEach(([valeur, cle]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = T(cle);
    b.dataset.world = valeur;
    b.addEventListener('click', () => changerMonde(valeur));
    barre.appendChild(b);
  });
  marquerMonde();
}

function marquerMonde() {
  el('rk-worlds').querySelectorAll('button').forEach((b) => {
    const actif = b.dataset.world === MONDE;
    b.classList.toggle('is-active', actif);
    if (actif) { b.setAttribute('aria-current', 'true'); } else { b.removeAttribute('aria-current'); }
  });
}

async function changerMonde(monde) {
  if (monde === MONDE) { return; }
  MONDE = monde;
  // Le perimetre et le jeu ne survivent pas au changement de monde : une salle
  // n'existe pas dans le monde « maison », et un jeu joue en contest peut
  // n'avoir aucun score ailleurs. Ses regles non plus : elles se relisent dans ce monde.
  PORTEE = '';
  VALEUR = '';
  JEU = '';
  REGLES_PAR_JEU.clear();
  marquerMonde();
  await Promise.all([preparerPortees(), preparerFiltreJeu()]);
  charger();
}

/* ── Les perimetres ─────────────────────────────────────────────────────── */

/* On ne propose que ce qui existe. Offrir « par salle » sur le monde
 * « maison » donnerait une liste vide et un classement vide, sans que rien
 * n'explique pourquoi. */
async function preparerPortees() {
  try {
    const r = await fetch('/api/v1/scores/board-scopes?world=' + encodeURIComponent(MONDE));
    PORTEES = r.ok ? (await r.json()).scopes || {} : {};
  } catch (e) {
    PORTEES = {};
  }

  const champ = el('rk-scope');
  champ.textContent = '';
  const tout = document.createElement('option');
  tout.value = '';
  tout.textContent = T('scope_world');
  champ.appendChild(tout);

  PORTEES_CONNUES.forEach(([nom, cle]) => {
    if (!Array.isArray(PORTEES[nom]) || PORTEES[nom].length === 0) { return; }
    const o = document.createElement('option');
    o.value = nom;
    o.textContent = T(cle);
    champ.appendChild(o);
  });

  champ.value = PORTEE;
  remplirValeurs();
}

/* Le nom d'un pays dans la langue de la page ; sans Intl.DisplayNames, son code. */
function nomDuPays(code) {
  try {
    return new Intl.DisplayNames([LNG], { type: 'region' }).of(String(code).toUpperCase()) || code;
  } catch (e) {
    return code;
  }
}

function remplirValeurs() {
  const champ = el('rk-value');
  const enveloppe = el('rk-value-wrap');
  champ.textContent = '';

  // Chaque valeur porte son libelle : l'organisateur d'un contest de salle est
  // un identifiant de lieu, et c'est le NOM de la salle qu'on veut lire.
  // Un pays se lit par son NOM dans la langue de la page (« France » plutot que FR, 2026-10-07), trie
  // dans l'ordre de cette langue ; la valeur reste le code.
  let liste = PORTEE ? (PORTEES[PORTEE] || []) : [];
  if (PORTEE === 'country') {
    liste = liste.map((v) => ({ value: v.value, label: nomDuPays(v.value) }))
      .sort((a, b) => a.label.localeCompare(b.label, LNG));
  }
  enveloppe.hidden = liste.length === 0;
  liste.forEach((v) => {
    const o = document.createElement('option');
    o.value = v.value;
    o.textContent = v.label || v.value;
    champ.appendChild(o);
  });
  VALEUR = liste.length > 0 ? liste[0].value : '';
  if (VALEUR) { champ.value = VALEUR; }
}

/* ── Le filtre de jeu ───────────────────────────────────────────────────── */

function libelle(jeu) {
  return jeu.game_name || jeu.game;
}

async function demanderJeux(terme, combien) {
  const p = new URLSearchParams();
  if (MONDE) { p.set('world', MONDE); }
  // Les jeux du defi choisi : un jeu n'y paraît que s'il y porte un score.
  if (DEFI) { p.set('challenge', DEFI); }
  if (terme) { p.set('q', terme); }
  p.set('limit', String(combien));
  const r = await fetch('/api/v1/scores/board-games?' + p);
  if (!r.ok) { throw new Error(String(r.status)); }
  return r.json();
}

function remplirListe(jeux) {
  const liste = el('rk-game');
  liste.textContent = '';
  const tous = document.createElement('option');
  tous.value = '';
  tous.textContent = T('all_games');
  liste.appendChild(tous);
  retenirLesRegles(jeux);
  jeux = unParJeu(jeux);
  const nommer = libellesDistincts(jeux);
  jeux.forEach((jeu) => {
    const o = document.createElement('option');
    o.value = cleJeu(jeu);
    o.textContent = nommer(jeu);
    liste.appendChild(o);
  });
  liste.value = JEU;
}

function remplirPropositions(reponse, resolue) {
  const propositions = el('rk-games');
  propositions.textContent = '';
  // La table s'ENRICHIT : le libelle qu'on vient de choisir doit rester
  // reconnaissable quand la recherche suivante ne le ramene pas.
  retenirLesRegles(reponse.games || []);
  const jeux = unParJeu(reponse.games || []);
  const nommer = libellesDistincts(jeux);
  jeux.forEach((jeu) => {
    const nom = nommer(jeu);
    CLES_PAR_LIBELLE.set(nom.toLowerCase(), cleJeu(jeu));
    const o = document.createElement('option');
    o.value = nom;
    propositions.appendChild(o);
  });

  const rendus = jeux.length;
  // Un jeu deja choisi ne se fait pas dire qu'il n'existe pas. Sinon : on
  // n'invite a preciser que s'il reste vraiment quelque chose a trouver.
  el('rk-game-hint').textContent = resolue ? ''
    : reponse.total > rendus ? T('game_more')
      : (rendus === 0 ? T('game_none') : '');
}

/* Le serveur dit COMBIEN de jeux portent un score dans ce monde : c'est ce
 * nombre, et non une supposition sur l'avenir, qui decide de la commande. */
async function preparerFiltreJeu() {
  if (JEU_VERROU || !el('rk-search')) { return; }
  // La liste des jeux suit la meme regle que le classement : celle de la derniere demande.
  const demande = ++DEMANDE_DE_JEUX;
  let reponse;
  try {
    reponse = await demanderJeux('', SEUIL_RECHERCHE);
  } catch (e) {
    return; // Le filtre reste sur « tous les jeux », le classement s'affiche.
  }
  if (demande !== DEMANDE_DE_JEUX) { return; }

  el('rk-search').value = '';
  el('rk-game-hint').textContent = '';

  if (reponse.total <= SEUIL_RECHERCHE) {
    remplirListe(reponse.games || []);
    el('rk-game-wrap').hidden = false;
    el('rk-search-wrap').hidden = true;
    return;
  }

  el('rk-game-wrap').hidden = true;
  el('rk-search-wrap').hidden = false;
  remplirPropositions(reponse);
}

let attente = null;
function chercher() {
  clearTimeout(attente);
  attente = setTimeout(async () => {
    const saisie = el('rk-search').value.trim();

    // La cle se resout AVANT le rafraichissement : une saisie vide leve le
    // filtre, un libelle reconnu le pose. Tant qu'on tape et que rien ne
    // correspond, le classement courant reste affiche.
    const cle = saisie === '' ? '' : CLES_PAR_LIBELLE.get(saisie.toLowerCase());
    if (cle !== undefined && cle !== JEU) {
      JEU = cle;
      charger();
    }

    try {
      remplirPropositions(await demanderJeux(saisie, 25), cle !== undefined && cle !== '');
    } catch (e) {
      // Une recherche qui echoue laisse les propositions precedentes.
    }
  }, 250);
}

/* ── Le rendu ───────────────────────────────────────────────────────────── */

/* Bouton « ▷ Replay » : n'apparait QUE si l'entree porte une reference replay -
 * le serveur ne l'attache qu'aux records dont le replay est PUBLIC (jamais un
 * prive, pas meme son existence). Le clic est pris en charge par le funnel
 * (nelfe-runtime.js) via data-nelfe-replay : connexion -> installation -> lecture
 * sur la borne. Le libelle « Replay » se comprend dans les six langues ; le titre
 * s'affine si la cle watch_replay est ajoutee au dictionnaire. */
function boutonReplay(ligne) { return NelfeBoard.boutonReplay(ligne); }
function sansReplay(ligne) { return NelfeBoard.sansReplay ? NelfeBoard.sansReplay(ligne) : null; }
function sceau(ligne) { return NelfeBoard.sceau(ligne); }

const RANGS = ['podium_first', 'podium_second', 'podium_third'];

/* ── Le classement des joueurs ──────────────────────────────────────────── */

/* Sans jeu choisi, on ne classe pas des scores : 10 700 a 19xx ne se mesure pas a
 * 8 920 a Sonic. On classe des JOUEURS, a la place que chacun tient dans le haut
 * de chaque jeu : le serveur donne des points aux dix premiers de chaque jeu
 * (bareme dans la reponse) et cumule. Le tableau change alors de colonnes. */
function vueJoueurs() { return !JEU_VERROU && JEU === ''; }

function poserEntete() {
  const scores = el('rk-head-scores');
  const joueurs = el('rk-head-players');
  if (!scores || !joueurs) { return; }
  scores.hidden = vueJoueurs();
  joueurs.hidden = !vueJoueurs();
}

/* Le nom d'un classement dans la bulle : le jeu, et son mode quand ce n'est pas celui du demarrage,
 * « Bubble Bobble (1CC SUPER) ». Sans lui, le 1CC MM alignerait quatre « Bubble Bobble » que rien
 * ne distingue. */
function nomDuClassement(place) {
  const jeu = place.game_name || place.game;
  const mode = place.mode && !place.mode['default'] && NelfeBoard.libelle ? NelfeBoard.libelle(place.mode.label) : '';
  return mode ? jeu + ' (' + mode + ')' : jeu;
}

/* Les places d'un joueur, pour la bulle : « 19xx · #1 · 25 pts ». Le nom du jeu
 * ne se traduit pas, le reste est un chiffre : la phrase se lit dans les six langues. */
function detailPlaces(ligne) {
  const places = Array.isArray(ligne.placements) ? ligne.placements : [];
  return places.map((p) => nomDuClassement(p) + ' · #' + p.rank + ' · ' + nombre(p.points) + ' ' + T('points_short')).join('\n');
}

function medailles(ligne) {
  const n = noeud('span', 'rk-medals');
  [['gold', '🥇'], ['silver', '🥈'], ['bronze', '🥉']].forEach(([cle, symbole]) => {
    const compte = Number(ligne[cle] || 0);
    if (compte > 0) { n.appendChild(noeud('span', 'rk-medal-count', symbole + ' ' + nombre(compte))); }
  });
  return n;
}

function pointsDe(ligne) {
  const valeur = noeud('span', 'rk-place-score');
  valeur.appendChild(document.createTextNode(nombre(ligne.points)));
  valeur.appendChild(noeud('small', '', ' ' + T('points_short')));
  valeur.title = detailPlaces(ligne);
  return valeur;
}

function rendrePodiumJoueurs(lignes) {
  const podium = el('rk-podium');
  podium.textContent = '';
  if (lignes.length < 2) { return; }

  lignes.slice(0, 3).forEach((ligne, i) => {
    const carte = noeud('li', 'rk-place rk-place-' + (i + 1) + (cestMoi(ligne) ? ' is-me' : ''));
    carte.appendChild(noeud('span', 'rk-medal', T(RANGS[i])));
    carte.appendChild(joueur(ligne));
    carte.appendChild(noeud('span', 'rk-place-game', T('games_ranked', { n: nombre(ligne.games) })));
    carte.appendChild(pointsDe(ligne));
    carte.appendChild(medailles(ligne));
    podium.appendChild(carte);
  });
}

function rendreTableauJoueurs(lignes) {
  const corps = el('rk-rows');
  corps.textContent = '';

  if (lignes.length === 0) {
    const tr = document.createElement('tr');
    // Sans perimetre, c'est le defi lui-meme qui n'a pas encore de score (le 1LC et le SPEEDRUN
    // tant qu'aucun jeu ne les ouvre) : on le dit, plutot que d'accuser un filtre.
    const td = noeud('td', 'rk-state', (DEFI && !(PORTEE && VALEUR) && Tsi('challenge_empty')) || T('empty'));
    td.colSpan = COLONNES;
    tr.appendChild(td);
    corps.appendChild(tr);
    return;
  }

  lignes.forEach((ligne, i) => {
    const tr = document.createElement('tr');
    if (cestMoi(ligne)) { tr.className = 'is-me'; }
    tr.appendChild(noeud('td', 'rk-rank', i + 1));

    const cellule = noeud('td');
    cellule.appendChild(joueur(ligne));
    tr.appendChild(cellule);

    tr.appendChild(noeud('td', 'rk-games', nombre(ligne.games)));

    const cMedailles = noeud('td');
    cMedailles.appendChild(medailles(ligne));
    tr.appendChild(cMedailles);

    const cPoints = noeud('td', 'rk-score');
    cPoints.appendChild(document.createTextNode(nombre(ligne.points)));
    cPoints.title = detailPlaces(ligne);
    tr.appendChild(cPoints);
    corps.appendChild(tr);
  });
}

function rendreDecompteJoueurs(lignes) {
  const jeux = new Set();
  lignes.forEach((l) => (l.placements || []).forEach((p) => jeux.add((p.system || '') + '/' + p.game + '|' + p.ruleset + '|' + (p.world || ''))));
  // Un defi tout neuf n'a parfois qu'un joueur, ou qu'un classement : la phrase s'accorde, au lieu
  // de dire « 1 joueurs classés, sur 1 classements ».
  const forme = lignes.length === 1
    ? (jeux.size === 1 ? 'tally_one_player_one_game' : 'tally_one_player')
    : (jeux.size === 1 ? 'tally_players_one_game' : 'tally_players');
  el('rk-tally').textContent = lignes.length === 0
    ? ''
    : T(I18N[forme] === undefined ? 'tally_players' : forme, { players: nombre(lignes.length), games: nombre(jeux.size) });
}

function rendrePodium(lignes) {
  const podium = el('rk-podium');
  podium.textContent = '';
  // A une seule ligne, un podium ne veut rien dire : il annoncerait deux
  // places vides. Le tableau suffit alors.
  if (lignes.length < 2) { return; }

  lignes.slice(0, 3).forEach((ligne, i) => {
    const carte = noeud('li', 'rk-place rk-place-' + (i + 1)
      + (cestMoi(ligne) ? ' is-me' : ''));
    carte.appendChild(noeud('span', 'rk-medal', T(RANGS[i])));
    carte.appendChild(joueur(ligne));
    if (!JEU_VERROU) {
      const nomJeu = noeud('span', 'rk-place-game', ligne.game_name || ligne.game);
      const modePodium = NelfeBoard.mode ? NelfeBoard.mode(ligne) : null;
      if (modePodium) { nomJeu.appendChild(modePodium); }
      carte.appendChild(nomJeu);
    }
    const valeur = noeud('span', 'rk-place-score');
    const sc = sceau(ligne);
    if (sc) { valeur.appendChild(sc); }
    valeur.appendChild(document.createTextNode(nombre(ligne.value)));
    carte.appendChild(valeur);
    carte.appendChild(NelfeBoard.badge(ligne));
    const rb = boutonReplay(ligne);
    if (rb) { carte.appendChild(rb); }
    podium.appendChild(carte);
  });
}

function rendreTableau(lignes) {
  const corps = el('rk-rows');
  corps.textContent = '';

  if (lignes.length === 0) {
    const tr = document.createElement('tr');
    const td = noeud('td', 'rk-state', T('empty'));
    td.colSpan = COLONNES;
    tr.appendChild(td);
    corps.appendChild(tr);
    return;
  }

  let rang = 0;
  lignes.forEach((ligne) => {
    const tr = document.createElement('tr');
    if (cestMoi(ligne)) { tr.className = 'is-me'; }
    // Un score en attente n'a PAS de rang : il se lit a cote du classement, jamais
    // dedans. Sans quoi il suffirait d'un emulateur inconnu pour s'afficher premier.
    if (ligne.pending) {
      tr.className = (tr.className + ' is-pending').trim();
      tr.appendChild(noeud('td', 'rk-rank', ''));
    } else {
      rang += 1;
      tr.appendChild(noeud('td', 'rk-rank', rang));
    }

    const cellule = noeud('td');
    cellule.appendChild(joueur(ligne));
    if (ligne.pending) {
      const tag = noeud('span', 'rk-pending-tag', T('pending_tag'));
      if (ligne.emulator) {
        tag.title = (ligne.waiting_for === 'settings' ? T('pending_settings') + ' ' : '')
          + ligne.emulator + (ligne.emulator_version ? ' ' + ligne.emulator_version : '');
      }
      cellule.appendChild(tag);
    }
    tr.appendChild(cellule);

    if (!JEU_VERROU) {
      const cJeu = noeud('td');
      const lJeu = document.createElement('a');
      lJeu.className = 'rk-game-link';
      lJeu.href = NelfeBoard.lienJeu(ligne);
      // Le nom d'un jeu ne se traduit pas : c'est une donnee, pas une phrase.
      lJeu.setAttribute('translate', 'no');
      lJeu.textContent = ligne.game_name || ligne.game;
      // AVEC QUOI CE RECORD A ETE FAIT, en infobulle du jeu : deux records du meme jeu
      // peuvent venir de moteurs differents, et qui veut refaire le score doit savoir lequel
      // prendre (demande user 2026-09-22).
      if (ligne.emulator) { lJeu.title = T('made_on', { emulator: ligne.emulator }); }
      cJeu.appendChild(lJeu);
      // Son mode, quand le jeu en a plusieurs : chacun a son classement.
      const modeLigne = NelfeBoard.mode ? NelfeBoard.mode(ligne) : null;
      if (modeLigne) { cJeu.appendChild(modeLigne); }
      // Les empreintes de SA ROM, sous le nom du jeu.
      const roms = NelfeBoard.cartouches(ligne);
      if (roms) { cJeu.appendChild(roms); }
      tr.appendChild(cJeu);
      tr.appendChild(noeud('td', 'rk-system', ligne.system || ''));
    }
    tr.appendChild(provenance(ligne));
    const celluleScore = noeud('td', 'rk-score');
    const sc = sceau(ligne);
    if (sc) { celluleScore.appendChild(sc); }
    celluleScore.appendChild(document.createTextNode(nombre(ligne.value)));
    // Et en clair sous le score : « MAME 0.286 », « MAME (RA) 0.287 », « FinalBurn Neo (RA) ».
    if (ligne.emulator) {
      const moteur = noeud('span', 'rk-emulator', ligne.emulator);
      moteur.setAttribute('translate', 'no');
      moteur.title = T('made_on', { emulator: ligne.emulator });
      celluleScore.appendChild(moteur);
    }
    // La difficulte choisie au depart, quand le jeu en a une.
    const niveau = NelfeBoard.difficulte ? NelfeBoard.difficulte(ligne) : null;
    if (niveau) { celluleScore.appendChild(niveau); }
    const rb = boutonReplay(ligne);
    if (rb) { celluleScore.appendChild(rb); }
    // Pas de bouton, et on sait pourquoi : ce moteur n'enregistre pas de partie.
    const sans = sansReplay(ligne);
    if (sans) { celluleScore.appendChild(sans); }
    tr.appendChild(celluleScore);
    corps.appendChild(tr);
  });
}

/* Le decompte dit l'age du projet plutot que de le cacher. */
function rendreDecompte(lignes) {
  const lieux = new Set(lignes.map((l) => l.venue).filter(Boolean));
  // Un monde sans salle - la maison - ne se fait pas dire « dans une seule
  // salle ». La phrase suit ce que la donnee contient, pas une habitude.
  const forme = lieux.size === 0
    ? (lignes.length === 1 ? 'tally_plain_one' : 'tally_plain')
    : lignes.length === 1 ? 'tally_one_mark'
      : lieux.size === 1 ? 'tally_one_venue' : 'tally';
  el('rk-tally').textContent = lignes.length === 0
    ? ''
    : T(forme, { marks: nombre(lignes.length), venues: nombre(lieux.size) });
}

function etat(message) {
  el('rk-podium').textContent = '';
  el('rk-tally').textContent = '';
  const corps = el('rk-rows');
  corps.textContent = '';
  const tr = document.createElement('tr');
  const td = noeud('td', 'rk-state', message);
  td.colSpan = COLONNES;
  tr.appendChild(td);
  corps.appendChild(tr);
}

/* ── LES SCORES EN ATTENTE ────────────────────────────────────────────────
   Un score joue sur un emulateur que la plateforme ne reconnait pas encore est
   garde, pas detruit. Il n'entre pas au classement, et il ne doit pas non plus
   disparaitre : un score qu'on ne voit nulle part decourage autant qu'un refus.

   Il se charge A LA DEMANDE, par une requete separee. Le classement par defaut
   reste donc exactement ce qu'il etait - le meme pour tout le monde, cachable,
   sans rien a filtrer - et le visiteur ne paie cette lecture que s'il la veut. */
let ETABLIS = [];
let EN_ATTENTE = null;   // null = jamais demandees
let MONTRER_ATTENTE = false;

/* L'ordre des valeurs, sans jamais melanger les deux natures de ligne. */
function fusionner() {
  if (!MONTRER_ATTENTE || !EN_ATTENTE || EN_ATTENTE.length === 0) { return ETABLIS; }
  return ETABLIS.concat(EN_ATTENTE).sort((a, b) => Number(b.value) - Number(a.value));
}

async function basculerAttente(bouton) {
  MONTRER_ATTENTE = !MONTRER_ATTENTE;
  if (MONTRER_ATTENTE && EN_ATTENTE === null) {
    bouton.disabled = true;
    try {
      const choisi = decouperJeu(JEU);
      const regle = REGLE_VERROU || REGLE;
      const r = await fetch('/api/v1/scores/board-pending?limit=50&game=' + encodeURIComponent(choisi.game)
        + (choisi.system ? '&system=' + encodeURIComponent(choisi.system) : '')
        + (regle ? '&ruleset=' + encodeURIComponent(regle) : ''));
      const d = r.ok ? await r.json() : null;
      EN_ATTENTE = d && Array.isArray(d.rows) ? d.rows : [];
    } catch (e) {
      EN_ATTENTE = [];   // le service peut etre coupe sans que le classement le soit
    }
    bouton.disabled = false;
  }
  bouton.setAttribute('aria-pressed', MONTRER_ATTENTE ? 'true' : 'false');
  const etiquette = bouton.querySelector('.rk-pending-label') || bouton;
  etiquette.textContent = MONTRER_ATTENTE ? T('hide_pending') : T('show_pending');
  rendreTableau(fusionner());
}

/* Le bouton n'a de sens que sur un jeu precis : ailleurs, « en attente » ne se compare
   a rien. Il est pose une seule fois, sous le tableau. */
function poserBoutonAttente() {
  if (!JEU || el('rk-pending-toggle')) { return; }
  const corps = el('rk-rows');
  const tableau = corps && corps.closest('table');
  if (!tableau || !tableau.parentNode) { return; }
  const barre = noeud('div', 'rk-pending-bar');

  const b = document.createElement('button');
  b.type = 'button';
  b.id = 'rk-pending-toggle';
  b.className = 'button button-ghost button-small rk-pending-toggle';
  b.setAttribute('aria-pressed', 'false');
  b.appendChild(noeud('span', 'rk-pending-dot'));
  b.appendChild(noeud('span', 'rk-pending-label', T('show_pending')));
  b.addEventListener('click', () => { basculerAttente(b); });
  barre.appendChild(b);

  // « C'est quoi ? » : sans ce lien, « en attente » n'explique rien a qui le lit
  // pour la premiere fois, et la page qui l'explique reste introuvable.
  // Un point d'interrogation plutot qu'une phrase : la question est evidente une fois
  // le bouton lu, et le texte se donne au survol et aux lecteurs d'ecran.
  const aide = document.createElement('a');
  aide.className = 'rk-pending-help';
  aide.href = '/' + (document.documentElement.lang || 'fr') + '/quarantaine';
  aide.textContent = '?';
  aide.title = T('what_pending');
  aide.setAttribute('aria-label', T('what_pending'));
  barre.appendChild(aide);

  tableau.parentNode.insertBefore(barre, tableau.nextSibling);
}

/* ── Le chargement ──────────────────────────────────────────────────────── */

/* LA DERNIERE DEMANDE GAGNE. Deux choix rapides (un defi, puis un autre) lancent deux lectures, et la
 * plus ancienne peut repondre la derniere : sans ce compteur, elle peindrait son classement sous le
 * filtre du second choix. Une reponse qui n'est plus celle de la derniere demande est ignoree. */
let DEMANDE = 0;
let DEMANDE_DE_JEUX = 0;

async function charger() {
  const demande = ++DEMANDE;
  poserLesRegles();
  const p = new URLSearchParams();
  if (MONDE) { p.set('world', MONDE); }
  // Sur un jeu precis on montre un vrai classement ; sans jeu, c'est le classement
  // des joueurs, a la place que chacun tient dans le haut de chaque jeu.
  if (JEU) {
    const choisi = decouperJeu(JEU);
    p.set('game', choisi.game);
    if (choisi.system) { p.set('system', choisi.system); }
    if (REGLE_VERROU || REGLE) { p.set('ruleset', REGLE_VERROU || REGLE); }
    p.set('limit', '50');
  } else if (DEFI) {
    // Le classement des joueurs est celui du defi choisi ; celui d'un jeu suit sa regle.
    p.set('challenge', DEFI);
  }
  if (PORTEE && VALEUR) { p.set('scope', PORTEE); p.set('value', VALEUR); }

  poserEntete();
  etat(T('loading'));
  const joueurs = vueJoueurs();
  try {
    const reponse = await fetch((joueurs ? '/api/v1/scores/board-players?' : '/api/v1/scores/board?') + p);
    if (!reponse.ok) { throw new Error(String(reponse.status)); }
    const donnees = await reponse.json();
    if (demande !== DEMANDE) { return; }
    const lignes = Array.isArray(donnees.rows) ? donnees.rows : [];
    if (joueurs) {
      rendrePodiumJoueurs(lignes);
      rendreTableauJoueurs(lignes);
      rendreDecompteJoueurs(lignes);
    } else {
      ETABLIS = lignes;
      rendrePodium(lignes);
      rendreTableau(fusionner());
      rendreDecompte(lignes);
      poserBoutonAttente();
    }
  } catch (e) {
    // Le service peut etre coupe sans que le site le soit. On le dit, plutot
    // que de laisser un tableau vide se faire passer pour un classement vide.
    if (demande === DEMANDE) { etat(T('failed')); }
  }
}

/* ── Mise en route ──────────────────────────────────────────────────────── */

poserMondes();
// Avant la liste des jeux : elle se demande dans le defi de l'arrivee.
poserLesDefis();

/* Une fiche de jeu n'a pas les memes commandes qu'un classement general : on branche
   ce qui est la, plutot que de supposer une page. */
function brancher(id, evenement, action) {
  const n = el(id);
  if (n) { n.addEventListener(evenement, action); }
}

brancher('rk-scope', 'change', () => {
  PORTEE = el('rk-scope').value;
  remplirValeurs();
  charger();
});
brancher('rk-challenge', 'change', () => { changerDefi(el('rk-challenge').value); });
// Un lien vers /rankings#1cc-multi suivi depuis la page elle-meme ne la recharge pas : on suit l'ancre.
if (el('rk-challenge')) {
  window.addEventListener('hashchange', () => { changerDefi(defiDeLAdresse() || DEFIS[0]); });
}
brancher('rk-value', 'change', () => { VALEUR = el('rk-value').value; charger(); });
brancher('rk-game', 'change', () => { JEU = el('rk-game').value; charger(); });
brancher('rk-rule', 'change', () => { REGLE = el('rk-rule').value; charger(); });
brancher('rk-search', 'input', chercher);

// On attend de savoir QUI on suit avant de peindre : sinon les cases
// s'afficheraient toutes vides puis changeraient sous les yeux du lecteur.
Promise.all([
  preparerPortees(),
  preparerFiltreJeu(),
  window.NelfeFollow ? window.NelfeFollow.charger() : Promise.resolve()
]).then(charger);
