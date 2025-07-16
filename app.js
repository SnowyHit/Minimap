// DEMO UI LOGIC ONLY - No real navigation or sensors
let mapImg = new Image();
mapImg.src = 'mapreal.jpeg';

let rooms = {};
let selectedRoom = null;

const canvas = document.getElementById('mapCanvas');
const ctx = canvas.getContext('2d');
const roomList = document.getElementById('roomList');
const roomModal = document.getElementById('roomModal');
const modalRoomName = document.getElementById('modalRoomName');
const modalRoomInfo = document.getElementById('modalRoomInfo');
const closeModal = document.getElementById('closeModal');
const showAllBtn = document.getElementById('showAllBtn');
const searchBtn = document.getElementById('searchBtn');

// Load rooms and populate sidebar
fetch('rooms.json').then(r => r.json()).then(data => {
  rooms = data;
  renderRoomList();
});

function renderRoomList() {
  roomList.innerHTML = '';
  Object.keys(rooms).forEach(roomId => {
    const li = document.createElement('li');
    li.textContent = roomId;
    li.onclick = () => selectRoom(roomId);
    if (selectedRoom === roomId) li.classList.add('selected');
    roomList.appendChild(li);
  });
}

function selectRoom(roomId) {
  selectedRoom = roomId;
  renderRoomList();
  draw();
  showRoomModal(roomId);
}

function showRoomModal(roomId) {
  modalRoomName.textContent = `Oda: ${roomId}`;
  modalRoomInfo.textContent = `Bu, demo amaçlı bir oda bilgisidir. Koordinatlar: (${rooms[roomId].x}, ${rooms[roomId].y})`;
  roomModal.classList.remove('hidden');
}

closeModal.onclick = () => {
  roomModal.classList.add('hidden');
};

// Demo button actions
showAllBtn.onclick = () => {
  selectedRoom = null;
  renderRoomList();
  draw();
};
searchBtn.onclick = () => {
  alert('Demo: Oda arama özelliği sunulacaktır.');
};

mapImg.onload = () => draw();

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(mapImg, 0, 0, canvas.width, canvas.height);
  // Draw all rooms
  Object.keys(rooms).forEach(roomId => {
    const { x, y } = rooms[roomId];
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, 2 * Math.PI);
    ctx.fillStyle = (selectedRoom === roomId) ? '#ff9800' : '#1976d2';
    ctx.globalAlpha = (selectedRoom === roomId) ? 0.9 : 0.6;
    ctx.fill();
    ctx.globalAlpha = 1.0;
    ctx.font = 'bold 1em Segoe UI, Arial';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(roomId, x, y);
  });
} 