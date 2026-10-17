/* Les salles : l'annuaire, et la fiche d'une salle.
 *
 * Un seul fichier pour les deux, meme raison que pour les contests : la fiche
 * est une ligne de l'annuaire, depliee. Les separer donnerait deux endroits ou
 * tenir la meme mise en forme d'un lieu.
 *
 * DEUX ORIGINES, UN SEUL DOMAINE. La fiche vient de LiveContest, relayee sous
 * ce domaine ; les records viennent de la chaine certifiee de NelfePlay. La
 * politique de securite du site n'autorise que son propre domaine, et c'est
 * tant mieux : le lecteur n'appelle qu'un seul serveur.
 *
 * CE QUI N'EST PAS TRADUIT. Le nom d'une salle, le nom d'un jeu, un pseudo :
 * ce sont des donnees, pas de l'interface. Ils portent translate="no" pour que
 * le traducteur automatique du navigateur les laisse tranquilles.
 */
const LNG = document.documentElement.lang || 'fr';
const I18N = window.NP_I18N || {};

/* Au-dela de dix salles, l'annuaire merite un champ de recherche ; en dessous,
 * la liste entiere tient sous les yeux et un filtre serait du mobilier. Meme
 * seuil que la liste des jeux du classement. */
const SEUIL_RECHERCHE = 10;

function T(cle, valeurs) {
  let s = I18N[cle];
  if (s === undefined) { return cle; }
  if (valeurs) {
    for (const nom in valeurs) { s = s.split('{' + nom + '}').join(valeurs[nom]); }
  }
  return s;
}

function el(id) { return document.getElementById(id); }
function nombre(v) { return Number(v).toLocaleString(LNG); }

function noeud(balise, classe, texte) {
  const n = document.createElement(balise);
  if (classe) { n.className = classe; }
  if (texte !== undefined && texte !== null) { n.textContent = String(texte); }
  return n;
}

/* Une donnee, pas de l'interface : le traducteur du navigateur n'y touche pas. */
function donnee(balise, classe, texte) {
  const n = noeud(balise, classe, texte);
  n.setAttribute('translate', 'no');
  return n;
}

function messageTableau(corps, colonnes, message) {
  corps.textContent = '';
  const tr = document.createElement('tr');
  const td = noeud('td', 'rk-state', message);
  td.colSpan = colonnes;
  tr.appendChild(td);
  corps.appendChild(tr);
}

/* Ou se trouve la salle, en une ligne : ville et pays quand ils sont la. */
function ou(salle) {
  return [salle.city, salle.country].filter(Boolean).join(', ');
}

/* ── L'annuaire ─────────────────────────────────────────────────────────── */

let SALLES = [];

function rendreAnnuaire() {
  const corps = el('vn-rows');
  const mot = (el('vn-search').value || '').trim().toLowerCase();
  const pays = el('vn-country').value;

  let lignes = SALLES;
  if (pays) { lignes = lignes.filter((s) => (s.country || '') === pays); }
  if (mot) {
    lignes = lignes.filter((s) =>
      (s.name || '').toLowerCase().includes(mot) || (s.city || '').toLowerCase().includes(mot));
  }

  if (lignes.length === 0) {
    messageTableau(corps, 4, T('empty'));
    el('vn-tally').textContent = '';
    return;
  }

  corps.textContent = '';
  lignes.forEach((salle) => {
    const tr = document.createElement('tr');

    const nom = noeud('td');
    const a = donnee('a', 'ct-name', salle.name);
    a.href = '/' + LNG + '/venues/' + encodeURIComponent(salle.siteId);
    nom.appendChild(a);
    tr.appendChild(nom);

    tr.appendChild(donnee('td', null, ou(salle)));
    tr.appendChild(donnee('td', 'vn-hours', salle.hours || ''));
    tr.appendChild(noeud('td', 'rk-score', nombre(salle.contests || 0)));
    corps.appendChild(tr);
  });

  el('vn-tally').textContent = T(lignes.length === 1 ? 'tally_one' : 'tally',
    { count: nombre(lignes.length) });
}

async function chargerAnnuaire() {
  const corps = el('vn-rows');
  messageTableau(corps, 4, T('loading'));

  try {
    const r = await fetch('/venues/data?limit=300');
    if (!r.ok) { throw new Error(String(r.status)); }
    SALLES = (await r.json()).venues || [];
  } catch (e) {
    messageTableau(corps, 4, T('failed'));
    el('vn-tally').textContent = '';
    return;
  }

  // Le champ de recherche et le selecteur de pays n'apparaissent que quand ils
  // servent : un annuaire de trois salles dans un seul pays n'a rien a filtrer.
  const recherche = el('vn-search').closest('label');
  recherche.hidden = SALLES.length <= SEUIL_RECHERCHE;

  const pays = [...new Set(SALLES.map((s) => s.country).filter(Boolean))].sort();
  const selecteur = el('vn-country');
  pays.forEach((code) => {
    const o = document.createElement('option');
    o.value = code;
    o.textContent = code;
    o.setAttribute('translate', 'no');
    selecteur.appendChild(o);
  });
  el('vn-country-wrap').hidden = pays.length < 2;

  rendreAnnuaire();
}

/* ── Une salle ──────────────────────────────────────────────────────────── */

/* Un lien de la fiche. Seul https est retenu, cote hub comme a l'ingestion :
 * on ne le reverifie pas ici, on ne fabrique simplement pas de lien pour ce
 * qui n'est pas dans la liste connue. */
const LIENS = [
  ['website', 'link_website'],
  ['instagram', 'link_instagram'],
  ['twitch', 'link_twitch'],
  ['facebook', 'link_facebook'],
];

function lien(url, libelle, classe) {
  const a = noeud('a', 'vn-link' + (classe ? ' ' + classe : ''), libelle);
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener';
  return a;
}

function rendreFiche(salle) {
  el('vn-title').textContent = salle.name;

  const place = el('vn-where');
  place.textContent = '';
  place.setAttribute('translate', 'no');
  const adresse = salle.address || ou(salle);
  if (adresse) { place.appendChild(donnee('span', null, adresse)); }

  if (salle.description) {
    const d = el('vn-desc');
    d.textContent = salle.description;
    d.setAttribute('translate', 'no');
    d.hidden = false;
  }

  const faits = el('vn-facts');
  faits.textContent = '';

  if (salle.hours) {
    const bloc = noeud('span', 'vn-fact');
    bloc.appendChild(noeud('b', null, T('hours_label') + ' '));
    bloc.appendChild(donnee('span', null, salle.hours));
    faits.appendChild(bloc);
  }

  // L'itineraire part de l'adresse ecrite par la salle, pas d'une position
  // qu'on aurait devinee.
  if (salle.address) {
    faits.appendChild(lien(
      'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(salle.address),
      '📍 ' + T('route')));
  }

  const liens = salle.links || {};
  LIENS.forEach(([cle, libelle]) => {
    if (liens[cle]) { faits.appendChild(lien(liens[cle], T(libelle))); }
  });

  // Ses tournois : le filtre existe deja sur la page des contests.
  if (salle.contests > 0) {
    const a = noeud('a', 'vn-link', T('contests_link'));
    a.href = '/' + LNG + '/contests?host=' + encodeURIComponent(salle.siteId);
    faits.appendChild(a);
  }

  if (!salle.hours && !salle.description && Object.keys(liens).length === 0) {
    faits.appendChild(noeud('span', 'vn-fact vn-muted', T('no_profile')));
  }
}

/* Le rang mondial d'un record, dit en clair. Premier se dit autrement : c'est
 * la seule place qui se retient. */
function rang(ligne) {
  const n = noeud('span', 'vn-rank' + (ligne.world_rank === 1 ? ' vn-rank-first' : ''));
  n.textContent = ligne.world_rank === 1
    ? T('rank_first')
    : T('rank_of', { rank: nombre(ligne.world_rank), total: nombre(ligne.world_total) });
  return n;
}

async function chargerRecords(salle) {
  const corps = el('vn-rows');
  messageTableau(corps, 5, T('loading'));

  let lignes = [];
  try {
    const r = await fetch('/api/v1/scores/board-venue?limit=8&venue=' + encodeURIComponent(salle.name));
    if (r.ok) { lignes = (await r.json()).rows || []; }
  } catch (e) {
    lignes = [];
  }

  el('vn-records-title').hidden = false;
  if (lignes.length === 0) {
    messageTableau(corps, 5, T('records_empty'));
    return;
  }

  el('vn-records-lead').hidden = false;
  // Les memes briques que le classement general (nelfe-board.js) : joueur cliquable avec sa
  // case de suivi, jeu qui mene a son classement, sceau et replay sur le score. Seule la
  // premiere colonne est propre au lieu : son rang dans le monde plutot qu'un numero.
  const moi = (document.querySelector('.rk-table')?.dataset.me || '');
  corps.textContent = '';
  lignes.forEach((ligne) => {
    const tr = document.createElement('tr');
    if (NelfeBoard.cestMoi(ligne, moi)) { tr.className = 'is-me'; }

    const place = noeud('td', 'rk-rank');
    place.appendChild(rang(ligne));
    tr.appendChild(place);

    const joueur = noeud('td');
    joueur.appendChild(NelfeBoard.joueur(ligne));
    tr.appendChild(joueur);

    const cJeu = noeud('td');
    cJeu.appendChild(NelfeBoard.jeu(ligne));
    const roms = NelfeBoard.cartouches(ligne);
    if (roms) { cJeu.appendChild(roms); }
    tr.appendChild(cJeu);
    tr.appendChild(noeud('td', 'rk-system', ligne.system || ''));

    tr.appendChild(NelfeBoard.score(ligne));
    corps.appendChild(tr);
  });
}

async function chargerSalle(id) {
  let salle = null;
  try {
    const r = await fetch('/venues/' + encodeURIComponent(id) + '/data');
    if (r.ok) { salle = await r.json(); }
  } catch (e) {
    salle = null;
  }

  if (!salle || !salle.name) {
    el('vn-title').textContent = T('not_found');
    messageTableau(el('vn-rows'), 5, T('records_empty'));
    return;
  }

  document.title = salle.name + ' - ' + document.title;
  rendreFiche(salle);
  await chargerRecords(salle);
}

/* ── Mise en route ──────────────────────────────────────────────────────── */

const config = el('vn-config');
if (config) {
  chargerSalle(config.dataset.venue || '');
} else {
  el('vn-search').addEventListener('input', rendreAnnuaire);
  el('vn-country').addEventListener('change', rendreAnnuaire);
  chargerAnnuaire();
}

