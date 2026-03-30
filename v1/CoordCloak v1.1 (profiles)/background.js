// CoordCloak - Background Script
// Listens for settings changes and broadcasts to all open tabs.

browser.runtime.onMessage.addListener((message, sender) => {
  if (message.type === 'BROADCAST_GEO') {
    browser.tabs.query({}).then(tabs => {
      for (const tab of tabs) {
        if (tab.id && tab.url && !tab.url.startsWith('about:') && !tab.url.startsWith('moz-extension:')) {
          browser.tabs.sendMessage(tab.id, {
            type:     'GEO_UPDATE',
            enabled:  message.enabled,
            lat:      message.lat,
            lng:      message.lng,
            accuracy: message.accuracy
          }).catch(() => {
            // Tab may not have content script — that's fine
          });
        }
      }
    });
  }
});
