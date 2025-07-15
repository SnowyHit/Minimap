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
  
  // Add walking state indicator
  const walkingIndicator = document.getElementById('walkingState') || createWalkingIndicator();
  walkingIndicator.textContent = getWalkingStateText();
  walkingIndicator.className = `walking-state ${walkingState}`;
}

function createWalkingIndicator() {
  const indicator = document.createElement('div');
  indicator.id = 'walkingState';
  indicator.style.cssText = `
    position: fixed; top: 10px; right: 10px; 
    padding: 8px 12px; border-radius: 20px; font-size: 12px;
    font-weight: bold; color: white; z-index: 1000;
  `;
  document.body.appendChild(indicator);
  return indicator;
}

function getWalkingStateText() {
  switch(walkingState) {
    case 'walking': return '🚶 Yürüyor';
    case 'maybe_walking': return '❓ Belki yürüyor';
    default: return '⏸️ Duruyor';
  }
}

// Add CSS for walking state indicator
const style = document.createElement('style');
style.textContent = `
  .walking-state.stationary { background: #757575; }
  .walking-state.maybe_walking { background: #ff9800; }
  .walking-state.walking { background: #4caf50; }
`;
document.head.appendChild(style);

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

// Dead-reckoning with improved step detection
let sensorsAdded = false;
const accBuffer = []; // acceleration history for filtering
const magBuffer = []; // magnitude history for pattern detection
let lastStep = 0;
const STEP_THR = 2.5; // higher threshold to avoid false positives
const STEP_MIN_MS = 400; // longer minimum interval between steps
const STEP_MAX_MS = 2000; // maximum interval for valid walking
let motionOK = false;
let consecutiveSteps = 0; // track walking pattern
let walkingState = 'stationary'; // 'stationary', 'maybe_walking', 'walking'

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
  
  // Calculate total acceleration magnitude
  const mag = Math.sqrt((a.x||0)**2 + (a.y||0)**2 + (a.z||0)**2);
  
  // Add to buffers
  accBuffer.push({ x: a.x||0, y: a.y||0, z: a.z||0, time: Date.now() });
  magBuffer.push(mag);
  
  // Keep buffers at reasonable size
  if (accBuffer.length > 20) accBuffer.shift();
  if (magBuffer.length > 10) magBuffer.shift();
  
  // Need enough samples for analysis
  if (magBuffer.length < 6) return;
  
  // Calculate filtered magnitude (remove gravity)
  const avgMag = magBuffer.reduce((s,v)=>s+v,0) / magBuffer.length;
  const filteredMag = Math.abs(mag - 9.81); // remove gravity component
  
  // Advanced step detection
  if (isValidStep(filteredMag, avgMag)) {
    const now = Date.now();
    if (now - lastStep > STEP_MIN_MS && now - lastStep < STEP_MAX_MS) {
      lastStep = now;
      consecutiveSteps++;
      
      // Update walking state
      if (consecutiveSteps >= 2) {
        walkingState = 'walking';
        stepForward();
        console.log('Valid step detected - walking confirmed');
      } else if (consecutiveSteps === 1) {
        walkingState = 'maybe_walking';
        console.log('Possible step - waiting for confirmation');
      }
    }
  } else {
    // Reset walking state if no valid steps detected
    if (Date.now() - lastStep > STEP_MAX_MS) {
      consecutiveSteps = 0;
      walkingState = 'stationary';
    }
  }
}

// Improved step validation
function isValidStep(filteredMag, avgMag) {
  // Must exceed threshold
  if (filteredMag < STEP_THR) return false;
  
  // Check for walking pattern characteristics
  const recent = magBuffer.slice(-6);
  
  // Calculate variance to detect repetitive motion
  const variance = calculateVariance(recent);
  
  // Walking has moderate variance (not too erratic, not too steady)
  if (variance < 0.5 || variance > 8.0) return false;
  
  // Check for periodic pattern (walking is rhythmic)
  if (!hasWalkingRhythm()) return false;
  
  // Check acceleration direction changes (walking has up/down motion)
  if (!hasVerticalMotionPattern()) return false;
  
  return true;
}

function calculateVariance(values) {
  const avg = values.reduce((s,v)=>s+v,0) / values.length;
  return values.reduce((s,v)=>s+(v-avg)**2,0) / values.length;
}

function hasWalkingRhythm() {
  if (accBuffer.length < 10) return false;
  
  // Check for alternating peaks and valleys in acceleration
  const recent = accBuffer.slice(-10);
  let peaks = 0;
  let valleys = 0;
  
  for (let i = 1; i < recent.length - 1; i++) {
    const curr = Math.sqrt(recent[i].x**2 + recent[i].y**2 + recent[i].z**2);
    const prev = Math.sqrt(recent[i-1].x**2 + recent[i-1].y**2 + recent[i-1].z**2);
    const next = Math.sqrt(recent[i+1].x**2 + recent[i+1].y**2 + recent[i+1].z**2);
    
    if (curr > prev && curr > next) peaks++;
    if (curr < prev && curr < next) valleys++;
  }
  
  // Walking should have alternating peaks and valleys
  return peaks >= 1 && valleys >= 1;
}

function hasVerticalMotionPattern() {
  if (accBuffer.length < 5) return false;
  
  // Check for vertical (z-axis) motion characteristic of walking
  const recent = accBuffer.slice(-5);
  const zValues = recent.map(a => a.z);
  const zVariance = calculateVariance(zValues);
  
  // Walking has noticeable vertical motion
  return zVariance > 1.0;
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