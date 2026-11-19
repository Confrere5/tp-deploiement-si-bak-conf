'use strict';

const { ServerTCP } = require('modbus-serial');

const startedAt = Date.now();

function simulatedValue(base, amplitude, periodMs) {
  const phase = 2 * Math.PI * (Date.now() - startedAt) / periodMs;
  return Math.round(base + amplitude * Math.sin(phase));
}

function readRegister(address) {
  if (address === 0) return simulatedValue(220, 25, 30000);
  if (address === 1) return simulatedValue(500, 40, 45000);
  return 0;
}

const simulator = new ServerTCP({
  getHoldingRegister: readRegister,
  getInputRegister: readRegister
}, {
  host: '0.0.0.0',
  port: 8502,
  unitID: 1
});

simulator.on('initialized', () => {
  console.log('Simulateur Modbus TCP en écoute sur le port 8502, unité 1.');
});

simulator.on('error', (error) => {
  console.error('Erreur du simulateur Modbus :', error.message);
  process.exit(1);
});