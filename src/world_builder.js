// World Builder - Flatframe
import { UNITS_PER_METER } from './core/constants.js';

const GRID_SIZE = UNITS_PER_METER;
const WALL_THICKNESS = UNITS_PER_METER;
const SNAP_THRESHOLD = 12;
const WALL_LENGTH_M = 5;

const walls = [];
const spawns = [];
let selectedEntity = null;
let currentTool = 'select';
let previewWall = null;
let previewRotation = 0;
let isPlacing = false;
let placeStart = null;
let camera = { x: 0, y: 0, zoom: 1 };
let showGrid = true;
let snapEnabled = true;
let snapAngle = true;

const canvas = document.getElementById('wb-canvas');
const ctx = canvas.getContext('2d');
const statWalls = document.getElementById('stat-walls');
const statSpawns = document.getElementById('stat-spawns');
const mouseWorldEl = document.getElementById('mouse-world');
const mouseGridEl = document.getElementById('mouse-grid');
const snapIndicator = document.getElementById('snap-indicator');
const gridToggle = document.getElementById('wb-grid-toggle');
const contextMenu = document.getElementById('wb-context-menu');
const wallLengthInput = document.getElementById('wall-length');
const snapEnabledCheckbox = document.getElementById('snap-enabled');
const snapAngleCheckbox = document.getElementById('snap-angle');

function resize() {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
}
window.addEventListener('resize', resize);
resize();

// Tool selection
document.querySelectorAll('[data-tool]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTool = btn.dataset.tool;
    previewWall = null;
    redraw();
  });
});

wallLengthInput.addEventListener('change', () => { const val = parseInt(wallLengthInput.value, 10); if (!isNaN(val) && val >= 1 && val <= 50) { } });

snapEnabledCheckbox.addEventListener('change', () => { snapEnabled = snapEnabledCheckbox.checked; redraw(); });
snapAngleCheckbox.addEventListener('change', () => { snapAngle = snapAngleCheckbox.checked; });

gridToggle.addEventListener('click', () => { showGrid = !showGrid; gridToggle.textContent = `Grid: ${showGrid ? 'ON' : 'OFF'} (G)`; redraw(); });

window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'g' || e.key === 'G') { showGrid = !showGrid; gridToggle.textContent = `Grid: ${showGrid ? 'ON' : 'OFF'} (G)`; redraw(); }
  if (e.key === 'r' && !e.shiftKey) { previewRotation = (previewRotation + Math.PI / 2) % (2 * Math.PI); redraw(); }
  if (e.key === 'R' && e.shiftKey) { previewRotation = 0; }
  if (e.key === 'Delete' || e.key === 'Backspace') { if (selectedEntity) deleteSelected(); }
  if (e.key === 'Escape') { hideContextMenu(); clearSelection(); redraw(); }
});

function getMousePos(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: (e.clientX - rect.left) / camera.zoom + camera.x, y: (e.clientY - rect.top) / camera.zoom + camera.y, screenX: e.clientX, screenY: e.clientY };
}

canvas.addEventListener('mousedown', e => {
  const mouse = getMousePos(e);
  if (e.button === 0) {
    if (currentTool === 'wall') startPlacingWall(mouse);
    else if (currentTool === 'spawn') placeSpawn(mouse);
    else if (currentTool === 'select') selectAt(mouse);
  } else if (e.button === 2) {
    e.preventDefault();
    const entity = findEntityAt(mouse);
    if (entity) { selectEntity(entity); showContextMenu(e.clientX, e.clientY); }
    else { hideContextMenu(); clearSelection(); redraw(); }
  }
});

canvas.addEventListener('mousemove', e => {
  const mouse = getMousePos(e);
  updateMouseDisplay(mouse);
  if (isPlacing && currentTool === 'wall') updatePreviewWall(mouse);
  if (currentTool === 'wall' && !isPlacing) updatePreviewWall(mouse);
  if (selectedEntity && e.buttons === 1 && currentTool === 'select') dragSelected(mouse);
});

canvas.addEventListener('mouseup', e => { if (e.button === 0 && isPlacing && currentTool === 'wall') finishPlacingWall(); });

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
  const newZoom = Math.max(0.25, Math.min(4, camera.zoom * zoomFactor));
  const rect = canvas.getBoundingClientRect();
  const mouseX = (e.clientX - rect.left) / camera.zoom + camera.x;
  const mouseY = (e.clientY - rect.top) / camera.zoom + camera.y;
  camera.x = mouseX - (mouseX - camera.x) * (newZoom / camera.zoom);
  camera.y = mouseY - (mouseY - camera.y) * (newZoom / camera.zoom);
  camera.zoom = newZoom;
  redraw();
});

canvas.addEventListener('contextmenu', e => e.preventDefault());

contextMenu.addEventListener('click', e => {
  const item = e.target.closest('.item');
  if (!item) return;
  handleContextAction(item.dataset.action);
  hideContextMenu();
});

document.addEventListener('click', () => hideContextMenu());

document.getElementById('btn-save').addEventListener('click', saveToStorage);
document.getElementById('btn-export').addEventListener('click', exportJSON);
document.getElementById('btn-load').addEventListener('click', loadFromStorage);
document.getElementById('btn-import').addEventListener('click', () => { const input = document.createElement('input'); input.type = 'file'; input.accept = '.json'; input.onchange = e => importJSON(e.target.files[0]); input.click(); });
document.getElementById('btn-clear').addEventListener('click', clearAll);
document.getElementById('btn-rotate-90').addEventListener('click', () => { previewRotation = (previewRotation + Math.PI / 2) % (2 * Math.PI); redraw(); });
function startPlacingWall(mouse) { isPlacing = true; placeStart = snapPoint(mouse); previewWall = createWallData(placeStart, placeStart, previewRotation); }
function updatePreviewWall(mouse) { 
  if (!isPlacing && currentTool === 'wall') { const snapped = snapPoint(mouse); previewWall = createWallData(snapped, { x: snapped.x, y: snapped.y }, previewRotation); }
  else if (isPlacing) { const snapped = snapPoint(mouse, placeStart); previewWall = createWallData(placeStart, snapped, previewRotation); }
  redraw(); 
}
function finishPlacingWall() { 
  if (previewWall && previewWall.length > GRID_SIZE * 0.5) { walls.push({ ...previewWall, id: Date.now() + Math.random() }); updateStats(); }
  isPlacing = false; placeStart = null; previewWall = null; previewRotation = 0; redraw(); 
}
function createWallData(start, end, rotation) {
  let cx, cy, length, angle;
  if (isPlacing && placeStart) {
    const dx = end.x - start.x; const dy = end.y - start.y;
    length = Math.hypot(dx, dy); angle = Math.atan2(dy, dx);
    cx = start.x + dx / 2; cy = start.y + dy / 2;
  } else {
    const lenM = parseInt(wallLengthInput.value, 10) || WALL_LENGTH_M;
    length = lenM * GRID_SIZE; angle = rotation;
    cx = start.x; cy = start.y;
  }
  return { x: cx, y: cy, length, angle, thickness: WALL_THICKNESS };
}
function placeSpawn(mouse) { const snapped = snapPoint(mouse); spawns.push({ x: snapped.x, y: snapped.y, id: Date.now() + Math.random() }); updateStats(); redraw(); }
function snapPoint(mouse, reference = null) {
  if (!snapEnabled) return mouse;
  let best = { ...mouse }, bestDist = SNAP_THRESHOLD / camera.zoom, snapped = false;
  const gridX = Math.round(mouse.x / GRID_SIZE) * GRID_SIZE, gridY = Math.round(mouse.y / GRID_SIZE) * GRID_SIZE;
  const gridDist = Math.hypot(mouse.x - gridX, mouse.y - gridY);
  if (gridDist < bestDist) { best = { x: gridX, y: gridY }; bestDist = gridDist; snapped = true; }
  for (const wall of walls) {
    const ends = getWallEndpoints(wall);
    for (const end of ends) {
      const dist = Math.hypot(mouse.x - end.x, mouse.y - end.y);
      if (dist < bestDist) { best = { x: end.x, y: end.y }; bestDist = dist; snapped = true; if (reference && snapAngle) { const dx = end.x - reference.x; const dy = end.y - reference.y; previewRotation = Math.abs(dx) > Math.abs(dy) ? (dy > 0 ? 0 : Math.PI) : (dx > 0 ? Math.PI / 2 : -Math.PI / 2); } }
    }
  }
  snapIndicator.style.display = snapped ? 'inline' : 'none'; return best;
}
function getWallEndpoints(wall) {
  const halfLen = wall.length / 2, cos = Math.cos(wall.angle), sin = Math.sin(wall.angle);
  return [{ x: wall.x - cos * halfLen, y: wall.y - sin * halfLen }, { x: wall.x + cos * halfLen, y: wall.y + sin * halfLen }];
}
function selectAt(mouse) { const entity = findEntityAt(mouse); if (entity) selectEntity(entity); else clearSelection(); redraw(); }
function findEntityAt(mouse) {
  for (const wall of walls) { if (pointInWall(mouse, wall)) return { ...wall, type: 'wall' }; }
  for (const spawn of spawns) { if (Math.hypot(mouse.x - spawn.x, mouse.y - spawn.y) < 20 / camera.zoom) return { ...spawn, type: 'spawn' }; }
  return null;
}
function pointInWall(point, wall) {
  const dx = point.x - wall.x, dy = point.y - wall.y, cos = Math.cos(-wall.angle), sin = Math.sin(-wall.angle);
  const localX = dx * cos - dy * sin, localY = dx * sin + dy * cos;
  return Math.abs(localX) <= wall.length / 2 && Math.abs(localY) <= wall.thickness / 2;
}
function selectEntity(entity) { selectedEntity = entity; }
function clearSelection() { selectedEntity = null; }
function deleteSelected() { if (!selectedEntity) return; if (selectedEntity.type == 'wall') walls.splice(walls.findIndex(w => w.id == selectedEntity.id), 1); else if (selectedEntity.type == 'spawn') spawns.splice(spawns.findIndex(s => s.id == selectedEntity.id), 1); selectedEntity = null; updateStats(); redraw(); }
function handleContextAction(action) { if (!selectedEntity) return; if (action == 'delete') deleteSelected(); else if (action == 'duplicate') { const obj = { ...selectedEntity, id: Date.now() + Math.random(), x: selectedEntity.x + 20, y: selectedEntity.y + 20 }; if (obj.type == 'wall') walls.push(obj); else spawns.push(obj); updateStats(); } redraw(); }
function dragSelected(mouse) { if (!selectedEntity) return; const snapped = snapPoint(mouse); selectedEntity.x = snapped.x; selectedEntity.y = snapped.y; redraw(); }
function updateMouseDisplay(mouse) { mouseWorldEl.textContent = `${Math.round(mouse.x)}, ${Math.round(mouse.y)}`; mouseGridEl.textContent = `${Math.round(mouse.x/GRID_SIZE)}, ${Math.round(mouse.y/GRID_SIZE)}`; }
function updateStats() { statWalls.textContent = walls.length; statSpawns.textContent = spawns.length; }
function showContextMenu(x, y) { contextMenu.style.left = `${x}px`; contextMenu.style.top = `${y}px`; contextMenu.style.display = 'block'; }
function saveToStorage() { localStorage.setItem('flatframe_custom_map', JSON.stringify({ walls, spawns })); alert('Saved!'); }
function loadFromStorage() { const data = JSON.parse(localStorage.getItem('flatframe_custom_map')); if (data) { walls.length = 0; walls.push(...(data.walls||[])); spawns.length = 0; spawns.push(...(data.spawns||[])); updateStats(); redraw(); } }
function exportJSON() { const blob = new Blob([JSON.stringify({ walls, spawns })], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'map.json'; a.click(); }
function importJSON(file) { const reader = new FileReader(); reader.onload = e => { const d = JSON.parse(e.target.result); walls.length=0; walls.push(...(d.walls||[])); spawns.length=0; spawns.push(...(d.spawns||[])); updateStats(); redraw(); }; reader.readAsText(file); }
function clearAll() { if (confirm('Clear?')) { walls.length = 0; spawns.length = 0; selectedEntity = null; updateStats(); redraw(); } }
function redraw() { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.save(); ctx.scale(camera.zoom, camera.zoom); ctx.translate(-camera.x, -camera.y); if (showGrid) drawGrid(); for (const wall of walls) drawWall(wall, wall === selectedEntity); if (previewWall && currentTool == 'wall') drawWall(previewWall, false, true); for (const spawn of spawns) drawSpawn(spawn, spawn === selectedEntity); ctx.restore(); }
function drawGrid() { const left = Math.floor(camera.x / GRID_SIZE) * GRID_SIZE, right = left + canvas.width / camera.zoom + GRID_SIZE, top = Math.floor(camera.y / GRID_SIZE) * GRID_SIZE, bottom = top + canvas.height / camera.zoom + GRID_SIZE; ctx.strokeStyle = '#1a1a20'; ctx.lineWidth = 0.5 / camera.zoom; for (let x = left; x <= right; x += GRID_SIZE) { ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke(); } for (let y = top; y <= bottom; y += GRID_SIZE) { ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke(); } ctx.strokeStyle = '#2a2a35'; ctx.lineWidth = 1 / camera.zoom; for (let x = left; x <= right; x += GRID_SIZE * 5) { ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke(); } for (let y = top; y <= bottom; y += GRID_SIZE * 5) { ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke(); } }
function drawWall(wall, isSelected, isPreview = false) { const halfLen = wall.length / 2, halfThick = wall.thickness / 2, cos = Math.cos(wall.angle), sin = Math.sin(wall.angle); ctx.beginPath(); [[-halfLen, -halfThick], [halfLen, -halfThick], [halfLen, halfThick], [-halfLen, halfThick]].forEach((c, i) => { const wx = wall.x + c[0] * cos - c[1] * sin, wy = wall.y + c[0] * sin + c[1] * cos; if (i == 0) ctx.moveTo(wx, wy); else ctx.lineTo(wx, wy); }); ctx.closePath(); if (isPreview) { ctx.fillStyle = '#2a2a3a'; ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 1.5 / camera.zoom; ctx.globalAlpha = 0.6; ctx.fill(); ctx.stroke(); ctx.globalAlpha = 1; } else { ctx.fillStyle = isSelected ? '#2a4a3a' : '#1e3a2e'; ctx.strokeStyle = isSelected ? '#fbbf24' : '#4ade80'; ctx.lineWidth = (isSelected ? 3 : 2) / camera.zoom; ctx.fill(); ctx.stroke(); } }
function drawSpawn(spawn, isSelected) { const size = 16 / camera.zoom; ctx.save(); ctx.translate(spawn.x, spawn.y); ctx.fillStyle = isSelected ? '#fbbf24' : '#3b82f6'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 / camera.zoom; ctx.beginPath(); ctx.moveTo(0, -size); ctx.lineTo(size, 0); ctx.lineTo(0, size); ctx.lineTo(-size, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
redraw();
function hideContextMenu() { contextMenu.style.display = 'none'; }