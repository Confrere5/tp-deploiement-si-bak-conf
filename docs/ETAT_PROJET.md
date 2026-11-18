# État du projet

## Socle Docker validé

- Nginx sert `frontend/index.html` sur `http://127.0.0.1:8080/`.
- Le backend utilise Node.js 24 et Express.
- MariaDB 11.4 conserve les données dans le volume `mariadb_data`.
- Le test `GET /api/health` a renvoyé `{"status":"ok","database":"connected"}`.

## Relancer le projet

Depuis la racine du dépôt, préparer un fichier `.env` avec les deux variables indiquées dans `.env.example`, puis lancer `docker compose up -d --build --wait`.

## Suite

Créer le modèle de données des automates, des variables et des mesures. Prévoir la revue de la branche `feat/socle-docker` avec le binôme.