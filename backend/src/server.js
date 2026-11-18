'use strict';

const express = require('express');
const mariadb = require('mariadb');

const app = express();
app.disable('x-powered-by');

const pool = mariadb.createPool({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectionLimit: 5,
  connectTimeout: 3000,
  acquireTimeout: 4000
});

app.get('/api/health', async (_request, response) => {
  try {
    await pool.query('SELECT 1');
    response.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    console.error('MariaDB indisponible :', error.code || error.message);
    response.status(503).json({ status: 'unavailable', database: 'unavailable' });
  }
});

app.listen(3000, '0.0.0.0', () => {
  console.log('API Express en écoute sur le port 3000.');
});