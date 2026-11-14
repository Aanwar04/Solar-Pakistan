const systems = {
  "on-grid": {
    name: "On-grid solar system",
    summary: "Uses your usual electricity supply; standard models stop during a power cut.",
    description: "Solar panels and your usual electricity supply can both power the home. Most standard systems switch off during a power cut.",
    flows: ["solar-home", "grid-home"]
  },
  "off-grid": {
    name: "Off-grid solar system",
    summary: "Works without your usual electricity supply; a battery saves power for later.",
    description: "Solar panels power the home and charge a battery. The battery can power the home when sunlight is low.",
    flows: ["solar-home", "solar-battery", "battery-home"]
  },
  hybrid: {
    name: "Hybrid solar system",
    summary: "Can use your usual electricity supply and a battery; backup depends on the equipment and wiring.",
    description: "Solar panels can power the home and charge a battery, while your usual electricity supply is available when needed.",
    flows: ["solar-home", "grid-home", "solar-battery", "battery-home"]
  }
};

const appliancePresets = {
  "Fan": 75,
  "Inverter AC 1 ton": 900,
  "Inverter AC 1.5 ton": 1200,
  "Inverter AC 2 ton": 1800,
  "Refrigerator": 200,
  "Deep freezer": 250,
  "Electric geyser": 2000,
  "Pump 0.5 HP": 400,
  "Pump 1 HP": 750,
  "Iron": 1200,
  "Washing machine": 500,
  "LED TV": 100,
  "LED light": 12
};

let selectedSystem = "on-grid";
let selectedScenario = "day";

function getDiagramState(system, scenario) {
  const battery = system !== "on-grid";
  const grid = system !== "off-grid" && scenario !== "outage";
  const solar = scenario !== "night" && !(system === "on-grid" && scenario === "outage");
  const discharge = battery && (scenario === "night" || scenario === "outage");
  const flows = [];
  if (solar) flows.push("solar-inverter");
  if (grid) flows.push("grid-inverter");
  if (discharge) flows.push("battery-inverter");
  else if (solar && battery) flows.push("inverter-battery");
  if (solar || grid || discharge) flows.push("inverter-home");
  const message = system === "on-grid"
    ? scenario === "outage" ? "Standard on-grid solar shuts down during a grid outage. No backup power is shown."
      : scenario === "night" ? "At night, the grid supplies your home. Solar panels are not generating."
      : "Solar and the grid can supply your home. No battery is included in this example."
    : scenario === "outage" ? system === "off-grid"
      ? "A grid outage does not affect this independent system. Solar and stored energy can supply the home within equipment limits."
      : "The grid is isolated. Solar and a charged battery can supply only the circuits wired for backup, within equipment limits."
    : scenario === "night" ? "A charged battery can supply the home within its capacity and inverter limits." + (grid ? " Grid power is also available; priority depends on settings." : " This system has no grid connection.")
    : "Solar can supply the home and charge the battery with surplus energy." + (grid ? " Grid power is available when needed." : " This system works independently of the grid.");
  return { battery, grid, solar, flows, message };
}

function setSystem(key) {
  if (!systems[key]) return;
  selectedSystem = key;
  renderDiagram();
}

function renderDiagram() {
  const state = getDiagramState(selectedSystem, selectedScenario);
  document.querySelectorAll(".system-tab").forEach(tab => tab.setAttribute("aria-pressed", String(tab.dataset.system === selectedSystem)));
  document.querySelectorAll("[data-scenario]").forEach(tab => tab.setAttribute("aria-pressed", String(tab.dataset.scenario === selectedScenario)));
  document.querySelectorAll(".flow").forEach(path => { path.dataset.active = String(state.flows.includes(path.dataset.flow)); });
  document.querySelector("#system-name").textContent = selectedSystem === "hybrid" ? "Hybrid with battery backup" : systems[selectedSystem].name;
  document.querySelector("#system-summary").textContent = state.message;
  document.querySelector("#diagram-description").textContent = state.message;
  for (const [node, available] of [["grid", state.grid], ["battery", state.battery], ["solar", state.solar], ["inverter", state.flows.length > 0], ["home", state.flows.length > 0]]) {
    document.querySelector(`.node-${node}`).dataset.connected = String(available);
  }
  document.querySelector("#solar-state").textContent = "Solar: " + (selectedScenario === "night" ? "not generating" : state.solar ? "available" : "shut down");
  document.querySelector("#grid-state").textContent = "Grid: " + (selectedSystem === "off-grid" ? "not used" : state.grid ? "connected" : "isolated");
  document.querySelector("#battery-state").textContent = "Battery: " + (state.battery ? "included" : "not used");
  document.querySelector("#diagram-status").textContent = selectedScenario === "outage" && selectedSystem === "hybrid" ? "Backup circuits only" : state.flows.length ? "Possible supply routes shown" : "No household supply in this example";
}

function calculateEstimate(monthlyKwh, sunHours, performanceRatio, panelWatts) {
  if (![monthlyKwh, sunHours, performanceRatio].every(Number.isFinite)
    || monthlyKwh <= 0
    || sunHours <= 0
    || performanceRatio <= 0
    || performanceRatio > 1) {
    throw new RangeError("Enter positive energy and sunlight values, and a performance ratio above 0 and at most 1.");
  }

  const targetKwp = monthlyKwh / (30 * sunHours * performanceRatio);
  return calculateArray(targetKwp, sunHours, performanceRatio, panelWatts);
}

function calculateArray(targetKwp, sunHours, performanceRatio, panelWatts) {
  if (![targetKwp, sunHours, performanceRatio].every(Number.isFinite)
    || targetKwp <= 0
    || sunHours <= 0
    || performanceRatio <= 0
    || performanceRatio > 1
    || !Number.isFinite(panelWatts)
    || panelWatts <= 0) {
    throw new RangeError("Enter positive energy, sunlight, and panel wattage values, and a performance ratio above 0 and at most 1.");
  }

  const panelCount = Math.ceil((targetKwp * 1000) / panelWatts);
  const installedKwp = panelCount * panelWatts / 1000;
  const modeledMonthlyKwh = installedKwp * sunHours * 30 * performanceRatio;

  return { targetKwp, panelWatts, panelCount, installedKwp, modeledMonthlyKwh };
}

function renderEstimate({ dailyKwh, connectedKw, estimate, batteryKwh = null, message, basis }) {
  document.querySelector(".results-heading").textContent = "Your planning estimate";
  document.querySelector("#daily-kwh").textContent = dailyKwh.toFixed(1);
  const connectedResult = document.querySelector("#connected-result");
  connectedResult.hidden = connectedKw === null;
  if (connectedKw !== null) {
    document.querySelector("#connected-kw").textContent = connectedKw.toFixed(2);
  }
  document.querySelector("#target-kwp").textContent = estimate.targetKwp.toFixed(2);
  document.querySelector("#panel-wattage-label").textContent = String(estimate.panelWatts);
  document.querySelector("#panel-count").textContent = String(estimate.panelCount);
  document.querySelector("#installed-kwp").textContent = estimate.installedKwp.toFixed(2);
  document.querySelector("#estimated-kwh").textContent = String(Math.round(estimate.modeledMonthlyKwh));
  const batteryResult = document.querySelector("#battery-result");
  batteryResult.hidden = batteryKwh === null;
  if (batteryKwh !== null) {
    document.querySelector("#battery-kwh").textContent = batteryKwh.toFixed(2);
  }
  document.querySelector("#estimate-basis").textContent = basis;
  document.querySelector("#estimate-message").textContent = message;
  document.querySelector("#print-estimate").disabled = false;
  document.querySelector("#estimate-results").focus({ preventScroll: true });
  if (window.matchMedia("(max-width: 42rem)").matches) {
    document.querySelector("#estimate-results").scrollIntoView({ block: "start" });
  }
}

function invalidateEstimate(reason) {
  document.querySelector("#print-estimate").disabled = true;
  document.querySelector(".results-heading").textContent = "Update your estimate";
  document.querySelector("#estimate-basis").textContent = reason;
  document.querySelector("#estimate-message").textContent = "Calculate again to update your estimate with the changed inputs.";
  document.querySelector("#daily-kwh").textContent = "—";
  document.querySelector("#connected-result").hidden = true;
  document.querySelector("#target-kwp").textContent = "—";
  document.querySelector("#panel-wattage-label").textContent = document.querySelector("#panel-wattage").value;
  document.querySelector("#panel-count").textContent = "—";
  document.querySelector("#installed-kwp").textContent = "—";
  document.querySelector("#estimated-kwh").textContent = "—";
  document.querySelector("#battery-result").hidden = true;
}

function getSunlightBasis(sunHours) {
  const citySelect = document.querySelector("#solar-city");
  const city = citySelect.value;
  const citySunHours = Number(citySelect.selectedOptions[0].dataset.sunHours);
  if (city && city !== "Other" && sunHours === citySunHours) {
    return `the ${city} sunlight estimate of ${sunHours} equivalent peak-sun hours per day from NASA POWER (2001–2025)`;
  }
  if (city && city !== "Other") {
    return `the ${city} sunlight estimate, adjusted to ${sunHours} equivalent peak-sun hours per day`;
  }
  return `${sunHours} equivalent peak-sun hours per day${city === "Other" ? " using the general estimate" : " with no city selected"}`;
}

function updateCitySunHours() {
  const citySelect = document.querySelector("#solar-city");
  const selectedOption = citySelect.selectedOptions[0];
  const sunHours = selectedOption.dataset.sunHours;
  if (sunHours) {
    document.querySelectorAll('input[name="sunHours"]').forEach((input) => {
      input.value = sunHours;
    });
    document.querySelector("#city-sunlight-note").firstChild.textContent = `${selectedOption.value === "Other" ? "General sunlight estimate selected: " : `${selectedOption.value} estimate selected: `}${sunHours} equivalent peak-sun hours/day. City values are approximate annual averages on a horizontal surface from `;
  } else {
    document.querySelectorAll('input[name="sunHours"]').forEach((input) => {
      input.value = "5";
    });
    document.querySelector("#city-sunlight-note").firstChild.textContent = "No city selected. Adjust the sunlight value under advanced settings if needed. City values are approximate annual averages on a horizontal surface from ";
  }
  invalidateEstimate(citySelect.value ? `Sunlight estimate changed for ${citySelect.value}.` : "City selection changed.");
}

function updateMonthlyEstimate(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;

  const values = new FormData(form);
  const monthlyKwh = Number(values.get("monthlyKwh"));
  const sunHours = Number(values.get("sunHours"));
  const performanceRatio = Number(values.get("performanceRatio")) / 100;
  const panelWatts = Number(document.querySelector("#panel-wattage").value);
  const estimate = calculateEstimate(monthlyKwh, sunHours, performanceRatio, panelWatts);
  renderEstimate({
    dailyKwh: monthlyKwh / 30,
    connectedKw: null,
    estimate,
    basis: `Based on ${monthlyKwh} units per month, ${panelWatts} W panels, ${getSunlightBasis(sunHours)}, and ${performanceRatio * 100}% estimated system efficiency.`,
    message: "Monthly-use estimate only. A bill does not reveal connected load or backup battery needs."
  });
}

function updateApplianceEstimate(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;

  const sunHours = Number(form.elements.sunHours.value);
  const performanceRatio = Number(form.elements.performanceRatio.value) / 100;
  const panelWatts = Number(document.querySelector("#panel-wattage").value);
  const backupHours = Number(form.elements.backupHours.value);
  const systemType = form.elements.systemType.value;
  const rows = [...form.querySelectorAll("[data-appliance-row]")];
  const errorMessage = document.querySelector("#appliance-error");
  errorMessage.textContent = "";
  if (rows.length === 0) {
    errorMessage.textContent = "Add at least one appliance before calculating.";
    document.querySelector("#add-appliance").focus();
    return;
  }

  const load = rows.reduce((totals, row) => {
    const watts = Number(row.querySelector('[data-field="watts"]').value);
    const quantity = Number(row.querySelector('[data-field="quantity"]').value);
    const hours = Number(row.querySelector('[data-field="hours"]').value);
    const critical = row.querySelector('[data-field="critical"]').checked;
    totals.connectedWatts += watts * quantity;
    totals.dailyKwh += watts * quantity * hours / 1000;
    if (critical) totals.backupWatts += watts * quantity;
    return totals;
  }, { connectedWatts: 0, dailyKwh: 0, backupWatts: 0 });

  if (load.connectedWatts <= 0 || load.dailyKwh <= 0) {
    errorMessage.textContent = "Set a positive quantity and daily run time for at least one appliance.";
    rows[0].querySelector('[data-field="quantity"]').focus();
    return;
  }

  const estimate = calculateArray(load.dailyKwh / (sunHours * performanceRatio), sunHours, performanceRatio, panelWatts);
  const applianceSummary = rows.map((row) => {
    const name = row.querySelector('[data-field="name"]').value;
    const quantity = Number(row.querySelector('[data-field="quantity"]').value);
    const hours = Number(row.querySelector('[data-field="hours"]').value);
    return `${quantity} × ${name} (${hours} h/day)`;
  }).join(", ");
  const backupSummary = systemType !== "on-grid" ? rows
    .filter((row) => row.querySelector('[data-field="critical"]').checked)
    .map((row) => `${Number(row.querySelector('[data-field="quantity"]').value)} × ${row.querySelector('[data-field="name"]').value}`)
    .join(", ") : "";
  const batteryKwh = systemType !== "on-grid" && load.backupWatts > 0
    ? (load.backupWatts / 1000 * backupHours) / (0.8 * 0.9)
    : null;
  const systemMessage = systemType === "on-grid"
    ? "No battery estimate is shown for this choice. Most standard grid-connected systems switch off during a power cut."
    : load.backupWatts > 0
      ? `The battery estimate covers only the devices you marked to keep on, for ${backupHours} hours. It is a rough guide; an installer must check device startup power and equipment compatibility.`
      : "You did not select any devices to keep on during a power cut, so no battery size is shown. An off-grid home still needs enough battery storage to run the devices you use.";
  renderEstimate({
    dailyKwh: load.dailyKwh,
    connectedKw: load.connectedWatts / 1000,
    estimate,
    batteryKwh,
    basis: `Based on ${applianceSummary}, ${panelWatts} W panels, ${getSunlightBasis(sunHours)}, ${performanceRatio * 100}% estimated system efficiency, and ${systemType} sizing.${backupSummary ? ` Selected backup devices: ${backupSummary} for ${backupHours} hours.` : ""}`,
    message: `${systemMessage} Solar sizing is a planning estimate, not a production guarantee.`
  });
}

function setCalculator(key) {
  invalidateEstimate("Input method changed. Calculate using your chosen method.");
  document.querySelectorAll(".calculator-tab").forEach((tab) => {
    const selected = tab.dataset.calculator === key;
    tab.setAttribute("aria-pressed", String(selected));
  });
  document.querySelectorAll("[data-calculator-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.calculatorPanel !== key;
  });
}

function updateBackupOptions() {
  const needsBattery = document.querySelector("#system-type").value !== "on-grid";
  document.querySelectorAll(".critical-label").forEach((label) => {
    label.hidden = !needsBattery;
    label.querySelector("input").disabled = !needsBattery;
  });
  const backupDuration = document.querySelector("#backup-duration");
  backupDuration.hidden = !needsBattery;
  backupDuration.querySelector("input").disabled = !needsBattery;
  document.querySelector("#backup-help").textContent = needsBattery
    ? "Select “Keep on during a power cut” only for devices you want the battery to run. The battery estimate assumes those devices run at full power for the full time you choose."
    : "On-grid systems usually switch off during a power cut, so backup-device choices and a battery estimate are not available.";
  document.querySelector("#battery-estimate-help").hidden = !needsBattery;
}

let applianceRowSequence = document.querySelectorAll("[data-appliance-row]").length;

function addApplianceRow() {
  const list = document.querySelector("#appliance-list");
  const rows = list.querySelectorAll("[data-appliance-row]");
  const limitMessage = document.querySelector("#appliance-limit");
  if (rows.length >= 12) {
    limitMessage.textContent = "The appliance list is limited to 12 rows.";
    return;
  }
  limitMessage.textContent = "";

  const number = ++applianceRowSequence;
  const row = document.createElement("div");
  row.className = "appliance-row";
  row.dataset.applianceRow = "";

  const nameLabel = document.createElement("label");
  nameLabel.className = "appliance-name";
  nameLabel.htmlFor = `appliance-name-${number}`;
  nameLabel.textContent = `Appliance ${number}`;
  const select = document.createElement("select");
  select.id = nameLabel.htmlFor;
  select.name = "applianceName";
  select.dataset.field = "name";
  select.setAttribute("aria-label", `Appliance ${number} type`);
  [...Object.keys(appliancePresets), "Other"].forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    select.append(option);
  });

  const fields = [
    { label: "Typical power (W)", name: "watts", type: "number", min: "1", max: "100000", value: "75", inputmode: "decimal" },
    { label: "How many?", name: "quantity", type: "number", min: "0", max: "100", step: "1", value: "1", inputmode: "numeric" },
    { label: "Hours used each day", name: "hours", type: "number", min: "0", max: "24", step: "0.5", value: "1", inputmode: "decimal" }
  ];
  row.append(nameLabel, select);
  fields.forEach((field) => {
    const id = `appliance-${field.name}-${number}`;
    const label = document.createElement("label");
    label.htmlFor = id;
    label.textContent = field.label;
    const input = document.createElement("input");
    input.id = id;
    input.name = field.name;
    input.type = field.type;
    input.min = field.min;
    input.max = field.max;
    input.step = field.step || "any";
    input.value = field.value;
    input.inputMode = field.inputmode;
    input.required = true;
    input.dataset.field = field.name;
    row.append(label, input);
  });

  const criticalLabel = document.createElement("label");
  criticalLabel.className = "critical-label";
  const critical = document.createElement("input");
  critical.type = "checkbox";
  critical.name = "critical";
  critical.dataset.field = "critical";
  criticalLabel.append(critical, document.createTextNode(" Keep on during a power cut"));
  const remove = document.createElement("button");
  remove.className = "remove-appliance";
  remove.type = "button";
  remove.textContent = "Remove";
  remove.setAttribute("aria-label", `Remove appliance ${number}`);
  row.append(criticalLabel, remove);
  list.append(row);
  updateBackupOptions();
  invalidateEstimate("Appliance added. Calculate again to include it.");
  document.querySelector("#appliance-error").textContent = "";
}

document.querySelectorAll(".system-tab").forEach((tab) => {
  tab.addEventListener("click", () => setSystem(tab.dataset.system));
});

document.querySelectorAll(".calculator-tab").forEach((tab) => {
  tab.addEventListener("click", () => setCalculator(tab.dataset.calculator));
});

document.querySelector("#estimate-form").addEventListener("submit", updateMonthlyEstimate);

document.querySelectorAll("[data-monthly-example]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelector("#monthly-kwh").value = button.dataset.monthlyExample;
    document.querySelector("#estimate-form").requestSubmit();
  });
});
document.querySelector("#appliance-form").addEventListener("submit", updateApplianceEstimate);
document.querySelector("#print-estimate").addEventListener("click", () => window.print());
document.querySelector("#estimate-form").addEventListener("change", () => invalidateEstimate("Monthly estimate inputs changed."));
document.querySelector("#appliance-form").addEventListener("change", () => invalidateEstimate("Appliance estimate inputs changed."));
document.querySelector("#solar-city").addEventListener("change", updateCitySunHours);
document.querySelector("#panel-wattage").addEventListener("change", () => invalidateEstimate("Panel rating changed."));
document.querySelectorAll('input[name="sunHours"]').forEach((input) => {
  input.addEventListener("change", () => {
    const city = document.querySelector("#solar-city").value;
    if (city && city !== "Other") {
      document.querySelector("#city-sunlight-note").firstChild.textContent = `You adjusted the ${city} sunlight value to ${input.value} equivalent peak-sun hours/day. City averages are on a horizontal surface from `;
    }
  });
});
document.querySelector("#system-type").addEventListener("change", () => {
  updateBackupOptions();
  invalidateEstimate("Solar system type changed.");
});
document.querySelector("#add-appliance").addEventListener("click", addApplianceRow);
document.querySelector("#appliance-list").addEventListener("click", (event) => {
  const button = event.target.closest(".remove-appliance");
  if (button) {
    button.closest("[data-appliance-row]").remove();
    document.querySelector("#appliance-limit").textContent = "";
    invalidateEstimate("Appliance removed. Calculate again to update your estimate.");
    document.querySelector("#add-appliance").focus();
  }
});
document.querySelector("#appliance-list").addEventListener("change", (event) => {
  const select = event.target.closest('select[data-field="name"]');
  const watts = select && select.closest("[data-appliance-row]").querySelector('[data-field="watts"]');
  if (watts) watts.value = appliancePresets[select.value] || "100";
});

updateBackupOptions();

 document.querySelectorAll("[data-scenario]").forEach(button => {
  button.addEventListener("click", () => {
    selectedScenario = button.dataset.scenario;
    renderDiagram();
  });
});
renderDiagram();
