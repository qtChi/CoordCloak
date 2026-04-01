// CoordCloak — Popup Script

const toggleEl     = document.getElementById('toggleSpoof');
const latInput     = document.getElementById('latInput');
const lngInput     = document.getElementById('lngInput');
const accInput     = document.getElementById('accInput');
const applyBtn     = document.getElementById('applyBtn');
const applyOnceBtn = document.getElementById('applyOnceBtn');
const statusDot    = document.getElementById('statusDot');
const statusTxt    = document.getElementById('statusText');
const toast        = document.getElementById('toast');
const dmsInput     = document.getElementById('dmsInput');
const dmsStatus    = document.getElementById('dmsStatus');
const savedList    = document.getElementById('savedList');
const savedCount   = document.getElementById('savedCount');
const presets      = Array.from(document.querySelectorAll('.preset-btn'));
const mapPanel     = document.getElementById('mapPanel');
const mapIframe    = document.getElementById('mapIframe');
const openMapBtn   = document.getElementById('openMapBtn');

const PROFILE_COLORS = [
  '#6366f1','#8b5cf6','#ec4899','#ef4444',
  '#f97316','#eab308','#22c55e','#06b6d4',
  '#3b82f6','#64748b'
];
const MAX_SAVED = 20;

// ── Tab switching ─────────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
    if (tab.dataset.tab === 'saved') renderSaved();
  });
});

// ── Load saved state ──────────────────────────────────────────────────────────
browser.storage.local.get(['spoofEnabled','lat','lng','accuracy','profiles']).then(data => {
  const enabled = !!data.spoofEnabled;
  toggleEl.checked = enabled;
  if (data.lat      !== undefined) latInput.value = data.lat;
  if (data.lng      !== undefined) lngInput.value = data.lng;
  if (data.accuracy !== undefined) accInput.value = data.accuracy;
  updateUI(enabled);
  updateSavedCount(data.profiles || []);
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

// ── Save & Apply ──────────────────────────────────────────────────────────────
applyBtn.addEventListener('click', () => {
  const lat = parseFloat(latInput.value);
  const lng = parseFloat(lngInput.value);
  const acc = parseFloat(accInput.value) || 10;
  if (isNaN(lat) || lat < -90  || lat > 90)  { showToast('Latitude must be between -90 and 90', true);    return; }
  if (isNaN(lng) || lng < -180 || lng > 180) { showToast('Longitude must be between -180 and 180', true); return; }
  if (!toggleEl.checked) { toggleEl.checked = true; browser.storage.local.set({ spoofEnabled: true }); }
  broadcastAndSave(lat, lng, acc);
  saveProfile(lat, lng, acc);
});

// ── Apply once ────────────────────────────────────────────────────────────────
applyOnceBtn.addEventListener('click', () => {
  const lat = parseFloat(latInput.value);
  const lng = parseFloat(lngInput.value);
  const acc = parseFloat(accInput.value) || 10;
  if (isNaN(lat) || lat < -90  || lat > 90)  { showToast('Latitude must be between -90 and 90', true);    return; }
  if (isNaN(lng) || lng < -180 || lng > 180) { showToast('Longitude must be between -180 and 180', true); return; }
  if (!toggleEl.checked) { toggleEl.checked = true; browser.storage.local.set({ spoofEnabled: true }); }
  broadcastAndSave(lat, lng, acc);
  showToast('Applied — reload tabs to take effect', false);
});

// ── Preset buttons ────────────────────────────────────────────────────────────
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
    if (!toggleEl.checked) { toggleEl.checked = true; browser.storage.local.set({ spoofEnabled: true }); }
    updateUI(true);
    broadcastAndSave(lat, lng, acc);
    // If map is open, tell it to move the pin
    if (mapPanel.classList.contains('open')) {
      mapIframe.contentWindow.postMessage({ type: 'MOVE_PIN', lat, lng }, '*');
    }
  });
});

// ── Map panel toggle ──────────────────────────────────────────────────────────
openMapBtn.addEventListener('click', () => {
  const isOpen = mapPanel.classList.contains('open');
  if (isOpen) {
    closeMap();
  } else {
    openMap();
  }
});

document.getElementById('closeMapBtn').addEventListener('click', closeMap);

document.getElementById('expandMapBtn').addEventListener('click', () => {
  browser.windows.create({
    url:    browser.runtime.getURL('map.html'),
    type:   'popup',
    width:  800,
    height: 600
  });
});

function openMap() {
  mapPanel.classList.add('open');
  document.body.classList.add('map-open');
  document.body.style.width = '720px';
  openMapBtn.classList.add('active');

  mapIframe.src = 'map.html';
  mapIframe.onload = () => {
    const lat = parseFloat(latInput.value);
    const lng = parseFloat(lngInput.value);
    if (!isNaN(lat) && !isNaN(lng)) {
      mapIframe.contentWindow.postMessage({ type: 'MOVE_PIN', lat, lng }, '*');
    }
  };
}

function closeMap() {
  mapIframe.src = 'about:blank';
  mapPanel.classList.remove('open');
  document.body.classList.remove('map-open');
  document.body.style.width = '310px';
  openMapBtn.classList.remove('active');
}

// ── Receive coords from map iframe ────────────────────────────────────────────
window.addEventListener('message', e => {
  if (e.data && e.data.type === 'COORD_UPDATE') {
    const lat = parseFloat(e.data.lat);
    const lng = parseFloat(e.data.lng);
    if (isNaN(lat) || isNaN(lng)) return;
    latInput.value = lat.toFixed(6);
    lngInput.value = lng.toFixed(6);
    dmsInput.value = '';
    dmsStatus.textContent = 'DMS';
    dmsStatus.className = 'dms-status idle';
    updateStatus(toggleEl.checked, lat, lng);
    showToast('Coordinates updated from map', false);
  }
});

// ── DMS converter ─────────────────────────────────────────────────────────────
function parseDMS(str) {
  str = str.replace(/[°˚]/g,'d').replace(/[′']/g,'m').replace(/[″"]/g,'s').trim();
  const pat = /(\d+(?:\.\d+)?)d\s*(\d+(?:\.\d+)?)m(?:\s*(\d+(?:\.\d+)?)s)?\s*([NSns])[,\s]+(\d+(?:\.\d+)?)d\s*(\d+(?:\.\d+)?)m(?:\s*(\d+(?:\.\d+)?)s)?\s*([EWew])/;
  const m = str.match(pat);
  if (!m) return null;
  const toDec = (d, min, sec, dir) => {
    const v = parseFloat(d) + parseFloat(min)/60 + (sec ? parseFloat(sec)/3600 : 0);
    return (dir.toUpperCase()==='S' || dir.toUpperCase()==='W') ? -v : v;
  };
  const lat = toDec(m[1],m[2],m[3],m[4]);
  const lng = toDec(m[5],m[6],m[7],m[8]);
  if (lat<-90||lat>90||lng<-180||lng>180) return null;
  return { lat, lng };
}

dmsInput.addEventListener('input', () => {
  const raw = dmsInput.value.trim();
  if (!raw) { dmsStatus.textContent='DMS'; dmsStatus.className='dms-status idle'; return; }
  const r = parseDMS(raw);
  if (r) {
    latInput.value = r.lat.toFixed(6);
    lngInput.value = r.lng.toFixed(6);
    dmsStatus.textContent = '✓';
    dmsStatus.className = 'dms-status ok';
  } else {
    dmsStatus.textContent = '✗';
    dmsStatus.className = 'dms-status err';
  }
});

// ── Profiles — save ───────────────────────────────────────────────────────────
function saveProfile(lat, lng, acc) {
  browser.storage.local.get(['profiles']).then(data => {
    let profiles = data.profiles || [];
    const exists = profiles.some(p =>
      Math.abs(p.lat - lat) < 0.0001 && Math.abs(p.lng - lng) < 0.0001
    );
    if (exists) { showToast('This location is already saved', false); return; }
    const now = new Date();
    const label = now.toLocaleDateString('en-US', { month:'short', day:'numeric' })
                + ' ' + now.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' });
    profiles.unshift({
      id:    Date.now(),
      name:  label,
      lat, lng,
      acc:   acc || 10,
      color: PROFILE_COLORS[profiles.length % PROFILE_COLORS.length]
    });
    if (profiles.length > MAX_SAVED) profiles = profiles.slice(0, MAX_SAVED);
    browser.storage.local.set({ profiles });
    updateSavedCount(profiles);
    showToast('Saved & applied — reload tabs to take effect', false);
  });
}

// ── Profiles — render ─────────────────────────────────────────────────────────
function renderSaved() {
  browser.storage.local.get(['profiles']).then(data => {
    const profiles = data.profiles || [];
    savedList.innerHTML = '';
    if (profiles.length === 0) {
      savedList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📌</div>
          <div>No saved locations yet.<br>Hit "Save & Apply" to save one here.</div>
        </div>`;
      return;
    }
    profiles.forEach(profile => savedList.appendChild(buildCard(profile)));
  });
}

function buildCard(profile) {
  const card = document.createElement('div');
  card.className = 'profile-card';

  const colorWrap = document.createElement('div');
  colorWrap.className = 'color-picker-wrap';

  const dot = document.createElement('div');
  dot.className = 'profile-color';
  dot.style.background = profile.color;
  dot.title = 'Change color';

  const popover = document.createElement('div');
  popover.className = 'color-popover';
  PROFILE_COLORS.forEach(hex => {
    const swatch = document.createElement('div');
    swatch.className = 'color-swatch';
    swatch.style.background = hex;
    if (hex === profile.color) swatch.style.borderColor = '#fff';
    swatch.addEventListener('click', e => {
      e.stopPropagation();
      // Update storage
      updateProfileField(profile.id, 'color', hex);
      // Update dot color directly in DOM — no re-render needed
      dot.style.background = hex;
      // Update swatch borders to show new selection
      popover.querySelectorAll('.color-swatch').forEach(s => {
        s.style.borderColor = s.style.background === hex ? '#fff' : 'transparent';
      });
      // Close popover
      popover.classList.remove('open');
      // Update profile object so rename still works correctly
      profile.color = hex;
    });
    popover.appendChild(swatch);
  });

  dot.addEventListener('click', e => {
    e.stopPropagation();
    document.querySelectorAll('.color-popover').forEach(p => p.classList.remove('open'));
    popover.classList.toggle('open');
  });

  colorWrap.appendChild(dot);
  colorWrap.appendChild(popover);

  const info = document.createElement('div');
  info.className = 'profile-info';

  const nameEl = document.createElement('div');
  nameEl.className = 'profile-name';
  nameEl.textContent = profile.name;
  nameEl.title = 'Click to rename';
  nameEl.addEventListener('click', () => startRename(profile, nameEl));

  const coordEl = document.createElement('div');
  coordEl.className = 'profile-coords';
  coordEl.textContent = profile.lat.toFixed(4) + ', ' + profile.lng.toFixed(4);

  info.appendChild(nameEl);
  info.appendChild(coordEl);

  const actions = document.createElement('div');
  actions.className = 'profile-actions';

  const applyB = document.createElement('button');
  applyB.className = 'icon-btn';
  applyB.title = 'Apply this location';
  applyB.textContent = '▶';
  applyB.addEventListener('click', () => {
    latInput.value = profile.lat;
    lngInput.value = profile.lng;
    accInput.value = profile.acc || 10;
    dmsInput.value = '';
    dmsStatus.textContent = 'DMS';
    dmsStatus.className = 'dms-status idle';
    if (!toggleEl.checked) { toggleEl.checked = true; browser.storage.local.set({ spoofEnabled: true }); }
    updateUI(true);
    broadcastAndSave(profile.lat, profile.lng, profile.acc || 10);
    if (mapPanel.classList.contains('open')) {
      mapIframe.contentWindow.postMessage({ type: 'MOVE_PIN', lat: profile.lat, lng: profile.lng }, '*');
    }
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.querySelector('[data-tab="spoof"]').classList.add('active');
    document.getElementById('panel-spoof').classList.add('active');
    showToast('Applied: ' + profile.name, false);
  });

  const delB = document.createElement('button');
  delB.className = 'icon-btn danger';
  delB.title = 'Delete';
  delB.textContent = '✕';
  delB.addEventListener('click', () => deleteProfile(profile.id));

  actions.appendChild(applyB);
  actions.appendChild(delB);

  card.appendChild(colorWrap);
  card.appendChild(info);
  card.appendChild(actions);
  return card;
}

function startRename(profile, nameEl) {
  const input = document.createElement('input');
  input.className = 'profile-name-input';
  input.value = profile.name;
  nameEl.replaceWith(input);
  input.focus();
  input.select();
  const commit = () => {
    const newName = input.value.trim() || profile.name;
    updateProfileField(profile.id, 'name', newName);
    const updated = document.createElement('div');
    updated.className = 'profile-name';
    updated.textContent = newName;
    updated.title = 'Click to rename';
    updated.addEventListener('click', () => startRename({ ...profile, name: newName }, updated));
    input.replaceWith(updated);
  };
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { input.value = profile.name; input.blur(); }
  });
}

// ── Profile helpers ───────────────────────────────────────────────────────────
function updateProfileField(id, field, value) {
  browser.storage.local.get(['profiles']).then(data => {
    const profiles = (data.profiles || []).map(p =>
      p.id === id ? { ...p, [field]: value } : p
    );
    browser.storage.local.set({ profiles });
  });
}

function deleteProfile(id) {
  browser.storage.local.get(['profiles']).then(data => {
    const profiles = (data.profiles || []).filter(p => p.id !== id);
    browser.storage.local.set({ profiles });
    updateSavedCount(profiles);
    renderSaved();
  });
}

function updateSavedCount(profiles) {
  savedCount.textContent = profiles.length > 0 ? '(' + profiles.length + ')' : '';
}

// ── Shared helpers ────────────────────────────────────────────────────────────
function broadcastAndSave(lat, lng, acc) {
  lat = (lat !== undefined) ? lat : parseFloat(latInput.value);
  lng = (lng !== undefined) ? lng : parseFloat(lngInput.value);
  acc = (acc !== undefined) ? acc : (parseFloat(accInput.value) || 10);
  browser.storage.local.set({ lat, lng, accuracy: acc, spoofEnabled: true });
  browser.runtime.sendMessage({ type: 'BROADCAST_GEO', enabled: true, lat, lng, accuracy: acc });
  updateStatus(true, lat, lng);
}

function updateUI(enabled) {
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

document.addEventListener('click', () => {
  document.querySelectorAll('.color-popover').forEach(p => p.classList.remove('open'));
});