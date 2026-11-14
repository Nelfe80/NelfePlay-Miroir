/* /gestion : l'editeur WYSIWYG des fiches de la boutique. Fichier externe (la CSP interdit le script en ligne).
 * Les textes se modifient sur place (contenteditable) ; seuls les champs changes partent, avec le jeton CSRF.
 * Le serveur nettoie tout le HTML (liste blanche) : ce script ne fait confiance a rien et n'est qu'une commodite. */
(function () {
    'use strict';
    var root = document.getElementById('gestion');
    if (!root) { return; }

    var statut = document.getElementById('gs-status');
    var boutonSave = document.getElementById('gs-save');
    var langues = ['fr', 'en', 'es', 'ja', 'ko', 'zh'];
    var initial = new Map();
    var creditsModifies = false;
    var enCours = false;

    function lire(el) {
        if (el.matches('.gs-edit')) {
            return el.getAttribute('data-riche') === '1' ? el.innerHTML : el.textContent.replace(/\s+/g, ' ').trim();
        }
        if (el.type === 'checkbox') { return el.checked ? '1' : '0'; }
        if (el.type === 'radio') { return el.checked ? el.value : null; }
        return el.value;
    }
    function champs() {
        return root.querySelectorAll('.gs-edit, .gs-in');
    }
    champs().forEach(function (el) { initial.set(el, lire(el)); });

    function dit(texte, erreur) {
        if (!statut) { return; }
        statut.textContent = texte || '';
        statut.className = 'gs-status' + (erreur ? ' is-error' : '');
    }
    function sale() {
        if (creditsModifies) { return true; }
        var sale = false;
        champs().forEach(function (el) {
            var v = lire(el);
            if (v !== null && v !== initial.get(el)) { sale = true; }
        });
        return sale;
    }
    function marquer() {
        if (!enCours) { dit(sale() ? root.getAttribute('data-msg-dirty') : ''); }
    }

    // ---- La langue affichee ----
    function langue(l) {
        if (langues.indexOf(l) < 0) { l = 'fr'; }
        root.setAttribute('data-lang', l);
        root.querySelectorAll('[data-set-lang]').forEach(function (b) {
            b.setAttribute('aria-pressed', b.getAttribute('data-set-lang') === l ? 'true' : 'false');
        });
    }
    root.querySelectorAll('[data-set-lang]').forEach(function (b) {
        b.addEventListener('click', function () { langue(b.getAttribute('data-set-lang')); });
    });
    langue(root.getAttribute('data-lang'));

    // ---- Les textes sur place ----
    var actif = null;
    root.addEventListener('focusin', function (e) {
        var el = e.target.closest ? e.target.closest('.gs-edit') : null;
        if (el) { actif = el; root.classList.toggle('is-riche', el.getAttribute('data-riche') === '1'); }
    });
    root.addEventListener('input', function (e) {
        if (e.target.closest && (e.target.closest('.gs-edit') || e.target.closest('.gs-in'))) { marquer(); }
        if (e.target.closest && e.target.closest('.gs-credit')) { creditsModifies = true; marquer(); }
    });
    root.addEventListener('change', function (e) {
        if (e.target.closest && e.target.closest('.gs-credit')) { creditsModifies = true; }
        marquer();
    });
    // Coller du texte brut seulement : jamais le HTML d'une autre page.
    root.addEventListener('paste', function (e) {
        var el = e.target.closest ? e.target.closest('.gs-edit') : null;
        if (!el) { return; }
        e.preventDefault();
        var texte = (e.clipboardData || window.clipboardData).getData('text/plain');
        if (el.getAttribute('data-riche') !== '1') { texte = texte.replace(/\s+/g, ' '); }
        document.execCommand('insertText', false, texte);
    });
    // Un champ d'une ligne ne prend pas de retour a la ligne.
    root.addEventListener('keydown', function (e) {
        var el = e.target.closest ? e.target.closest('.gs-edit') : null;
        if (el && e.key === 'Enter' && el.getAttribute('data-riche') !== '1') { e.preventDefault(); }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); enregistrer(); }
    });

    // ---- La barre de mise en forme ----
    var commandes = {
        bold: function () { document.execCommand('bold'); },
        italic: function () { document.execCommand('italic'); },
        ul: function () { document.execCommand('insertUnorderedList'); },
        quote: function () { document.execCommand('formatBlock', false, 'blockquote'); },
        link: function () {
            var url = window.prompt(root.getAttribute('data-msg-link') || 'https://', 'https://');
            if (!url) { return; }
            if (!/^https:\/\/[^\s"<>]+$/i.test(url)) { dit(root.getAttribute('data-msg-https'), true); return; }
            document.execCommand('createLink', false, url);
        }
    };
    root.querySelectorAll('[data-cmd]').forEach(function (b) {
        // mousedown : garder la selection du texte pendant le clic sur le bouton.
        b.addEventListener('mousedown', function (e) { e.preventDefault(); });
        b.addEventListener('click', function () {
            if (!actif || actif.getAttribute('data-riche') !== '1') { return; }
            actif.focus();
            commandes[b.getAttribute('data-cmd')]();
            marquer();
        });
    });

    // ---- Les credits (l'equipe d'un jeu, les jeux d'une personne) ----
    var liste = document.getElementById('gs-credits');
    var modele = document.getElementById('gs-credit-tpl');
    var ajout = document.getElementById('gs-add-credit');
    if (liste && ajout && modele) {
        ajout.addEventListener('click', function () {
            liste.appendChild(modele.content.cloneNode(true));
            creditsModifies = true;
            marquer();
            var dernier = liste.lastElementChild;
            if (dernier) { var i = dernier.querySelector('input'); if (i) { i.focus(); } }
        });
        liste.addEventListener('click', function (e) {
            var b = e.target.closest ? e.target.closest('[data-del]') : null;
            if (b) { b.closest('.gs-credit').remove(); creditsModifies = true; marquer(); }
        });
    }
    function lireCredits() {
        var sortie = [];
        if (!liste) { return sortie; }
        liste.querySelectorAll('.gs-credit').forEach(function (li) {
            var role = {};
            try { role = JSON.parse(li.getAttribute('data-role') || '{}') || {}; } catch (x) { role = {}; }
            var ligne = { role: role };
            li.querySelectorAll('[data-k]').forEach(function (i) {
                var k = i.getAttribute('data-k');
                if (k.indexOf('role.') === 0) {
                    var l = k.slice(5);
                    if (i.value.trim() !== '') { role[l] = i.value.trim(); } else { delete role[l]; }
                } else {
                    ligne[k] = i.value.trim();
                }
            });
            sortie.push(ligne);
        });
        return sortie;
    }

    // ---- Enregistrer ----
    function enregistrer() {
        if (enCours) { return; }
        var patch = {};
        var n = 0;
        champs().forEach(function (el) {
            var v = lire(el);
            if (v === null || v === initial.get(el)) { return; }
            patch[el.getAttribute('data-path')] = v;
            n++;
        });
        if (n === 0 && !creditsModifies) { dit(''); return; }
        var corps = new FormData();
        corps.append('_token', root.getAttribute('data-token'));
        corps.append('genre', root.getAttribute('data-genre'));
        corps.append('slug', root.getAttribute('data-slug'));
        corps.append('patch', JSON.stringify(patch));
        if (creditsModifies) { corps.append('credits', JSON.stringify(lireCredits())); }
        enCours = true;
        boutonSave.disabled = true;
        dit('…');
        fetch(root.getAttribute('data-url'), { method: 'POST', body: corps, credentials: 'same-origin', headers: { 'Accept': 'application/json' } })
            .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
            .then(function (r) {
                if (r.token) { root.setAttribute('data-token', r.token); }
                if (r.ok) {
                    champs().forEach(function (el) { var v = lire(el); if (v !== null) { initial.set(el, v); } });
                    creditsModifies = false;
                    dit(root.getAttribute('data-msg-saved'));
                } else {
                    dit(r.error === 'csrf' ? root.getAttribute('data-msg-csrf') : root.getAttribute('data-msg-error'), true);
                }
            })
            .catch(function () { dit(root.getAttribute('data-msg-error'), true); })
            .then(function () { enCours = false; boutonSave.disabled = false; });
    }
    boutonSave.addEventListener('click', enregistrer);
    window.addEventListener('beforeunload', function (e) {
        if (sale()) { e.preventDefault(); e.returnValue = ''; }
    });
})();
