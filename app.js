// ─────────────────────────────────────────
//  CONFIGURATION
// ─────────────────────────────────────────
const CONFIG = {
  auth:        "n50c3tuwopv9uGU3NJgCT3U5mn-_aji6",
  base:        "https://blynk.cloud/external/api/get",
  interval:    2000,   // ms between fetches
  maxPoints:   30,     // history length on charts
  gasThresh:   1200,   // matches firmware GAS_THRESHOLD
  bpmLow:      50,     // matches firmware LOW_BPM_THRESHOLD

  // ── CORS NOTE ────────────────────────────────────────────────────────────
  // Browsers block direct fetch() calls to blynk.cloud from a local/hosted
  // web page (CORS policy).  If you see "CORS" errors in DevTools Console,
  // you have two options:
  //
  //  Option A – Run a tiny proxy server locally (recommended):
  //    1. Install Node.js, then: npm install -g local-cors-proxy
  //    2. lcp --proxyUrl https://blynk.cloud
  //    3. Change CONFIG.base below to: "http://localhost:8010/proxy/external/api/get"
  //
  //  Option B – Deploy the proxy to a server (e.g. Render, Railway):
  //    Any HTTP server that forwards /blynk/* → https://blynk.cloud/*
  //    and sets Access-Control-Allow-Origin: * on the response.
  //
  //  Option C – Open the HTML file via a browser extension that disables
  //    CORS (for local development only — never in production).
  // ─────────────────────────────────────────────────────────────────────────
};

const PINS = {
  bpm:    "V0",   // heart rate (beatAvg)
  finger: "V1",   // finger detected (0/1)
  motion: "V2",   // motion detected (0/1)
  ir:     "V3",   // raw IR value
  gas:    "V4",   // gas value
  alert:  "V5",   // vibrator alert (0/1) — NOT a text string
};

// ─────────────────────────────────────────
//  STATIC DEVICE FLEET (devices 2–4)
//  Fixed "normal" readings — no polling, no alterations.
// ─────────────────────────────────────────
const STATIC_DEVICES = [
  { id: 2, name: "Device 02 — Field Unit B", gas: 340, bpm: 76, motion: "0", finger: "1" },
  { id: 3, name: "Device 03 — Field Unit C", gas: 410, bpm: 82, motion: "1", finger: "1" },
  { id: 4, name: "Device 04 — Field Unit D", gas: 295, bpm: 71, motion: "0", finger: "1" },
];

const DEVICE_DETAIL_HISTORY = {
  2: {
    gas: [310, 330, 345, 360, 355, 320, 340, 365, 360, 345, 330, 340, 355, 350, 335, 345, 360, 370, 355, 350, 340, 332, 325, 328, 340, 348, 356, 352, 345, 338],
    bpm: [74, 75, 78, 76, 77, 74, 75, 76, 79, 77, 75, 74, 73, 76, 78, 77, 79, 78, 76, 75, 74, 75, 76, 77, 78, 77, 76, 75, 74, 76],
  },
  3: {
    gas: [420, 440, 430, 455, 465, 470, 462, 448, 452, 468, 480, 472, 450, 455, 460, 470, 475, 468, 457, 448, 439, 445, 450, 458, 462, 470, 466, 454, 448, 442],
    bpm: [80, 81, 82, 84, 85, 83, 81, 82, 84, 83, 81, 80, 82, 83, 84, 85, 86, 84, 83, 82, 81, 80, 83, 85, 84, 83, 82, 81, 80, 82],
  },
  4: {
    gas: [290, 300, 315, 305, 298, 287, 280, 290, 300, 295, 286, 292, 298, 306, 310, 302, 294, 290, 286, 294, 300, 298, 292, 286, 280, 286, 298, 305, 300, 294],
    bpm: [69, 70, 71, 72, 71, 70, 69, 70, 71, 73, 72, 71, 70, 69, 70, 72, 73, 72, 71, 70, 69, 68, 69, 70, 71, 72, 71, 70, 69, 71],
  },
};

// ─────────────────────────────────────────
//  DOM REFERENCES (top-level / global)
// ─────────────────────────────────────────
const dom = {
  liveDot:      document.getElementById("live-dot"),
  liveLabel:    document.getElementById("live-label"),
  lastUpdated:  document.getElementById("last-updated"),

  alertBanner:  document.getElementById("alert-banner"),
  alertIcon:    document.getElementById("alert-icon"),
  alertText:    document.getElementById("alert-text"),

  axVal:        document.getElementById("ax-val"),
  ayVal:        document.getElementById("ay-val"),
  azVal:        document.getElementById("az-val"),
  axFill:       document.getElementById("ax-fill"),
  ayFill:       document.getElementById("ay-fill"),
  azFill:       document.getElementById("az-fill"),

  modalOverlay:   document.getElementById("alert-modal"),
  modalDevice:    document.getElementById("modal-device-name"),
  modalTitle:     document.getElementById("modal-title"),
  modalDesc:      document.getElementById("modal-desc"),
  modalOkBtn:     document.getElementById("modal-ok-btn"),
};

// ─────────────────────────────────────────
//  PER-DEVICE ELEMENT GETTERS
// ─────────────────────────────────────────
function deviceEls(id) {
  return {
    gasValue:  document.getElementById(`gas-value-${id}`),
    gasBar:    document.getElementById(`gas-bar-${id}`),
    gasStatus: document.getElementById(`gas-status-${id}`),
    cardGas:   document.getElementById(`card-gas-${id}`),

    bpmValue:  document.getElementById(`bpm-value-${id}`),
    bpmStatus: document.getElementById(`bpm-status-${id}`),
    cardBpm:   document.getElementById(`card-bpm-${id}`),

    motionValue:  document.getElementById(`motion-value-${id}`),
    motionStatus: document.getElementById(`motion-status-${id}`),
    cardMotion:   document.getElementById(`card-motion-${id}`),

    fingerValue:  document.getElementById(`finger-value-${id}`),
    fingerStatus: document.getElementById(`finger-status-${id}`),
    cardFinger:   document.getElementById(`card-finger-${id}`),
  };
}

// ─────────────────────────────────────────
//  CHART SETUP (Device 01 only)
// ─────────────────────────────────────────
const chartDefaults = {
  responsive:          true,
  maintainAspectRatio: false,
  animation:           { duration: 300 },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "#1a1e1e",
      borderColor:     "#2a3030",
      borderWidth:     1,
      titleColor:      "#7a9090",
      bodyColor:       "#c8e8e0",
      titleFont:       { family: "'Share Tech Mono', monospace", size: 11 },
      bodyFont:        { family: "'Share Tech Mono', monospace", size: 12 },
      padding:         8,
    },
  },
  scales: {
    x: {
      display: false,
    },
    y: {
      ticks: {
        color:         "#445555",
        font:          { family: "'Share Tech Mono', monospace", size: 11 },
        maxTicksLimit: 4,
      },
      grid: {
        color: "rgba(42,48,48,0.8)",
      },
      border: {
        color: "#2a3030",
      },
    },
  },
};

function createLineChart(canvasId, color, label, yMin, yMax) {
  const ctx = document.getElementById(canvasId).getContext("2d");
  return new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [{
        label,
        data:            [],
        borderColor:     color,
        backgroundColor: color + "18",
        borderWidth:     1.5,
        pointRadius:     0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: color,
        tension:         0.4,
        fill:            true,
      }],
    },
    options: {
      ...chartDefaults,
      scales: {
        ...chartDefaults.scales,
        y: {
          ...chartDefaults.scales.y,
          min: yMin,
          max: yMax,
        },
      },
    },
  });
}

const bpmChart = createLineChart("bpm-chart", "#1fcfaa", "BPM",  30,  160);
const gasChart = createLineChart("gas-chart",  "#f0a030", "Gas",   0, 4095);

function setSelectedDevice(deviceId) {
  const devicePanel = document.getElementById(`device-panel-${deviceId}`);
  const detailPanel = document.getElementById("device-detail-panel");
  const detailName = document.getElementById("detail-device-name");
  const detailBadge = document.getElementById("detail-badge");

  document.querySelectorAll(".device-panel").forEach(panel => {
    panel.classList.toggle("selected", panel === devicePanel);
  });

  if (!detailPanel || !devicePanel) return;

  const isLiveDevice = deviceId === 1;
  detailPanel.classList.remove("hidden");
  detailName.textContent = devicePanel.querySelector(".device-name").textContent;
  detailBadge.textContent = isLiveDevice ? "LIVE" : "STATIC";
  detailBadge.className = isLiveDevice ? "device-badge live" : "device-badge standby";

  if (isLiveDevice) {
    document.querySelector(".detail-chart .panel-title").textContent = "Device 01 — Heart Rate History";
    document.querySelectorAll(".detail-chart")[1].querySelector(".panel-title").textContent = "Device 01 — Gas History";
    return;
  }

  const history = DEVICE_DETAIL_HISTORY[deviceId];
  if (!history) return;

  const bpmLabels = history.bpm.map((_, index) => `T-${history.bpm.length - index}`);
  const gasLabels = history.gas.map((_, index) => `T-${history.gas.length - index}`);

  bpmChart.data.labels = bpmLabels;
  bpmChart.data.datasets[0].data = history.bpm;
  bpmChart.options.scales.y.min = 60;
  bpmChart.options.scales.y.max = 100;

  gasChart.data.labels = gasLabels;
  gasChart.data.datasets[0].data = history.gas;
  gasChart.options.scales.y.min = 250;
  gasChart.options.scales.y.max = 500;

  bpmChart.update();
gasChart.update();

  document.querySelector(".detail-chart .panel-title").textContent = `${devicePanel.querySelector(".device-name").textContent} — Heart Rate History`;
  document.querySelectorAll(".detail-chart")[1].querySelector(".panel-title").textContent = `${devicePanel.querySelector(".device-name").textContent} — Gas History`;
}

function hideSelectedDeviceDetail() {
  const detailPanel = document.getElementById("device-detail-panel");
  if (detailPanel) detailPanel.classList.add("hidden");
  document.querySelectorAll(".device-panel").forEach(panel => panel.classList.remove("selected"));
}

function pushToChart(chart, timeLabel, value) {
  const d = chart.data;
  d.labels.push(timeLabel);
  d.datasets[0].data.push(value);
  if (d.labels.length > CONFIG.maxPoints) {
    d.labels.shift();
    d.datasets[0].data.shift();
  }
  chart.update("none");
}

// ─────────────────────────────────────────
//  ACCELEROMETER BAR HELPER (Device 01 only)
// ─────────────────────────────────────────
function setAccelBar(fillEl, value) {
  const clamped = Math.max(-2, Math.min(2, value));
  const center  = 50;
  const half    = (clamped / 2) * 50;

  if (half >= 0) {
    fillEl.style.left  = center + "%";
    fillEl.style.width = half + "%";
  } else {
    fillEl.style.left  = (center + half) + "%";
    fillEl.style.width = Math.abs(half) + "%";
  }
}

// ─────────────────────────────────────────
//  STATUS HELPERS
// ─────────────────────────────────────────
function setStatus(el, cardEl, level, text) {
  el.textContent   = text;
  el.className     = "metric-status " + level;
  cardEl.className = cardEl.className.includes("metric-row compact")
    ? cardEl.className
    : cardEl.className; // no-op guard, class rebuilt below
  cardEl.className = "metric-card " + level;
}

function setConnectionState(state) {
  dom.liveDot.className     = "live-dot " + state;
  dom.liveLabel.textContent = state === "connected"
    ? "Live"
    : state === "error"
    ? "Error"
    : "Connecting…";
}

// ─────────────────────────────────────────
//  GENERIC PER-DEVICE APPLY FUNCTIONS
//  Used for both the live device and the 3 static devices.
// ─────────────────────────────────────────
function applyGas(id, gasVal) {
  const els = deviceEls(id);
  const gasPct = Math.min(100, (gasVal / 4095) * 100).toFixed(1);

  els.gasValue.textContent    = isNaN(gasVal) ? "—" : gasVal;
  els.gasBar.style.width      = gasPct + "%";
  els.gasBar.style.background = gasVal > CONFIG.gasThresh ? "#f04848" : "#1fcfaa";

  if (isNaN(gasVal)) {
    setStatus(els.gasStatus, els.cardGas, "", "NO DATA");
  } else if (gasVal > CONFIG.gasThresh) {
    setStatus(els.gasStatus, els.cardGas, "danger", "DANGER");
  } else if (gasVal > CONFIG.gasThresh * 0.75) {
    setStatus(els.gasStatus, els.cardGas, "warn", "ELEVATED");
  } else {
    setStatus(els.gasStatus, els.cardGas, "ok", "CLEAR");
  }
}

function applyBpm(id, bpmVal) {
  const els = deviceEls(id);
  els.bpmValue.textContent = bpmVal > 0 ? bpmVal.toFixed(0) : "—";

  if (isNaN(bpmVal) || bpmVal <= 0) {
    setStatus(els.bpmStatus, els.cardBpm, "", "NO FINGER");
  } else if (bpmVal < CONFIG.bpmLow) {
    setStatus(els.bpmStatus, els.cardBpm, "danger", "LOW BPM");
  } else if (bpmVal > 120) {
    setStatus(els.bpmStatus, els.cardBpm, "warn", "ELEVATED");
  } else {
    setStatus(els.bpmStatus, els.cardBpm, "ok", "NORMAL");
  }
}

function applyMotion(id, moving) {
  const els = deviceEls(id);
  els.motionValue.textContent = moving ? "MOVING" : "STILL";
  setStatus(els.motionStatus, els.cardMotion, moving ? "ok" : "warn",
    moving ? "ACTIVE" : "STATIONARY");
}

function applyFinger(id, finger) {
  const els = deviceEls(id);
  els.fingerValue.textContent = finger ? "YES" : "NO";
  setStatus(els.fingerStatus, els.cardFinger, finger ? "ok" : "",
    finger ? "DETECTED" : "ABSENT");
}

// ─────────────────────────────────────────
//  STATIC DEVICES — populate once, never poll
// ─────────────────────────────────────────
function initStaticDevices() {
  STATIC_DEVICES.forEach(dev => {
    applyGas(dev.id, dev.gas);
    applyBpm(dev.id, dev.bpm);
    applyMotion(dev.id, dev.motion === "1");
    applyFinger(dev.id, dev.finger === "1");
  });
}

// ─────────────────────────────────────────
//  ALERT BANNER UPDATE (Device 01 only)
// ─────────────────────────────────────────
function updateAlertBanner(isAlerting) {
  if (!dom.alertBanner) return;

  if (!isAlerting) {
    dom.alertBanner.className = "alert-banner ok";
    if (dom.alertIcon) dom.alertIcon.textContent = "◉";
    if (dom.alertText) dom.alertText.textContent = "ALL SYSTEMS OK";
  } else {
    dom.alertBanner.className = "alert-banner danger";
    if (dom.alertIcon) dom.alertIcon.textContent = "⚠";
    if (dom.alertText) dom.alertText.textContent = "ALERT — DEVICE 01 REQUIRES ATTENTION";
  }
}

// ─────────────────────────────────────────
//  ALERT MODAL
// ─────────────────────────────────────────
let lastShownAlertKey = null;

function showAlertModal(deviceName, reasons) {
  dom.modalDevice.textContent = deviceName;
  dom.modalTitle.textContent  = "Alert Triggered";
  dom.modalDesc.textContent   = reasons.join("\n\n");
  dom.modalOverlay.classList.add("visible");
}

function hideAlertModal() {
  dom.modalOverlay.classList.remove("visible");
}

dom.modalOkBtn.addEventListener("click", hideAlertModal);

function handleAlertCheck(deviceName, reasons) {
  if (reasons.length === 0) {
    lastShownAlertKey = null; // cleared — allow a future alert to pop again
    return;
  }
  const key = reasons.join("|");
  if (key !== lastShownAlertKey) {
    lastShownAlertKey = key;
    showAlertModal(deviceName, reasons);
  }
}

// ─────────────────────────────────────────
//  SINGLE PIN FETCH
// ─────────────────────────────────────────
async function fetchPin(pin) {
  const url = `${CONFIG.base}?token=${CONFIG.auth}&pin=${pin}`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${pin}`);
  return (await res.text()).trim();
}

// ─────────────────────────────────────────
//  FETCH ALL PINS IN PARALLEL
// ─────────────────────────────────────────
async function fetchAll() {
  const keys   = Object.keys(PINS);
  const values = await Promise.all(keys.map(k => fetchPin(PINS[k])));
  const result = {};
  keys.forEach((k, i) => result[k] = values[i]);
  return result;
}

// ─────────────────────────────────────────
//  MAIN UPDATE FUNCTION (Device 01 — live)
// ─────────────────────────────────────────
async function update() {
  try {
    const data = await fetchAll();
    const now  = new Date().toLocaleTimeString();

    setConnectionState("connected");
    dom.lastUpdated.textContent = now;

    // ── GAS ──
    const gasVal = parseInt(data.gas, 10);
    applyGas(1, gasVal);
    if (!isNaN(gasVal)) pushToChart(gasChart, now, gasVal);

    // ── BPM ──
    const bpmVal = parseFloat(data.bpm);
    applyBpm(1, bpmVal);
    if (!isNaN(bpmVal) && bpmVal > 0) pushToChart(bpmChart, now, bpmVal);

    // ── MOTION ──
    const moving = data.motion.trim() === "1";
    applyMotion(1, moving);

    // ── FINGER ──
    const finger = data.finger.trim() === "1";
    applyFinger(1, finger);

    // ── BUILD ALERT REASONS ──
    const reasons = [];
    if (!isNaN(gasVal) && gasVal > CONFIG.gasThresh) {
      reasons.push(`Gas / air-quality reading of ${gasVal} ADC has exceeded the safe threshold of ${CONFIG.gasThresh}.`);
    }
    if (!isNaN(bpmVal) && bpmVal > 0 && bpmVal < CONFIG.bpmLow) {
      reasons.push(`Heart rate has dropped to ${bpmVal.toFixed(0)} bpm, below the safe minimum of ${CONFIG.bpmLow} bpm.`);
    }
    // Fallback: firmware alert flag fired but no specific threshold matched locally
    if (reasons.length === 0 && data.alert && data.alert.trim() === "1") {
      reasons.push("The device's onboard alert flag has been triggered.");
    }

    const isAlerting = reasons.length > 0;
    updateAlertBanner(isAlerting);
    handleAlertCheck("Device 01 — Field Unit A", reasons);

    // NOTE: ax/ay/az block intentionally left as dashes —
    // firmware doesn't currently send accelerometer values over Blynk.

  } catch (err) {
    console.error("Fetch error:", err);
    if (err instanceof TypeError && err.message.includes("fetch")) {
      dom.lastUpdated.textContent = "CORS error — see console";
    } else {
      dom.lastUpdated.textContent = "fetch failed";
    }
    setConnectionState("error");
  }
}

// ─────────────────────────────────────────
//  DEVICE DETAIL TOGGLE
// ─────────────────────────────────────────
function bindDeviceSelection() {
  document.querySelectorAll(".device-panel").forEach(panel => {
    panel.addEventListener("click", () => {
      const id = parseInt(panel.id.replace("device-panel-", ""), 10);
      setSelectedDevice(id);
    });
  });
}

// ─────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────
initStaticDevices();
bindDeviceSelection();
hideSelectedDeviceDetail();
update();
setInterval(update, CONFIG.interval);