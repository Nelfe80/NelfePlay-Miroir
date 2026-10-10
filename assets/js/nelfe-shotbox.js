/* La capture d'un record, en grand, avec ce qu'on peut en faire.
 *
 * Un composant COMMUN : la fiche joueur et la fiche de jeu montrent la meme
 * image et proposent les memes gestes. Deux boites finiraient par proposer
 * deux choses differentes du meme objet.
 *
 * L'image est servie a la definition d'origine du jeu - 224x384 pour un
 * vertical d'arcade, 320x224 pour une Megadrive - et agrandie SANS lissage :
 * elle est faite de pixels, et les fondre les uns dans les autres montrerait
 * autre chose que ce qui a ete joue.
 */
(function () {
  'use strict';

  var I18N = window.NP_I18N || {};
  function T(cle, defaut) {
    var s = I18N[cle];
    return (s === undefined || s === '') ? defaut : s;
  }

  var boite = null;
  var rendu = null;      // l'element qui avait le focus avant l'ouverture

  function construire() {
    if (boite) { return boite; }

    boite = document.createElement('div');
    boite.className = 'nsb';
    boite.hidden = true;
    boite.setAttribute('role', 'dialog');
    boite.setAttribute('aria-modal', 'true');

    var cadre = document.createElement('div');
    cadre.className = 'nsb-frame';

    var fermer = document.createElement('button');
    fermer.type = 'button';
    fermer.className = 'nsb-close';
    fermer.textContent = '×';
    fermer.setAttribute('aria-label', T('close', 'Fermer'));
    fermer.addEventListener('click', cacher);

    var img = document.createElement('img');
    img.className = 'nsb-img';
    img.alt = '';

    var titre = document.createElement('h2');
    titre.className = 'nsb-title';
    titre.setAttribute('translate', 'no');

    var sous = document.createElement('p');
    sous.className = 'nsb-sub';

    // Le CERTIFICAT plutot que des boutons d'action : la boite montre une performance et
    // dit d'ou vient sa preuve. Agir se fait sur la page, ou les boutons sont deja.
    var preuve = document.createElement('a');
    preuve.className = 'nsb-proof';
    preuve.target = '_blank';
    preuve.rel = 'noopener';
    preuve.hidden = true;

    var sceau = document.createElement('img');
    sceau.className = 'nsb-seal';
    sceau.src = '/assets/brand/nelfe-verified.svg';
    sceau.alt = '';
    sceau.width = 16;
    sceau.height = 16;
    var motPreuve = document.createElement('span');
    preuve.appendChild(sceau);
    preuve.appendChild(motPreuve);

    // Le CERTIFICAT, dans un cadre de notre origine. On ne quitte pas la page : revenir
    // au classement apres avoir lu une preuve est un aller-retour inutile.
    var cadreCert = document.createElement('iframe');
    cadreCert.className = 'nsb-cert';
    cadreCert.setAttribute('loading', 'lazy');
    cadreCert.hidden = true;

    cadre.appendChild(fermer);
    cadre.appendChild(img);
    cadre.appendChild(titre);
    cadre.appendChild(sous);
    cadre.appendChild(preuve);
    cadre.appendChild(cadreCert);
    boite.appendChild(cadre);

    // Un clic sur le FOND ferme, un clic sur le cadre non : c'est le geste
    // qu'on attend d'une boite de ce genre.
    boite.addEventListener('click', function (e) {
      if (e.target === boite) { cacher(); }
    });
    document.addEventListener('keydown', function (e) {
      if (!boite.hidden && e.key === 'Escape') { cacher(); }
    });

    document.body.appendChild(boite);
    boite._img = img;
    boite._titre = titre;
    boite._sous = sous;
    boite._preuve = preuve;
    boite._motPreuve = motPreuve;
    boite._cert = cadreCert;
    boite._fermer = fermer;

    // Le lien de la preuve ouvre le certificat DANS la boite, plutot que d'empiler une
    // seconde modale ou d'ouvrir un onglet.
    preuve.addEventListener('click', function (e) {
      if (!preuve.href) { return; }
      e.preventDefault();
      montrerCertificat(preuve.href, motPreuve.textContent);
    });
    return boite;
  }

  /**
   * Bascule la boite sur le certificat. L'image cede la place : elle a deja ete vue, et
   * garder les deux obligerait a faire defiler une modale.
   */
  function montrerCertificat(url, titre) {
    var b = construire();

    // On FERME avant de rouvrir : deux contenus dans une meme boite se cumulaient a
    // l'ecran, et un reste d'affichage passe pour un bug meme quand il n'y en a qu'un.
    cacher(true);

    b._img.hidden = true;
    b._preuve.hidden = true;
    b._sous.textContent = '';
    // La page du certificat est traduite COTE CLIENT, par le fragment de son adresse
    // (`#fr`, `#en`…). Sans lui elle s'ouvrirait en anglais quelle que soit la langue de
    // lecture.
    var lng = document.documentElement.lang || 'fr';

    // Le cadre s'AJUSTE a son contenu. Une hauteur fixe reservait la place du certificat
    // le plus long et laissait deux cents pixels vides sous les autres.
    //
    // On ne peut PAS se fier a `scrollHeight` : la page encadree porte
    // `body { min-height: 100vh }`, donc elle rend toujours la hauteur du cadre lui-meme
    // et la mesure se mordrait la queue. On mesure le BAS DU DERNIER ELEMENT, qui dit ou
    // le contenu s'arrete vraiment. Le certificat vient du meme domaine, donc c'est
    // lisible ; un jour ou il ne le serait plus, le `catch` garde la hauteur de la
    // feuille de style.
    b._cert.onload = function () {
      try {
        var doc = b._cert.contentDocument;
        var dernier = doc && doc.body ? doc.body.lastElementChild : null;
        if (!dernier) { return; }
        var bas = dernier.getBoundingClientRect().bottom;
        if (bas <= 0) { return; }
        var plafond = Math.min(window.innerHeight * 0.86, 720);
        // Un peu d'air sous la derniere ligne, et un plancher pour qu'un certificat
        // incomplet ne donne pas un cadre ecrase qui aurait l'air casse.
        b._cert.style.height = Math.round(
          Math.max(320, Math.min(bas + 22, plafond))
        ) + 'px';
      } catch (_) {
        // Mesure impossible : la hauteur de la feuille de style fait l'affaire.
      }
    };

    b._cert.src = url.indexOf('#') >= 0 ? url : url + '#' + lng;
    b._cert.hidden = false;
    // Le titre de la modale porte le sceau DEVANT son libelle : c'est le signe qu'on
    // reconnait, il doit preceder le mot et non le suivre.
    b._titre.textContent = '';
    var marque = document.createElement('img');
    marque.className = 'nsb-seal';
    marque.src = '/assets/brand/nelfe-verified.svg';
    marque.alt = '';
    marque.width = 18;
    marque.height = 18;
    b._titre.appendChild(marque);
    b._titre.appendChild(document.createTextNode(titre || T('certificate', 'Certificat')));
    b.classList.add('is-cert');
    b.hidden = false;
    document.body.classList.add('nsb-open');
    b._fermer.focus();
  }

  function cacher(garderLeFocus) {
    if (!boite || boite.hidden) { return; }
    boite.hidden = true;
    boite.classList.remove('is-cert');
    // On vide le cadre : un certificat laisse en place continuerait a vivre derriere une
    // boite fermee, et se rouvrirait sur le precedent.
    boite._cert.hidden = true;
    boite._cert.removeAttribute('src');
    boite._cert.style.height = '';
    document.body.classList.remove('nsb-open');
    // On rend le focus a ce qui a ouvert la boite : sans cela, le lecteur reprend sa
    // lecture au debut de la page. Sauf pendant une BASCULE, ou la boite se rouvre
    // aussitot : rendre puis reprendre le focus ferait sauter la page.
    if (!garderLeFocus && rendu && rendu.focus) { rendu.focus(); }
    if (!garderLeFocus) { rendu = null; }
  }

  /**
   * Ouvre la boite.
   *
   * @param {{src:string, title:string, subtitle:string, alt:string,
   *          proof?:{url:string, label:string}}} vue
   */
  function ouvrir(vue, origine) {
    var b = construire();
    rendu = origine || document.activeElement;

    // Une ouverture d'image efface l'etat « certificat » d'une visite precedente.
    b.classList.remove('is-cert');
    b._cert.hidden = true;
    b._cert.removeAttribute('src');
    b._cert.style.height = '';

    b._img.src = vue.src || '';
    b._img.alt = vue.alt || '';
    b._img.hidden = !vue.src;
    b._titre.textContent = vue.title || '';
    b._sous.textContent = vue.subtitle || '';
    b.setAttribute('aria-label', vue.title || T('record_shot', 'Capture'));

    // Le lien vers la preuve, quand il y en a une. Absent, on n'affiche rien : une
    // mention « non certifie » sur une capture de record serait un contresens.
    if (vue.proof && vue.proof.url) {
      b._preuve.href = vue.proof.url;
      b._motPreuve.textContent = vue.proof.label || T('certificate', 'Certificat');
      b._preuve.hidden = false;
    } else {
      b._preuve.hidden = true;
    }

    b.hidden = false;
    document.body.classList.add('nsb-open');
    b._fermer.focus();
  }

  /* Tout lien marque `data-nelfe-cert` s'ouvre en modale. Marqueur pose par les gabarits :
     une page rendue par le serveur n'a ainsi rien a ecrire. */
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) { return; }
    var lien = t.closest('a[data-nelfe-cert]');
    if (!lien || !lien.getAttribute('href')) { return; }
    e.preventDefault();
    montrerCertificat(lien.getAttribute('href'), lien.textContent.trim());
  }, false);

  window.NelfeShotBox = {
    ouvrir: ouvrir,
    ouvrirCertificat: montrerCertificat,
    fermer: cacher
  };
})();
