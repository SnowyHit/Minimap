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

function setOverlaySize() {
  overlaySvg.setAttribute('width', floorplanImg.naturalWidth);
  overlaySvg.setAttribute('height', floorplanImg.naturalHeight);
  overlaySvg.style.width = floorplanImg.width + 'px';
  overlaySvg.style.height = floorplanImg.height + 'px';
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