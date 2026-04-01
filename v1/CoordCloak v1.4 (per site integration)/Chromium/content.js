// CoordCloak - Content Script (Chrome)

function buildInjectedScript(lat, lng, accuracy) {
  return `
(function() {
  const _mockCoords = {
    latitude:         ${lat},
    longitude:        ${lng},
    accuracy:         ${accuracy},
    altitude:         null,
    altitudeAccuracy: null,
    heading:          null,
    speed:            null
  };

  const _mockPosition = {
    get coords()    { return _mockCoords; },
    get timestamp() { return Date.now();  }
  };

  const _mockGeolocation = {
    getCurrentPosition(success, error, options) {
      setTimeout(() => success(_mockPosition), 50);
    },
    watchPosition(success, error, options) {
      success(_mockPosition);
      return 1;
    },
    clearWatch(id) {}
  };

  try {
    Object.defineProperty(navigator, 'geolocation', {
      value:        _mockGeolocation,
      configurable: true,
      writable:     false
    });
    console.info('[CoordCloak] Geolocation spoofed → ${lat}, ${lng}');
  } catch(e) {
    console.warn('[CoordCloak] Could not override geolocation:', e);
  }
})();
  `;
}

function injectOverride(lat, lng, accuracy) {
  const script = document.createElement('script');
  script.textContent = buildInjectedScript(lat, lng, accuracy);
  (document.documentElement || document.head || document.body).appendChild(script);
  script.remove();
}

browser.storage.local.get(['spoofEnabled', 'lat', 'lng', 'accuracy']).then(data => {
  if (data.spoofEnabled && data.lat !== undefined && data.lng !== undefined) {
    injectOverride(
      parseFloat(data.lat),
      parseFloat(data.lng),
      parseFloat(data.accuracy) || 10
    );
  }
});

browser.runtime.onMessage.addListener((message) => {
  if (message.type === 'GEO_UPDATE' && message.enabled) {
    injectOverride(message.lat, message.lng, message.accuracy || 10);
  }
});