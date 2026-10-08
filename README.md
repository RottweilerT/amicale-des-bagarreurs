# Amicale des Bagarreurs

Appli web du groupe de boxe : inscriptions des membres, arbitrage des combats (boxe anglaise et française), calendrier des cours avec présences.

- `index.html` : toute l'appli (HTML, CSS, JS dans un seul fichier).
- Données partagées : Firebase Firestore (projet `amicale-des-bagarreurs`), collections `members`, `fights`, `courses`, `attendance`.
- Mise en ligne : GitHub Pages (https://rottweilert.github.io/amicale-des-bagarreurs/), mis à jour automatiquement à chaque modification de la branche `main`.
- Onglet Notes : tickets (idées, tâches, problèmes) enregistrés dans la collection `courses` avec `kind: "note"`.
- `.github/workflows/export-tickets.yml` : copie les tickets dans `tickets/tickets.json` toutes les heures (et à la demande). Lancée avec l'entrée « resoudre » (identifiants séparés par des virgules), elle passe d'abord ces tickets en Résolu.
