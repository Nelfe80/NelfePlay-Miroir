/* ── La préparation guidée n'existe que sur Windows ────────────────────────
   EN TÊTE DE FICHIER, ET DANS SON PROPRE FILET.

   Tous les blocs de ce script vivent au niveau supérieur : un seul jet non
   rattrapé dans l'un d'eux arrête tout ce qui suit. Placé en fin de fichier,
   ce masquage dépendait de la bonne santé de six cents lignes écrites pour
   d'autres pages. Un bouton qui ne devait pas s'afficher est un défaut
   visible ; l'ordre d'exécution ne doit pas en décider.

   La préparation installe RetroBat et APIExpose : elle n'a de sens que sur un
   PC Windows. L'offrir ailleurs envoie quelqu'un vers un guide qu'il ne peut
   pas suivre.

   LE DÉFAUT EST DE MONTRER. Sans JavaScript on ignore la plateforme, et cacher
   par défaut priverait un joueur Windows de son parcours. On retire après
   coup, une fois qu'on sait. */
(() => {
    try {
        // `userAgentData` est l'indication propre là où elle existe ; elle peut
        // rendre une chaîne vide, auquel cas la chaîne d'agent tranche.
        const plateforme = navigator.userAgentData && navigator.userAgentData.platform;
        const windows = plateforme
            ? plateforme === 'Windows'
            : /Windows NT/i.test(navigator.userAgent || '');

        // PUBLIÉE, parce que le balisage n'est pas seul concerné : le bouton
        // « Replay » des classements est fabriqué après coup par nelfe-board.js,
        // qui ne verrait jamais un marqueur posé dans le HTML. Une seule règle,
        // lue à deux endroits, plutôt que deux tests qui divergeront.
        //
        // Établie AVANT la sortie anticipée : une page sans marqueur, les
        // classements justement, ne la publierait jamais sinon.
        window.NelfePlateforme = { windows: windows };

        const marques = document.querySelectorAll('[data-windows-only]');
        const autres = document.querySelectorAll('[data-other-platform]');
        if (marques.length === 0 && autres.length === 0) return;

        if (windows) return;

        marques.forEach((el) => { el.hidden = true; });
        autres.forEach((el) => { el.hidden = false; });
    } catch (e) {
        // Un echec ici ne doit pas emporter le reste du script.
    }
})();

/* ── Le compteur de lectures d'un replay ─────────────────────────────────────
   Un nombre qu'on lit d'un coup d'œil : « 1,2 k lectures », pas « 1 234 ». On
   TRONQUE au lieu d'arrondir, pour ne jamais annoncer plus que ce qui a été vu.

   MÊME RÈGLE côté serveur : View::plays(). Les gabarits l'appliquent là-bas, les
   listes fabriquées ici (classements, fiche joueur) l'appliquent ici ; si les deux
   divergent, un même replay affiche deux nombres selon la page.

   Publiée tôt et dans son propre filet : nelfe-board.js et player-sheet.js la
   lisent au moment de dessiner leurs lignes. */
(() => {
    try {
        const valeur = (v, separateur) => {
            if (v >= 10) return String(Math.floor(v));
            const dixiemes = Math.floor(v * 10);
            return dixiemes % 10 === 0
                ? String(Math.floor(dixiemes / 10))
                : Math.floor(dixiemes / 10) + separateur + (dixiemes % 10);
        };

        const compact = (n, langue) => {
            n = Math.max(0, Math.floor(n));
            // Le japonais et le chinois comptent par dix mille, le coréen par mille puis dix mille.
            if (langue === 'ja' || langue === 'zh') {
                if (n < 10000) return n.toLocaleString('en-US');
                if (n < 100000000) return valeur(n / 10000, '.') + '万';
                return valeur(n / 100000000, '.') + (langue === 'ja' ? '億' : '亿');
            }
            if (langue === 'ko') {
                if (n < 1000) return String(n);
                if (n < 10000) return valeur(n / 1000, '.') + '천';
                if (n < 100000000) return valeur(n / 10000, '.') + '만';
                return valeur(n / 100000000, '.') + '억';
            }
            if (n < 1000) return String(n);
            const separateur = langue === 'en' ? '.' : ',';
            const milliers = { fr: ' k', es: ' mil', en: 'K' }[langue] || ' k';
            return n < 1000000
                ? valeur(n / 1000, separateur) + milliers
                : valeur(n / 1000000, separateur) + (langue === 'en' ? 'M' : ' M');
        };

        // Les mots, calqués mot pour mot sur common.plays_one / plays_many.
        const libelle = (n) => {
            const langue = (document.documentElement.lang || 'fr').slice(0, 2);
            const c = compact(n, langue);
            if (langue === 'ja') return c + ' 回再生';
            if (langue === 'zh') return c + ' 次播放';
            if (langue === 'ko') return '재생 ' + c + '회';
            const mots = {
                fr: ['lecture', 'lectures'],
                en: ['play', 'plays'],
                es: ['reproducción', 'reproducciones'],
            }[langue] || ['lecture', 'lectures'];
            return c + ' ' + (n === 1 ? mots[0] : mots[1]);
        };

        const OEIL = '<svg class="play-count-icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">'
            + '<path d="M8 3C4.4 3 1.6 5.4.5 8c1.1 2.6 3.9 5 7.5 5s6.4-2.4 7.5-5C14.4 5.4 11.6 3 8 3zm0 8.2A3.2 3.2 0 1 1 8 4.8a3.2 3.2 0 0 1 0 6.4zM8 6.4a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2z" fill="currentColor"/></svg>';

        /* Le module, ou rien : à zéro, une rangée de « 0 lecture » n'apprend rien. */
        const module = (n) => {
            if (!(n > 0)) return null;
            const span = document.createElement('span');
            span.className = 'play-count';
            span.title = libelle(n);
            span.innerHTML = OEIL;
            span.appendChild(document.createTextNode(libelle(n)));
            return span;
        };

        window.NelfeLectures = { libelle, module };
    } catch (e) {
        // Sans compteur, les listes restent entières.
    }
})();

/* ── Lecteurs YouTube posés au clic ──────────────────────────────────────────
   Le hero a son propre bloc, qui gère la lecture automatique muette et le son.
   Ici, c'est l'inverse qu'on veut : rien ne part tout seul, et le son est là dès
   le départ puisque c'est un clic qui a demandé la vidéo. Plusieurs façades
   peuvent coexister sur une page, alors que le bloc du hero n'en connaît qu'une.

   L'iframe ne se charge QU'À CE MOMENT : sur une page d'accueil que la plupart
   parcourent sans lancer la vidéo, la charger d'avance coûterait à tout le monde
   pour servir quelques-uns, et poserait des cookies tiers au passage. */
(() => {
    document.querySelectorAll('[data-youtube-facade]').forEach((facade) => {
        facade.addEventListener('click', () => {
            try {
                const id = facade.getAttribute('data-youtube-facade') || '';
                const support = facade.parentElement;
                if (!id || !support || support.dataset.lance === '1') return;
                support.dataset.lance = '1';
                // L'apercu muet du survol laisse la place au lecteur avec le son, et la video du
                // premier ecran se fige : une seule lecture a la fois.
                support.querySelectorAll('iframe').forEach((cadre) => cadre.remove());
                support.classList.remove('is-playing', 'is-loading');
                window.NelfeHero?.pause();

                const frame = document.createElement('iframe');
                frame.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id)
                    + '?autoplay=1&rel=0&modestbranding=1&playsinline=1';
                frame.title = facade.getAttribute('data-video-title') || '';
                frame.allow = 'autoplay; encrypted-media; picture-in-picture';
                frame.setAttribute('allowfullscreen', '');
                // Sans origine transmise, YouTube refuse de jouer (erreur 153) sur les pages
                // marquées « no-referrer ». On donne l'origine, jamais le chemin.
                frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
                support.appendChild(frame);
                facade.remove();
            } catch (e) {
                // La vignette reste : le visiteur peut réessayer, ou suivre le lien du jeu.
            }
        });
    });
})();

/* ── « Mon nom de joueur » ouvert par son ancre ──────────────────────────────
   L'invitation de la premiere connexion mene a /account#player-name. Le
   formulaire y est replie dans un <details>, qu'une ancre ne sait pas ouvrir :
   le joueur arriverait devant un titre et devrait chercher quoi faire. On le
   deplie et on donne la main au champ. Dans son propre filet, comme le bloc
   du dessus. */
(() => {
    const ouvrirNomJoueur = () => {
        try {
            if (window.location.hash !== '#player-name') return;
            const bloc = document.getElementById('player-name');
            const repli = bloc && bloc.querySelector('details');
            if (!repli) return;
            repli.open = true;
            bloc.scrollIntoView({ block: 'center' });
            const champ = repli.querySelector('input[name="display_name"]');
            if (champ) champ.focus({ preventScroll: true });
        } catch (e) {
            // Sans ce confort, la ligne reste visible et le repli s'ouvre au clic.
        }
    };
    ouvrirNomJoueur();
    // Le lien peut aussi etre suivi depuis /account meme : l'adresse ne change que par l'ancre.
    window.addEventListener('hashchange', ouvrirNomJoueur);
})();

(() => {
    'use strict';

    const header = document.querySelector('[data-site-header]');
    const navToggle = document.querySelector('[data-nav-toggle]');
    const navigation = document.querySelector('[data-navigation]');
    // Les replis de la navigation : Scoring, Partenaires, Le projet.
    //
    // Ils sont construits en LISTE et non un par un. La version d'avant en
    // cablait UN SEUL par querySelector, ce qui tenait tant qu'une seule
    // branche PHP en rendait un ; le jour ou la page en montre deux, le second
    // ne s'ouvre plus. Une liste ne se trompe pas de compte.
    const menuGroups = Array.from(document.querySelectorAll('[data-menu-toggle]'))
        .map((toggle) => ({ toggle: toggle, menu: toggle.parentElement.querySelector('.nav-popover') }))
        .filter((group) => group.menu !== null);

    const closeNavigation = (restoreFocus = false) => {
        if (!navToggle || !navigation) return;
        const wasOpen = navToggle.getAttribute('aria-expanded') === 'true';
        navToggle.setAttribute('aria-expanded', 'false');
        navigation.classList.remove('is-open');
        document.body.classList.remove('nav-open');
        if (restoreFocus && wasOpen) {
            navToggle.focus();
        }
    };

    const closeMenus = (except) => {
        menuGroups.forEach((group) => {
            if (group === except) return;
            group.toggle.setAttribute('aria-expanded', 'false');
            group.menu.classList.remove('is-open');
        });
    };

    // Le repli des langues. Contrairement au menu partenaires, dont les deux
    // variantes vivent dans des branches PHP exclusives, celui-ci est rendu
    // DEUX fois - mobile et bureau - et querySelector n'en cablerait qu'un.
    const languageGroups = Array.from(document.querySelectorAll('[data-language-toggle]'))
        .map((toggle) => ({ toggle: toggle, menu: toggle.parentElement.querySelector('[data-language-menu]') }))
        .filter((group) => group.menu !== null);

    const closeLanguageMenus = (except) => {
        languageGroups.forEach((group) => {
            if (group === except) return;
            group.toggle.setAttribute('aria-expanded', 'false');
            group.menu.classList.remove('is-open');
        });
    };

    if (navToggle && navigation) {
        navToggle.addEventListener('click', () => {
            const open = navToggle.getAttribute('aria-expanded') === 'true';
            navToggle.setAttribute('aria-expanded', String(!open));
            navigation.classList.toggle('is-open', !open);
            document.body.classList.toggle('nav-open', !open);
        });

        navigation.querySelectorAll('a').forEach((link) => {
            link.addEventListener('click', () => closeNavigation());
        });
    }

    menuGroups.forEach((group) => {
        group.toggle.addEventListener('click', (event) => {
            event.stopPropagation();
            const open = group.toggle.getAttribute('aria-expanded') === 'true';
            // Un repli qui s'ouvre ferme les autres : deux listes deployees
            // l'une sur l'autre se recouvrent.
            closeMenus(group);
            closeLanguageMenus(null);
            group.toggle.setAttribute('aria-expanded', String(!open));
            group.menu.classList.toggle('is-open', !open);
        });
    });

    if (menuGroups.length > 0) {
        document.addEventListener('click', (event) => {
            const inside = menuGroups.some(
                (group) => group.menu.contains(event.target) || group.toggle.contains(event.target),
            );
            if (!inside) {
                closeMenus(null);
            }
        });
    }

    languageGroups.forEach((group) => {
        group.toggle.addEventListener('click', (event) => {
            event.stopPropagation();
            const open = group.toggle.getAttribute('aria-expanded') === 'true';
            closeLanguageMenus(group);
            closeMenus(null);
            group.toggle.setAttribute('aria-expanded', String(!open));
            group.menu.classList.toggle('is-open', !open);
        });
    });

    if (languageGroups.length > 0) {
        document.addEventListener('click', (event) => {
            const inside = languageGroups.some(
                (group) => group.menu.contains(event.target) || group.toggle.contains(event.target),
            );
            if (!inside) {
                closeLanguageMenus(null);
            }
        });
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeNavigation(true);
            closeMenus(null);
            closeLanguageMenus(null);
        }

        if (
            event.key === 'Tab'
            && navigation?.classList.contains('is-open')
            && window.matchMedia('(max-width: 900px)').matches
        ) {
            const focusable = [...navigation.querySelectorAll('a[href], button:not([disabled])')]
                .filter((element) => element.offsetParent !== null);
            if (focusable.length === 0) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }
    });

    document.querySelectorAll('[data-flash-dismiss]').forEach((button) => {
        button.addEventListener('click', () => button.closest('.flash')?.remove());
    });

    document.querySelectorAll('form').forEach((form) => {
        form.addEventListener('submit', () => {
            const submit = form.querySelector('button[type="submit"]');
            if (submit) {
                submit.setAttribute('aria-busy', 'true');
            }
        });
    });

    const errorSummary = document.querySelector('[data-form-error-summary]');
    errorSummary?.focus();

    const updateHeader = () => {
        header?.classList.toggle('is-scrolled', window.scrollY > 12);
    };
    updateHeader();
    window.addEventListener('scroll', updateHeader, { passive: true });
})();

// Réclamation d'un record (page /claim). CSP script-src 'self' → script externe, les
// données viennent de data-*. Rattache le score au compte (one-shot ou lien machine).
(() => {
    const box = document.getElementById('claim-actions');
    if (!box) {
        return;
    }
    const code = box.getAttribute('data-code');
    const T = {
        done: box.getAttribute('data-t-done'),
        lead: box.getAttribute('data-t-lead'),
        linked: box.getAttribute('data-t-linked'),
        err: box.getAttribute('data-t-err'),
    };
    const done = document.getElementById('claim-done');
    const buttons = () => document.querySelectorAll('[data-claim]');

    buttons().forEach((button) => {
        button.addEventListener('click', async () => {
            buttons().forEach((b) => { b.disabled = true; });
            try {
                const response = await fetch('/api/v1/account/claim', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code, mode: button.getAttribute('data-claim') }),
                });
                const data = await response.json();
                if (data.ok) {
                    box.hidden = true;
                    document.getElementById('claim-done-title').textContent = T.done;
                    document.getElementById('claim-done-lead').textContent = data.linked ? T.linked : T.lead;
                    if (done) { done.hidden = false; }
                    return;
                }
            } catch (error) { /* réseau : on retente */ }
            window.alert(T.err);
            buttons().forEach((b) => { b.disabled = false; });
        });
    });
})();

/* Largeur des barres de projection.
   Comme le fond de matière, elle ne peut pas voyager dans un attribut « style »
   que la politique de sécurité refuse : elle arrive en data-, et c'est l'API du
   navigateur qui la pose. */
(() => {
    'use strict';

    document.querySelectorAll('[data-width]').forEach((bar) => {
        const value = Number(bar.getAttribute('data-width'));
        if (!Number.isFinite(value)) return;

        bar.style.width = Math.max(0, Math.min(100, value)) + '%';
    });
})();

/* Fond de matière.
   La capture du jeu sert de texture derrière son propre cadre. Elle ne peut pas
   voyager dans un attribut « style » : la politique de sécurité interdit les
   styles écrits dans le HTML, et la règle était donc silencieusement ignorée -
   le fond n'apparaissait nulle part. Passée en data-, elle est posée ici par
   l'API du navigateur, qui n'est pas soumise à cette interdiction. */
(() => {
    'use strict';

    document.querySelectorAll('[data-backdrop]').forEach((holder) => {
        const path = holder.getAttribute('data-backdrop');
        // Un chemin servi par nous, et rien d'autre : refuser le reste évite
        // qu'une valeur venue d'ailleurs ne se glisse dans une url() CSS.
        if (!path || !/^\/[\w./-]+$/.test(path)) return;

        holder.style.setProperty('--game-backdrop', 'url("' + path + '")');
    });
})();

/* Le verre bombé des téléviseurs (accueil).
   La carte de déplacement des filtres SVG marqués `feImage[data-crt-carte]` se
   calcule ici, une fois : le rouge pousse en x, le vert en y, 128 ne bouge
   rien, et chaque point part vers l'extérieur d'autant plus qu'il est loin du
   centre sur l'AUTRE axe. La courbure elle-même se règle dans le filtre. */
(() => {
    'use strict';

    const cartes = document.querySelectorAll('feImage[data-crt-carte]');
    if (!cartes.length) return;
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
        cartes.forEach((carte) => {
            carte.setAttribute('href', adresse);
            carte.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', adresse);
        });
        document.documentElement.classList.add('crt-bombe');
    } catch (erreur) {
        // Écrans plats : ils gardent leur cadre, leurs lignes et leur reflet.
    }
})();

/* Bande-annonce au survol.
   Le visuel reste une image tant que rien ne se passe : la vidéo n'est chargée
   qu'au moment où on la regarde, jamais à l'affichage de la page. On respecte
   « mouvement réduit » - dans ce cas la carte reste sage, et le lien vers la
   fiche suffit. */
(() => {
    'use strict';

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let active = null;

    const stop = () => {
        if (!active) return;
        if (active.dataset.register) {
            window.clearInterval(Number(active.dataset.register));
            delete active.dataset.register;
        }

        // Le visiteur a clique pour lire avec le son : ce lecteur-la est le sien, on n'y touche pas.
        if (active.dataset.lance === '1') {
            active = null;
            return;
        }

        const frame = active.querySelector('iframe');
        /* data-video-fade : l'écran repasse au noir et blanc (programmation) et le lecteur
           s'efface en fondu avant d'être retiré. Il continue de tourner, muet, ces 0,7 s : une
           pause ferait remonter le bouton central et le bandeau de YouTube pendant le fondu. */
        if (frame && active.hasAttribute('data-video-fade') && active.classList.contains('is-playing')) {
            const ecran = active;
            ecran.classList.add('is-leaving');
            window.setTimeout(() => {
                frame.remove();
                if (!ecran.querySelector('iframe')) ecran.classList.remove('is-leaving');
            }, 700);
        } else if (frame) {
            frame.remove();
        }
        active.classList.remove('is-playing', 'is-loading', 'is-ended');
        delete active.dataset.answered;
        delete active.dataset.lecture;
        delete active.dataset.charge;
        delete active.dataset.fini;
        active = null;

        // Une seule lecture à la fois : la vidéo du premier écran reprend, sauf si une capsule
        // se lit avec le son, à la demande du visiteur.
        if (!document.querySelector('.launch-video[data-lance="1"]')) window.NelfeHero?.resume();
    };

    /* Le lecteur poste son état à la fenêtre parente. On n'écoute que lui, et
       on ne dévoile l'image qu'une fois la lecture commencée (état 1). */
    window.addEventListener('message', (event) => {
        if (!active || !/^https:\/\/www\.youtube-nocookie\.com$/.test(event.origin)) return;

        let payload;
        try {
            payload = JSON.parse(event.data);
        } catch (error) {
            return;
        }

        // Seul le lecteur de l'aperçu compte : celui du premier écran parle aussi.
        if (event.source !== active.querySelector('iframe')?.contentWindow) return;

        // Le lecteur a donné signe de vie : le cadre existe et répond. C'est ce
        // que le filet de sécurité regarde pour décider s'il découvre ou s'il
        // renonce.
        active.dataset.answered = '1';

        const ecran = active.hasAttribute('data-video-cover');
        const depart = Number(active.getAttribute('data-video-start') || 0);
        const commander = (func, args) => active.querySelector('iframe')?.contentWindow?.postMessage(
            JSON.stringify({ event: 'command', func, args }),
            'https://www.youtube-nocookie.com',
        );

        /* L'ETAT DE LECTURE. Le lecteur n'envoie `onStateChange` que si on s'y est abonne ;
           sans abonnement, l'etat n'arrive que dans ses infos periodiques (`playerState`).
           On lit les deux : c'est ce qui manquait, et chaque apercu attendait le filet. */
        let etat = null;
        if (payload?.event === 'onStateChange') etat = Number(payload.info);
        if (payload?.event === 'infoDelivery' && typeof payload.info?.playerState === 'number') etat = payload.info.playerState;

        /* Dans un écran de jeu, la boucle se referme JUSTE AVANT la fin : à la fin,
           YouTube pose son écran de sortie (titre, « Plus de vidéos », bouton rejouer)
           et une relance ne l'efface pas. On repart au début du jeu, pas du carton. */
        if (ecran && payload?.event === 'infoDelivery') {
            const temps = Number(payload.info?.currentTime);
            const duree = Number(payload.info?.duration || active.dataset.duree || 0);
            if (payload.info?.duration) active.dataset.duree = String(payload.info.duration);
            if (duree > 0 && temps >= duree - 0.6) {
                /* data-video-end (l'accueil) : pas de boucle. La video s'arrete sur sa derniere
                   image et l'invitation a scorer, rendue dans l'ecran, prend sa place. */
                if (active.hasAttribute('data-video-end')) {
                    if (active.dataset.fini !== '1') {
                        active.dataset.fini = '1';
                        commander('pauseVideo', []);
                        active.classList.add('is-ended');
                    }
                    return;
                }
                commander('seekTo', [depart, true]);
                commander('playVideo', []);
                /* Après un saut, YouTube remontre son bouton central quatre secondes (mesure du
                   2026-09-17, avec ou sans commandes) : un écran voilé se revoile ce temps-là. */
                const voile = Number(active.getAttribute('data-video-veil') || 0);
                if (voile > 0 && active.classList.contains('is-playing')) {
                    const lecteur = active;
                    lecteur.classList.remove('is-playing');
                    lecteur.classList.add('is-loading');
                    window.setTimeout(() => {
                        if (active !== lecteur || !lecteur.classList.contains('is-loading')) return;
                        lecteur.classList.remove('is-loading');
                        lecteur.classList.add('is-playing');
                    }, voile);
                }
                return;
            }
        }

        /* Le lecteur est prêt : on lui ordonne de démarrer, mais on ne dévoile
           RIEN encore. Découvrir à « prêt » laissait voir le gros bouton de
           lecture au centre - c'est ce bouton qu'on cherchait à cacher. La
           commande explicite rend l'attente très courte : le démarrage suit
           immédiatement. On s'abonne aussi a l'etat, pour l'avoir sans attendre. */
        if (payload?.event === 'onReady') {
            commander('addEventListener', ['onStateChange']);
            commander('playVideo', []);
            return;
        }

        if (etat === null) return;

        // 1 = en lecture : c'est le seul moment où l'image est vraiment là,
        // donc le seul où découvrir le lecteur ne montre aucun bouton.
        if (etat === 1 && active.dataset.lecture !== '1') {
            active.dataset.lecture = '1';
            /* Dans un écran de jeu, on laisse d'abord passer le bandeau de titre que
               YouTube affiche au démarrage : la capture reste en place ce temps-là. */
            const lecteur = active;
            const decouvrir = () => {
                if (active !== lecteur) return;
                lecteur.classList.remove('is-loading');
                lecteur.classList.add('is-playing');
            };
            /* data-video-veil : le délai à laisser passer après le début de la lecture, en
               millisecondes, avant de dévoiler. */
            const voile = Number(lecteur.getAttribute('data-video-veil') || 0);
            if (voile > 0 && lecteur.classList.contains('is-loading')) {
                window.setTimeout(decouvrir, voile);
            } else if (ecran && lecteur.classList.contains('is-loading')) {
                window.setTimeout(decouvrir, 1400);
            } else {
                decouvrir();
            }
            return;
        }

        // 0 = terminé. On relance à la main plutôt qu'avec une playlist, qui
        // ajouterait les chevrons « précédent » et « suivant » par-dessus
        // l'image.
        if (etat === 0) {
            if (active.hasAttribute('data-video-end')) {
                active.dataset.fini = '1';
                active.classList.add('is-ended');
                return;
            }
            if (ecran) commander('seekTo', [depart, true]);
            commander('playVideo', []);
        }
    });

    const play = (holder) => {
        if (reduced.matches || active === holder || holder.dataset.lance === '1') return;
        const source = holder.getAttribute('data-video');
        if (!source) return;

        stop();
        // Un lecteur encore en fondu dans CET écran part tout de suite : les messages se
        // reconnaissent au premier lecteur de l'écran, qui doit être le nouveau.
        holder.querySelectorAll('iframe').forEach((ancien) => ancien.remove());
        holder.classList.remove('is-leaving');

        /* Paramètres du lecteur, choisis pour qu'il se fasse oublier :
           - rel=0            : pas de vidéos d'autres chaînes à la fin
           - iv_load_policy=3 : aucune annotation par-dessus l'image
           - controls=0, disablekb=1, fs=0 : rien à cliquer, c'est un aperçu
           - PAS de playlist : c'est elle qui fait apparaître les chevrons
                                « précédent » et « suivant ». On reboucle
                                nous-mêmes à la fin (voir plus bas)
           - enablejsapi=1    : le lecteur nous PARLE, sans charger son script
                                (la politique de sécurité interdit les scripts
                                tiers) - c'est ainsi qu'on sait quand l'image
                                arrive vraiment. */
        const parameters = [
            'autoplay=1', 'mute=1', 'controls=0',
            'playsinline=1', 'modestbranding=1', 'rel=0', 'iv_load_policy=3',
            'disablekb=1', 'fs=0', 'cc_load_policy=0', 'enablejsapi=1',
            'origin=' + encodeURIComponent(location.origin),
        ];
        // Une capsule s'ouvre sur son carton ; l'aperçu entre directement dans le jeu.
        const depart = Math.floor(Number(holder.getAttribute('data-video-start') || 0));
        if (depart > 0) parameters.push('start=' + depart);

        const frame = document.createElement('iframe');
        frame.src = source + '?' + parameters.join('&');
        frame.title = holder.getAttribute('data-video-title') || '';
        frame.allow = 'autoplay; encrypted-media';
        frame.setAttribute('tabindex', '-1');
        // Sans origine transmise, YouTube refuse de jouer (erreur 153) sur les
        // pages marquées « no-referrer ». On donne l'origine, jamais le chemin.
        frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');

        /* Dans un ecran de jeu (data-video-cover), la capsule 16:9 REMPLIT le cadre, quelles
           qu'en soient les proportions : le jeu est au centre de la video, les bords rognes sont
           ses bandes noires. Le lecteur laisse passer les clics vers ce qui est dessous. */
        if (holder.hasAttribute('data-video-cover')) {
            // Les dimensions de MISE EN PAGE : un écran qui grandit par transformation (la
            // programmation) rendrait sa taille agrandie, en cours d'animation qui plus est, et le
            // lecteur, posé dedans, grandirait deux fois.
            const rectangle = holder.getBoundingClientRect();
            const boite = {
                width: holder.offsetWidth || rectangle.width,
                height: holder.offsetHeight || rectangle.height,
            };
            // Une vidéo aux proportions du jeu (data-video-ratio) remplit un cadre aux mêmes
            // proportions ; une capsule est en 16:9. data-video-overscan la recadre un peu plus,
            // comme la capture qu'elle remplace.
            const ratio = Number(holder.getAttribute('data-video-ratio')) || 16 / 9;
            const surplus = Math.max(1, Number(holder.getAttribute('data-video-overscan')) || 1);
            const largeur = Math.max(boite.width, boite.height * ratio) * surplus;
            const hauteur = largeur / ratio;
            /* data-video-bleed : le lecteur DÉBORDE de tant de pixels en haut et en bas. YouTube
               ajuste la vidéo à la largeur et pose des bandes noires dans ce surplus, que le cadre
               rogne ; son bandeau de titre et son filigrane tombent dedans. MESURE du 2026-09-17 :
               90 px suffisent, au démarrage comme à chaque boucle, où le bandeau revient. */
            const debord = Number(holder.getAttribute('data-video-bleed') || 0);
            /* data-video-zoom : l'écran s'agrandit au survol. Le lecteur est dessiné à la taille
               agrandie puis réduit d'autant : YouTube choisit sa qualité sur la taille du cadre,
               et une image 240p agrandie deux fois serait floue. Le débordement se compte dans
               le cadre, là où YouTube dessine son bandeau. */
            const zoom = Math.max(1, Number(holder.getAttribute('data-video-zoom')) || 1);
            Object.assign(frame.style, {
                position: 'absolute',
                width: largeur * zoom + 'px',
                height: hauteur * zoom + 2 * debord + 'px',
                left: (boite.width - largeur) / 2 + 'px',
                top: (boite.height - hauteur) / 2 - debord / zoom + 'px',
                transform: zoom > 1 ? 'scale(' + (1 / zoom) + ')' : '',
                transformOrigin: '0 0',
                pointerEvents: 'none',
            });
        }
        /* Le cadre CHARGE vaut lecture : un lecteur muet en autoplay demarre dans la
           seconde qui suit, et l'on n'attend pas qu'il le dise. Sa reponse (plus bas) ne
           fait qu'avancer le moment, quand elle arrive avant. Sans elle, la video restait
           cachee derriere la vignette tant que le filet n'avait pas tranche. */
        const ecran = holder.hasAttribute('data-video-cover');
        // Un écran voilé (data-video-veil) n'est dévoilé QUE par la lecture et son délai : un
        // cadre seulement chargé montrerait encore la jaquette et le bouton de lecture.
        const voile = Number(holder.getAttribute('data-video-veil') || 0);
        frame.addEventListener('load', () => {
            if (active !== holder || voile > 0) return;
            holder.dataset.charge = '1';
            window.setTimeout(() => {
                if (active !== holder || !holder.classList.contains('is-loading')) return;
                holder.classList.remove('is-loading');
                holder.classList.add('is-playing');
            }, ecran ? 3000 : 1500);
        }, { once: true });
        holder.appendChild(frame);

        /* La vignette reste AU-DESSUS tant que la vidéo n'a pas démarré : c'est
           pendant ce temps-là que YouTube affiche son titre et sa jaquette. On
           ne découvre le lecteur qu'une fois l'image en route. */
        holder.classList.add('is-loading');
        active = holder;

        // Une seule lecture à la fois : la vidéo du premier écran se fige sur son affiche.
        window.NelfeHero?.pause();

        /* Le lecteur ne parle QUE si on s'annonce, et il n'est pas prêt au
           moment où le cadre se charge : on redemande jusqu'à ce qu'il réponde.
           Une inscription unique arrivait trop tôt et se perdait, et 2,4 s ne
           suffisaient pas quand la vidéo du premier écran se chargeait en même
           temps : le lecteur répondait après la dernière demande, et le filet
           le retirait. On demande jusqu'à la réponse, dans la limite du filet. */
        let attempts = 0;
        const register = window.setInterval(() => {
            if (active !== holder || holder.dataset.answered === '1' || attempts++ > 80) {
                window.clearInterval(register);
                return;
            }

            frame.contentWindow?.postMessage(
                JSON.stringify({ event: 'listening', id: 'nelfeplay' }),
                'https://www.youtube-nocookie.com',
            );
        }, 100);
        holder.dataset.register = String(register);

        /* Filet de sécurité, mais dans les DEUX sens.
           Si le lecteur a parlé sans jamais annoncer la lecture, l'image est
           probablement là et on découvre. S'il n'a JAMAIS répondu, c'est qu'il
           ne jouera pas - vidéo retirée, intégration refusée, réseau coupé - et
           découvrir poserait un cadre noir sur le visuel. Sur une fiche la
           bande-annonce démarre seule et rien ne vient l'arrêter : ce cadre
           noir y resterait pour de bon. On retire donc le lecteur et on garde
           l'image, qui est ce qu'on avait à montrer. */
        window.setTimeout(() => {
            if (active !== holder || !holder.classList.contains('is-loading')) return;

            // Écran voilé : une lecture annoncée se dévoile à son heure ; sans lecture, on renonce
            // plutôt que de montrer un lecteur arrêté.
            if (voile > 0) {
                if (holder.dataset.lecture !== '1') stop();
                return;
            }

            if (holder.dataset.answered === '1' || holder.dataset.charge === '1') {
                holder.classList.remove('is-loading');
                holder.classList.add('is-playing');
                return;
            }

            stop();
        }, voile > 0 ? voile + 9000 : (holder.hasAttribute('data-video-cover') ? 8000 : 2600));
    };

    document.querySelectorAll('[data-video]').forEach((holder) => {
        /* Sur la FICHE d'un jeu, la bande-annonce est ce qu'on est venu voir :
           elle démarre d'elle-même et ne s'arrête pas quand la souris passe
           ailleurs. Sur une carte de liste, elle reste un aperçu au survol. */
        if (holder.hasAttribute('data-video-auto')) {
            if (!reduced.matches) {
                play(holder);
            }

            return;
        }

        /* La zone sensible est la CARTE entière, pas la seule vignette :
           viser une image de 230 pixels pour déclencher une vidéo est une
           exigence inutile. Le lecteur, lui, reste posé dans la vignette. */
        const card = holder.closest('.rail-card, .game-card, .spotlight-card, .record-spotlight, .launch-card, .prog-tile, .prog-next') || holder;

        card.addEventListener('mouseenter', () => play(holder));
        card.addEventListener('mouseleave', stop);

        // Au clavier, le focus déclenche et quitte comme le survol (sur la programmation, le
        // bouton de vote tient lieu de lien).
        const link = card.matches('a') ? card : card.querySelector('a, .prog-hit');
        if (link) {
            link.addEventListener('focus', () => play(holder));
            link.addEventListener('blur', stop);
        }
    });
})();

/* Agrandissement d'un visuel.
   Choisir entre deux captures suppose de les voir autrement qu'en vignette de
   260 pixels. Rien d'extérieur n'est chargé : une surface, l'image, et les
   moyens habituels d'en sortir - Échap, un clic à côté, le bouton. */
(() => {
    'use strict';

    const thumbnails = document.querySelectorAll('[data-zoom]');
    if (thumbnails.length === 0) return;

    const overlay = document.createElement('div');
    overlay.className = 'lightbox';
    overlay.hidden = true;
    overlay.innerHTML =
        '<button class="lightbox-close" type="button" aria-label="Fermer">\u00d7</button>'
        + '<figure><img alt=""><figcaption></figcaption></figure>';
    document.body.appendChild(overlay);

    const image = overlay.querySelector('img');
    const caption = overlay.querySelector('figcaption');
    let opener = null;

    const close = () => {
        overlay.hidden = true;
        image.removeAttribute('src');
        document.body.classList.remove('has-lightbox');
        if (opener) opener.focus();
    };

    const open = (thumbnail) => {
        const source = thumbnail.getAttribute('data-zoom');
        if (!source) return;

        opener = thumbnail;
        image.src = source;
        caption.textContent = thumbnail.getAttribute('data-zoom-label') || '';
        overlay.hidden = false;
        document.body.classList.add('has-lightbox');
        overlay.querySelector('.lightbox-close').focus();
    };

    thumbnails.forEach((thumbnail) => {
        thumbnail.addEventListener('click', () => open(thumbnail));
        thumbnail.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                open(thumbnail);
            }
        });
    });

    overlay.addEventListener('click', (event) => {
        if (event.target === overlay || event.target.closest('.lightbox-close')) close();
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !overlay.hidden) close();
    });
})();

/* ── Vidéo du premier écran ────────────────────────────────────────────────
   Elle démarre seule, donc en sourdine, et rend le son au premier geste.

   POURQUOI SANS SON. Aucun navigateur ne lance une vidéo sonore sans geste du
   visiteur. Demander le son ferait simplement échouer le démarrage, et la page
   afficherait une vignette figée là où on voulait du mouvement.

   POURQUOI LA FAÇADE SURVIT. Qui a réglé son système sur « animations
   réduites » demande précisément qu'une vidéo ne parte pas seule. Cette
   personne garde la vignette et son bouton de lecture, avec le son.

   CE QUE ÇA COÛTE, ET C'EST ASSUMÉ. Un démarrage automatique charge YouTube au
   chargement de la page : la visite y est annoncée sans clic, contrairement à
   la façade. C'est le prix du mouvement en haut de page. */
(() => {
    const support = document.querySelector('.hero-video');
    if (!support) return;

    const facade = support.querySelector('[data-hero-video]');
    if (!facade) return;

    const id = facade.getAttribute('data-hero-video');
    if (!id) return;

    const bouton = document.querySelector('[data-video-sound]');
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)');

    /** Le lecteur, muet ou non selon la façon dont on y arrive. */
    const poser = (muet) => {
        if (support.dataset.lance === '1') return null;
        support.dataset.lance = '1';

        const cadre = document.createElement('iframe');
        /* Une video de fond, pas un lecteur : rien a cliquer, rien a lire par-dessus.
           - controls=0, iv_load_policy=3, cc_load_policy=0, fs=0, disablekb=1 : pas de
             commandes, d'annotations, de sous-titres ni de plein ecran ;
           - le bandeau de titre et le logo, que YouTube pose quand meme au depart, tombent
             hors du cadre : le lecteur est un peu plus grand que lui (app.css) et ne recoit
             pas la souris, qui les ferait revenir. */
        const options = [
            'autoplay=1',
            'playsinline=1',
            'controls=0',
            'rel=0',
            'iv_load_policy=3',
            'cc_load_policy=0',
            'modestbranding=1',
            'disablekb=1',
            'fs=0',
            muet ? 'mute=1' : 'mute=0',
            // Pas de playlist pour boucler : elle pose des chevrons au centre. La boucle se
            // referme ici, juste avant la fin, comme sur les apercus (voir plus bas).
            // Sans enablejsapi, « activer le son » tomberait dans le vide : c'est ce
            // parametre qui fait ecouter postMessage au lecteur.
            'enablejsapi=1',
            'origin=' + encodeURIComponent(location.origin),
        ];
        cadre.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?' + options.join('&');
        cadre.title = facade.getAttribute('data-title') || '';
        cadre.referrerPolicy = 'strict-origin-when-cross-origin';
        cadre.allow = 'autoplay; encrypted-media';
        cadre.setAttribute('tabindex', '-1');
        cadre.setAttribute('frameborder', '0');

        // L'affiche reste, cachee : elle recouvre le lecteur quand une autre lecture demande
        // la place, plutot que de laisser voir la pause de YouTube et son gros bouton.
        const image = facade.querySelector('img');
        const affiche = image ? image.cloneNode() : null;
        if (affiche) {
            affiche.className = 'hero-poster';
            affiche.removeAttribute('fetchpriority');
            affiche.alt = '';
        }
        // L'affiche reste devant tant que YouTube montre son titre et son bouton central : elle
        // ne se leve qu'avec la lecture (voir plus bas). MESURE du 2026-09-17 : le cadre charge
        // ne suffisait pas, le bouton pause rond reste 4 s apres le DEBUT de la lecture.
        support.replaceChildren(...(affiche ? [cadre, affiche] : [cadre]));
        support.classList.add('is-playing', 'is-veiled');

        // Le lecteur ne parle que si on s'annonce, et il n'est pas pret quand le cadre se
        // charge : on redemande jusqu'a sa reponse.
        let essais = 0;
        const inscription = window.setInterval(() => {
            if (support.dataset.repondu === '1' || essais++ > 120) {
                window.clearInterval(inscription);
                return;
            }
            cadre.contentWindow?.postMessage(
                JSON.stringify({ event: 'listening', id: 'nelfeplay-hero' }),
                'https://www.youtube-nocookie.com',
            );
        }, 100);
        return cadre;
    };

    const commander = (func, args) => {
        const cadre = support.querySelector('iframe');
        cadre?.contentWindow?.postMessage(
            JSON.stringify({ event: 'command', func, args: args || [] }),
            'https://www.youtube-nocookie.com',
        );
    };

    /* Le bouton pause rond de YouTube reste au centre 4 s apres le demarrage, apres chaque
       saut (la boucle) et apres chaque reprise, commandes ou non : l'affiche le couvre ce
       temps-la. */
    const VoileYouTube = 4300;
    let voilage = 0;
    const voiler = () => {
        support.classList.add('is-veiled');
        window.clearTimeout(voilage);
        voilage = window.setTimeout(() => {
            if (support.dataset.figee !== '1') support.classList.remove('is-veiled', 'is-paused');
        }, VoileYouTube);
    };

    /* Ce que le lecteur du premier ecran raconte : on n'ecoute que lui. */
    window.addEventListener('message', (event) => {
        const cadre = support.querySelector('iframe');
        if (!cadre || event.source !== cadre.contentWindow
            || !/^https:\/\/www\.youtube-nocookie\.com$/.test(event.origin)) return;
        let charge;
        try {
            charge = JSON.parse(event.data);
        } catch (erreur) {
            return;
        }
        support.dataset.repondu = '1';

        if (charge?.event === 'onReady') {
            commander('addEventListener', ['onStateChange']);
            commander('playVideo');
            return;
        }
        let etat = null;
        if (charge?.event === 'onStateChange') etat = Number(charge.info);
        if (charge?.event === 'infoDelivery' && typeof charge.info?.playerState === 'number') etat = charge.info.playerState;

        // La boucle se referme juste avant la fin : a la fin, YouTube pose son ecran de
        // sortie, qu'une relance n'efface pas.
        if (charge?.event === 'infoDelivery') {
            const temps = Number(charge.info?.currentTime);
            const duree = Number(charge.info?.duration || support.dataset.duree || 0);
            if (charge.info?.duration) support.dataset.duree = String(charge.info.duration);
            if (duree > 0 && temps >= duree - 0.6) {
                commander('seekTo', [0, true]);
                commander('playVideo');
                if (support.dataset.figee !== '1' && support.dataset.boucle !== '1') {
                    // Une seule fois par boucle : les infos arrivent plusieurs fois avant le saut.
                    support.dataset.boucle = '1';
                    window.setTimeout(() => delete support.dataset.boucle, 2000);
                    voiler();
                }
                return;
            }
        }

        if (etat === null) return;
        if (etat === 1 && support.dataset.figee !== '1' && support.dataset.lecture !== '1') {
            support.dataset.lecture = '1';
            voiler();
        }
        if (etat === 0) {
            commander('seekTo', [0, true]);
            commander('playVideo');
            if (support.dataset.figee !== '1') voiler();
        }
    });

    /* Une seule lecture a la fois sur la page : les apercus au survol figent la video du
       premier ecran sur son affiche, et la rendent en partant. */
    window.NelfeHero = {
        pause() {
            if (support.dataset.lance !== '1' || support.dataset.figee === '1') return;
            support.dataset.figee = '1';
            support.classList.add('is-paused');
            commander('pauseVideo');
        },
        resume() {
            if (support.dataset.figee !== '1') return;
            delete support.dataset.figee;
            commander('playVideo');
            // L'affiche reste le temps que la reprise repasse par le bouton central.
            voiler();
        },
    };

    /* Le son se demande au lecteur déjà en place : le recharger ferait
       repartir la vidéo du début, ce qui n'est pas ce qu'on demande en
       cliquant « activer le son ». */
    const rendreLeSon = () => {
        const cadre = support.querySelector('iframe');
        if (!cadre || !cadre.contentWindow) return;
        ['unMute', 'playVideo'].forEach((func) => {
            cadre.contentWindow.postMessage(
                JSON.stringify({ event: 'command', func, args: [] }),
                'https://www.youtube-nocookie.com',
            );
        });
        if (bouton) bouton.hidden = true;
    };

    if (bouton) bouton.addEventListener('click', rendreLeSon);

    // Au clic sur la façade, le visiteur a fait un geste : le son part avec.
    facade.addEventListener('click', () => {
        poser(false);
        if (bouton) bouton.hidden = true;
    });
    facade.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            poser(false);
            if (bouton) bouton.hidden = true;
        }
    });

    if (support.getAttribute('data-autoplay') === '1' && !reduit.matches) {
        // `enablejsapi` est nécessaire pour que « activer le son » soit
        // entendu par le lecteur ; sans lui, postMessage tombe dans le vide.
        // Modifier `src` apres insertion rechargerait l'iframe, donc
        // chargerait la video deux fois.
        if (poser(true) && bouton) bouton.hidden = false;
    }
})();
