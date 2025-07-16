// Enhanced Indoor Navigation System with GSAP Animations
let canvas, ctx;
let rooms = {};
let currentPath = [];
let currentRouteInstructions = [];
let animatedPathProgress = 0;
let isEmergencyMode = false;
let routeAnimationTween = null;
let dashOffset = 0;
let arrowPosition = { x: 0, y: 0, angle: 0 };
let mapDisplayHeight = 600; // will be updated after image loads

const user = {
  x: 400,
  y: 300,
  direction: 0,
  currentRoom: null,
  targetExit: null
};

// Animation settings
const ANIMATION_SETTINGS = {
  pathDrawDuration: 3, // Faster initial path drawing
  markerBounce: 0.3,
  routePulse: 2,
  emergencyAlert: 1,
  dashSpeed: 0.4, // Much slower dash animation
  arrowSpeed: 1.2 // Much slower arrow movement
};

// Start continuous dash and arrow animations
function startDashAnimation() {
  gsap.to(this, {
    duration: 1,
    repeat: -1,
    ease: "none",
    onUpdate: () => {
      dashOffset += ANIMATION_SETTINGS.dashSpeed;
      updateArrowPosition();
      if (currentPath.length > 0) {
        draw();
      }
    }
  });
}

// Update arrow position along the path
function updateArrowPosition() {
  if (currentPath.length < 2) return;
  
  // Only start arrow animation after path drawing is complete
  if (animatedPathProgress < 1) {
    return; // Don't move arrow until path is fully drawn
  }
  
  const time = Date.now() * 0.001; // Convert to seconds
  const pathLength = currentPath.length - 1;
  const progress = ((time * ANIMATION_SETTINGS.arrowSpeed) % (pathLength * 2)) / pathLength;
  
  // Clamp progress between 0 and 1
  const normalizedProgress = Math.min(1, Math.max(0, progress));
  
  // Calculate position along path
  const segmentIndex = Math.floor(normalizedProgress * (currentPath.length - 1));
  const segmentProgress = (normalizedProgress * (currentPath.length - 1)) % 1;
  
  if (segmentIndex < currentPath.length - 1) {
    const startNode = rooms[currentPath[segmentIndex]];
    const endNode = rooms[currentPath[segmentIndex + 1]];
    
    if (startNode && endNode) {
      const startPos = realToCanvas(startNode.x, startNode.y);
      const endPos = realToCanvas(endNode.x, endNode.y);
      
      arrowPosition.x = startPos.x + (endPos.x - startPos.x) * segmentProgress;
      arrowPosition.y = startPos.y + (endPos.y - startPos.y) * segmentProgress;
      arrowPosition.angle = Math.atan2(endPos.y - startPos.y, endPos.x - startPos.x);
    }
  }
}

// Initialize the application
async function init() {
  console.log('🚀 Initializing Enhanced Navigation System...');
  
  canvas = document.getElementById('mapCanvas');
  ctx = canvas.getContext('2d');
  
  // Adjust canvas height once background image is loaded to keep coordinates aligned
  const mapImg = document.getElementById('mapImage');
  if (mapImg && !mapImg.complete) {
    mapImg.addEventListener('load', resizeCanvasToImage);
  } else if (mapImg) {
    // Image already cached
    resizeCanvasToImage();
  }
  
  async function resizeCanvasToImage() {
    const scale = canvas.width / mapImg.naturalWidth;
    canvas.height = Math.round(mapImg.naturalHeight * scale);
    mapDisplayHeight = canvas.height;
    // Ensure container respects new height
    canvas.style.height = `${canvas.height}px`;
    // Redraw with new scale
    draw();
  }
  
  try {
    await loadRoomData();
    setupEventListeners();
    initializeGSAPAnimations();
    startDashAnimation();
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
  
  // Demo mode - sensors disabled for presentation
  console.log('📱 Demo mode: Motion sensors disabled');
  
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
  
  // Reset route info
  user.targetExit = null;
  currentPath = [];
  currentRouteInstructions = [];
  
  user.currentRoom = roomId;
  const startRoom = rooms[roomId];
  const canvasPos = realToCanvas(startRoom.x, startRoom.y);
  
  user.x = canvasPos.x;
  user.y = canvasPos.y;
  
  // Animate user to position
  gsap.to(user, {
    duration: 0.5, // Faster user positioning
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
  
  // Update UI with route info
  updateUI();
  
  showRoutePanel();
  showDirectionsPanel();
  animatePathDrawing();
  
  console.log(`🗺️ Route calculated: ${currentPath.length} waypoints to ${user.targetExit}`);
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
  
  document.getElementById('routeDistance').textContent = totalDistance;
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

// Enhanced path drawing animation with arrow
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
      // Animate markers after path is drawn
      animateRouteMarkers();
      // Start continuous arrow animation
      startArrowAnimation();
    }
  });
}

// Start continuous arrow animation along the path
function startArrowAnimation() {
  // Arrow will move continuously with the dash animation
  console.log('🏹 Arrow animation started');
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

// Draw the map (hidden - only background image visible, SVG used for pathfinding)
function drawMap() {
  // Clear canvas with transparent background
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // SVG coordinate system and rooms data still used for pathfinding
  // but no visual elements drawn here - PNG image shows in background
}

// Draw animated route path with dashed lines and moving arrow
function drawAnimatedRoute() {
  if (currentPath.length < 2) return;
  
  ctx.save();
  
  // Draw path with animated dashes
  const totalSegments = currentPath.length - 1;
  const animatedSegments = animatedPathProgress * totalSegments;
  
  // Set up dashed line style
  const dashArray = isEmergencyMode ? [15, 10] : [20, 8];
  ctx.setLineDash(dashArray);
  ctx.lineDashOffset = -dashOffset; // Negative for forward animation
  
  ctx.strokeStyle = isEmergencyMode ? '#f44336' : '#4CAF50';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  // Add outer glow
  ctx.shadowColor = ctx.strokeStyle;
  ctx.shadowBlur = 20;
  
  // Draw the main path
  ctx.beginPath();
  
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
  
  // Draw solid background line for better visibility
  ctx.setLineDash([]); // Remove dash
  ctx.shadowBlur = 0;
  ctx.lineWidth = 3;
  ctx.strokeStyle = isEmergencyMode ? 'rgba(244, 67, 54, 0.3)' : 'rgba(76, 175, 80, 0.3)';
  ctx.stroke();
  
  // Draw animated arrow only after path is completely drawn
  if (animatedPathProgress >= 1) { // Only show arrow after path is fully drawn
    drawMovingArrow();
  }
  
  // Draw markers with animated scale
  drawRouteMarkers();
  
  ctx.restore();
}

// Draw the moving arrow at the tip
function drawMovingArrow() {
  if (currentPath.length < 2) return;
  
  ctx.save();
  
  // Position arrow
  ctx.translate(arrowPosition.x, arrowPosition.y);
  ctx.rotate(arrowPosition.angle);
  
  // Arrow design
  const arrowSize = 25;
  const arrowWidth = 15;
  
  // Arrow shadow/glow
  ctx.shadowColor = isEmergencyMode ? '#f44336' : '#4CAF50';
  ctx.shadowBlur = 15;
  
  // Draw arrow body
  ctx.beginPath();
  ctx.moveTo(arrowSize, 0);
  ctx.lineTo(-arrowSize * 0.6, -arrowWidth * 0.5);
  ctx.lineTo(-arrowSize * 0.3, 0);
  ctx.lineTo(-arrowSize * 0.6, arrowWidth * 0.5);
  ctx.closePath();
  
  // Fill arrow
  const gradient = ctx.createLinearGradient(-arrowSize, 0, arrowSize, 0);
  if (isEmergencyMode) {
    gradient.addColorStop(0, '#ff5722');
    gradient.addColorStop(1, '#f44336');
  } else {
    gradient.addColorStop(0, '#66bb6a');
    gradient.addColorStop(1, '#4caf50');
  }
  
  ctx.fillStyle = gradient;
  ctx.fill();
  
  // Arrow border
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.shadowBlur = 0;
  ctx.stroke();
  
  // Add pulsing effect
  const pulseScale = 1 + Math.sin(Date.now() * 0.008) * 0.2;
  ctx.scale(pulseScale, pulseScale);
  
  // Inner highlight
  ctx.beginPath();
  ctx.moveTo(arrowSize * 0.7, 0);
  ctx.lineTo(-arrowSize * 0.4, -arrowWidth * 0.3);
  ctx.lineTo(-arrowSize * 0.2, 0);
  ctx.lineTo(-arrowSize * 0.4, arrowWidth * 0.3);
  ctx.closePath();
  
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fill();
  
  ctx.restore();
}

// Enhanced route markers drawing
function drawRouteMarkers() {
  currentPath.forEach((nodeId, index) => {
    const node = rooms[nodeId];
    if (!node) return;
    
    const canvasPos = realToCanvas(node.x, node.y);
    const scale = node._animScale || 1;
    
    ctx.save();
    ctx.translate(canvasPos.x, canvasPos.y);
    ctx.scale(scale, scale);
    
    // Add pulsing effect to markers
    const pulseScale = 1 + Math.sin(Date.now() * 0.006 + index) * 0.1;
    ctx.scale(pulseScale, pulseScale);
    
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, 2 * Math.PI);
    
    if (node.type === 'exit') {
      // Exit marker with special animation
      const exitPulse = 1 + Math.sin(Date.now() * 0.01) * 0.3;
      ctx.scale(exitPulse, exitPulse);
      
      ctx.fillStyle = '#f44336';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 4;
      ctx.stroke();
      
      // Exit icon
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🚪', 0, 0);
      
    } else if (index === 0) {
      // Start marker
      ctx.fillStyle = '#4caf50';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.stroke();
      
      // Start icon
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🎯', 0, 0);
      
    } else {
      // Waypoint markers
      ctx.fillStyle = '#ffeb3b';
      ctx.fill();
      ctx.strokeStyle = '#f57c00';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Step number
      ctx.fillStyle = '#f57c00';
      ctx.font = 'bold 10px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(index.toString(), 0, 0);
    }
    
    ctx.restore();
  });
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

// Simple movement for demo
function moveUser(deltaX, deltaY) {
  const newX = Math.max(0, Math.min(canvas.width, user.x + deltaX));
  const newY = Math.max(0, Math.min(canvas.height, user.y + deltaY));
  
  gsap.to(user, {
    x: newX,
    y: newY,
    duration: 0.2,
    ease: "power2.out",
    onUpdate: () => {
      updateUI();
      draw();
    },
    onComplete: () => {
      updateRouteProgress();
    }
  });
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



// Keyboard controls for demo
function handleKeyboard(event) {
  const step = 20;
  switch(event.key) {
    case 'w': case 'W': moveUser(0, -step); break;
    case 's': case 'S': moveUser(0, step); break;
    case 'a': case 'A': moveUser(-step, 0); break;
    case 'd': case 'D': moveUser(step, 0); break;
    case 'e': case 'E': activateEmergencyMode(); break;
  }
}

// Utility functions
function realToCanvas(realX, realY) {
  return {
    x: (realX / 100) * canvas.width,
    y: (realY / 75) * mapDisplayHeight
  };
}

function canvasToReal(canvasX, canvasY) {
  return {
    x: (canvasX / canvas.width) * 100,
    y: (canvasY / mapDisplayHeight) * 75
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
  
  // Update target exit
  if (user.targetExit) {
    document.getElementById('targetExit').textContent = user.targetExit;
  }
  
  // Calculate and show total distance
  if (currentRouteInstructions.length > 0) {
    const totalDist = currentRouteInstructions.reduce((sum, inst) => sum + inst.distance, 0);
    document.getElementById('totalDistance').textContent = `${totalDist}m`;
  } else {
    document.getElementById('totalDistance').textContent = '-';
  }
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