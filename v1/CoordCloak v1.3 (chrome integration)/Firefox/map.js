let currentLat = 40.7128;
let currentLng = -74.0060;
let toastTimer;
let debounceTimer;

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl:       'icons/marker-icon.png',
  shadowUrl:     'icons/marker-shadow.png',
  iconRetinaUrl: 'icons/marker-icon.png',
});

const map = L.map('map', { zoomControl: true }).setView([currentLat, currentLng], 4);

L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
  maxZoom: 19
}).addTo(map);

L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19,
  opacity: 0.8
}).addTo(map);

const marker = L.marker([currentLat, currentLng], { draggable: true }).addTo(map);
updateCoordDisplay(currentLat, currentLng);

// Load last known coords
browser.storage.local.get(['lat', 'lng']).then(data => {
  if (data.lat !== undefined && data.lng !== undefined) {
    const lat = parseFloat(data.lat);
    const lng = parseFloat(data.lng);
    if (!isNaN(lat) && !isNaN(lng)) {
      currentLat = lat;
      currentLng = lng;
      marker.setLatLng([lat, lng]);
      map.setView([lat, lng], 12);
      updateCoordDisplay(lat, lng);
    }
  }
});

marker.on('dragend', () => {
  const pos = marker.getLatLng();
  currentLat = pos.lat;
  currentLng = pos.lng;
  updateCoordDisplay(currentLat, currentLng);
});

map.on('click', e => {
  currentLat = e.latlng.lat;
  currentLng = e.latlng.lng;
  marker.setLatLng([currentLat, currentLng]);
  updateCoordDisplay(currentLat, currentLng);
});

// ── Search & autocomplete ─────────────────────────────────────────────────────
const searchInput   = document.getElementById('searchInput');
const searchBtn     = document.getElementById('searchBtn');
const suggestionsEl = document.getElementById('suggestions');

searchBtn.addEventListener('click', () => doSearch(searchInput.value.trim()));

searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    closeSuggestions();
    doSearch(searchInput.value.trim());
  }
  if (e.key === 'Escape') closeSuggestions();
});

// Debounced autocomplete as user types
searchInput.addEventListener('input', () => {
  const query = searchInput.value.trim();
  clearTimeout(debounceTimer);
  if (query.length < 3) { closeSuggestions(); return; }
  debounceTimer = setTimeout(() => fetchSuggestions(query), 350);
});

// Close suggestions when clicking outside
document.addEventListener('click', e => {
  if (!e.target.closest('.search-wrap')) closeSuggestions();
});

async function fetchSuggestions(query) {
  try {
    const res = await fetch(
      'https://nominatim.openstreetmap.org/search?format=json&limit=5&q=' + encodeURIComponent(query),
      { headers: { 'Accept-Language': 'en' } }
    );
    const results = await res.json();
    if (!results.length) { closeSuggestions(); return; }
    renderSuggestions(results);
  } catch(e) {
    closeSuggestions();
  }
}

function renderSuggestions(results) {
  suggestionsEl.innerHTML = '';
  results.forEach(r => {
    const item = document.createElement('div');
    item.className = 'suggestion-item';

    // Split display name into primary (first part) and detail (rest)
    const parts = r.display_name.split(',');
    const primary = parts[0].trim();
    const detail  = parts.slice(1, 3).join(',').trim();

    item.innerHTML = `
      <div class="place-name">${primary}</div>
      <div class="place-detail">${detail}</div>
    `;

    item.addEventListener('click', () => {
      const lat = parseFloat(r.lat);
      const lng = parseFloat(r.lon);
      currentLat = lat;
      currentLng = lng;
      marker.setLatLng([lat, lng]);
      map.setView([lat, lng], 14);
      updateCoordDisplay(lat, lng);
      searchInput.value = r.display_name.split(',').slice(0, 2).join(',').trim();
      closeSuggestions();
      // Auto-send to CoordCloak popup
      window.parent.postMessage({ type: 'COORD_UPDATE', lat, lng }, '*');
      showToast('Sent to CoordCloak ✓', false);
    });

    suggestionsEl.appendChild(item);
  });
  suggestionsEl.classList.add('open');
}

function closeSuggestions() {
  suggestionsEl.classList.remove('open');
  suggestionsEl.innerHTML = '';
}

async function doSearch(query) {
  if (!query) return;
  searchBtn.textContent = '...';
  try {
    const res = await fetch(
      'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(query),
      { headers: { 'Accept-Language': 'en' } }
    );
    const results = await res.json();
    if (!results.length) { showToast('No results found', true); return; }
    const { lat, lon, display_name } = results[0];
    currentLat = parseFloat(lat);
    currentLng = parseFloat(lon);
    marker.setLatLng([currentLat, currentLng]);
    map.setView([currentLat, currentLng], 14);
    updateCoordDisplay(currentLat, currentLng);
    showToast('Found: ' + display_name.split(',').slice(0, 2).join(','), false);
  } catch(e) {
    showToast('Search failed — check your connection', true);
  } finally {
    searchBtn.textContent = 'Go';
  }
}

// ── Send coords to popup ──────────────────────────────────────────────────────
document.getElementById('useBtn').addEventListener('click', () => {
  window.parent.postMessage({ type: 'COORD_UPDATE', lat: currentLat, lng: currentLng }, '*');
  showToast('Sent to CoordCloak ✓', false);
});

// Listen for pin move commands from popup
window.addEventListener('message', e => {
  if (e.data && e.data.type === 'MOVE_PIN') {
    const lat = parseFloat(e.data.lat);
    const lng = parseFloat(e.data.lng);
    if (!isNaN(lat) && !isNaN(lng)) {
      currentLat = lat;
      currentLng = lng;
      marker.setLatLng([lat, lng]);
      map.setView([lat, lng], 12);
      updateCoordDisplay(lat, lng);
    }
  }
});

function updateCoordDisplay(lat, lng) {
  document.getElementById('coordDisplay').textContent =
    lat.toFixed(6) + ', ' + lng.toFixed(6);
}

function showToast(msg, isError) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast'; }, 3000);
}