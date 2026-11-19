'use strict';

const { Router } = require('express');

const MAX_ID = 4294967295;
const MAX_INTERVAL_MS = 2147483647;

const SELECT_ACTIVE_VARIABLES = `
  SELECT v.id, v.automate_id AS automateId, v.name, v.unit,
         v.register_type AS registerType, v.register_address AS registerAddress,
         v.data_type AS dataType, v.scale_factor AS scaleFactor,
         v.interval_ms AS intervalMs
  FROM variables AS v
  JOIN automates AS a ON a.id = v.automate_id
  WHERE v.archived_at IS NULL AND a.archived_at IS NULL
`;

function integerBetween(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

function validateConfiguration(request, response, next) {
  const {
    automateId, name, unit = '', registerType = 'holding', registerAddress,
    dataType = 'uint16', scaleFactor = 1, intervalMs = 1000
  } = request.body ?? {};

  const cleanName = typeof name === 'string' ? name.trim() : '';

  if (!integerBetween(automateId, 1, MAX_ID)) {
    return response.status(400).json({ error: 'Sélectionnez un automate valide.' });
  }

  if (!cleanName || cleanName.length > 100) {
    return response.status(400).json({ error: 'Saisissez un nom de 1 à 100 caractères.' });
  }

  if (typeof unit !== 'string' || unit.trim().length > 24) {
    return response.status(400).json({ error: 'L’unité doit contenir au maximum 24 caractères.' });
  }

  if (!['holding', 'input'].includes(registerType)) {
    return response.status(400).json({ error: 'Le type de registre doit être holding ou input.' });
  }

  if (!integerBetween(registerAddress, 0, 65535)) {
    return response.status(400).json({ error: 'L’adresse du registre doit être un entier de 0 à 65535.' });
  }

  if (!['uint16', 'int16'].includes(dataType)) {
    return response.status(400).json({ error: 'Le type de données doit être uint16 ou int16.' });
  }

  if (!Number.isFinite(scaleFactor)) {
    return response.status(400).json({ error: 'Le facteur d’échelle doit être un nombre fini.' });
  }

  if (!integerBetween(intervalMs, 1, MAX_INTERVAL_MS)) {
    return response.status(400).json({ error: 'Saisissez une période entière de 1 à 2147483647 ms.' });
  }

  response.locals.configuration = {
    automateId, name: cleanName, unit: unit.trim(), registerType, registerAddress,
    dataType, scaleFactor, intervalMs
  };
  next();
}

function configurationValues(configuration) {
  const { name, unit, registerType, registerAddress, dataType, scaleFactor, intervalMs } =
    configuration;

  return [name, unit, registerType, registerAddress, dataType, scaleFactor, intervalMs];
}

function createVariablesRouter(pool) {
  const router = Router();

  router.param('id', (_request, response, next, value) => {
    const id = Number(value);
    if (!/^[1-9]\d*$/.test(value) || !integerBetween(id, 1, MAX_ID)) {
      return response.status(400).json({ error: 'Identifiant de variable invalide.' });
    }

    response.locals.variableId = id;
    next();
  });

  router.get('/', async (_request, response) => {
    const rows = await pool.query(`${SELECT_ACTIVE_VARIABLES} ORDER BY v.id`);
    response.json(rows);
  });

  router.get('/:id', async (_request, response) => {
    const [variable] = await pool.query(`${SELECT_ACTIVE_VARIABLES} AND v.id = ?`, [
      response.locals.variableId
    ]);

    if (!variable) {
      return response.status(404).json({ error: 'Variable introuvable.' });
    }

    response.json(variable);
  });

  router.post('/', validateConfiguration, async (_request, response) => {
    const configuration = response.locals.configuration;
    const result = await pool.query(
      `INSERT INTO variables
         (automate_id, name, unit, register_type, register_address, data_type, scale_factor, interval_ms)
       SELECT id, ?, ?, ?, ?, ?, ?, ?
       FROM automates
       WHERE id = ? AND archived_at IS NULL`,
      [...configurationValues(configuration), configuration.automateId]
    );

    if (result.affectedRows === 0) {
      return response.status(404).json({ error: 'Automate actif introuvable.' });
    }

    const id = Number(result.insertId);
    response.location(`/api/variables/${id}`).status(201).json({ id, ...configuration });
  });

  router.put('/:id', validateConfiguration, async (_request, response) => {
    const id = response.locals.variableId;
    const configuration = response.locals.configuration;
    const result = await pool.query(
      `UPDATE variables AS v
       JOIN automates AS a ON a.id = v.automate_id AND a.archived_at IS NULL
       JOIN automates AS target ON target.id = ? AND target.archived_at IS NULL
       SET v.automate_id = target.id, v.name = ?, v.unit = ?, v.register_type = ?,
           v.register_address = ?, v.data_type = ?, v.scale_factor = ?, v.interval_ms = ?
       WHERE v.id = ? AND v.archived_at IS NULL`,
      [configuration.automateId, ...configurationValues(configuration), id]
    );

    if (result.affectedRows === 0) {
      return response.status(404).json({ error: 'Variable ou automate actif introuvable.' });
    }

    response.json({ id, ...configuration });
  });

  router.delete('/:id', async (_request, response) => {
    const result = await pool.query(
      `UPDATE variables AS v
       JOIN automates AS a ON a.id = v.automate_id AND a.archived_at IS NULL
       SET v.archived_at = UTC_TIMESTAMP(3)
       WHERE v.id = ? AND v.archived_at IS NULL`,
      [response.locals.variableId]
    );

    if (result.affectedRows === 0) {
      return response.status(404).json({ error: 'Variable introuvable.' });
    }

    response.status(204).end();
  });

  return router;
}

module.exports = createVariablesRouter;