/*
 * La Game Room : la regle d'un seul lecteur sur la home, le compteur, le catalogue de /games et la galerie d'une fiche.
 * Sans script, la home montre le fanart, /games sa liste de liens et la fiche sa premiere image.
 */
(() => {
    'use strict';

    const bouge = !matchMedia('(prefers-reduced-motion: reduce)').matches;

    // --- UN SEUL LECTEUR A LA FOIS. Un direct passe avant tout : la une garde son fanart. Sans direct, la video de la une
    // joue et NelfePlay TV attend un clic ; ce clic arrete la video.
    const fond = document.getElementById('gr-fond');
    const repos = document.getElementById('gr-tv-repos');
    const antenne = document.querySelector('.gr-direct [data-record-live]');
    if (fond) fond.style.setProperty('--ratio', fond.dataset.ratio || '1.3333');
    if (fond) {
        let lancee = false;
        const arreterFond = () => {
            if (fond) {
                fond.classList.remove('is-playing');
                fond.replaceChildren();
            }
        };
        const lancerFond = () => {
            const id = fond ? fond.dataset.youtube : '';
            if (!id || lancee || fond.firstChild || !bouge || matchMedia('(max-width: 1080px)').matches) return;
            const cadre = document.createElement('iframe');
            cadre.title = '';
            cadre.tabIndex = -1;
            cadre.allow = 'autoplay; encrypted-media';
            cadre.referrerPolicy = 'strict-origin-when-cross-origin';
            cadre.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?autoplay=1&mute=1&loop=1&playlist=' + encodeURIComponent(id)
                + '&controls=0&disablekb=1&fs=0&iv_load_policy=3&modestbranding=1&playsinline=1&rel=0&enablejsapi=1&origin=' + encodeURIComponent(location.origin);
            cadre.addEventListener('load', () => cadre.contentWindow.postMessage(JSON.stringify({ event: 'listening' }), 'https://www.youtube-nocookie.com'));
            fond.append(cadre);
        };
        addEventListener('message', (ev) => {
            if (ev.origin !== 'https://www.youtube-nocookie.com' || !fond || !fond.firstChild || ev.source !== fond.firstChild.contentWindow) return;
            let p;
            try {
                p = JSON.parse(ev.data);
            } catch (_) {
                return;
            }
            if (p.event === 'infoDelivery' && p.info && p.info.playerState === 1) {
                setTimeout(() => {
                    if (fond.firstChild) fond.classList.add('is-playing');
                }, 1500);
            }
        });
        const lancerAntenne = () => {
            if (lancee) return;
            if (!repos || !antenne) return;
            lancee = true;
            arreterFond();
            repos.hidden = true;
            const script = document.createElement('script');
            script.src = antenne.dataset.script;
            document.body.append(script);
        };
        const unDirect = async () => {
            if (!antenne) return false;
            try {
                const r = await fetch('/api/v1/lives/records', { headers: { Accept: 'application/json' }, cache: 'no-store' });
                const d = await r.json();
                return (d.lives || []).length + (d.shared || []).length > 0;
            } catch (_) {
                return false;
            }
        };
        const surveiller = async () => {
            if (await unDirect()) lancerAntenne();
            else lancerFond();
        };
        document.getElementById('gr-tv-lancer')?.addEventListener('click', lancerAntenne);
        surveiller();
        setInterval(() => {
            if (!lancee) surveiller();
        }, 30000);
    }

    // --- Le compteur monte jusqu'a sa valeur
    document.querySelectorAll('.gr-compteur [data-count-up]').forEach((el) => {
        if (!bouge) return;
        const cible = Number(el.dataset.countUp);
        const debut = performance.now();
        const langue = document.documentElement.lang || 'fr';
        const pas = (t) => {
            const p = Math.min(1, (t - debut) / 1600);
            el.textContent = Math.round(cible * (1 - Math.pow(1 - p, 3))).toLocaleString(langue);
            if (p < 1) requestAnimationFrame(pas);
        };
        requestAnimationFrame(pas);
    });

    // --- Le catalogue de /games
    const donnees = document.getElementById('gr-jeux');
    if (donnees) {
        const jeux = JSON.parse(donnees.textContent);
        const grille = document.getElementById('gr-grille');
        const compte = document.getElementById('gr-compte');
        const plus = document.getElementById('gr-plus');
        const recherche = document.getElementById('gr-q');
        const cases = Array.from(document.querySelectorAll('#gr-filtres input[type=checkbox][data-f]'));
        const seulement = document.getElementById('gr-nelfeplay');
        const onglets = Array.from(document.querySelectorAll('.gr-onglet'));
        const MODES = ['sc', 'sp', 'mr', 'ch', 'm'];
        // Les drapeaux qui filtrent sans etre un mode (09/11, Player Deck) : ni onglet, ni logo, ni « Compatible NelfePlay ».
        const DRAPEAUX = ['pd'];
        let montres = 24;
        const epoque = (a) => (a >= 2000 ? '2000' : a >= 1990 ? '90' : a > 0 ? '70-80' : '');
        const noeud = (balise, classe, texte) => {
            const n = document.createElement(balise);
            if (classe) n.className = classe;
            if (texte !== undefined) n.textContent = texte;
            return n;
        };
        const image = (classe, src) => {
            const i = noeud('img', classe);
            i.src = src;
            i.alt = '';
            i.loading = 'lazy';
            return i;
        };
        // UNE CARTE PAR TITRE (07/11) : `v` porte les versions du meme titre sur d'autres systemes. La carte montre la
        // version arcade, sinon la plus ancienne ; un filtre de mode ou de machine montre la version qui y repond.
        const versions = (j) => [j, ...(j.v || [])];
        const aussi = grille.dataset.aussi || ':system';
        const carte = ({ montre: j, autres }) => {
            const a = noeud('a', 'gr-carte');
            a.href = j.u;
            const visuel = noeud('span', 'gr-carte-visuel');
            if (j.f) {
                visuel.append(image('fond', j.f));
                if (j.l) visuel.append(image('logo', j.l));
            } else if (j.b) {
                visuel.append(image('boite', j.b));
            } else if (j.i) {
                visuel.append(image('fond', j.i));
            } else {
                visuel.append(noeud('span', 'nom', j.t));
            }
            const texte = noeud('span', 'gr-carte-texte');
            const titre = noeud('b', '', j.t);
            titre.translate = false;
            texte.append(titre, noeud('span', '', j.n + (j.a ? ' · ' + j.a : '')));
            a.append(visuel, texte);
            if (!autres.length) return a;
            // Les liens vers les autres versions ne peuvent pas vivre dans le lien de la carte : la carte les porte a cote.
            const bloc = noeud('div', 'gr-carte-bloc');
            const pastilles = noeud('span', 'gr-aussi');
            autres.forEach((x) => {
                const p = noeud('a', '', aussi.replace(':system', x.n));
                p.href = x.u;
                pastilles.append(p);
            });
            bloc.append(a, pastilles);
            return bloc;
        };
        // La valeur d'un jeu pour un sous-filtre (07/11) : epoque, genre, machine.
        const valeur = (j, f) => (f === 'e' ? epoque(j.a) : f === 'g' ? j.g : f === 'y' ? j.y : '');
        const dessiner = () => {
            const coches = {};
            cases.filter((c) => c.checked).forEach((c) => (coches[c.dataset.f] ||= []).push(c.value));
            const mot = recherche.value.trim().toLowerCase();
            // LE MODE EST LE FILTRE PRINCIPAL (07/11) : la base, puis les sous-filtres dans l'ordre epoques, genres, machines ;
            // chacun ne montre que ce qui existe apres ceux d'avant, avec ses nombres recomptes.
            // Une carte regroupee repond si l'une de ses versions repond (07/11).
            const modeOk = (x) => [...MODES, ...DRAPEAUX].every((m) => !coches[m] || x[m]);
            const sousOk = (x, filtres) => filtres.every((f) => !coches[f] || coches[f].includes(valeur(x, f)));
            const base = jeux.filter((j) => (!mot || versions(j).some((x) => (x.t + ' ' + x.n + ' ' + x.d).toLowerCase().includes(mot)))
                && versions(j).some(modeOk) && (!seulement || !seulement.checked || versions(j).some((x) => MODES.some((m) => x[m]))));
            let reste = base;
            const faits = [];
            ['e', 'g', 'y'].forEach((f) => {
                const nombres = {};
                reste.forEach((j) => {
                    new Set(versions(j).filter((x) => modeOk(x) && sousOk(x, faits)).map((x) => valeur(x, f)))
                        .forEach((v) => { nombres[v] = (nombres[v] || 0) + 1; });
                });
                cases.filter((c) => c.dataset.f === f).forEach((c) => {
                    const n = nombres[c.value] || 0;
                    const libelle = c.closest('label');
                    libelle.hidden = n === 0 && !c.checked;
                    const em = libelle.querySelector('em');
                    if (em) em.textContent = String(n);
                });
                faits.push(f);
                if (coches[f]) reste = reste.filter((j) => versions(j).some((x) => modeOk(x) && sousOk(x, faits)));
            });
            // La version montree : la premiere (arcade, sinon la plus ancienne) qui repond a tous les filtres.
            const garde = reste.map((j) => {
                const vs = versions(j);
                const montre = vs.find((x) => modeOk(x) && sousOk(x, faits)) || j;
                return { montre, autres: vs.filter((x) => x !== montre) };
            });
            compte.textContent = compte.dataset.unite.replace(':n', garde.length);
            grille.replaceChildren(...garde.slice(0, montres).map(carte));
            plus.hidden = garde.length <= montres;
            const actifs = MODES.filter((m) => coches[m]);
            // Une vue sur un seul mode porte le logo de l'API (07/11) ; le titre reste lu par les lecteurs d'ecran.
            const logo = document.getElementById('gr-logo-mode');
            const mode = actifs.length === 1 ? actifs[0] : '';
            const source = mode ? logo.getAttribute('data-logo-' + mode) : null;
            if (source) {
                logo.src = source;
                logo.alt = logo.getAttribute('data-alt-' + mode) || '';
            }
            logo.hidden = !source;
            document.getElementById('gr-titre-page').classList.toggle('sr-only', Boolean(source));
            // Le mode filtre mene a son explication ; la vue Scoring montre le vote du prochain jeu (07/11).
            const comment = document.getElementById('gr-comment');
            const cible = mode ? comment.getAttribute('data-lien-' + mode) : null;
            if (cible) comment.href = cible;
            comment.hidden = !cible;
            document.getElementById('gr-vote').hidden = mode !== 'sc';
            onglets.forEach((o) => o.classList.toggle('is-active', actifs.length === 1 ? o.dataset.mode === actifs[0] : actifs.length === 0 && o.dataset.mode === ''));
        };
        new URLSearchParams(location.search).forEach((v, k) => cases.forEach((c) => {
            if (c.dataset.f === k && c.value === v) c.checked = true;
        }));
        document.getElementById('gr-filtres').addEventListener('submit', (ev) => ev.preventDefault());
        if (seulement && new URLSearchParams(location.search).get('tout') === '1') seulement.checked = false;
        [...cases, recherche, ...(seulement ? [seulement] : [])].forEach((c) => c.addEventListener('input', () => {
            montres = 24;
            dessiner();
        }));
        plus.addEventListener('click', () => {
            montres += 24;
            dessiner();
        });
        dessiner();
    }

    // --- La galerie d'une fiche : les videos d'abord, puis les captures. Le lecteur ne se charge qu'au clic.
    const ecran = document.getElementById('gr-ecran');
    if (ecran) {
        const img = document.getElementById('gr-ecran-image');
        const lecture = document.getElementById('gr-lecture');
        const texte = document.getElementById('gr-lecture-texte');
        const vignettes = Array.from(document.querySelectorAll('#gr-vignettes button'));
        let courant = null;
        const fermer = () => ecran.querySelector('iframe')?.remove();
        const montrer = (v) => {
            fermer();
            courant = v;
            img.src = v.dataset.src;
            ecran.classList.toggle('is-video', Boolean(v.dataset.video));
            texte.textContent = v.dataset.label || '';
            vignettes.forEach((x) => x.setAttribute('aria-current', x === v ? 'true' : 'false'));
        };
        // LA PROPORTION DE L'ECRAN D'ORIGINE (10/11) : une capture d'arcade est en pixels bruts (19XX : 224 x 384) ; la
        // borne l'affichait sur un moniteur 4:3, couche ou debout (3:4). La capture du Player Deck garde la sienne.
        const proportion = () => {
            const arcade = ecran.dataset.dar === 'arcade' && !img.src.includes('/playerdeck/') && img.naturalWidth > 0;
            img.classList.toggle('gr-dar', arcade);
            img.style.aspectRatio = arcade ? (img.naturalHeight > img.naturalWidth ? '3 / 4' : '4 / 3') : '';
        };
        img.addEventListener('load', proportion);
        if (img.complete) proportion();
        vignettes.forEach((v) => v.addEventListener('click', () => montrer(v)));
        lecture.addEventListener('click', () => {
            if (!courant || !courant.dataset.video) return;
            const cadre = document.createElement('iframe');
            cadre.title = courant.dataset.label || '';
            cadre.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
            cadre.allowFullscreen = true;
            cadre.referrerPolicy = 'strict-origin-when-cross-origin';
            cadre.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(courant.dataset.video) + '?autoplay=1&rel=0'
                + (courant.dataset.params ? '&' + courant.dataset.params : '');
            ecran.classList.remove('is-video');
            ecran.append(cadre);
        });
        if (vignettes.length > 0) montrer(vignettes[0]);
    }

    // --- Suivre et ne plus suivre, depuis Ma communaute
    document.querySelectorAll('.gr-suivre').forEach((b) => b.addEventListener('click', async () => {
        b.disabled = true;
        const chemin = b.dataset.suivi === '1' ? '/api/v1/follows/remove' : '/api/v1/follows/add';
        const r = await fetch(chemin + '?kind=player&ref=' + encodeURIComponent(b.dataset.joueur), { method: 'POST' }).catch(() => null);
        if (r && r.ok) location.reload();
        else b.disabled = false;
    }));

    // --- Le rail du materiel
    const rail = document.getElementById('gr-rail');
    if (rail) {
        const fleches = document.getElementById('gr-fleches');
        const montrer = () => {
            fleches.style.visibility = rail.scrollWidth > rail.clientWidth + 4 ? 'visible' : 'hidden';
        };
        document.querySelectorAll('[data-rail]').forEach((b) => b.addEventListener('click', () => rail.scrollBy({ left: Number(b.dataset.rail) * rail.clientWidth / 2, behavior: 'smooth' })));
        addEventListener('resize', montrer);
        montrer();
    }
})();

/* LA VIDEO D'UNE PAGE (07/11) : une facade, et le lecteur YouTube (avec ses commandes) seulement au clic. */
(() => {
    document.querySelectorAll('[data-yt]').forEach((facade) => facade.addEventListener('click', () => {
        const langue = (document.documentElement.lang || 'en').slice(0, 2);
        const cadre = document.createElement('iframe');
        cadre.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(facade.getAttribute('data-yt'))
            + '?autoplay=1&rel=0&playsinline=1&modestbranding=1&hl=' + encodeURIComponent(langue === 'zh' ? 'zh-CN' : langue);
        cadre.title = facade.getAttribute('aria-label') || '';
        cadre.allow = 'autoplay; encrypted-media; fullscreen';
        cadre.allowFullscreen = true;
        cadre.referrerPolicy = 'strict-origin-when-cross-origin';
        facade.replaceWith(cadre);
    }));
})();
