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

function setStartRoom(room) {
  if (rooms[room]) {
    user.x = rooms[room].x;
    user.y = rooms[room].y;
    user.steps = 0;
    roomNameSpan.textContent = room;
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
let lastAcc = 0;
let stepThreshold = 1.2; // z-axis threshold (tuned for walking)
let lastStepTime = 0;
const minStepInterval = 350; // ms, minimum time between steps
let motionEventReceived = false;

// Dead reckoning variables
let velocity = { x: 0, y: 0 };
let lastMotionTimestamp = null;
const velocityDamping = 0.98; // Damping factor to reduce drift

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
  let now = e.timeStamp || Date.now();

  // Use only x/y acceleration (ignore gravity as much as possible)
  let ax = acc.x || 0;
  let ay = acc.y || 0;

  // Estimate delta time (in seconds)
  let dt = 0.05; // default to 50ms
  if (lastMotionTimestamp !== null) {
    dt = Math.min((now - lastMotionTimestamp) / 1000, 0.2); // cap at 200ms
  }
  lastMotionTimestamp = now;

  // Update velocity (simple integration)
  velocity.x += ax * dt;
  velocity.y += ay * dt;

  // Damping to reduce drift
  velocity.x *= velocityDamping;
  velocity.y *= velocityDamping;

  // Update user position (simple integration)
  user.x += velocity.x * 50; // scale for visible movement
  user.y += velocity.y * 50;

  // Clamp user position to canvas bounds
  user.x = Math.max(0, Math.min(canvas.width, user.x));
  user.y = Math.max(0, Math.min(canvas.height, user.y));

  updateUI();
  draw();
  // Debug log
  console.log('motion', {ax, ay, dt, velocity: {...velocity}, user: {x: user.x, y: user.y}});
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
  // Yönü derece olarak kullan, adım uzunluğunda ilerle
  let rad = (user.direction - 90) * Math.PI / 180; // 0 derece yukarı olsun
  user.x += Math.cos(rad) * user.stepLength;
  user.y += Math.sin(rad) * user.stepLength;
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