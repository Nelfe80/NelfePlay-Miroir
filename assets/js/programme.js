/* ── Programmation du scoring certifie ─────────────────────────────────────
   Trois choses, toutes facultatives : la page marche sans elles.
   1. Le verre bombe des ecrans : la carte de deplacement du filtre SVG se
      calcule ici, une fois, dans un petit canevas.
   2. L'apparition des ecrans au defilement.
   3. Le vote sans rechargement : le formulaire part en JSON, et la reponse
      rend un jeton neuf, le precedent etant a usage unique. */
(() => {
    'use strict';

    const racine = document.querySelector('[data-prog]');
    if (!racine) return;

    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* 1. Le verre bombe. Le rouge pousse en x, le vert en y ; 128 ne bouge
       rien. Chaque point part vers l'exterieur d'autant plus qu'il est loin du
       centre sur l'AUTRE axe : c'est la courbure d'un tube, et les coins
       tombent hors de l'image, donc dans le noir du cadre. */
    const carte = document.getElementById('prog-bombe-carte');
    if (carte) {
        try {
            const cote = 96;
            const toile = document.createElement('canvas');
            toile.width = cote;
            toile.height = cote;
            const ctx = toile.getContext('2d');
            const pixels = ctx.createImageData(cote, cote);
            for (let y = 0; y < cote; y++) {
                const v = (y / (cote - 1)) * 2 - 1;
                for (let x = 0; x < cote; x++) {
                    const u = (x / (cote - 1)) * 2 - 1;
                    const i = (y * cote + x) * 4;
                    pixels.data[i] = Math.round(128 + u * v * v * 127);
                    pixels.data[i + 1] = Math.round(128 + v * u * u * 127);
                    pixels.data[i + 2] = 128;
                    pixels.data[i + 3] = 255;
                }
            }
            ctx.putImageData(pixels, 0, 0);
            const adresse = toile.toDataURL('image/png');
            carte.setAttribute('href', adresse);
            carte.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', adresse);
            racine.classList.add('prog-bombe');
        } catch (erreur) {
            // Ecrans plats : ils gardent leurs coins, leurs lignes et leur reflet.
        }
    }

    const grille = racine.querySelector('.prog-grid');

    /* 2. La grille s'agrandit vers le bas. Deux pages de trois sur trois d'abord ; chaque
       approche du bas en ajoute une rangee, et ses images ne se chargent qu'a ce moment-la
       (une tuile cachee ne demande pas son image). Sans script, tout est la d'emblee. */
    const tuiles = [...racine.querySelectorAll('.prog-tile')];
    const colonnes = () => (window.matchMedia('(max-width: 640px)').matches ? 2 : 3);
    const anime = !reduit && 'IntersectionObserver' in window;
    let apparition = null;
    if (anime && tuiles.length > 0) {
        racine.classList.add('prog-anim');
        apparition = new IntersectionObserver((entrees) => {
            entrees.forEach((entree) => {
                if (!entree.isIntersecting) return;
                const tuile = entree.target;
                // Un leger decalage par colonne : la rangee se leve de gauche a droite.
                const colonne = tuiles.indexOf(tuile) % colonnes();
                window.setTimeout(() => tuile.classList.add('is-seen'), colonne * 70);
                apparition.unobserve(tuile);
            });
        }, { rootMargin: '0px 0px -4% 0px' });
    }
    const montrer = (tuile) => {
        tuile.hidden = false;
        if (apparition) apparition.observe(tuile);
    };

    /* Un lien vers un ecran precis (/programmation#shinobi, depuis l'accueil) : la mosaique est
       brassee, l'ecran vise peut etre loin dans la page. Tout se montre d'emblee, sans le
       chargement par rangees qui cacherait l'ecran vise : le navigateur s'y pose lui-meme. */
    let visee = null;
    try {
        visee = window.location.hash ? document.getElementById(decodeURIComponent(window.location.hash.slice(1))) : null;
    } catch (erreur) {
        visee = null;
    }
    if (visee && !visee.classList.contains('prog-tile')) visee = null;

    const depart = 18;
    if (visee) {
        tuiles.forEach(montrer);
        visee.classList.add('is-seen');
    } else if ('IntersectionObserver' in window && grille && tuiles.length > depart) {
        tuiles.forEach((tuile, i) => {
            if (i < depart) montrer(tuile);
            else tuile.hidden = true;
        });
        let montrees = depart;
        const sentinelle = document.createElement('div');
        sentinelle.className = 'prog-more';
        sentinelle.setAttribute('aria-hidden', 'true');
        grille.after(sentinelle);
        const suite = new IntersectionObserver((entrees) => {
            if (!entrees.some((e) => e.isIntersecting)) return;
            // Une rangee a la fois : la grille pousse, elle ne deborde pas.
            const fin = Math.min(tuiles.length, montrees + colonnes());
            for (; montrees < fin; montrees++) montrer(tuiles[montrees]);
            if (montrees >= tuiles.length) {
                suite.disconnect();
                sentinelle.remove();
            } else {
                // La sentinelle reste visible si la rangee ajoutee ne l'a pas repoussee : on
                // la reobserve pour que la suivante vienne aussi.
                suite.unobserve(sentinelle);
                window.requestAnimationFrame(() => suite.observe(sentinelle));
            }
        }, { rootMargin: '0px 0px 240px 0px' });
        suite.observe(sentinelle);
    } else {
        tuiles.forEach(montrer);
    }

    /* L'ecran grandit de moitie au survol, vers l'interieur de la page : l'origine suit la colonne (bord
       gauche, centre, bord droit) et la hauteur dans la fenetre (tiers haut, milieu, bas), pour
       qu'il ne deborde ni de la grille ni de l'ecran. Seulement avec une souris : au doigt, le
       survol n'existe pas et le toucher vote. */
    const souris = window.matchMedia('(hover: hover) and (pointer: fine)');
    const etroit = window.matchMedia('(max-width: 640px)');
    const haut = (element) => {
        // La position de MISE EN PAGE : un ecran en train de revenir fausserait son rectangle.
        let y = 0;
        for (let n = element; n; n = n.offsetParent) y += n.offsetTop;
        return y - window.scrollY;
    };
    const agrandir = (tuile) => {
        if (!souris.matches || etroit.matches || !grille) return;
        // La colonne se lit a la position de la tuile dans la grille (positionnee en CSS), pas a
        // son rang : un ecran cache ou deplace ne la fausse pas.
        const ecart = parseFloat(getComputedStyle(grille).columnGap) || 0;
        const colonne = Math.round(tuile.offsetLeft / (tuile.offsetWidth + ecart));
        const x = colonne <= 0 ? 'left' : (colonne >= colonnes() - 1 ? 'right' : 'center');
        const milieu = haut(tuile) + tuile.offsetHeight / 2;
        const fenetre = window.innerHeight;
        const y = milieu < fenetre / 3 ? 'top' : (milieu > fenetre * 2 / 3 ? 'bottom' : 'center');
        tuile.style.transformOrigin = x + ' ' + y;
        tuile.classList.add('is-zoomed');
    };
    tuiles.forEach((tuile) => {
        tuile.addEventListener('mouseenter', () => agrandir(tuile));
        tuile.addEventListener('mouseleave', () => tuile.classList.remove('is-zoomed'));
        tuile.addEventListener('focusin', () => agrandir(tuile));
        tuile.addEventListener('focusout', () => tuile.classList.remove('is-zoomed'));
    });

    /* 3. Le vote. */
    const formulaire = document.getElementById('prog-vote');
    const jeton = formulaire ? formulaire.querySelector('input[name="_token"]') : null;
    const statut = racine.querySelector('[data-prog-status]');
    const bulletin = racine.querySelector('[data-prog-ballot]');
    const reste = racine.querySelector('[data-prog-left]');
    const texte = (cle) => racine.getAttribute('data-' + cle) || '';
    const compter = (modele, n) => modele.replace(':count', String(n));

    const dire = (message) => {
        if (statut) statut.textContent = message;
    };

    /* Le gros chiffre de l'ecran : une case par chiffre, dessinee par la feuille de style. Rien pour
       un jeu sans voix : la case vide se cache. */
    const poserChiffres = (cible, voix) => {
        const n = Math.max(0, Math.round(Number(voix) || 0));
        cible.replaceChildren(...(n === 0 ? [] : [...String(n)].map((chiffre) => {
            const c = document.createElement('i');
            c.className = 'pd pd-' + chiffre;
            return c;
        })));
    };

    const majBulletin = (restants) => {
        if (!bulletin) return;
        const quota = Number(bulletin.getAttribute('data-allowance') || 5);
        bulletin.querySelectorAll('.prog-tv').forEach((tele, i) => {
            const utilise = i < quota - restants;
            if (utilise !== tele.classList.contains('is-used')) {
                tele.classList.toggle('is-used', utilise);
                tele.classList.add('is-pulse');
                window.setTimeout(() => tele.classList.remove('is-pulse'), 220);
            }
        });
        if (reste) reste.textContent = compter(texte('label-left'), restants);
    };

    racine.addEventListener('click', async (evenement) => {
        // Le bouton de vote seulement : l'ecran d'un jeu ouvert est un lien vers son classement.
        const bouton = evenement.target.closest('button.prog-hit');
        if (!bouton || !formulaire || !jeton || !window.fetch) return;
        evenement.preventDefault();
        if (bouton.disabled) return;

        const tuile = bouton.closest('.prog-tile');
        bouton.disabled = true;
        dire('');

        const donnees = new FormData();
        donnees.append('_token', jeton.value);
        donnees.append('game', bouton.value);

        try {
            const reponse = await fetch(formulaire.action, {
                method: 'POST',
                body: donnees,
                credentials: 'same-origin',
                headers: { Accept: 'application/json' },
            });
            const corps = await reponse.json();
            if (corps.token) jeton.value = corps.token;

            if (reponse.status === 401 && corps.login) {
                window.location.href = corps.login;
                return;
            }
            if (!corps.ok) {
                dire(corps.error === 'quota' ? texte('msg-quota')
                    : corps.error === 'closed' ? texte('msg-closed')
                        : texte('msg-error'));
                if (tuile && !reduit) {
                    tuile.classList.remove('is-refused');
                    void tuile.offsetWidth;
                    tuile.classList.add('is-refused');
                }
                return;
            }

            // Un ecran, son etat de vote et son compteur.
            const marquer = (ecran, cible, vote, voix) => {
                if (!ecran || !cible) return;
                ecran.classList.toggle('is-mine', vote);
                const nombre = ecran.querySelector('[data-prog-count]');
                if (nombre) nombre.textContent = compter(texte('label-votes'), voix);
                const grand = ecran.querySelector('[data-prog-big]');
                if (grand) poserChiffres(grand, voix);
                const libelle = vote ? texte('label-unvote') : texte('label-vote');
                cible.setAttribute('aria-pressed', vote ? 'true' : 'false');
                const titre = ecran.querySelector('.prog-info strong')?.textContent || '';
                cible.setAttribute('aria-label', libelle + ' : ' + titre);
                const etiquette = cible.querySelector('.prog-hit-label');
                if (etiquette) etiquette.textContent = libelle;
            };

            marquer(tuile, bouton, Boolean(corps.voted), Number(corps.votes || 0));
            // Le vote a quitte un autre jeu : cet ecran-la perd sa marque et une voix.
            if (corps.moved_from) {
                const ancien = [...racine.querySelectorAll('button.prog-hit')].find((b) => b.value === corps.moved_from);
                if (ancien) marquer(ancien.closest('.prog-tile'), ancien, false, Number(corps.moved_votes || 0));
            }
            majBulletin(Number(corps.remaining ?? 0));
        } catch (erreur) {
            dire(texte('msg-error'));
        } finally {
            bouton.disabled = false;
        }
    });
})();
