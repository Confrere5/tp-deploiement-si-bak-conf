# État du projet

## Fonctionnalités validées

- Docker Compose démarre Nginx, le backend Node.js/Express et MariaDB.
- Les API `/api/automates` et `/api/variables` permettent de créer, consulter,
  modifier et archiver les configurations.
- Le backend lit les registres Modbus TCP à la période de chaque variable,
  applique le facteur d’échelle et enregistre les mesures horodatées dans MariaDB.
- La route `/api/acquisition` indique l’état de chaque variable, la dernière
  valeur enregistrée, son horodatage et l’erreur éventuelle.

## Démonstration testée

- Simulateur accessible depuis le backend sous le nom `simulateur`, port `8502`, unité `1`.
- Température sur le registre holding d’adresse `0`, type `int16`, facteur `0.1`, unité °C.
- Mesures observées en base toutes les deux secondes.
- Passage à une seconde depuis l’API, vérifié dans les horodatages SQL.
- Arrêt du simulateur : statut `modbus_error`.
- Redémarrage du simulateur : retour automatique à `ok` et reprise des mesures.
- Période remise à 2000 ms à la fin du test.

## Relancer la démonstration

Depuis la racine du projet, avec le fichier `.env` configuré, exécuter
`docker compose --profile demo up -d --build --wait`.

Vérifier la base sur `http://127.0.0.1:8080/api/health` et les lectures sur
`http://127.0.0.1:8080/api/acquisition`. Sur une installation neuve, créer
l’automate et la variable avec les paramètres de démonstration ci-dessus.

## Suite du projet

Branche actuelle : `feat/acquisition-modbus`.
Prochaine phase : afficher les mesures dans le navigateur et tracer leur évolution avec Chart.js.
Restent également l’interface de configuration, la consultation par dates,
l’export CSV, le test depuis un second PC et les livrables de présentation.
Les pull requests seront revues avec le binôme.