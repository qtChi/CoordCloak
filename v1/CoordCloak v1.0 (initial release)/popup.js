// CoordCloak — Popup Script

const toggleEl  = document.getElementById('toggleSpoof');
const latInput  = document.getElementById('latInput');
const lngInput  = document.getElementById('lngInput');
const accInput  = document.getElementById('accInput');
const applyBtn  = document.getElementById('applyBtn');
const statusDot = document.getElementById('statusDot');
const statusTxt = document.getElementById('statusText');
const toast     = document.getElementById('toast');
const presets   = Array.from(document.querySelectorAll('.preset-btn'));

// ── Load saved state ──────────────────────────────────────────────────────────
browser.storage.local.get(['spoofEnabled', 'lat', 'lng', 'accuracy']).then(data => {
  const enabled = !!data.spoofEnabled;
  toggleEl.checked = enabled;
  if (data.lat      !== undefined) latInput.value = data.lat;
  if (data.lng      !== undefined) lngInput.value = data.lng;
  if (data.accuracy !== undefined) accInput.value = data.accuracy;
  updateUI(enabled);
});

// ── Toggle ────────────────────────────────────────────────────────────────────
toggleEl.addEventListener('change', () => {
  const enabled = toggleEl.checked;
  updateUI(enabled);
  browser.storage.local.set({ spoofEnabled: enabled });

  if (!enabled) {
    browser.runtime.sendMessage({ type: 'BROADCAST_GEO', enabled: false });
    showToast('Spoofing disabled — real location restored on next reload', false);
  } else if (latInput.value && lngInput.value) {
    broadcastAndSave();
  }
});

// ── Apply button (auto-enables toggle) ───────────────────────────────────────
applyBtn.addEventListener('click', () => {
  const lat = parseFloat(latInput.value);
  const lng = parseFloat(lngInput.value);
  const acc = parseFloat(accInput.value) || 10;

  if (isNaN(lat) || lat < -90  || lat > 90)  { showToast('Latitude must be between -90 and 90', true);    return; }
  if (isNaN(lng) || lng < -180 || lng > 180) { showToast('Longitude must be between -180 and 180', true); return; }

  if (!toggleEl.checked) {
    toggleEl.checked = true;
    browser.storage.local.set({ spoofEnabled: true });
  }
  broadcastAndSave(lat, lng, acc);
});

// ── Preset buttons (always clickable, auto-enable toggle) ─────────────────────
presets.forEach(btn => {
  btn.addEventListener('click', () => {
    const lat = parseFloat(btn.dataset.lat);
    const lng = parseFloat(btn.dataset.lng);
    const acc = parseFloat(accInput.value) || 10;

    latInput.value = lat;
    lngInput.value = lng;
    dmsInput.value = '';
    dmsStatus.textContent = 'DMS';
    dmsStatus.className = 'dms-status idle';

    if (!toggleEl.checked) {
      toggleEl.checked = true;
      browser.storage.local.set({ spoofEnabled: true });
    }
    updateUI(true);
    broadcastAndSave(lat, lng, acc);
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function broadcastAndSave(lat, lng, acc) {
  lat = (lat !== undefined) ? lat : parseFloat(latInput.value);
  lng = (lng !== undefined) ? lng : parseFloat(lngInput.value);
  acc = (acc !== undefined) ? acc : (parseFloat(accInput.value) || 10);

  browser.storage.local.set({ lat, lng, accuracy: acc, spoofEnabled: true });
  browser.runtime.sendMessage({ type: 'BROADCAST_GEO', enabled: true, lat, lng, accuracy: acc });

  updateStatus(true, lat, lng);
  showToast('Spoofing to ' + lat.toFixed(4) + ', ' + lng.toFixed(4) + ' — reload open tabs to apply', false);
}

function updateUI(enabled) {
  // Only dim coordinate inputs — never block buttons so presets always work
  latInput.disabled = !enabled;
  lngInput.disabled = !enabled;
  accInput.disabled = !enabled;
  dmsInput.disabled = !enabled;
  updateStatus(enabled, parseFloat(latInput.value), parseFloat(lngInput.value));
}

function updateStatus(enabled, lat, lng) {
  if (!enabled) {
    statusDot.className = 'dot inactive';
    statusTxt.textContent = 'Spoofing disabled — using real location';
  } else if (!isNaN(lat) && !isNaN(lng)) {
    statusDot.className = 'dot active';
    statusTxt.textContent = 'Active: ' + lat.toFixed(4) + ', ' + lng.toFixed(4);
  } else {
    statusDot.className = 'dot';
    statusTxt.textContent = 'Enabled — enter coordinates and apply';
  }
}

let toastTimer;
function showToast(msg, isError) {
  toast.textContent = (isError ? '⚠️ ' : '✓ ') + msg;
  toast.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.className = 'toast'; }, 3500);
}

// ── DMS auto-converter ────────────────────────────────────────────────────────
const dmsInput  = document.getElementById('dmsInput');
const dmsStatus = document.getElementById('dmsStatus');

function parseDMS(str) {
  // Normalise fancy unicode degree/quote chars
  str = str.replace(/[°˚]/g, 'd')
           .replace(/[′']/g, 'm')
           .replace(/[″"]/g, 's')
           .trim();

  // Match two DMS components: deg d min m [sec s] [NSEW]
  const pattern = /(\d+(?:\.\d+)?)d\s*(\d+(?:\.\d+)?)m(?:\s*(\d+(?:\.\d+)?)s)?\s*([NSns])[,\s]+(\d+(?:\.\d+)?)d\s*(\d+(?:\.\d+)?)m(?:\s*(\d+(?:\.\d+)?)s)?\s*([EWew])/;
  const m = str.match(pattern);
  if (!m) return null;

  const toDecimal = (d, min, sec, dir) => {
    const val = parseFloat(d) + parseFloat(min) / 60 + (sec ? parseFloat(sec) / 3600 : 0);
    return (dir.toUpperCase() === 'S' || dir.toUpperCase() === 'W') ? -val : val;
  };

  const lat = toDecimal(m[1], m[2], m[3], m[4]);
  const lng = toDecimal(m[5], m[6], m[7], m[8]);

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

dmsInput.addEventListener('input', () => {
  const raw = dmsInput.value.trim();
  if (!raw) {
    dmsStatus.textContent = 'DMS';
    dmsStatus.className = 'dms-status idle';
    return;
  }

  const result = parseDMS(raw);
  if (result) {
    latInput.value = result.lat.toFixed(6);
    lngInput.value = result.lng.toFixed(6);
    dmsStatus.textContent = '✓';
    dmsStatus.className = 'dms-status ok';
  } else {
    dmsStatus.textContent = '✗';
    dmsStatus.className = 'dms-status err';
  }
});
