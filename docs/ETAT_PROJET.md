## 19 novembre 2026 — Interface de configuration et supervision

Branche de reprise : `feat/interface-configuration`.

- La page `/automates.html` permet d’ajouter, de modifier et d’archiver un automate.
- La page `/variables.html` permet de choisir l’automate, le registre Modbus, le type de donnée, l’unité, le facteur multiplicateur et l’intervalle de lecture.
- Le tableau de bord `/` affiche la dernière valeur, l’état de connexion, l’horodatage et la courbe de la variable sélectionnée.
- Essai sur le simulateur `simulateur:8502`, identifiant Modbus `1`. La température utilise le registre holding `0` avec un facteur de `0,1`. La pression utilise le registre holding `1` avec un facteur de `0,01`.
- Résultat observé sur le tableau de bord : pression en ligne, oscillant entre 4,6 et 5,4 bar. La dernière mesure de la capture est de 5,4 bar à 16:25:35.
- Les mesures sont enregistrées dans MariaDB. La consultation par plage de dates et l’export CSV restent à réaliser.

Pour reprendre sur le PC du projet, ouvrir Docker Desktop, puis lancer `docker compose --profile demo up -d --build --wait` depuis la racine du dépôt. Ouvrir ensuite `http://127.0.0.1:8080/`.