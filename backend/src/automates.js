'use strict';

const { isIP } = require('node:net');
const { Router } = require('express');

const SELECT_ACTIVE = `
  SELECT id, name, host, port, unit_id AS unitId
  FROM automates
  WHERE archived_at IS NULL
`;

function isValidHost(host) {
  if (host.length > 253) return false;
  if (isIP(host)) return true;

  const dnsLabel = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
  return /[a-z]/i.test(host) && host.split('.').every((label) => dnsLabel.test(label));
}

function validateConfiguration(request, response, next) {
  const { name, host, port = 502, unitId = 1 } = request.body ?? {};
  const cleanName = typeof name === 'string' ? name.trim() : '';
  const cleanHost = typeof host === 'string' ? host.trim() : '';

  if (!cleanName || cleanName.length > 100) {
    return response.status(400).json({ error: 'Saisissez un nom de 1 à 100 caractères.' });
  }

  if (!isValidHost(cleanHost)) {
    return response.status(400).json({ error: 'Saisissez une adresse IP ou un nom d’hôte valide.' });
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return response.status(400).json({ error: 'Le port doit être un entier de 1 à 65535.' });
  }

  if (!Number.isInteger(unitId) || unitId < 0 || unitId > 255) {
    return response.status(400).json({ error: 'L’identifiant Modbus doit être un entier de 0 à 255.' });
  }

  response.locals.configuration = { name: cleanName, host: cleanHost, port, unitId };
  next();
}

function createAutomatesRouter(pool) {
  const router = Router();

  router.param('id', (_request, response, next, value) => {
    const id = Number(value);
    if (!/^[1-9]\d*$/.test(value) || id > 4294967295) {
      return response.status(400).json({ error: 'Identifiant d’automate invalide.' });
    }

    response.locals.automateId = id;
    next();
  });

  router.get('/', async (_request, response) => {
    const rows = await pool.query(`${SELECT_ACTIVE} ORDER BY id`);
    response.json(rows);
  });

  router.get('/:id', async (_request, response) => {
    const [automate] = await pool.query(`${SELECT_ACTIVE} AND id = ?`, [
      response.locals.automateId
    ]);

    if (!automate) {
      return response.status(404).json({ error: 'Automate introuvable.' });
    }

    response.json(automate);
  });

  router.post('/', validateConfiguration, async (_request, response) => {
    const { name, host, port, unitId } = response.locals.configuration;
    const result = await pool.query(
      'INSERT INTO automates (name, host, port, unit_id) VALUES (?, ?, ?, ?)',
      [name, host, port, unitId]
    );

    const id = Number(result.insertId);
    response.location(`/api/automates/${id}`).status(201).json({
      id, name, host, port, unitId
    });
  });

  router.put('/:id', validateConfiguration, async (_request, response) => {
    const id = response.locals.automateId;
    const { name, host, port, unitId } = response.locals.configuration;
    const result = await pool.query(
      `UPDATE automates SET name = ?, host = ?, port = ?, unit_id = ?
       WHERE id = ? AND archived_at IS NULL`,
      [name, host, port, unitId, id]
    );

    if (result.affectedRows === 0) {
      return response.status(404).json({ error: 'Automate introuvable.' });
    }

    response.json({ id, name, host, port, unitId });
  });

  router.delete('/:id', async (_request, response) => {
    const result = await pool.query(
      'UPDATE automates SET archived_at = UTC_TIMESTAMP(3) WHERE id = ? AND archived_at IS NULL',
      [response.locals.automateId]
    );

    if (result.affectedRows === 0) {
      return response.status(404).json({ error: 'Automate introuvable.' });
    }

    response.status(204).end();
  });

  return router;
}

module.exports = createAutomatesRouter;