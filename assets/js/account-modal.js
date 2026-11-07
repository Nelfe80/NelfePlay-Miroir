// Modal léger : ouvre une fiche (servie par la plateforme) par-dessus la page,
// sans quitter le compte. Aucun cadre tiers n'est chargé hors de ce clic, et le
// script vit en 'self' (la CSP interdit l'inline). Repli sans JS : le lien garde
// son href (nouvel onglet).
(function () {
    'use strict';

    var current = null;

    function close() {
        if (current === null) {
            return;
        }
        document.removeEventListener('keydown', onKey);
        current.parentNode && current.parentNode.removeChild(current);
        current = null;
        document.body.style.overflow = '';
    }

    function onKey(event) {
        if (event.key === 'Escape') {
            close();
        }
    }

    function open(src, title) {
        close();

        var overlay = document.createElement('div');
        overlay.className = 'np-modal-overlay';
        overlay.addEventListener('click', function (event) {
            if (event.target === overlay) {
                close();
            }
        });

        var dialog = document.createElement('div');
        dialog.className = 'np-modal';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');

        var head = document.createElement('div');
        head.className = 'np-modal-head';

        var heading = document.createElement('span');
        heading.className = 'np-modal-title';
        heading.textContent = title || '';

        var closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'np-modal-close';
        closeButton.setAttribute('aria-label', 'Close');
        closeButton.innerHTML = '&times;';
        closeButton.addEventListener('click', close);

        head.appendChild(heading);
        head.appendChild(closeButton);

        var frame = document.createElement('iframe');
        frame.className = 'np-modal-frame';
        frame.setAttribute('title', title || 'Profile');
        frame.setAttribute('loading', 'lazy');
        // referrerpolicy limite ce qui fuit vers la plateforme ; le cadre reste
        // en lecture, aucun script de la page hôte ne l'atteint (origines différentes).
        frame.setAttribute('referrerpolicy', 'no-referrer');
        frame.src = src;

        dialog.appendChild(head);
        dialog.appendChild(frame);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', onKey);
        current = overlay;
    }

    document.addEventListener('click', function (event) {
        var trigger = event.target.closest ? event.target.closest('[data-modal-src]') : null;
        if (trigger === null) {
            return;
        }
        var src = trigger.getAttribute('data-modal-src');
        if (!src) {
            return;
        }
        event.preventDefault();
        open(src, trigger.getAttribute('data-modal-title') || '');
    });
})();
