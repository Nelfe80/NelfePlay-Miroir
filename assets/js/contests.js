/* Les contests : la liste, et la page d'un contest.
 *
 * Un seul fichier pour les deux, parce que c'est la meme matiere : la page
 * d'un contest est une ligne de la liste, depliee, avec son classement. Les
 * separer donnerait deux endroits ou tenir la meme mise en forme d'etats, de
 * dates et d'organisateurs.
 *
 * La liste vient de LiveContest, relayee sous ce domaine. Le classement vient
 * de la chaine certifiee de NelfePlay, filtree sur le contest. Deux origines
 * de donnees, une seule origine reseau : la politique de securite du site
 * n'autorise que son propre domaine.
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

function el(id) { return document.getElementById(id); }
function nombre(v) { return Number(v).toLocaleString(LNG); }

function noeud(balise, classe, texte) {
  const n = document.createElement(balise);
  if (classe) { n.className = classe; }
  if (texte !== undefined && texte !== null) { n.textContent = String(texte); }
  return n;
}

const ETATS = { live: 'badge_live', open: 'badge_open', done: 'badge_done' };
const ORIGINES = { stream: '📺', venue: '🕹️' };

/* Un titre lisible depuis la cle du jeu. Provisoire, et assume : la donnee ne
 * porte pas encore de nom d'affichage. Meme regle que cote serveur, pour que
 * les deux pages ecrivent pareil. */
const PETITS = ['the', 'of', 'and', 'a', 'an', 'in', 'on', 'to', 'de', 'du', 'la', 'le'];
function titreJeu(cle) {
  return String(cle || '').split(/[-_]+/).filter(Boolean).map((mot, rang) => {
    if (/^(?:i{1,3}|iv|vi{0,3}|ix|xi{0,3})$/i.test(mot)) { return mot.toUpperCase(); }
    if (rang > 0 && PETITS.includes(mot.toLowerCase())) { return mot.toLowerCase(); }
    return mot[0].toUpperCase() + mot.slice(1);
  }).join(' ');
}

/* Une date se lit dans la langue du lecteur, et sans l'heure : sur une liste,
 * le jour suffit et la colonne reste etroite. */
function jour(iso) {
  if (!iso) { return ''; }
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(LNG);
}

function etat(ligne) {
  return noeud('span', 'ct-state ct-state-' + ligne.status,
    T(ETATS[ligne.status] || 'badge_done'));
}

/* L'organisateur mene chez lui : la chaine sur Twitch, la salle sur sa fiche.
 * Une salle sans identifiant garde son nom sans lien, plutot qu'un lien qui
 * tomberait dans le vide. */
function organisateur(ligne) {
  const cellule = noeud('td');
  if (ligne.hostType === 'twitch' && ligne.hostValue) {
    const a = noeud('a', 'ct-host', ligne.hostLabel || ligne.hostValue);
    a.href = 'https://twitch.tv/' + encodeURIComponent(ligne.hostValue);
    a.target = '_blank';
    a.rel = 'noopener';
    a.title = T('on_twitch');
    cellule.appendChild(noeud('span', 'ct-origin', ORIGINES.stream + ' '));
    cellule.appendChild(a);
  } else if (ligne.hostValue) {
    const a = noeud('a', 'ct-host', ligne.hostLabel || ligne.hostValue);
    a.href = '/' + LNG + '/venues/' + encodeURIComponent(ligne.hostValue);
    a.setAttribute('translate', 'no');
    cellule.appendChild(noeud('span', 'ct-origin', ORIGINES.venue + ' '));
    cellule.appendChild(a);
  } else {
    cellule.appendChild(noeud('span', 'ct-origin', ORIGINES.venue + ' '));
    cellule.appendChild(noeud('span', null, ligne.hostLabel || ''));
  }
  return cellule;
}

function messageTableau(corps, colonnes, message) {
  corps.textContent = '';
  const tr = document.createElement('tr');
  const td = noeud('td', 'rk-state', message);
  td.colSpan = colonnes;
  tr.appendChild(td);
  corps.appendChild(tr);
}

/* ── La liste ───────────────────────────────────────────────────────────── */

async function chargerListe() {
  const corps = el('ct-rows');
  const p = new URLSearchParams();
  const état = el('ct-state').value;
  const origine = el('ct-origin').value;
  if (état) { p.set('status', état); }
  // Un organisateur demande dans l'adresse : c'est le lien « ses tournois »
  // d'une fiche de salle. Le point d'entree rend alors SON archive entiere,
  // au lieu du seul dernier contest par organisateur.
  const hote = new URLSearchParams(location.search).get('host');
  if (hote) { p.set('host', hote); }
  p.set('limit', '200');

  messageTableau(corps, 5, T('loading'));
  let contests = [];
  try {
    const r = await fetch('/contests/data?' + p);
    if (!r.ok) { throw new Error(String(r.status)); }
    contests = (await r.json()).contests || [];
  } catch (e) {
    messageTableau(corps, 5, T('failed'));
    el('ct-tally').textContent = '';
    return;
  }

  // L'origine se filtre ici : le point d'entree ne la connait pas comme
  // critere, et la liste tient largement en memoire.
  if (origine) { contests = contests.filter((c) => c.kind === origine); }

  if (contests.length === 0) {
    messageTableau(corps, 5, T('empty'));
    el('ct-tally').textContent = '';
    return;
  }

  corps.textContent = '';
  contests.forEach((ligne) => {
    const tr = document.createElement('tr');

    const titre = noeud('td');
    const a = noeud('a', 'ct-name', ligne.title || ligne.id);
    a.href = '/' + LNG + '/contests/' + encodeURIComponent(ligne.id);
    titre.appendChild(a);
    titre.appendChild(etat(ligne));
    tr.appendChild(titre);

    tr.appendChild(noeud('td', null, titreJeu(ligne.game)));
    tr.appendChild(organisateur(ligne));
    tr.appendChild(noeud('td', 'rk-system', jour(ligne.startedAt || ligne.endedAt)));
    tr.appendChild(noeud('td', 'rk-score', nombre(ligne.players || 0)));
    corps.appendChild(tr);
  });

  el('ct-tally').textContent = T(contests.length === 1 ? 'tally_one' : 'tally',
    { count: nombre(contests.length) });
}

/* ── Un contest ─────────────────────────────────────────────────────────── */

async function chargerContest(id) {
  const corps = el('ct-rows');

  // L'entete vient de la liste : c'est elle qui sait le titre, l'etat et
  // l'organisateur. Une seule source, et rien a recopier cote serveur.
  let fiche = null;
  try {
    const r = await fetch('/contests/data?limit=500');
    if (r.ok) {
      fiche = ((await r.json()).contests || []).find((c) => c.id === id) || null;
    }
  } catch (e) {
    fiche = null;
  }

  if (!fiche) {
    el('ct-title').textContent = T('not_found');
    messageTableau(corps, 5, T('empty'));
    return;
  }

  el('ct-title').textContent = fiche.title || fiche.id;
  const sous = el('ct-sub');
  sous.textContent = '';
  sous.appendChild(etat(fiche));
  if (fiche.game) { sous.appendChild(noeud('span', 'ct-meta', titreJeu(fiche.game))); }
  const quand = jour(fiche.startedAt || fiche.endedAt);
  if (quand) { sous.appendChild(noeud('span', 'ct-meta', quand)); }
  if (fiche.hostType === 'twitch' && fiche.hostValue) {
    const a = noeud('a', 'ct-meta ct-host', ORIGINES.stream + ' ' + (fiche.hostLabel || fiche.hostValue));
    a.href = 'https://twitch.tv/' + encodeURIComponent(fiche.hostValue);
    a.target = '_blank';
    a.rel = 'noopener';
    sous.appendChild(a);
  } else if (fiche.hostValue) {
    const a = noeud('a', 'ct-meta ct-host', ORIGINES.venue + ' ' + (fiche.hostLabel || fiche.hostValue));
    a.href = '/' + LNG + '/venues/' + encodeURIComponent(fiche.hostValue);
    a.setAttribute('translate', 'no');
    sous.appendChild(a);
  } else if (fiche.hostLabel) {
    sous.appendChild(noeud('span', 'ct-meta', ORIGINES.venue + ' ' + fiche.hostLabel));
  }

  messageTableau(corps, 5, T('loading'));

  // Le classement CERTIFIE d'abord, quand ce contest en a un.
  let lignes = [];
  if (fiche.contestId) {
    try {
      const r = await fetch('/api/v1/scores/board?limit=100&contest=' + encodeURIComponent(fiche.contestId));
      if (r.ok) { lignes = (await r.json()).rows || []; }
    } catch (e) {
      lignes = [];
    }
  }

  // Sinon celui que tient la plateforme. Ce ne sont pas les memes garanties,
  // et c'est le titre qui le dit.
  if (lignes.length === 0) {
    const propre = await classementDuContest(fiche);
    const titre = el('ct-board-title');
    titre.textContent = T(propre.length ? 'board_contest' : 'board_title');
    titre.hidden = false;
    if (propre.length === 0) {
      messageTableau(corps, 5, T('board_empty'));
      return;
    }
    rendreStandings(corps, propre, titreJeu(fiche.game));
    return;
  }

  el('ct-board-title').hidden = false;
  try {
    corps.textContent = '';
    lignes.forEach((ligne, i) => {
      const tr = document.createElement('tr');
      tr.appendChild(noeud('td', 'rk-rank', i + 1));

      // Les memes briques que le classement general (nelfe-board.js).
      const joueur = noeud('td');
      joueur.appendChild(NelfeBoard.joueur(ligne));
      tr.appendChild(joueur);

      const cJeu = noeud('td');
      cJeu.appendChild(NelfeBoard.jeu(ligne));
      const roms = NelfeBoard.cartouches(ligne);
      if (roms) { cJeu.appendChild(roms); }
      tr.appendChild(cJeu);
      tr.appendChild(NelfeBoard.provenance(ligne, false));
      tr.appendChild(NelfeBoard.score(ligne));
      corps.appendChild(tr);
    });
  } catch (e) {
    messageTableau(corps, 5, T('failed'));
  }
}

/* Le classement que la plateforme tient pour ce contest : ses participants et
 * leurs marques, tels qu'elle les a vus. */
async function classementDuContest(fiche) {
  try {
    const r = await fetch('/contests/' + encodeURIComponent(fiche.id) + '/standings');
    if (!r.ok) { return []; }
    const d = await r.json();
    return Array.isArray(d.standings) ? d.standings : [];
  } catch (e) {
    return [];
  }
}

function rendreStandings(corps, standings, jeu) {
  corps.textContent = '';
  standings.forEach((ligne, i) => {
    const tr = document.createElement('tr');
    tr.appendChild(noeud('td', 'rk-rank', ligne.rank || i + 1));
    const joueur = noeud('td');
    joueur.appendChild(noeud('b', null, ligne.name || ligne.login || T('anonymous')));
    tr.appendChild(joueur);
    tr.appendChild(noeud('td', null, jeu));
    tr.appendChild(noeud('td', null, ''));
    tr.appendChild(noeud('td', 'rk-score', nombre(ligne.value)));
    corps.appendChild(tr);
  });
}

/* ── Mise en route ──────────────────────────────────────────────────────── */

const config = el('ct-config');
if (config) {
  chargerContest(config.dataset.contest || '');
} else {
  el('ct-state').addEventListener('change', chargerListe);
  el('ct-origin').addEventListener('change', chargerListe);
  chargerListe();
}

