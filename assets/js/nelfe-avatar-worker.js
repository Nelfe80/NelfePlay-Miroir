/*
 * nelfe-avatar-worker.js : genere une planche d'avatar HORS du fil principal.
 *
 * Une planche coute 0,3 a 0,6 s de calcul : sur le fil principal, la page gelerait. Le worker
 * recoit les adresses versionnees des deux scripts (le generateur et pako) dans son premier
 * message, parce que l'hebergement ne pose pas de Cache-Control et qu'une adresse sans version
 * pourrait servir un vieux generateur, donc une autre empreinte.
 */
(function () {
  'use strict';

  var charge = false;

  function sha256(octets) {
    return crypto.subtle.digest('SHA-256', octets).then(function (d) {
      return NelfeAvatarCore.hex(new Uint8Array(d));
    });
  }

  self.onmessage = function (e) {
    var m = e.data || {};
    if (m.type !== 'generer') { return; }
    try {
      if (!charge) {
        importScripts(m.urls.avatar64, m.urls.pako, m.urls.core);
        charge = true;
      }
      // La palette d'un logo, pour l'avatar d'un jeu ; absente, les couleurs du generateur.
      var r = NelfeAvatarCore.planche(self.Avatar64, self.pako, m.pseudo, m.family, m.variation, m.palette);
      // La TETE et non le portrait entier : c'est elle qu'on montre a cote d'un pseudo.
      var t = NelfeAvatarCore.tete(self.Avatar64, r.avatar, r.images);
      var portrait = t ? t.rgba : null;
      sha256(r.png).then(function (sha) {
        self.postMessage({
          type: 'planche',
          id: m.id,
          ok: true,
          pseudo: r.avatar.pseudo,
          family: r.avatar.family,
          variation: r.avatar.variation,
          generator: r.dossier.generator,
          familyLabel: (self.Avatar64.families[r.avatar.family] || {}).label || r.avatar.family,
          sha256: sha,
          png: r.png.buffer,
          portrait: portrait ? portrait.buffer : null,
          size: t ? t.size : self.Avatar64.SIZE
        }, portrait ? [r.png.buffer, portrait.buffer] : [r.png.buffer]);
      });
    } catch (err) {
      self.postMessage({ type: 'planche', id: m.id, ok: false, error: String(err && err.message || err) });
    }
  };
})();
