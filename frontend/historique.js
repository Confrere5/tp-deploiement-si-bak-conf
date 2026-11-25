'use strict';

const form = document.querySelector('#history-form');
const fields = document.querySelector('#history-fields');
const variableField = form.elements.namedItem('variableId');
const fromField = form.elements.namedItem('from');
const toField = form.elements.namedItem('to');
const download = document.querySelector('#download');
const message = document.querySelector('#message');
const results = document.querySelector('#results');
const measureRows = document.querySelector('#measures');

const dateFormat = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  fractionalSecondDigits: 3
});

const valueFormat = new Intl.NumberFormat('fr-FR', {
  maximumSignificantDigits: 12
});

function notify(text, isError = false) {
  message.textContent = text;
  message.classList.toggle('error', isError);
}

async function getJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  const body = await response.json().catch(() => null);

  if (!response.ok || body === null) {
    throw new Error(body?.error || `Réponse inattendue du serveur (HTTP ${response.status}).`);
  }

  return body;
}

function toLocalInputValue(date) {
  const localTime = date.getTime() - date.getTimezoneOffset() * 60_000;
  return new Date(localTime).toISOString().slice(0, 16);
}

function clearResults() {
  results.hidden = true;
  measureRows.replaceChildren();
  download.hidden = true;
  download.removeAttribute('href');
  notify('');
}

function renderMeasures(measures) {
  const fragment = document.createDocumentFragment();

  for (const measure of measures) {
    const row = document.createElement('tr');
    row.insertCell().textContent = dateFormat.format(new Date(measure.measuredAt));
    row.insertCell().textContent = valueFormat.format(measure.value);
    fragment.append(row);
  }

  measureRows.replaceChildren(fragment);
  results.hidden = false;
}

async function loadVariables() {
  const variables = await getJson('/api/historique/variables');

  if (variables.length === 0) {
    notify('Ajoutez une variable depuis la page Variables pour consulter son historique.');
    return;
  }

  for (const variable of variables) {
    const unit = variable.unit ? ` (${variable.unit})` : '';
    const archived = variable.archived ? ' — archivée' : '';
    const label = `${variable.automateName} — ${variable.name}${unit}${archived}`;

    variableField.add(new Option(label, String(variable.id)));
  }

  const now = Date.now();
  fromField.value = toLocalInputValue(new Date(now - 15 * 60_000));
  toField.value = toLocalInputValue(new Date(Math.ceil(now / 60_000) * 60_000));
  fields.disabled = false;
  notify('');
}

form.addEventListener('input', clearResults);

form.addEventListener('submit', async event => {
  event.preventDefault();
  clearResults();

  const from = new Date(fromField.value);
  const to = new Date(toField.value);

  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from >= to) {
    notify('La date de fin doit être postérieure à la date de début.', true);
    return;
  }

  if (toLocalInputValue(from) !== fromField.value || toLocalInputValue(to) !== toField.value) {
    notify('Une des heures choisies est invalide dans le fuseau horaire du PC.', true);
    return;
  }

  const query = new URLSearchParams({
    variableId: variableField.value,
    from: from.toISOString(),
    to: to.toISOString()
  });

  fields.disabled = true;
  notify('Recherche des mesures…');

  try {
    const { measures, truncated } = await getJson(`/api/historique?${query}`);

    if (measures.length === 0) {
      notify('Aucune mesure enregistrée pour cette variable sur la période sélectionnée.');
      return;
    }

    renderMeasures(measures);
    download.href = `/api/historique/export.csv?${query}`;
    download.hidden = false;

    const count = measures.length.toLocaleString('fr-FR');
    const summary = measures.length === 1 ? '1 mesure affichée.' : `${count} mesures affichées.`;

    notify(truncated
      ? `${summary} Le CSV contient toutes les mesures de la période.`
      : summary);
  } catch (error) {
    notify(`Impossible de charger les mesures. ${error.message}`, true);
  } finally {
    fields.disabled = false;
  }
});

loadVariables().catch(error => {
  notify(`Impossible de charger les variables. ${error.message}`, true);
});