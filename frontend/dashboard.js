'use strict';

const selector = document.getElementById('variable');
const valueLabel = document.getElementById('value');
const statusLabel = document.getElementById('status');
const timeLabel = document.getElementById('timestamp');
const message = document.getElementById('message');

const formatNumber = new Intl.NumberFormat('fr-FR', { maximumSignificantDigits: 7 });
const formatTime = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit', minute: '2-digit', second: '2-digit'
});
const formatDateTime = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'short', timeStyle: 'medium'
});

const statusNames = {
  ok: 'En ligne',
  pending: 'En attente',
  modbus_error: 'Erreur Modbus',
  storage_error: 'Erreur MariaDB'
};

const series = new Map();
let variables = [];
let states = new Map();
let apiAvailable = false;
let selectorSignature = null;

const chart = new Chart(document.getElementById('chart'), {
  type: 'line',
  data: {
    datasets: [{
      label: 'Valeur',
      data: [],
      borderColor: '#087c72',
      backgroundColor: '#087c72',
      borderWidth: 2,
      pointRadius: 2,
      spanGaps: false
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    parsing: false,
    scales: {
      x: {
        type: 'linear',
        ticks: {
          maxTicksLimit: 6,
          callback: (value) => formatTime.format(Number(value))
        }
      },
      y: { title: { display: true, text: '' } }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items) => formatDateTime.format(items[0].parsed.x)
        }
      }
    }
  }
});

function showMessage(text) {
  message.textContent = text;
  message.hidden = !text;
}

async function getJson(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function updateSelector() {
  const signature = JSON.stringify(variables.map(({ id, name }) => [id, name]));
  if (signature === selectorSignature) return;
  selectorSignature = signature;

  const previousId = selector.value;
  const options = variables.map((variable) => new Option(variable.name, String(variable.id)));
  selector.replaceChildren(...options);
  selector.disabled = variables.length === 0;

  if (!variables.length) {
    selector.add(new Option('Aucune variable active', ''));
  } else if (variables.some((variable) => String(variable.id) === previousId)) {
    selector.value = previousId;
  }
}

function recordPoint(state) {
  if (!state.measuredAt || !Number.isFinite(state.value)) return;

  const time = Date.parse(state.measuredAt);
  if (!Number.isFinite(time)) return;

  const points = series.get(state.variableId) ?? [];
  const last = points.at(-1);

  if (!last || time > last.x) {
    points.push({ x: time, y: state.value });
  }

  if (state.status !== 'ok' && points.at(-1)?.y !== null) {
    points.push({ x: Math.max(Date.now(), time + 1), y: null });
  }

  if (points.length > 60) points.splice(0, points.length - 60);
  series.set(state.variableId, points);
}

function render() {
  const variable = variables.find((item) => String(item.id) === selector.value);
  const state = states.get(variable?.id);
  const unit = variable?.unit || '';
  const status = state?.status || 'pending';

  valueLabel.textContent = Number.isFinite(state?.value)
    ? `${formatNumber.format(state.value)} ${unit}`.trim()
    : '—';
  timeLabel.textContent = state?.measuredAt
    ? formatDateTime.format(new Date(state.measuredAt))
    : '—';

  statusLabel.textContent = !apiAvailable
    ? 'API indisponible'
    : variable ? (statusNames[status] || status) : 'Aucune variable';
  statusLabel.dataset.state = !apiAvailable || status.endsWith('_error') ? 'error' : status;

  if (!apiAvailable) {
    showMessage('Connexion au backend interrompue. Nouvelle tentative automatique.');
  } else {
    showMessage(state?.error || '');
  }

  chart.data.datasets[0].label = variable?.name || 'Valeur';
  chart.data.datasets[0].data = series.get(variable?.id) || [];
  chart.options.scales.y.title.text = unit;
  chart.update('none');
}

async function refresh() {
  try {
    const [activeVariables, acquisitionStates] = await Promise.all([
      getJson('/api/variables'),
      getJson('/api/acquisition')
    ]);

    variables = activeVariables;
    states = new Map(acquisitionStates.map((state) => [state.variableId, state]));
    apiAvailable = true;
    updateSelector();

    const activeIds = new Set(variables.map((variable) => variable.id));
    for (const id of series.keys()) {
      if (!activeIds.has(id)) series.delete(id);
    }
    for (const state of acquisitionStates) {
      if (activeIds.has(state.variableId)) recordPoint(state);
    }
  } catch {
    apiAvailable = false;
  }

  render();
  window.setTimeout(refresh, 1000);
}

selector.addEventListener('change', render);
refresh();