"use strict";

const form = document.querySelector("#variable-form");
const title = document.querySelector("#form-title");
const save = document.querySelector("#save");
const cancel = document.querySelector("#cancel");
const message = document.querySelector("#message");
const rows = document.querySelector("#variables");
const automateSelect = form.elements.namedItem("automateId");

const fields = [
  "automateId", "name", "unit", "registerType",
  "registerAddress", "dataType", "scaleFactor", "intervalMs"
];

let editingId = null;
let busy = false;
let ready = false;

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
  title.textContent = "Ajouter une variable";
  save.textContent = "Ajouter";
  cancel.hidden = true;
}

function edit(variable) {
  editingId = variable.id;
  for (const key of fields) {
    form.elements.namedItem(key).value = variable[key] ?? "";
  }
  title.textContent = `Modifier « ${variable.name} »`;
  save.textContent = "Enregistrer";
  cancel.hidden = false;
  notify("");
  form.elements.namedItem("name").focus();
}

function button(label, onClick) {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = label;
  element.addEventListener("click", onClick);
  return element;
}

function renderRows(variables, automateNames) {
  const fragment = document.createDocumentFragment();

  for (const variable of variables) {
    const row = document.createElement("tr");
    const values = [
      variable.name,
      automateNames.get(String(variable.automateId)) ?? `ID ${variable.automateId}`,
      `${variable.registerType} · ${variable.registerAddress}`,
      variable.unit || "—",
      `${variable.intervalMs} ms`
    ];

    for (const value of values) row.insertCell().textContent = value;

    const actions = document.createElement("div");
    actions.className = "actions";
    actions.append(
      button("Modifier", () => edit(variable)),
      button("Archiver", () => archive(variable))
    );
    row.insertCell().append(actions);
    fragment.append(row);
  }

  if (variables.length === 0) {
    const row = document.createElement("tr");
    const cell = row.insertCell();
    cell.colSpan = 6;
    cell.textContent = "Aucune variable configurée.";
    fragment.append(row);
  }

  rows.replaceChildren(fragment);
}

async function loadConfiguration() {
  const [automates, variables] = await Promise.all([
    request("/api/automates").then(response => response.json()),
    request("/api/variables").then(response => response.json())
  ]);

  const previousId = automateSelect.value;
  const names = new Map(automates.map(a => [String(a.id), a.name]));
  automateSelect.replaceChildren(
    ...automates.map(a => new Option(a.name, String(a.id)))
  );
  if (names.has(previousId)) automateSelect.value = previousId;

  renderRows(variables, names);
  ready = automates.length > 0;
  if (!ready) notify("Ajoutez d’abord un automate dans la page de configuration.");
}

function updateButtons() {
  for (const item of document.querySelectorAll("button")) {
    item.disabled = busy;
  }
  save.disabled = busy || !ready;
}

async function change(path, options, successText, clearForm) {
  if (busy) return;
  busy = true;
  updateButtons();
  notify("");

  try {
    await request(path, options);
    if (clearForm) resetForm();
    notify(successText);

    try {
      await loadConfiguration();
    } catch (error) {
      notify(`${successText} Rechargez la page pour actualiser la liste. ${error.message}`, true);
    }
  } catch (error) {
    notify(`Opération impossible. ${error.message}`, true);
  } finally {
    busy = false;
    updateButtons();
  }
}

function archive(variable) {
  if (!window.confirm(`Archiver « ${variable.name} » et arrêter sa lecture ?`)) return;

  void change(
    `/api/variables/${variable.id}`,
    { method: "DELETE" },
    "Variable archivée.",
    editingId === variable.id
  );
}

form.addEventListener("submit", event => {
  event.preventDefault();
  if (busy || !ready) return;

  const data = new FormData(form);
  const payload = {
    automateId: Number(data.get("automateId")),
    name: data.get("name").trim(),
    unit: data.get("unit").trim(),
    registerType: data.get("registerType"),
    registerAddress: Number(data.get("registerAddress")),
    dataType: data.get("dataType"),
    scaleFactor: Number(data.get("scaleFactor")),
    intervalMs: Number(data.get("intervalMs"))
  };

  if (!payload.name) {
    notify("Renseignez le nom de la variable.", true);
    return;
  }

  const creating = editingId === null;
  void change(
    creating ? "/api/variables" : `/api/variables/${editingId}`,
    {
      method: creating ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    },
    creating ? "Variable ajoutée." : "Modification enregistrée.",
    true
  );
});

cancel.addEventListener("click", () => {
  resetForm();
  notify("");
});

loadConfiguration()
  .catch(error => notify(`Chargement impossible. ${error.message}`, true))
  .finally(updateButtons);