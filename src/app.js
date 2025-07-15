/**
 * app.js - indoor positioning demo with step-detection dead-reckoning.
 * Works totally offline, no external libraries.
 */

let mapImg = new Image();
// mapImg.src = 'mapreal.png'; // Floor-plan PNG
mapImg.src = 'map.svg'; // Floor-plan SVG (better coordinates)

// Map scaling configuration
const MAP_CONFIG = {
  // Real floor plan dimensions (meters)
  realWidth: 50,   // adjust to actual corridor length
  realHeight: 30,  // adjust to actual width
  // Canvas dimensions
  canvasWidth: 800,
  canvasHeight: 600
};

let rooms = {};
let user = {
  x: 0,
  y: 0,
  direction: 0, // degrees
  steps: 0,
  stepLength: 1.5 // meters per step (realistic walking)
};

// Coordinate conversion utilities
function realToCanvas(realX, realY) {
  return {
    x: (realX / MAP_CONFIG.realWidth) * MAP_CONFIG.canvasWidth,
    y: (realY / MAP_CONFIG.realHeight) * MAP_CONFIG.canvasHeight
  };
}

function canvasToReal(canvasX, canvasY) {
  return {
    x: (canvasX / MAP_CONFIG.canvasWidth) * MAP_CONFIG.realWidth,
    y: (canvasY / MAP_CONFIG.canvasHeight) * MAP_CONFIG.realHeight
  };
}

// DOM refs
const canvas = document.getElementById('mapCanvas');
const ctx = canvas.getContext('2d');
const roomNameSpan = document.getElementById('roomName');
const stepCountSpan = document.getElementById('stepCount');
const directionSpan = document.getElementById('direction');
const roomInput = document.getElementById('roomInput');
const startBtn = document.getElementById('startBtn');

// Load room coordinates
fetch('data/rooms.json')
  .then(r => r.json())
  .then(json => (rooms = json));

mapImg.onload = () => draw();

// -----------------------
// UI helpers
// -----------------------
function updateUI() {
  stepCountSpan.textContent = user.steps;
  directionSpan.textContent = Math.round(user.direction) + '°';
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(mapImg, 0, 0, canvas.width, canvas.height);

  ctx.save();
  const drawX = user.x === 0 && user.y === 0 ? canvas.width / 2 : user.x;
  const drawY = user.x === 0 && user.y === 0 ? canvas.height / 2 : user.y;
  ctx.translate(drawX, drawY);
  ctx.rotate((user.direction - 90) * Math.PI / 180);

  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, 2 * Math.PI);
  ctx.strokeStyle = '#ff9800';
  ctx.lineWidth = 2;
  ctx.stroke();

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

function setStartRoom(id) {
  if (rooms[id]) {
    // Convert real-world coordinates to canvas coordinates
    const canvasPos = realToCanvas(rooms[id].x, rooms[id].y);
    Object.assign(user, { x: canvasPos.x, y: canvasPos.y, steps: 0 });
    roomNameSpan.textContent = id;
    draw();
  } else {
    alert('Oda bulunamadı!');
  }
}

startBtn.onclick = () => {
  setStartRoom(roomInput.value.trim());
  requestSensorPermissions();
};

// Sensor permissions
function requestSensorPermissions() {
  const needsMotionPerm =
    typeof DeviceMotionEvent !== 'undefined' &&
    typeof DeviceMotionEvent.requestPermission === 'function';
  const needsOrientPerm =
    typeof DeviceOrientationEvent !== 'undefined' &&
    typeof DeviceOrientationEvent.requestPermission === 'function';

  if (needsMotionPerm || needsOrientPerm) {
    Promise.all([
      needsMotionPerm
        ? DeviceMotionEvent.requestPermission()
        : Promise.resolve('granted'),
      needsOrientPerm
        ? DeviceOrientationEvent.requestPermission()
        : Promise.resolve('granted')
    ]).then(results => {
      if (results.every(r => r === 'granted')) addSensorListeners();
      else {
        alert('Sensör izinleri reddedildi. HTTPS gerekiyor! Klavye ile test: WASD tuşları');
        addKeyboardControls();
      }
    });
  } else {
    // HTTP üzerinde sensörler çalışmaz
    if (location.protocol === 'http:') {
      alert('Motion sensörleri için HTTPS gerekiyor. Klavye ile test: WASD tuşları');
      addKeyboardControls();
    } else {
      addSensorListeners();
    }
  }
}

// Klavye kontrolları ekle (test için)
function addKeyboardControls() {
  document.addEventListener('keydown', e => {
    switch(e.key.toLowerCase()) {
      case 'w': // yukarı
        user.direction = 0;
        stepForward();
        break;
      case 's': // aşağı
        user.direction = 180;
        stepForward();
        break;
      case 'a': // sol
        user.direction = 270;
        stepForward();
        break;
      case 'd': // sağ
        user.direction = 90;
        stepForward();
        break;
    }
  });
  console.log('Klavye kontrolları aktif: WASD tuşlarını kullanın');
}

// Dead-reckoning
let sensorsAdded = false;
const buf = [];
let lastStep = 0;
const STEP_THR = 1.2;
const STEP_MIN_MS = 350;
let motionOK = false;

function addSensorListeners() {
  if (sensorsAdded) return;
  sensorsAdded = true;
  window.addEventListener('devicemotion', onMotion);
  window.addEventListener('deviceorientation', onOrient);
  setTimeout(() => {
    if (!motionOK) alert('Hareket verisi alınamıyor.');
  }, 5000);
}

function onMotion(e) {
  motionOK = true;
  const a = e.accelerationIncludingGravity || {};
  const mag = Math.sqrt((a.x||0)**2 + (a.y||0)**2 + (a.z||0)**2);
  buf.push(mag);
  if (buf.length > 4) buf.shift();
  const avg = buf.reduce((s,v)=>s+v,0)/buf.length - 9.81;
  const now = e.timeStamp || Date.now();
  if (avg > STEP_THR && now - lastStep > STEP_MIN_MS) {
    lastStep = now;
    stepForward();
  }
}

function onOrient(e) {
  if (typeof e.alpha === 'number') {
    user.direction = e.alpha;
    updateUI();
    draw();
  }
}

function stepForward() {
  const rad = ((user.direction||0)-90)*(Math.PI/180);
  
  // Convert current position to real coordinates
  const realPos = canvasToReal(user.x, user.y);
  
  // Move in real coordinates (meters)
  const newRealX = realPos.x + Math.cos(rad) * user.stepLength;
  const newRealY = realPos.y + Math.sin(rad) * user.stepLength;
  
  // Convert back to canvas coordinates
  const newCanvasPos = realToCanvas(newRealX, newRealY);
  
  // Clamp to canvas bounds
  user.x = Math.max(0, Math.min(canvas.width, newCanvasPos.x));
  user.y = Math.max(0, Math.min(canvas.height, newCanvasPos.y));
  
  user.steps++;
  updateUI();
  draw();
}

// PWA SW
if ('serviceWorker' in navigator) {
  window.addEventListener('load', ()=>navigator.serviceWorker.register('service-worker.js'));
} 