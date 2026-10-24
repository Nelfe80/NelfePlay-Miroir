/*
 * LE PREMIER RANG QUI TOMBE, EN DIRECT (CDC video V2, §5.8). Un bloc [data-record-live] reste cache tant qu'aucun
 * direct de record ne dure. Sur la fiche d'un jeu (data-system et data-game), il montre le direct de ce jeu ; sur la
 * page des classements, la liste des directs en cours, chacun menant a sa fiche ; sur la page des directs
 * (data-mode="lecteurs"), le lecteur de chaque direct en cours, avec le lien de son classement ; sur la fiche d'un
 * joueur (data-handle), le lecteur de son direct, avec le lien du classement. Relu toutes les 30
 * secondes : la page n'a pas besoin d'etre rechargee, et la copie figee du site le montre aussi.
 */
(() => {
    'use strict';

    const blocs = Array.from(document.querySelectorAll('[data-record-live]'));
    if (blocs.length === 0) {
        return;
    }
    const langue = (document.documentElement.lang || 'en').slice(0, 2);
    const nombre = (n) => {
        try {
            return Number(n).toLocaleString(document.documentElement.lang || 'en');
        } catch (_) {
            return String(n);
        }
    };
    const phrase = (modele, d, score) => String(modele || '')
        .replace(':player', d.player || 'player')
        .replace(':game', d.game_name || d.game || '')
        .replace(':score', nombre(score === undefined ? d.score : score))
        .replace(':record', nombre(d.record));
    // LA PHRASE SUIT LA PHASE DU DIRECT (15 octobre 2026) : ouvert a 90 % du record, « sur le point d'etablir un nouveau
    // record » ; quand il tombe, « vient d'etablir » avec le score du moment. Un direct d'avant (passed sans score du
    // moment) garde « est en train de battre ».
    const phraseDu = (bloc, d) => {
        if (d.passed === false && bloc.dataset.labelApproaching) {
            return phrase(bloc.dataset.labelApproaching, d);
        }
        if (d.passed === true && d.score_at_pass != null && bloc.dataset.labelBeaten) {
            return phrase(bloc.dataset.labelBeaten, d, d.score_at_pass);
        }
        return phrase(bloc.dataset.labelBeating, d);
    };
    const el = (balise, classe, texte) => {
        const e = document.createElement(balise);
        if (classe) {
            e.className = classe;
        }
        if (texte !== undefined) {
            e.textContent = texte;
        }
        return e;
    };

    const fiche = (d) => '/' + langue + '/rankings/' + encodeURIComponent(d.system) + '/' + encodeURIComponent(d.game);

    // L'ANNONCE (decision du 15 octobre 2026) : une video YouTube de quelques secondes, jouee avant le direct, une fois
    // par visite, par direct et par phase. Le site ne sert jamais de video : on enchaine deux lecteurs YouTube. La fin de
    // l'annonce se lit dans les messages du lecteur (enablejsapi) ; a defaut, sa duree connue fait foi. Tant que le
    // record tient, « World record alert » ; une fois tombe, « A new champion rises ».
    let intro = null;
    let introPasse = null;
    const YOUTUBE = 'https://www.youtube-nocookie.com';

    // LE SON (demande du user, 16 octobre 2026) : les lecteurs partent sans le son (lecture automatique) ; le bouton du
    // cadre de /lives l'active pour la visite, lecteur en cours et lecteurs suivants. Les navigateurs ne permettent la
    // lecture avec le son qu'apres un geste du spectateur sur la page : le choix ne se retient pas d'une visite a l'autre.
    let sonActif = false;
    const commande = (iframe, func, args) => {
        try {
            iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args: args || [] }), YOUTUBE);
        } catch (_) {
            // Lecteur pas encore pret : il recevra le son a son onReady.
        }
    };
    const appliquerLeSon = (iframe) => {
        if (sonActif) {
            commande(iframe, 'unMute');
            commande(iframe, 'setVolume', [100]);
        } else {
            commande(iframe, 'mute');
        }
    };
    // LA LANGUE DU SITE (demande du user, 18 octobre 2026) : le lecteur parle celle de la page (hl), et une video doublee
    // (une piste audio par langue, Another Kif par exemple) peut ainsi partir dans la langue du spectateur. Sans sous-titres.
    const langueYouTube = langue === 'zh' ? 'zh-CN' : langue;
    // `sousTitres` : la video ne parle pas la langue du spectateur, ses sous-titres restent (dans sa langue s'ils existent) ;
    // sinon (nos films de jeu, nos clips, une video doublee dans sa langue), ils sont coupes.
    const urlYouTube = (id, extra, sousTitres) => YOUTUBE + '/embed/' + encodeURIComponent(id) + '?autoplay=1&mute=' + (sonActif ? '0' : '1')
        + '&playsinline=1&rel=0&enablejsapi=1&hl=' + encodeURIComponent(langueYouTube)
        + (sousTitres ? '&cc_lang_pref=' + encodeURIComponent(langueYouTube) : '&cc_load_policy=0')
        + '&origin=' + encodeURIComponent(window.location.origin) + (extra || '');
    // Les sous-titres servent-ils ? Seulement quand aucune piste audio connue de la video n'est dans la langue de la page.
    const sousTitresUtiles = (v) => !!v && Array.isArray(v.audio) && v.audio.length > 0
        && !v.audio.includes('zxx') && !v.audio.includes(langue);
    // A chaque chargement (une annonce puis le direct dans le meme lecteur), on demande au lecteur ses evenements : la fin
    // d'une video, une erreur, et onReady pour lui donner le son.
    const ecouterLeLecteur = (iframe) => {
        iframe.addEventListener('load', () => {
            // La video que le lecteur a vraiment chargee : son adresse a pu changer depuis (l'annonce passe la main au
            // direct), et les derniers messages de l'annonce arrivent encore apres ce changement.
            const charge = /\/embed\/([^?]+)/.exec(iframe.src);
            iframe.dataset.videoChargee = charge ? decodeURIComponent(charge[1]) : '';
            iframe.dataset.videoJouee = '';
            try {
                iframe.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), YOUTUBE);
                iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'addEventListener', args: ['onStateChange'] }), YOUTUBE);
                iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'addEventListener', args: ['onError'] }), YOUTUBE);
            } catch (_) {
                // Les minuteurs prendront le relais.
            }
        });
    };
    // LES SOUS-TITRES COUPES (demande du user, 18 octobre 2026) : YouTube les affiche de lui-meme quand la langue de la
    // video differe de celle du lecteur ; cc_load_policy=0 ne suffit pas. Le module des sous-titres se decharge des que
    // le lecteur est pret, puis au debut de la lecture (il se charge avec la video).
    window.addEventListener('message', (ev) => {
        if (ev.origin !== YOUTUBE || typeof ev.data !== 'string') {
            return;
        }
        try {
            const m = JSON.parse(ev.data);
            const etat = m.event === 'onStateChange' ? m.info : m.event === 'infoDelivery' && m.info ? m.info.playerState : null;
            if (m.event === 'onReady' || m.event === 'initialDelivery' || etat === 1) {
                const iframe = Array.from(document.querySelectorAll('[data-record-live] iframe')).find((f) => f.contentWindow === ev.source);
                if (iframe && iframe.dataset.sousTitres !== 'auto' && (etat !== 1 || iframe.dataset.sansSousTitres !== iframe.src)) {
                    commande(iframe, 'unloadModule', ['captions']);
                    commande(iframe, 'unloadModule', ['cc']);
                    if (etat === 1) {
                        iframe.dataset.sansSousTitres = iframe.src;
                    }
                }
            }
        } catch (_) {
            // Un autre message.
        }
    });
    window.addEventListener('message', (ev) => {
        if (ev.origin !== YOUTUBE || typeof ev.data !== 'string' || !sonActif) {
            return;
        }
        try {
            const m = JSON.parse(ev.data);
            if (m.event === 'onReady' || m.event === 'initialDelivery') {
                const iframe = Array.from(document.querySelectorAll('[data-record-live] iframe')).find((f) => f.contentWindow === ev.source);
                if (iframe) {
                    appliquerLeSon(iframe);
                }
            }
        } catch (_) {
            // Un autre message.
        }
    });

    const dejaAnnonce = (id) => {
        try {
            return sessionStorage.getItem('nelfe-annonce-' + id) === '1';
        } catch (_) {
            return false;
        }
    };
    const noterAnnonce = (id) => {
        try {
            sessionStorage.setItem('nelfe-annonce-' + id, '1');
        } catch (_) {
            // Sans stockage, l'annonce repassera : sans gravite.
        }
    };

    function enchainer(iframe, direct, annonce) {
        let fini = false;
        const passer = () => {
            if (fini) {
                return;
            }
            fini = true;
            window.removeEventListener('message', ecouter);
            // L'adresse se fait au moment de passer : le son a pu etre active pendant l'annonce.
            iframe.src = typeof direct === 'function' ? direct() : direct;
        };
        const ecouter = (ev) => {
            if (ev.source !== iframe.contentWindow || typeof ev.data !== 'string') {
                return;
            }
            try {
                const m = JSON.parse(ev.data);
                const etat = m.event === 'onStateChange' ? m.info : m.event === 'infoDelivery' && m.info ? m.info.playerState : null;
                if (etat === 0 || m.event === 'onError') {
                    passer();
                }
            } catch (_) {
                // Un autre message.
            }
        };
        window.addEventListener('message', ecouter);
        iframe.addEventListener('load', () => {
            if (fini) {
                return;
            }
            try {
                iframe.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), YOUTUBE);
                iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'addEventListener', args: ['onStateChange'] }), YOUTUBE);
            } catch (_) {
                // Le minuteur prendra le relais.
            }
            // La duree connue, plus le temps que le lecteur demarre.
            window.setTimeout(passer, Math.round((annonce.seconds || 4) * 1000) + 3000);
        }, { once: true });
    }

    function cadre(bloc, d) {
        const c = el('div', 'record-live__frame');
        const iframe = document.createElement('iframe');
        const direct = () => urlYouTube(d.youtube_id);
        const passe = d.passed === true;
        const annonce = passe ? introPasse || intro : intro;
        const cle = d.youtube_id + (passe ? '-passe' : '');
        ecouterLeLecteur(iframe);
        if (annonce && annonce.video && !dejaAnnonce(cle)) {
            noterAnnonce(cle);
            iframe.src = urlYouTube(annonce.video, '&controls=0');
            enchainer(iframe, direct, annonce);
        } else {
            iframe.src = direct();
            iframe.loading = 'lazy';
        }
        iframe.title = bloc.dataset.labelPlayer || 'Live';
        iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
        iframe.allowFullscreen = true;
        c.append(iframe);
        return c;
    }

    function tete(bloc, d) {
        const t = el('div', 'record-live__head');
        t.append(el('span', 'record-live__badge', bloc.dataset.labelLive || 'LIVE'));
        t.append(el('p', 'record-live__text', phraseDu(bloc, d)));
        return t;
    }

    // Le meme direct dont seule la phase change (le record tombe) : la phrase se recrit, le lecteur ne se recharge pas.
    function recrire(bloc, directs) {
        const textes = bloc.querySelectorAll('.record-live__text');
        directs.forEach((d, i) => {
            if (textes[i]) {
                textes[i].textContent = phraseDu(bloc, d);
            }
        });
    }

    function lecteur(bloc, d) {
        if (bloc.dataset.youtube === d.youtube_id) {
            recrire(bloc, [d]);
            return;
        }
        bloc.dataset.youtube = d.youtube_id;
        bloc.replaceChildren(tete(bloc, d), cadre(bloc, d));
    }

    // La page des directs : le lecteur de chaque direct en cours (un seul a la fois, en pratique), et le lien de son
    // classement. Le nom du jeu ne se traduit pas.
    function lecteurs(bloc, directs) {
        const cle = directs.map((d) => d.youtube_id).join(',');
        if (bloc.dataset.youtube === cle) {
            recrire(bloc, directs);
            return;
        }
        bloc.dataset.youtube = cle;
        bloc.replaceChildren(...directs.map((d) => {
            const article = el('article', 'record-live__one');
            const t = tete(bloc, d);
            const lien = el('a', 'record-live__sheet', d.game_name || d.game);
            lien.href = fiche(d);
            lien.setAttribute('translate', 'no');
            t.append(lien);
            article.append(t, cadre(bloc, d));
            return article;
        }));
    }

    // LE DIRECT PARTAGE (CDC video V2.1, §5.2, 16 octobre 2026) : sur la page des directs, un seul lecteur. L'alert d'un
    // record en cours passe avant tout (le « flash », avec son annonce) ; sinon la borne a l'antenne ; sinon l'attente.
    // Un passage qui finit laisse la place au suivant des qu'il est a l'antenne : la borne sortante tient son flux
    // jusque-la, notre lecteur ne voit jamais de coupure.
    let partages = [];
    // La video jouee en boucle quand aucune borne n'est a l'antenne (« No live right now », 16 octobre 2026).
    let repos = null;

    // LA FIN D'UN DIRECT VUE PAR LE LECTEUR (2026-10-16) : une borne qui se tait sans clore son direct le laissait « en
    // direct » sur nos pages jusqu'a l'entretien du site, le lecteur fige sur la fin. Quand le lecteur d'un direct dit
    // qu'il a fini (etat 0), la page le retire pour la visite et passe a la suite. Une annonce qui finit n'est pas un
    // direct : elle ne compte pas.
    const directsFinis = new Set();
    let directsVus = [];
    // LE RELAIS (18 octobre 2026) : un direct partage enchaine les parties d'une meme borne sur la meme diffusion. Entre
    // deux parties, le flux s'interrompt quelques secondes : le lecteur peut s'y dire fini, ou rester bloque sur ses
    // dernieres secondes. Il se recharge alors, au bord du direct (au plus une fois toutes les 20 s).
    const rechargerLeDirect = (iframe, id, delai) => {
        const maintenant = Date.now();
        if (Number(iframe.dataset.recharge || 0) > maintenant - 20000) {
            return;
        }
        iframe.dataset.recharge = String(maintenant);
        window.setTimeout(() => {
            if (iframe.isConnected && partages.some((p) => p.youtube_id === id)) {
                iframe.src = urlYouTube(id);
            }
        }, delai);
    };
    window.addEventListener('message', (ev) => {
        if (ev.origin !== YOUTUBE || typeof ev.data !== 'string') {
            return;
        }
        let m;
        try {
            m = JSON.parse(ev.data);
        } catch (_) {
            return;
        }
        const etat = m.event === 'onStateChange' ? m.info : m.event === 'infoDelivery' && m.info ? m.info.playerState : null;
        if (etat !== 0 && etat !== 1) {
            return;
        }
        // La video chargee, jamais l'adresse en cours : la fin de l'annonce, vue apres que le lecteur est passe au direct,
        // retirait le direct (2026-10-16). Et seulement un direct qu'on a vu jouer dans ce lecteur.
        const iframe = Array.from(document.querySelectorAll('[data-record-live] iframe')).find((f) => f.contentWindow === ev.source);
        const id = iframe ? iframe.dataset.videoChargee || '' : '';
        if (etat === 1) {
            if (iframe) {
                iframe.dataset.videoJouee = id;
            }
            return;
        }
        if (id !== '' && iframe.dataset.videoJouee === id && !directsFinis.has(id) && directsVus.includes(id)) {
            // Un direct partage ne finit que quand le site le dit (il coupe lui-meme un flux fige) : le 18 octobre, la page
            // le retirait pour la visite des le premier relais, et la programmation, en pause pendant le direct, rejouait
            // en boucle le meme moment de la rediffusion de theJim.
            if (partages.some((p) => p.youtube_id === id)) {
                rechargerLeDirect(iframe, id, 5000);
                return;
            }
            directsFinis.add(id);
            lire();
        }
    });

    // LE CADRE DE TELEVISEUR DU GRAND LECTEUR (demande du user, 16 octobre 2026). Les regles d'integration de YouTube
    // interdisent de poser quoi que ce soit sur son lecteur : la pastille (LIVE, ou RERUN pour une video de la chaine), le
    // bouton du son, les informations et le logo NelfePlay TV sont dans le cadre, autour de l'ecran (en haut a gauche, en
    // haut a droite, en bas a gauche, en bas a droite) ; l'effet cathodique habille le cadre, jamais l'image.
    const LOGO_TV = '/assets/images/nelfeplay-tv.png';
    const LOGO_TITRE = '/assets/images/nelfeplay-tv-titre.png';
    // Le jour (2026-10-17) : « Nelfe » en encre, le blanc d'origine disparaissant sur le fond blanc.
    const LOGO_TITRE_JOUR = '/assets/images/nelfeplay-tv-titre-jour.png';
    const ICONE_MUET = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>';
    const ICONE_SON = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>';

    function boutonDuSon(bloc) {
        const bouton = el('button', 'tv__son');
        bouton.type = 'button';
        const montrer = () => {
            bouton.setAttribute('aria-pressed', sonActif ? 'true' : 'false');
            bouton.innerHTML = sonActif ? ICONE_SON : ICONE_MUET;
            bouton.append(el('span', '', sonActif ? bloc.dataset.labelSoundOff || 'Mute' : bloc.dataset.labelSoundOn || 'Sound on'));
        };
        bouton.addEventListener('click', () => {
            sonActif = !sonActif;
            montrer();
            document.querySelectorAll('[data-record-live] iframe').forEach(appliquerLeSon);
        });
        montrer();
        return bouton;
    }

    // LE PLEIN ECRAN DU CADRE SEUL (demande du user, 16 octobre 2026) : le televiseur entier (pastille, ecran, informations,
    // logo), pas la page. Cache la ou le navigateur ne le permet pas (iPhone).
    const ICONE_PLEIN = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';
    const ICONE_SORTIE = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';
    const enPleinEcran = () => document.fullscreenElement || document.webkitFullscreenElement || null;

    function boutonDuPleinEcran(bloc, racine) {
        const bouton = el('button', 'tv__plein');
        bouton.type = 'button';
        bouton.hidden = !(document.fullscreenEnabled || document.webkitFullscreenEnabled);
        const montrer = () => {
            const dedans = enPleinEcran() === racine;
            const libelle = dedans ? bloc.dataset.labelFullscreenExit || 'Exit full screen' : bloc.dataset.labelFullscreen || 'Full screen';
            bouton.innerHTML = dedans ? ICONE_SORTIE : ICONE_PLEIN;
            bouton.setAttribute('aria-label', libelle);
            bouton.title = libelle;
        };
        bouton.addEventListener('click', () => {
            try {
                if (enPleinEcran() === racine) {
                    (document.exitFullscreen || document.webkitExitFullscreen).call(document);
                } else {
                    const p = (racine.requestFullscreen || racine.webkitRequestFullscreen).call(racine);
                    if (p && typeof p.catch === 'function') {
                        p.catch(() => {});
                    }
                }
            } catch (_) {
                // Plein ecran refuse par le navigateur : le cadre reste dans la page.
            }
        });
        document.addEventListener('fullscreenchange', montrer);
        document.addEventListener('webkitfullscreenchange', montrer);
        montrer();
        return bouton;
    }

    function televiseur(bloc) {
        const racine = el('div', 'tv');
        const haut = el('div', 'tv__bord tv__bord--haut');
        const pastille = el('span', 'tv__pastille');
        const texte = el('p', 'record-live__text tv__texte');
        const droite = el('div', 'tv__droite');
        const lien = el('a', 'tv__lien');
        lien.setAttribute('translate', 'no');
        droite.append(lien, boutonDuSon(bloc), boutonDuPleinEcran(bloc, racine));
        haut.append(pastille, texte, droite);
        const ecran = el('div', 'record-live__frame tv__ecran');
        const bas = el('div', 'tv__bord tv__bord--bas');
        const infos = el('p', 'tv__infos');
        infos.setAttribute('translate', 'no');
        const logo = document.createElement('img');
        logo.className = 'tv__logo';
        logo.src = LOGO_TV;
        logo.alt = 'NelfePlay TV';
        logo.width = 120;
        logo.height = 40;
        // LA BARRE DU PROGRAMME ET « A SUIVRE » (demande du user, 16 octobre 2026) : pendant la programmation seulement,
        // l'avancee du programme en cours sur toute la largeur, puis ce qui vient et dans combien de temps.
        const progres = el('div', 'tv__progres');
        const plein = el('span', 'tv__progres-plein');
        progres.append(plein);
        progres.hidden = true;
        const suivant = el('p', 'tv__suivant');
        suivant.setAttribute('translate', 'no');
        suivant.hidden = true;
        bas.append(progres, infos, suivant, logo);
        racine.append(haut, ecran, bas);
        // En plein ecran (l'ecran d'une salle), la souris se cache apres 3 secondes sans mouvement.
        let calme = 0;
        racine.addEventListener('mousemove', () => {
            racine.classList.remove('tv--calme');
            window.clearTimeout(calme);
            calme = window.setTimeout(() => racine.classList.add('tv--calme'), 3000);
        });
        // Une partie vide se cache : pas de pastille pendant « No live right now », pas de lien sans jeu.
        // Le lien du haut : la fiche du jeu, ou la chaine d'un invite (sur YouTube, dans un nouvel onglet).
        const remplir = ({ etiquette = '', rerun = false, invite = false, phrase: texteDuHaut = '', jeu = null, chaine = null, details = '' }) => {
            pastille.textContent = etiquette;
            pastille.hidden = etiquette === '';
            pastille.classList.toggle('tv__pastille--rerun', rerun);
            pastille.classList.toggle('tv__pastille--guest', invite);
            texte.textContent = texteDuHaut;
            texte.hidden = texteDuHaut === '';
            lien.hidden = !jeu && !chaine;
            lien.removeAttribute('target');
            lien.removeAttribute('rel');
            if (jeu) {
                lien.textContent = jeu.game_name || jeu.game;
                lien.href = fiche(jeu);
            } else if (chaine) {
                lien.textContent = chaine.nom;
                lien.href = chaine.url;
                lien.target = '_blank';
                lien.rel = 'noopener';
            }
            infos.textContent = details;
        };
        let avance = 0;
        const programme = (etat) => {
            progres.hidden = !etat;
            suivant.hidden = !etat || !etat.titre;
            if (!etat) {
                return;
            }
            const part = Math.max(0, Math.min(1, etat.progres));
            // Un nouveau programme repart de zero d'un coup, sans revenir en arriere a l'ecran.
            plein.style.transition = part < avance ? 'none' : '';
            plein.style.width = (part * 100).toFixed(2) + '%';
            avance = part;
            const reste = Math.max(0, Math.ceil(etat.reste));
            suivant.replaceChildren(el('strong', 'tv__suivant-titre', bloc.dataset.labelNext || 'Up next'),
                el('span', 'tv__suivant-temps', Math.floor(reste / 60) + ':' + String(reste % 60).padStart(2, '0')),
                document.createTextNode(' ' + etat.titre));
        };
        return { racine, ecran, remplir, programme };
    }

    function iframeYouTube(id, titre, parametres, sousTitres) {
        const iframe = document.createElement('iframe');
        iframe.dataset.sousTitres = sousTitres ? 'auto' : 'off';
        iframe.src = urlYouTube(id, parametres, sousTitres);
        iframe.title = titre || 'NelfePlay TV';
        iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
        iframe.allowFullscreen = true;
        ecouterLeLecteur(iframe);
        return iframe;
    }

    const separe = (...parts) => parts.filter((x) => x !== undefined && x !== null && String(x).trim() !== '').join(' · ');
    const dateDe = (iso) => {
        if (!iso) {
            return '';
        }
        try {
            return new Date(iso + 'T12:00:00Z').toLocaleDateString(document.documentElement.lang || 'en');
        } catch (_) {
            return iso;
        }
    };

    // Le titre du grand lecteur : le logo NelfePlay TV, en grand (demande du user, 16 octobre 2026).
    const titreAntenne = () => {
        const titre = el('h2', 'record-live__title');
        // Deux logos, un par theme ; la feuille montre le bon.
        for (const [src, theme, alt] of [[LOGO_TITRE_JOUR, 'jour', 'NelfePlay TV'], [LOGO_TITRE, 'nuit', '']]) {
            const logo = document.createElement('img');
            logo.className = 'record-live__logo record-live__logo--' + theme;
            logo.src = src;
            logo.alt = alt;
            logo.width = 720;
            logo.height = 240;
            titre.append(logo);
        }
        return titre;
    };

    // Les introductions du grand lecteur (clips du user, 16 octobre 2026), lues dans l'API des directs.
    let intros = {};

    // LA PROGRAMMATION SANS DIRECT (demande du user, 16 octobre 2026) : « No live right now » entre chaque video de la
    // chaine, toujours. Un record : « Replays & features », sa video, « Current leaderboard » puis le classement a jour de
    // son jeu ; une video Spotlight : « History, strategies and high scores » puis la video ; la capsule du jeu en cours et
    // la bande-annonce sans introduction. Depuis le soir du 16 octobre, tout se cale sur l'horloge (voir grilleDe) : chacun
    // voit la meme chose au meme moment ; la fin signalee par le lecteur YouTube (etat 0) n'avance que de quelques secondes.
    let programme = null;
    const SECONDES_DU_CLASSEMENT = 15;

    function arreterLeProgramme() {
        if (programme) {
            programme.arreter();
            programme = null;
        }
    }

    const lienDu = (v) => (v.system && v.rom_group ? { system: v.system, game: v.rom_group, game_name: v.game } : null);

    // Ce que le cadre dit d'une video de la chaine : RERUN, puis jeu, mode, score, joueur et date.
    function cadreDuRerun(bloc, v) {
        const rerun = { etiquette: bloc.dataset.labelRerun || 'Rerun', rerun: true, jeu: lienDu(v) };
        if (v.kind === 'record') {
            // Le film du 2e ou du 3e (18 octobre 2026) dit son rang.
            const rang = Number(v.rank) > 1 ? '#' + v.rank : '';
            return { ...rerun, details: separe(v.game, (v.ruleset || '').toUpperCase(), rang, v.score ? nombre(v.score) : '', v.player, dateDe(v.date)) };
        }
        if (v.kind === 'spotlight') {
            return { ...rerun, details: separe(v.game, 'History, Strategies and High Scores', dateDe(v.date)) };
        }
        if (v.kind === 'capsule') {
            return { ...rerun, details: separe(v.game, 'Certified scoring is open', dateDe(v.date)) };
        }
        // UN INVITE (17 octobre 2026) : la video d'un autre createur, avec son accord ; sa chaine en lien, en haut.
        if (v.kind === 'guest') {
            const url = String(v.channel_url || '');
            return {
                etiquette: bloc.dataset.labelGuest || 'Guest', invite: true,
                chaine: v.channel ? { nom: v.channel, url: url.startsWith('https://www.youtube.com/') ? url : 'https://www.youtube.com/watch?v=' + v.video } : null,
                details: separe(v.title, dateDe(v.date)),
            };
        }
        return { ...rerun, details: 'NelfePlay' };
    }

    // Le classement a jour du jeu du replay, dans l'ecran (le lecteur YouTube n'y est plus : rien ne se pose sur lui).
    function tableauDuClassement(v) {
        const panneau = el('div', 'tv__classement');
        const tete = el('div', 'tv__classement-tete');
        const jeu = el('p', 'tv__classement-jeu', v.game || '');
        jeu.setAttribute('translate', 'no');
        tete.append(jeu, el('p', 'tv__classement-regle', (v.ruleset || '').toUpperCase()));
        const ol = el('ol', 'tv__classement-liste');
        (v.board || []).forEach((ligne, i) => {
            const li = el('li', 'tv__rang' + (i < 3 ? ' tv__rang--' + (i + 1) : ''));
            li.style.setProperty('--i', String(i));
            const joueur = el('span', 'tv__rang-joueur', ligne.player || '—');
            joueur.setAttribute('translate', 'no');
            li.append(el('span', 'tv__rang-n', String(ligne.rank || i + 1)), joueur, el('span', 'tv__rang-score', nombre(ligne.score)));
            ol.append(li);
        });
        panneau.append(tete, ol);
        return panneau;
    }

    // Les etapes d'une video de la chaine, introductions comprises.
    function etapesDe(bloc, v) {
        const cadre = cadreDuRerun(bloc, v);
        const etapes = [];
        const intro = v.kind === 'record' ? intros.replay : v.kind === 'spotlight' ? intros.spotlight : null;
        if (intro && intro.video) {
            etapes.push({ cadre, video: intro.video, seconds: intro.seconds });
        }
        // L'extrait d'une archive de la chaine (le moment du record) : son debut et sa fin dans la video.
        etapes.push({ cadre, video: v.video, seconds: v.seconds, start: Number(v.start) || 0, end: Number(v.end) || 0 });
        if (v.kind === 'record' && Array.isArray(v.board) && v.board.length > 0) {
            const cadreDuClassement = { jeu: lienDu(v), details: separe(v.game, (v.ruleset || '').toUpperCase()) };
            if (intros.leaderboard && intros.leaderboard.video) {
                etapes.push({ cadre: cadreDuClassement, video: intros.leaderboard.video, seconds: intros.leaderboard.seconds });
            }
            etapes.push({ cadre: cadreDuClassement, classement: v, seconds: SECONDES_DU_CLASSEMENT });
        }
        return etapes;
    }

    // LA GRILLE DE L'ANTENNE (programmation synchronisee, demande du user, 16 octobre 2026) : « No live right now » puis
    // une video de la chaine et ses introductions, pour chaque video, dans l'ordre du serveur. Tous les spectateurs la
    // calculent pareil : memes videos, memes durees (donnees par le serveur), meme repere (l'instant ou elle a commence).
    function grilleDe(bloc) {
        const attente = { cadre: { details: bloc.dataset.labelIdle || '' }, video: repos.video, seconds: Number(repos.seconds) || 8 };
        const etapes = [];
        // Un programme : « No live right now » et la video avec ses introductions (et le classement, pour un record).
        (repos.playlist || []).filter((v) => v && v.video && Number(v.seconds) > 0).forEach((v, g) => {
            etapes.push({ ...attente, groupe: g, v }, ...etapesDe(bloc, v).map((e) => ({ ...e, groupe: g, v })));
        });
        return etapes.length > 0 ? etapes : [{ ...attente, groupe: 0, v: null }];
    }

    // Ce que « A suivre » dit d'un programme.
    function titreDuProgramme(v) {
        if (v.kind === 'record') {
            return separe(v.game, (v.ruleset || '').toUpperCase(), Number(v.rank) > 1 ? '#' + v.rank : '', v.player);
        }
        if (v.kind === 'spotlight') {
            return separe(v.game, 'History, Strategies and High Scores');
        }
        if (v.kind === 'capsule') {
            return separe(v.game, 'Certified scoring is open');
        }
        if (v.kind === 'guest') {
            return separe(v.channel, v.title);
        }
        return 'NelfePlay';
    }

    // L'horloge du spectateur, corrigee seulement si elle s'ecarte nettement de celle du serveur (la reponse de l'API peut
    // avoir quinze secondes de cache : un petit ecart ne se corrige pas).
    let decalageHorloge = 0;
    const maintenantMs = () => Date.now() + decalageHorloge;

    // Ce qui passe a l'instant : l'etape de la grille et la seconde ou elle en est.
    function ouEnEst(etapes, depuis) {
        const total = etapes.reduce((s, e) => s + e.seconds, 0);
        let p = (((maintenantMs() / 1000 - depuis) % total) + total) % total;
        for (let i = 0; i < etapes.length; i++) {
            if (p < etapes[i].seconds) {
                return { i, o: p };
            }
            p -= etapes[i].seconds;
        }
        return { i: 0, o: 0 };
    }

    // LE FIL CONTINU (18 octobre 2026) : `precedent`, ce que montrait le programme d'avant (une nouvelle video entree dans
    // le fil, un fil remelange) ; s'il passe la meme video au meme moment, elle reste a l'ecran sans recharger. `fondu` :
    // le retour d'un direct, en douceur.
    const signalees = new Set();
    const signalerInjouable = (video) => {
        if (signalees.has(video)) {
            return;
        }
        signalees.add(video);
        fetch('/api/v1/lives/unplayable', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ video }) }).catch(() => {});
    };

    function programmer(bloc, tv, precedent, fondu) {
        const etapes = grilleDe(bloc);
        const depuis = Number(repos.since) || 0;
        let courante = -1;
        let finPrevue = 0;
        let ecran = precedent ? precedent.noeud : null;
        let videoAffichee = '';
        let origineVideo = 0;
        let minuteur = 0;
        let arrete = false;
        const remplacer = (noeud) => {
            if (ecran && ecran.isConnected) {
                ecran.replaceWith(noeud);
            } else {
                tv.ecran.append(noeud);
            }
            ecran = noeud;
            if (fondu) {
                fondu = false;
                tv.ecran.classList.add('tv__ecran--fondu');
                window.setTimeout(() => tv.ecran.classList.remove('tv__ecran--fondu'), 1200);
            }
        };
        const ecouter = (ev) => {
            if (!ecran || ecran.tagName !== 'IFRAME' || ev.source !== ecran.contentWindow || typeof ev.data !== 'string') {
                return;
            }
            try {
                const m = JSON.parse(ev.data);
                const etat = m.event === 'onStateChange' ? m.info : m.event === 'infoDelivery' && m.info ? m.info.playerState : null;
                // Une video finie un peu avant l'heure (durees a la seconde, demarrage du lecteur) : l'etape suivante tout
                // de suite. Plus tot (une video coupee), l'ecran attend l'heure prevue : la grille ne se decale pas pour un
                // spectateur.
                if (etat === 0 && finPrevue - maintenantMs() <= 3000) {
                    etape(true);
                }
                // UNE VIDEO QUE LE LECTEUR NE PEUT PAS JOUER (18 octobre 2026, une video de Bob Morane passee en privee) :
                // l'ecran attendait sa duree sur une erreur. On passe a la suivante, et le site, prevenu, la retire.
                if (m.event === 'onError' && videoAffichee !== '') {
                    signalerInjouable(videoAffichee);
                    etape(true);
                }
            } catch (_) {
                // Un autre message.
            }
        };
        const attendre = (secondes) => {
            window.clearTimeout(minuteur);
            minuteur = window.setTimeout(() => etape(false), Math.max(0, Math.round(secondes * 1000)));
        };
        // A chaque etape, la position se relit sur l'horloge : un minuteur en retard ou une video finie en avance ne
        // decalent jamais la grille.
        function etape(suivante) {
            if (arrete) {
                return;
            }
            let { i, o } = ouEnEst(etapes, depuis);
            // La video qu'on voit a fini : on passe a la suivante, meme si l'horloge la dit encore en cours.
            if (suivante && i === courante) {
                i = (i + 1) % etapes.length;
                o = 0;
            }
            // Moins de deux secondes a voir d'une etape : la suivante.
            if (etapes.length > 1 && etapes[i].seconds - o < 2) {
                i = (i + 1) % etapes.length;
                o = 0;
            }
            courante = i;
            const e = etapes[i];
            finPrevue = maintenantMs() + (e.seconds - o) * 1000;
            tv.remplir(e.cadre);
            if (e.classement) {
                remplacer(tableauDuClassement(e.classement));
                videoAffichee = '';
                precedent = null;
                attendre(e.seconds - o);
                return;
            }
            // UNE VIDEO DEJA EN ERREUR POUR CE SPECTATEUR (20 octobre 2026, le film de 1942 1LC de theJim rendu prive hors du
            // site) : l'erreur passait a l'etape suivante, puis l'horloge ramenait la meme video, et l'ecran bouclait sur
            // l'erreur tout le temps de son creneau. On ne la recharge plus : le classement du record la remplace, ou un ecran
            // vide, jusqu'a l'etape suivante ; le site, prevenu, la retire de la grille.
            if (signalees.has(e.video)) {
                const v = e.v;
                remplacer(v && v.kind === 'record' && Array.isArray(v.board) && v.board.length > 0
                    ? tableauDuClassement(v) : document.createElement('div'));
                videoAffichee = '';
                precedent = null;
                attendre(e.seconds - o);
                return;
            }
            // La meme video, au meme moment, que le programme d'avant : elle continue a l'ecran.
            if (precedent && precedent.video === e.video && precedent.noeud.isConnected
                && Math.abs((maintenantMs() - precedent.origine) / 1000 - o) < 4) {
                ecran = precedent.noeud;
                videoAffichee = precedent.video;
                origineVideo = precedent.origine;
                precedent = null;
                attendre(e.seconds - o + 0.5);
                return;
            }
            precedent = null;
            // Arrive en cours de video : on la prend la ou elle en est, une seconde plus loin (le temps que le lecteur parte).
            const avance = o >= 2 ? Math.floor(o + 1) : 0;
            const debut = (e.start || 0) + avance;
            remplacer(iframeYouTube(e.video, 'NelfePlay TV', '&controls=0' + (debut > 0 ? '&start=' + debut : '')
                + (e.end > debut ? '&end=' + e.end : ''), !!e.v && e.video === e.v.video && sousTitresUtiles(e.v)));
            videoAffichee = e.video;
            origineVideo = maintenantMs() - avance * 1000;
            attendre(e.seconds - o + 0.5);
        }
        window.addEventListener('message', ecouter);
        etape(false);
        // La barre du programme, relue chaque seconde sur l'horloge : debut et duree de chaque programme dans la grille.
        const groupes = [];
        let cumul = 0;
        etapes.forEach((e) => {
            const g = groupes[e.groupe] || (groupes[e.groupe] = { debut: cumul, duree: 0, v: e.v });
            g.duree += e.seconds;
            cumul += e.seconds;
        });
        const suivre = () => {
            if (groupes.length < 2) {
                tv.programme(null);
                return;
            }
            const p = (((maintenantMs() / 1000 - depuis) % cumul) + cumul) % cumul;
            const k = Math.max(0, groupes.findIndex((g) => p >= g.debut && p < g.debut + g.duree));
            const g = groupes[k];
            const prochain = groupes[(k + 1) % groupes.length];
            tv.programme({ progres: (p - g.debut) / g.duree, reste: g.debut + g.duree - p, titre: prochain.v ? titreDuProgramme(prochain.v) : '' });
        };
        suivre();
        const horloge = window.setInterval(suivre, 1000);
        programme = {
            arreter() {
                arrete = true;
                window.clearTimeout(minuteur);
                window.clearInterval(horloge);
                window.removeEventListener('message', ecouter);
                tv.programme(null);
            },
            // Ce qui est a l'ecran : la video, et l'instant ou elle aurait commence.
            courant() {
                return ecran && videoAffichee ? { noeud: ecran, video: videoAffichee, origine: origineVideo } : null;
            },
        };
    }

    // UN SEUL TELEVISEUR PAR PAGE : l'attente, une borne a l'antenne et un record changent ce que montre son ecran, jamais
    // le cadre. Un cadre mis en plein ecran (l'ecran d'une salle) le reste donc d'un programme a l'autre.
    function televiseurDu(bloc) {
        if (!bloc.tv || !bloc.contains(bloc.tv.racine)) {
            bloc.tv = televiseur(bloc);
            bloc.replaceChildren(titreAntenne(), bloc.tv.racine);
        }
        return bloc.tv;
    }

    function antenne(bloc, directs) {
        const flash = directs[0] || null;
        // Un direct ou un record commence : la programmation s'arrete.
        if (flash || partages[0]) {
            arreterLeProgramme();
        }
        if (flash) {
            const cle = 'record:' + flash.youtube_id;
            if (bloc.dataset.youtube === cle) {
                recrire(bloc, [flash]);
                return;
            }
            bloc.dataset.youtube = cle;
            const tv = televiseurDu(bloc);
            tv.remplir({
                etiquette: bloc.dataset.labelLive || 'LIVE', phrase: phraseDu(bloc, flash), jeu: flash,
                details: separe(flash.player, flash.game_name || flash.game, flash.record ? 'RECORD ' + nombre(flash.record) : ''),
            });
            // Le lecteur d'un direct de record, avec son annonce (cadre), passe dans l'ecran.
            tv.ecran.classList.remove('record-live__frame--idle');
            tv.ecran.replaceChildren(...cadre(bloc, flash).childNodes);
            return;
        }
        const passage = partages[0] || null;
        if (passage) {
            const cle = 'partage:' + passage.youtube_id;
            const remplirLePassage = (tv) => tv.remplir({
                etiquette: bloc.dataset.labelLive || 'LIVE', phrase: phrase(bloc.dataset.labelOnAir, passage), jeu: passage,
                details: separe(passage.player, passage.game_name || passage.game, (passage.ruleset || '').toUpperCase()),
            });
            const details = [passage.passage || '', passage.game, passage.ruleset].join(':');
            if (bloc.dataset.youtube === cle) {
                // La meme diffusion : une nouvelle partie de la meme borne (le relais), ou un mode qui change. Le cadre
                // suit ; apres un relais, le lecteur se recharge quand le nouvel envoi est parti.
                if (bloc.dataset.details !== details) {
                    const relaye = (bloc.dataset.passage || '') !== '' && (passage.passage || '') !== bloc.dataset.passage;
                    bloc.dataset.details = details;
                    bloc.dataset.passage = passage.passage || '';
                    remplirLePassage(televiseurDu(bloc));
                    const lecteurEnCours = bloc.tv ? bloc.tv.ecran.querySelector('iframe') : null;
                    if (relaye && lecteurEnCours) {
                        rechargerLeDirect(lecteurEnCours, passage.youtube_id, 12000);
                    }
                }
                return;
            }
            bloc.dataset.youtube = cle;
            bloc.dataset.details = details;
            bloc.dataset.passage = passage.passage || '';
            const tv = televiseurDu(bloc);
            tv.ecran.classList.remove('record-live__frame--idle');
            remplirLePassage(tv);
            const lecteurDuPassage = iframeYouTube(passage.youtube_id, bloc.dataset.labelPlayer);
            // « Game in progress » avant la borne, une fois par visite et par passage.
            const annonce = intros.shared;
            const cleAnnonce = 'partage-' + passage.youtube_id;
            if (annonce && annonce.video && !dejaAnnonce(cleAnnonce)) {
                noterAnnonce(cleAnnonce);
                lecteurDuPassage.src = urlYouTube(annonce.video, '&controls=0');
                enchainer(lecteurDuPassage, () => urlYouTube(passage.youtube_id), annonce);
            }
            tv.ecran.replaceChildren(lecteurDuPassage);
            return;
        }
        // Le repere du fil en fait partie : il ne change que quand le fil change (une video entree, un tour remelange, la fin
        // d'un direct), et la video qui passe continue alors a l'ecran.
        const cleRepos = 'attente:' + (repos ? repos.video + ':' + (repos.since || '') + ':' + (repos.playlist || []).map((v) => v.video).join(',') : '');
        if (bloc.dataset.youtube !== cleRepos) {
            // Le retour d'un direct (record ou borne a l'antenne) : le fil reprend en fondu.
            const apresUnDirect = /^(record|partage):/.test(bloc.dataset.youtube || '');
            const precedent = programme ? programme.courant() : null;
            bloc.dataset.youtube = cleRepos;
            arreterLeProgramme();
            const tv = televiseurDu(bloc);
            tv.remplir({ details: bloc.dataset.labelIdle || '' });
            if (!precedent) {
                tv.ecran.replaceChildren();
            }
            tv.ecran.classList.remove('record-live__frame--idle');
            if (repos) {
                // L'ecran d'attente de la chaine, sans le son tant que le spectateur ne l'active pas : « No live right
                // now », puis une video de la chaine, puis « No live right now »... Des qu'un direct commence, la relecture
                // (toutes les 10 s) remplace ce lecteur.
                programmer(bloc, tv, precedent, apresUnDirect);
            } else {
                tv.ecran.classList.add('record-live__frame--idle');
            }
        }
    }

    function liste(bloc, directs) {
        const cle = directs.map((d) => d.youtube_id).join(',');
        if (bloc.dataset.youtube === cle) {
            recrire(bloc, directs);
            return;
        }
        bloc.dataset.youtube = cle;
        const ul = el('ul', 'record-live__list');
        directs.forEach((d) => {
            const li = el('li', 'record-live__item');
            const a = el('a', 'record-live__link');
            a.href = fiche(d);
            a.append(el('span', 'record-live__badge', bloc.dataset.labelLive || 'LIVE'));
            a.append(el('span', 'record-live__text', phraseDu(bloc, d)));
            a.append(el('span', 'record-live__watch', bloc.dataset.labelWatch || ''));
            li.append(a);
            ul.append(li);
        });
        bloc.replaceChildren(ul);
    }

    function montrer(directs) {
        blocs.forEach((bloc) => {
            if (bloc.dataset.mode === 'antenne') {
                antenne(bloc, directs);
                bloc.hidden = false;
                return;
            }
            const systeme = bloc.dataset.system || '';
            const jeu = bloc.dataset.game || '';
            // Sur la fiche d'un joueur (data-handle), son direct seulement : une poignee vide ne montre rien.
            const duJoueur = bloc.hasAttribute('data-handle');
            const poignee = bloc.dataset.handle || '';
            const pour = duJoueur ? directs.filter((d) => poignee !== '' && d.handle === poignee)
                : systeme && jeu ? directs.filter((d) => d.system === systeme && d.game === jeu) : directs;
            if (pour.length === 0) {
                bloc.hidden = true;
                bloc.dataset.youtube = '';
                bloc.replaceChildren();
                return;
            }
            if (duJoueur) {
                lecteurs(bloc, pour.slice(0, 1));
            } else if (systeme && jeu) {
                lecteur(bloc, pour[0]);
            } else if (bloc.dataset.mode === 'lecteurs') {
                lecteurs(bloc, pour);
            } else {
                liste(bloc, pour);
            }
            bloc.hidden = false;
        });
    }

    async function lire() {
        try {
            // « ?essai=1 » dans l'adresse de la page montre les passages d'essai de la regie (directs non repertories).
            const essai = /[?&]essai=1\b/.test(window.location.search) ? '?essai=1' : '';
            // Sans cache : un direct qui commence remplace l'ecran d'attente des la relecture suivante.
            const r = await fetch('/api/v1/lives/records' + essai, { headers: { Accept: 'application/json' }, cache: 'no-store' });
            if (!r.ok) {
                return;
            }
            const d = await r.json();
            // Une horloge a plus de 30 s du serveur se corrige ; en deca, la reponse (cache de 15 s) ne dit pas mieux.
            if (typeof d.now === 'number') {
                const ecart = d.now - Date.now();
                decalageHorloge = Math.abs(ecart) > 30000 ? ecart : 0;
            }
            intro = d.intro && d.intro.video ? d.intro : null;
            introPasse = d.intro_passed && d.intro_passed.video ? d.intro_passed : null;
            intros = d.intros && typeof d.intros === 'object' ? d.intros : {};
            const directs = Array.isArray(d.lives) ? d.lives : [];
            const passages = Array.isArray(d.shared) ? d.shared : [];
            directsVus = directs.concat(passages).map((x) => x.youtube_id);
            partages = passages.filter((p) => !directsFinis.has(p.youtube_id));
            repos = d.idle && d.idle.video ? d.idle : null;
            montrer(directs.filter((x) => !directsFinis.has(x.youtube_id)));
        } catch (_) {
            // Hors ligne ou copie figee sans l'API : le bloc reste comme il est.
        }
    }

    lire();
    // L'antenne se relit plus souvent : le passage suivant prend la place a temps.
    window.setInterval(lire, blocs.some((b) => b.dataset.mode === 'antenne') ? 10000 : 30000);
})();
