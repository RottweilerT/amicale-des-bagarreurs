/* Vocabulaire commun à l'appli (index.html) et au serveur de notifications (.github/notifications.py).
   Q-01 / Q-02 : une seule source pour les onglets, les types de cours et les catégories de notifications.
   Ce fichier doit rester du JSON valide après « window.ADB_CONFIG = » (le script Python le relit tel quel).
   Si une catégorie ou un onglet est ajouté, mettre aussi à jour les listes de firestore.rules.notifications
   (le test automatique le vérifie). */
window.ADB_CONFIG = {
  "onglets": [
    {"id": "membres", "nom": "Membres"},
    {"id": "calendrier", "nom": "Calendrier"},
    {"id": "minuteur", "nom": "Minuteur"},
    {"id": "combats", "nom": "Combats"},
    {"id": "elo", "nom": "Classement"},
    {"id": "salle", "nom": "La salle"},
    {"id": "regles", "nom": "Règles"},
    {"id": "notes", "nom": "Notes"}
  ],
  "onglets_masques_par_defaut": ["membres", "combats", "elo", "salle", "regles", "notes"],
  "onglets_anciens": ["membres", "calendrier", "minuteur", "combats", "elo", "regles", "notes"],
  "cours": {
    "BA": {"nom": "Boxe anglaise", "classe": "ba"},
    "BF": {"nom": "Boxe française", "classe": "bf"},
    "SP": {"nom": "Combat", "classe": "sp"},
    "PP": {"nom": "Préparation physique", "classe": "pp"},
    "MX": {"nom": "Cours mixte", "classe": "o"},
    "BT": {"nom": "Boxe thaï", "classe": "bt"}
  },
  "notifications": [
    {"k": "annonces", "t": "Annonces du groupe", "h": "Messages envoyés par les organisateurs"},
    {"k": "changements", "t": "Cours modifiés ou annulés", "h": "Horaire, lieu ou date qui change, cours annulé"},
    {"k": "nouveaux", "t": "Nouveaux cours", "h": "Cours ajoutés au calendrier"},
    {"k": "rappel", "t": "Rappels", "h": "Le samedi après-midi s’il te manque des réponses pour la semaine, et le jour d’un cours (profil choisi)"},
    {"k": "combats", "t": "Combats", "h": "Combat programmé et résultat"}
  ]
};
