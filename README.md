# Emergency Escape Navigation App

Indoor positioning system using QR codes and phone sensors for emergency evacuation.

## 🚀 Quick Start

### Live Demo (Recommended)
✅ **Deployed on Netlify with HTTPS** - Motion sensors work!

1. Open the app on your phone browser
2. Grant motion/orientation permissions  
3. Enter room number (e.g., "3401")
4. Tap "Başla" to start tracking
5. Walk around - blue dot follows your movement

### Local Development
```bash
python3 -m http.server 8000
# Visit http://localhost:8000
# Note: Motion sensors require HTTPS, use for UI testing only
```

### Deploy Your Own Version
1. Fork this repository
2. Drag project folder to [netlify.com](https://netlify.com)
3. Get instant HTTPS URL with working sensors
4. Add to phone home screen as PWA

## 📱 Installation as PWA

1. Open the Netlify URL in your phone browser
2. Tap browser menu → "Add to Home Screen"
3. App installs like a native app
4. Works offline after first load

## 🔧 Technical Features

- **Step Detection**: Uses accelerometer peak detection
- **Dead Reckoning**: Combines step count + compass heading
- **PWA**: Installable, works offline
- **No GPS**: Works entirely indoors
- **Vanilla JS**: No frameworks, 100% compatible
- **HTTPS Ready**: Motion sensors work on deployment

## 🏗️ Project Structure

```
├── index.html              # Main app
├── src/
│   └── app.js             # Step detection & positioning logic
├── styles/
│   └── style.css          # UI styling
├── data/
│   └── rooms.json         # Room coordinates
├── manifest.json          # PWA configuration
└── service-worker.js      # Offline caching
```

## 🎯 Emergency Escape Implementation

### Current Features
- ✅ Step-based indoor positioning
- ✅ Compass heading detection
- ✅ Room coordinate mapping
- ✅ Offline PWA capability

### Next Steps
- 🔲 QR code scanner for location reset
- 🔲 Dijkstra pathfinding algorithm
- 🔲 Multiple floor support
- 🔲 Emergency exit routing
- 🔲 Real-time hazard updates

## 🚨 For Emergency Use

This app works **completely offline** after first load:
1. Pre-install on staff/guest devices
2. QR codes at each door provide exact location
3. App calculates shortest path to nearest exit
4. Works even when WiFi/cellular is down

## 🔧 Development

### Testing Motion Sensors
- ✅ **Production**: Use Netlify HTTPS URL
- ⚠️ **Local**: HTTP only supports keyboard testing (WASD keys)

### Adding New Buildings
1. Update `data/rooms.json` with room coordinates
2. Add floor plan image as `mapreal.png`
3. Configure `user.stepLength` for scale
4. Deploy updated version 