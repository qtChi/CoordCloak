// CoordCloak — Chrome Background Service Worker
importScripts('browser-polyfill.min.js');

browser.runtime.onMessage.addListener((message, sender) => {
  if (message.type === 'BROADCAST_GEO') {
    browser.tabs.query({}).then(tabs => {
      for (const tab of tabs) {
        if (tab.id && tab.url &&
            !tab.url.startsWith('chrome://') &&
            !tab.url.startsWith('chrome-extension://') &&
            !tab.url.startsWith('about:')) {
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
});