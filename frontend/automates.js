"use strict";

const form = document.querySelector("#automate-form");
const title = document.querySelector("#form-title");
const save = document.querySelector("#save");
const cancel = document.querySelector("#cancel");
const message = document.querySelector("#message");
const rows = document.querySelector("#automates");

const nameField = document.querySelector("#name");
const hostField = document.querySelector("#host");
const portField = document.querySelector("#port");
const unitField = document.querySelector("#unit-id");

let editingId = null;
let busy = false;

function notify(text, error = false) {
  message.textContent = text;
  message.classList.toggle("error", error);
}

async function request(path, options = {}) {
  const response = await fetch(path, { cache: "no-store", ...options });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || body.message || `Erreur HTTP ${response.status}`);
  }

  return response;
}

function resetForm() {
  form.reset();
  editingId = null;
  title.textContent = "Ajouter un automate";
  save.textContent = "Ajouter";
  cancel.hidden = true;
}

function edit(automate) {
  editingId = automate.id;
  nameField.value = automate.name;
  hostField.value = automate.host;
  portField.value = automate.port;
  unitField.value = automate.unitId;
  title.textContent = `Modifier l’automate « ${automate.name} »`;
  save.textContent = "Enregistrer";
  cancel.hidden = false;
  notify("");
  nameField.focus();
}

function actionButton(label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

async function loadAutomates() {
  const response = await request("/api/automates");
  const automates = await response.json();
  const fragment = document.createDocumentFragment();

  for (const automate of automates) {
    const row = document.createElement("tr");

    for (const value of [automate.name, automate.host, automate.port, automate.unitId]) {
      row.insertCell().textContent = value;
    }

    const actions = document.createElement("div");
    actions.className = "actions";
    actions.append(
      actionButton("Modifier", () => edit(automate)),
      actionButton("Archiver", () => archive(automate))
    );

    row.insertCell().append(actions);
    fragment.append(row);
  }

  if (automates.length === 0) {
    const row = document.createElement("tr");
    const cell = row.insertCell();
    cell.colSpan = 5;
    cell.textContent = "Aucun automate configuré.";
    fragment.append(row);
  }

  rows.replaceChildren(fragment);
}

function setBusy(value) {
  busy = value;
  for (const button of document.querySelectorAll("button")) {
    button.disabled = value;
  }
}

async function applyChange(path, options, successText, clearForm) {
  if (busy) return;
  setBusy(true);
  notify("");

  try {
    await request(path, options);
    if (clearForm) resetForm();

    try {
      await loadAutomates();
      notify(successText);
    } catch (error) {
      notify(`${successText} Rechargez la page pour actualiser la liste. ${error.message}`, true);
    }
  } catch (error) {
    notify(`Opération impossible. ${error.message}`, true);
  } finally {
    setBusy(false);
  }
}

function archive(automate) {
  const confirmed = window.confirm(
    `Archiver « ${automate.name} » ? La lecture de ses variables s’arrêtera.`
  );
  if (!confirmed) return;

  return applyChange(
    `/api/automates/${automate.id}`,
    { method: "DELETE" },
    "Automate archivé.",
    editingId === automate.id
  );
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const payload = {
    name: nameField.value.trim(),
    host: hostField.value.trim(),
    port: Number(portField.value),
    unitId: Number(unitField.value)
  };

  if (!payload.name || !payload.host) {
    notify("Renseignez le nom et l’adresse de l’automate.", true);
    return;
  }

  const creating = editingId === null;
  void applyChange(
    creating ? "/api/automates" : `/api/automates/${editingId}`,
    {
      method: creating ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    },
    creating ? "Automate ajouté." : "Modification enregistrée.",
    true
  );
});

cancel.addEventListener("click", () => {
  resetForm();
  notify("");
});

loadAutomates().catch((error) => {
  notify(`Chargement des automates impossible. ${error.message}`, true);
});