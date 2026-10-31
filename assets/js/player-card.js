/**
 * Carte joueur publique.
 *
 * Fichier statique, commun aux six langues : les deux phrases que ce script
 * peut poser lui arrivent en attributs, depuis le gabarit qui les a traduites.
 * C'est ce qui permet à NelfePlay de servir sous `script-src 'self'` sans
 * exception ni code en ligne.
 *
 * Les données viennent du relais, même origine.
 */
(() => {
    'use strict';

    const config = document.getElementById('card-config');
    if (!config) {
        return;
    }

    const el = (id) => document.getElementById(id);
    const esc = (value) => String(value ?? '').replace(
        /[<>&]/g,
        (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c],
    );

    const dataSrc = config.dataset.src;
    const numberLocale = config.dataset.numberLocale || 'en-GB';
    // Chemin explicite : un relatif sortirait du périmètre relayé.
    const avatarBase = config.dataset.avatarBase;

    /** Somme d'un trophée, tous métaux confondus. */
    const total = (honor) => (honor ? honor.gold + honor.silver + honor.bronze : 0);

    (async () => {
        let response;
        try {
            response = await fetch(dataSrc);
        } catch {
            el('pseudo').textContent = config.dataset.unknown;
            return;
        }

        if (!response.ok) {
            // Carte de compte : on renvoie le joueur chez lui plutôt que de lui
            // montrer une carte vide qu'il ne comprendrait pas.
            if (config.dataset.back) {
                location.href = config.dataset.back;
                return;
            }
            el('pseudo').textContent = config.dataset.unknown;
            return;
        }

        const d = await response.json();

        // L'avatar du MOMENT, que le site connait par le code du joueur ; l'ancienne image
        // reste posee dessous le temps de la reponse, et si le site ne connait pas ce code.
        el('avatar').src = avatarBase + encodeURIComponent(d.avatarSeed) +
            '.svg?c=' + (d.avatarColors || 1);
        el('avatar').alt = d.displayName || '';
        // Le code vient de la carte, sinon de l'adresse de ses donnees (.../players/<code>/data).
        avatarDuMoment(d.playerCode || (config.dataset.src || '').split('/').slice(-2, -1)[0] || '');
        el('pseudo').textContent = d.displayName;

        const honors = d.honors || {};
        const badges = [];
        if (total(honors.crowns)) badges.push('👑' + total(honors.crowns));
        if (total(honors.cups)) badges.push('🏆' + total(honors.cups));
        if (total(honors.medals)) badges.push('🏅' + total(honors.medals));
        if (total(honors.stars)) badges.push('⭐' + total(honors.stars));
        el('honors').textContent = badges.join('  ');

        // Un jeu ne compte qu'une fois, avec sa meilleure marque.
        const games = {};
        (d.records || []).forEach((record) => (record.scores || []).forEach((score) => {
            const key = score.gameKey;
            if (!games[key] || score.best > games[key].best) {
                games[key] = { name: score.label || score.gameName || key, best: score.best };
            }
        }));
        const ranked = Object.values(games).sort((a, b) => b.best - a.best);

        el('stScores').textContent = d.totalParties ?? d.totalScores ?? 0;
        // Les jeux joues sur NelfePlay et en salle, que la plateforme compte (2026-09-30) ;
        // les seuls records de salle laissaient « 0 » a un joueur de maison.
        el('stGames').textContent = d.totalGames ?? Object.keys(games).length;
        el('stTrophies').textContent = (honors.details || []).length;

        const medals = ['🥇', '🥈', '🥉'];
        const mondes = { home: '🎮', station: '🕹️', stream: '📺' };
        const chiffre = (n) => Number(n).toLocaleString(numberLocale);

        // Le palmarès certifié : il couvre les trois mondes et porte le rang.
        // Il vient de la charge utile déjà chargée, où l'amont l'a résolu.
        const certifies = Array.isArray(d.certifiedRecords) ? d.certifiedRecords.slice() : [];

        if (certifies.length) {
            // Les meilleurs scores d'abord, tous mondes confondus : c'est ce
            // qu'on montre quand on tend son téléphone.
            certifies.sort((a, b) => (b.score || 0) - (a.score || 0));
            el('top3').innerHTML = certifies.slice(0, 3).map((rec, index) => {
                const nom = String(rec.game || '')
                    .split(/[-_]+/)
                    .map((mot) => (mot ? mot[0].toUpperCase() + mot.slice(1) : ''))
                    .join(' ');
                const rang = rec.rank > 0
                    ? `<span class="r" title="${esc(config.dataset.worldRank)}">#${chiffre(rec.rank)}</span>`
                    : '';
                const dedans = `<span>${medals[index]}</span>`
                    + `<span class="g">${mondes[rec.context] || '🎮'} ${esc(nom)}</span>`
                    + rang
                    + `<span class="s">${chiffre(rec.score)}</span>`;
                // Chaque ligne mène à son certificat, quand il en existe un.
                return rec.permalink
                    ? `<a class="row" href="${esc(rec.permalink)}" target="_blank" rel="noopener">${dedans}</a>`
                    : `<div class="row">${dedans}</div>`;
            }).join('');
        } else {
            el('top3').innerHTML = ranked.slice(0, 3).map((game, index) =>
                `<div class="row"><span>${medals[index]}</span>` +
                `<span class="g">${esc(game.name)}</span>` +
                // Le score suit la langue : 1 234 567 en français, 1,234,567 ailleurs.
                `<span class="s">${chiffre(game.best)}</span></div>`,
            ).join('') ||
                `<div class="row"><span class="g muted">${esc(config.dataset.empty)}</span></div>`;
        }
    })();
})();

/* L'avatar du moment du joueur, dessine par le moteur du site a partir de l'identite que le
 * site tient pour ce code. Rien a faire si le moteur n'est pas la, ou si le code ne designe
 * aucun compte d'ici : la carte relayee garde alors son image. */
async function avatarDuMoment(code) {
    if (!code || !window.NelfeAvatar) { return; }
    try {
        const r = await fetch('/api/v1/avatar/of?code=' + encodeURIComponent(code));
        const d = await r.json();
        if (d && d.ok && d.identity) { window.NelfeAvatar.poser(document.getElementById('avatar'), d.identity); }
    } catch (_) {
        // Le site ne repond pas : l'image relayee reste, et c'est deja une carte.
    }
}
