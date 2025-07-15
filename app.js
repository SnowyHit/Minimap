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
function addSensorListeners() {
  if (sensorsAdded) return;
  sensorsAdded = true;
  window.addEventListener('devicemotion', handleDeviceMotion);
  window.addEventListener('deviceorientation', handleDeviceOrientation);
}

function handleDeviceMotion(e) {
  if (!e.accelerationIncludingGravity) return;
  let acc = e.accelerationIncludingGravity;
  let totalAcc = Math.sqrt(acc.x*acc.x + acc.y*acc.y + acc.z*acc.z);
  if (lastAcc && totalAcc - lastAcc > stepThreshold) {
    user.steps++;
    moveUser();
    updateUI();
  }
  lastAcc = totalAcc;
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

// PWA: Service worker kaydı
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js');
  });
} 