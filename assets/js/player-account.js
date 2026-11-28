
const B = document.querySelector('base')?.href.replace(/\/$/, '') || location.pathname.replace(/\/account.*/, '');
/* Echappement HTML, guillemets COMPRIS.
 *
 * Sans eux, esc() ne protegeait que le texte : `title="${esc(x)}"` laissait
 * une valeur contenant un guillemet SORTIR de l'attribut et en ouvrir
 * d'autres. La politique de la page bloque le script en ligne, donc pas
 * d'execution - mais elle tolere le style en ligne, et une injection de CSS
 * suffit a defigurer la carte ou a faire fuir ce qu'elle affiche.
 */
const esc = s => String(s ?? '').replace(/[<>&"']/g, c => (
  {'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
let me = null;

/* Les textes lus par le joueur, dans sa langue.
 *
 * Le dictionnaire arrive par i18n.js, servi juste avant celui-ci par le
 * serveur - donc dans la langue de la page, sans que le script ait a la
 * deviner. Une seule source : les gabarits PHP de traduction.
 *
 * Les emplacements s'ecrivent {nom} : leur ordre dans la phrase change d'une
 * langue a l'autre, et une concatenation ne saurait pas suivre.
 */
/* La langue de la page, telle que le serveur l'a rendue. Elle sert a deux
 * choses : nommer les pays dans la langue du lecteur, et adresser les routes
 * du site, qui sont toutes prefixees par elle (/fr/..., /ja/...).
 */
const LNG = document.documentElement.lang || 'fr';
const I18N = window.NP_I18N || {};
function T(key, vars) {
  let s = I18N[key];
  if (s === undefined) { return key; }
  if (vars) {
    for (const name in vars) { s = s.split('{' + name + '}').join(vars[name]); }
  }
  return s;
}


/* Cartes cliquables de l'onglet « Jouer ».
 *
 * Elles portent des boutons : un clic sur l'un d'eux ne doit pas ouvrir la
 * carte. Le test visait `[onclick*=openGameFiche]`, un selecteur qui ne
 * trouve plus rien depuis que ce geste est un data-action.
 */
function cardClickAllowed(event) {
  return event.target.tagName !== 'BUTTON'
    && !event.target.closest('[data-action]:not([data-action="openPlayViewFromCard"]):not([data-action="openBrowseFromCard"])');
}
function openPlayViewFromCard(el, event) { if (cardClickAllowed(event)) openPlayView(); }
function openBrowseFromCard(el, event) { if (cardClickAllowed(event)) openBrowse(); }

/* Fabrique les attributs d'un geste, pour le HTML construit a l'execution.
 *
 * Ecrire onclick="foo('${x}')" obligeait a se mefier des apostrophes dans x -
 * d'ou les .replace(/'/g,'') qui trainaient et mutilaient les noms de jeux au
 * passage. Le JSON n'a pas ce probleme, et il conserve les TYPES : un numero
 * de sequence reste un nombre, un booleen reste un booleen.
 *
 * SELF marque la place de l'element dans la liste : une fonction qui attend
 * `this` au milieu de ses arguments le retrouve au bon rang.
 */
const SELF = '\u0000self';
function act(name, ...args) {
  const payload = JSON.stringify(args)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  return args.length
    ? `data-action="${name}" data-args="${payload}"`
    : `data-action="${name}"`;
}

/* Ouvre un lien externe. Etait un window.open() ecrit dans un attribut. */
function openExternal(url) { window.open(url, '_blank', 'noopener'); }

/* Ouvre un certificat dans la boite commune, comme sur la fiche d'un jeu : on reste
   sur la page, et dans l'application installee on ne sort plus vers le navigateur.
   Sans la boite (script absent), on retombe sur l'ouverture externe - un geste qui
   ne fait rien serait pire qu'un geste qui sort. */
function openCertificate(url, title) {
  if (window.NelfeShotBox && typeof window.NelfeShotBox.ouvrirCertificat === 'function') {
    window.NelfeShotBox.ouvrirCertificat(url, title);
    return;
  }
  openExternal(url);
}

/* « Autre jeu » : quitte l'ecran de partie et bascule sur l'onglet Jeux. */
function backToGames() {
  playLeft = true;
  document.querySelector('#tabs button[data-v=games]').click();
}

document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => {
  // Quitter le second écran par un onglet = « je suis parti » : on ne le
  // réimpose pas (le lien Retour dédié a disparu, la nav suffit).
  if (document.getElementById('v-play').classList.contains('on')) playLeft = true;
  document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('on', v.id === 'v-' + b.dataset.v));
  window.scrollTo({ top: 0 });
  // On rafraîchit AUSSI l'état live : sinon, à l'ouverture de l'onglet, les
  // boutons « Lancer » manquent tant que le prochain poll n'a pas eu lieu.
  if (b.dataset.v === 'games') { loadGames(); livePoll(); }
});
// Afficher une vue par son nom (sous-pages sans onglet : Config). Le pill de
// nav reste sur l'onglet parent (Config vit sous « Moi »).
function showView(v) {
  document.querySelectorAll('.view').forEach(x => x.classList.toggle('on', x.id === 'v-' + v));
  window.scrollTo({ top: 0 });
}
function openConfig() { showView('config'); }

// Ouvrir directement un onglet via le hash (#stats, #badges…) une fois les
// données chargées - pratique pour les liens profonds et les captures.
(function () {
  const target = (location.hash || '').slice(1);
  if (!target) return;
  const timer = setInterval(() => {
    if (!document.getElementById('tabs').classList.contains('u-hide')) {
      clearInterval(timer);
      const btn = document.querySelector('#tabs button[data-v="' + target + '"]');
      if (btn) btn.click();
    }
  }, 200);
})();

async function load() {
  const r = await fetch(B + '/account/data');
  if (!r.ok) {
    // Pas de compte : on montre le formulaire - et on RANGE ce qui appartient
    // a une session. Sans cet appel, la barre « Quitter la borne » restait a
    // l'ecran apres une deconnexion, vide de son nom, parce que la fonction
    // qui la remplit n'etait jamais atteinte.
    document.getElementById('login').classList.remove('u-hide');
    refreshLeaveBar();
    return;
  }
  const d = await r.json();
  document.getElementById('tabs').classList.remove('u-hide');
  document.getElementById('v-card').classList.add('on');
  document.getElementById('who').textContent = d.email;
  loadFollows();
  me = d;
  refreshLeaveBar();
  livePoll();
  // Les tetes de la carte, de la vue « moi » et de l'onglet viennent d'Atelier 64 et se
  // dessinent dans le navigateur (nelfe-avatar-head.js). Ce script n'ecrit jamais leur `src` :
  // il dit seulement QUEL avatar poser (poserTetes), le module fait le reste.
  document.getElementById('cardPseudo').textContent = d.displayName;
  document.getElementById('pseudo').value = d.displayName || '';
  document.getElementById('myCode').textContent = d.playerCode || '-';
  document.getElementById('avatarLevel').textContent = T('style_depuis_jeux');
  avatarDuJour();
  // La carte plateforme fait foi pour le titre de champion : si la copie du site ne dit pas la
  // meme chose (titre pris sur le telephone, ou perdu), on la fait relire, puis la borne suit.
  reconcilierAvatar(d.avatarSeed || '');
  renderRoles(d.roles || []);

  // Avatars de champion du monde : chaque jeu gagné = son avatar adoptable.
  const gaBox = document.getElementById('gameAvatarBox');
  const ga = d.gameAvatars || [];
  const curSeed = d.avatarSeed || '';
  if (ga.length) {
    gaBox.classList.remove('u-hide');
    document.getElementById('gameAvatars').innerHTML = ga.map(g => {
      const on = curSeed === 'game:' + g.gameKey;
      return `<div class="u-center u-click" ${act('pickGameAvatar', g.gameKey)}>
        <canvas width="32" height="32" data-nelfe-game-head="${esc(g.gameKey)}"
          class="avatar-game u-width-64px u-height-64px${on ? ' is-on' : ''}" aria-hidden="true"></canvas>
        <div class="hint u-fs11 u-mt3 u-max-width-74px">${esc(g.name)}</div>
        ${on ? `<div class="u-fg-ffd257 u-fs11">${T('porte')}</div>` : ''}</div>`;
    }).join('') +
      (curSeed.startsWith('game:')
        ? `<div class="u-center u-click" ${act('pickGameAvatar', '')}>
            <div class="u-width-64px u-height-64px u-r12 u-border-2px-dashed-31314a u-row u-middle u-hcenter u-fs24">↩</div>
            <div class="hint u-fs11 u-mt3">${T('defaut')}</div></div>` : '');
  } else {
    gaBox.classList.add('u-hide');
  }
  poserTetes();

  const h = d.honors || {};
  const n = o => o ? (o.gold + o.silver + o.bronze) : 0;
  const big = [];
  if (n(h.crowns)) big.push('👑' + n(h.crowns));
  if (n(h.cups)) big.push('🏆' + n(h.cups));
  if (n(h.medals)) big.push('🏅' + n(h.medals));
  if (n(h.stars)) big.push('⭐' + n(h.stars));
  document.getElementById('cardHonors').textContent = big.join('  ');

  // Tout lieu confondu (2026-09-30) : les records de salle ET les records certifies NelfePlay,
  // un jeu compte une fois (sans systeme ni revision de dump). Le nombre de jeux vient de la
  // plateforme (totalGames : les jeux joues sur NelfePlay et en salle) ; compter les seuls
  // records de salle laissait « 0 jeux » a un joueur de maison.
  const slug = k => String(k || '').split('/').pop().toLowerCase().replace(/-rev-?\d+$/, '');
  const games = {};
  (d.records || []).forEach(x => (x.scores || []).forEach(s => {
    const k = slug(s.gameKey);
    // s.label = « Sonic The Hedgehog (MD) » - jamais la clé technique.
    if (!games[k] || s.best > games[k].best) games[k] = { name: s.label || s.gameName || k, best: s.best };
  }));
  (d.certifiedRecords || []).forEach(r => {
    const k = slug(r.game);
    const best = Number(r.score) || 0;
    const nom = String(r.game || '').replace(/-/g, ' ').replace(/\b\w/g, m => m.toUpperCase());
    if (!games[k] || best > games[k].best) games[k] = { name: nom, best };
  });
  const top = Object.values(games).sort((a, b) => b.best - a.best);
  document.getElementById('stScores').textContent = d.totalParties ?? d.totalScores ?? 0;
  document.getElementById('stGames').textContent = d.totalGames ?? Object.keys(games).length;
  document.getElementById('stTrophies').textContent = (h.details || []).length;
  // Badges de jeu en icônes sur la carte (💎🔥🎯⚡…).
  const cardBadges = document.getElementById('cardBadges');
  const badgeIcons = (d.gameBadges || []).map(b => `<span title="${esc(b.label)}">${b.icon}</span>`).join('');
  cardBadges.innerHTML = badgeIcons;
  cardBadges.classList.toggle('u-hide', !(badgeIcons));
  const medalIcons = ['🥇', '🥈', '🥉'];
  document.getElementById('cardTop3').innerHTML = top.slice(0, 3).map((g, i) =>
    `<div class="row"><span>${medalIcons[i]}</span><span class="g">${esc(g.name)}</span>
     <span class="s">${Number(g.best).toLocaleString('fr-FR')}</span></div>`).join('') ||
    `<div class="row"><span class="g u-fg-a79fc0">${T('identifiez_vous_dans_une_salle_en_scan')}</span></div>`;

  // Chaque échelle garde SON icône (étoile salle, médaille ville, coupe pays,
  // couronne monde) ; c'est sa COULEUR qui dit le métal. En SVG car un emoji
  // ne se colore pas.
  const METAL = { gold:'#ffd257', silver:'#c0c6d0', bronze:'#e0743a' };
  const SHAPES = {
    star: '<path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/>',
    medal: '<path d="M7 2h3.1l1.9 3.9L13.9 2H17l-3.2 6.4a6.6 6.6 0 1 1-3.6 0z"/>',
    cup: '<path d="M6 3h12v3.6c0 3.3-2.7 6-6 6s-6-2.7-6-6zM2.6 4.4H5v2.4A3.4 3.4 0 0 1 2.6 4.4zM19 4.4h2.4A3.4 3.4 0 0 1 19 6.8zM11 13h2v4.1h3.3v2.5H7.7v-2.5H11z"/>',
    crown: '<path d="M2.8 6.4l4.4 3.7L12 3.4l4.8 6.7 4.4-3.7-1.8 11H4.6zM4.5 18.3h15v2.3h-15z"/>'
  };
  const hicon = (kind, metal) =>
    `<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"
      class="ico-inline metal-${metal || 'none'}">${SHAPES[kind] || SHAPES.star}</svg>`;
  const cats = [];
  // On n'affiche QUE ce que le joueur possède (métal par métal).
  const t = (kind, o) => ['gold','silver','bronze']
    .filter(m => o[m] > 0)
    .map(m => `<span class="u-nowrap">${hicon(kind, m)}&nbsp;${o[m]}</span>`)
    .join(' ');
  const nz = o => o && (o.gold + o.silver + o.bronze) > 0;
  if (nz(h.stars)) cats.push(T('salle') + t('star', h.stars));
  if (nz(h.medals)) cats.push(T('ville') + t('medal', h.medals));
  if (nz(h.cups)) cats.push(T('pays') + t('cup', h.cups));
  if (nz(h.crowns)) cats.push(T('monde') + t('crown', h.crowns));
  document.getElementById('honors').innerHTML = cats.length ? cats.join(' &nbsp;·&nbsp; ') :
    T('vitrine_vide', {
       lien_salle: 'https://nelfetech.com/joueurs.html',
       lien_contest: 'https://nelfetech.com/retrocreator.html',
     });
  /* Perimetre d'un trophee : salle, ville, pays, monde.
   *
   * Le pays arrive du hub en code ISO majuscule (« FR »), pas en nom. Le
   * drapeau se derive donc des deux lettres elles-memes - A..Z vers les
   * indicateurs regionaux - et il n'y a aucune table a tenir a jour. Le nom
   * se traduit par Intl.DisplayNames, qui le rend dans la langue de la page :
   * « Japon » pour un francais, « 日本 » pour un japonais.
   *
   * Salle et ville restent telles quelles : ce sont des noms propres, ecrits
   * par la salle. On ne traduit pas « Le Pixel » ni « Lyon ».
   */
  function paysHtml(code) {
    const lettres = [...code].map(c => 0x1F1E6 + c.charCodeAt(0) - 65);
    let nom = code;
    try { nom = new Intl.DisplayNames([LNG], { type: 'region' }).of(code) || code; }
    catch (e) { /* navigateur sans Intl.DisplayNames : le code fait l'affaire */ }
    return String.fromCodePoint(...lettres) + ' ' + esc(nom);
  }
  function scopeHtml(x) {
    if (x.kind === 'crown') { return T('perimetre_monde'); }
    const v = (x.scope || '').trim();
    if (x.kind === 'cup' && /^[A-Za-z]{2}$/.test(v)) { return paysHtml(v.toUpperCase()); }
    return esc(v);
  }
  // Un bloc par ANNÉE (titre au-dessus), puis 4 colonnes seulement :
  // rang · périmètre · étoile colorée · jeu.
  const byYear = {};
  (h.details || []).forEach(x => { (byYear[x.year] ||= []).push(x); });
  document.getElementById('honorsDetail').innerHTML = Object.keys(byYear)
    .sort((a, b) => b - a)
    .map(year => {
      const rows = byYear[year].map(x => `<tr>
        <td class="u-width-46px u-w700">#${x.place}</td>
        <td class="u-nowrap">${scopeHtml(x)}</td>
        <td class="u-width-26px u-center">${hicon(x.kind, x.metal)}</td>
        <td>${esc(x.game)}</td></tr>`).join('');
      const prov = byYear[year].some(x => x.provisional) ? ` <span class="hint">${T('en_cours')}</span>` : '';
      return `<div class="u-mt12">
        <div class="hint label-section">${year}${prov}</div>
        <table><tbody>${rows}</tbody></table></div>`;
    }).join('');

  // Trophées gamifiés : assiduité par jeu (icône pixel du jeu) + séries de
  // victoires - dans la fiche, sous le palmarès.
  const gb = d.gameBadges || [];
  document.getElementById('gameBadges').innerHTML = gb.length ? gb.map(b => `
    <div class="row u-middle u-gap10">
      ${b.gameKey ? `<canvas width="32" height="32" data-nelfe-game-head="${esc(b.gameKey)}"
        class="u-pixel u-r5 tete-jeu-26" aria-hidden="true"></canvas>` : `<span class="u-fs20">${b.icon}</span>`}
      <span class="g u-white-space-normal">${b.gameKey ? b.icon + ' ' : ''}${esc(b.label)}</span>
    </div>`).join('')
    : `<span class="hint">${T('jouez_10_parties_d_un_meme_jeu_debloqu')}</span>`;

  const links = d.identityLinks || [];
  document.getElementById('links').innerHTML = links.map(l =>
    `✅ ${l.provider === 'ra' ? 'RetroAchievements' : 'Twitch'} - <b>${esc(l.label)}</b>`).join('<br>') ||
    T('aucune_identite_liee_pour_le_moment');
  const hasTwitch = links.some(l => l.provider === 'twitch');
  const hasRa = links.some(l => l.provider === 'ra');
  document.getElementById('twitchRow').classList.toggle('u-hide', hasTwitch);
  document.getElementById('raRow').classList.toggle('u-hide', hasRa);
  if (!hasTwitch && !window.__twitchTried) {
    window.__twitchTried = 1;
    fetch(B + '/account/link/twitch', { method: 'POST' }).then(r => { if (r.ok) load(); });
  }

  document.getElementById('claims').innerHTML = (d.claimedPlayers || []).map(c =>
    `🎫 ${esc(c.siteId)} - ${esc(c.playerRef)}`).join('<br>') || T('aucun_badge_rattache_pour_le_moment');
  const dmy = v => v ? new Date(v).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'2-digit' }) : '';
  const NP = 'https://nelfeplay.com';
  const ctxIcon = c => ({ home: '🎮', stream: '📺', station: '🕹️' }[c] || '🎮');
  const titleize = s => String(s || '').replace(/-/g, ' ').replace(/\b\w/g, m => m.toUpperCase());
  const cr = d.certifiedRecords || [];
  // Règle d'autorité : un jeu OUVERT (certifié) ne se ré-affiche PAS dans « vérifié
  // salle » - il est déjà dans « records certifiés ». Dédoublonnage par slug de jeu,
  // normalisé (sans préfixe système ni suffixe -rev-N) car la couche salle garde des
  // variantes de dump (« -rev-0 ») là où le certifié utilise la clé canonique.
  const norm = k => String(k || '').split('/').pop().toLowerCase().replace(/-rev-?\d+$/, '');
  const certGames = new Set(cr.map(r => norm(r.game)));
  // Mes records SALLE : date · salle · jeu · score, hors jeux ouverts (dédoublonnés).
  const rec = [];
  (d.records || []).forEach(x => (x.scores || []).forEach(s => {
    const slug = norm(s.gameKey);
    if (certGames.has(slug)) return;   // jeu ouvert → la couche certifiée fait autorité
    rec.push({ at: s.at, site: x.siteName || x.siteId, label: s.label || s.gameName || s.gameKey, best: s.best });
  }));
  rec.sort((a, b) => new Date(b.at) - new Date(a.at));
  // Masque le bloc « vérifié salle » s'il ne reste rien après dédoublonnage.
  const venueHead = document.getElementById('venueHead');
  if (venueHead) venueHead.classList.toggle('u-hide', !(rec.length));
  document.getElementById('records').classList.toggle('u-hide', !(rec.length));
  document.getElementById('records').innerHTML = '<tbody>' + rec.map(r =>
    `<tr><td class="hint u-nowrap">${dmy(r.at)}</td>
     <td class="u-nowrap">${esc(r.site)}</td><td>${esc(r.label)}</td>
     <td class=v>${Number(r.best).toLocaleString('fr-FR')}</td></tr>`).join('') + '</tbody>';
  // Records CERTIFIÉS (chaîne NelfePlay) : 🔒 machine, rang MONDIAL, lien vers le
  // board officiel. Source unique de l'officiel ; boards cloisonnés par monde.
  document.getElementById('certifiedLead').classList.toggle('u-hide', !(cr.length));
  document.getElementById('certifiedRecords').innerHTML = '<tbody>' + (cr.map(r => {
    const name = esc(titleize(r.game));
    const url = r.permalink ? NP + esc(r.permalink) : '';
    // LIGNE cliquable, pas un lien <a> : évite le violet « visité » du thème.
    // Le CERTIFICAT de ce record s'ouvre en modale ; faute de certificat genere, la
    // ligne garde son lien vers le classement.
    const cert = r.certificate ? NP + esc(r.certificate) : '';
    const rowAttrs = cert
      ? ` ${act('openCertificate', cert, titleize(r.game))} class="u-click"`
      : (url ? ` ${act('openExternal', url)} class="u-click"` : '');
    const arrow = url ? ' <span class="hint u-opacity-7">↗</span>' : '';
    const prov = r.context === 'station' && r.venue ? ' · ' + esc(r.venue) : '';
    return `<tr${rowAttrs}><td><b translate="no">${name}</b> <span class="hint" translate="no">${esc(r.ruleset)} · ${ctxIcon(r.context)}${prov}</span>${arrow}</td>` +
      `<td class="hint u-nowrap">#${Number(r.rank).toLocaleString('fr-FR')} / ${Number(r.of).toLocaleString('fr-FR')}</td>` +
      `<td class=v translate="no">${Number(r.score).toLocaleString('fr-FR')}</td></tr>`;
  }).join('') ||
    `<tr><td class=hint>${T('aucun_record_certifie_jouez_a_un_jeu_o')}</td></tr>`) + '</tbody>';
  // Tournois : salle · jeu · date · ma place (le nom de manche répétait le jeu).
  document.getElementById('tours').innerHTML = '<tbody>' + ((d.tournaments || []).map(t2 =>
    `<tr><td class="u-nowrap">${esc(t2.site)}</td><td>${esc(t2.gameLabel || t2.game)}</td>
     <td class="hint u-nowrap">${dmy(t2.endedAt)}</td>
     <td class="u-nowrap">${t2.myRank ? ('#' + t2.myRank + (t2.myRank === 1 ? ' 🏆' : '')) : '-'}</td>
     <td class=v>${t2.myScore ? Number(t2.myScore).toLocaleString('fr-FR') : ''}</td></tr>`).join('') ||
    `<tr><td class=hint>${T('aucun_tournoi_dans_vos_salles_pour_l_i')}</td></tr>`) + '</tbody>';
  // Contests : QUI organisait (streamer) · quel contest · quand.
  document.getElementById('contests').innerHTML = '<tbody>' + ((d.contests || []).map(c =>
    `<tr><td class="u-nowrap">🎥 ${esc(c.streamer || '-')}</td><td>${esc(c.contest)}</td>
     <td class="hint u-nowrap">${dmy(c.joinedAt)}</td></tr>`).join('') ||
    `<tr><td class=hint>${T('liez_twitch_et_participez_a_un_live_co')}</td></tr>`) + '</tbody>';
}

async function loadFollows() {
  const r = await fetch(B + '/account/follows');
  if (!r.ok) return;
  const d = await r.json();
  const siteSel = document.getElementById('followSite');
  const strSel = document.getElementById('followStreamer');
  const followed = new Set((d.follows || []).map(f => f.kind + '|' + f.ref.toLowerCase()));
  window.__followedSites = (d.follows || []).filter(f => f.kind === 'site').map(f => f.ref);
  const siteOpts = (d.suggestions.sites || []).filter(s => !followed.has('site|' + s.siteId.toLowerCase()));
  siteSel.innerHTML = `<option value="">${T('choisir_une_salle')}</option>` +
    siteOpts.map(s => `<option value="${esc(s.siteId)}">${esc(s.name)}${s.city ? ' - ' + esc(s.city) : ''}</option>`).join('');
  // Rien à proposer → on masque tout le bloc (sélecteur + bouton Suivre) plutôt
  // que d'afficher une liste vide inutile.
  const siteRow = document.getElementById('followSiteRow');
  if (siteRow) siteRow.classList.toggle('u-hide', !(siteOpts.length));
  strSel.innerHTML = `<option value="">${T('choisir_un_streamer')}</option>` +
    (d.suggestions.streamers || []).filter(c => !followed.has('streamer|' + c.toLowerCase()))
      .map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  // Salles et streamers partagent la MEME carte : icône, nom, sous-titre, un
  // lien d'action à droite (itinéraire / chaîne) et le retrait du suivi.
  const card = (icon, title, sub, action, kind, ref) =>
    `<div class="list-row">
      <span class="u-fs20 u-line-height-1">${icon}</span>
      <span class="u-grow u-shrink">
        <b class="u-block">${esc(title)}</b>
        <span class="hint">${esc(sub)}</span></span>
      ${action}
      <a href="#" title="${T('ne_plus_suivre')}" class="u-fg-8a8aa5 u-plain"
         ${act('unfollow', kind, ref)} data-prevent>✕</a>
    </div>`;
  // La couleur disait le service : cyan pour l'itineraire, violet pour
  // Twitch. C'est un role, donc une classe.
  const link = (href, label, role) => `<a href="${href}" target="_blank" rel="noopener"
    class="lien-${role}">${label}</a>`;
  const TWITCH = `<svg viewBox="0 0 24 24" width="19" height="19" fill="#a970ff" aria-hidden="true"
    ><path d="M4.3 2L2.5 6.6v14.1h4.8V24h2.9l2.7-3.3h4L23 15V2zm15.9 12.3l-3 3h-4.5l-2.6 2.6v-2.6H6.8V4h13.4z"
    /><path d="M13.9 7.4h1.9v5.5h-1.9zM9.1 7.4H11v5.5H9.1z"/></svg>`;
  document.getElementById('mySites').innerHTML = (d.follows || [])
    .filter(f => f.kind === 'site')
    .map(f => {
      const label = f.name || f.ref;
      const dest = encodeURIComponent([f.address, f.city].filter(Boolean).join(' ') || label);
      return card('🏪', label, f.address || f.city || '',
        link('https://www.google.com/maps/dir/?api=1&destination=' + dest, T('s_y_rendre'), 'route'),
        'site', f.ref);
    }).join('') || `<span class="hint">${T('aucune_salle_suivie_ajoutez_en_une_ci_')}</span>`;
  document.getElementById('myStreamers').innerHTML = (d.follows || [])
    .filter(f => f.kind === 'streamer')
    .map(f => card(TWITCH, f.ref, T('live_contests_sur_twitch'),
      link('https://www.twitch.tv/' + encodeURIComponent(f.ref), T('consulter_la_chaine'), 'twitch'),
      'streamer', f.ref))
    .join('') || `<span class="hint">${T('aucun_streamer_suivi_ajoutez_en_un_ci_')}</span>`;
  loadFeed();
}
async function loadFeed() {
  const r = await fetch(B + '/account/feed');
  if (!r.ok) return;
  const d = await r.json();
  // Beaucoup de titres de soirée nomment déjà le jeu (« Soirée Versus -
  // Street Fighter II ») : on ne le répète pas derrière.
  const flat = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const dup = e => { const g = flat(e.game); return g.length > 3 && flat(e.title).includes(g.slice(0, 12)); };
  const eventHtml = e =>
    `🗓️ <b>${esc(e.site)}</b> - ${esc(e.title)}${e.game && !dup(e) ? ' · ' + esc(e.game) : ''}` +
    (e.cancelled ? ` <span class="badge chip-red">${T('annule')}</span>` : '') +
    `<br><span class="u-fg-8a8aa5">${new Date(e.startsAt).toLocaleString('fr-FR', { weekday:'long', day:'numeric', month:'long', hour:'2-digit', minute:'2-digit' })}` +
    // Compteur seulement au-dessus du seuil fixé par la salle.
    (e.showGoing && e.going > 0 ? ` · ${e.going} participant${e.going > 1 ? 's' : ''}` : '') + '</span> ' +
    (e.cancelled ? '' : (e.me
      ? `<button class="btn-go" ${act('rsvp', e.siteId, e.seq, false)}>${T('j_y_serai_annuler')}</button>`
      : `<button class="u-wauto u-padding-5px-12px u-fs13" ${act('rsvp', e.siteId, e.seq, true)}>${T('je_participe')}</button>`));
  // Les événements à venir vivent AUSSI sous la carte (première page).
  document.getElementById('cardEvents').innerHTML = (d.events || []).map(e =>
    `<div class="row"><span class="g u-white-space-normal">${eventHtml(e)}</span></div>`).join('');
  // « Events à venir » : uniquement les événements (tournois et contests ont
  // désormais leur propre section plus bas).
  document.getElementById('feed').innerHTML = (d.events || []).length
    ? (d.events || []).map(e =>
        `<div class="row-sep">${eventHtml(e)}</div>`).join('')
    : T('aucun_event_a_venir_dans_vos_salles_su');
}
// ── Ma chaîne Twitch : clé (chiffrée côté serveur), opt-in écrans, et
//    pilotage de la diffusion pendant une session. ──────────────────────────
window.__streaming = { twitchConfigured: false, allowScreens: false, live: false };
async function loadStreaming() {
  const r = await fetch(B + '/account/streaming');
  if (!r.ok) return;
  const d = await r.json();
  window.__streaming.twitchConfigured = !!d.twitchConfigured;
  window.__streaming.allowScreens = !!d.allowScreens;
  document.getElementById('twitchState').textContent = d.twitchConfigured
    ? T('cle_enregistree_les_boutons_de_diffusi')
    : '';
  document.getElementById('twitchForget').classList.toggle('u-hide', !(d.twitchConfigured));
  document.getElementById('allowScreens').checked = !!d.allowScreens;
}
async function saveTwitchKey() {
  const key = document.getElementById('twitchKey').value.trim();
  if (!key) return;
  const r = await fetch(B + '/account/twitch', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key })
  });
  document.getElementById('twitchKey').value = '';
  document.getElementById('twitchState').textContent = r.ok ? T('cle_enregistree') : T('erreur_reessayez');
  loadStreaming();
}
async function forgetTwitchKey() {
  await fetch(B + '/account/twitch', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: '' })
  });
  loadStreaming();
}
async function saveScreensOptin() {
  // En session, le changement part aussi vers la borne courante (effet immédiat).
  const s = cabSession();
  await fetch(B + '/account/screens-optin', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      allow: document.getElementById('allowScreens').checked,
      siteId: s ? s.site : null, cabinetId: s ? s.cabinet : null
    })
  });
}
async function streamIntent(mode) {
  const s = cabSession();
  if (!s) return;
  const msg = document.getElementById('streamMsg');
  msg.textContent = '⏳ …';
  const r = await fetch(B + '/account/stream-intent', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ siteId: s.site, cabinetId: s.cabinet, mode })
  });
  if (!r.ok) { const d = await r.json().catch(() => ({})); msg.textContent = d.error || 'Erreur.'; return; }
  window.__streaming.live = mode !== 'off';
  msg.textContent = mode === 'self' ? T('votre_partie_part_sur_votre_chaine_que')
    : mode === 'venue' ? T('le_flux_de_la_salle_part_sur_votre_cha')
    : T('diffusion_arretee');
  syncStreamButtons();
}
function syncStreamButtons() {
  const box = document.getElementById('playStream');
  if (!box) return;
  const s = cabSession();
  box.classList.toggle('u-hide', !(s && window.__streaming.twitchConfigured));
  document.getElementById('streamOffBtn').classList.toggle('u-hide', !(window.__streaming.live));
  document.getElementById('streamSelfBtn').classList.toggle('u-hide', window.__streaming.live);
  document.getElementById('streamVenueBtn').classList.toggle('u-hide', window.__streaming.live);
}
setInterval(syncStreamButtons, 3000);
loadStreaming();

function cabSession() {
  try {
    const s = JSON.parse(localStorage.getItem('nlc.cabsession') || 'null');
    if (s && Date.now() - s.at < 12 * 3600 * 1000) return s;
  } catch {}
  return null;
}
function refreshLeaveBar() {
  const s = cabSession();
  const bar = document.getElementById('leaveBar');
  bar.classList.toggle('u-hide', !(s));
  // Déjà sur une borne : le bouton « Scanner une borne » DISPARAÎT (on est
  // connecté, on quitte par le bandeau du haut).
  // Attention : appelée en boucle - on ne coupe jamais un scan en cours.
  if (s) { closeScanner(); document.getElementById('scanRow').classList.add('u-hide'); }
  else if (!scanStream) document.getElementById('scanRow').classList.remove('u-hide');
  // En session avec un jeu : le bouton du JEU EN COURS remplace le scan et
  // mène droit à l'écran de jeu.
  const mine = window.__liveMine;
  const playRow = document.getElementById('playNowRow');
  if (s && mine && mine.game) {
    document.getElementById('playNowGame').textContent =
      mine.game + (mine.state === 'ingame' ? T('ecran_de_jeu') : T('pret_a_lancer'));
    playRow.classList.remove('u-hide');
  } else {
    playRow.classList.add('u-hide');
  }
  if (!s) return;
  document.getElementById('leaveCab').textContent = s.cabinetName || s.cabinet;
}

function openPlayView() { showView('play'); }

// ── état live de MA borne (relayé par la plateforme, gratuit) ───────────────
// Un appel direct au hub est impossible depuis https (mixed content) : on lit
// donc l'état que le hub relaie via /sites/{id}/live. Sert à DEUX choses :
// afficher ce que fait la borne, et vérifier qu'on y est toujours (une session
// expirée ou reprise par un autre joueur ne doit plus s'afficher active).
// Puce électronique dessinée (pixel) pour l'état « sur un système » - plus
// parlant que des yeux. SVG inline (leaveNow rendu en innerHTML).
const CHIP_SVG = `<svg viewBox="0 0 16 16" width="14" height="14" shape-rendering="crispEdges"
  class="ico-inline" aria-hidden="true">
  <rect x="4" y="4" width="8" height="8" fill="#22d3ee"/><rect x="6" y="6" width="4" height="4" fill="#0e2a33"/>
  <g fill="#22d3ee"><rect x="6" y="1" width="1" height="3"/><rect x="9" y="1" width="1" height="3"/>
   <rect x="6" y="12" width="1" height="3"/><rect x="9" y="12" width="1" height="3"/>
   <rect x="1" y="6" width="3" height="1"/><rect x="1" y="9" width="3" height="1"/>
   <rect x="12" y="6" width="3" height="1"/><rect x="12" y="9" width="3" height="1"/></g></svg>`;
const LIVE_LABEL = { ingame: T('en_jeu'), game: CHIP_SVG + T('jeu_selectionne'), browsing: CHIP_SVG + T('sur_un_systeme') };
// La présence sur une borne pilote l'apparition des boutons « Lancer ». Dès
// qu'elle change (arrivée, départ, borne libérée), on re-rend la Gamelist si
// elle est affichée - sinon on garderait des « Lancer » fantômes.
function currentAtCab() { return !!(cabSession() && window.__liveMine); }
// Signature de l'état live : présence + borne + état + jeu courant. Dès qu'elle
// bouge (arrivée/départ, jeu lancé, jeu arrêté, changement de jeu), la Gamelist
// se re-rend - sinon le bouton resterait figé sur « Lancer » après un
// lancement, jusqu'à un rafraîchissement manuel.
function liveSig() {
  const s = cabSession(); const m = window.__liveMine;
  return !s || !m ? '' : [m.id || '', m.state || '', m.gameKey || ''].join('|');
}
function syncGamesView() {
  const sig = liveSig();
  if (sig === window.__lastLiveSig) return;
  const previous = window.__lastLiveSig;
  window.__lastLiveSig = sig;
  if (document.getElementById('v-games').classList.contains('on')) loadGames();
  syncPlayView(previous, sig);
}

// Second écran : la partie démarre → l'écran prend le dessus ; elle se termine
// → bilan. On ne force l'affichage que si le joueur ne l'a pas quitté.
function syncPlayView(previous, sig) {
  const s = cabSession(); const mine = window.__liveMine;
  const wasIngame = (previous || '').split('|')[1] === 'ingame';
  const isIngame = !!(s && mine && mine.state === 'ingame' && mine.gameKey);
  if (isIngame && (!wasIngame || mine.gameKey !== playKey)) {
    playEnter(mine, s);
  } else if (wasIngame && !isIngame && playKey && !playLeft) {
    playExit(s ? s.site : '');
  }
}
async function livePoll() { try { await livePollCore(); } finally { syncGamesView(); } }
async function livePollCore() {
  const s = cabSession();
  const now = document.getElementById('leaveNow');
  if (!s) return;
  let list = null, hubFresh = false;
  try {
    const r = await fetch(B + '/sites/' + encodeURIComponent(s.site || '') + '/live');
    if (r.ok) { const j = await r.json(); list = j.cabinets || []; hubFresh = !!j.hubFresh; window.__lanLikely = !!j.lanLikely; }
  } catch { return; }
  if (!list) return; // salle injoignable : on garde l'affichage optimiste
  const mine = list.find(c => c.id === s.cabinet);
  // On ne ferme la session QUE sur un signal FIABLE :
  //  - reprise par un autre joueur (pseudo différent sur ma borne), ou
  //  - le hub est VIVANT (hubFresh) et ne me voit plus sur la borne, > 90 s
  //    après le scan (fenêtre de propagation du check-in).
  // Un relais vide alors que le hub est coupé ne ferme JAMAIS la session
  // (sinon on diverge : app déconnectée, hub encore lié → borne bloquée).
  const stale = Date.now() - s.at > 90 * 1000;
  if ((mine && me && mine.pseudo && mine.pseudo !== me.displayName) || (!mine && stale && hubFresh)) {
    localStorage.removeItem('nlc.cabsession');
    document.getElementById('leaveBar').classList.add('u-hide');
    if (!scanStream) document.getElementById('scanRow').classList.remove('u-hide');
    return;
  }
  if (!mine) { now.textContent = ''; window.__liveMine = null; return; }
  window.__liveMine = mine; // jeu courant de MA borne, pour la Gamelist
  // Le nom donné par la salle, si on ne l'avait pas (check-in relayé).
  if (mine.name && mine.name !== s.cabinetName) {
    try { localStorage.setItem('nlc.cabsession', JSON.stringify({ ...s, cabinetName: mine.name })); } catch {}
    document.getElementById('leaveCab').textContent = mine.name;
  }
  now.innerHTML = (LIVE_LABEL[mine.state] || '') +
    (mine.game ? ' · ' + esc(mine.game) : '') + (mine.system && !mine.game ? ' · ' + esc(mine.system) : '');
}
setInterval(livePoll, 4000);

// ── Mode « Match ton jeu » : on NAVIGUE vers une page servie EN LOCAL par le
//    hub (http://ip-lan:12400/browse.html). Page HTTP = accès LAN direct à la
//    borne (fiche/média/navigation instantanés, AUCUN aller-retour internet ;
//    le mixed content ne s'applique pas à une navigation de page). Au retour,
//    les jeux « à essayer »/favoris reviennent dans le hash - l'app (connectée)
//    les enregistre sur le compte.
function openBrowse() {
  const s = cabSession(); const m = window.__liveMine;
  if (!s || !m) return;
  // Le mode Match ouvre une page servie EN LOCAL par le hub (LAN). Hors du
  // Wi-Fi de la salle elle est injoignable : on ne navigue pas vers un lien mort.
  if (window.__lanLikely === false) {
    alert(T('connectez_vous_au_wi_fi_de_la_salle_po')); return;
  }
  // Jeu EN COURS : la borne est sous RetroArch, ES n'est pas pilotable et le
  // focus du jeu serait perdu - on n'ouvre pas le mode Match (le bouton est
  // déjà désactivé, ceci est la ceinture-bretelles).
  if (m.state === 'ingame') { alert(T('terminez_la_partie_en_cours_sur_la_bor')); return; }
  if (!m.hubUrl) { alert(T('le_mode_match_arrive_des_que_la_salle_')); return; }
  const back = location.origin + location.pathname; // sans hash
  location.href = m.hubUrl.replace(/\/$/, '') + '/browse.html?cab=' + encodeURIComponent(s.cabinet) +
    '&back=' + encodeURIComponent(back);
}

// De retour du mode Match : on enregistre les jeux repérés (avec leur NOM,
// transmis en base64 JSON dans le hash) sur le compte.
async function consumeBrowseReturn() {
  const h = location.hash || '';
  if (!h.startsWith('#browse:')) return;
  const params = new URLSearchParams(h.slice(8));
  const unpack = s => { try { return JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(s || ''))))); } catch { return {}; } };
  const s = cabSession();
  const tries = unpack(params.get('try')), favs = unpack(params.get('fav'));
  for (const [key, g] of Object.entries(tries)) {
    if (!key.includes('/')) continue;
    await fetch(B + '/account/trylist', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameKey: key, gameName: g.name || '', systemId: key.split('/')[0], romRel: g.romRel || '', siteId: s ? s.site : '' }) }).catch(() => {});
  }
  for (const [key, g] of Object.entries(favs)) {
    if (!key.includes('/')) continue;
    await fetch(B + '/account/favorite', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameKey: key, gameName: g.name || '', systemId: key.split('/')[0], on: true }) }).catch(() => {});
  }
  history.replaceState(null, '', location.pathname + '#games');
  const gtab = document.querySelector('#tabs button[data-v="games"]');
  if (gtab) gtab.click();
}

// ── Second écran « En jeu » ─────────────────────────────────────────────────
// Piloté par l'état live de MA borne : la partie démarre → l'écran prend le
// dessus ; elle se termine → bilan. Tout vient de flux déjà relayés (état
// borne, challenge) + le record du jeu : rien de lourd.
let playKey = null;        // jeu affiché sur cet écran
let playBefore = null;     // mon record AVANT la partie (pour le bilan)
let playLeft = false;      // l'utilisateur a quitté l'écran à la main

function leavePlayView() { playLeft = true; showView('card'); }

const nfr = v => Number(v).toLocaleString('fr-FR');

async function playStats(gameKey, siteId) {
  try {
    const r = await fetch(B + '/account/game-stats?key=' + encodeURIComponent(gameKey) +
      '&site=' + encodeURIComponent(siteId || ''));
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

// Entrée en jeu : on prépare l'écran et on retient mon record de départ.
let playScorable = null; // capture de score possible sur la partie en cours ?
async function playEnter(mine, s) {
  playKey = mine.gameKey;
  playScorable = mine.scorable;
  playLeft = false;
  poserTeteDeJeu(document.getElementById('playIcon'), mine.gameKey);
  document.getElementById('playGame').textContent = mine.game || '-';
  document.getElementById('playSystem').textContent = mine.system || '';
  document.getElementById('playResult').classList.add('u-hide');
  document.getElementById('playPhase').textContent = T('en_jeu_sur', { borne: s.cabinetName || s.cabinet });
  document.getElementById('playActions').innerHTML =
    `<button class="ghost u-bg-e05b4d u-fg-e05b4d" data-action="stopGame" data-self>${T('arreter')}</button>`;
  const stats = await playStats(mine.gameKey, s.site);
  playBefore = stats?.myBest ?? null;
  renderPlayRecords(stats);
  // Jeu sans capture de score : on le dit PENDANT la partie, pas après.
  if (playScorable === false) {
    document.getElementById('playRecords').innerHTML =
      `<span class="hint u-fg-e05b4d">${T('score_non_recuperable_sur_ce_jeu_pas_d')}</span>`;
  }
  showView('play');
}

// Top 5 de la salle sur ce jeu. Hors du top 5, on s'ajoute en 6e ligne avec
// notre vrai rang - on se situe toujours, même loin derrière.
function renderPlayBoard(stats) {
  const ring = document.getElementById('playBoardRing');
  if (!stats || !stats.top || !stats.top.length) { ring.classList.add('u-hide'); return; }
  ring.classList.remove('u-hide');
  document.getElementById('playBoardGame').textContent = document.getElementById('playGame').textContent;
  const rankMark = r => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : r + 'ᵉ';
  const row = (rank, name, value, isMine) =>
    `<div class="row"${isMine ? ' class="chip-cyan"' : ''}>
       <span class="u-width-28px u-center u-fixed">${rankMark(rank)}</span>
       <span class="g">${esc(name)}${isMine ? ' <b class="u-fg-22d3ee">· toi</b>' : ''}</span>
       <span class="s">${nfr(value)}</span></div>`;
  let html = stats.top.map(t => row(t.rank, t.player, t.value, t.mine)).join('');
  if (stats.myRank && stats.myRank > stats.top.length && stats.myBest != null) {
    html += `<div class="u-center u-fg-5a5a72 u-fs13 u-line-height-1">⋯</div>` +
      row(stats.myRank, me ? me.displayName : 'Moi', stats.myBest, true);
  }

  document.getElementById('playBoard').innerHTML = html;
}

function renderPlayRecords(stats) {
  renderPlayBoard(stats);
  const box = document.getElementById('playRecords');
  // Toujours quelque chose à l'écran : un bloc vide donne l'impression que
  // l'app a planté. Tous les jeux n'enregistrent pas de score (pas de hiscore
  // sur ce jeu/système) - on le dit clairement.
  if (!stats) {
    box.innerHTML = `<span class="hint">${T('records_indisponibles_pour_le_moment')}</span>`;
    return;
  }
  if (!stats.best && stats.myBest == null) {
    box.innerHTML = `<span class="hint">${T('aucun_score_enregistre_sur_ce_jeu_tous')}</span>`;
    return;
  }
  const who = stats.best && stats.best.mine ? ' · toi 👑'
    : (stats.best && stats.best.player ? ' · ' + esc(stats.best.player) : '');
  const medal = r => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : '🏅';
  box.innerHTML =
    (stats.myLast != null
      ? `<div class="row"><span class="g">${T('ton_score')}</span>
          <span class="v">${nfr(stats.myLast)}</span></div>` : '') +
    (stats.myRank
      ? `<div class="row"><span class="g">${medal(stats.myRank)} ${T('ton_rang_dans_la_salle')}</span>
          <span class="v">${stats.myRank}<sup>${stats.myRank === 1 ? 'er' : 'e'}</sup> / ${stats.players}</span></div>` : '') +
    `<div class="row"><span class="g">${T('record_de_la_salle')}</span>
      <span class="v">${stats.best ? nfr(stats.best.value) + who : '-'}</span></div>
     <div class="row"><span class="g">${T('ton_record')}</span>
      <span class="v">${stats.myBest != null ? nfr(stats.myBest) : '-'}</span></div>`;
}

// Sortie de jeu : bilan (le score a pu être enregistré à la fermeture).
async function playExit(siteId) {
  if (!playKey) return;
  const gameKey = playKey;
  document.getElementById('playPhase').textContent = T('partie_terminee');
  document.getElementById('playActions').innerHTML =
    `<button class="btn-primary"
       ${act('launchGame', gameKey, '', SELF)}>▶ Rejouer</button>
     <button class="ghost" data-action="backToGames">${T('autre_jeu')}</button>`;
  // Le score arrive avec le push de la salle : on relit plusieurs fois, et on
  // conclut TOUJOURS par un message (même « rien de neuf »), sinon l'écran
  // reste muet et on croit que ça n'a pas marché.
  const box = document.getElementById('playResult');
  // Les trois couleurs disaient toujours la meme chose : de quel genre est
  // le message. On nomme le genre, la feuille tient les teintes.
  const banner = (genre, html) => {
    box.classList.remove('u-hide');
    box.innerHTML = `<div class="res res-${genre}">${html}</div>`;
  };

  // ── Fin de partie EN CHALLENGE : écran centré OBJECTIF, RAPIDE. On ne passe PAS
  // par le long « Enregistrement du score… » (qui finissait par ré-afficher un vieux
  // score → mélange score/challenge). On lit le classement relayé (chLast, actualisé
  // toutes les 3 s par chPoll) et on retrouve son entrée par cabinetId (= sa borne).
  const myCab = (cabSession() || {}).cabinet;
  const chRow = () => (chLast && chLast.leaderboard || []).find(e => e.cabinetId === myCab);
  const inChallenge = chLast && myCab && chLast.status && chLast.status !== 'cancelled'
    && (chRow() || chLast.status === 'running' || chLast.status === 'waiting');
  if (inChallenge) {
    // Formatage MODE-AWARE de la marque : temps (mm:ss / s,ss) pour race/timeattack/
    // survival, points sinon - cohérent avec le classement du hub (markKind).
    const fmtMark = (r) => {
      if (!r || r.mark == null) return '';
      if (r.markKind === 'time_ms') {
        const s = r.mark / 1000;
        return s < 60 ? s.toFixed(2).replace('.', ',') + ' s'
                      : Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0');
      }
      return nfr(r.mark) + T('pts');
    };
    const showChallenge = () => {
      const row = chRow();
      const obj = esc(chLast.objectiveText || chLast.game || 'Challenge');
      const total = (chLast.leaderboard || []).length;
      const done = chLast.status === 'finished';
      box.classList.remove('u-hide');
      box.innerHTML = `<div class="panel-gold">
        <div class="u-fs24 u-mb4">${done ? '🏁' : '⏱'}</div>
        <b>${T('challenge')} ${obj}</b><br>
        ${row
          ? `${T('ta_place')} <b class="u-fs22">#${row.rank || '-'}</b>${total > 1 ? ' <span class="u-opacity-8">/ ' + total + '</span>' : ''}${row.mark != null ? '<br><span class="u-opacity-85">' + (row.markKind === 'time_ms' ? T('ton_temps') : T('ton_score_2')) + ' : ' + fmtMark(row) + '</span>' : ''}`
          : (done ? T('ton_score_n_a_pas_ete_pris_en_compte_p') : T('classement_en_cours'))}
      </div>`;
    };
    showChallenge();
    // On rafraîchit tant que le rang n'est pas figé (chPoll met chLast à jour).
    for (const wait of [2500, 3000, 4000, 5000, 6000]) {
      await new Promise(done => setTimeout(done, wait));
      if (playLeft || playKey !== gameKey) return;
      showChallenge();
      if (chRow() && chLast.status === 'finished') break;
    }
    return;
  }

  // Jeu sans capture : conclusion IMMEDIATE - pas d'« Enregistrement… » qui
  // finit en déception.
  if (playScorable === false) {
    banner('ko',
      T('score_non_recuperable_sur_ce_jeu_pas_d'));
    return;
  }

  banner('attente', T('enregistrement_du_score'));

  let stats = null;
  for (const wait of [1500, 6000, 15000, 30000]) {
    await new Promise(done => setTimeout(done, wait));
    if (playLeft || playKey !== gameKey) return; // le joueur est passé à autre chose
    stats = await playStats(gameKey, siteId);
    if (!stats) continue;
    renderPlayRecords(stats);
    if (stats.myBest != null && (playBefore == null || stats.myBest > playBefore)) {
      const delta = playBefore == null ? null : stats.myBest - playBefore;
      banner('ok',
        `🎉 <b>${T('nouveau_record_perso')} ${nfr(stats.myBest)}</b>${delta ? ' (+' + nfr(delta) + ')' : ''}`);
      return;
    }
  }

  // Pas de nouveau record : on explique quand même où on en est.
  if (!stats || (!stats.best && stats.myBest == null)) {
    banner('attente',
      T('aucun_score_enregistre_pour_cette_part'));
  } else if (stats.best && stats.myBest != null && stats.myBest < stats.best.value) {
    banner('info',
      `${T('record_de_la_salle_2')} <b>${nfr(stats.best.value)}</b> ${T('il_te_manque')} <b>${nfr(stats.best.value - stats.myBest)}</b>.`);
  } else {
    banner('info',
      `${T('ton_record_tient_toujours')} <b>${nfr(stats.myBest)}</b>.`);
  }
}

// Cartouche challenge de l'écran de jeu (source : relais challenge).
function renderPlayChallenge(ch) {
  const box = document.getElementById('playChallenge');
  if (!ch || ch.status === 'finished') { box.classList.add('u-hide'); return; }
  box.classList.remove('u-hide');
  document.getElementById('playChObjective').textContent = ch.objectiveText || ch.game || '';
  const ends = ch.endsAtUtc ? new Date(ch.endsAtUtc).getTime() : null;
  document.getElementById('playChTimer').textContent =
    ends && ch.status === 'running' ? '⏱ ' + chFmt((ends - Date.now()) / 1000) : '';
}

// ── Gamelist : Recent · Favorites · Try list ────────────────────────────────
// Cartes façon « Mes salles » : icône pixel du jeu, nom + plateforme dessous,
// « Lancer » (dès qu'on est sur une borne) et actions à droite.
// L'icône d'un jeu est la TÊTE de l'avatar du jeu (clé du jeu, famille du jeu, couleurs du
// logo), posée par le moteur d'avatar du site. Le rendu ne donne que la clé.
window.__pv = {};
// Icône du jeu, avec - si le score n'est PAS capturable - un ROND BLEU « ⚠ »
// en haut à gauche (« pas de record possible »), dans toutes les listes.
const gicon = (key, noScore) => `<span class="u-rel u-fixed u-width-34px u-height-34px u-inline">
  <canvas width="32" height="32" data-nelfe-game-head="${esc(key)}"
    class="u-pixel u-r7 u-block tete-jeu-34" aria-hidden="true"></canvas>
  ${noScore ? `<span title="${T('pas_de_record_possible_sur_ce_jeu')}" class="pin-badge">⚠</span>` : ''}</span>`;
function gcard(g, right, icon) {
  // En salle (LAN) : icône + nom cliquables → fiche du jeu (screenshot,
  // description, records, Lancer). Hors salle : simple décor.
  const onLan = currentAtCab();
  const clickable = onLan && g.gameKey
    ? `${act('openGameFiche', g.gameKey, g.romRel || '', g.name || '')} class="u-click"`
    : '';
  return `<div class="list-row-tight">
      <span ${clickable}>${icon || gicon(g.gameKey, g.scorable === false, g.pv)}</span>
      <span class="u-grow u-shrink" ${clickable}>
        <b class="u-block u-nowrap u-clip u-text-overflow-ellipsis">${esc(g.name)}</b>
        <span class="hint">${esc(g.platform || '')}</span></span>
      ${right}</div>`;
}
// Ouvre la fiche d'un jeu PRÉCIS (page locale du hub, LAN). Sans romRel
// (Recent/Favoris), on tente par le nom ; la borne fera au mieux.
function openGameFiche(gameKey, romRel, name) {
  const s = cabSession(); const m = window.__liveMine;
  if (!s || !m || !m.hubUrl) { openBrowse(); return; }
  // Fiche servie en LOCAL par le hub (LAN) : injoignable hors Wi-Fi de la salle.
  if (window.__lanLikely === false) {
    alert(T('connectez_vous_au_wi_fi_de_la_salle_po_2')); return;
  }
  const sys = (gameKey || '').split('/')[0];
  // Sans romRel (Recent/Favoris), la fiche matche par le NOM d'affichage.
  const rel = romRel || ('roms/' + sys + '/' + (name || gameKey.split('/')[1] || ''));
  const back = location.origin + location.pathname;
  location.href = m.hubUrl.replace(/\/$/, '') + '/browse.html?cab=' + encodeURIComponent(s.cabinet) +
    '&game=' + encodeURIComponent(rel) + '&system=' + encodeURIComponent(sys) +
    '&back=' + encodeURIComponent(back);
}
// Étoile pleine en tête des cartes Favorites (l'icône de la liste).
const gFavIcon = `<span class="u-width-34px u-height-34px u-fixed u-row u-middle u-hcenter u-fs24 u-fg-ffd257">★</span>`;
// Bouton « Lancer » commun à toutes les listes (visible seulement sur borne).
// Pour le jeu EN COURS sur la borne, il devient « Arrêter ».
function launchBtn(g) {
  const mine = window.__liveMine;
  if (mine && mine.state === 'ingame' && mine.gameKey && mine.gameKey === g.gameKey) {
    return stopBtn();
  }
  return `<button title="${T('lancer')}" class="btn-square-go"
     ${act('launchGame', g.gameKey, g.romRel || '', SELF)}>▶</button>`;
}
function stopBtn() {
  return `<button class="btn-stop" data-action="stopGame" data-self>${T('arreter')}</button>`;
}
const xBtn = attrs => `<button title="${T('retirer')}" class="u-wauto u-bgnone u-fg-8a8aa5 u-padding-4px-8px u-fixed"
     ${attrs}>✕</button>`;
async function loadGames() {
  const r = await fetch(B + '/account/games');
  if (!r.ok) return;
  const d = await r.json();
  window.__pv = d.pv || {};
  const s = cabSession(); const mine = window.__liveMine;
  const atCab = !!(s && mine);

  // Bandeau : sur borne, on lance ; sinon, on invite à en trouver une.
  document.getElementById('gamesBanner').innerHTML = atCab
    ? `<div class="banner-green">
         ${T('sur_borne_lancez', { borne: esc(s.cabinetName || s.cabinet) })}
         <span class="u-block u-fg-a7cfc0 u-fs12_5 u-mt2">
         ${T('lancer_un_jeu_fermera_le_jeu_en_cours_')}</span>
         <span class="u-block u-fg-4da3ff u-fs12_5 u-mt2">
         ${T('avertissement_pas_de_record')}</span></div>
       ${mine.state === 'ingame'
         ? `<button disabled title="${T('terminez_la_partie_en_cours_la_borne_e')}"
              class="btn-off">${T('match_indisponible_pendant_une_partie')}</button>`
         : window.__lanLikely === false
         ? `<div class="banner-warn">
              ${T('connectez_wifi_pour_parcourir')}
              <span class="u-block u-fg-8a8aa5 u-fs12_5 u-mt2">
              ${T('le_mode_match_et_le_lancement_passent_')}</span></div>`
         : `<button data-action="openBrowse" class="btn-hero">${T('match_ton_jeu')}</button>`}`
    : `<div class="banner-violet">
         <span class="u-grow">${T('trouvez_une_borne_et_scannez_son_qr_po')}</span>
         <button data-action="openScanner" title="${T('scanner_une_borne')}" class="u-wauto u-fixed u-padding-9px-13px u-fs17 u-bg-8b5cf6 u-fg-fff">🔍</button></div>`;

  // À l'affiche : le jeu courant de MA borne, ajoutable à la try list.
  // EN JEU : la card (fond vert) est CLIQUABLE et mène à l'écran de jeu.
  const cur = document.getElementById('gamesCurrent');
  cur.innerHTML = atCab && mine.game && mine.gameKey
    ? `<h2>${mine.state === 'ingame' ? T('en_jeu_sur_la_borne') : T('selectionne_sur_la_borne')}</h2>` +
      `<div ${mine.state === 'ingame'
        ? ` class="card-live"
           title="${T('ouvrir_l_ecran_de_jeu')}" data-action="openPlayViewFromCard"`
        : ` class="u-click u-r14" title="${T('parcourir_les_jeux_match')}"
           data-action="openBrowseFromCard"`}>` + gcard(
        { gameKey: mine.gameKey, name: mine.game, platform: mine.system, scorable: mine.scorable, romRel: mine.romRel || '', pv: mine.pv },
        (mine.state === 'ingame'
          ? stopBtn() + ' '
          : launchBtn({ gameKey: mine.gameKey, romRel: mine.romRel || '' }) + ' ') +
        `<button class="btn-gold"
           data-action="addCurrentToTrylist" data-self>${T('a_essayer')}</button>`) + '</div>'
    : '';

  const hidden = hiddenRecents();
  const recent = (d.recent || []).filter(g => !hidden.has(g.gameKey));
  document.getElementById('gamesRecent').innerHTML = recent.length
    ? recent.map(g => gcard(g,
        (atCab ? launchBtn(g) + ' ' : '') +
        `<button title="${T('favori')}" class="u-wauto u-bgnone u-padding-4px-8px u-fs19 u-fixed"
           ${act('toggleFav', g.gameKey, SELF)}><span class="star${g.favorite ? ' is-fav' : ''}">★</span></button>` +
        xBtn(act('removeRecent', g.gameKey)))).join('')
    : `<span class="hint">${T('aucun_jeu_joue_pour_l_instant_vos_part')}</span>`;

  document.getElementById('gamesFav').innerHTML = (d.favorites || []).length
    ? (d.favorites || []).map(g => gcard(g,
        (atCab ? launchBtn(g) + ' ' : '') + xBtn(act('toggleFav', g.gameKey, SELF, true)), gFavIcon)).join('')
    : `<span class="hint">${T('etoilez_un_jeu_depuis_recent_pour_le_g')}</span>`;

  // Clé valide = « système/slug » (système en minuscules alphanum, jamais un
  // chemin absolu « E:/… »). Les entrées malformées d'anciens tests sont
  // auto-nettoyées.
  const validKey = k => /^[a-z0-9]+\/[a-z0-9-]+$/.test(k || '');
  (d.trylist || []).filter(g => !validKey(g.gameKey)).forEach(g =>
    fetch(B + '/account/trylist', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameKey: g.gameKey, remove: true }) }).catch(() => {}));
  const trylist = (d.trylist || []).filter(g => validKey(g.gameKey));
  document.getElementById('gamesTry').innerHTML = trylist.length
    ? trylist.map(g => gcard(g,
        (atCab ? launchBtn(g) + ' ' : '') + xBtn(act('trylistRemove', g.gameKey, SELF)))).join('')
    : `<span class="hint">${T('sur_une_borne_un_jeu_vous_plait_ajoute')}</span>`;
}
async function toggleFav(gameKey, btn, remove) {
  // Depuis Recent (remove absent) : on laisse le serveur BASCULER (ajoute si
  // absent, retire si présent). Depuis Favorites (✕) : on force le retrait.
  const body = remove ? { gameKey, on: false } : { gameKey };
  const r = await fetch(B + '/account/favorite', { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify(body) });
  if (r.ok) loadGames();
}
async function trylistRemove(gameKey, btn) {
  const r = await fetch(B + '/account/trylist', { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ gameKey, remove: true }) });
  if (r.ok) loadGames();
}
// Retirer de Recent = MASQUER seulement (les scores/records restent intacts).
function hiddenRecents() {
  try { return new Set(JSON.parse(localStorage.getItem('nlc.hiddenRecent') || '[]')); } catch { return new Set(); }
}
function removeRecent(gameKey) {
  const h = hiddenRecents(); h.add(gameKey);
  localStorage.setItem('nlc.hiddenRecent', JSON.stringify([...h]));
  loadGames();
}
async function addCurrentToTrylist(btn) {
  const s = cabSession(); if (!s) return;
  btn.disabled = true; btn.textContent = '…';
  const r = await fetch(B + '/account/trylist/add-current', { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ siteId: s.site, cabinetId: s.cabinet }) });
  const d = await r.json().catch(() => ({}));
  btn.textContent = r.ok ? (d.added ? T('ajoute') : T('deja_dans_la_liste')) : (d.error || 'Erreur');
  if (r.ok) setTimeout(loadGames, 900);
}
async function launchGame(gameKey, romRel, btn) {
  const s = cabSession(); if (!s) return;
  // Bouton carré (▶) : on garde des icônes COMPACTES, jamais un long texte
  // qui déborderait.
  btn.disabled = true; const label = btn.innerHTML; btn.innerHTML = '⏳';
  const r = await fetch(B + '/account/launch-intent', { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ siteId: s.site, cabinetId: s.cabinet, gameKey, romRel }) });
  btn.innerHTML = r.ok ? '✓' : '✗';
  setTimeout(() => { btn.disabled = false; btn.innerHTML = label; }, 3000);
}
// Relance le JEU EN COURS (ferme + relance) : la partie repart de zéro, et
// les succès RetroAchievements s'activent si le jeu avait démarré avant la
// connexion du joueur.
async function restartCurrentGame(btn) {
  const s = cabSession(); const mine = window.__liveMine;
  if (!s || !mine || !mine.gameKey) return;
  if (!confirm(T('relancer_le_jeu', { jeu: mine.game }))) return;
  launchGame(mine.gameKey, mine.romRel || '', btn);
}

async function stopGame(btn) {
  const s = cabSession(); if (!s) return;
  btn.disabled = true; btn.textContent = T('arret');
  const r = await fetch(B + '/account/stop-intent', { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ siteId: s.site, cabinetId: s.cabinet }) });
  btn.textContent = r.ok ? T('arrete') : 'Erreur';
  setTimeout(loadGames, 2000); // l'état live repassera au menu
}
async function leaveCabinet() {
  const s = cabSession();
  if (!s || !me) return;
  const out = document.getElementById('leaveOut');
  out.classList.remove('u-hide');
  out.textContent = T('fermeture_de_la_session');
  const done = msg => {
    localStorage.removeItem('nlc.cabsession');
    window.__liveMine = null;
    refreshLeaveBar();
    syncGamesView(); // enlève tout de suite les « Lancer » de la Gamelist
    out.textContent = msg;
    setTimeout(() => { out.classList.add('u-hide'); }, 8000);
  };
  // 1) Fermeture directe (même réseau que la borne) - la plus fiable.
  try {
    const r = await fetch(s.hub.replace(/\/$/, '') + '/api/v1/players/checkout', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ cabinetId: s.cabinet, code: me.playerCode })
    });
    if (r.ok) {
      const d = await r.json().catch(() => ({}));
      done((d.closed && d.closed.length)
        ? T('session_fermee_vos_scores_sont_enregis')
        : T('session_deja_fermee_rien_a_faire_vos_s'));
      return;
    }
  } catch {}
  // 2) Hors WiFi de la salle : relais par internet (le hub l'exécute à sa
  //    prochaine synchro). Dans tous les cas la borne se ferme seule après
  //    10 min d'inactivité - on confirme donc côté téléphone.
  if (s.site) {
    try {
      const ri = await fetch(B + '/account/checkin-intent', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ siteId: s.site, cabinetId: s.cabinet, action: 'checkout' }) });
      if (ri.ok) { done(T('fermeture_demandee_la_session_se_ferme')); return; }
    } catch {}
  }
  done(T('marquee_fermee_sur_ce_telephone_la_bor'));
}
async function rsvp(siteId, seq, going) {
  await fetch(B + '/account/rsvp', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ siteId, seq, going }) });
  loadFeed();
}
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstall = e;
  document.getElementById('installRow').classList.remove('u-hide');
});
async function installApp() {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  await deferredInstall.userChoice;
  deferredInstall = null;
  document.getElementById('installRow').classList.add('u-hide');
}
if (/iPhone|iPad/.test(navigator.userAgent) && !window.navigator.standalone) {
  document.getElementById('iosHint').classList.remove('u-hide');
}
async function follow(kind, ref) {
  if (!ref) return;
  await fetch(B + '/account/follow', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ kind, ref }) });
  loadFollows();
}
async function unfollow(kind, ref) {
  await fetch(B + '/account/unfollow', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ kind, ref }) });
  loadFollows();
}
/* Bascule de l'ecran de connexion entre « on demande » et « c'est parti ».
 *
 * Les etapes ne sont pas dupliquees : ce sont les MEMES, dont l'etat change.
 * Le lecteur reste au meme endroit - il voit sa demande avancer plutot que de
 * decouvrir un bloc apparu ailleurs.
 */
function ecranEnvoye(envoye, adresse) {
  const bascule = (id, cache) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('u-hide', cache);
  };
  bascule('loginForm', envoye);
  bascule('loginBack', !envoye);
  bascule('whyAsk', envoye);
  bascule('whySent', !envoye);
  bascule('whyRetry', !envoye);
  document.getElementById('steps').classList.toggle('is-sent', envoye);
  if (envoye) {
    document.getElementById('sentTo').textContent = T('lien_parti_vers', { email: adresse });
  }
}

async function login() {
  const e = document.getElementById('email').value;
  const r = await fetch(B + '/account/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email: e, lng: LNG }) });
  const d = await r.json();

  if (d.error) {
    document.getElementById('loginOut').textContent = d.error;
    return;
  }

  // Le serveur dit s'il a REUSSI a envoyer. Le client l'ignorait : quand le
  // SMTP refusait, l'ecran annoncait quand meme « regardez votre boite » pour
  // un courriel jamais parti - et le joueur attendait un lien qui n'existait
  // pas. Un echec d'envoi se voit maintenant tout de suite.
  if (d.sent === false && !d.devLink) {
    document.getElementById('loginOut').textContent = T('envoi_impossible');
    return;
  }

  // En developpement le lien est retourne : on le montre plutot que d'obliger
  // a ouvrir une boite mail qui n'existe pas.
  document.getElementById('loginOut').innerHTML = d.devLink
    ? `${T('lien_dev')} <a class="u-fg-8b5cf6" href="` + esc(d.devLink) + `">${T('se_connecter')}</a>`
    : '';
  ecranEnvoye(true, e);
}

/* Retour au formulaire : on s'est trompe d'adresse, ou le lien n'arrive pas. */
function loginBack() {
  ecranEnvoye(false, '');
  document.getElementById('loginOut').textContent = '';
  const champ = document.getElementById('email');
  champ.focus();
  champ.select();
}
async function claim() {
  const code = document.getElementById('code').value;
  const r = await fetch(B + '/account/claim', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ code }) });
  const d = await r.json();
  document.getElementById('claimOut').textContent = d.error ?? (T('rattache') + (d.pseudo || d.playerRef));
  if (r.ok) load();
}
async function logout() {
  // Ce domaine porte DEUX sessions : celle de la carte (relayee) et celle du
  // site (autorite de comptes). Se deconnecter les ferme toutes les deux -
  // sinon le site continue de reconnaitre le joueur, le pont le reconnecte
  // aussitot, et « se deconnecter » ne veut plus rien dire.
  await fetch(B + '/auth/logout', { method: 'POST' });

  const jeton = document.body.dataset.jetonSortie || '';
  if (jeton) {
    const corps = new URLSearchParams({ _token: jeton });
    // Meme origine : le cookie de session du site part avec la requete.
    await fetch('/' + LNG + '/account/logout', { method: 'POST', body: corps })
      .catch(() => { /* le site tombe : la carte est deconnectee, c'est l'essentiel */ });
  }

  // Quitter son compte, c'est aussi quitter la borne : la session borne vit
  // dans le navigateur et survivrait aux deux cookies sans cette ligne.
  try { localStorage.removeItem('nlc.cabsession'); } catch (e) {}
  location.reload();
}

// ── RGPD : export et suppression ──────────────────────────────────────────────
function exportData() { location.href = B + '/account/export'; }
async function deleteAccount() {
  const word = prompt(T('suppression_definitive'));
  if (word === null) return;
  const r = await fetch(B + '/account/delete', { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ confirm: word.trim() }) });
  const d = await r.json().catch(() => ({}));
  if (r.ok && d.deleted) { alert(T('compte_supprime_au_revoir')); location.reload(); }
  else document.getElementById('privacyOut').textContent = d.error || T('erreur_reessayez');
}

// ── outils du rôle d'enseigne (owner / moderator / organizer) ────────────────
let myRoles = [];
function renderRoles(roles) {
  myRoles = roles;
  if (!roles.length) return;
  document.getElementById('roleTools').classList.remove('u-hide');
  document.getElementById('roleTitle').textContent = roles.map(r =>
    `${r.siteName || r.siteId} : ${({owner:T('proprietaire'),moderator:T('moderateur'),organizer:'organisateur'})[r.role] || r.role}`).join(' · ');
  const canMod = roles.some(r => r.role === 'owner' || r.role === 'moderator');
  const canOrg = roles.some(r => r.role === 'owner' || r.role === 'organizer');
  if (canMod) { document.getElementById('modTool').classList.remove('u-hide'); loadSitePlayers(); }
  if (canOrg) { document.getElementById('orgTool').classList.remove('u-hide'); }
}
function roleSite(kinds) {
  const r = myRoles.find(x => kinds.includes(x.role)) || myRoles[0];
  return r ? r.siteId : '';
}
async function loadSitePlayers() {
  const siteId = roleSite(['owner', 'moderator']);
  const r = await fetch(B + '/sites/' + encodeURIComponent(siteId) + '/players');
  if (!r.ok) return;
  const list = await r.json();
  document.getElementById('modPlayers').innerHTML = list.map(p => `
    <div class="row-between">
      <span>${p.pseudoMasked ? '##;-)##' : (p.pseudo || p.playerRef).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</span>
      <button class="ghost u-wauto u-padding-4px-12px u-fs13"
        ${act('toggleMask', p.playerRef, !p.pseudoMasked)}>
        ${p.pseudoMasked ? T('retablir') : '🚫 Masquer'}</button>
    </div>`).join('') || T('aucun_joueur_connu_dans_cette_salle');
}
async function toggleMask(playerRef, masked) {
  const siteId = roleSite(['owner', 'moderator']);
  await fetch(B + '/sites/' + encodeURIComponent(siteId) + '/moderate/pseudo', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ playerRef, masked }) });
  loadSitePlayers();
}
async function announceEvent() {
  const siteId = roleSite(['owner', 'organizer']);
  const when = document.getElementById('evtWhen').value;
  const r = await fetch(B + '/sites/' + encodeURIComponent(siteId) + '/events/announce', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      title: document.getElementById('evtTitle').value,
      game: document.getElementById('evtGame').value,
      startsAt: when ? new Date(when).toISOString() : null }) });
  const d = await r.json().catch(() => ({}));
  document.getElementById('evtOut').textContent = r.ok
    ? T('annonce_les_suiveurs_de_la_salle_sont_') : (d.error || 'Erreur.');
  if (r.ok) document.getElementById('evtTitle').value = '';
}
function refreshRaSession() {
  try {
    const ra = JSON.parse(localStorage.getItem('nlc.ra') || 'null');
    document.getElementById('raSessOut').textContent = ra && ra.u
      ? T('ra_actif_sur_ce_telephone', { compte: ra.u })
      : '';
    if (ra && ra.u) document.getElementById('raSessUser').value = ra.u;
  } catch {}
}
function saveRaSession() {
  const u = document.getElementById('raSessUser').value.trim();
  const p = document.getElementById('raSessPass').value;
  if (!u || !p) { document.getElementById('raSessOut').textContent = T('pseudo_et_mot_de_passe_ra_requis'); return; }
  try { localStorage.setItem('nlc.ra', JSON.stringify({ u, p })); } catch {}
  document.getElementById('raSessPass').value = '';
  refreshRaSession();
}
function clearRaSession() {
  try { localStorage.removeItem('nlc.ra'); } catch {}
  document.getElementById('raSessUser').value = '';
  document.getElementById('raSessOut').textContent = T('retire_de_ce_telephone');
}
refreshRaSession();
function linkTwitch() { location = B + '/auth/twitch?return=/account'; }
// Le tirage du jour : une VARIATION de son propre avatar, dessinee par le meme moteur que la
// tete. Le site garde le candidat : recharger la page le remontre tant qu'il n'est pas tranche.
async function avatarDuJour() {
  if (!window.NelfeAvatar) return;
  try {
    const id = await NelfeAvatar.moi();
    if (id.roll && id.roll.candidate != null) showCandidate(id.roll.candidate);
  } catch {}
}
async function showCandidate(variation) {
  if (!window.NelfeAvatar) return;
  try {
    const id = await NelfeAvatar.moi();
    // Sous un titre de champion, le tirage joue sur l'avatar PROPRE : c'est lui qui revient.
    const propre = id.own || id;
    document.getElementById('candidateBox').classList.remove('u-hide');
    NelfeAvatar.poser(document.getElementById('candidateImg'), { pseudo: propre.pseudo, family: propre.family, variation });
  } catch {}
}
async function avatarPost(route) {
  try {
    const r = await fetch('/api/v1/avatar/' + route, { method: 'POST', credentials: 'same-origin' });
    return await r.json();
  } catch { return {}; }
}
async function rollAvatar() {
  const out = document.getElementById('avatarOut');
  const d = await avatarPost('roll');
  if (d.ok) {
    showCandidate(d.candidate);
    out.textContent = T('nouveau_tirage_adoptez_le_ou_gardez_l_');
  } else if (d.error === 'already_rolled') {
    out.textContent = T('deja_tire_aujourd_hui');
    if (d.candidate != null) showCandidate(d.candidate);
  } else {
    out.textContent = T('tirage_indisponible');
  }
}
async function applyAvatar() {
  const out = document.getElementById('avatarOut');
  const d = await avatarPost('adopt');
  if (!d.ok) { out.textContent = T('tirage_indisponible'); return; }
  document.getElementById('candidateBox').classList.add('u-hide');
  out.textContent = T('avatar_adopte');
  // L'identite a change : la tete partout, puis l'index et la borne, sans geste de plus.
  NelfeAvatar.oublierMoi();
  poserTetes();
  NelfeAvatar.synchroniser().catch(() => {});
}
function keepAvatar() {
  document.getElementById('candidateBox').classList.add('u-hide');
  document.getElementById('avatarOut').textContent = T('avatar_actuel_conserve');
  avatarPost('keep');
}

// Adopter (ou rendre) l'avatar d'un jeu dont on est champion du monde. Le titre se decide sur
// la plateforme, qui sait qui detient quel record ; le site relit ensuite sa carte, parce que la
// foule et les classements lisent la copie d'ici. load() redessine les tuiles et les tetes.
async function pickGameAvatar(gameKey) {
  const r = await fetch(B + '/account/avatar/game', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameKey })
  });
  const d = await r.json();
  if (d.error) { document.getElementById('avatarOut').textContent = d.error; return; }
  await avatarPost('refresh');
  if (window.NelfeAvatar) {
    NelfeAvatar.oublierMoi();
    NelfeAvatar.synchroniser().catch(() => {});
  }
  load(); // rafraîchit le cadre « ✓ porté » et les têtes
}

// Les avatars de JEUX, tels que le site les donne : graine (la cle du jeu), famille du jeu et
// couleurs du logo. Gardes pour la page : une gamelist revient souvent sur les memes jeux.
const avatarsDeJeux = {};
async function identitesDeJeux(cles) {
  const manquent = [...new Set(cles)].filter(k => k && !(k in avatarsDeJeux));
  for (let i = 0; i < manquent.length; i += 60) {
    const lot = manquent.slice(i, i + 60);
    try {
      const r = await fetch('/api/v1/avatar/games', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: lot })
      });
      const recus = (await r.json()).avatars || {};
      // Un jeu sans reponse est note quand meme : on ne le redemande pas a chaque liste.
      lot.forEach(k => { avatarsDeJeux[k] = recus[k] || null; });
    } catch {}
  }
  return avatarsDeJeux;
}

async function reconcilierAvatar(graine) {
  if (!window.NelfeAvatar) return;
  try {
    const id = await NelfeAvatar.moi();
    const porte = id.worn ? 'game:' + id.worn.game : '';
    const carte = /^game:/i.test(graine) ? graine : '';
    if (porte.toLowerCase() !== carte.toLowerCase()) {
      await avatarPost('refresh');
      NelfeAvatar.oublierMoi();
      poserTetes();
    }
  } catch {}
  // La borne suit l'avatar du compte depuis cette page aussi : une variation adoptee ou un
  // titre porte ici arrivent a la foule sans passer par /account.
  NelfeAvatar.synchroniser().catch(() => {});
}

async function poserTeteDeJeu(el, cle) {
  if (!el || !cle || !window.NelfeAvatar) return;
  const ids = await identitesDeJeux([cle]);
  if (ids[cle]) NelfeAvatar.poser(el, ids[cle]);
}

async function poserTetesDeJeux(elements) {
  if (!window.NelfeAvatar || !elements.length) return;
  const ids = await identitesDeJeux(elements.map(el => el.dataset.nelfeGameHead));
  elements.forEach(el => { const id = ids[el.dataset.nelfeGameHead]; if (id) NelfeAvatar.poser(el, id); });
}

// Toute icone de jeu rendue apres coup (gamelist, trophees, tuiles) recoit sa tete toute seule :
// on observe le document au lieu d'appeler le dessin apres chaque innerHTML, qu'on oublierait.
let tetesDeJeuxPrevues = false;
new MutationObserver(() => {
  if (tetesDeJeuxPrevues) return;
  tetesDeJeuxPrevues = true;
  requestAnimationFrame(() => {
    tetesDeJeuxPrevues = false;
    const neuves = [...document.querySelectorAll('[data-nelfe-game-head]:not([data-nelfe-game-posee])')];
    neuves.forEach(el => { el.dataset.nelfeGamePosee = '1'; });
    poserTetesDeJeux(neuves);
  });
}).observe(document.body, { childList: true, subtree: true });

// La tete du joueur sur la carte, la vue « moi » et l'onglet : son avatar du MOMENT, que le site
// connait (le sien ou le champion porte). Le module fait gagner le dernier appel.
function poserTetes() {
  if (!window.NelfeAvatar) return;
  ['cardAvatar', 'avatar', 'tabAvatar'].forEach(k => {
    const el = document.getElementById(k);
    if (el) NelfeAvatar.poser(el);
  });
}
function pseudoEdit() {
  document.getElementById('pseudoSave').classList.remove('u-hide');
  document.getElementById('pseudoWarn').classList.remove('u-hide');
}
async function savePseudo() {
  const p = document.getElementById('pseudo').value;
  const r = await fetch(B + '/account/profile', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ displayName: p }) });
  const d = await r.json();
  document.getElementById('pseudoOut').textContent = d.error ?? T('enregistre');
  if (!d.error) {
    document.getElementById('cardPseudo').textContent = p;
    document.getElementById('pseudoSave').classList.add('u-hide');
    document.getElementById('pseudoWarn').classList.add('u-hide');
    document.getElementById('pseudo').blur();
  }
}
async function linkRa() {
  const u = document.getElementById('raUser').value, k = document.getElementById('raKey').value;
  const r = await fetch(B + '/account/link/ra', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username: u, apiKey: k }) });
  const d = await r.json();
  document.getElementById('raOut').textContent = d.error ?? (T('lie') + d.username);
  if (r.ok) load();
}

// ── Notifications push (contest ouvert, tournoi ce soir, record battu) ──
function pushSupported() { return 'serviceWorker' in navigator && 'PushManager' in window; }
async function pushRegistration() {
  return navigator.serviceWorker.register(B + '/sw.js', { scope: B + '/' });
}
function b64ToU8(s) {
  const pad = '='.repeat((4 - s.length % 4) % 4);
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}
async function refreshPushUi() {
  if (!pushSupported()) {
    document.getElementById('pushBtn').classList.add('u-hide');
    document.getElementById('pushOut').textContent =
      T('notifications_non_prises_en_charge_par');
    return;
  }
  try {
    const reg = await navigator.serviceWorker.getRegistration(B + '/');
    const sub = reg && await reg.pushManager.getSubscription();
    document.getElementById('pushBtn').classList.toggle('u-hide', sub);
    document.getElementById('pushOffBtn').classList.toggle('u-hide', !(sub));
    if (sub) document.getElementById('pushOut').textContent = T('notifications_activees_sur_cet_apparei');
  } catch (e) {}
}
async function enablePush() {
  const out = document.getElementById('pushOut');
  try {
    if (!pushSupported()) return;
    if (await Notification.requestPermission() !== 'granted') {
      out.textContent = T('permission_refusee_autorisez_les_notif');
      return;
    }
    const reg = await pushRegistration();
    const vapid = await fetch(B + '/push/vapid').then(r => r.json());
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: b64ToU8(vapid.publicKey)
    });
    const json = sub.toJSON();
    const r = await fetch(B + '/account/push/subscribe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth })
    });
    out.textContent = r.ok ? T('notifications_activees_sur_cet_apparei') : T('erreur_cote_serveur_reessayez');
    refreshPushUi();
  } catch (e) {
    out.textContent = T('activation_impossible') + e.message;
  }
}
async function disablePush() {
  try {
    const reg = await navigator.serviceWorker.getRegistration(B + '/');
    const sub = reg && await reg.pushManager.getSubscription();
    if (sub) {
      await fetch(B + '/account/push/unsubscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint })
      });
      await sub.unsubscribe();
    }
    document.getElementById('pushOut').textContent = T('notifications_desactivees_sur_cet_appa');
    refreshPushUi();
  } catch (e) {}
}
refreshPushUi();

// ── Cartouche challenge en direct sur la card ──────────────────────────────
// Source : la salle de la session borne (nlc.cabsession), sinon les salles
// suivies - l'état est relayé par le hub toutes les ~3 s.
let chSites = [];
function chRefreshSites() {
  const s = new Set();
  try { const cab = JSON.parse(localStorage.getItem('nlc.cabsession') || 'null'); if (cab?.site) s.add(cab.site); } catch (e) {}
  (window.__followedSites || []).forEach(x => s.add(x));
  chSites = [...s].slice(0, 4);
}
function chFmt(sec) {
  sec = Math.max(0, Math.ceil(sec));
  return sec >= 60 ? Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0') : String(sec);
}
let chLast = null;
let chSite = null;
async function chPoll() {
  chRefreshSites();
  let ch = null, site = null;
  for (const s of chSites) {
    try {
      const r = await fetch(B + '/sites/' + encodeURIComponent(s) + '/challenge');
      if (r.ok) { ch = await r.json(); site = s; break; }
    } catch (e) {}
  }
  const box = document.getElementById('challengeCard');
  if (!ch) { box.classList.add('u-hide'); return; }
  chLast = ch; chSite = site;
  box.classList.remove('u-hide');
  document.getElementById('chGame').textContent = ch.game || 'Challenge';
  document.getElementById('chObjective').textContent = ch.objectiveText ||
    (ch.race ? T('le_premier_a', { cible: ch.race.target,
        signal: (ch.race.signal || '').toLowerCase().replaceAll('_', ' ') }) : '');
  document.getElementById('chConditions').textContent = ch.conditionsText ? '🔒 ' + ch.conditionsText : '';
  const now = Date.now();
  const kick = ch.kickoffAtUtc ? new Date(ch.kickoffAtUtc).getTime() : null;
  const start = ch.startedAtUtc ? new Date(ch.startedAtUtc).getTime() : null;
  const ends = ch.endsAtUtc ? new Date(ch.endsAtUtc).getTime() : null;
  // Déjà identifié sur une borne ? On ne lui demande plus de scanner.
  let onCab = null;
  try { onCab = (JSON.parse(localStorage.getItem('nlc.cabsession') || 'null'))?.cabinet ?? null; } catch (e) {}
  let phase;
  if (ch.status === 'finished') {
    phase = ch.counted === false
      ? T('termine_pas_assez_de_participants_reel')
      : T('termine');
  }
  else if (ch.status === 'waiting' && kick && kick > now) phase = onCab
    ? T('ouverture_sur_borne', { delai: chFmt((kick - now) / 1000), borne: onCab })
    : T('ouverture_sans_borne', { delai: chFmt((kick - now) / 1000) });
  else if (ch.status === 'waiting') phase = T('appuyez_sur_start_puis_ne_touchez_plus');
  else if (ch.status === 'running' && start && start > now) phase = T('depart_dans', { delai: chFmt((start - now) / 1000) });
  else if (ch.status === 'running' && ends) phase = T('temps_restant', { delai: chFmt((ends - now) / 1000) });
  else phase = T('en_cours_bonne_chance');
  document.getElementById('chPhase').textContent = phase;
  renderPlayChallenge(ch); // même état, repris sur le second écran
  document.getElementById('chTopBtn').classList.toggle('u-hide', !(ch.status === 'finished' && ch.counted !== false));
  if (ch.status !== 'finished') document.getElementById('chTop').classList.add('u-hide');
}
setInterval(chPoll, 3000);
chPoll();

// ── scanner de borne ────────────────────────────────────────────────────────
// Le QR de la borne porte l'URL de check-in de CE site : on la décode ici
// (BarcodeDetector, natif Android/Chrome) et on y va sans quitter l'app.
// Sur un navigateur sans l'API (iOS), l'appareil photo du téléphone détecte
// le QR tout seul - on le dit plutôt que d'embarquer un décodeur.
let scanStream = null, scanTimer = null;
// Le scanner prend la PLACE de la carte : on masque la carte et ce qui
// l'entoure, on la restaure à la fermeture.
const SCAN_HIDDEN = ['cardVisual', 'challengeCard', 'scanRow', 'cardEvents', 'installRow', 'iosHint'];
function scanChrome(hidden) {
  SCAN_HIDDEN.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    // On retient si l'élément était DÉJÀ caché pour une autre raison : le
    // rendre visible à la fermeture du scanner montrerait un bloc qui n'avait
    // rien à faire là. C'est ce que la sauvegarde du display faisait avant.
    if (hidden) {
      el.dataset.scanCache = el.classList.contains('u-hide') ? '1' : '';
      el.classList.add('u-hide');
    } else if (!el.dataset.scanCache) {
      el.classList.remove('u-hide');
    }
  });
}
async function openScanner() {
  // Le scanner vit dans la vue Carte : si on l'ouvre depuis un autre onglet
  // (loupe de la Gamelist…), on bascule d'abord dessus, sinon il est invisible.
  if (!document.getElementById('v-card').classList.contains('on')) {
    const cardTab = document.querySelector('#tabs button[data-v="card"]');
    if (cardTab) cardTab.click();
  }
  const box = document.getElementById('scanner');
  const msg = document.getElementById('scanMsg');
  if (!('BarcodeDetector' in window)) {
    alert(T('qr_non_lisible'));
    return;
  }
  scanChrome(true);
  box.classList.remove('u-hide');
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  } catch (e) {
    msg.textContent = T('camera_refusee_autorisez_l_acces_ou_vi');
    return;
  }
  const video = document.getElementById('scanVideo');
  video.srcObject = scanStream;
  await video.play();
  const detector = new BarcodeDetector({ formats: ['qr_code'] });
  scanTimer = setInterval(async () => {
    let codes = [];
    try { codes = await detector.detect(video); } catch (e) { return; }
    for (const code of codes) {
      // On ne suit QUE nos propres URLs de check-in : un QR quelconque
      // (affiche, autre commerce) ne doit jamais emmener ailleurs.
      let url = null;
      try { url = new URL(code.rawValue, location.href); } catch (e) { continue; }
      // Nos hotes CONNUS, liste fermee. La garde d'origine servait a ne
      // jamais suivre le QR d'une affiche ou d'un autre commerce ; cette
      // raison tient toujours, mais l'origine exacte ne suffit plus depuis
      // que la page joueur a demenage et que les autocollants portent
      // encore l'ancienne adresse.
      const NOTRE = ['nelfeplay.com', 'www.nelfeplay.com',
                     'nelfetech.com', 'www.nelfetech.com'];
      if (!NOTRE.includes(url.hostname) || !url.pathname.includes('/checkin')) {
        msg.textContent = T('ce_qr_n_est_pas_celui_d_une_borne_nelf');
        continue;
      }
      closeScanner();
      // Un QR d'un ancien hote mene au pointage LOCAL : le joueur reste la ou
      // il est connecte, avec la borne que le QR designe.
      location.href = url.origin === location.origin
        ? url.href
        : B + '/checkin' + url.search;
      return;
    }
  }, 350);
}
function closeScanner() {
  if (scanTimer) { clearInterval(scanTimer); scanTimer = null; }
  if (scanStream) { scanStream.getTracks().forEach(t => t.stop()); scanStream = null; }
  const box = document.getElementById('scanner');
  if (box.classList.contains('u-hide')) return; // déjà fermé : ne rien restaurer
  box.classList.add('u-hide');
  scanChrome(false);
  document.getElementById('scanRow').classList.toggle('u-hide', cabSession());
}
// Une session de borne ouverte ? Le scan ne sert plus qu'à en changer.
window.addEventListener('pagehide', closeScanner);

// Top 10 du jeu du challenge (scores vérifiés de la salle).
async function chShowTop() {
  if (!chLast || !chSite) return;
  const box = document.getElementById('chTop');
  box.classList.remove('u-hide');
  box.innerHTML = `<span class="hint">${T('chargement')}</span>`;
  try {
    const d = await (await fetch(B + '/rankings/data?scope=site&value=' + encodeURIComponent(chSite))).json();
    const slug = (chLast.game || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const rows = (d.rows || []).filter(r => r.gameKey && r.gameKey.toLowerCase().includes(slug)).slice(0, 10);
    box.innerHTML = rows.length
      ? rows.map((r, i) => `<div class="row-between-tight">
          <span>${['🥇','🥈','🥉'][i] ?? '#' + (i + 1)} <b>${esc(r.player)}</b></span>
          <span class="u-font-variant-numeric-tabular-nums">${(r.value ?? 0).toLocaleString('fr-FR')}</span></div>`).join('')
      : `<span class="hint">${T('pas_encore_de_score_enregistre_sur_ce_')}</span>`;
  } catch (e) { box.innerHTML = `<span class="hint">${T('classement_indisponible')}</span>`; }
}

load().then(() => { try { consumeBrowseReturn(); } catch {} });

/* ── Delegation des gestionnaires ──────────────────────────────────────────
 *
 * Les 40 attributs onclick du balisage sont devenus des data-action. Un seul
 * ecouteur par evenement les sert, ce qui permet a la page de vivre sous une
 * politique de securite stricte : plus une ligne de code dans le balisage.
 *
 * Les fonctions restent globales - ce fichier n'est pas un module - donc
 * accessibles par leur nom. Une faute de frappe dans un data-action ne casse
 * rien de visible : on l'ecrit dans la console plutot que d'echouer en
 * silence.
 */
(() => {
  const call = (el, attribute, event) => {
    const name = el.dataset[attribute];
    const fn = window[name];
    if (typeof fn !== 'function') {
      console.warn('data-' + attribute + T('inconnu'), name);
      return;
    }

    // data-args : liste JSON, donc TYPEE - un numero reste un nombre, un
    // booleen reste un booleen. SELF y marque la place de l'element.
    if (el.dataset.args !== undefined) {
      let args;
      try {
        args = JSON.parse(el.dataset.args);
      } catch {
        console.warn(T('data_args_illisible_sur'), name);
        return;
      }
      fn(...args.map((a) => (a === SELF ? el : a)), event);
      return;
    }

    // Les formes simples du balisage.
    if (el.dataset.from !== undefined) {
      const source = document.getElementById(el.dataset.from);
      fn(el.dataset.arg, source ? source.value : '');
    } else if (el.dataset.self !== undefined) {
      fn(el, event);
    } else if (el.dataset.arg !== undefined) {
      fn(el.dataset.arg);
    } else {
      fn(el, event);
    }
  };

  document.addEventListener('click', (event) => {
    const el = event.target.closest('[data-action]');
    if (!el) return;
    // « return false » de l'ancien attribut : empechait le lien de suivre.
    if (el.dataset.prevent !== undefined) event.preventDefault();
    call(el, 'action', event);
  });

  for (const [event, attribute] of [['input', 'input'], ['change', 'change'], ['focus', 'focus']]) {
    document.addEventListener(event, (e) => {
      const el = e.target.closest ? e.target.closest('[data-' + attribute + ']') : null;
      if (el) call(el, attribute, e);
    }, true); // capture : focus et input ne remontent pas partout
  }
})();
