'use strict';

const Modbus = require('modbus-serial');

const REFRESH_MS = 1000;
const READ_TIMEOUT_MS = 2000;
const TOTAL_TIMEOUT_MS = 4000;

const SELECT_CONFIGURATIONS = `
  SELECT v.id AS variableId, a.id AS automateId, a.host, a.port,
         a.unit_id AS unitId, v.register_type AS registerType,
         v.register_address AS registerAddress, v.data_type AS dataType,
         v.scale_factor AS scaleFactor, v.interval_ms AS intervalMs
  FROM variables AS v
  JOIN automates AS a ON a.id = v.automate_id
  WHERE v.archived_at IS NULL AND a.archived_at IS NULL
`;

const INSERT_MEASUREMENT = `
  INSERT INTO mesures (variable_id, value_number, measured_at)
  SELECT v.id, ?, ?
  FROM variables AS v
  JOIN automates AS a ON a.id = v.automate_id
  WHERE v.id = ? AND a.id = ?
    AND v.archived_at IS NULL AND a.archived_at IS NULL
    AND a.host = ? AND a.port = ? AND a.unit_id = ?
    AND v.register_type = ? AND v.register_address = ?
    AND v.data_type = ? AND v.scale_factor = ? AND v.interval_ms = ?
`;

async function readVariable(configuration) {
  const client = new Modbus();
  client.setID(configuration.unitId);
  client.setTimeout(READ_TIMEOUT_MS);

  let stage = 'Connexion TCP';
  let finished = false;
  let timer;

  const deadline = new Promise((_, reject) => {
    client.on('error', reject);
    timer = setTimeout(() => {
      reject(new Error(`Délai total de ${TOTAL_TIMEOUT_MS} ms dépassé`));
    }, TOTAL_TIMEOUT_MS);
  });

  async function exchange() {
    await client.connectTCP(configuration.host, { port: configuration.port });
    if (finished) return;

    stage = 'Lecture du registre';
    const address = configuration.registerAddress;
    const result = configuration.registerType === 'holding'
      ? await client.readHoldingRegisters(address, 1)
      : await client.readInputRegisters(address, 1);

    stage = 'Conversion de la valeur';
    const rawValue = result.data[0];

    if (!Number.isInteger(rawValue) || rawValue < 0 || rawValue > 65535) {
      throw new Error('Le registre ne contient pas une valeur 16 bits valide');
    }

    const decodedValue = configuration.dataType === 'int16' && rawValue >= 32768
      ? rawValue - 65536
      : rawValue;

    const value = decodedValue * configuration.scaleFactor;
    if (!Number.isFinite(value)) {
      throw new Error('Valeur invalide après application du facteur d’échelle');
    }

    return value;
  }

  try {
    return await Promise.race([exchange(), deadline]);
  } catch (error) {
    const detail = error.message || String(error);
    throw new Error(`${stage} (${configuration.host}:${configuration.port}) : ${detail}`, {
      cause: error
    });
  } finally {
    finished = true;
    clearTimeout(timer);

    // Une erreur de fermeture est journalisée séparément de la lecture.
    const reportCloseError = (error) => {
      if (error) {
        console.warn(`[Modbus] Fermeture, variable ${configuration.variableId}`, error);
      }
    };

    try {
      client.close(reportCloseError);
    } catch (error) {
      reportCloseError(error);
    }
  }
}

function startAcquisition(pool) {
  const tasks = new Map();
  let stopped = false;
  let refreshTimer;
  let refreshFailed = false;

  function schedule(task, delay) {
    task.timer = setTimeout(() => acquire(task), delay);
  }

  async function acquire(task) {
    const configuration = task.configuration;
    const {
      variableId, automateId, host, port, unitId, registerType,
      registerAddress, dataType, scaleFactor, intervalMs
    } = configuration;

    const startedAt = Date.now();
    const isCurrent = () => !stopped
      && tasks.get(variableId) === task
      && task.configuration === configuration;

    task.running = true;
    let failureStatus = 'modbus_error';

    try {
      const value = await readVariable(configuration);
      if (!isCurrent()) return;

      const measuredAt = new Date().toISOString();
      const sqlTimestamp = measuredAt.slice(0, 23).replace('T', ' ');

      failureStatus = 'storage_error';
      const result = await pool.query(INSERT_MEASUREMENT, [
        value, sqlTimestamp, variableId, automateId, host, port, unitId,
        registerType, registerAddress, dataType, scaleFactor, intervalMs
      ]);

      if (result.affectedRows > 0 && isCurrent()) {
        task.state = { status: 'ok', value, measuredAt, error: null };
      }
    } catch (error) {
      if (isCurrent()) {
        const message = failureStatus === 'modbus_error'
          ? error.message
          : 'Enregistrement MariaDB impossible.';

        if (task.state.status !== failureStatus || task.state.error !== message) {
          console.error(`[Acquisition] Variable ${variableId} — ${failureStatus}`, error);
        }

        task.state = { ...task.state, status: failureStatus, error: message };
      }
    } finally {
      task.running = false;

      if (!stopped && tasks.get(variableId) === task) {
        let delay = 0;

        if (task.configuration === configuration) {
          const period = task.state.status === 'ok'
            ? intervalMs
            : Math.max(intervalMs, READ_TIMEOUT_MS);

          delay = Math.max(0, period - (Date.now() - startedAt));
        }

        schedule(task, delay);
      }
    }
  }

  async function refreshConfigurations() {
    try {
      const rows = await pool.query(SELECT_CONFIGURATIONS);
      if (stopped) return;
      refreshFailed = false;

      const activeIds = new Set(rows.map((row) => row.variableId));

      for (const [id, task] of tasks) {
        if (!activeIds.has(id)) {
          clearTimeout(task.timer);
          tasks.delete(id);
        }
      }

      for (const configuration of rows) {
        const id = configuration.variableId;
        const signature = JSON.stringify(configuration);
        const existing = tasks.get(id);

        if (existing?.signature === signature) continue;

        const task = existing ?? { running: false };
        clearTimeout(task.timer);

        task.configuration = configuration;
        task.signature = signature;
        task.state = { status: 'pending', value: null, measuredAt: null, error: null };
        tasks.set(id, task);

        if (!task.running) schedule(task, 0);
      }
    } catch (error) {
      if (!refreshFailed) {
        console.error('[Acquisition] Chargement des configurations impossible', error);
        refreshFailed = true;
      }
    } finally {
      if (!stopped) {
        refreshTimer = setTimeout(refreshConfigurations, REFRESH_MS);
      }
    }
  }

  refreshConfigurations();

  return {
    listStates() {
      return Array.from(tasks.values(), (task) => ({
        variableId: task.configuration.variableId,
        ...task.state
      }));
    },

    stop() {
      stopped = true;
      clearTimeout(refreshTimer);
      for (const task of tasks.values()) clearTimeout(task.timer);
      tasks.clear();
    }
  };
}

module.exports = startAcquisition;