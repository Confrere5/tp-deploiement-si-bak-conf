'use strict';

const express = require('express');
const mariadb = require('mariadb');
const createAutomatesRouter = require('./automates');
const createVariablesRouter = require('./variables');
const createHistoriqueRouter = require('./historique');
const startAcquisition = require('./acquisition');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));

const pool = mariadb.createPool({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectionLimit: 5,
  connectTimeout: 3000,
  acquireTimeout: 4000,
  foundRows: true
});

const acquisition = startAcquisition(pool);

app.get('/api/health', async (_request, response) => {
  try {
    await pool.query('SELECT 1');
    response.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    console.error('MariaDB indisponible :', error.code || error.message);
    response.status(503).json({ status: 'unavailable', database: 'unavailable' });
  }
});

app.use('/api/automates', createAutomatesRouter(pool));
app.use('/api/variables', createVariablesRouter(pool));
app.use('/api/historique', createHistoriqueRouter(pool));

app.get('/api/acquisition', (_request, response) => {
  response.set('Cache-Control', 'no-store').json(acquisition.listStates());
});

app.use((error, _request, response, next) => {
  if (response.headersSent || response.destroyed) {
    return next(error);
  }

  if (error.type === 'entity.parse.failed') {
    return response.status(400).json({ error: 'Le JSON envoyé est invalide.' });
  }

  if (error.type === 'entity.too.large') {
    return response.status(413).json({ error: 'Le contenu envoyé est trop volumineux.' });
  }

  console.error('Erreur API :', error.code || error.message);
  response.status(500).json({ error: 'Erreur interne du serveur.' });
});

const server = app.listen(3000, '0.0.0.0', () => {
  console.log('API Express en écoute sur le port 3000.');
});

function shutdown() {
  acquisition.stop();
  server.close(() => {
    pool.end().catch((error) => {
      console.error('Fermeture du pool MariaDB impossible :', error.message);
    });
  });
}

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);