// Constants for real-world and SVG dimensions
const REAL_WIDTH_M = 50;
const REAL_HEIGHT_M = 30;
const SVG_WIDTH_PX = 800;
const SVG_HEIGHT_PX = 480;

// Arrow state
// Start at center of room 3410 from SVG overlay
let arrowX = 560 + 60 / 2; // x + width/2 = 590
let arrowY = 190 + 40 / 2; // y + height/2 = 210
let arrowAngle = 0; // Degrees, 0 = up
const ARROW_SIZE = 32; // px

const arrowEl = document.getElementById('user-arrow');
const coordXEl = document.getElementById('coord-x');
const coordYEl = document.getElementById('coord-y');
const facingRotationEl = document.getElementById('facing-rotation');

function updateArrow() {
  // Keep arrow centered on its tip
  arrowEl.style.left = (arrowX - ARROW_SIZE / 2) + 'px';
  arrowEl.style.top = (arrowY - ARROW_SIZE / 2) + 'px';
  arrowEl.style.transform = `rotate(${arrowAngle}deg)`;
  // Update coordinates
  const realX = (arrowX / SVG_WIDTH_PX) * REAL_WIDTH_M;
  const realY = (arrowY / SVG_HEIGHT_PX) * REAL_HEIGHT_M;
  coordXEl.textContent = realX.toFixed(2);
  coordYEl.textContent = realY.toFixed(2);
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function moveArrow(dx, dy, dAngle = 0) {
  arrowX = clamp(arrowX + dx, ARROW_SIZE / 2, SVG_WIDTH_PX - ARROW_SIZE / 2);
  arrowY = clamp(arrowY + dy, ARROW_SIZE / 2, SVG_HEIGHT_PX - ARROW_SIZE / 2);
  arrowAngle = (arrowAngle + dAngle) % 360;
  updateArrow();
}

document.addEventListener('keydown', (e) => {
  const stepPx = 8; // Move step in px
  switch (e.key) {
    case 'ArrowUp':
      moveArrow(0, -stepPx);
      break;
    case 'ArrowDown':
      moveArrow(0, stepPx);
      break;
    case 'ArrowLeft':
      moveArrow(-stepPx, 0);
      break;
    case 'ArrowRight':
      moveArrow(stepPx, 0);
      break;
    case 'a': // rotate left
      moveArrow(0, 0, -15);
      break;
    case 'd': // rotate right
      moveArrow(0, 0, 15);
      break;
  }
});

// Initial render
updateArrow();

// --- Emergency Escape Overlay Logic ---

// Room and exit data from SVG overlay
const rooms = {
  '3410': { x: 560, y: 190, width: 60, height: 40 },
  // Add more rooms if needed
};
const exits = [
  { cx: 50, cy: 170 },
  { cx: 870, cy: 170 },
  { cx: 870, cy: 420 },
];

const overlaySvg = document.getElementById('overlay-svg');
const floorplanImg = document.getElementById('floorplan');
const mapViewport = document.getElementById('map-viewport');
const svgOverlayWrapper = document.getElementById('svg-overlay-wrapper');

// Real-world dimensions
const IMG_WIDTH_PX = floorplanImg.naturalWidth;
const IMG_HEIGHT_PX = floorplanImg.naturalHeight;

// Remove setViewportSize and VIEWPORT_METERS logic
// Center map on arrow only if needed, but do not crop or zoom
function centerMapOnArrow() {
  // No pan/zoom, overlays and arrow are positioned absolutely over the full image
  svgOverlayWrapper.style.transform = '';
}

function highlightRoom(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  // Draw highlighted rectangle
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('x', room.x);
  rect.setAttribute('y', room.y);
  rect.setAttribute('width', room.width);
  rect.setAttribute('height', room.height);
  rect.setAttribute('class', 'highlight-room');
  overlaySvg.appendChild(rect);
}

function highlightExits() {
  exits.forEach(exit => {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', exit.cx);
    circle.setAttribute('cy', exit.cy);
    circle.setAttribute('r', 16);
    circle.setAttribute('class', 'exit-circle');
    overlaySvg.appendChild(circle);
  });
}

function drawEscapePath(fromRoomId, toExitIdx) {
  const room = rooms[fromRoomId];
  const exit = exits[toExitIdx];
  if (!room || !exit) return;
  // Start from room center
  const startX = room.x + room.width / 2;
  const startY = room.y + room.height / 2;
  const endX = exit.cx;
  const endY = exit.cy;
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  path.setAttribute('points', `${startX},${startY} ${endX},${endY}`);
  path.setAttribute('class', 'escape-path');
  path.setAttribute('id', 'escape-path');
  overlaySvg.appendChild(path);
}

function clearOverlay() {
  while (overlaySvg.firstChild) overlaySvg.removeChild(overlaySvg.firstChild);
}

function showEmergencyOverlay() {
  clearOverlay();
  highlightRoom('3410');
  highlightExits();
  // Find nearest exit (Euclidean distance)
  const room = rooms['3410'];
  const roomCenter = { x: room.x + room.width / 2, y: room.y + room.height / 2 };
  let minDist = Infinity, minIdx = 0;
  exits.forEach((exit, i) => {
    const dx = exit.cx - roomCenter.x;
    const dy = exit.cy - roomCenter.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < minDist) { minDist = dist; minIdx = i; }
  });
  drawEscapePath('3410', minIdx);
}

function drawHighlightedRoad() {
  // Path from room 3410 to exit-2 (main corridor, right vertical corridor)
  // Start at center of room 3410
  const startX = 630; // room-3410 x + width/2
  const startY = 210; // room-3410 y + height/2
  // Main corridor: (130, 240) to (930, 240)
  // Right vertical corridor: (910, 240) to (910, 350)
  // Exit-2: (870, 170)
  const points = [
    [startX, startY],
    [630, 240], // move up to corridor
    [930, 240], // right along main corridor
    [930, 350], // down right vertical corridor
    [870, 170]  // to exit-2
  ];
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  path.setAttribute('points', points.map(p => p.join(",")).join(" "));
  path.setAttribute('class', 'escape-path');
  path.setAttribute('id', 'highlighted-road');
  path.style.stroke = '#ffd600';
  path.style.strokeWidth = '10';
  path.style.filter = 'drop-shadow(0 0 16px #ffd600cc)';
  overlaySvg.appendChild(path);
}

// Patch updateArrow to also center map (no-op for now)
const origUpdateArrow = updateArrow;
updateArrow = function() {
  origUpdateArrow();
  centerMapOnArrow();
};

// Remove setupViewportAndCenter and related event listeners
// Initial center and viewport size
// floorplanImg.onload = setupViewportAndCenter;
// window.addEventListener('resize', setupViewportAndCenter);
// window.addEventListener('load', () => {
//   setTimeout(setupViewportAndCenter, 100);
// });

// Device orientation: update arrow rotation based on phone rotation
if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', function(event) {
    // event.alpha: compass heading (0 = north)
    // We want 0deg = up, so rotate arrow by -alpha
    if (typeof event.alpha === 'number') {
      arrowAngle = -event.alpha;
      updateArrow();
    }
  }, true);
}

// Ensure overlay matches image size
floorplanImg.onload = setOverlaySize;
window.addEventListener('resize', setOverlaySize);
setOverlaySize();
showEmergencyOverlay();
drawHighlightedRoad();

// Compass rose rendering
const compassRose = document.getElementById('compass-rose');
compassRose.innerHTML = `
  <svg viewBox="0 0 54 54">
    <circle cx="27" cy="27" r="25" fill="#232837" stroke="#ffd600" stroke-width="2" />
    <text x="27" y="13" text-anchor="middle" fill="#ffd600" font-size="10" font-family="Segoe UI,Arial" dy="3">N</text>
    <text x="41" y="29" text-anchor="middle" fill="#b0b8c9" font-size="9" font-family="Segoe UI,Arial" dy="3">E</text>
    <text x="27" y="47" text-anchor="middle" fill="#b0b8c9" font-size="9" font-family="Segoe UI,Arial" dy="3">S</text>
    <text x="13" y="29" text-anchor="middle" fill="#b0b8c9" font-size="9" font-family="Segoe UI,Arial" dy="3">W</text>
    <polygon id="compass-pointer" points="27,27 23,35 27,10 31,35" fill="#ffd600" stroke="#ffd600" stroke-width="1" />
  </svg>
`;
const compassPointer = compassRose.querySelector('#compass-pointer');

// Update compass pointer rotation with device orientation
if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', function(event) {
    if (typeof event.alpha === 'number') {
      // North is up, so rotate pointer by -alpha
      compassPointer.setAttribute('transform', `rotate(${-event.alpha} 27 27)`);
      // Show current facing rotation (0 = North, 90 = East, etc.)
      facingRotationEl.textContent = Math.round(event.alpha);
    }
  }, true);
} 