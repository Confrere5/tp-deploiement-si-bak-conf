'use strict';

const express = require('express');
const { pipeline } = require('node:stream/promises');

const PREVIEW_LIMIT = 1000;

const MEASURE_QUERY = `
  SELECT
    CONCAT(LEFT(DATE_FORMAT(measured_at, '%Y-%m-%dT%H:%i:%s.%f'), 23), 'Z') AS measuredAt,
    value_number AS value
  FROM mesures
  WHERE variable_id = ?
    AND measured_at >= ?
    AND measured_at < ?
`;

function parseUtcDate(value) {
  const format = /^[1-9]\d{3}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

  if (typeof value !== 'string' || !format.test(value)) {
    return null;
  }

  const date = new Date(value);

  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) {
    return null;
  }

  return date;
}

function toSqlDate(date) {
  return date.toISOString().slice(0, -1).replace('T', ' ');
}

async function* toCsv(rows) {
  yield '\uFEFFhorodatage_utc;valeur\r\n';

  for await (const row of rows) {
    const value = String(row.value).replace('.', ',');
    yield `${row.measuredAt};${value}\r\n`;
  }
}

function createHistoriqueRouter(pool) {
  const router = express.Router();

  router.use((_request, response, next) => {
    response.set('Cache-Control', 'no-store');
    next();
  });

  router.get('/variables', async (_request, response) => {
    const variables = await pool.query(`
      SELECT
        v.id,
        v.name,
        v.unit,
        a.name AS automateName,
        (v.archived_at IS NOT NULL OR a.archived_at IS NOT NULL) AS archived
      FROM variables AS v
      JOIN automates AS a ON a.id = v.automate_id
      ORDER BY archived, a.name, v.name, v.id
    `);

    response.json(variables.map(variable => ({
      ...variable,
      archived: Boolean(variable.archived)
    })));
  });

  async function validatePeriod(request, response, next) {
    const rawId = request.query.variableId;
    const from = parseUtcDate(request.query.from);
    const to = parseUtcDate(request.query.to);

    if (typeof rawId !== 'string' || !/^[1-9]\d{0,9}$/.test(rawId)) {
      return response.status(400).json({ error: 'Identifiant de variable invalide.' });
    }

    const variableId = Number(rawId);

    if (variableId > 4294967295) {
      return response.status(400).json({ error: 'Identifiant de variable invalide.' });
    }

    if (!from || !to || from >= to) {
      return response.status(400).json({
        error: 'Indiquez deux dates UTC valides. La fin doit être après le début.'
      });
    }

    const variables = await pool.query(
      'SELECT id FROM variables WHERE id = ?',
      [variableId]
    );

    if (variables.length === 0) {
      return response.status(404).json({ error: 'Variable introuvable.' });
    }

    response.locals.period = {
      variableId,
      parameters: [variableId, toSqlDate(from), toSqlDate(to)]
    };

    next();
  }

  router.get('/', validatePeriod, async (_request, response) => {
    const { variableId, parameters } = response.locals.period;
    const measures = await pool.query(
      `${MEASURE_QUERY} ORDER BY measured_at DESC, id DESC LIMIT ?`,
      [...parameters, PREVIEW_LIMIT + 1]
    );

    const truncated = measures.length > PREVIEW_LIMIT;
    if (truncated) measures.pop();

    response.json({ variableId, truncated, measures: measures.reverse() });
  });

  router.get('/export.csv', validatePeriod, async (_request, response) => {
    const { variableId, parameters } = response.locals.period;
    const connection = await pool.getConnection();

    try {
      const rows = connection.queryStream(
        `${MEASURE_QUERY} ORDER BY measured_at ASC, id ASC`,
        parameters
      );

      try {
        response.attachment(`mesures-variable-${variableId}.csv`);
        response.type('text/csv; charset=utf-8');
        await pipeline(rows, toCsv, response);
      } finally {
        rows.close();
      }
    } finally {
      await connection.release();
    }
  });

  return router;
}

module.exports = createHistoriqueRouter;