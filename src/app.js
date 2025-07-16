// Enhanced Indoor Navigation System with GSAP Animations
let canvas, ctx;
let rooms = {};
let currentPath = [];
let currentRouteInstructions = [];
let animatedPathProgress = 0;
let isEmergencyMode = false;
let routeAnimationTween = null;

const user = {
  x: 400,
  y: 300,
  direction: 0,
  stepLength: 0.7,
  steps: 0,
  currentRoom: null,
  targetExit: null
};

const sensor = {
  stepState: 'stationary',
  consecutiveSteps: 0,
  lastStepTime: 0,
  accelerationBuffer: [],
  walkingStateElement: null
};

// Animation settings
const ANIMATION_SETTINGS = {
  pathDrawDuration: 2,
  markerBounce: 0.3,
  routePulse: 1.5,
  emergencyAlert: 0.8
};

// Initialize the application
async function init() {
  console.log('🚀 Initializing Enhanced Navigation System...');
  
  canvas = document.getElementById('mapCanvas');
  ctx = canvas.getContext('2d');
  sensor.walkingStateElement = document.getElementById('walkingStatus');
  
  try {
    await loadRoomData();
    setupEventListeners();
    initializeGSAPAnimations();
    draw();
    console.log('✅ System initialized successfully');
  } catch (error) {
    console.error('❌ Initialization failed:', error);
  }
}

// Load room data with enhanced error handling
async function loadRoomData() {
  try {
    const response = await fetch('data/rooms.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    rooms = data.nodes;
    edges = data.edges;
    
    console.log(`📍 Loaded ${Object.keys(rooms).length} nodes and ${edges.length} connections`);
  } catch (error) {
    console.error('Failed to load room data:', error);
    throw error;
  }
}

// Setup enhanced event listeners
function setupEventListeners() {
  document.getElementById('startBtn').addEventListener('click', startNavigation);
  document.getElementById('emergencyBtn').addEventListener('click', activateEmergencyMode);
  
  // Enhanced sensor permissions
  if (DeviceMotionEvent?.requestPermission) {
    DeviceMotionEvent.requestPermission().then(response => {
      if (response === 'granted') {
        window.addEventListener('devicemotion', handleMotion);
        console.log('✅ Motion sensors authorized');
      }
    });
  } else {
    window.addEventListener('devicemotion', handleMotion);
  }
  
  if (DeviceOrientationEvent?.requestPermission) {
    DeviceOrientationEvent.requestPermission().then(response => {
      if (response === 'granted') {
        window.addEventListener('deviceorientation', handleOrientation);
        console.log('✅ Orientation sensors authorized');
      }
    });
  } else {
    window.addEventListener('deviceorientation', handleOrientation);
  }
  
  // Keyboard controls for testing
  window.addEventListener('keydown', handleKeyboard);
}

// Initialize GSAP animations
function initializeGSAPAnimations() {
  // Set initial states for panels
  gsap.set('.route-panel', { y: -20, opacity: 0 });
  gsap.set('.directions-panel', { x: 20, opacity: 0 });
  gsap.set('.emergency-alert', { y: -50, opacity: 0 });
  
  console.log('🎨 GSAP animations initialized');
}

// Enhanced navigation start
function startNavigation() {
  const roomId = document.getElementById('roomInput').value.trim();
  
  if (!roomId || !rooms[roomId]) {
    showError('❌ Geçersiz oda numarası! Lütfen geçerli bir oda girin.');
    return;
  }
  
  user.currentRoom = roomId;
  const startRoom = rooms[roomId];
  const canvasPos = realToCanvas(startRoom.x, startRoom.y);
  
  user.x = canvasPos.x;
  user.y = canvasPos.y;
  
  // Animate user to position
  gsap.to(user, {
    duration: 1,
    ease: "back.out(1.7)",
    onUpdate: () => {
      updateUI();
      draw();
    },
    onComplete: () => {
      calculateAndShowRoute();
    }
  });
  
  updateUI();
  console.log(`📍 Navigation started from room ${roomId}`);
}

// Emergency mode activation
function activateEmergencyMode() {
  isEmergencyMode = true;
  
  // Show emergency alert with animation
  const alertElement = document.getElementById('emergencyAlert');
  alertElement.style.display = 'block';
  
  gsap.fromTo(alertElement, 
    { y: -50, opacity: 0 },
    { 
      y: 0, 
      opacity: 1, 
      duration: ANIMATION_SETTINGS.emergencyAlert,
      ease: "back.out(1.7)"
    }
  );
  
  // Auto-hide after 5 seconds
  gsap.to(alertElement, {
    y: -50,
    opacity: 0,
    duration: 0.5,
    delay: 5,
    onComplete: () => {
      alertElement.style.display = 'none';
    }
  });
  
  if (user.currentRoom) {
    calculateAndShowRoute(true);
  }
  
  console.log('🚨 Emergency mode activated');
}

// Enhanced route calculation with detailed instructions
function calculateAndShowRoute(isEmergency = false) {
  if (!user.currentRoom) return;
  
  currentPath = findEscapeRoute(user.currentRoom, isEmergency);
  currentRouteInstructions = generateDetailedInstructions(currentPath);
  
  showRoutePanel();
  showDirectionsPanel();
  animatePathDrawing();
  
  console.log(`🗺️ Route calculated: ${currentPath.length} waypoints`);
}

// Enhanced Dijkstra pathfinding
function findEscapeRoute(startNodeId, isEmergency = false) {
  const distances = {};
  const previous = {};
  const unvisited = new Set();
  
  // Initialize distances
  Object.keys(rooms).forEach(nodeId => {
    distances[nodeId] = Infinity;
    unvisited.add(nodeId);
  });
  distances[startNodeId] = 0;
  
  // Build adjacency list
  const adjacency = {};
  Object.keys(rooms).forEach(nodeId => {
    adjacency[nodeId] = [];
  });
  
  edges.forEach(([from, to, weight]) => {
    adjacency[from].push({ node: to, weight });
    adjacency[to].push({ node: from, weight });
  });
  
  // Dijkstra algorithm
  while (unvisited.size > 0) {
    let currentNode = null;
    let shortestDistance = Infinity;
    
    for (const nodeId of unvisited) {
      if (distances[nodeId] < shortestDistance) {
        shortestDistance = distances[nodeId];
        currentNode = nodeId;
      }
    }
    
    if (!currentNode || shortestDistance === Infinity) break;
    
    unvisited.delete(currentNode);
    
    if (rooms[currentNode].type === 'exit') {
      user.targetExit = currentNode;
      return reconstructPath(previous, currentNode);
    }
    
    adjacency[currentNode].forEach(neighbor => {
      if (unvisited.has(neighbor.node)) {
        const newDistance = distances[currentNode] + neighbor.weight;
        if (newDistance < distances[neighbor.node]) {
          distances[neighbor.node] = newDistance;
          previous[neighbor.node] = currentNode;
        }
      }
    });
  }
  
  return [];
}

// Reconstruct path from Dijkstra result
function reconstructPath(previous, endNode) {
  const path = [];
  let currentNode = endNode;
  
  while (currentNode) {
    path.unshift(currentNode);
    currentNode = previous[currentNode];
  }
  
  return path;
}

// Generate detailed turn-by-turn instructions
function generateDetailedInstructions(path) {
  if (path.length < 2) return [];
  
  const instructions = [];
  let totalDistance = 0;
  
  for (let i = 0; i < path.length - 1; i++) {
    const current = rooms[path[i]];
    const next = rooms[path[i + 1]];
    
    if (!current || !next) continue;
    
    const distance = Math.sqrt(
      Math.pow(next.x - current.x, 2) + 
      Math.pow(next.y - current.y, 2)
    );
    totalDistance += distance;
    
    const instruction = {
      step: i + 1,
      from: path[i],
      to: path[i + 1],
      distance: Math.round(distance),
      totalDistance: Math.round(totalDistance),
      description: generateInstructionText(current, next, i, path),
      direction: calculateDirection(current, next),
      type: next.type
    };
    
    instructions.push(instruction);
  }
  
  return instructions;
}

// Generate human-readable instruction text
function generateInstructionText(current, next, stepIndex, path) {
  const currentType = current.type;
  const nextType = next.type;
  const isLastStep = stepIndex === path.length - 2;
  
  if (stepIndex === 0) {
    return `${current.type === 'room' ? 'Odanızdan' : 'Konumunuzdan'} başlayın`;
  }
  
  if (isLastStep && nextType === 'exit') {
    return `🚪 ÇIKIŞA ulaştınız! GÜVENDESİNİZ`;
  }
  
  if (nextType === 'corridor') {
    return `➡️ Koridora geçin`;
  }
  
  if (nextType === 'junction') {
    return `🔄 Kavşağa ulaşın`;
  }
  
  if (nextType === 'stair') {
    return `🪜 Merdivenlere gidin`;
  }
  
  if (currentType === 'corridor' && nextType === 'room') {
    return `🚪 ${path[stepIndex + 1]} numaralı odaya yönelin`;
  }
  
  return `👉 İlerlemeye devam edin`;
}

// Calculate direction between two points
function calculateDirection(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  
  if (angle >= -45 && angle < 45) return 'doğu';
  if (angle >= 45 && angle < 135) return 'güney';
  if (angle >= 135 || angle < -135) return 'batı';
  return 'kuzey';
}

// Show route panel with animation
function showRoutePanel() {
  const panel = document.getElementById('routePanel');
  const stepsContainer = document.getElementById('routeSteps');
  
  // Clear previous steps
  stepsContainer.innerHTML = '';
  
  // Calculate total distance and time
  const totalDistance = currentRouteInstructions.reduce((sum, inst) => sum + inst.distance, 0);
  const estimatedTime = Math.ceil(totalDistance / 1.2); // 1.2 m/s walking speed
  
  document.getElementById('totalDistance').textContent = totalDistance;
  document.getElementById('estimatedTime').textContent = estimatedTime;
  
  // Add steps with staggered animation
  currentRouteInstructions.forEach((instruction, index) => {
    const stepElement = createRouteStepElement(instruction, index);
    stepsContainer.appendChild(stepElement);
    
    // Animate step appearance
    gsap.fromTo(stepElement, 
      { opacity: 0, x: -20 },
      { 
        opacity: 1, 
        x: 0, 
        duration: 0.3,
        delay: index * 0.1,
        ease: "back.out(1.7)"
      }
    );
  });
  
  // Show panel
  panel.style.display = 'block';
  gsap.fromTo(panel,
    { y: -20, opacity: 0 },
    { 
      y: 0, 
      opacity: 1, 
      duration: 0.5,
      ease: "power2.out"
    }
  );
}

// Create route step element
function createRouteStepElement(instruction, index) {
  const stepDiv = document.createElement('div');
  stepDiv.className = 'route-step';
  stepDiv.innerHTML = `
    <div class="step-number">${instruction.step}</div>
    <div class="step-description">${instruction.description}</div>
    <div class="step-distance">${instruction.distance}m</div>
  `;
  return stepDiv;
}

// Show directions panel with current instruction
function showDirectionsPanel() {
  const panel = document.getElementById('directionsPanel');
  const currentStepElement = document.getElementById('currentStep');
  const upcomingStepsElement = document.getElementById('upcomingSteps');
  
  if (currentRouteInstructions.length === 0) return;
  
  // Show current step
  const currentInstruction = currentRouteInstructions[0];
  currentStepElement.innerHTML = `
    <div class="step-icon">${getStepIcon(currentInstruction.type)}</div>
    <div class="step-text">${currentInstruction.description}</div>
  `;
  
  // Show upcoming steps
  upcomingStepsElement.innerHTML = '';
  currentRouteInstructions.slice(1, 4).forEach((instruction, index) => {
    const upcomingDiv = document.createElement('div');
    upcomingDiv.className = 'upcoming-step';
    upcomingDiv.innerHTML = `${index + 2}. ${instruction.description}`;
    upcomingStepsElement.appendChild(upcomingDiv);
  });
  
  // Show panel
  panel.style.display = 'block';
  gsap.fromTo(panel,
    { x: 20, opacity: 0 },
    { 
      x: 0, 
      opacity: 1, 
      duration: 0.5,
      ease: "power2.out"
    }
  );
}

// Get icon for step type
function getStepIcon(type) {
  const icons = {
    'room': '🚪',
    'corridor': '➡️',
    'junction': '🔄',
    'stair': '🪜',
    'exit': '🚪'
  };
  return icons[type] || '👉';
}

// Animate path drawing with GSAP
function animatePathDrawing() {
  if (routeAnimationTween) {
    routeAnimationTween.kill();
  }
  
  animatedPathProgress = 0;
  
  routeAnimationTween = gsap.to(this, {
    duration: ANIMATION_SETTINGS.pathDrawDuration,
    ease: "power2.out",
    onUpdate: function() {
      animatedPathProgress = this.progress();
      draw();
    },
    onComplete: () => {
      // Animate markers
      animateRouteMarkers();
    }
  });
}

// Animate route markers with bounce effect
function animateRouteMarkers() {
  currentPath.forEach((nodeId, index) => {
    const node = rooms[nodeId];
    if (!node) return;
    
    // Create a temporary object for animation
    const marker = { scale: 0 };
    
    gsap.to(marker, {
      scale: 1,
      duration: ANIMATION_SETTINGS.markerBounce,
      delay: index * 0.1,
      ease: "back.out(1.7)",
      onUpdate: () => {
        // Store scale for drawing
        node._animScale = marker.scale;
        draw();
      }
    });
  });
}

// Enhanced drawing function with animations
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Load and draw SVG map (simplified for this example)
  drawMap();
  
  // Draw animated route
  if (currentPath.length > 0) {
    drawAnimatedRoute();
  }
  
  // Draw user with pulsing effect
  drawUser();
}

// Draw the map (simplified - you can load SVG here)
function drawMap() {
  // Background
  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // This would load your SVG map
  // For now, just draw a simple representation
  Object.keys(rooms).forEach(nodeId => {
    const node = rooms[nodeId];
    const canvasPos = realToCanvas(node.x, node.y);
    
    ctx.fillStyle = node.type === 'room' ? '#e3f2fd' : 
                    node.type === 'exit' ? '#c8e6c9' : '#fff3e0';
    ctx.fillRect(canvasPos.x - 15, canvasPos.y - 10, 30, 20);
    
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(nodeId, canvasPos.x, canvasPos.y + 4);
  });
}

// Draw animated route path
function drawAnimatedRoute() {
  if (currentPath.length < 2) return;
  
  ctx.save();
  
  // Draw path with animation progress
  const totalSegments = currentPath.length - 1;
  const animatedSegments = animatedPathProgress * totalSegments;
  
  ctx.beginPath();
  ctx.strokeStyle = isEmergencyMode ? '#f44336' : '#4CAF50';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  // Add glow effect
  ctx.shadowColor = ctx.strokeStyle;
  ctx.shadowBlur = 15;
  
  for (let i = 0; i < Math.floor(animatedSegments) && i < totalSegments; i++) {
    const start = rooms[currentPath[i]];
    const end = rooms[currentPath[i + 1]];
    
    if (!start || !end) continue;
    
    const startPos = realToCanvas(start.x, start.y);
    const endPos = realToCanvas(end.x, end.y);
    
    if (i === 0) {
      ctx.moveTo(startPos.x, startPos.y);
    }
    ctx.lineTo(endPos.x, endPos.y);
  }
  
  // Draw partial segment if needed
  if (animatedSegments % 1 > 0 && Math.floor(animatedSegments) < totalSegments) {
    const segmentIndex = Math.floor(animatedSegments);
    const segmentProgress = animatedSegments % 1;
    
    const start = rooms[currentPath[segmentIndex]];
    const end = rooms[currentPath[segmentIndex + 1]];
    
    if (start && end) {
      const startPos = realToCanvas(start.x, start.y);
      const endPos = realToCanvas(end.x, end.y);
      
      const currentX = startPos.x + (endPos.x - startPos.x) * segmentProgress;
      const currentY = startPos.y + (endPos.y - startPos.y) * segmentProgress;
      
      ctx.lineTo(currentX, currentY);
    }
  }
  
  ctx.stroke();
  
  // Draw markers with animated scale
  ctx.shadowBlur = 0;
  currentPath.forEach((nodeId, index) => {
    const node = rooms[nodeId];
    if (!node) return;
    
    const canvasPos = realToCanvas(node.x, node.y);
    const scale = node._animScale || 1;
    
    ctx.save();
    ctx.translate(canvasPos.x, canvasPos.y);
    ctx.scale(scale, scale);
    
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, 2 * Math.PI);
    
    if (node.type === 'exit') {
      ctx.fillStyle = '#f44336';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.stroke();
    } else if (index === 0) {
      ctx.fillStyle = '#4caf50';
      ctx.fill();
    } else {
      ctx.fillStyle = '#ffeb3b';
      ctx.fill();
      ctx.strokeStyle = '#f57c00';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    
    ctx.restore();
  });
  
  ctx.restore();
}

// Draw user with animated effects
function drawUser() {
  ctx.save();
  
  // Pulsing effect for user
  const pulseScale = 1 + Math.sin(Date.now() * 0.005) * 0.1;
  
  ctx.translate(user.x, user.y);
  ctx.scale(pulseScale, pulseScale);
  
  // User circle
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, 2 * Math.PI);
  ctx.fillStyle = '#2196F3';
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3;
  ctx.stroke();
  
  // Direction indicator
  if (user.direction !== undefined) {
    ctx.rotate((user.direction - 90) * Math.PI / 180);
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(0, -4);
    ctx.lineTo(0, 4);
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.fill();
  }
  
  ctx.restore();
}

// Enhanced motion detection
function handleMotion(event) {
  const acc = event.accelerationIncludingGravity;
  if (!acc) return;
  
  const magnitude = Math.sqrt(acc.x*acc.x + acc.y*acc.y + acc.z*acc.z);
  sensor.accelerationBuffer.push({ x: acc.x, y: acc.y, z: acc.z, magnitude, time: Date.now() });
  
  // Keep buffer size manageable
  if (sensor.accelerationBuffer.length > 20) {
    sensor.accelerationBuffer.shift();
  }
  
  detectStep(magnitude);
}

// Enhanced step detection
function detectStep(magnitude) {
  const now = Date.now();
  const HIGH_THRESHOLD = 1.2;
  const LOW_THRESHOLD = 0.35;
  const MIN_STEP_INTERVAL = 300;
  
  // Simple but effective step detection
  if (magnitude > HIGH_THRESHOLD && 
      (now - sensor.lastStepTime) > MIN_STEP_INTERVAL) {
    
    sensor.consecutiveSteps++;
    sensor.lastStepTime = now;
    
    // Update walking state
    if (sensor.consecutiveSteps >= 2) {
      sensor.stepState = 'walking';
    } else if (sensor.consecutiveSteps === 1) {
      sensor.stepState = 'maybe-walking';
    }
    
    stepForward();
    updateWalkingStatus();
  }
  
  // Reset walking state if no steps for 2.5s
  if (now - sensor.lastStepTime > 2500) {
    sensor.consecutiveSteps = 0;
    sensor.stepState = 'stationary';
    updateWalkingStatus();
  }
}

// Update walking status with visual feedback
function updateWalkingStatus() {
  const statusElement = sensor.walkingStateElement;
  const statusTexts = {
    'walking': '🚶 Yürüyor',
    'maybe-walking': '❓ Belki yürüyor',
    'stationary': '⏸️ Duruyor'
  };
  
  statusElement.textContent = statusTexts[sensor.stepState] || 'Bilinmiyor';
  statusElement.className = sensor.stepState;
}

// Enhanced step forward with animation
function stepForward() {
  const rad = ((user.direction || 0) - 90) * (Math.PI / 180);
  const realPos = canvasToReal(user.x, user.y);
  
  const newRealX = realPos.x + Math.cos(rad) * user.stepLength;
  const newRealY = realPos.y + Math.sin(rad) * user.stepLength;
  const newCanvasPos = realToCanvas(newRealX, newRealY);
  
  // Animate user movement
  gsap.to(user, {
    x: Math.max(0, Math.min(canvas.width, newCanvasPos.x)),
    y: Math.max(0, Math.min(canvas.height, newCanvasPos.y)),
    duration: 0.3,
    ease: "power2.out",
    onUpdate: () => {
      updateUI();
      draw();
    },
    onComplete: () => {
      updateRouteProgress();
    }
  });
  
  user.steps++;
  console.log(`👣 Step ${user.steps}: moved to (${newRealX.toFixed(1)}, ${newRealY.toFixed(1)})`);
}

// Update route progress and instructions
function updateRouteProgress() {
  if (currentPath.length === 0) return;
  
  const userRealPos = canvasToReal(user.x, user.y);
  const currentNode = findNearestNode(userRealPos.x, userRealPos.y);
  
  // Update progress bar
  const progressIndex = currentPath.indexOf(currentNode);
  if (progressIndex >= 0) {
    const progress = (progressIndex / (currentPath.length - 1)) * 100;
    gsap.to('#progressFill', {
      width: `${progress}%`,
      duration: 0.5,
      ease: "power2.out"
    });
    
    // Update current instruction
    if (progressIndex < currentRouteInstructions.length) {
      updateCurrentInstruction(progressIndex);
    }
  }
}

// Update current instruction display
function updateCurrentInstruction(instructionIndex) {
  const instruction = currentRouteInstructions[instructionIndex];
  if (!instruction) return;
  
  const currentStepElement = document.getElementById('currentStep');
  currentStepElement.innerHTML = `
    <div class="step-icon">${getStepIcon(instruction.type)}</div>
    <div class="step-text">${instruction.description}</div>
  `;
  
  // Animate instruction change
  gsap.fromTo(currentStepElement,
    { scale: 0.9, opacity: 0.5 },
    { 
      scale: 1, 
      opacity: 1, 
      duration: 0.3,
      ease: "back.out(1.7)"
    }
  );
}

// Handle device orientation
function handleOrientation(event) {
  if (typeof event.alpha === 'number') {
    user.direction = (event.alpha + 0) % 360;
    updateUI();
    draw();
  }
}

// Keyboard controls for testing
function handleKeyboard(event) {
  const step = 20;
  switch(event.key) {
    case 'w': case 'W': user.y -= step; break;
    case 's': case 'S': user.y += step; break;
    case 'a': case 'A': user.x -= step; break;
    case 'd': case 'D': user.x += step; break;
    case 'e': case 'E': activateEmergencyMode(); break;
  }
  updateUI();
  draw();
}

// Utility functions
function realToCanvas(realX, realY) {
  return {
    x: (realX / 100) * canvas.width,
    y: (realY / 50) * canvas.height
  };
}

function canvasToReal(canvasX, canvasY) {
  return {
    x: (canvasX / canvas.width) * 100,
    y: (canvasY / canvas.height) * 50
  };
}

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

function updateUI() {
  const userRealPos = canvasToReal(user.x, user.y);
  const nearestRoom = findNearestNode(userRealPos.x, userRealPos.y);
  
  document.getElementById('roomName').textContent = nearestRoom || 'Bilinmiyor';
  document.getElementById('stepCount').textContent = user.steps;
  document.getElementById('direction').textContent = user.direction ? 
    `${Math.round(user.direction)}°` : '-';
}

function showError(message) {
  alert(message);
}

// Global variables for edges
let edges = [];

// Initialize when page loads
window.addEventListener('load', init);

// PWA service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js')
      .then(registration => console.log('✅ SW registered'))
      .catch(error => console.log('❌ SW registration failed'));
  });
} 