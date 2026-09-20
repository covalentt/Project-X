const DEVICE_NAMES = [
  "Device 02 — Field Unit B",
  "Device 03 — Field Unit C",
  "Device 04 — Field Unit D",
];

const ALERT_INTERVAL = 10000;
const ALERT_SCENARIOS = [
  {
    type: "danger",
    icon: "⚠",
    title: "MULTIPLE SENSOR ALERTS",
    description: (values) => [
      `Gas / air quality is dangerous: ${values.gas} ADC (safe limit: 1200).`,
      `Heart rate is critically low: ${values.bpm} bpm (minimum: 50 bpm).`,
      "No finger detected by the MAX30102 sensor.",
      "Unusual motion detected by the MPU-6050 sensor.",
    ].join("\n"),
    values: { gas: 1680, bpm: 42, motion: true, finger: false },
  },
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const randomBetween = (min, max) => Math.random() * (max - min) + min;
const randomInt = (min, max) => Math.round(randomBetween(min, max));

function setStatus(card, status, level, text) {
  card.className = `metric-card ${level}`;
  status.className = `metric-status ${level}`;
  status.textContent = text;
}

function setPrimaryStatus(id, level, text) {
  const card = document.getElementById(`card-${id}-1`);
  const status = document.getElementById(`${id}-status-1`);
  setStatus(card, status, level, text);
}

function setDeviceReading(device, values) {
  const gasCard = device.querySelector('[data-card="gas"]');
  const bpmCard = device.querySelector('[data-card="bpm"]');
  const motionCard = device.querySelector('[data-card="motion"]');
  const fingerCard = device.querySelector('[data-card="finger"]');

  const gasValue = gasCard.querySelector('[data-value="gas"]');
  const gasBar = gasCard.querySelector('[data-bar="gas"]');
  const gasStatus = gasCard.querySelector('[data-status="gas"]');
  gasValue.textContent = values.gas;
  gasBar.style.width = `${(values.gas / 4095) * 100}%`;
  gasBar.style.background = "var(--accent-teal)";
  setStatus(gasCard, gasStatus, "ok", "CLEAR");

  const bpmValue = bpmCard.querySelector('[data-value="bpm"]');
  const bpmStatus = bpmCard.querySelector('[data-status="bpm"]');
  bpmValue.textContent = values.bpm;
  setStatus(bpmCard, bpmStatus, "ok", "NORMAL");

  const motionValue = motionCard.querySelector('[data-value="motion"]');
  const motionStatus = motionCard.querySelector('[data-status="motion"]');
  motionValue.textContent = values.motion ? "MOVING" : "STILL";
  setStatus(motionCard, motionStatus, "ok", values.motion ? "ACTIVE" : "STATIONARY");

  const fingerValue = fingerCard.querySelector('[data-value="finger"]');
  const fingerStatus = fingerCard.querySelector('[data-status="finger"]');
  fingerValue.textContent = "YES";
  setStatus(fingerCard, fingerStatus, "ok", "DETECTED");
}

function setPrimaryReading(values) {
  document.getElementById("gas-value-1").textContent = values.gas;
  document.getElementById("gas-bar-1").style.width = `${(values.gas / 4095) * 100}%`;
  document.getElementById("gas-bar-1").style.background = "var(--accent-teal)";
  setPrimaryStatus("gas", values.gas > 1200 ? "danger" : "ok", values.gas > 1200 ? "DANGER" : "CLEAR");
  document.getElementById("bpm-value-1").textContent = values.bpm;
  setPrimaryStatus("bpm", values.bpm > 0 && values.bpm < 50 ? "danger" : "ok", values.bpm > 0 && values.bpm < 50 ? "LOW BPM" : values.bpm > 0 ? "NORMAL" : "NO FINGER");
  document.getElementById("motion-value-1").textContent = values.motion ? "MOVING" : "STILL";
  setPrimaryStatus("motion", values.motion ? "danger" : "ok", values.motion ? "MOTION ALERT" : "STATIONARY");
  document.getElementById("finger-value-1").textContent = values.finger ? "YES" : "NO";
  setPrimaryStatus("finger", values.finger ? "ok" : "danger", values.finger ? "DETECTED" : "NO FINGER");

  document.getElementById("ax-val").textContent = values.ax.toFixed(2);
  document.getElementById("ay-val").textContent = values.ay.toFixed(2);
  document.getElementById("az-val").textContent = values.az.toFixed(2);
  setAccelBar(document.getElementById("ax-fill"), values.ax);
  setAccelBar(document.getElementById("ay-fill"), values.ay);
  setAccelBar(document.getElementById("az-fill"), values.az);
}

function showAlert(scenario, values, showModal) {
  const banner = document.getElementById("alert-banner");
  banner.className = `alert-banner ${scenario.type}`;
  banner.querySelector(".alert-icon").textContent = scenario.icon;
  banner.querySelector(".alert-text").textContent = `${scenario.title} — DEVICE 01 REQUIRES IMMEDIATE ATTENTION`;

  document.getElementById("modal-device-name").textContent = "Device 01 — Field Unit A";
  document.getElementById("modal-title").textContent = scenario.title;
  document.getElementById("modal-desc").textContent = scenario.description(values);
  if (showModal) {
    document.getElementById("alert-modal").classList.add("visible");
  }
}

function clearAlert() {
  const banner = document.getElementById("alert-banner");
  banner.className = "alert-banner ok";
  banner.querySelector(".alert-icon").textContent = "◉";
  banner.querySelector(".alert-text").textContent = "ALL SYSTEMS OK";
}

function setAccelBar(fillElement, value) {
  const clamped = clamp(value, -2, 2);
  const half = (clamped / 2) * 50;
  fillElement.style.left = `${half >= 0 ? 50 : 50 + half}%`;
  fillElement.style.width = `${Math.abs(half)}%`;
}

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 300 },
  plugins: { legend: { display: false } },
  scales: {
    x: { display: false },
    y: {
      ticks: { color: "#445555", font: { family: "'Share Tech Mono', monospace", size: 11 }, maxTicksLimit: 4 },
      grid: { color: "rgba(42,48,48,0.8)" },
      border: { color: "#2a3030" },
    },
  },
};

function createChart(id, color, min, max) {
  return new Chart(document.getElementById(id), {
    type: "line",
    data: { labels: [], datasets: [{ data: [], borderColor: color, backgroundColor: `${color}18`, borderWidth: 1.5, pointRadius: 0, tension: 0.4, fill: true }] },
    options: { ...chartOptions, scales: { ...chartOptions.scales, y: { ...chartOptions.scales.y, min, max } } },
  });
}

const bpmChart = createChart("bpm-chart", "#1fcfaa", 30, 160);
const gasChart = createChart("gas-chart", "#f0a030", 0, 4095);

function addChartPoint(chart, label, value) {
  chart.data.labels.push(label);
  chart.data.datasets[0].data.push(value);
  if (chart.data.labels.length > 30) {
    chart.data.labels.shift();
    chart.data.datasets[0].data.shift();
  }
  chart.update("none");
}

const deviceElements = [];
const deviceTemplate = document.getElementById("device-template");
DEVICE_NAMES.forEach((name, index) => {
  const device = deviceTemplate.content.cloneNode(true).firstElementChild;
  device.id = `device-panel-${index + 2}`;
  device.querySelector(".device-name").textContent = name;
  document.querySelector(".devices-grid").appendChild(device);
  deviceElements.push(device);
});
deviceTemplate.remove();

document.getElementById("modal-ok-btn").addEventListener("click", () => {
  document.getElementById("alert-modal").classList.remove("visible");
});

function createNormalReading() {
  return {
    gas: randomInt(180, 650),
    bpm: randomInt(68, 94),
    motion: Math.random() > 0.65,
    ax: randomBetween(-0.18, 0.18),
    ay: randomBetween(-0.18, 0.18),
    az: randomBetween(0.88, 1.12),
  };
}

let alertIndex = 0;
let activeAlert = ALERT_SCENARIOS[alertIndex];

function updateDashboard(showModal = false) {
  const now = new Date();
  const label = now.toLocaleTimeString();
  const primary = { ...createNormalReading(), ...activeAlert.values };
  setPrimaryReading(primary);
  addChartPoint(bpmChart, label, primary.bpm);
  addChartPoint(gasChart, label, primary.gas);
  deviceElements.forEach((device) => setDeviceReading(device, createNormalReading()));
  document.getElementById("last-updated").textContent = label;
  showAlert(activeAlert, primary, showModal);
}

updateDashboard(true);
setInterval(updateDashboard, 2000);
setInterval(() => {
  alertIndex = (alertIndex + 1) % ALERT_SCENARIOS.length;
  activeAlert = ALERT_SCENARIOS[alertIndex];
  updateDashboard(true);
}, ALERT_INTERVAL);
