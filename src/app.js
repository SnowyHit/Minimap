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

// Load room coordinates and building graph
let buildingGraph = {};
let currentPath = []; // Current escape route

fetch('data/rooms.json')
  .then(r => r.json())
  .then(json => {
    buildingGraph = json;
    rooms = json.nodes; // Backward compatibility
  });

mapImg.onload = () => draw();

// -----------------------
// UI helpers
// -----------------------
function updateUI() {
  stepCountSpan.textContent = user.steps;
  
  // Show both compass and movement direction
  const movementDir = detectMovementDirection();
  let directionText = Math.round(user.direction) + '°';
  if (movementDir !== null) {
    directionText += ` (H:${Math.round(movementDir)}°)`;
  }
  directionSpan.textContent = directionText;
  
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

// Add calibration button
function addCalibrationButton() {
  const calibrateBtn = document.createElement('button');
  calibrateBtn.textContent = 'Pusulayı Kalibre Et';
  calibrateBtn.style.cssText = `
    position: fixed; bottom: 10px; right: 10px; 
    padding: 10px; background: #ff9800; color: white;
    border: none; border-radius: 5px; font-size: 12px;
    z-index: 1000; cursor: pointer;
  `;
  calibrateBtn.onclick = () => {
    alert(`Pusula: ${Math.round(user.direction)}°\nHaritada kuzeye (yukarı) doğru birkaç adım atın ve hareketin doğru olup olmadığını kontrol edin.`);
    console.log('Compass calibration - walk north (up on map) to test');
  };
  document.body.appendChild(calibrateBtn);
}

// Call after page loads
window.addEventListener('load', addCalibrationButton);

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

  // Draw escape route
  drawEscapeRoute();
  
  // Draw user icon
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
    
    // Calculate escape route immediately
    currentPath = findEscapeRoute(id);
    console.log('Escape route calculated:', currentPath);
    
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
    // Fix compass direction - adjust for device orientation and map alignment
    let correctedDirection = e.alpha;
    
    // Calibrate for map orientation (adjust these values based on your map)
    // Most maps have North pointing up, so 0° should be up on screen
    correctedDirection = (correctedDirection + 0) % 360; // add offset if needed
    
    user.direction = correctedDirection;
    updateUI();
    draw();
  }
}

// Improved step calculation with movement direction detection
function stepForward() {
  // Try to detect actual movement direction from accelerometer
  const movementDirection = detectMovementDirection();
  
  // Use movement direction if available, fallback to compass
  const actualDirection = movementDirection !== null ? movementDirection : user.direction;
  
  const rad = ((actualDirection || 0) - 90) * (Math.PI / 180);
  
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
  
  console.log(`Step: compass=${user.direction}°, movement=${movementDirection}°, used=${actualDirection}°`);
}

// Detect movement direction from accelerometer data
function detectMovementDirection() {
  if (accBuffer.length < 8) return null;
  
  // Get recent acceleration data
  const recent = accBuffer.slice(-8);
  
  // Calculate average acceleration direction
  let totalX = 0, totalY = 0;
  let validSamples = 0;
  
  for (let i = 1; i < recent.length; i++) {
    const curr = recent[i];
    const prev = recent[i-1];
    
    // Calculate acceleration delta (movement vector)
    const deltaX = curr.x - prev.x;
    const deltaY = curr.y - prev.y;
    const magnitude = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    // Only use significant movements
    if (magnitude > 0.5) {
      totalX += deltaX;
      totalY += deltaY;
      validSamples++;
    }
  }
  
  if (validSamples < 3) return null;
  
  // Calculate average direction
  const avgX = totalX / validSamples;
  const avgY = totalY / validSamples;
  
  // Convert to degrees (0° = up, 90° = right, etc.)
  let direction = Math.atan2(avgY, avgX) * (180 / Math.PI);
  direction = (direction + 90) % 360; // adjust for screen coordinates
  if (direction < 0) direction += 360;
  
  return direction;
}

// Add compass calibration helper
function calibrateCompass() {
  // You can call this to check if compass needs adjustment
  console.log('Current compass:', user.direction);
  console.log('Take a few steps north (up on map) and check if movement matches');
}

// Dijkstra algorithm for shortest path to nearest exit
function findEscapeRoute(startNodeId) {
  if (!buildingGraph.nodes || !buildingGraph.edges) {
    console.log('Building graph not loaded yet');
    return [];
  }
  
  const nodes = buildingGraph.nodes;
  const edges = buildingGraph.edges;
  
  // Find all exits
  const exits = Object.keys(nodes).filter(id => nodes[id].type === 'exit');
  if (exits.length === 0) return [];
  
  // Dijkstra implementation
  const distances = {};
  const previous = {};
  const unvisited = new Set();
  
  // Initialize distances
  Object.keys(nodes).forEach(nodeId => {
    distances[nodeId] = Infinity;
    previous[nodeId] = null;
    unvisited.add(nodeId);
  });
  
  distances[startNodeId] = 0;
  
  while (unvisited.size > 0) {
    // Find unvisited node with minimum distance
    let currentNode = null;
    let minDistance = Infinity;
    
    for (const nodeId of unvisited) {
      if (distances[nodeId] < minDistance) {
        minDistance = distances[nodeId];
        currentNode = nodeId;
      }
    }
    
    if (currentNode === null || minDistance === Infinity) break;
    
    unvisited.delete(currentNode);
    
    // Check if we reached an exit
    if (nodes[currentNode].type === 'exit') {
      // Reconstruct path
      const path = [];
      let node = currentNode;
      while (node !== null) {
        path.unshift(node);
        node = previous[node];
      }
      return path;
    }
    
    // Update distances to neighbors
    edges.forEach(([nodeA, nodeB, weight]) => {
      const neighbor = nodeA === currentNode ? nodeB : (nodeB === currentNode ? nodeA : null);
      if (neighbor && unvisited.has(neighbor)) {
        const newDistance = distances[currentNode] + weight;
        if (newDistance < distances[neighbor]) {
          distances[neighbor] = newDistance;
          previous[neighbor] = currentNode;
        }
      }
    });
  }
  
  return []; // No path found
}

// Draw the escape route on the map
function drawEscapeRoute() {
  if (!currentPath || currentPath.length < 2) return;
  
  ctx.save();
  
  // Draw route line
  ctx.strokeStyle = '#ff4444';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  // Add glow effect
  ctx.shadowColor = '#ff4444';
  ctx.shadowBlur = 8;
  
  ctx.beginPath();
  
  for (let i = 0; i < currentPath.length; i++) {
    const nodeId = currentPath[i];
    const node = rooms[nodeId];
    if (!node) continue;
    
    const canvasPos = realToCanvas(node.x, node.y);
    
    if (i === 0) {
      ctx.moveTo(canvasPos.x, canvasPos.y);
    } else {
      ctx.lineTo(canvasPos.x, canvasPos.y);
    }
  }
  
  ctx.stroke();
  
  // Draw route waypoints
  ctx.shadowBlur = 0;
  currentPath.forEach((nodeId, index) => {
    const node = rooms[nodeId];
    if (!node) return;
    
    const canvasPos = realToCanvas(node.x, node.y);
    
    ctx.beginPath();
    ctx.arc(canvasPos.x, canvasPos.y, 6, 0, 2 * Math.PI);
    
    if (node.type === 'exit') {
      ctx.fillStyle = '#ff4444';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Exit label
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('EXIT', canvasPos.x, canvasPos.y + 15);
    } else if (index === 0) {
      ctx.fillStyle = '#4caf50';
      ctx.fill();
    } else {
      ctx.fillStyle = '#ffeb3b';
      ctx.fill();
      ctx.strokeStyle = '#f57c00';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  });
  
  ctx.restore();
}

// Update route when user moves
function stepForward() {
  // Try to detect actual movement direction from accelerometer
  const movementDirection = detectMovementDirection();
  
  // Use movement direction if available, fallback to compass
  const actualDirection = movementDirection !== null ? movementDirection : user.direction;
  
  const rad = ((actualDirection || 0) - 90) * (Math.PI / 180);
  
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
  
  console.log(`Step: compass=${user.direction}°, movement=${movementDirection}°, used=${actualDirection}°`);
  
  // Recalculate route if user has moved significantly
  const userRealPos = canvasToReal(user.x, user.y);
  const nearestNode = findNearestNode(userRealPos.x, userRealPos.y);
  
  if (nearestNode && currentPath[0] !== nearestNode) {
    currentPath = findEscapeRoute(nearestNode);
    console.log('Route updated for new position:', nearestNode);
  }
}

// Find nearest graph node to current position
function findNearestNode(realX, realY) {
  let nearestNode = null;
  let minDistance = Infinity;
  
  Object.keys(rooms).forEach(nodeId => {
    const node = rooms[nodeId];
    const distance = Math.sqrt((node.x - realX) ** 2 + (node.y - realY) ** 2);
    
    if (distance < minDistance) {
      minDistance = distance;
      nearestNode = nodeId;
    }
  });
  
  return nearestNode;
}

// PWA SW
if ('serviceWorker' in navigator) {
  window.addEventListener('load', ()=>navigator.serviceWorker.register('service-worker.js'));
} 