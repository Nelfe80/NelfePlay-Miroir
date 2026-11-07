// Sélecteur .MEM : système (grille de cards) → recherche du jeu par nom → grp + titre.
// Fichier externe : la CSP du site (script-src 'self') interdit le <script> et onerror inline.
(function () {
    'use strict';
    var form = document.getElementById('mem-form');
    if (!form) { return; }

    var T = {
        none: form.getAttribute('data-i18n-none') || 'No game found.',
        sel: form.getAttribute('data-i18n-sel') || 'Selected:'
    };
    var hSys = document.getElementById('h-system');
    var hGrp = document.getElementById('h-grp');
    var hTitle = document.getElementById('h-title');
    var q = document.getElementById('game-q');
    var results = document.getElementById('game-results');
    var sel = document.getElementById('game-selected');
    var stepGame = document.getElementById('step-game');
    var submitBtn = document.getElementById('mem-submit');
    var mGrp = document.getElementById('m-grp');
    var mTitle = document.getElementById('m-title');
    var curSys = '';
    var timer = null;
    var verifyOk = false;
    var fileInput = document.getElementById('mem-file');
    var verifyBox = document.getElementById('mem-verify');

    function esc(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function updateSubmit() { submitBtn.disabled = !(hSys.value && hGrp.value && verifyOk); }
    function resetFile() {
        if (fileInput) { fileInput.value = ''; }
        var nm = document.getElementById('mem-file-name'); if (nm) { nm.textContent = ''; }
        if (verifyBox) { verifyBox.innerHTML = ''; }
        verifyOk = false;
        updateSubmit();
    }
    function addrNum(a) { a = String(a || ''); return a.indexOf('0x') === 0 ? parseInt(a.slice(2), 16) : (parseInt(a, 10) || 0); }
    var STLBL = { add: 'ajout', mod: 'modif', del: 'suppr' };
    function dcell(e, f, ch) {
        if (ch && ch[f]) { return '<span class="f">' + esc(String(ch[f].from || '∅')) + '</span><span class="arw">→</span><span class="t">' + esc(String(ch[f].to || '∅')) + '</span>'; }
        return esc(String(e[f] == null ? '' : e[f]));
    }
    function td(e, f, ch, cls) {
        var c = ((cls ? cls + ' ' : '') + (ch && ch[f] ? 'chg-cell' : '')).replace(/\s+$/, '');
        return '<td' + (c ? ' class="' + c + '"' : '') + '>' + dcell(e, f, ch) + '</td>';
    }
    function diffTable(rows) {
        rows.sort(function (a, b) { return addrNum(a.e.addr) - addrNum(b.e.addr); });
        var out = '<div class="mv-table-wrap"><table class="mv-table"><thead><tr><th>Statut</th><th>Adresse</th><th>Action</th><th>Type</th><th>Cond.</th><th>Valeur</th><th>Description</th></tr></thead><tbody>';
        for (var i = 0; i < rows.length; i++) {
            var e = rows[i].e, ch = rows[i].ch, st = rows[i].st;
            out += '<tr class="r-' + st + '"><td><span class="st ' + st + '">' + STLBL[st] + '</span></td>' +
                '<td class="addr">' + esc(e.addr || '') + '</td>' +
                td(e, 'action', ch, 'act') + td(e, 'type', ch) + td(e, 'condition', ch) + td(e, 'value', ch) + td(e, 'desc', ch, 'desc') +
                '</tr>';
        }
        return out + '</tbody></table></div>';
    }

    var suggestBase = form.getAttribute('data-suggest-base');
    var suggestLink = document.getElementById('suggest-link');
    var porteB = document.getElementById('porte-b');
    function updateSuggest(grp) {
        if (!suggestLink || !suggestBase || !curSys || !grp) { if (porteB) { porteB.hidden = true; } return; }
        suggestLink.href = suggestBase + '/' + encodeURIComponent(curSys) + '/' + encodeURIComponent(grp);
        if (porteB) { porteB.hidden = false; }
    }

    function pick(grp, title) {
        hGrp.value = grp;
        hTitle.value = title;
        sel.innerHTML = esc(T.sel) + ' <b>' + esc(title) + '</b> <code>' + esc(grp) + '</code>';
        sel.classList.add('show');
        results.innerHTML = '';
        q.value = title;
        resetFile();
        updateSuggest(grp);
    }

    function render(games) {
        if (!games.length) { results.innerHTML = '<p class="hint">' + esc(T.none) + '</p>'; return; }
        var html = '';
        for (var i = 0; i < games.length; i++) {
            var tag = (games[i].kind && games[i].kind !== 'game') ? ' <span class="gk">' + esc(games[i].kind) + '</span>' : '';
            html += '<button type="button" class="game-item" data-grp="' + esc(games[i].grp) +
                '" data-title="' + esc(games[i].label) + '"><span>' + esc(games[i].label) + tag +
                '</span><span class="grp">' + esc(games[i].grp) + '</span></button>';
        }
        results.innerHTML = html;
        var items = results.querySelectorAll('.game-item');
        for (var j = 0; j < items.length; j++) {
            (function (it) {
                it.addEventListener('click', function () { pick(it.getAttribute('data-grp'), it.getAttribute('data-title')); });
            })(items[j]);
        }
    }

    var filters = form.querySelectorAll('.kfilter');
    function selectedKinds() {
        var k = ['game'];
        for (var i = 0; i < filters.length; i++) { if (filters[i].checked) { k.push(filters[i].value); } }
        return k.join(',');
    }
    function search(query) {
        if (!curSys) { return; }
        fetch('/api/mem/games?system=' + encodeURIComponent(curSys) + '&q=' + encodeURIComponent(query) +
              '&kinds=' + encodeURIComponent(selectedKinds()))
            .then(function (r) { return r.json(); })
            .then(function (d) { render(d.games || []); })
            .catch(function () { results.innerHTML = ''; });
    }

    // Logos : repli svg → png → retrait (l'onerror inline est bloqué par la CSP).
    var imgs = form.querySelectorAll('.sys-btn img');
    for (var k = 0; k < imgs.length; k++) {
        (function (img) {
            var tried = false;
            img.addEventListener('error', function () {
                var png = img.getAttribute('data-png');
                if (!tried && png) { tried = true; img.src = png; } else { img.remove(); }
            });
        })(imgs[k]);
    }

    var btns = form.querySelectorAll('.sys-btn');
    for (var b = 0; b < btns.length; b++) {
        (function (btn) {
            btn.addEventListener('click', function () {
                for (var x = 0; x < btns.length; x++) { btns[x].classList.remove('on'); }
                btn.classList.add('on');
                curSys = btn.getAttribute('data-sys');
                hSys.value = curSys;
                stepGame.classList.add('show');
                q.value = '';
                results.innerHTML = '';
                sel.classList.remove('show');
                hGrp.value = '';
                hTitle.value = '';
                if (mGrp) { mGrp.value = ''; }
                if (mTitle) { mTitle.value = ''; }
                if (porteB) { porteB.hidden = true; }
                resetFile();
                q.focus();
                search('');
            });
        })(btns[b]);
    }

    q.addEventListener('input', function () {
        clearTimeout(timer);
        timer = setTimeout(function () { search(q.value); }, 200);
    });
    for (var fi = 0; fi < filters.length; fi++) {
        filters[fi].addEventListener('change', function () { search(q.value); });
    }

    // Saisie manuelle : alimente les mêmes champs cachés.
    var manualTimer = null;
    function manualSync() {
        if (mGrp.value.trim()) {
            hGrp.value = mGrp.value.trim().toLowerCase();
            hTitle.value = mTitle.value.trim() || mGrp.value.trim();
            sel.classList.remove('show');
            updateSuggest(hGrp.value);
        }
        updateSubmit();
        clearTimeout(manualTimer);
        manualTimer = setTimeout(verifyFile, 400);
    }
    if (mGrp) { mGrp.addEventListener('input', manualSync); }
    if (mTitle) { mTitle.addEventListener('input', manualSync); }

    // ── Vérificateur : à la sélection du fichier, on valide + diffe côté serveur ──
    var ERRLABEL = {
        empty: 'Fichier vide.', not_text: 'Ce n’est pas un fichier texte (.MEM).',
        too_large: 'Fichier trop volumineux.', no_return_table: 'Pas de table « return { … } ».',
        no_events: 'Pas de bloc « events = { … } ».', unbalanced_braces: 'Accolades déséquilibrées.',
        no_entries: 'Aucun événement (adresse) trouvé.'
    };
    function warnLabel(w) {
        if (w.indexOf('unknown_types:') === 0) { return 'Type(s) inconnu(s) : ' + w.slice(14) + ' (lus comme u8).'; }
        if (w.indexOf('unknown_conditions:') === 0) { return 'Condition(s) inconnue(s) : ' + w.slice(19) + '.'; }
        if (w === 'system_mismatch') { return 'Le système déclaré ne correspond pas au système choisi.'; }
        return w;
    }
    function chg(m) {
        return Object.keys(m.changes).map(function (f) {
            return f + ' <span class="f">' + esc(String(m.changes[f].from || '∅')) + '</span>→<span class="t">' + esc(String(m.changes[f].to || '∅')) + '</span>';
        }).join(', ');
    }
    function renderVerify(d) {
        verifyOk = !!d.ok && (!d.errors || !d.errors.length);
        var h = '<div class="mv-head ' + (verifyOk ? 'ok' : 'bad') + '">' +
            (verifyOk ? '✓ Fichier conforme' : '✗ ' + ((d.errors || []).length) + ' erreur(s) - à corriger') + '</div>';
        if (d.errors && d.errors.length) {
            h += '<ul class="mv-list">' + d.errors.map(function (e) { return '<li class="err">' + esc(ERRLABEL[e] || e) + '</li>'; }).join('') + '</ul>';
        }
        if (d.warnings && d.warnings.length) {
            h += '<ul class="mv-list">' + d.warnings.map(function (w) { return '<li class="warn">⚠︎ ' + esc(warnLabel(w)) + '</li>'; }).join('') + '</ul>';
        }
        if (d.has_current && d.diff) {
            var df = d.diff;
            h += '<div class="mv-diff"><div class="sum">Comparé à la version actuelle :' +
                ' <span class="mv-tag add"><b>' + df.added.length + '</b> ajout(s)</span>' +
                ' <span class="mv-tag mod"><b>' + df.modified.length + '</b> modif(s)</span>' +
                ' <span class="mv-tag del"><b>' + df.removed.length + '</b> suppr.</span>' +
                ' <span class="mv-tag same"><b>' + df.unchanged + '</b> inchangé(s)</span>' +
                (d.scoring_candidate ? ' <span class="mv-tag sc">candidat scoring</span>' : '') + '</div>' +
                '<div class="mv-legend">Cellule <span class="chg-lg">surlignée</span> = champ modifié (<span class="f">ancien</span> → <span class="t">nouveau</span>). « Suppr » = présent dans la version actuelle, absent de ton fichier.</div>';
            var rows = [];
            df.added.forEach(function (e) { rows.push({ st: 'add', e: e, ch: null }); });
            df.modified.forEach(function (m) { rows.push({ st: 'mod', e: m.entry, ch: m.changes }); });
            df.removed.forEach(function (e) { rows.push({ st: 'del', e: e, ch: null }); });
            if (rows.length) { h += diffTable(rows); }
            h += '</div>';
        } else if (verifyOk) {
            var nrows = (d.entries || []).map(function (e) { return { st: 'add', e: e, ch: null }; });
            h += '<div class="mv-diff"><div class="sum">Nouvelle définition - <span class="mv-tag add"><b>' + nrows.length +
                '</b> événement(s)</span>, aucune version actuelle pour ce jeu.' +
                (d.scoring_candidate ? ' <span class="mv-tag sc">candidat scoring</span>' : '') + '</div>' +
                (nrows.length ? diffTable(nrows) : '') + '</div>';
        }
        verifyBox.innerHTML = h;
        updateSubmit();
    }
    function verifyFile() {
        verifyOk = false;
        updateSubmit();
        if (!fileInput || !fileInput.files || !fileInput.files.length) { if (verifyBox) { verifyBox.innerHTML = ''; } return; }
        if (!hSys.value || !hGrp.value) { verifyBox.innerHTML = '<div class="mv-head checking">Choisis d’abord le système et le jeu.</div>'; return; }
        verifyBox.innerHTML = '<div class="mv-head checking">Vérification…</div>';
        var rd = new FileReader();
        rd.onload = function () {
            fetch('/api/mem/validate?system=' + encodeURIComponent(hSys.value) + '&grp=' + encodeURIComponent(hGrp.value),
                { method: 'POST', body: rd.result, headers: { 'Content-Type': 'text/plain' } })
                .then(function (r) { return r.json(); }).then(renderVerify)
                .catch(function () { verifyBox.innerHTML = '<div class="mv-head bad">Vérification impossible (réseau).</div>'; });
        };
        rd.readAsText(fileInput.files[0]);
    }
    function onFile() {
        var nm = document.getElementById('mem-file-name');
        if (nm) { nm.textContent = (fileInput.files && fileInput.files.length) ? fileInput.files[0].name : ''; }
        verifyFile();
    }
    if (fileInput) { fileInput.addEventListener('change', onFile); }

    // Glisser-déposer sur la zone d'upload.
    var drop = form.querySelector('.mem-drop');
    if (drop && fileInput) {
        ['dragenter', 'dragover'].forEach(function (ev) {
            drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('drag'); });
        });
        ['dragleave', 'dragend'].forEach(function (ev) {
            drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('drag'); });
        });
        drop.addEventListener('drop', function (e) {
            e.preventDefault();
            drop.classList.remove('drag');
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
                try { fileInput.files = e.dataTransfer.files; } catch (err) { return; }
                onFile();
            }
        });
    }
})();
