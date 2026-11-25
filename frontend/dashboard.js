'use strict';

const tiles = document.querySelector('#tiles');
const template = document.querySelector('#signal-template');
const message = document.querySelector('#message');
const plot = document.querySelector('#plot');
const plotMessage = document.querySelector('#plot-message');
const windowSize = document.querySelector('#window-size');

const signals = new Map();
const retentionMs = 15 * 60_000;
let nextColor = 0;

const numberFormat = new Intl.NumberFormat('fr-FR', {
  maximumSignificantDigits: 8
});

const clock = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit', minute: '2-digit', second: '2-digit'
});

const dateTime = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'short', timeStyle: 'medium'
});

const statusLabels = {
  ok: 'En ligne',
  pending: 'En attente',
  modbus_error: 'Erreur Modbus',
  storage_error: 'Erreur de stockage',
  unavailable: 'API indisponible'
};

const chart = new Chart(document.querySelector('#chart'), {
  type: 'line',
  data: { datasets: [] },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    parsing: false,
    locale: 'fr-FR',
    interaction: { mode: 'nearest', axis: 'x', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: items => items.length ? dateTime.format(items[0].parsed.x) : '',
          label: item => {
            const value = numberFormat.format(item.parsed.y);
            return `${item.dataset.label} : ${value} ${item.dataset.unit}`.trim();
          }
        }
      }
    },
    scales: { x: { type: 'linear' } }
  }
});

function setStatus(signal, status, detail = '') {
  signal.status.textContent = statusLabels[status] || 'État inconnu';
  signal.status.title = detail || '';
  if (status === 'ok' || status === 'pending') {
    signal.status.dataset.kind = status;
  } else {
    signal.status.dataset.kind = 'error';
  }
}

function createSignal() {
  const card = template.content.firstElementChild.cloneNode(true);
  const index = nextColor++;
  const colorToken = `--series-${index % 6 + 1}`;
  card.style.setProperty('--curve', `var(${colorToken})`);

  const checkbox = card.querySelector('input');
  checkbox.addEventListener('change', drawChart);
  tiles.append(card);

  return {
    card,
    checkbox,
    colorToken,
    name: card.querySelector('.signal-name'),
    value: card.querySelector('.signal-value'),
    unit: card.querySelector('.signal-unit'),
    status: card.querySelector('.signal-state'),
    time: card.querySelector('time'),
    points: [],
    lastTime: null,
    gap: false,
    signature: '',
    line: {
      data: [],
      borderWidth: 2.5,
      borderDash: index % 2 ? [7, 3] : [],
      pointRadius: 2,
      pointHoverRadius: 5,
      spanGaps: false,
      tension: 0
    }
  };
}

function updateSignal(variable, state, now) {
  const id = String(variable.id);
  let signal = signals.get(id);

  if (!signal) {
    signal = createSignal();
    signals.set(id, signal);
  }

  const signature = JSON.stringify([
    variable.automateId, variable.registerType, variable.registerAddress,
    variable.dataType, variable.scaleFactor, variable.unit
  ]);

  if (signal.signature !== signature) {
    signal.points = [];
    signal.lastTime = null;
    signal.gap = false;
    signal.value.textContent = '—';
    signal.time.textContent = '';
    signal.time.removeAttribute('datetime');
    signal.signature = signature;
  }

  signal.name.textContent = variable.name;
  signal.unit.textContent = variable.unit || '';
  signal.checkbox.setAttribute('aria-label', `Tracer ${variable.name}`);
  signal.line.label = variable.name;
  signal.line.unit = variable.unit || '';

  const status = state?.status || 'pending';
  const timestamp = Date.parse(state?.measuredAt);
  const value = state?.value == null ? NaN : Number(state.value);

  if (Number.isFinite(timestamp) && Number.isFinite(value) &&
      (signal.lastTime === null || timestamp > signal.lastTime)) {
    if (signal.lastTime !== null && signal.gap) {
      signal.points.push({ x: (signal.lastTime + timestamp) / 2, y: null });
    }

    signal.points.push({ x: timestamp, y: value });
    signal.lastTime = timestamp;
    signal.gap = false;
    signal.value.textContent = numberFormat.format(value);
    signal.time.dateTime = new Date(timestamp).toISOString();
    signal.time.textContent = dateTime.format(timestamp);
  }

  if (status !== 'ok') signal.gap = true;
  setStatus(signal, status, state?.error);

  while (signal.points.length && signal.points[0].x < now - retentionMs) {
    signal.points.shift();
  }
}

function drawChart() {
  const selected = [...signals.values()].filter(signal => signal.checkbox.checked);
  const styles = getComputedStyle(document.documentElement);
  const muted = styles.getPropertyValue('--muted').trim();
  const grid = styles.getPropertyValue('--line').trim();
  const now = Date.now();
  const cutoff = now - Number(windowSize.value) * 60_000;

  const units = new Map();
  const datasets = [];
  let earliest = now - 10_000;
  let hasData = false;

  const scales = {
    x: {
      type: 'linear',
      ticks: {
        color: muted,
        maxTicksLimit: 7,
        maxRotation: 0,
        callback: value => clock.format(Number(value))
      },
      border: { color: grid },
      grid: { display: false }
    }
  };

  for (const signal of selected) {
    const unit = signal.line.unit;
    if (!units.has(unit)) {
      const index = units.size;
      const axisId = `y${index}`;
      units.set(unit, axisId);

      scales[axisId] = {
        type: 'linear',
        position: index % 2 ? 'right' : 'left',
        grace: '6%',
        title: { display: true, text: unit || 'Sans unité', color: muted },
        ticks: { color: muted, maxTicksLimit: 6 },
        border: { color: grid },
        grid: { color: grid, drawOnChartArea: index === 0 }
      };
    }

    const points = signal.points.filter(point => point.x >= cutoff);
    const color = styles.getPropertyValue(signal.colorToken).trim();

    signal.line.yAxisID = units.get(unit);
    signal.line.borderColor = color;
    signal.line.pointBackgroundColor = color;
    signal.line.data = points;
    datasets.push(signal.line);

    if (points.some(point => point.y !== null)) {
      earliest = Math.min(earliest, points[0].x);
      hasData = true;
    }
  }

  plotMessage.hidden = hasData;
  if (!hasData) {
    plot.hidden = true;
    plotMessage.textContent = selected.length
      ? 'En attente de mesures sur la fenêtre choisie.'
      : 'Cochez une variable pour afficher sa courbe.';
    return;
  }

  const wasHidden = plot.hidden;
  plot.hidden = false;
  scales.x.min = Math.max(cutoff, earliest - 1000);
  scales.x.max = now + 500;
  chart.data.datasets = datasets;
  chart.options.scales = scales;
  if (wasHidden) chart.resize();
  chart.update('none');
}

async function getJson(url) {
  const response = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(6000)
  });

  if (!response.ok) throw new Error(`${url} — HTTP ${response.status}`);
  return response.json();
}

async function refresh() {
  try {
    const [variables, states] = await Promise.all([
      getJson('/api/variables'),
      getJson('/api/acquisition')
    ]);

    const activeIds = new Set(variables.map(variable => String(variable.id)));
    for (const [id, signal] of signals) {
      if (!activeIds.has(id)) {
        signal.card.remove();
        signals.delete(id);
      }
    }

    const byId = new Map(states.map(state => [String(state.variableId), state]));
    const now = Date.now();
    for (const variable of variables) {
      updateSignal(variable, byId.get(String(variable.id)), now);
    }

    message.classList.remove('error');
    message.textContent = variables.length
      ? ''
      : 'Ajoutez une variable depuis la page Variables pour commencer.';
  } catch (error) {
    message.classList.add('error');
    message.textContent = `Actualisation interrompue. ${error.message}`;
    for (const signal of signals.values()) {
      signal.gap = true;
      setStatus(signal, 'unavailable');
    }
  } finally {
    try {
      drawChart();
    } finally {
      window.setTimeout(refresh, 1000);
    }
  }
}

windowSize.addEventListener('change', drawChart);
document.addEventListener('supervision-theme', drawChart);
refresh();