/*
 * nelfe-avatar-core.js : de (pseudo, famille, variation) a la PLANCHE PNG, octet pour octet.
 *
 * C'est la moitie du contrat d'accord de l'index : le generateur (Atelier 64, exact) donne les
 * memes pixels partout, et cet encodeur doit donner les memes OCTETS partout. D'ou :
 *   - un PNG indexe (type 3), les pixels etant deja des index de palette ;
 *   - aucun filtre (octet 0 devant chaque ligne), le seul choix qui ne depend de rien ;
 *   - la compression par pako (deflate en JavaScript pur, arithmetique entiere), jamais
 *     CompressionStream ni le canvas, dont les octets varient d'un navigateur a l'autre.
 *
 * Meme fichier pour le worker (importScripts) et pour Node (require), pour pouvoir prouver
 * sous Node que deux executions donnent les memes octets.
 */
(function (racine) {
  'use strict';

  var TABLE_CRC = (function () {
    var t = new Int32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) { c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); }
      t[n] = c;
    }
    return t;
  })();

  function crc32(octets) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < octets.length; i++) { c = TABLE_CRC[(c ^ octets[i]) & 0xFF] ^ (c >>> 8); }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function be32(v) { return [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255]; }

  function bloc(type, donnees) {
    var nom = [type.charCodeAt(0), type.charCodeAt(1), type.charCodeAt(2), type.charCodeAt(3)];
    var corps = new Uint8Array(nom.length + donnees.length);
    corps.set(nom, 0); corps.set(donnees, nom.length);
    var sortie = new Uint8Array(4 + corps.length + 4);
    sortie.set(be32(donnees.length), 0);
    sortie.set(corps, 4);
    sortie.set(be32(crc32(corps)), 4 + corps.length);
    return sortie;
  }

  function concat(parties) {
    var total = 0;
    for (var i = 0; i < parties.length; i++) { total += parties[i].length; }
    var out = new Uint8Array(total), pos = 0;
    for (var j = 0; j < parties.length; j++) { out.set(parties[j], pos); pos += parties[j].length; }
    return out;
  }

  /** Un PNG indexe : `index` un octet par pixel, `palette` des « #rrggbb », l'entree 0 = transparent. */
  function png(pako, largeur, hauteur, index, palette) {
    var entete = new Uint8Array(13);
    entete.set(be32(largeur), 0); entete.set(be32(hauteur), 4);
    entete[8] = 8; entete[9] = 3; entete[10] = 0; entete[11] = 0; entete[12] = 0;

    var plte = new Uint8Array(palette.length * 3), trns = new Uint8Array(palette.length);
    for (var i = 0; i < palette.length; i++) {
      var couleur = palette[i];
      if (!couleur) { trns[i] = 0; continue; }
      plte[i * 3] = parseInt(couleur.slice(1, 3), 16);
      plte[i * 3 + 1] = parseInt(couleur.slice(3, 5), 16);
      plte[i * 3 + 2] = parseInt(couleur.slice(5, 7), 16);
      trns[i] = 255;
    }

    var brut = new Uint8Array((largeur + 1) * hauteur);
    for (var y = 0; y < hauteur; y++) {
      brut[y * (largeur + 1)] = 0;
      brut.set(index.subarray(y * largeur, (y + 1) * largeur), y * (largeur + 1) + 1);
    }

    return concat([
      new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
      bloc('IHDR', entete),
      bloc('PLTE', plte),
      bloc('tRNS', trns),
      bloc('IDAT', pako.deflate(brut, { level: 9 })),
      bloc('IEND', new Uint8Array(0))
    ]);
  }

  /**
   * La planche complete d'un avatar.
   *
   * Les rectangles viennent du JSON de `pack`, jamais recalcules : c'est ce JSON que lit celui
   * qui dessine, et deux formules pour une disposition finiraient par diverger.
   *
   * @returns {{png: Uint8Array, dossier: object, avatar: object, images: Array}}
   */
  function planche(Avatar64, pako, pseudo, famille, variation, couleurs) {
    var avatar = recolorer(Avatar64, Avatar64.generate(pseudo, { family: famille, variation: variation || 0 }), couleurs);
    var images = Avatar64.buildFrames(avatar);
    var dossier = Avatar64.pack(avatar, images);
    var largeur = dossier.sheet.width, hauteur = dossier.sheet.height;
    var index = new Uint8Array(largeur * hauteur);
    for (var i = 0; i < images.length; i++) {
      var r = dossier.frames[i].rect, pixels = images[i].pixels;
      for (var y = 0; y < r.height; y++) {
        for (var x = 0; x < r.width; x++) {
          index[(r.y + y) * largeur + r.x + x] = pixels[y * r.width + x];
        }
      }
    }
    return { png: png(pako, largeur, hauteur, index, avatar.palette), dossier: dossier, avatar: avatar, images: images };
  }

  /** Les matieres du COSTUME, dans l'ordre ou elles prennent les couleurs d'un logo. */
  var COSTUME = ['outfit', 'lower', 'cape', 'accent'];

  /**
   * Teint le costume d'un avatar aux couleurs d'un logo, AVANT que ses images soient tracees.
   *
   * Les pixels d'Atelier 64 sont des index de palette, et chaque matiere y occupe six nuances
   * construites par `colorRamp` a partir d'une couleur. On refait ces nuances avec la rampe du
   * generateur lui-meme : meme arithmetique exacte, donc memes octets dans tous les navigateurs,
   * et le trace n'a rien a savoir. Le corps (peau, cheveux, metal, contour) reste la creature.
   *
   * La couleur la plus dominante habille la tenue, puis le bas, la cape et l'accent, en boucle
   * s'il y en a moins de quatre. La lueur et la magie se recalculent comme le generateur les
   * derive : a 150 degres de la tenue, a 170 degres de la cape.
   *
   * Rend une COPIE : l'avatar du generateur reste intact.
   */
  function recolorer(Avatar64, avatar, couleurs) {
    if (!couleurs || !couleurs.length) { return avatar; }
    var c = {};
    for (var k in avatar.colors) { c[k] = avatar.colors[k]; }
    for (var i = 0; i < COSTUME.length; i++) { c[COSTUME[i]] = couleurs[i % couleurs.length]; }
    c.glow = Avatar64.hsl(Avatar64.toHSL(c.outfit)[0] + 150, 100, 70);
    c.magic = Avatar64.hsl(Avatar64.toHSL(c.cape)[0] + 170, 100, 65);

    var palette = avatar.palette.slice();
    var teintes = COSTUME.concat(['glow', 'magic']);
    for (var j = 0; j < teintes.length; j++) {
      var nom = teintes[j], debut = avatar.materials[nom];
      if (typeof debut !== 'number') { continue; }
      var rampe = Avatar64.colorRamp(c[nom], nom);
      for (var n = 0; n < rampe.length; n++) { palette[debut + n] = rampe[n]; }
    }

    var teint = {};
    for (var cle in avatar) { teint[cle] = avatar[cle]; }
    teint.colors = c;
    teint.palette = palette;
    return teint;
  }

  /** La pose au repos, de face, en RGBA : le portrait entier. */
  function portrait(Avatar64, avatar, images) {
    var p = poseDeFace(images);
    return p ? Avatar64.rgba(avatar, p) : null;
  }

  function poseDeFace(images) {
    for (var i = 0; i < images.length; i++) {
      if (images[i].direction === 'front' && images[i].frame === 0) { return images[i].pixels; }
    }
    return null;
  }

  /** Le cote de la tete, en pixels de sprite : la moitie du gabarit. */
  var TETE = 32;

  /**
   * La TETE seule, en RGBA de 32 x 32.
   *
   * La regle est geometrique et pas anatomique : on part de la premiere ligne non vide (donc au
   * sommet du chapeau, des antennes ou des oreilles, qui font partie de la tete), et on centre
   * horizontalement sur la boite des vingt-quatre premieres lignes, c'est-a-dire sur la tete et
   * non sur le corps ni sur une arme tenue au bout du bras. Verifie a l'oeil sur huit familles.
   *
   * Un carre plutot qu'une decoupe serree : la tete se pose ainsi dans un cadre fixe, sans
   * sauter d'un avatar a l'autre.
   */
  function tete(Avatar64, avatar, images) {
    var pixels = poseDeFace(images);
    if (!pixels) { return null; }
    var cote = Avatar64.SIZE;

    var haut = cote;
    for (var y = 0; y < cote && haut === cote; y++) {
      for (var x = 0; x < cote; x++) { if (pixels[y * cote + x]) { haut = y; break; } }
    }
    if (haut === cote) { return null; }

    var gauche = cote, droite = -1;
    var bas = Math.min(cote, haut + 24);
    for (var yy = haut; yy < bas; yy++) {
      for (var xx = 0; xx < cote; xx++) {
        if (!pixels[yy * cote + xx]) { continue; }
        if (xx < gauche) { gauche = xx; }
        if (xx > droite) { droite = xx; }
      }
    }

    var centre = Math.round((gauche + droite) / 2);
    var x0 = Math.max(0, Math.min(cote - TETE, centre - TETE / 2));
    var y0 = Math.max(0, Math.min(cote - TETE, haut - 1));

    // On decoupe dans le RGBA de la pose ENTIERE : `Avatar64.rgba` rend toujours un tampon du
    // gabarit (64 x 64), quelle que soit la taille des pixels qu'on lui passe, et un tampon plus
    // grand que l'image fait refuser `ImageData` au navigateur.
    var entier = Avatar64.rgba(avatar, pixels);
    var sortie = new Uint8ClampedArray(TETE * TETE * 4);
    for (var j = 0; j < TETE; j++) {
      var depuis = ((y0 + j) * cote + x0) * 4;
      sortie.set(entier.subarray(depuis, depuis + TETE * 4), j * TETE * 4);
    }
    return { rgba: sortie, size: TETE };
  }

  function hex(octets) {
    var s = '';
    for (var i = 0; i < octets.length; i++) { s += (octets[i] < 16 ? '0' : '') + octets[i].toString(16); }
    return s;
  }

  racine.NelfeAvatarCore = { planche: planche, recolorer: recolorer, portrait: portrait, tete: tete, png: png, crc32: crc32, hex: hex };
})(typeof module !== 'undefined' && module.exports ? module.exports : (typeof self !== 'undefined' ? self : globalThis));
