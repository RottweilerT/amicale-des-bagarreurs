# Amicale des Bagarreurs

Appli web du groupe de boxe : inscriptions des membres, arbitrage des combats (boxe anglaise et française), calendrier des cours avec présences.

- `index.html` : la page ; `app.css` (styles), `app.js` (toute la logique), `onglets.js` (onglets masquables), `ergonomie.js` (bouton retour, position de défilement, brouillon de ticket), `config.js` (vocabulaire commun appli / serveur).
- `minuteur/` : le minuteur, en modules séparés. `exercices.js` (bibliothèque, identifiants stables : ne jamais renommer un id), `moteur.js` (blocs → étapes, horloge, sons à venir ; sans affichage, testé par `node tests/test_moteur.js`), `sons.js` (5 ambiances Web Audio), `seances.js` (sauvegarde locale ou partagée, modèles, combos, générateur, historique), `ui.js` (interface). Les séances partagées sont des documents `courses` de kind `seance` (format `v:2`, champ `blocs`). Après une modification de ces fichiers (ou de `minuteur/`), augmenter le numéro `?v=` dans `index.html` et `sw.js` (et `CACHE` dans `sw.js`).
- Données partagées : Firebase Firestore (projet `amicale-des-bagarreurs`), collections `members`, `fights`, `courses`, `attendance`.
- Mise en ligne : GitHub Pages (https://rottweilert.github.io/amicale-des-bagarreurs/), mis à jour automatiquement à chaque modification de la branche `main`.
- Onglet Notes : tickets (idées, tâches, problèmes) enregistrés dans la collection `courses` avec `kind: "note"`.
- `.github/workflows/export-tickets.yml` : copie les tickets dans `tickets/tickets.json` toutes les heures (et à la demande). Lancée avec l'entrée « resoudre » (identifiants séparés par des virgules), elle passe d'abord ces tickets en Résolu.
- Notifications push (cloche en haut de l'appli) : voir `NOTIFICATIONS.md`. Envoi par `.github/workflows/notifications.yml` + `.github/notifications.py` ; règles Firestore à ajouter dans `firestore.rules.notifications`.
