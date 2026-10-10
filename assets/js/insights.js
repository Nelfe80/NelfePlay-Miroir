// Filtre live du tableau « Most played games » (recherche + système + éditeur).
// Externalisé : le CSP script-src 'self' bloque tout <script> inline.
(function () {
    var q = document.getElementById('topSearch'),
        sys = document.getElementById('topSystem'),
        pub = document.getElementById('topPublisher'),
        table = document.getElementById('topTable'),
        empty = document.getElementById('topEmpty');
    if (!table || !table.tBodies.length) { return; }
    var rows = Array.prototype.slice.call(table.tBodies[0].rows);
    function apply() {
        var text = (q.value || '').trim().toLowerCase(),
            fs = (sys.value || '').toLowerCase(),
            fp = (pub.value || '').toLowerCase(),
            rank = 0;
        rows.forEach(function (r) {
            var name = (r.getAttribute('data-name') || ''),
                rsys = (r.getAttribute('data-system') || ''),
                rpub = (r.getAttribute('data-publisher') || '');
            var ok = (text === '' || name.indexOf(text) !== -1)
                && (fs === '' || rsys === fs)
                && (fp === '' || rpub === fp);
            r.style.display = ok ? '' : 'none';
            if (ok) { rank++; if (r.cells[0]) { r.cells[0].textContent = rank; } }
        });
        if (empty) { empty.style.display = rank === 0 ? '' : 'none'; }
    }
    [q, sys, pub].forEach(function (el) { if (el) { el.addEventListener('input', apply); el.addEventListener('change', apply); } });
    apply();
})();
