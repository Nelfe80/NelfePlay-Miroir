/* Le compteur des scores publies, sur l'accueil (demande user 2026-10-09).
 *
 * Un nombre ecrit en clair dans la page (data-count-up) monte de 0 jusqu'a lui quand il entre dans
 * l'ecran, de plus en plus lentement jusqu'a l'arrivee : une courbe exponentielle sortante, rapide
 * au depart, qui se pose sur le chiffre. Une seule fois par visite.
 *
 * Sans script, sans IntersectionObserver, ou pour qui demande le mouvement reduit, le nombre reste
 * tel que la page l'ecrit. Les groupes de chiffres sont separes comme le fait le serveur, par une
 * espace qui ne coupe pas : le nombre d'arrivee est celui de la page, au caractere pres. */
(() => {
    'use strict';

    const cibles = document.querySelectorAll('[data-count-up]');
    if (!cibles.length) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!('IntersectionObserver' in window) || !window.requestAnimationFrame) return;

    const ecrire = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

    cibles.forEach((cible) => {
        const fin = Math.max(0, Math.round(Number(cible.getAttribute('data-count-up')) || 0));
        if (fin === 0) return;
        cible.textContent = ecrire(0);

        // Plus le nombre est grand, plus la montee dure, sans jamais trainer.
        const duree = Math.min(3600, 1600 + Math.log10(fin + 1) * 450);
        const lancer = () => {
            const debut = performance.now();
            const pas = (maintenant) => {
                const x = Math.min(1, (maintenant - debut) / duree);
                // La vitesse retombe jusqu'a l'arrivee : 1 - 2^(-10x), posee sur 1 a la fin.
                const avance = x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
                cible.textContent = ecrire(Math.round(fin * avance));
                if (x < 1) window.requestAnimationFrame(pas);
            };
            window.requestAnimationFrame(pas);
        };

        const guetteur = new IntersectionObserver((entrees) => {
            if (!entrees.some((e) => e.isIntersecting)) return;
            guetteur.disconnect();
            lancer();
        }, { threshold: 0.6 });
        guetteur.observe(cible);
    });
})();
