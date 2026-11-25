# État du projet — Déploiement d’un SI

Dernière mise à jour : 25 novembre 2026.
Branche de reprise : `feat/historique`.
Dépôt : https://github.com/Confrere5/tp-deploiement-si-bak-conf

## Reprise sur le PC du projet

1. Ouvrir Docker Desktop et attendre que le moteur soit démarré.
2. Ouvrir `%USERPROFILE%\tp-deploiement-si` dans Visual Studio Code.
3. Depuis la racine du dépôt, lancer `docker compose --profile demo up -d --build --wait`.
4. Ouvrir `http://127.0.0.1:8080/`.

Le fichier `.env` est local au PC. `.env.example` sert de modèle.
Le volume Docker `mariadb_data` conserve la configuration et les mesures.

## Architecture et fonctionnalités validées

- Docker Compose lance Nginx, le backend Node.js/Express, MariaDB et le simulateur Modbus avec le profil `demo`.
- Nginx sert le frontend HTML/CSS/JavaScript et transmet les requêtes `/api/` au backend.
- Les pages Automates et Variables permettent de gérer la configuration enregistrée dans MariaDB.
- Le backend adapte les lectures aux intervalles configurés. La perte de communication et la reprise avec le simulateur ont été testées.
- La supervision affiche la dernière valeur, son unité, son horodatage, l’état de lecture et la courbe Chart.js.
- La page Historique permet de choisir une variable et une période. Le tableau affiche jusqu’à 1 000 mesures et le CSV contient toutes les mesures de la période.
- Le menu donne accès aux quatre pages depuis l’accueil.

## Configuration de démonstration

Automate `Simulateur du TP`, hôte `simulateur`, port `8502`, identifiant Modbus `1`.

| Variable | Registre holding | Facteur | Unité | Intervalle |
|---|---:|---:|---|---:|
| Température | 0 | 0,1 | °C | 2 000 ms |
| Pression | 1 | 0,01 | bar | 2 000 ms |

La pression de démonstration varie entre 4,6 et 5,4 bar. Sur la base actuelle, les températures du 19 novembre 2026 entre 14 h 55 et 15 h 00, heure de Paris, ont servi à valider le tableau historique et le téléchargement du CSV.

## Reste à faire

- Tester l’accès à l’application depuis un deuxième PC du réseau local.
- Finaliser la présentation des écrans et refaire le parcours de démonstration.
- Organiser les pull requests, la revue en binôme et l’intégration dans `main`.
- Finaliser le README, le rapport technique et la vidéo de présentation.