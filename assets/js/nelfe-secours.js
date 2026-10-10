/**
 * Installe le secours dans le navigateur (CDC infra §3.7, /sw.js) : si le central ne repond plus, la
 * page demandee s'ouvre sur un miroir. Seulement sur nelfeplay.com : une copie figee n'installe rien.
 */
(function () {
  'use strict';

  if (!('serviceWorker' in navigator)) {
    return;
  }
  if (document.documentElement.hasAttribute('data-nelfe-fige')) {
    return;
  }
  if (location.hostname !== 'nelfeplay.com' && location.hostname !== 'www.nelfeplay.com') {
    return;
  }
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function () {
      // Sans secours, le site marche comme avant.
    });
  });
})();
