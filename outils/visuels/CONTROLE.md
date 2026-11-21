# Bibliothèque visuelle des exercices : contrôle

Généré par `node outils/visuels/construire.js` (puis `node tests/test_visuels.js`).

- 219 exercices illustrés sur 219, 535 images d’étapes, 170 animations en boucle, une miniature par exercice.
- Chaque planche a été regardée étape par étape (planches de contrôle : `outils/visuels/controle/<catégorie>.html`, regénérées par le script, non versionnées).
- Points vérifiés : correspondance nom ↔ mouvement, cohérence des étapes, sens des flèches, positions possibles (contacts au sol, articulations), lisibilité à petite taille, accord avec la consigne.

## Illustrations signalées pour correction (23)

Ces fiches sont utilisables mais la démonstration est simplifiée ; le statut « à revoir » est dans `manifest.json` et l’appli l’indique sous la fiche.

| Exercice | Identifiant | Limite |
|---|---|---|
| Pivots | `pivots` | Le quart de tour se lit mal de profil : la flèche indique le balayage du pied arrière. |
| Pompes archer adaptées | `pompes-archer` | Vue de dessus : la profondeur de la descente ne se voit pas. |
| Pompes pike | `pompes-pike` | Position des mains à vérifier sur la 2e étape. |
| Planche avec touches d'épaules | `shoulder-taps` | Vue de dessus : le geste de la main vers l’épaule est petit. |
| Pompes scapulaires | `scap-pushups` | Mouvement de faible amplitude, peu visible de profil. |
| Pompes alternées | `pompes-alternees` | Vues de dessus seulement : la descente est celle des pompes classiques. |
| Pompes avec déplacement latéral | `pompes-laterales` | Vue de dessus : le déplacement latéral reste discret. |
| Bicycle crunches | `bicycle` | La rotation du buste se lit mal de profil. |
| Russian twists | `russian-twists` | La rotation se lit mal de profil. |
| Mountain climbers croisés | `mountain-croises` | Vue de dessus : la flexion du genou se lit peu. |
| Crunchs obliques | `crunchs-obliques` | La rotation se lit mal de profil. |
| Essuie-glaces au sol | `essuie-glaces` | Mouvement latéral : visible seulement de face, ici approché de profil. |
| Gainage avec rotations | `gainage-rotations` | Deux points de vue différents (profil, puis face). |
| Cossack squats | `cossack` | Position des pieds approximative. |
| Fire hydrants | `fire-hydrants` | Vue de dessus schématique. |
| Frog pumps | `frog-pumps` | L’ouverture des genoux ne se voit pas de profil. |
| Skaters sur place | `skaters` | Jambe croisée derrière approximative en vue de face. |
| Sauts avec rotation contrôlée | `sauts-rotation` | La rotation est suggérée par la flèche. |
| Rotations thoraciques | `rotations-thoraciques` | La rotation du buste se lit mal de profil. |
| Cat-cow | `cat-cow` | La courbure du dos ne peut pas être dessinée : seule la tête et le buste bougent. |
| Mobilité des poignets | `mobilite-poignets` | Les poignets sont trop petits pour montrer le détail. |
| Grand étirement complet | `greatest-stretch` | L’ouverture du bras est vue de profil. |
| Coordination alternée | `coord-alternee` | Croisement main-pied peu visible de profil. |

## Limites communes à toute la bibliothèque

- Personnage dessiné de profil (ou de face / de dessus quand c’est plus clair) : les rotations du buste et les mouvements latéraux se lisent moins bien.
- Le dos est un seul segment : sa courbure (dos rond / dos creux) n’est pas représentée.
- Les variantes facile / difficile renvoient vers la fiche de l’exercice correspondant quand il existe dans la bibliothèque ; sinon la variante est décrite en texte.

## Ajouter ou corriger une fiche

1. Les poses sont dans `outils/visuels/fiches-1.js` (boxe, bras, épaules, pectoraux), `fiches-2.js` (abdos, gainage, jambes, dos), `fiches-3.js` (cardio, conditionnement, explosivité, mobilité, coordination). Les poses de base sont dans `familles.js`, le personnage dans `personnage.js`.
2. Lancer `node outils/visuels/construire.js`, ouvrir la planche de contrôle de la catégorie, vérifier.
3. Une image peut être remplacée par un fichier fait ailleurs (même nom dans `minuteur/visuels/<id>/`) : les textes restent dans `instructions.json`.
