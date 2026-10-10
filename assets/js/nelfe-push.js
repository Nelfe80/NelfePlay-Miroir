/* Activer les notifications, depuis le compte.
 *
 * La permission se donne dans UN navigateur, sur UN appareil : elle ne suit pas
 * le compte. Quelqu'un qui l'active sur son telephone devra la redonner sur son
 * ordinateur, et c'est le fonctionnement attendu - c'est l'appareil qui sonne.
 *
 * On ne DEMANDE jamais la permission au chargement de la page. Un navigateur
 * qui voit une demande sans geste la refuse desormais d'office, definitivement,
 * et le reglage devient impossible a activer plus tard. Elle part donc d'un
 * clic, et d'un clic seulement.
 */
(function () {
  'use strict';

  var bouton = document.getElementById('push-toggle');
  if (!bouton) { return; }

  var etat = document.getElementById('push-state');
  var essai = document.getElementById('push-test');
  var I18N = window.NP_I18N || {};
  function T(cle, defaut, valeurs) {
    var s = I18N[cle];
    if (s === undefined || s === '') { s = defaut; }
    // Les phrases portent des place-tenants « :nom », comme cote serveur.
    if (valeurs) {
      for (var nom in valeurs) { s = s.split(':' + nom).join(valeurs[nom]); }
    }
    return s;
  }
  function dire(cle, defaut, valeurs) {
    if (etat) { etat.textContent = T(cle, defaut, valeurs); }
  }

  var possible = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (!possible) {
    // Un bouton qui ne peut rien faire ment : on le retire et on dit pourquoi.
    bouton.hidden = true;
    dire('push_unsupported', 'Ce navigateur ne sait pas recevoir de notifications.');
    return;
  }

  /* La cle publique arrive en base64url ; l'API des navigateurs veut des octets. */
  function enOctets(base64url) {
    var b64 = (base64url + '='.repeat((4 - base64url.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/');
    var brut = atob(b64);
    var octets = new Uint8Array(brut.length);
    for (var i = 0; i < brut.length; i++) { octets[i] = brut.charCodeAt(i); }
    return octets;
  }

  /* La cle publique d'un abonnement, telle que le serveur l'attend. */
  function cle(abonnement, nom) {
    var brut = abonnement.getKey(nom);
    if (!brut) { return ''; }
    var octets = new Uint8Array(brut);
    var texte = '';
    for (var i = 0; i < octets.length; i++) { texte += String.fromCharCode(octets[i]); }
    return btoa(texte).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function poser(actif) {
    bouton.textContent = actif
      ? T('push_disable', 'Desactiver les notifications')
      : T('push_enable', 'Activer les notifications');
    bouton.setAttribute('data-on', actif ? '1' : '0');
    bouton.disabled = false;
    // Tester n'a de sens que si cet appareil est abonne.
    if (essai) { essai.hidden = !actif; }
  }

  /* L'envoi de TEST, vers ses propres appareils.
   *
   * Une notification qui n'arrive pas ne dit RIEN : ni le navigateur ni le
   * serveur ne signalent quoi que ce soit. Ce bouton rend le verdict visible -
   * combien d'appareils, et ce que le service de push en a fait. */
  function tester() {
    if (!essai) { return; }
    essai.disabled = true;
    dire('push_working', '…');

    fetch('/api/v1/push/test', { method: 'POST', credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || !d.devices) {
          dire('push_test_none', 'Aucun appareil abonne.');
          return;
        }
        if (d.ok) {
          dire('push_test_sent', 'Notification envoyee a :n appareil(s).', { n: d.devices });
          return;
        }
        var premier = (d.results || [])[0] || {};
        dire('push_test_failed', 'Le service de notifications a refuse (:status).',
             { status: premier.status || '?' });
      })
      .catch(function () { dire('push_failed', 'Impossible pour le moment.'); })
      .then(function () { essai.disabled = false; });
  }

  if (essai) { essai.addEventListener('click', tester); }

  function abonnementCourant() {
    return navigator.serviceWorker.getRegistration('/').then(function (reg) {
      return reg ? reg.pushManager.getSubscription() : null;
    });
  }

  function activer() {
    return Notification.requestPermission().then(function (permission) {
      if (permission !== 'granted') {
        // Refusee, la permission ne se redemande pas : le navigateur ne
        // reposera plus la question. On dit ou la reprendre.
        dire('push_denied', 'Notifications refusees. Elles se reactivent dans les reglages du navigateur, a cote de l’adresse.');
        return null;
      }
      return navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then(function (reg) {
          return navigator.serviceWorker.ready.then(function () { return reg; });
        })
        .then(function (reg) {
          return fetch('/api/v1/push/key')
            .then(function (r) { return r.json(); })
            .then(function (d) {
              if (!d || !d.ok || !d.key) { throw new Error('key'); }
              return reg.pushManager.subscribe({
                // Obligatoire : un navigateur n'accepte un abonnement que si
                // chaque message se voit. Pas de notification silencieuse.
                userVisibleOnly: true,
                applicationServerKey: enOctets(d.key)
              });
            });
        })
        .then(function (abonnement) {
          var corps = new URLSearchParams();
          corps.set('endpoint', abonnement.endpoint);
          corps.set('p256dh', cle(abonnement, 'p256dh'));
          corps.set('auth', cle(abonnement, 'auth'));
          // La langue de CETTE page : c'est celle dans laquelle on lit le site au moment
          // ou l'on accepte d'etre averti.
          corps.set('locale', document.documentElement.lang || '');
          return fetch('/api/v1/push/subscribe', {
            method: 'POST', body: corps, credentials: 'same-origin'
          }).then(function (r) { return r.ok ? abonnement : Promise.reject(new Error('subscribe')); });
        });
    });
  }

  function desactiver() {
    return abonnementCourant().then(function (abonnement) {
      if (!abonnement) { return null; }
      var adresse = abonnement.endpoint;
      // On retire d'ABORD chez le navigateur : si le serveur ne repond pas, mieux
      // vaut un abonnement orphelin cote serveur (il se nettoie au premier envoi
      // rate) qu'un navigateur qui continue de sonner.
      return abonnement.unsubscribe().then(function () {
        var corps = new URLSearchParams();
        corps.set('endpoint', adresse);
        return fetch('/api/v1/push/unsubscribe', {
          method: 'POST', body: corps, credentials: 'same-origin'
        }).catch(function () { /* l'essentiel est fait */ });
      });
    });
  }

  bouton.addEventListener('click', function () {
    var actif = bouton.getAttribute('data-on') === '1';
    bouton.disabled = true;
    dire('push_working', '…');

    (actif ? desactiver() : activer())
      .then(function (resultat) {
        var maintenant = actif ? false : !!resultat;
        poser(maintenant);
        if (maintenant) {
          dire('push_on', 'Vous serez averti quand un joueur que vous suivez lance une partie partagee.');
        } else if (!actif) {
          // activer() a rendu null : la permission a ete refusee, le message est deja pose.
          bouton.disabled = false;
        } else {
          dire('push_off', 'Notifications desactivees sur cet appareil.');
        }
      })
      .catch(function () {
        poser(actif);
        dire('push_failed', 'Impossible pour le moment.');
      });
  });

  // L'etat REEL vient du navigateur, jamais du serveur : celui-ci sait qu'un
  // abonnement existe quelque part, pas s'il vient d'ICI.
  abonnementCourant()
    .then(function (abonnement) { poser(!!abonnement); })
    .catch(function () { poser(false); });
})();

/* ── Arrêter ma diffusion ─────────────────────────────────────────────────
   « Diffuser en live » n'avait pas d'« Arrêter ». La borne retire maintenant son
   annonce à la fin de la partie, mais si elle n'y arrive pas (processus tué, coupure
   réseau), il ne restait qu'à attendre la péremption. Ce bouton est ce filet.

   Posé ici parce que ce fichier tient déjà les commandes de la carte « je suis » : un
   second script pour un seul bouton se chargerait sur toutes les pages pour rien. */
(function () {
  'use strict';

  var bouton = document.querySelector('[data-nelfe-livestop]');
  if (!bouton) { return; }

  bouton.addEventListener('click', function () {
    bouton.disabled = true;
    fetch('/api/v1/live/withdraw', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Accept': 'application/json' }
    }).then(function (r) {
      return r.ok ? r.json().catch(function () { return { ok: true }; }) : null;
    }).then(function (p) {
      if (p) {
        // On retire la ligne ENTIÈRE : laisser un bouton grisé sous un texte qui annonce
        // encore une diffusion dirait le contraire de ce qui vient de se passer.
        var ligne = document.getElementById('live-mine');
        if (ligne) { ligne.remove(); }
        return;
      }
      bouton.disabled = false;
    }).catch(function () { bouton.disabled = false; });
  });
})();

/* LE REGLAGE PAR FAMILLE.
 *
 * Il ne coupe que la REMISE : la liste du compte garde tout, et c'est pour cela qu'on peut
 * decocher sans rien perdre. La case reflete l'etat rendu par le serveur, pas ce qu'on vient
 * de cliquer : si l'enregistrement echoue, la case revient d'elle-meme, et le joueur ne croit
 * pas avoir regle quelque chose qui ne l'est pas. */
(function () {
  'use strict';

  var liste = document.getElementById('notif-prefs');
  if (!liste) { return; }

  liste.addEventListener('change', function (ev) {
    var case_ = ev.target.closest('[data-notif-family]');
    if (!case_) { return; }
    var famille = case_.getAttribute('data-notif-family');
    var voulu = case_.checked;
    case_.disabled = true;

    fetch('/api/v1/notifications/prefs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ family: famille, delivery: voulu })
    }).then(function (r) {
      return r.ok ? r.json() : null;
    }).then(function (d) {
      if (!d || !d.ok || !d.prefs) {
        case_.checked = !voulu;   // refuse : la case dit la verite du serveur
        return;
      }
      Object.keys(d.prefs).forEach(function (f) {
        var c = liste.querySelector('[data-notif-family="' + f + '"]');
        if (c) { c.checked = !!d.prefs[f]; }
      });
    }).catch(function () {
      case_.checked = !voulu;
    }).then(function () {
      case_.disabled = false;
    });
  });
})();
