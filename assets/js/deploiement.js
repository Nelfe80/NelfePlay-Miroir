/* Deploiement certifie : bascule des deux vues, depliage des verdicts, tri de la
   demande mondiale. Externalise parce que la CSP pose script-src 'self'. */
(function () {
    'use strict';

    var onglets = document.querySelectorAll('[data-tab]');
    onglets.forEach(function (onglet) {
        onglet.addEventListener('click', function () {
            onglets.forEach(function (autre) {
                var actif = autre === onglet;
                autre.classList.toggle('is-on', actif);
                autre.setAttribute('aria-selected', actif ? 'true' : 'false');
            });
            document.querySelectorAll('.deploy-screen').forEach(function (ecran) {
                ecran.classList.toggle('is-on', ecran.id === onglet.dataset.tab);
            });
        });
    });

    // Retour d'un depot ou d'un epinglage : on rouvre l'onglet d'ou l'on venait.
    if (location.hash) {
        var cible = document.querySelector('[data-tab="' + location.hash.slice(1) + '"]');
        if (cible) { cible.click(); }
    }

    // Une ligne porteuse de verdicts ouvre sa ligne de detail, et elle seule.
    document.querySelectorAll('.deploy-row.has-detail').forEach(function (ligne) {
        ligne.addEventListener('click', function (evenement) {
            if (evenement.target.closest('a')) { return; }
            var detail = document.querySelector('[data-detail="' + ligne.dataset.row + '"]');
            if (detail) { detail.classList.toggle('is-on'); }
        });
    });

    var hote = document.getElementById('worldrows');
    if (!hote) { return; }

    var lignes = Array.prototype.slice.call(hote.children);
    var compteur = document.getElementById('worldcount');
    var tri = 'cabinets';
    var todo = false;

    function rendre() {
        var visibles = lignes.filter(function (ligne) {
            return !todo || ligne.dataset.todo === '1';
        });

        visibles.sort(function (a, b) {
            var ecart = Number(b.dataset[tri]) - Number(a.dataset[tri]);
            // A egalite on departage par bornes : c'est le signal le plus honnete.
            return ecart !== 0 ? ecart : Number(b.dataset.cabinets) - Number(a.dataset.cabinets);
        });

        lignes.forEach(function (ligne) { ligne.remove(); });
        visibles.forEach(function (ligne) { hote.appendChild(ligne); });

        if (compteur) {
            compteur.textContent = visibles.length + ' / ' + lignes.length;
        }
    }

    document.querySelectorAll('[data-sort]').forEach(function (bouton) {
        bouton.addEventListener('click', function () {
            tri = bouton.dataset.sort;
            document.querySelectorAll('[data-sort]').forEach(function (autre) {
                autre.classList.toggle('is-on', autre === bouton);
            });
            rendre();
        });
    });

    var filtre = document.querySelector('[data-filter="todo"]');
    if (filtre) {
        filtre.addEventListener('click', function () {
            todo = !todo;
            filtre.classList.toggle('is-on', todo);
            rendre();
        });
    }

    rendre();
})();
