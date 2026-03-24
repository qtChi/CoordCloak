# CoordCloak 📍

> Spoof your browser's location to anywhere in the world — in seconds.

CoordCloak is a Firefox extension that overrides your browser's geolocation with any coordinates you choose. Enter them manually, paste a DMS string and watch it auto-convert, or pick from a preset city. Flip a toggle and any site asking "where are you?" gets your answer — not the real one.

**No data collected. No accounts. No internet required. Fully open source.**
---

## How to use

1. Click the **CoordCloak** icon in your Firefox toolbar
2. Enter your coordinates one of three ways:
   - **Paste a DMS string** like `40°34'27.07"N 105°04'57.99"W` — it converts automatically
   - **Type decimal lat/lng** directly into the coordinate fields
   - **Click a city preset** — New York, London, Tokyo, and more
3. Hit **Apply Fake Location**
4. Reload the tab — that site now sees your fake position

To turn it off, flip the toggle and reload.

---

## Features

- 🌍 Spoof to any coordinate on earth
- 📐 DMS auto-converter — paste and go
- 🏙️ 8 city presets for quick switching
- 💾 Settings saved between browser sessions
- 📡 Broadcasts to all open tabs at once
- 🔒 Zero data collection — everything stays local

---

## How it works

At page load, CoordCloak injects a small script that replaces the browser's built-in `navigator.geolocation` object with a fake one that returns your chosen coordinates. Any site calling `getCurrentPosition()` or `watchPosition()` gets your fake location instead.

> **Heads up:** This only overrides the JavaScript Geolocation API. It does not mask your IP address. For full anonymity, pair with a VPN.

---

## Supported DMS formats

```
40°34'27.07"N 105°04'57.99"W
40° 34′ 27.07″ N, 105° 04′ 57.99″ W
40d34m27.07sN 105d04m57.99sW
```

---

## City presets

| City | Lat | Lng |
|---|---|---|
| 🇺🇸 New York | 40.7128 | -74.0060 |
| 🇬🇧 London | 51.5074 | -0.1278 |
| 🇫🇷 Paris | 48.8566 | 2.3522 |
| 🇯🇵 Tokyo | 35.6762 | 139.6503 |
| 🇦🇺 Sydney | -33.8688 | 151.2093 |
| 🇷🇺 Moscow | 55.7558 | 37.6176 |
| 🇧🇷 São Paulo | -23.5505 | -46.6333 |
| 🇸🇬 Singapore | 1.3521 | 103.8198 |

---

## Project structure

```
coordcloak/
├── icons/
│   ├── icon48.png
│   └── icon96.png
├── src/
│   ├── manifest.json      # Extension config
│   ├── background.js      # Broadcasts settings to all tabs
│   ├── content.js         # Injects geolocation override at page load
│   ├── popup.html         # Toolbar popup UI
│   └── popup.js           # Popup logic + DMS parser
├── LICENSE
└── README.md
```

---

## Contributing

Pull requests are welcome. If you have an idea for a new feature or find a bug, open an issue first so we can discuss it.

```bash
git clone https://github.com/qtChi/coordcloak.git
cd coordcloak

# Load in Firefox:
# about:debugging → This Firefox → Load Temporary Add-on → src/manifest.json
```

Ideas for contribution:
- Additional city presets
- A custom preset save/name feature
- Chrome/Edge (Manifest V3) port
- UI improvements

---

## Privacy

CoordCloak stores your chosen coordinates locally in your browser using the standard WebExtensions storage API. No data is ever transmitted anywhere.

---

## License

[MIT](LICENSE)
