# État du projet

## Fonctionnalités validées

- Nginx sert la page HTML. Express et MariaDB tournent dans Docker Compose.
- `GET /api/health` confirme la connexion du backend à MariaDB.
- MariaDB contient les tables `automates`, `variables` et `mesures`.
- Les routes `/api/automates` et `/api/variables` permettent de consulter,
  créer, modifier et archiver les configurations.
- Les tests PowerShell ont confirmé la modification du port d’un automate,
  le changement de période d’une variable et leur retrait des listes actives.

## Relancer le projet

- Préparer un fichier `.env` à la racine à partir de `.env.example`.
- Exécuter `docker compose up -d --build --wait` depuis la racine.
- Ouvrir `http://127.0.0.1:8080/api/health` pour vérifier la connexion.
- Le script `database/001-schema.sql` s’exécute à l’initialisation d’un volume neuf.

## Reprendre le développement

- Branche du socle : `feat/socle-docker`.
- Branche de configuration : `feat/configuration-automates`, créée depuis le socle.
- Prochaine étape : lire un registre sur un simulateur Modbus TCP et
  enregistrer la première mesure horodatée dans MariaDB.
- Revues GitHub à effectuer avec le binôme.