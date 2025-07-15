let mapImg = new Image();
mapImg.src = 'mapreal.jpeg'; // PNG harita dosyası (placeholder, eklenmeli)

let rooms = {};
let user = {
  x: 0,
  y: 0,
  direction: 0, // derece
  steps: 0,
  stepLength: 60 // px cinsinden, örnek
};

const canvas = document.getElementById('mapCanvas');
const ctx = canvas.getContext('2d');
const roomNameSpan = document.getElementById('roomName');
const stepCountSpan = document.getElementById('stepCount');
const directionSpan = document.getElementById('direction');
const roomInput = document.getElementById('roomInput');
const startBtn = document.getElementById('startBtn');

// Harita ve oda verisini yükle
fetch('rooms.json').then(r => r.json()).then(data => { rooms = data; });

mapImg.onload = () => draw();

// GPS-based movement
// Define GPS coordinates for top-left and bottom-right of the map (example values, replace with real ones)
const MAP_TOPLEFT = { lat: 40.000000, lon: 29.000000 };
const MAP_BOTTOMRIGHT = { lat: 39.999000, lon: 29.001000 };
let gpsWatchId = null;

// Debug log helper
function logDebug(msg) {
  const logDiv = document.getElementById('debugLog');
  if (logDiv) {
    const now = new Date().toLocaleTimeString();
    logDiv.innerText += `[${now}] ${msg}\n`;
    logDiv.scrollTop = logDiv.scrollHeight;
  }
}

function latLonToXY(lat, lon) {
  // Linear interpolation between reference points
  const x = ((lon - MAP_TOPLEFT.lon) / (MAP_BOTTOMRIGHT.lon - MAP_TOPLEFT.lon)) * canvas.width;
  const y = ((MAP_TOPLEFT.lat - lat) / (MAP_TOPLEFT.lat - MAP_BOTTOMRIGHT.lat)) * canvas.height;
  logDebug(`latLonToXY: lat=${lat}, lon=${lon} => x=${x.toFixed(2)}, y=${y.toFixed(2)}`);
  return { x, y };
}

function startGPS() {
  if (!navigator.geolocation) {
    alert('Cihazınızda GPS desteği yok.');
    logDebug('GPS not supported.');
    return;
  }
  if (gpsWatchId !== null) {
    navigator.geolocation.clearWatch(gpsWatchId);
    logDebug('Cleared previous GPS watch.');
  }
  gpsWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      logDebug(`GPS update: lat=${lat}, lon=${lon}`);
      const { x, y } = latLonToXY(lat, lon);
      user.x = Math.max(0, Math.min(canvas.width, x));
      user.y = Math.max(0, Math.min(canvas.height, y));
      logDebug(`Mapped to canvas: x=${user.x.toFixed(2)}, y=${user.y.toFixed(2)}`);
      updateUI();
      draw();
    },
    (err) => {
      alert('Konum alınamadı: ' + err.message);
      logDebug('GPS error: ' + err.message);
    },
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
  );
  logDebug('Started GPS tracking.');
}

// Override setStartRoom to start GPS tracking
function setStartRoom(room) {
  if (rooms[room]) {
    user.steps = 0;
    roomNameSpan.textContent = room;
    startGPS();
    draw();
  } else {
    alert('Oda bulunamadı!');
  }
}

startBtn.onclick = () => {
  setStartRoom(roomInput.value.trim());
  requestSensorPermissions();
};

function requestSensorPermissions() {
  // iOS 13+ requires explicit permission for motion/orientation
  let permissionNeeded = typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function';
  let orientationPermissionNeeded = typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function';

  if (permissionNeeded || orientationPermissionNeeded) {
    Promise.all([
      permissionNeeded ? DeviceMotionEvent.requestPermission() : Promise.resolve('granted'),
      orientationPermissionNeeded ? DeviceOrientationEvent.requestPermission() : Promise.resolve('granted')
    ]).then(results => {
      if (results.every(r => r === 'granted')) {
        addSensorListeners();
      } else {
        alert('Cihaz hareket/yön sensörlerine izin verilmedi. Konum ve yön güncellenemez.');
      }
    }).catch(() => {
      alert('Cihaz hareket/yön sensörlerine izin verilmedi. Konum ve yön güncellenemez.');
    });
  } else {
    // Most Android/desktop browsers: no permission needed
    addSensorListeners();
  }
}

let sensorsAdded = false;
// Remove dead reckoning variables and logic
// Step detection variables
let lastAcc = 0;
let motionEventReceived = false;

function addSensorListeners() {
  if (sensorsAdded) return;
  sensorsAdded = true;
  window.addEventListener('devicemotion', handleDeviceMotion);
  window.addEventListener('deviceorientation', handleDeviceOrientation);
  motionEventReceived = false;
  checkMotionEventReceived();
}

function handleDeviceMotion(e) {
  motionEventReceived = true;
  if (!e.accelerationIncludingGravity) return;
  let acc = e.accelerationIncludingGravity;
  let z = acc.z || 0;
  let now = Date.now();

  // Band-pass filter: only consider changes within a reasonable range
  let dz = z - lastZ;
  lastZ = z;

  // Step detection state machine
  if (stepState === 0) {
    // Look for upward peak
    if (dz > stepThreshold && (now - lastStepTime) > minStepInterval) {
      stepState = 1;
    }
  } else if (stepState === 1) {
    // Look for downward valley
    if (dz < -stepThreshold && (now - lastStepTime) > minStepInterval && (now - lastStepTime) < maxStepInterval) {
      user.steps++;
      moveUser();
      updateUI();
      lastStepTime = now;
      stepState = 0;
    }
  }
  // Debug log
  // console.log('step+heading', {z, dz, stepState, steps: user.steps});
}

function handleDeviceOrientation(e) {
  if (typeof e.alpha === 'number') {
    user.direction = e.alpha;
    updateUI();
    draw();
  }
}
// Remove old event listeners (if any)
window.removeEventListener('devicemotion', handleDeviceMotion);
window.removeEventListener('deviceorientation', handleDeviceOrientation);

function moveUser() {
  // Move in the direction the user is facing
  let rad = (user.direction - 90) * Math.PI / 180; // 0 degree = up
  user.x += Math.cos(rad) * user.stepLength;
  user.y += Math.sin(rad) * user.stepLength;
  // Clamp to canvas
  user.x = Math.max(0, Math.min(canvas.width, user.x));
  user.y = Math.max(0, Math.min(canvas.height, user.y));
  draw();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(mapImg, 0, 0, canvas.width, canvas.height);
  // Kullanıcı simgesi (daire + ok)
  ctx.save();
  // Fallback: if user is at (0,0), draw at center
  let drawX = user.x === 0 && user.y === 0 ? canvas.width / 2 : user.x;
  let drawY = user.x === 0 && user.y === 0 ? canvas.height / 2 : user.y;
  ctx.translate(drawX, drawY);
  ctx.rotate((user.direction - 90) * Math.PI / 180);
  // Debug border for visibility
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, 2 * Math.PI);
  ctx.strokeStyle = '#ff9800';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Main user icon
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, 2 * Math.PI);
  ctx.fillStyle = '#1976d2';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -22);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();
}

function updateUI() {
  stepCountSpan.textContent = user.steps;
  directionSpan.textContent = Math.round(user.direction) + '°';
}

// Uyarı: Eğer 5 saniye içinde devicemotion alınmazsa kullanıcıya bildir
function checkMotionEventReceived() {
  setTimeout(() => {
    if (!motionEventReceived) {
      alert('Cihazdan hareket verisi alınamıyor. Lütfen hareket izinlerini kontrol edin veya tarayıcıyı değiştirin.');
    }
  }, 5000);
}

// PWA: Service worker kaydı
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js');
  });
} 