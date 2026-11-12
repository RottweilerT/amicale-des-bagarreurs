# Notifications push — Amicale des Bagarreurs

## En bref

Chaque membre peut recevoir des notifications sur son téléphone ou son ordinateur, même appli fermée. Il les active lui-même avec la **cloche** en haut de l'appli. Il n'y a pas de compte à créer.

| Catégorie (clé) | Quand | Envoyée par |
|---|---|---|
| Annonces du groupe (`annonces`) | Message écrit dans l'espace admin | l'organisateur, après vérification du code admin |
| Cours modifiés ou annulés (`changements`) | Un cours à venir change d'horaire, de durée, de lieu ou de date, ou est supprimé | automatique |
| Nouveaux cours (`nouveaux`) | Des cours à venir sont ajoutés au calendrier (une série = un seul message) | automatique |
| Rappel des présences (`rappel`) | Le samedi à 16 h, s'il manque des réponses pour les 7 prochains jours (il faut avoir choisi son profil) | automatique |
| Combats (`combats`) | Un combat est programmé, ou un combat est terminé avec son résultat | automatique |

Toucher la notification ouvre l'appli sur le bon onglet.

## Comment ça marche

```
Appli (index.html)                 Firestore                       GitHub Action « Notifications »
  cloche → jeton FCM  ───────────► push_subs/<id aléatoire>        (toutes les 15 min + samedi 16 h)
  (catégories, profil facultatif)  illisible depuis l'appli  ◄──── lit avec le compte de service
  espace admin ──────────────────► push_requests/<id>       ◄──── vérifie le code admin, envoie, efface
                                   courses, fights, members ◄──── compare avec l'état précédent
                                                                   ↓
                                                     Firebase Cloud Messaging (API HTTP v1)
                                                                   ↓
                                                     sw.js affiche la notification
```

- **Côté appli**, le module `Notif` d'`index.html` gère la cloche, le panneau, les catégories, le désabonnement et l'espace admin. Il utilise le SDK `firebase-messaging-compat` 10.12.2 avec `getToken({vapidKey, serviceWorkerRegistration})`, ce qui reste la méthode prise en charge. La clé publique VAPID est dans `PUSH.vapid`.
- **Le service worker** est le seul de l'appli : `sw.js`, qui sert aussi au mode hors ligne. Il affiche la notification (événement `push`) et ouvre ou réutilise l'appli au clic. Une notification qui en remplace une autre du même sujet a le même `tag`, ce qui évite les doublons à l'écran.
- **Côté serveur**, il n'y a pas de Cloud Functions, qui demanderaient le forfait payant Blaze. C'est la GitHub Action `.github/workflows/notifications.yml` qui fait le travail, avec le programme `.github/notifications.py`, gratuitement.
  - Elle retient l'état du calendrier et des combats d'un passage à l'autre, dans le cache GitHub. Elle n'envoie donc que les vraies nouveautés, et une seule fois. Au tout premier passage, elle enregistre l'état sans rien envoyer.
  - Une annonce admin est d'abord effacée de Firestore, avec une condition « pas modifiée depuis la lecture », puis envoyée. Elle ne peut donc pas partir deux fois, et le code tapé n'est pas conservé.
  - L'envoi se fait appareil par appareil (API HTTP v1, l'ancien envoi groupé n'existe plus), 8 en parallèle, avec deux nouvelles tentatives en cas d'erreur passagère.
  - Un appareil qui ne répond plus est retiré automatiquement. C'est le cas quand le jeton est expiré, que l'appli a été supprimée ou que l'abonnement a été coupé.
  - Chaque envoi est ajouté à `notifications/historique.json` : date, titre, message, nombre d'appareils, jamais de jeton. L'espace admin l'affiche dans « Derniers envois ».
- **Délai** : une notification automatique part au passage suivant de l'Action, en général dans le quart d'heure, parfois plus quand GitHub est chargé.
- **Lectures Firestore** : environ 130 documents par passage, soit environ 12 000 par jour, sous le quota gratuit de 50 000. Les abonnés ne sont lus que quand il y a quelque chose à envoyer.

## Données et sécurité

- **Données enregistrées par appareil** (`push_subs`) : le jeton FCM, les catégories, l'état actif, le profil s'il est choisi (pour le rappel des présences) et les dates. C'est tout.
- **Accès** : les règles Firestore interdisent toute lecture depuis l'appli. L'appareil ne peut que créer, modifier ou effacer sa propre fiche, dont l'identifiant aléatoire n'est connu que de lui.
- **Se désabonner** efface la fiche et le jeton de l'appareil tout de suite.
- **Espace admin** : n'importe qui peut déposer une demande, mais **c'est le serveur qui vérifie le code admin** (secret GitHub `ADMIN_CODE`) avant d'envoyer.
  - Au-delà de 5 codes faux en 24 h, toutes les annonces sont bloquées jusqu'à ce que ça retombe.
  - 3 annonces au plus partent par passage. Titre et message sont limités à 60 et 200 caractères.
  - Le lien d'ouverture est choisi dans une liste fermée d'onglets.
- **Clés** : la clé privée du compte de service n'est que dans les secrets GitHub (`FCM_COMPTE`), jamais dans le code. La clé VAPID présente dans le code est la clé **publique**, faite pour ça.
- **Anciens abonnements** : avant cette version, le jeton était rangé dans la fiche du membre (champ `push`).
  - Tant que les nouvelles règles ne sont pas en place, l'appli continue ainsi pour ne rien casser.
  - Dès qu'elles le sont, chaque téléphone passe tout seul à `push_subs` à sa prochaine ouverture, et l'ancien jeton est retiré.
  - Les anciens jetons reçoivent seulement « Annonces », « Cours modifiés ou annulés » et « Rappel ».
- **Ce qui n'est pas mis en place** :
  - **Firebase Authentication anonyme** : elle n'apporterait rien ici, puisque les fiches sont déjà privées et anonymes.
  - **App Check** : il faudrait configurer reCAPTCHA, et le reste de la base est de toute façon ouvert en écriture depuis l'appli, comme avant.

## Compatibilité (honnêtement)

- **Android** : Chrome, Edge, Firefox, Samsung Internet. Ça marche dans le navigateur comme dans l'appli installée.
- **Windows, macOS, Linux** : Chrome, Edge, Firefox. Safari aussi sur macOS 13 et plus.
- **iPhone et iPad (iOS / iPadOS 16.4 et plus)** : seulement dans l'**appli installée sur l'écran d'accueil**, depuis Safari avec Partager → « Sur l'écran d'accueil ». Le panneau l'explique.
- **Ce qui ne marche pas** :
  - les navigateurs intégrés (WhatsApp, Instagram…) ;
  - Safari iOS sans installation ;
  - la navigation privée, selon le navigateur ;
  - un appareil où les notifications du navigateur sont coupées dans les réglages du système.
- **Mode économie d'énergie** : Android ou iOS peuvent retarder la notification.

## Mise en route (à faire une fois)

1. **Clé du compte de service → secret `FCM_COMPTE`**
   1. Ouvre [Firebase Console](https://console.firebase.google.com/) → projet *amicale-des-bagarreurs*, puis la roue dentée ⚙ → **Paramètres du projet** → onglet **Comptes de service**.
   2. Clique **Générer une nouvelle clé privée**, puis **Générer la clé**. Un fichier `.json` est téléchargé.
   3. Va dans GitHub → dépôt *amicale-des-bagarreurs* → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
   4. Dans *Name*, mets `FCM_COMPTE`. Dans *Secret*, colle **tout** le contenu du fichier `.json`. Clique **Add secret**.
   5. Supprime ensuite le fichier `.json` de ton ordinateur.
2. **Code admin → secret `ADMIN_CODE`** : même écran GitHub, **New repository secret**. Dans *Name*, mets `ADMIN_CODE`. Dans *Secret*, mets un code de ton choix, au moins 12 caractères. C'est ce code que tu taperas dans l'espace admin de l'appli.
3. **Règles Firestore**
   1. Va dans Firebase Console → **Firestore Database** → onglet **Règles**.
   2. Colle le contenu de `firestore.rules.notifications` juste **avant les deux dernières accolades** `}` `}`, puis clique **Publier**.
   3. Les règles existantes ne changent pas.
4. **Vérifier l'API** : dans Firebase Console → ⚙ → **Paramètres du projet** → **Cloud Messaging**, la ligne « API Firebase Cloud Messaging (V1) » doit être **Activée**.
5. **Tester**
   1. Sur ton téléphone, active les notifications avec la cloche.
   2. Dans GitHub → **Actions** → **Notifications** → **Run workflow**, choisis le mode `test`, puis **Run workflow**.
   3. Le test doit arriver dans la minute.

## Utilisation au quotidien

- **Envoyer une annonce** : ouvre la cloche, puis **Espace admin**.
  1. Écris le titre et le message.
  2. Choisis la catégorie et l'onglet à ouvrir, puis vérifie l'aperçu.
  3. Tape le code admin, puis **Envoyer aux abonnés**.
  4. L'envoi apparaît dans « Derniers envois » après le passage du serveur. Une demande refusée y figure aussi, avec la raison.
- **Changer le code admin** : remplace le secret `ADMIN_CODE` dans GitHub.
- **Déclencher à la main** : dans GitHub → Actions → Notifications → Run workflow, choisis un mode.
  - `test` : notification de test à tous les abonnés.
  - `rappel` : le rappel des présences, tout de suite.
  - `changements` : vérifie le calendrier et envoie les annonces en attente.
- **Voir ce qui s'est passé** : l'onglet Actions de GitHub (chaque passage liste ce qui a été envoyé), et `notifications/historique.json`.
- **Point d'attention** : GitHub suspend les tâches planifiées d'un dépôt resté 60 jours sans aucun commit. La sauvegarde quotidienne fait des commits, donc ça n'arrive pas tant qu'elle tourne.
