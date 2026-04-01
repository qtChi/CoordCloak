// CoordCloak — Firefox Background Script

browser.runtime.onMessage.addListener((message, sender) => {
  if (message.type === 'BROADCAST_GEO') {
    browser.tabs.query({}).then(tabs => {
      for (const tab of tabs) {
        if (tab.id && tab.url &&
            !tab.url.startsWith('about:') &&
            !tab.url.startsWith('moz-extension:')) {
          browser.tabs.sendMessage(tab.id, {
            type:     'GEO_UPDATE',
            enabled:  message.enabled,
            lat:      message.lat,
            lng:      message.lng,
            accuracy: message.accuracy
          }).catch(() => {});
        }
      }
    });
  }

  if (message.type === 'UPDATE_BADGE') {
    updateBadge(message.enabled);
  }
});

// Restore badge on browser startup
browser.storage.local.get(['spoofEnabled']).then(data => {
  updateBadge(!!data.spoofEnabled);
});

function updateBadge(enabled) {
  if (enabled) {
    browser.browserAction.setBadgeText({ text: ' ' });
    browser.browserAction.setBadgeBackgroundColor({ color: '#22c55e' });
  } else {
    browser.browserAction.setBadgeText({ text: '' });
  }
}

// ── Per-site auto-apply ───────────────────────────────────────────────────────
function getHostname(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch(e) { return null; }
}

function checkAndApplySiteProfile(tabId, url) {
  if (!url || url.startsWith('about:') || url.startsWith('moz-extension:')) return;
  const hostname = getHostname(url);
  if (!hostname) return;

  browser.storage.local.get(['profiles']).then(data => {
    const profiles = data.profiles || [];
    const match = profiles.find(p =>
      p.sites && p.sites.some(s => hostname === s || hostname.endsWith('.' + s))
    );
    if (!match) return;

    browser.storage.local.set({
      lat:        match.lat,
      lng:        match.lng,
      accuracy:   match.acc || 10,
      spoofEnabled: true
    });

    browser.tabs.sendMessage(tabId, {
      type:     'GEO_UPDATE',
      enabled:  true,
      lat:      match.lat,
      lng:      match.lng,
      accuracy: match.acc || 10
    }).catch(() => {});

    updateBadge(true);
  });
}

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    checkAndApplySiteProfile(tabId, tab.url);
  }
});

browser.tabs.onActivated.addListener(({ tabId }) => {
  browser.tabs.get(tabId).then(tab => {
    if (tab.url) checkAndApplySiteProfile(tabId, tab.url);
  }).catch(() => {});
});