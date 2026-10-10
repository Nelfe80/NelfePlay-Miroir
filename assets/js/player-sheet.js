/* Fiche publique d'un joueur.
 *
 * La coquille est rendue vide par le serveur et remplie ici. Les RANGS changent
 * dès que quelqu'un d'autre joue : les figer côté serveur afficherait des
 * positions périmées, et les recalculer à chaud ferait dépendre la page d'un
 * appel réseau pour s'afficher du tout.
 *
 * L'adresse porte une POIGNÉE, jamais le code joueur : ce code vaut
 * rattachement automatique des scores au check-in, et une URL qui se partage
 * n'a rien à faire d'un secret.
 */
const I18N = window.NP_I18N || {};

function T(cle, valeurs) {
  let s = I18N[cle];
  if (s === undefined) { return cle; }
  if (valeurs) {
    for (const nom in valeurs) { s = s.split('{' + nom + '}').join(valeurs[nom]); }
  }
  return s;
}

const LNG = document.documentElement.lang || 'fr';
const el = (id) => document.getElementById(id);

/* La poignée est le dernier segment de l'adresse. On la lit là plutôt que de
   la faire écrire dans la page : une seule source, celle que le lecteur voit. */
const POIGNEE = (window.location.pathname.split('/').filter(Boolean).pop() || '').toLowerCase();

function nombre(v) {
  return new Intl.NumberFormat(LNG).format(v);
}

/* ── Le mur d'activité ────────────────────────────────────────────────────
   Une année glissante, en semaines. Le serveur ne rend que les jours où
   quelque chose s'est passé : dessiner les cases vides est le travail de
   l'affichage, et une année de zéros n'avait pas à traverser le réseau. */

const JOURS = 364;   // 52 semaines pleines, pour que la grille tombe juste

function niveau(n) {
  if (n <= 0) { return 0; }
  if (n === 1) { return 1; }
  if (n <= 3) { return 2; }
  if (n <= 6) { return 3; }
  return 4;
}

function mur(activite) {
  const cible = el('ps-wall');
  cible.textContent = '';

  const parJour = new Map();
  (activite || []).forEach((a) => parJour.set(a.day, a.n));

  const fin = new Date();
  fin.setHours(0, 0, 0, 0);
  // On termine la grille un samedi : sans cela la dernière colonne serait
  // tronquée et les jours de la semaine ne s'aligneraient plus d'une colonne
  // à l'autre.
  fin.setDate(fin.getDate() + (6 - fin.getDay()));

  const grille = document.createElement('div');
  grille.className = 'ps-wall-grid';

  for (let i = JOURS; i >= 0; i--) {
    const jour = new Date(fin);
    jour.setDate(fin.getDate() - i);
    const cle = jour.toISOString().slice(0, 10);
    const n = parJour.get(cle) || 0;

    const case_ = document.createElement('span');
    case_.className = 'ps-cell lvl-' + niveau(n);
    // La colonne (la semaine) : la feuille de style en tire le délai de la vague
    // lumineuse qui traverse la grille au survol, de gauche à droite.
    case_.style.setProperty('--col', String(Math.floor((JOURS - i) / 7)));
    // Un futur proche apparaît dans la grille parce qu'on l'aligne sur un
    // samedi : il reste vide et muet plutôt que d'annoncer « 0 partie ».
    if (jour <= new Date()) {
      case_.title = T('activity_day', { n: nombre(n), date: jour.toLocaleDateString(LNG) });
    } else {
      case_.className += ' is-future';
    }
    grille.appendChild(case_);
  }

  cible.appendChild(grille);
}

/* ── Les meilleurs scores ───────────────────────────────── */

/* La PROVENANCE d'un score, qui n'est pas un detail d'affichage.
 *
 * Les trois mondes ne se melangent jamais dans un classement : en salle, la
 * mesure se fait sur une borne que le joueur ne controle pas et le lot est
 * signe par la salle ; a la maison, elle se fait sur sa machine. Un rang lu
 * sans son monde ne veut donc rien dire, et c'est pour cela qu'il est ecrit
 * en face de chaque ligne. Les libelles sont ceux des classements : la fiche
 * les emprunte au lieu de les recopier. */
const MONDES = {
  home: { cle: 'badge_home', defaut: 'maison' },
  station: { cle: 'badge_station', defaut: 'salle v\u00e9rifi\u00e9e' },
  stream: { cle: 'badge_stream', defaut: 'contest' }
};

function provenance(s) {
  const cell = document.createElement('td');
  const m = MONDES[s.world] || MONDES.home;

  const badge = document.createElement('span');
  badge.className = 'ps-world is-' + (MONDES[s.world] ? s.world : 'home');
  badge.textContent = T(m.cle) === m.cle ? m.defaut : T(m.cle);
  cell.appendChild(badge);

  // Ou, precisement : une salle porte un nom, un contest une chaine, une
  // partie a la maison n'a ni l'un ni l'autre - et c'est ce qu'elle dit.
  const ou = s.venue || s.channel || '';
  if (ou) {
    const p = document.createElement('span');
    p.className = 'ps-where';
    p.setAttribute('translate', 'no');
    p.textContent = ou + (s.city ? ' \u00b7 ' + s.city : '');
    cell.appendChild(document.createElement('br'));
    cell.appendChild(p);
  }
  return cell;
}

/* Bouton « Replay ». Il n'apparait QUE si le serveur a joint une reference,
 * ce qu'il ne fait que pour les replays PUBLICS : l'existence d'un replay
 * prive ne se revele pas, pas meme sur la fiche de celui qui l'a produit.
 *
 * Le clic est pris en charge par le funnel commun (nelfe-runtime.js, charge
 * par le gabarit de page) via data-nelfe-replay : connexion, installation,
 * puis lecture sur la borne. La fiche n'a donc rien a piloter elle-meme. */
function boutonReplay(s) {
  const r = s.replay;
  if (!r || !r.id) { return null; }
  // La lecture se fait SUR LA BORNE, donc sur un PC Windows : ailleurs, le
  // bouton menerait a une preparation qu'on ne peut pas suivre. La regle vit
  // dans app.js (charge en tete par le gabarit commun) et se lit ici, comme
  // dans nelfe-board.js ; si elle manque, on montre - meme defaut que partout.
  if (window.NelfePlateforme && !window.NelfePlateforme.windows) { return null; }
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'ps-replay';
  b.textContent = '\u25b7 Replay';
  b.setAttribute('data-nelfe-replay', r.id);
  // La regle du score : un replay lance depuis un 1LC se fige a la premiere mort.
  if (s.ruleset) { b.setAttribute('data-nelfe-ruleset', s.ruleset); }
  // Le marqueur du site, au cas ou app.js s'executerait apres ce rendu.
  b.setAttribute('data-windows-only', '');
  if (r.object_sha256) { b.setAttribute('data-nelfe-sha', r.object_sha256); }
  const titre = T('watch_replay');
  b.title = titre === 'watch_replay' ? 'Replay' : titre;
  b.setAttribute('aria-label', b.title);
  return b;
}

/* La vignette d'un record : un carre cliquable qui ouvre la capture en grand,
   avec les gestes qu'elle permet. */
function vignette(s) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'ps-shot';
  const img = document.createElement('img');
  img.src = s.shot;
  img.loading = 'lazy';
  img.alt = '';
  b.appendChild(img);

  const nom = s.game_name || s.game;
  b.title = nom;
  b.setAttribute('aria-label', nom + ' \u2013 ' + T('record_shot'));

  b.addEventListener('click', () => {
    if (!window.NelfeShotBox) { return; }

    // Ce que la boite raconte : a quel classement, combien, quel rang, quand. Plus le lien de la
    // preuve. Pas de boutons : agir se fait sur la fiche du jeu, ou tout est deja.
    const morceaux = [nomDuClassement(s), nombre(s.value), T('rank_of', { rank: nombre(s.rank), of: nombre(s.of) })];
    if (s.at) {
      const d = new Date(String(s.at).replace(' ', 'T') + 'Z');
      if (!isNaN(d.getTime())) {
        morceaux.push(d.toLocaleDateString(LNG, { year: 'numeric', month: 'long', day: 'numeric' }));
      }
    }

    window.NelfeShotBox.ouvrir({
      src: s.shot,
      alt: T('record_shot'),
      title: nom,
      subtitle: morceaux.join(' \u00b7 '),
      proof: s.system
        ? {
            url: '/records/' + encodeURIComponent(s.system)
               + '/' + encodeURIComponent(s.game)
               + '/' + encodeURIComponent(s.ruleset || '1cc') + '/',
            label: T('certificate')
          }
        : null
    }, b);
  });

  return b;
}

/* ── Un jeu, un bloc ──────────────────────────────────────────────────────
   Les scores d'un meme jeu se lisent ensemble (demande user 2026-10-09) : un bloc par jeu, et dedans
   une ligne par classement, celui du 1CC, de chaque mode, du 1CC MULTI, dans chaque monde. Bubble
   Bobble et ses trois modes caches faisaient quatre lignes « Bubble Bobble » que rien ne
   distinguait. */

/* La famille d'une regle, comme le serveur la lit (ScoringRepository::familleDeRegle) : un mode
   garde celle de sa regle, 1cc-multi-super est un 1CC MULTI. */
const FAMILLES = ['1cc', '1lc', '1cc-multi', 'speedrun'];
function familleDeRegle(regle) {
  const r = String(regle || '');
  return ['speedrun', '1lc', '1cc-multi'].find((f) => r === f || r.indexOf(f + '-') === 0) || '1cc';
}

const ORDRE_DES_MONDES = { home: 0, station: 1, stream: 2 };

/* L'ordre des lignes d'un jeu : sa regle (1CC, 1LC, 1CC MULTI, SPEEDRUN), le mode de demarrage avant
   les autres, puis le monde. Un ordre fixe : le 1CC se trouve toujours en tete de son bloc. */
function ordreDesLignes(a, b) {
  const special = (s) => (s.mode && !s.mode['default'] ? 1 : 0);
  const monde = (s) => (ORDRE_DES_MONDES[s.world] === undefined ? 9 : ORDRE_DES_MONDES[s.world]);
  return (FAMILLES.indexOf(familleDeRegle(a.ruleset)) - FAMILLES.indexOf(familleDeRegle(b.ruleset)))
    || (special(a) - special(b))
    || String(a.ruleset || '').localeCompare(String(b.ruleset || ''))
    || (monde(a) - monde(b));
}

/* Les blocs, dans l'ordre ou la liste nomme chaque jeu pour la premiere fois : elle arrive triee du
   meilleur rang au moins bon, un jeu garde donc la place de son meilleur classement. */
function parJeu(liste) {
  const blocs = new Map();
  liste.forEach((s) => {
    const cle = (s.system || '') + '/' + s.game;
    if (!blocs.has(cle)) { blocs.set(cle, []); }
    blocs.get(cle).push(s);
  });
  return Array.from(blocs.values()).map((lignes) => lignes.sort(ordreDesLignes));
}

/* Le nom d'un classement : le libelle de son mode quand le jeu en a (« 1CC POWER-UP »), sinon sa
   regle telle qu'on l'ecrit partout (1cc-multi : « 1CC MULTI »). Il ne se traduit pas. */
function nomDuClassement(s) {
  const mode = s.mode && window.NelfeBoard ? NelfeBoard.libelle(s.mode.label) : '';
  return mode || String(s.ruleset || '1cc').toUpperCase().replace(/-/g, ' ');
}

/* L'adresse de la fiche du jeu SUR SA MACHINE (un jeu = systeme + contenu). Avec `classement`, elle
   s'ouvre sur celui de ce score quand ce n'est pas celui que la fiche montre d'elle-meme. La fiche
   lit ?mode= pour un jeu a modes et ?regle= pour les autres : les deux sont ecrits, elle prend
   celui qui la concerne. */
function lienDuJeu(s, classement) {
  const base = '/' + LNG + '/rankings/' + (s.system ? encodeURIComponent(s.system) + '/' : '') + encodeURIComponent(s.game);
  const parDefaut = s.mode ? !!s.mode['default'] : (s.ruleset || '1cc') === '1cc';
  if (!classement || parDefaut) { return base; }
  const regle = encodeURIComponent(s.ruleset);
  return base + '?mode=' + regle + '&regle=' + regle;
}

/* Les empreintes de ROM communes aux lignes d'un jeu, ou null quand deux lignes en declarent de
   differentes (deux versions du jeu) : chaque ligne montre alors les siennes. Une ligne peut en
   declarer moins qu'une autre (les anciennes parties n'ont pas de SHA-256) sans faire une autre ROM. */
function empreintesCommunes(lignes) {
  const communes = {};
  for (const s of lignes) {
    const rom = s.rom || {};
    for (const algo of Object.keys(rom)) {
      if (communes[algo] !== undefined && communes[algo] !== rom[algo]) { return null; }
      communes[algo] = rom[algo];
    }
  }
  return communes;
}

/* La cellule du jeu, une par bloc : son nom, les empreintes de sa ROM, sa machine. */
function celluleDuJeu(lignes) {
  const s = lignes[0];
  const cellule = document.createElement('td');
  cellule.className = 'ps-jeu';
  cellule.rowSpan = lignes.length;

  const lien = document.createElement('a');
  lien.href = lienDuJeu(s, false);
  // Le nom d'un jeu ne se traduit pas : c'est une donnee, pas une phrase.
  lien.setAttribute('translate', 'no');
  lien.textContent = s.game_name || s.game;
  cellule.appendChild(lien);

  // Les empreintes de la ROM de ces records, comme au classement (nelfe-board.js).
  const communes = empreintesCommunes(lignes);
  const roms = communes && window.NelfeBoard ? NelfeBoard.cartouches({ rom: communes }) : null;
  if (roms) { cellule.appendChild(roms); }

  if (s.system) {
    const sys = document.createElement('span');
    sys.className = 'ps-system';
    sys.setAttribute('translate', 'no');
    sys.textContent = s.system;
    cellule.appendChild(sys);
  }
  return cellule;
}

/* La cellule du classement d'une ligne : la capture du record quand elle existe, puis son nom, qui
   mene a ce classement sur la fiche du jeu.

   La capture n'est jointe que pour un titre detenu : le miroir garde une image par classement, celle
   du tenant du titre. Toutes les vignettes ont la MEME taille, quelle que soit la definition du jeu :
   un vertical d'arcade fait 224x384, une Megadrive 320x224, et des vignettes a leur proportion
   donneraient une colonne en escalier. L'image est donc posee dans un carre, entiere, sans etre
   rognee : un cadrage couperait justement le score.

   `place` : la fiche porte au moins une capture. Une ligne sans capture garde alors sa place vide,
   pour que les noms des classements s'alignent d'une ligne a l'autre. */
function celluleDuClassement(s, place, avecEmpreintes) {
  const cellule = document.createElement('td');
  cellule.className = 'ps-classement';
  const bloc = document.createElement('div');
  bloc.className = 'ps-ligne';

  if (s.shot) {
    bloc.appendChild(vignette(s));
  } else if (place) {
    const vide = document.createElement('span');
    vide.className = 'ps-shot-vide';
    vide.setAttribute('aria-hidden', 'true');
    bloc.appendChild(vide);
  }

  const textes = document.createElement('div');
  const lien = document.createElement('a');
  lien.className = 'ps-mode';
  lien.href = lienDuJeu(s, true);
  // Le nom d'une regle ou d'un mode ne se traduit pas : c'est celui que la borne affiche.
  lien.setAttribute('translate', 'no');
  lien.textContent = nomDuClassement(s);
  textes.appendChild(lien);
  // Deux versions du jeu dans le meme bloc : chaque ligne montre les empreintes de la sienne.
  const roms = avecEmpreintes && window.NelfeBoard ? NelfeBoard.cartouches(s) : null;
  if (roms) { textes.appendChild(roms); }
  bloc.appendChild(textes);

  cellule.appendChild(bloc);
  return cellule;
}

function scores(liste) {
  const table = el('ps-scores');
  table.querySelectorAll('tbody').forEach((corps) => corps.remove());

  if (!liste || liste.length === 0) {
    el('ps-empty').hidden = false;
    return;
  }
  el('ps-empty').hidden = true;
  table.hidden = false;

  const place = liste.some((s) => s.shot);

  parJeu(liste).forEach((lignes) => {
    // Un corps de tableau par jeu : le bloc se lit et se style d'un seul tenant.
    const corps = document.createElement('tbody');
    corps.className = 'ps-bloc';
    const avecEmpreintes = empreintesCommunes(lignes) === null;

    lignes.forEach((s, i) => {
      const tr = document.createElement('tr');
      if (i === 0) { tr.appendChild(celluleDuJeu(lignes)); }
      tr.appendChild(celluleDuClassement(s, place, avecEmpreintes));

      tr.appendChild(provenance(s));

      const valeur = document.createElement('td');
      valeur.className = 'ps-value';
      valeur.textContent = nombre(s.value);
      tr.appendChild(valeur);

      const rang = document.createElement('td');
      rang.className = 'ps-rank';
      // Une premiere place se voit : c'est ce qu'on cherche des yeux sur une
      // fiche, et un « 1 » perdu dans une colonne ne se distingue pas d'un « 11 ».
      if (s.rank === 1) {
        const couronne = document.createElement('span');
        couronne.className = 'ps-crown';
        couronne.textContent = '👑';
        rang.appendChild(couronne);
      }
      // « 1 sur 1 » est exact et ne dit rien : etre premier d'un seul n'est pas un
      // classement. On le nomme pour ce que c'est, seul joueur classe sur ce jeu dans
      // ce monde, ce qui reste vrai et cesse de ressembler a un bug.
      rang.appendChild(document.createTextNode(
        s.of <= 1
          ? T('rank_alone')
          : T('rank_of', { rank: nombre(s.rank), of: nombre(s.of) })
      ));
      tr.appendChild(rang);

      const actions = document.createElement('td');
      actions.className = 'ps-actions';
      const rb = boutonReplay(s);
      if (rb) { actions.appendChild(rb); }
      // Le compteur se lit partout, meme la ou le bouton se retire.
      const lectures = s.replay && window.NelfeLectures ? window.NelfeLectures.module(s.replay.plays) : null;
      if (lectures) { actions.appendChild(lectures); }
      tr.appendChild(actions);

      corps.appendChild(tr);
    });

    table.appendChild(corps);
  });
}

/* ── Mise en route ────────────────────────────────────────────────────── */

async function charger() {
  let d;
  try {
    const reponse = await fetch('/' + LNG + '/players/' + encodeURIComponent(POIGNEE) + '/data');
    if (!reponse.ok) { throw new Error(String(reponse.status)); }
    d = await reponse.json();
  } catch (e) {
    // Une poignée qui ne désigne personne n'est pas une panne : on le dit
    // plutôt que de laisser une fiche vide se faire passer pour un joueur sans
    // score.
    el('ps-name').textContent = T('not_found');
    el('ps-eyebrow').textContent = '';
    return;
  }

  el('ps-name').textContent = d.player || T('anonymous');
  el('ps-country').textContent = d.country || '';

  // La chaine publique, quand le joueur en a declare une. C'est un nom, pas une cle :
  // la cle de stream est un secret d'appareil et ne sort jamais.
  if (d.twitch) {
    const a = document.createElement('a');
    a.className = 'ps-twitch';
    a.href = 'https://twitch.tv/' + encodeURIComponent(d.twitch);
    a.target = '_blank';
    a.rel = 'noopener';
    a.setAttribute('translate', 'no');
    a.textContent = 'twitch.tv/' + d.twitch;
    el('ps-country').insertAdjacentElement('afterend', a);
  }

  // L'avatar du MOMENT (le sien, ou le champion qu'il porte), dessine par le moteur du site.
  // Sans moteur, l'ancienne image : un portrait d'hier vaut mieux qu'un cadre vide.
  if (d.avatar_identity && window.NelfeAvatar) {
    const img = el('ps-avatar');
    img.hidden = false;
    window.NelfeAvatar.poser(img, d.avatar_identity);
  } else if (d.avatar) {
    const img = el('ps-avatar');
    img.src = '/avatar/' + encodeURIComponent(d.avatar) + '.svg?c=4';
    img.hidden = false;
  }

  // Ce qu'il joue MAINTENANT, s'il l'a partage. Absent le reste du temps : une fiche ne
  // dit pas ce qu'on n'a pas voulu dire.
  if (d.live && d.live.game) {
    const zone = el('ps-live');
    zone.textContent = '';

    const pastille = document.createElement('span');
    pastille.className = 'ps-live-dot';
    pastille.setAttribute('aria-hidden', 'true');
    zone.appendChild(pastille);
    zone.appendChild(document.createTextNode(T('live_playing') + ' '));

    const jeu = document.createElement('a');
    jeu.href = '/' + LNG + '/rankings/' + (d.live.system ? encodeURIComponent(d.live.system) + '/' : '') + encodeURIComponent(d.live.game);
    jeu.setAttribute('translate', 'no');
    jeu.textContent = d.live.game_name || d.live.game;
    zone.appendChild(jeu);

    // Rejoindre la partie sur sa propre borne. Le marqueur porte un nom distinct de
    // `data-nelfe-join`, deja utilise par le groupe d'autorisations de la fiche de jeu.
    if (d.live.netplay) {
      const rejoindre = document.createElement('button');
      rejoindre.type = 'button';
      rejoindre.className = 'button button-small button-ghost ps-live-join';
      rejoindre.setAttribute('data-nelfe-joinsession', d.live.session);
      rejoindre.textContent = T('live_join');
      zone.appendChild(rejoindre);
    }

    // Le lien de la chaine, quand elle est declaree : pour REGARDER sans borne.
    if (d.live.twitch) {
      const lien = document.createElement('a');
      lien.className = 'button button-small button-ghost ps-live-join';
      lien.href = 'https://twitch.tv/' + encodeURIComponent(d.live.twitch);
      lien.target = '_blank';
      lien.rel = 'noopener';
      lien.textContent = T('live_watch');
      zone.appendChild(lien);
    }
    zone.hidden = false;
  }

  el('ps-games').textContent = nombre((d.totals && d.totals.games) || 0);
  el('ps-crowns').textContent = nombre((d.totals && d.totals.crowns) || 0);
  el('ps-totals').hidden = false;

  scores(d.scores);
  mur(d.activity);

  // La case de suivi, posée par le composant commun : la fiche n'a pas sa
  // propre notion de « suivre », sinon deux comportements finiraient par
  // diverger.
  if (window.NelfeFollow) {
    const bouton = window.NelfeFollow.bouton(d.handle, true);
    if (bouton) { el('ps-follow-slot').appendChild(bouton); }
  }
}

if (window.NelfeFollow) {
  window.NelfeFollow.charger().then(charger);
} else {
  charger();
}
