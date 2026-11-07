// Éditeur cadré .MEM (Porte B) : pilote le formulaire d'édition partagé depuis les lignes du
// tableau (modifier / retirer / ajouter). CSP : fichier externe, aucun <script> inline.
(function () {
    'use strict';
    var form = document.getElementById('suggest-form');
    if (!form) { return; }

    var T = {
        modify: form.getAttribute('data-i18n-modify') || 'Modify entry',
        remove: form.getAttribute('data-i18n-remove') || 'Remove entry',
        add: form.getAttribute('data-i18n-add') || 'Add an entry'
    };
    var el = function (id) { return document.getElementById(id); };
    var mode = el('s-mode'), fam = el('s-family'), sub = el('s-sub'), idx = el('s-index'), fp = el('s-fp');
    var addr = el('s-address'), type = el('s-type'), cond = el('s-cond'), value = el('s-value'),
        action = el('s-action'), desc = el('s-desc');
    var title = el('s-title'), target = el('s-target'), fields = el('s-fields'), removeNote = el('s-remove-note');
    var reportForm = el('report-form'), rAddr = el('r-address'), rTarget = el('r-target');

    function setSelect(sel, val) {
        if (!sel) { return; }
        var v = String(val || '').toLowerCase(), found = false;
        for (var i = 0; i < sel.options.length; i++) {
            if (sel.options[i].value.toLowerCase() === v) { sel.selectedIndex = i; found = true; break; }
        }
        if (!found && sel.options.length) { sel.selectedIndex = 0; }
    }

    function show() {
        if (reportForm) { reportForm.hidden = true; }
        form.hidden = false;
        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function openReport(b) {
        if (!reportForm) { return; }
        form.hidden = true;
        mode.value = '';
        if (rAddr) { rAddr.value = b.getAttribute('data-addr') || ''; }
        if (rTarget) { rTarget.textContent = (b.getAttribute('data-addr') || '') + ' · ' + (b.getAttribute('data-action') || ''); }
        reportForm.hidden = false;
        reportForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function fillFrom(b) {
        fam.value = b.getAttribute('data-fam') || '';
        sub.value = b.getAttribute('data-sub') || '';
        idx.value = b.getAttribute('data-idx') || '';
        fp.value = b.getAttribute('data-fp') || '';
        addr.value = b.getAttribute('data-addr') || '';
        setSelect(type, b.getAttribute('data-type'));
        setSelect(cond, b.getAttribute('data-cond'));
        value.value = b.getAttribute('data-value') || '';
        action.value = b.getAttribute('data-action') || '';
        desc.value = b.getAttribute('data-desc') || '';
    }

    function asModify(b) {
        fillFrom(b);
        mode.value = 'modify';
        title.textContent = T.modify;
        target.textContent = (b.getAttribute('data-addr') || '') + ' · ' + (b.getAttribute('data-action') || '');
        form.classList.remove('is-remove');
        addr.readOnly = true;
        fields.hidden = false;
        removeNote.hidden = true;
        show();
    }

    function asRemove(b) {
        fillFrom(b);
        mode.value = 'remove';
        title.textContent = T.remove;
        target.textContent = (b.getAttribute('data-addr') || '') + ' · ' + (b.getAttribute('data-action') || '') +
            ' - ' + (b.getAttribute('data-desc') || '');
        form.classList.add('is-remove');
        fields.hidden = true;
        removeNote.hidden = false;
        show();
    }

    function asAdd(b) {
        mode.value = 'add';
        fam.value = b.getAttribute('data-fam') || '';
        sub.value = b.getAttribute('data-sub') || '';
        idx.value = '';
        fp.value = '';
        addr.value = '';
        setSelect(type, 'u8');
        setSelect(cond, 'change');
        value.value = '';
        action.value = '';
        desc.value = '';
        title.textContent = T.add;
        target.textContent = (b.getAttribute('data-fam') || '') + ' · ' + (b.getAttribute('data-sub') || '');
        form.classList.remove('is-remove');
        addr.readOnly = false;
        fields.hidden = false;
        removeNote.hidden = true;
        show();
        addr.focus();
    }

    var edits = document.querySelectorAll('.sug-mini.edit');
    for (var i = 0; i < edits.length; i++) {
        (function (b) { b.addEventListener('click', function () { asModify(b); }); })(edits[i]);
    }
    var dels = document.querySelectorAll('.sug-mini.del');
    for (var j = 0; j < dels.length; j++) {
        (function (b) { b.addEventListener('click', function () { asRemove(b); }); })(dels[j]);
    }
    var adds = document.querySelectorAll('.sug-add-btn');
    for (var k = 0; k < adds.length; k++) {
        (function (b) { b.addEventListener('click', function () { asAdd(b); }); })(adds[k]);
    }
    var reports = document.querySelectorAll('.sug-mini.report');
    for (var r = 0; r < reports.length; r++) {
        (function (b) { b.addEventListener('click', function () { openReport(b); }); })(reports[r]);
    }

    var close = el('s-close');
    if (close) { close.addEventListener('click', function () { form.hidden = true; mode.value = ''; }); }
    var rClose = el('r-close');
    if (rClose && reportForm) { rClose.addEventListener('click', function () { reportForm.hidden = true; }); }
})();
