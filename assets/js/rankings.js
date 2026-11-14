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
// La date du record a sa colonne (demande user 2026-10-19).
const COLONNES = JEU_VERROU ? 5 : 7;
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
const ORDRE_DES_REGLES = { '1cc': 0, '1lc': 1, '1cc-multi': 2, '1lc-multi': 3 };
/* Le nom d'une regle tel qu'on l'ecrit partout : 1cc-multi -> 1CC MULTI. Il ne se traduit pas. */
function nomDeRegle(regle) { return regle.toUpperCase().replace(/-/g, ' '); }
const REGLES_PAR_JEU = new Map();
/* LE SELECTEUR « MODE » (demande user 2026-10-20) : le nom de chaque mode d'un jeu dans la langue de la page
   (« 1CC MASTER », « 1CC NORMAL »), tel que le serveur le donne, et le mode de depart, propose en premier. */
const NOMS_DES_MODES = new Map();
const MODES_DE_DEPART = new Set();
let REGLE = '';
function retenirLesRegles(jeux) {
  jeux.forEach((jeu) => {
    const cle = cleJeu(jeu);
    const regles = REGLES_PAR_JEU.get(cle) || [];
    if (jeu.ruleset && !regles.includes(jeu.ruleset)) { regles.push(jeu.ruleset); }
    if (jeu.ruleset && jeu.mode && jeu.mode.label) {
      const noms = jeu.mode.label;
      const nom = noms[LNG] || noms.en || Object.values(noms)[0] || '';
      if (nom) { NOMS_DES_MODES.set(cle + '|' + jeu.ruleset, nom); }
      if (jeu.mode['default']) { MODES_DE_DEPART.add(cle + '|' + jeu.ruleset); }
    }
    regles.sort((a, b) => (Number(MODES_DE_DEPART.has(cle + '|' + b)) - Number(MODES_DE_DEPART.has(cle + '|' + a)))
      || ((ORDRE_DES_REGLES[a] ?? 9) - (ORDRE_DES_REGLES[b] ?? 9)) || a.localeCompare(b));
    REGLES_PAR_JEU.set(cle, regles);
  });
}
function poserLesRegles() {
  const regles = (JEU && !REGLE_VERROU && REGLES_PAR_JEU.get(JEU)) || [];
  if (!regles.includes(REGLE)) {
    /* Le mode de depart du jeu d'abord : celui de TGM2 est Normal (1cc-normal), son classement « 1cc » est Master. */
    const depart = regles.find((r) => MODES_DE_DEPART.has(JEU + '|' + r));
    REGLE = depart || (regles.includes(REGLE_PAR_DEFAUT) ? REGLE_PAR_DEFAUT : (regles[0] || ''));
  }
  const wrap = el('rk-rule-wrap');
  if (!wrap) { return; }
  if (LIBELLE_MODE) { LIBELLE_MODE.textContent = TEXTE_MODE; }
  wrap.hidden = regles.length < 2;
  const liste = el('rk-rule');
  liste.textContent = '';
  regles.forEach((regle) => {
    const o = document.createElement('option');
    o.value = regle;
    o.textContent = NOMS_DES_MODES.get(JEU + '|' + regle) || nomDeRegle(regle);
    o.setAttribute('translate', 'no');
    liste.appendChild(o);
  });
  liste.value = REGLE;
}

/* LES CLASSEMENTS OFFICIELS, UN PAR TYPE DE DEFI (decision user 2026-10-09) : 1CC (sans les modes
   speciaux d'un jeu), 1CC MULTI, 1CC MM (« Multi Modes » : le 1CC et les modes speciaux, cumules),
   1LC, SPEEDRUN. Le Hall of Fame les propose en filtre et s'ouvre sur le premier ; le serveur decide
   de ce qui entre dans chacun (ScoringRepository::DEFIS, meme liste, meme ordre : 1CC, 1LC, 1CC MM, 1CC MULTI,
   SPEEDRUN, decision user 2026-10-19). La fiche d'un jeu
   n'a pas ce filtre : elle montre un seul classement, celui de sa regle.

   Le defi se lit aussi dans l'adresse (/rankings#1cc-multi) : un classement officiel se partage. */
const DEFIS = ['1cc', '1lc', '1cc-mm', '1cc-multi', '1lc-multi', 'speedrun', 'challenge', 'mass-run'];

/* AFFICHAGE SEULEMENT (demande user 11/11) : chaque mode a deja son classement et son passeport certifies, et le 1CC
   « sans les modes » doublait presque le 1CC MM. Le selecteur montre donc le 1CC MM en tete, sous le nom « 1CC », et
   masque l'ancien 1CC. Les valeurs internes, l'API (challenge=1cc-mm, challenge=1cc) et la copie statique ne changent pas.
   Les ancres #1cc et #1cc-mm menent toutes deux a l'entree affichee « 1CC ». */
const DEFIS_AFFICHES = ['1cc-mm', '1lc', '1cc-multi', '1lc-multi', 'speedrun', 'challenge', 'mass-run'];
const DEFI_AFFICHE_1CC = '1cc-mm';
function nomAffiche(defi) { return defi === DEFI_AFFICHE_1CC ? '1CC' : nomDeRegle(defi); }

/* LE NOM DU DEFI EN CLAIR (demande du user du 23/10 : « les gens s'interrogent ») : 1CC = One-Credit Challenge,
   1LC = One-Life Challenge. Il ne se traduit pas ; un mode garde le nom de sa famille (1cc-super, 1lc-master). Meme
   table que NelfePlay\Defis cote serveur. */
const NOMS_DES_DEFIS = [
  ['1lc-multi', 'One-Life Challenge, multiplayer'],
  ['1cc-multi', 'One-Credit Challenge, multiplayer'], ['1cc-mm', 'One-Credit Challenge, Multi Modes'],
  ['1lc', 'One-Life Challenge'], ['speedrun', 'Speedrun'], ['challenge', 'Challenge'], ['mass-run', 'Mass Run'],
  ['1cc', 'One-Credit Challenge'],
];
function nomDuDefi(regle) {
  const r = String(regle || '').toLowerCase();
  const trouve = NOMS_DES_DEFIS.find(([famille]) => r === famille || r.indexOf(famille + '-') === 0);
  return trouve ? trouve[1] : '';
}

let DEFI = '';

/* LE SPEEDRUN SE CLASSE PAR EPREUVE (decision du user du 30/10) : un niveau, un boss, le jeu entier, chacun au temps, sans
   points. Le filtre de jeu y devient celui des epreuves ouvertes (/api/v1/challenges/boards), et le tableau montre un temps.
   Il n'y a pas de vue « toutes les epreuves » : des temps de niveaux differents ne se comparent pas. */
const SPEEDRUN = 'speedrun';
/* LES CHALLENGES (decision du user du 02/11) : une entree a part, apres SPEEDRUN. Un speedrun se choisit par jeu puis par
   mode (ANY% et chaque niveau), un challenge par jeu puis par defi. Chaque performance est independante : rien ne s'additionne. */
const CHALLENGE = 'challenge';
/* MASS RUN (CDC MASS RUN §13 bis, 05/11) : une cote OpenSkill par jeu et par format, sans points par course. Il se parcourt
   comme les epreuves : le jeu, puis le format (Mass Speedrun, Mass Survival) ; « Tous les jeux » montre les points du
   classement general (les dix premiers du Mass Speedrun permanent de chaque jeu). Monde maison seulement en V1. */
const MASS_RUN = 'mass-run';
function enEpreuves() { return !JEU_VERROU && (DEFI === SPEEDRUN || DEFI === CHALLENGE || DEFI === MASS_RUN); }
/* Les formats de chaque jeu qui a des cotes MASS RUN, par cle « systeme/jeu ». */
const FORMATS_MASS_RUN = new Map();
/* Un speedrun (speedrun_level, speedrun_full...) ou un challenge (tout autre type de reglement). */
function estUnSpeedrun(epreuve) { return String((epreuve && epreuve.kind) || '').indexOf('speedrun') === 0; }
let EPREUVE = '';
let EPREUVES = [];
let JEU_EPREUVE = '';
let CADENCE = 60;

function defiDeLAdresse() {
  const voulu = (window.location.hash || '').replace(/^#/, '').toLowerCase();
  if (voulu === '1cc') { return DEFI_AFFICHE_1CC; }
  return DEFIS.includes(voulu) ? voulu : '';
}

/* Ce que le defi choisi classe, en une phrase sous les filtres. */
function decrireLeDefi() {
  const note = el('rk-challenge-note');
  if (note) { note.textContent = DEFI ? Tsi('challenge_' + (DEFI === DEFI_AFFICHE_1CC ? '1cc' : DEFI).replace(/-/g, '_')) : ''; }
}

function poserLesDefis() {
  const liste = el('rk-challenge');
  if (!liste) { return; }
  DEFI = defiDeLAdresse() || DEFIS_AFFICHES[0];
  DEFIS_AFFICHES.forEach((defi) => {
    const o = document.createElement('option');
    o.value = defi;
    o.textContent = nomAffiche(defi);
    o.title = nomDuDefi(defi === DEFI_AFFICHE_1CC ? '1cc' : defi);
    liste.appendChild(o);
  });
  liste.value = DEFI;
  decrireLeDefi();
}

async function changerDefi(defi) {
  if (defi === DEFI || !DEFIS_AFFICHES.includes(defi)) { return; }
  DEFI = defi;
  // Une epreuve ne se filtre ni par pays, ni par salle, ni par chaine : son classement est celui d'un monde.
  PORTEE = '';
  VALEUR = '';
  // Le jeu ne survit pas au changement de defi : un jeu sans partie a plusieurs n'a rien a montrer
  // au 1CC MULTI. Ses regles se relisent dans le nouveau defi.
  JEU = '';
  REGLE = '';
  EPREUVE = '';
  JEU_EPREUVE = '';
  REGLES_PAR_JEU.clear();
  CLES_PAR_LIBELLE.clear();
  el('rk-challenge').value = DEFI;
  decrireLeDefi();
  // L'adresse suit, sans ajouter d'etape au bouton « precedent » ; le defi de l'arrivee n'y ecrit rien.
  try {
    window.history.replaceState(null, '', DEFI === DEFIS_AFFICHES[0]
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

/* LES JEUX PAR ORDRE ALPHABETIQUE (demande user 2026-10-19), selon la langue de la page et sans tenir
 * compte des majuscules ni des accents. Le serveur les rend dans l'ordre de leurs scores. */
function alphabetique(jeux, nommer) {
  return jeux.slice().sort((a, b) => nommer(a).localeCompare(nommer(b), LNG, { sensitivity: 'base', numeric: true }));
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
  alphabetique(jeux, nommer).forEach((jeu) => {
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
  alphabetique(jeux, nommer).forEach((jeu) => {
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
  if (enEpreuves()) {
    await preparerEpreuves();
    return;
  }
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

/* Le nom d'une epreuve : celui du reglement dans la langue de la page, sinon celui de son identifiant
   (sonic-the-hedgehog.green-hill-1 : « Green Hill 1 »). Il ne se traduit pas plus qu'un nom de jeu. */
function nomDEpreuve(epreuve) {
  const titre = epreuve && epreuve.title;
  if (typeof titre === 'string' && titre) { return titre; }
  if (titre && typeof titre === 'object') {
    const nom = titre[LNG] || titre.en || Object.values(titre)[0];
    if (nom) { return nom; }
  }
  const id = String((epreuve && epreuve.challenge_id) || '');
  return id.slice(id.indexOf('.') + 1).split('-').filter(Boolean)
    .map((mot) => mot.charAt(0).toUpperCase() + mot.slice(1)).join(' ');
}

/* Les jeux qui ont des cotes MASS RUN, dans le filtre de jeu ; leurs formats dans le second selecteur. */
async function preparerMassRun() {
  const demande = ++DEMANDE_DE_JEUX;
  let reponse = null;
  try {
    if (MONDE === '' || MONDE === 'home') {
      const r = await fetch('/api/v1/massrun/games');
      reponse = r.ok ? await r.json() : null;
    }
  } catch (e) {
    reponse = null;
  }
  if (demande !== DEMANDE_DE_JEUX) { return; }
  const jeux = reponse && Array.isArray(reponse.games) ? reponse.games : [];
  FORMATS_MASS_RUN.clear();
  jeux.forEach((jeu) => { FORMATS_MASS_RUN.set(jeu.system + '/' + jeu.game, Array.isArray(jeu.formats) ? jeu.formats : []); });
  const ordre = jeux.map((jeu) => [jeu.system + '/' + jeu.game, jeu.game_name || jeu.game])
    .sort((a, b) => a[1].localeCompare(b[1], LNG));
  const liste = el('rk-game');
  liste.textContent = '';
  const tous = document.createElement('option');
  tous.value = '';
  tous.textContent = T('all_games');
  liste.appendChild(tous);
  ordre.forEach(([cle, nom]) => {
    const o = document.createElement('option');
    o.value = cle;
    o.textContent = nom;
    liste.appendChild(o);
  });
  if (!FORMATS_MASS_RUN.has(JEU_EPREUVE)) { JEU_EPREUVE = ''; }
  liste.value = JEU_EPREUVE;
  liste.setAttribute('translate', 'no');
  el('rk-game-wrap').hidden = ordre.length === 0;
  el('rk-search-wrap').hidden = true;
  poserLesFormats();
}

/* Le format d'une course MASS RUN : chacun a sa cote. */
function poserLesFormats() {
  const wrap = el('rk-rule-wrap');
  const liste = el('rk-rule');
  if (!wrap || !liste) { return; }
  if (LIBELLE_MODE) { LIBELLE_MODE.textContent = Tsi('massrun_format') || TEXTE_MODE; }
  liste.textContent = '';
  const formats = FORMATS_MASS_RUN.get(JEU_EPREUVE) || [];
  formats.forEach((format) => {
    const o = document.createElement('option');
    o.value = format;
    o.textContent = Tsi('massrun_format_' + format) || format;
    o.setAttribute('translate', 'no');
    liste.appendChild(o);
  });
  if (!formats.includes(EPREUVE)) { EPREUVE = formats.length > 0 ? formats[0] : ''; }
  liste.value = EPREUVE;
  wrap.hidden = JEU_EPREUVE === '' || formats.length === 0;
}

async function preparerEpreuves() {
  if (DEFI === MASS_RUN) {
    await preparerMassRun();
    return;
  }
  const demande = ++DEMANDE_DE_JEUX;
  let reponse = null;
  try {
    const r = await fetch('/api/v1/challenges/boards' + (MONDE ? '?world=' + encodeURIComponent(MONDE) : ''));
    reponse = r.ok ? await r.json() : null;
  } catch (e) {
    reponse = null;
  }
  if (demande !== DEMANDE_DE_JEUX) { return; }
  const toutes = reponse && Array.isArray(reponse.trials) ? reponse.trials : [];
  EPREUVES = toutes.filter((epreuve) => estUnSpeedrun(epreuve) === (DEFI === SPEEDRUN));
  // Le jeu d'abord : un par jeu qui a au moins une epreuve de ce type, dans l'ordre alphabetique de son nom.
  const jeux = new Map();
  EPREUVES.forEach((epreuve) => {
    const cle = epreuve.system + '/' + epreuve.game;
    if (!jeux.has(cle)) { jeux.set(cle, epreuve.game_name || epreuve.game); }
  });
  const ordre = Array.from(jeux.entries()).sort((a, b) => a[1].localeCompare(b[1], LNG));
  const liste = el('rk-game');
  liste.textContent = '';
  // « Tous les jeux » : le classement des joueurs de la famille, aux points (note Kinch par jeu, Any% a part).
  const tous = document.createElement('option');
  tous.value = '';
  tous.textContent = T('all_games');
  liste.appendChild(tous);
  ordre.forEach(([cle, nom]) => {
    const o = document.createElement('option');
    o.value = cle;
    o.textContent = nom;
    liste.appendChild(o);
  });
  if (!jeux.has(JEU_EPREUVE)) { JEU_EPREUVE = ''; }
  liste.value = JEU_EPREUVE;
  liste.setAttribute('translate', 'no');
  el('rk-game-wrap').hidden = ordre.length === 0;
  el('rk-search-wrap').hidden = true;
  poserLesEpreuvesDuJeu();
}

/* Le libelle d'origine du selecteur « Mode », rendu quand on quitte les epreuves. */
const LIBELLE_MODE = el('rk-rule-wrap') ? el('rk-rule-wrap').querySelector('span') : null;
const TEXTE_MODE = LIBELLE_MODE ? LIBELLE_MODE.textContent : '';

/* Le second selecteur : le mode d'un speedrun (ANY% d'abord, puis les niveaux dans l'ordre du jeu) ou le defi d'un
   challenge. Il reste visible meme avec un seul choix : c'est lui qui dit ce que le classement mesure. */
function poserLesEpreuvesDuJeu() {
  if (DEFI === MASS_RUN) {
    poserLesFormats();
    return;
  }
  const duJeu = EPREUVES.filter((epreuve) => epreuve.system + '/' + epreuve.game === JEU_EPREUVE)
    .sort((a, b) => (Number(b.kind === 'speedrun_full') - Number(a.kind === 'speedrun_full'))
      || ((Number(a.order) || 0) - (Number(b.order) || 0)) || nomDEpreuve(a).localeCompare(nomDEpreuve(b), LNG));
  const wrap = el('rk-rule-wrap');
  const liste = el('rk-rule');
  if (!wrap || !liste) { return; }
  if (LIBELLE_MODE) { LIBELLE_MODE.textContent = DEFI === CHALLENGE ? (Tsi('trial_challenge') || TEXTE_MODE) : TEXTE_MODE; }
  liste.textContent = '';
  // LE CLASSEMENT KINCH DU JEU (decision du user du 02/11) : un par type d'epreuves notees qui en compte au moins deux.
  const types = new Map();
  duJeu.filter((e) => e.kind !== 'speedrun_full').forEach((e) => types.set(e.kind, (types.get(e.kind) || 0) + 1));
  const valeurs = [];
  types.forEach((n, kind) => {
    if (n < 2) { return; }
    const o = document.createElement('option');
    o.value = 'jeu:' + kind;
    o.textContent = Tsi('kinch_' + kind, { n: nombre(n) }) || Tsi('kinch_all', { n: nombre(n) }) || kind;
    liste.appendChild(o);
    valeurs.push(o.value);
  });
  duJeu.forEach((epreuve) => {
    const o = document.createElement('option');
    o.value = epreuve.ruleset;
    o.textContent = nomDEpreuve(epreuve);
    o.setAttribute('translate', 'no');
    liste.appendChild(o);
    valeurs.push(o.value);
  });
  if (!valeurs.includes(EPREUVE)) { EPREUVE = valeurs.length > 0 ? valeurs[0] : ''; }
  liste.value = EPREUVE;
  wrap.hidden = JEU_EPREUVE === '' || valeurs.length === 0;
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

/* LA DATE D'UN RECORD (demande user 2026-10-19) : le serveur l'ecrit en UTC, « 2026-10-19 19:10:48 ».
 * Elle se lit dans la langue de la page, a la date du lecteur. */
function dateDe(texte) {
  const d = texte ? new Date(String(texte).replace(' ', 'T') + 'Z') : null;
  return d && !isNaN(d.getTime()) ? d : null;
}

function dateCourte(texte) {
  const d = dateDe(texte);
  return d ? d.toLocaleDateString(LNG, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
}

function balisDate(classe, texte) {
  const t = noeud('time', classe, dateCourte(texte));
  const d = dateDe(texte);
  if (d) { t.dateTime = d.toISOString(); }
  return t;
}

/* Depuis combien de jours ce record tient sa place, en jours du calendrier du lecteur. Le serveur dit
 * depuis quand (held_since) : la pose du record, ou le jour ou un joueur du dessus l'a depasse. */
function joursALaPlace(ligne) {
  const d = dateDe(ligne.held_since || ligne.at);
  if (!d) { return null; }
  const maintenant = new Date();
  const jours = Math.max(0, Math.round(
    (new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate())
      - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000));
  const texte = jours === 0 ? Tsi('held_today') : (jours === 1 ? Tsi('held_one') : Tsi('held_days', { n: nombre(jours) }));
  if (!texte) { return null; }
  const n = noeud('span', 'rk-place-held', texte);
  n.title = Tsi('held_title', { date: dateCourte(ligne.held_since || ligne.at) });
  return n;
}

/* LA LISTE COMMENCE APRES LE PODIUM (demande user 2026-10-19) : les trois premiers ne se repetent pas
 * dessous. Un podium ne se montre qu'a deux lignes au moins. */
function placesDuPodium(n) { return n >= 2 ? Math.min(3, n) : 0; }

function montrerTableau(visible) {
  const corps = el('rk-rows');
  const boite = corps && corps.closest('.rk-table-scroll');
  if (boite) { boite.hidden = !visible; }
}

/* ── Le classement des joueurs ──────────────────────────────────────────── */

/* Sans jeu choisi, on ne classe pas des scores : 10 700 a 19xx ne se mesure pas a
 * 8 920 a Sonic. On classe des JOUEURS, a la place que chacun tient dans le haut
 * de chaque jeu : le serveur donne des points aux dix premiers de chaque jeu
 * (bareme dans la reponse) et cumule. Le tableau change alors de colonnes. */
function vueJoueurs() { return !JEU_VERROU && JEU === '' && !(enEpreuves() && JEU_EPREUVE !== ''); }
/* Un classement d'epreuve (ou le classement Kinch d'un jeu), et non celui des joueurs. */
function enUneEpreuve() { return enEpreuves() && JEU_EPREUVE !== ''; }

/* Ce que la page montre hors du speedrun, pour le retrouver en le quittant. */
const ENTETE_SCORE = document.querySelector('#rk-head-scores .rk-score');
const TEXTE_SCORE = ENTETE_SCORE ? ENTETE_SCORE.textContent : '';
const LIBELLE_JEU = el('rk-game-wrap') ? el('rk-game-wrap').querySelector('span') : null;
const TEXTE_JEU = LIBELLE_JEU ? LIBELLE_JEU.textContent : '';

function poserEntete() {
  const scores = el('rk-head-scores');
  const joueurs = el('rk-head-players');
  if (!scores || !joueurs) { return; }
  scores.hidden = vueJoueurs();
  joueurs.hidden = !vueJoueurs();
  const epreuves = enEpreuves();
  const colonne = DEFI === MASS_RUN ? Tsi('col_rating')
    : (EPREUVE.indexOf('jeu:') === 0 ? Tsi('col_kinch') : Tsi('col_time'));
  if (ENTETE_SCORE) { ENTETE_SCORE.textContent = enUneEpreuve() ? (colonne || TEXTE_SCORE) : TEXTE_SCORE; }
  if (LIBELLE_JEU) { LIBELLE_JEU.textContent = TEXTE_JEU; }
  const portee = el('rk-scope') ? el('rk-scope').closest('label') : null;
  if (portee) { portee.hidden = epreuves; }
  if (epreuves && el('rk-value-wrap')) { el('rk-value-wrap').hidden = true; }
  const attente = el('rk-pending-toggle');
  if (attente && attente.parentNode) { attente.parentNode.hidden = epreuves; }
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
  montrerTableau(true);

  if (lignes.length === 0) {
    const tr = document.createElement('tr');
    // Sans perimetre, c'est le defi lui-meme qui n'a pas encore de score (le 1LC et le SPEEDRUN
    // tant qu'aucun jeu ne les ouvre) : on le dit, plutot que d'accuser un filtre.
    // MASS RUN n'est pas certifie : son classement vide ne parle pas de score certifie.
    const td = noeud('td', 'rk-state', (DEFI === MASS_RUN && Tsi('massrun_none'))
      || (DEFI && !(PORTEE && VALEUR) && Tsi('challenge_empty')) || T('empty'));
    td.colSpan = COLONNES;
    tr.appendChild(td);
    corps.appendChild(tr);
    return;
  }

  const podium = placesDuPodium(lignes.length);
  lignes.forEach((ligne, i) => {
    if (i < podium) { return; }
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
  montrerTableau(corps.childElementCount > 0);
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
    // La date du record, et le temps passe a cette place (demande user 2026-10-19).
    const quand = noeud('span', 'rk-place-since');
    if (dateCourte(ligne.at)) { quand.appendChild(balisDate('rk-place-date', ligne.at)); }
    const tenue = joursALaPlace(ligne);
    if (tenue) { quand.appendChild(tenue); }
    if (quand.childNodes.length > 0) { carte.appendChild(quand); }
    carte.appendChild(NelfeBoard.badge(ligne));
    const rb = boutonReplay(ligne);
    if (rb) { carte.appendChild(rb); }
    podium.appendChild(carte);
  });
}

function rendreTableau(lignes) {
  const corps = el('rk-rows');
  corps.textContent = '';
  montrerTableau(true);

  if (lignes.length === 0) {
    const tr = document.createElement('tr');
    const td = noeud('td', 'rk-state', T('empty'));
    td.colSpan = COLONNES;
    tr.appendChild(td);
    corps.appendChild(tr);
    return;
  }

  // Le podium montre les premiers du classement etabli : la liste reprend a la place suivante.
  const podium = placesDuPodium(ETABLIS.length);
  let rang = 0;
  lignes.forEach((ligne) => {
    if (!horsRang(ligne) && rang + 1 <= podium) {
      rang += 1;
      return;
    }
    const tr = document.createElement('tr');
    if (cestMoi(ligne)) { tr.className = 'is-me'; }
    // Un score en attente n'a PAS de rang : il se lit a cote du classement, jamais
    // dedans. Sans quoi il suffirait d'un emulateur inconnu pour s'afficher premier.
    // Un score PAL non plus : il a son propre classement, et se montre ici pour memoire.
    if (ligne.pending) {
      tr.className = (tr.className + ' is-pending').trim();
      tr.appendChild(noeud('td', 'rk-rank', ''));
    } else if (ligne.unranked) {
      tr.className = (tr.className + ' is-pal').trim();
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
    if (ligne.pal) {
      // Le badge ne se traduit pas : c'est le nom du standard, celui de la boite du jeu.
      const pal = noeud('span', 'rk-pal-tag', 'PAL');
      pal.setAttribute('translate', 'no');
      pal.title = Tsi('pal_tag_title');
      cellule.appendChild(pal);
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
    const cDate = noeud('td', 'rk-date');
    if (ligne.at) { cDate.appendChild(balisDate('', ligne.at)); }
    tr.appendChild(cDate);
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
  montrerTableau(corps.childElementCount > 0);
}

/* ── Le classement d'une epreuve ──────────────────────────────────────

/* Un temps en frames comme la borne l'affiche, a la cadence du reglement : m:ss.cc. */
function tempsDe(frames) {
  const centiemes = Math.round(Number(frames) * 100 / CADENCE);
  const reste = centiemes % 6000;
  return Math.floor(centiemes / 6000) + ':' + String(Math.floor(reste / 100)).padStart(2, '0') + '.'
    + String(reste % 100).padStart(2, '0');
}

/* Les deux autres mesures du temps, montrees sans classer : le chrono independant et le temps affiche par le jeu. */
function detailDuTemps(ligne) {
  if (ligne.detail) { return ligne.detail; }
  if (ligne.independent_frames === null || ligne.independent_frames === undefined
    || ligne.game_time_seconds === null || ligne.game_time_seconds === undefined) { return ''; }
  const secondes = Number(ligne.game_time_seconds);
  return Tsi('speedrun_detail', {
    independent: tempsDe(ligne.independent_frames),
    game: Math.floor(secondes / 60) + ':' + String(secondes % 60).padStart(2, '0'),
  });
}

/* Le replay d'une ligne d'epreuve, a la suite de son temps. Pas de lien vers YouTube (demande du user du 04/11). */
function poserReplay(cellule, ligne) {
  const rb = boutonReplay(ligne);
  if (rb) { cellule.appendChild(rb); }
  const sans = sansReplay(ligne);
  if (sans) { cellule.appendChild(sans); }
}

function celluleDuJeu(ligne) {
  const cJeu = noeud('td');
  const lJeu = document.createElement('a');
  lJeu.className = 'rk-game-link';
  lJeu.href = NelfeBoard.lienJeu(ligne);
  lJeu.setAttribute('translate', 'no');
  lJeu.textContent = ligne.game_name || ligne.game;
  cJeu.appendChild(lJeu);
  const epreuve = noeud('span', 'rk-trial-detail', ligne.trial);
  epreuve.setAttribute('translate', 'no');
  cJeu.appendChild(epreuve);
  return cJeu;
}

function rendrePodiumEpreuve(lignes) {
  const podium = el('rk-podium');
  podium.textContent = '';
  if (lignes.length < 2) { return; }
  lignes.slice(0, 3).forEach((ligne, i) => {
    const carte = noeud('li', 'rk-place rk-place-' + (i + 1) + (cestMoi(ligne) ? ' is-me' : ''));
    carte.appendChild(noeud('span', 'rk-medal', T(RANGS[i])));
    carte.appendChild(joueur(ligne));
    const nom = noeud('span', 'rk-place-game', (ligne.game_name || ligne.game) + ' · ' + ligne.trial);
    nom.setAttribute('translate', 'no');
    carte.appendChild(nom);
    const temps = noeud('span', 'rk-place-score', ligne.time);
    carte.appendChild(temps);
    if (dateCourte(ligne.at)) {
      const quand = noeud('span', 'rk-place-since');
      quand.appendChild(balisDate('rk-place-date', ligne.at));
      carte.appendChild(quand);
    }
    carte.appendChild(NelfeBoard.badge(ligne));
    poserReplay(carte, ligne);
    podium.appendChild(carte);
  });
}

/* `podium` : les lignes deja montrees sur le podium (MASS RUN : les provisoires n'y montent pas). */
function rendreTableauEpreuve(lignes, podium = placesDuPodium(lignes.length)) {
  const corps = el('rk-rows');
  corps.textContent = '';
  montrerTableau(true);
  if (lignes.length === 0) {
    const tr = document.createElement('tr');
    const td = noeud('td', 'rk-state', Tsi('trial_empty') || T('empty'));
    td.colSpan = COLONNES;
    tr.appendChild(td);
    corps.appendChild(tr);
    return;
  }
  lignes.forEach((ligne, i) => {
    if (i < podium) { return; }
    const tr = document.createElement('tr');
    if (cestMoi(ligne)) { tr.className = 'is-me'; }
    // Une cote MASS RUN provisoire (moins de cinq courses) se lit sans rang.
    tr.appendChild(noeud('td', 'rk-rank', ligne.provisional ? '' : i + 1));
    const cellule = noeud('td');
    cellule.appendChild(joueur(ligne));
    tr.appendChild(cellule);
    tr.appendChild(celluleDuJeu(ligne));
    tr.appendChild(noeud('td', 'rk-system', ligne.system || ''));
    tr.appendChild(provenance(ligne));
    const cDate = noeud('td', 'rk-date');
    if (ligne.at) { cDate.appendChild(balisDate('', ligne.at)); }
    tr.appendChild(cDate);
    const cTemps = noeud('td', 'rk-score', ligne.time);
    const detail = detailDuTemps(ligne);
    if (detail) { cTemps.appendChild(noeud('span', 'rk-trial-detail', detail)); }
    poserReplay(cTemps, ligne);
    tr.appendChild(cTemps);
    corps.appendChild(tr);
  });
  montrerTableau(corps.childElementCount > 0);
}

/* LE CLASSEMENT KINCH D'UN JEU : la note de chacun (100 x record / son temps, en moyenne sur toutes les epreuves du type, 0
   pour une epreuve non jouee). Sous la note de qui a tout fait, la somme de ses temps, pour information : elle ne classe rien. */
async function chargerKinch(demande) {
  const [systeme, jeu] = JEU_EPREUVE.split('/');
  const p = new URLSearchParams({ system: systeme, game: jeu, kind: EPREUVE.slice(4) });
  if (MONDE) { p.set('world', MONDE); }
  try {
    const reponse = await fetch('/api/v1/challenges/game-board?' + p);
    if (!reponse.ok) { throw new Error(String(reponse.status)); }
    const donnees = await reponse.json();
    if (demande !== DEMANDE) { return; }
    CADENCE = Number(donnees.frame_rate) || 60;
    const libelle = el('rk-rule') && el('rk-rule').selectedOptions[0] ? el('rk-rule').selectedOptions[0].textContent : '';
    const deux = (n) => Number(n).toLocaleString(LNG, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const lignes = (Array.isArray(donnees.rows) ? donnees.rows : []).map((l) => {
      const morceaux = [];
      if (l.sum_frames !== null && l.sum_frames !== undefined) {
        morceaux.push(Tsi('kinch_sum', { time: tempsDe(l.sum_frames) }));
        if (donnees.records_sum_frames) { morceaux.push(Tsi('kinch_sum_records', { time: tempsDe(donnees.records_sum_frames) })); }
        if (l.any_frames) {
          morceaux.push(Tsi('kinch_any', { time: tempsDe(l.any_frames) })
            + (donnees.any_record_frames ? ' ' + Tsi('kinch_record', { time: tempsDe(donnees.any_record_frames) }) : ''));
        }
      }
      return Object.assign({}, l, {
        time: deux(l.note),
        trial: Tsi('kinch_done', { done: nombre(l.done), total: nombre(l.total) }) || (l.done + '/' + l.total),
        detail: morceaux.filter(Boolean).join(' · '),
        kinch: libelle,
      });
    });
    rendrePodiumEpreuve(lignes);
    rendreTableauEpreuve(lignes);
    el('rk-tally').textContent = '';
  } catch (e) {
    if (demande === DEMANDE) { etat(T('failed')); }
  }
}

/* LA COTE MASS RUN D'UN JEU DANS UN FORMAT : la cote affichee (prudente), et sous elle mu, sigma et les courses. Les
   permanents d'abord, classes ; les provisoires ensuite, sans rang, jamais sur le podium. */
async function chargerMassRun(demande) {
  if (!EPREUVE) {
    etat(Tsi('massrun_none') || T('empty'));
    return;
  }
  const p = new URLSearchParams({ game: JEU_EPREUVE, format: EPREUVE, limit: '100' });
  try {
    const reponse = await fetch('/api/v1/massrun/board?' + p);
    if (!reponse.ok) { throw new Error(String(reponse.status)); }
    const donnees = await reponse.json();
    if (demande !== DEMANDE) { return; }
    const format = Tsi('massrun_format_' + EPREUVE) || EPREUVE;
    const deux = (n) => Number(n).toLocaleString(LNG, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const lignes = (Array.isArray(donnees.rows) ? donnees.rows : []).map((l) => Object.assign({}, l, {
      time: nombre(l.rating),
      trial: format,
      detail: [Tsi('massrun_detail', { mu: deux(l.mu), sigma: deux(l.sigma), races: nombre(l.races) }),
        l.provisional ? Tsi('massrun_provisional') : ''].filter(Boolean).join(' · '),
    }));
    if (lignes.length === 0) {
      etat(Tsi('massrun_empty') || T('empty'));
      return;
    }
    const permanents = lignes.filter((l) => !l.provisional);
    rendrePodiumEpreuve(permanents);
    rendreTableauEpreuve(lignes, placesDuPodium(permanents.length));
    el('rk-tally').textContent = '';
  } catch (e) {
    if (demande === DEMANDE) { etat(T('failed')); }
  }
}

async function chargerEpreuve(demande) {
  if (DEFI === MASS_RUN) {
    await chargerMassRun(demande);
    return;
  }
  if (EPREUVE.indexOf('jeu:') === 0) {
    await chargerKinch(demande);
    return;
  }
  if (!EPREUVE) {
    etat((DEFI === CHALLENGE ? Tsi('challenge_none') : '') || Tsi('speedrun_none') || T('empty'));
    return;
  }
  const p = new URLSearchParams({ ruleset: EPREUVE, limit: '50' });
  if (MONDE) { p.set('world', MONDE); }
  try {
    const reponse = await fetch('/api/v1/challenges/board?' + p);
    if (!reponse.ok) { throw new Error(String(reponse.status)); }
    const donnees = await reponse.json();
    if (demande !== DEMANDE) { return; }
    CADENCE = Number(donnees.frame_rate) || 60;
    const nom = nomDEpreuve(EPREUVES.find((epreuve) => epreuve.ruleset === EPREUVE) || donnees);
    const lignes = (Array.isArray(donnees.rows) ? donnees.rows : []).map((ligne) => Object.assign({}, ligne, { trial: nom }));
    rendrePodiumEpreuve(lignes);
    rendreTableauEpreuve(lignes);
    el('rk-tally').textContent = lignes.length === 0 ? ''
      : (lignes.length === 1 ? Tsi('tally_one_time') : Tsi('tally_times', { n: nombre(lignes.length) }));
  } catch (e) {
    if (demande === DEMANDE) { etat(T('failed')); }
  }
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
  montrerTableau(true);
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
/* LES MEILLEURS SCORES PAL (12/11, option du user) : l'API les joint au classement principal d'un jeu (`pal`). Ils
   s'intercalent a leur valeur avec un badge « PAL », sans rang, comme un score en attente : ils ne prennent la place de
   personne, ni au podium ni dans la numerotation. */
let PAL_HORS_RANG = [];

/* Une ligne qui se lit a cote du classement, jamais dedans : en attente, ou PAL. */
function horsRang(ligne) { return Boolean(ligne.pending || ligne.unranked); }

/* L'ordre des valeurs, sans jamais melanger les natures de ligne : a valeur egale, le classement passe devant. */
function fusionner() {
  let lignes = ETABLIS;
  if (MONTRER_ATTENTE && EN_ATTENTE && EN_ATTENTE.length > 0) { lignes = lignes.concat(EN_ATTENTE); }
  if (PAL_HORS_RANG.length > 0) { lignes = lignes.concat(PAL_HORS_RANG); }
  if (lignes === ETABLIS) { return ETABLIS; }
  // Le sens du classement est celui du profil : un temps se lit du plus petit au plus grand.
  const bas = ((ETABLIS[0] || PAL_HORS_RANG[0] || {}).better) === 'lower';
  return lignes.slice().sort((a, b) => (bas ? Number(a.value) - Number(b.value) : Number(b.value) - Number(a.value)));
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
  // En epreuves, le selecteur « Mode » porte les modes ou les defis du jeu (poserLesEpreuvesDuJeu).
  if (!enEpreuves()) { poserLesRegles(); }
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
  if (enUneEpreuve()) {
    await chargerEpreuve(demande);
    return;
  }
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
      PAL_HORS_RANG = Array.isArray(donnees.pal) ? donnees.pal : [];
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
  window.addEventListener('hashchange', () => { changerDefi(defiDeLAdresse() || DEFIS_AFFICHES[0]); });
}
brancher('rk-value', 'change', () => { VALEUR = el('rk-value').value; charger(); });
brancher('rk-game', 'change', () => {
  if (enEpreuves()) {
    JEU_EPREUVE = el('rk-game').value;
    poserLesEpreuvesDuJeu();
  } else {
    JEU = el('rk-game').value;
  }
  charger();
});
brancher('rk-rule', 'change', () => {
  if (enEpreuves()) { EPREUVE = el('rk-rule').value; } else { REGLE = el('rk-rule').value; }
  charger();
});
brancher('rk-search', 'input', chercher);

// On attend de savoir QUI on suit avant de peindre : sinon les cases
// s'afficheraient toutes vides puis changeraient sous les yeux du lecteur.
Promise.all([
  preparerPortees(),
  preparerFiltreJeu(),
  window.NelfeFollow ? window.NelfeFollow.charger() : Promise.resolve()
]).then(charger);
