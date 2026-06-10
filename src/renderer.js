// ---------------------------------------------------------------------------
// MCDU App Fenix A320 — renderer
// ---------------------------------------------------------------------------
// The Fenix native Web MCDU is served by the EFB web server on port 8083.
// The MCDU "app" lives inside the EFB shell at  http://<host>:8083/
// We embed that page in a <webview>. Captain (left) / First Officer (right)
// selection is done inside the Fenix MCDU interface itself.
// ---------------------------------------------------------------------------

const PORT = 8083;

const PATHS = {
  base:  '/',
  left:  '/',
  right: '/'
};

const state = {
  host: 'localhost',
  side: 'left',
  view: '1',
  loaded1: false,
  loaded2: false
};

const $ = (id) => document.getElementById(id);

// Safe wrapper: if running outside Electron (e.g. opened directly in a browser),
// window.fenix is undefined. We fall back gracefully instead of throwing.
const fenixApi = window.fenix || {
  check: async () => ({ ok: false, reason: 'no-bridge' }),
  localIps: async () => []
};

function show(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(screenId).classList.add('active');
}

function urlFor(side) {
  const path = side === 'right' ? PATHS.right : PATHS.left;
  return `http://${state.host}:${PORT}${path}`;
}

async function checkHost(host) {
  try {
    return await fenixApi.check(host);
  } catch (e) {
    return { ok: false, reason: 'error' };
  }
}

// ---------------------------------------------------------------------------
// SCREEN 1 — connection
// ---------------------------------------------------------------------------
const hostInput = $('host-input');
const statusDot = $('status-dot');
const statusText = $('status-text');
const connectBtn = $('connect-btn');
const autoPoll = $('auto-poll');

let pollTimer = null;
let online = false;

function setStatus(kind, text) {
  statusDot.className = 'dot ' + kind;
  statusText.textContent = text;
}

function currentHost() {
  return (hostInput.value || '').trim() || 'localhost';
}

function refreshProbeLabel() {
  $('probe-url').textContent = `http://${currentHost()}:${PORT}`;
}

function setConnectLabel() {
  // Always set a correct label, even before the first probe resolves.
  connectBtn.disabled = false;
  connectBtn.textContent = online ? 'Continue \u203a' : 'Connect anyway \u203a';
}

async function probe() {
  const host = currentHost();
  refreshProbeLabel();
  const res = await checkHost(host);
  online = !!res.ok;
  if (res.ok) {
    setStatus('ok', `Connected to MSFS — Fenix detected on ${host}:${PORT}`);
  } else if (res.reason === 'timeout') {
    setStatus('waiting', 'Waiting for Microsoft Flight Simulator\u2026');
  } else {
    setStatus('waiting', 'Waiting\u2026 (Fenix server unreachable)');
  }
  setConnectLabel();
}

function startPolling() {
  stopPolling();
  probe();
  if (autoPoll.checked) {
    pollTimer = setInterval(probe, 3000);
  }
}
function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

autoPoll.addEventListener('change', () => {
  if (autoPoll.checked) startPolling();
  else stopPolling();
});

hostInput.addEventListener('input', () => {
  online = false;
  refreshProbeLabel();
  setConnectLabel();
});
hostInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { state.host = currentHost(); proceedToSide(); }
});

$('use-localhost').addEventListener('click', () => {
  hostInput.value = 'localhost';
  refreshProbeLabel();
  probe();
});

connectBtn.addEventListener('click', () => {
  state.host = currentHost();
  proceedToSide();
});

function proceedToSide() {
  stopPolling();
  show('screen-side');
}

// Suggest local IPs.
fenixApi.localIps().then(ips => {
  const box = $('ip-hints');
  if (!box || !ips || !ips.length) return;
  box.innerHTML = '<span style="color:var(--muted);font-size:12px;">Local addresses: </span>';
  ips.forEach(ip => {
    const b = document.createElement('button');
    b.textContent = ip;
    b.onclick = () => { hostInput.value = ip; refreshProbeLabel(); probe(); };
    box.appendChild(b);
  });
}).catch(() => {});

// ---------------------------------------------------------------------------
// SCREEN 2 — side select
// ---------------------------------------------------------------------------
document.querySelectorAll('.side-card, .link-btn[data-side]').forEach(el => {
  el.addEventListener('click', () => {
    const side = el.dataset.side;
    state.side = side === 'right' ? 'right' : 'left';
    const initialView = side === 'both' ? 'both' : (side === 'right' ? '2' : '1');
    gateThenEnter(initialView);
  });
});

// ---------------------------------------------------------------------------
// CONNECTING GATE (screen between side-select and MCDU)
// ---------------------------------------------------------------------------
// When a side is chosen we go to a gate screen:
//   - if Fenix is OFF  -> red blinking dot + "Waiting for connection...", retry
//   - once reachable   -> green dot + "Connecte" for 2s, then show the MCDU
// ---------------------------------------------------------------------------
const gateScreen = $('screen-gate');
const gateDot = $('gate-dot');
const gateText = $('gate-text');
const gateDotL = $('gate-dot-l');
const gateTextL = $('gate-text-l');
const gateDotR = $('gate-dot-r');
const gateTextR = $('gate-text-r');
const gateViewSelect = $('gate-view-select');
let gateTimer = null;
let gateAbort = false;
let pendingView = '1';

function clearGate() {
  if (gateTimer) { clearInterval(gateTimer); gateTimer = null; }
}

function syncGateSelect(view) {
  gateViewSelect.value = view;
  Array.from(gateViewSelect.options).forEach(opt => {
    opt.disabled = (opt.value === view);
  });
}

function gateThenEnter(initialView) {
  pendingView = initialView;
  gateAbort = false;
  syncGateSelect(initialView);
  // Dual waiting layout (with center separator) when both MCDU were chosen.
  gateScreen.classList.toggle('mode-dual', initialView === 'both');
  show('screen-gate');
  setGateWaiting();
  runGateProbe();
  clearGate();
  gateTimer = setInterval(runGateProbe, 1500);
}

// Changing the dropdown while waiting restarts the gate in the new mode.
gateViewSelect.addEventListener('change', () => {
  gateThenEnter(gateViewSelect.value);
});

function setGateWaiting() {
  const txt = 'Waiting for connection\u2026';
  gateDot.className = 'dot fail gate-big-dot';
  gateText.textContent = txt;
  gateDotL.className = 'dot fail gate-big-dot';
  gateTextL.textContent = txt;
  gateDotR.className = 'dot fail gate-big-dot';
  gateTextR.textContent = txt;
}

async function runGateProbe() {
  if (gateAbort) return;
  const res = await checkHost(state.host);
  if (gateAbort) return;
  if (res.ok) {
    clearGate();
    onGateConnected();
  } else {
    setGateWaiting();
  }
}

function onGateConnected() {
  const txt = 'Connected';
  gateDot.className = 'dot ok gate-big-dot';
  gateText.textContent = txt;
  gateDotL.className = 'dot ok gate-big-dot';
  gateTextL.textContent = txt;
  gateDotR.className = 'dot ok gate-big-dot';
  gateTextR.textContent = txt;
  // Hold the "Connecte" confirmation for 2 seconds, then enter the MCDU.
  setTimeout(() => {
    if (gateAbort) return;
    enterMcdu(pendingView);
  }, 2000);
}

// ---------------------------------------------------------------------------
// SCREEN 4 — MCDU view
// ---------------------------------------------------------------------------
const wv1 = $('wv1');
const wv2 = $('wv2');
const stage = $('mcdu-stage');
const viewSelect = $('view-select');

function loadWebview(wv, side, flag) {
  if (state[flag]) return;
  wv.src = urlFor(side);
  state[flag] = true;
}

function syncViewSelect(view) {
  // Reflect current value and grey out (disable) the option we're already on.
  viewSelect.value = view;
  Array.from(viewSelect.options).forEach(opt => {
    opt.disabled = (opt.value === view);
  });
}

function applyView(view) {
  state.view = view;
  syncViewSelect(view);

  stage.classList.remove('single', 'dual', 'show-2');

  if (view === 'both') {
    stage.classList.add('dual');
    loadWebview(wv1, 'left', 'loaded1');
    loadWebview(wv2, 'right', 'loaded2');
  } else if (view === '2') {
    stage.classList.add('single', 'show-2');
    loadWebview(wv2, 'right', 'loaded2');
  } else {
    stage.classList.add('single');
    loadWebview(wv1, 'left', 'loaded1');
  }
}

function enterMcdu(initialView) {
  show('screen-mcdu');
  applyView(initialView);
}

viewSelect.addEventListener('change', () => applyView(viewSelect.value));

$('reload-btn').addEventListener('click', () => {
  if (state.view === 'both' || state.view === '1') { try { wv1.reload(); } catch(e){} }
  if (state.view === 'both' || state.view === '2') { try { wv2.reload(); } catch(e){} }
});

// ---------------------------------------------------------------------------
// Back navigation (works from every screen)
// ---------------------------------------------------------------------------
document.querySelectorAll('[data-goto]').forEach(b => {
  b.addEventListener('click', () => {
    const target = b.dataset.goto;
    gateAbort = true;       // leaving the gate stops its probing loop
    clearGate();
    if (target === 'screen-connect') startPolling();
    show(target);
  });
});

// ---------------------------------------------------------------------------
// boot
// ---------------------------------------------------------------------------
setConnectLabel();
refreshProbeLabel();
startPolling();
