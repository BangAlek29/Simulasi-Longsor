import * as THREE from 'three';
import { createTree, addTreeAt, removeTreeAt, getTrees } from './trees.js';
import { getTreeCount, getBrushRadius } from './ui.js';
import { addHouse, removeNearestHouse } from './houses.js';

// Global array untuk menyimpan semua pohon (synced with trees.js)
let allTrees = [];

// Reference ke terrain untuk raycast
let terrainRef = null;

// Raycaster dan mouse untuk deteksi
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

/**
 * Setup event listeners untuk interaksi mouse
 */
export function setupMouseInteraction(camera, renderer, terrain, scene, treesArray, stabilityMap = null) {
  // Simpan reference ke trees array global
  allTrees = treesArray;
  terrainRef = terrain;

  // Nonaktifkan context menu default (klik kanan)
  renderer.domElement.addEventListener('contextmenu', (event) => {
    event.preventDefault();
  });

  // Event listener untuk klik mouse
  renderer.domElement.addEventListener('click', (event) => {
    handleMouseClick(event, camera, renderer, terrain, scene);
  });

  renderer.domElement.addEventListener('contextmenu', (event) => {
    handleRightClick(event, camera, renderer, terrain, scene);
  });
}

/**
 * Handle klik kiri - tambah pohon (normal) atau rumah (Ctrl)
 */
function handleMouseClick(event, camera, renderer, terrain, scene) {
  // Hanya handle klik kiri (button 0)
  if (event.button !== 0) return;

  // Hitung posisi mouse dalam normalized device coordinates
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  // Update raycaster
  raycaster.setFromCamera(mouse, camera);

  // Check interseksi dengan terrain
  const intersects = raycaster.intersectObject(terrain);

  if (intersects.length > 0) {
    const clickPoint = intersects[0].point;

    // CEK CTRL - jika Ctrl + Click, tambah rumah
    if (event.ctrlKey) {
      addHouseAtPoint(clickPoint, terrain, scene);
    } else {
      // Normal click - tambah pohon
      addTreesAtPoint(clickPoint, terrain, scene);
    }
  }
}

/**
 * Tambah pohon di area tertentu
 */
function addTreesAtPoint(clickPoint, terrain, scene) {
  // Hanya tambah pohon jika ketinggian cukup (area dengan elevasi)
  if (clickPoint.y < 2) {
    console.log('Ketinggian terlalu rendah untuk menanam pohon');
    return;
  }

  // Ambil nilai dari slider
  const treeCount = getTreeCount();
  const brushRadius = getBrushRadius();
  let successCount = 0;

  // Loop untuk menambah banyak pohon dalam area radius
  for (let i = 0; i < treeCount; i++) {
    // Generate posisi random dalam radius area
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * brushRadius;
    const offsetX = Math.cos(angle) * distance;
    const offsetZ = Math.sin(angle) * distance;

    const newX = clickPoint.x + offsetX;
    const newZ = clickPoint.z + offsetZ;

    // Gunakan fungsi addTreeAt (akan handle raycasting sendiri)
    const newTree = addTreeAt(scene, terrain, newX, newZ);
    if (newTree) {
      successCount++;
    }
  }

  // Sync allTrees dengan array di trees.js
  allTrees = getTrees();

  console.log(`${successCount} pohon ditambahkan dalam area. Total pohon: ${allTrees.length}`);
}

/**
 * Tambah rumah di lokasi klik
 */
function addHouseAtPoint(clickPoint, terrain, scene) {
  // Gunakan raycasting untuk mendapatkan height terrain yang tepat
  const rayOrigin = new THREE.Vector3(clickPoint.x, 100, clickPoint.z);
  const downDirection = new THREE.Vector3(0, -1, 0);
  raycaster.set(rayOrigin, downDirection);
  const intersects = raycaster.intersectObject(terrain);

  if (intersects.length > 0) {
    const houseY = intersects[0].point.y + 0.1;
    const housePosition = new THREE.Vector3(clickPoint.x, houseY, clickPoint.z);
    
    addHouse(scene, housePosition);
    console.log(`Rumah ditambahkan di posisi: ${clickPoint.x.toFixed(2)}, ${houseY.toFixed(2)}, ${clickPoint.z.toFixed(2)}`);
  }
}

/**
 * Handle klik kanan - hapus pohon (normal) atau rumah (Ctrl)
 */
function handleRightClick(event, camera, renderer, terrain, scene) {
  event.preventDefault();

  // Hitung posisi mouse dalam normalized device coordinates
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  // Update raycaster
  raycaster.setFromCamera(mouse, camera);

  // Check interseksi dengan terrain untuk mendapatkan titik klik
  const terrainIntersects = raycaster.intersectObject(terrain);

  if (terrainIntersects.length > 0) {
    const clickPoint = terrainIntersects[0].point;

    // CEK CTRL - jika Ctrl + Right Click, hapus rumah
    if (event.ctrlKey) {
      removeHouseAtPoint(clickPoint);
    } else {
      // Normal right click - hapus pohon
      removeTreesAtPoint(clickPoint, scene);
    }
  }
}

/**
 * Hapus pohon di area tertentu
 */
function removeTreesAtPoint(clickPoint, scene) {
  const eraserRadius = getBrushRadius(); // Ambil nilai dari slider

  // Cari semua pohon dalam radius dan hapus
  let removeCount = 0;
  
  // Loop untuk hapus semua pohon dalam radius
  // Karena removeTreeAt hanya hapus satu, kita loop sampai tidak ada lagi
  let removed = true;
  while (removed) {
    removed = removeTreeAt(scene, clickPoint.x, clickPoint.z, eraserRadius);
    if (removed) removeCount++;
  }

  // Sync allTrees dengan array di trees.js
  allTrees = getTrees();

  console.log(`${removeCount} pohon dihapus dalam area. Total pohon: ${allTrees.length}`);
}

/**
 * Hapus rumah terdekat dari lokasi klik
 */
function removeHouseAtPoint(clickPoint) {
  const houseRemoveRadius = 20; // Fixed radius untuk hapus rumah
  const removed = removeNearestHouse(clickPoint, houseRemoveRadius);
  
  if (removed) {
    console.log(`Rumah dihapus di dekat posisi klik`);
  } else {
    console.log(`Tidak ada rumah dalam radius ${houseRemoveRadius}`);
  }
}

/**
 * Dapatkan array pohon global
 */
export function getAllTrees() {
  return allTrees;
}

/**
 * Set array pohon global
 */
export function setAllTrees(trees) {
  allTrees = trees;
}
