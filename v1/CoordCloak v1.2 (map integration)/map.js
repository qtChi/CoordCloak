let currentLat = 40.7128;
let currentLng = -74.0060;
let toastTimer;

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

document.getElementById('searchBtn').addEventListener('click', doSearch);
document.getElementById('searchInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') doSearch();
});

async function doSearch() {
  const query = document.getElementById('searchInput').value.trim();
  if (!query) return;
  const btn = document.getElementById('searchBtn');
  btn.textContent = '...';
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
    btn.textContent = 'Go';
  }
}

// Send coords back to popup via postMessage
document.getElementById('useBtn').addEventListener('click', () => {
  window.parent.postMessage({ type: 'COORD_UPDATE', lat: currentLat, lng: currentLng }, '*');
  showToast('Sent to CoordCloak ✓', false);
});

// Listen for pin move commands from popup (preset clicks etc)
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