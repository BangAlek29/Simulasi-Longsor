/**
 * Optimized Tree System using InstancedMesh
 * High-performance tree rendering for landslide simulation
 */

import * as THREE from 'three';
import { terrainConfig, isOnSlope, getTerrainHeightAt, increaseStabilityAt, isInsideTerrain } from './terrain.js';

// Tree system variables
let trees = [];                    // Tree data (position, rotation, state)
let fallingTrees = [];             // Trees that are falling
const TREE_PROTECTION_RADIUS = 15; // Radius of tree soil protection

// Instanced mesh references
let trunkInstancedMesh = null;
let foliageInstancedMesh1 = null;  // Bottom layer
let foliageInstancedMesh2 = null;  // Middle layer
let foliageInstancedMesh3 = null;  // Top layer

// Shared geometries
let trunkGeometry = null;
let foliageGeometry1 = null;
let foliageGeometry2 = null;
let foliageGeometry3 = null;

// Shared materials
let trunkMaterial = null;
let foliageMaterial1 = null;
let foliageMaterial2 = null;
let foliageMaterial3 = null;

// Configuration
const MAX_TREES = 100;  // Maximum number of trees
const FOLIAGE_COLORS = [0x228B22, 0x32CD32, 0x2E8B57]; // Dark green, lime, sea green

// Scene reference
let sceneRef = null;

// Dummy object for matrix calculations
const dummy = new THREE.Object3D();

/**
 * Tree data class
 */
class TreeData {
    constructor(position, rotationY, index) {
        this.position = position.clone();
        this.originalPosition = position.clone();
        this.rotationY = rotationY;
        this.index = index;
        this.scale = 0.9 + Math.random() * 0.2; // Slight size variation
        this.status = 'standing'; // 'standing', 'falling', 'fallen'
        this.fallProgress = 0;
        this.fallDirection = new THREE.Vector3();
        this.velocity = new THREE.Vector3();
    }
}

/**
 * Initialize tree instanced meshes
 */
function initInstancedMeshes(scene) {
    sceneRef = scene;
    
    // Create trunk geometry
    trunkGeometry = new THREE.CylinderGeometry(0.8, 1.1, 5, 6, 2);
    trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x8B6F47 });
    
    // Create foliage geometries (3 layers of cones)
    foliageGeometry1 = new THREE.ConeGeometry(3.2, 6, 8, 2);
    foliageGeometry2 = new THREE.ConeGeometry(2.8, 5, 8, 2);
    foliageGeometry3 = new THREE.ConeGeometry(2.3, 4.5, 8, 2);
    
    // Create foliage materials
    foliageMaterial1 = new THREE.MeshLambertMaterial({ color: FOLIAGE_COLORS[0] });
    foliageMaterial2 = new THREE.MeshLambertMaterial({ color: FOLIAGE_COLORS[1] });
    foliageMaterial3 = new THREE.MeshLambertMaterial({ color: FOLIAGE_COLORS[2] });
    
    // Create instanced meshes
    trunkInstancedMesh = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, MAX_TREES);
    foliageInstancedMesh1 = new THREE.InstancedMesh(foliageGeometry1, foliageMaterial1, MAX_TREES);
    foliageInstancedMesh2 = new THREE.InstancedMesh(foliageGeometry2, foliageMaterial2, MAX_TREES);
    foliageInstancedMesh3 = new THREE.InstancedMesh(foliageGeometry3, foliageMaterial3, MAX_TREES);
    
    // Enable shadows
    [trunkInstancedMesh, foliageInstancedMesh1, foliageInstancedMesh2, foliageInstancedMesh3].forEach(mesh => {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.count = 0; // Start with no visible trees
    });
    
    // Add to scene
    scene.add(trunkInstancedMesh);
    scene.add(foliageInstancedMesh1);
    scene.add(foliageInstancedMesh2);
    scene.add(foliageInstancedMesh3);
    
    console.log('Tree instanced meshes initialized');
}

/**
 * Update instance matrix for a tree at given index
 */
function updateTreeInstance(tree) {
    const idx = tree.index;
    const pos = tree.position;
    const scale = tree.scale;
    
    // Calculate rotation based on status
    let rotX = 0, rotZ = 0;
    if (tree.status === 'falling' || tree.status === 'fallen') {
        const fallAngle = tree.fallProgress * Math.PI / 2;
        rotX = Math.sin(tree.fallDirection.z) * fallAngle;
        rotZ = -Math.sin(tree.fallDirection.x) * fallAngle;
    }
    
    // Trunk position (center at y = 2.5 from base)
    dummy.position.set(pos.x, pos.y + 2.5 * scale, pos.z);
    dummy.rotation.set(rotX, tree.rotationY, rotZ);
    dummy.scale.set(scale, scale, scale);
    dummy.updateMatrix();
    trunkInstancedMesh.setMatrixAt(idx, dummy.matrix);
    
    // Foliage layer 1 (y = 5 from base)
    dummy.position.set(pos.x, pos.y + 5 * scale, pos.z);
    if (tree.status !== 'standing') {
        const offset = new THREE.Vector3(0, 2.5 * scale, 0);
        offset.applyEuler(new THREE.Euler(rotX, tree.rotationY, rotZ));
        dummy.position.set(pos.x + offset.x * 0.1, pos.y + 2.5 * scale + offset.y, pos.z + offset.z * 0.1);
    }
    dummy.rotation.set(rotX, tree.rotationY, rotZ);
    dummy.scale.set(scale, scale, scale);
    dummy.updateMatrix();
    foliageInstancedMesh1.setMatrixAt(idx, dummy.matrix);
    
    // Foliage layer 2 (y = 6.2 from base)
    dummy.position.set(pos.x, pos.y + 6.2 * scale, pos.z);
    if (tree.status !== 'standing') {
        const offset = new THREE.Vector3(0, 3.7 * scale, 0);
        offset.applyEuler(new THREE.Euler(rotX, tree.rotationY, rotZ));
        dummy.position.set(pos.x + offset.x * 0.1, pos.y + 2.5 * scale + offset.y, pos.z + offset.z * 0.1);
    }
    dummy.rotation.set(rotX, tree.rotationY, rotZ);
    dummy.scale.set(scale, scale, scale);
    dummy.updateMatrix();
    foliageInstancedMesh2.setMatrixAt(idx, dummy.matrix);
    
    // Foliage layer 3 (y = 7.2 from base)
    dummy.position.set(pos.x, pos.y + 7.2 * scale, pos.z);
    if (tree.status !== 'standing') {
        const offset = new THREE.Vector3(0, 4.7 * scale, 0);
        offset.applyEuler(new THREE.Euler(rotX, tree.rotationY, rotZ));
        dummy.position.set(pos.x + offset.x * 0.1, pos.y + 2.5 * scale + offset.y, pos.z + offset.z * 0.1);
    }
    dummy.rotation.set(rotX, tree.rotationY, rotZ);
    dummy.scale.set(scale, scale, scale);
    dummy.updateMatrix();
    foliageInstancedMesh3.setMatrixAt(idx, dummy.matrix);
}

/**
 * Mark instance matrices as needing update
 */
function markMatricesForUpdate() {
    if (trunkInstancedMesh) trunkInstancedMesh.instanceMatrix.needsUpdate = true;
    if (foliageInstancedMesh1) foliageInstancedMesh1.instanceMatrix.needsUpdate = true;
    if (foliageInstancedMesh2) foliageInstancedMesh2.instanceMatrix.needsUpdate = true;
    if (foliageInstancedMesh3) foliageInstancedMesh3.instanceMatrix.needsUpdate = true;
}

/**
 * Create a single tree (legacy compatibility)
 */
export function createTree() {
    // Returns dummy group for compatibility
    const treeGroup = new THREE.Group();
    treeGroup.userData.isLegacyTree = true;
    return treeGroup;
}

/**
 * Memeriksa apakah posisi berada di area lereng (bukan dataran depan)
 */
function checkIsOnSlope(z) {
  return isOnSlope(z);
}

/**
 * Membuat multiple pohon dan menempatkannya secara acak di area lereng
 */
export function createTrees(scene, terrain, count = 30) {
  // Initialize instanced meshes if not done
  if (!trunkInstancedMesh) {
    initInstancedMeshes(scene);
  }
  
  trees = [];
  fallingTrees = [];
  
  const raycaster = new THREE.Raycaster();
  const downDirection = new THREE.Vector3(0, -1, 0);

  const terrainWidth = terrainConfig.width;
  const terrainDepth = terrainConfig.depth;

  let successCount = 0;
  let attempts = 0;
  const maxAttempts = count * 6;

  while (successCount < count && attempts < maxAttempts && successCount < MAX_TREES) {
    attempts++;

    let randomX = (Math.random() - 0.5) * terrainWidth;
    let randomZ = (Math.random() - 0.5) * terrainDepth;

    // Only place trees on slopes
    if (!checkIsOnSlope(randomZ)) {
      continue;
    }

    const rayOrigin = new THREE.Vector3(randomX, 150, randomZ);
    raycaster.set(rayOrigin, downDirection);
    const intersects = raycaster.intersectObject(terrain);

    if (intersects.length > 0) {
      const point = intersects[0].point;

      if (point.y < 1.5) {
        continue;
      }

      // Create tree data
      const rotationY = Math.random() * Math.PI * 2;
      const position = new THREE.Vector3(point.x, point.y + 0.5, point.z);
      const treeData = new TreeData(position, rotationY, successCount);
      
      trees.push(treeData);
      
      // Update instance matrix
      updateTreeInstance(treeData);
      
      // Increase soil stability around tree
      increaseStabilityAt(point.x, point.z, 0.1, 8);
      
      successCount++;
    }
  }

  // Update instance counts
  trunkInstancedMesh.count = successCount;
  foliageInstancedMesh1.count = successCount;
  foliageInstancedMesh2.count = successCount;
  foliageInstancedMesh3.count = successCount;
  
  markMatricesForUpdate();

  console.log(`${successCount} trees added using InstancedMesh (optimized)`);
  return trees;
}

/**
 * Tambah pohon baru di posisi tertentu - dengan validasi batas terrain
 */
export function addTreeAt(scene, terrain, x, z) {
  // Initialize if needed
  if (!trunkInstancedMesh) {
    initInstancedMeshes(scene);
  }
  
  // Check bounds
  if (!isInsideTerrain(x, z)) {
    console.log('Cannot add tree outside terrain');
    return null;
  }
  
  // Check apakah di area lereng
  if (!checkIsOnSlope(z)) {
    console.log('Pohon hanya bisa ditanam di area lereng');
    return null;
  }
  
  // Check max trees
  if (trees.length >= MAX_TREES) {
    console.log('Maximum number of trees reached');
    return null;
  }
  
  const raycaster = new THREE.Raycaster();
  const rayOrigin = new THREE.Vector3(x, 150, z);
  raycaster.set(rayOrigin, new THREE.Vector3(0, -1, 0));
  const intersects = raycaster.intersectObject(terrain);
  
  if (intersects.length > 0) {
    const point = intersects[0].point;
    
    // Minimal height check
    if (point.y < 1.5) {
      console.log('Area terlalu rendah untuk menanam pohon');
      return null;
    }
    
    // Create tree data for instanced mesh
    const index = trees.length;
    const rotationY = Math.random() * Math.PI * 2;
    const position = new THREE.Vector3(point.x, point.y + 0.5, point.z);
    const treeData = new TreeData(position, rotationY, index);
    
    trees.push(treeData);
    
    // Update instance
    updateTreeInstance(treeData);
    
    // Update counts
    trunkInstancedMesh.count = trees.length;
    foliageInstancedMesh1.count = trees.length;
    foliageInstancedMesh2.count = trees.length;
    foliageInstancedMesh3.count = trees.length;
    
    markMatricesForUpdate();
    
    // Tingkatkan stabilitas tanah
    increaseStabilityAt(point.x, point.z, 0.15, 8);
    
    return treeData;
  }
  
  return null;
}

/**
 * Remove tree by index and rebuild instance data
 */
function removeTreeByIndex(index) {
  trees.splice(index, 1);
  
  // Rebuild indices and update all instances
  trees.forEach((tree, i) => {
    tree.index = i;
    updateTreeInstance(tree);
  });
  
  // Update counts
  const count = trees.length;
  trunkInstancedMesh.count = count;
  foliageInstancedMesh1.count = count;
  foliageInstancedMesh2.count = count;
  foliageInstancedMesh3.count = count;
  
  markMatricesForUpdate();
}

/**
 * Hapus pohon terdekat dari posisi
 */
export function removeTreeAt(scene, x, z, radius = 8) {
  let nearestTree = null;
  let nearestDist = radius;
  let nearestIndex = -1;
  
  trees.forEach((tree, index) => {
    if (tree.status && tree.status !== 'standing') return;
    
    const dx = tree.position.x - x;
    const dz = tree.position.z - z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestTree = tree;
      nearestIndex = index;
    }
  });
  
  if (nearestTree) {
    removeTreeByIndex(nearestIndex);
    return true;
  }
  
  return false;
}

/**
 * Mendapatkan array semua pohon
 */
export function getTrees() {
  return trees;
}

/**
 * Get tree count (only standing trees)
 */
export function getTreeCount() {
  return trees.filter(t => !t.status || t.status === 'standing').length;
}

/**
 * Get tree protection level at position (0-1)
 * Semakin banyak pohon di sekitar, semakin tinggi proteksi
 */
export function getTreeProtectionAt(x, z) {
  let protection = 0;
  
  trees.forEach(tree => {
    if (tree.status && tree.status !== 'standing') return;
    
    const dx = tree.position.x - x;
    const dz = tree.position.z - z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    
    if (dist < TREE_PROTECTION_RADIUS) {
      // Proteksi berbanding terbalik dengan jarak
      const influence = 1 - (dist / TREE_PROTECTION_RADIUS);
      protection += influence * 0.3; // Setiap pohon memberikan kontribusi
    }
  });
  
  return Math.min(1.0, protection); // Cap at 1.0
}

/**
 * Update stabilitas berdasarkan pohon (dipanggil periodik)
 */
export function updateTreeStability() {
  trees.forEach(tree => {
    if (tree.status && tree.status !== 'standing') return;
    // Pohon terus memberikan stabilitas ke area sekitarnya
    increaseStabilityAt(tree.position.x, tree.position.z, 0.001, 6);
  });
  
  // Update pohon yang sedang tumbang
  updateFallingTrees();
}

/**
 * Update animasi pohon yang sedang tumbang (using instanced mesh)
 */
function updateFallingTrees() {
  let needsUpdate = false;
  
  fallingTrees.forEach(tree => {
    if (tree.status !== 'falling') return;
    
    tree.fallProgress += 0.015;
    needsUpdate = true;
    
    // Move with landslide
    tree.position.x += tree.velocity.x;
    tree.position.z += tree.velocity.z;
    
    // Follow terrain
    const groundY = getTerrainHeightAt(tree.position.x, tree.position.z);
    tree.position.y = groundY + 0.3 * (1 - tree.fallProgress);
    
    // Friction
    tree.velocity.multiplyScalar(0.98);
    
    // Update instance matrix
    updateTreeInstance(tree);
    
    // Check if finished falling
    if (tree.fallProgress >= 1.0) {
      tree.status = 'fallen';
      tree.position.y = groundY;
      updateTreeInstance(tree);
    }
  });
  
  if (needsUpdate) {
    markMatricesForUpdate();
  }
  
  // Cleanup finished trees after some time
  fallingTrees = fallingTrees.filter(t => t.status !== 'fallen' || t.fallProgress < 2.0);
}

/**
 * Tumbangkan pohon di area longsor
 * @param {THREE.Vector3} landslidePos - Posisi pusat longsor
 * @param {number} radius - Radius area longsor
 * @param {THREE.Scene} scene - Scene reference
 */
export function knockdownTreesInArea(landslidePos, radius, scene) {
  const treesToKnock = [];
  
  trees.forEach(tree => {
    if (tree.status && tree.status !== 'standing') return;
    
    const dx = tree.position.x - landslidePos.x;
    const dz = tree.position.z - landslidePos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    
    if (dist < radius) {
      treesToKnock.push(tree);
    }
  });
  
  treesToKnock.forEach(tree => {
    // Set fall direction (toward front + random variation)
    tree.fallDirection.set(
      (Math.random() - 0.5) * 0.5,
      0,
      0.8 + Math.random() * 0.2
    ).normalize();
    
    tree.velocity.set(
      tree.fallDirection.x * 0.1,
      0,
      tree.fallDirection.z * 0.15
    );
    
    tree.status = 'falling';
    tree.fallProgress = 0;
    
    fallingTrees.push(tree);
  });
  
  if (treesToKnock.length > 0) {
    markMatricesForUpdate();
    console.log(`🌲 ${treesToKnock.length} pohon tumbang terkena longsor!`);
  }
  
  return treesToKnock.length;
}

/**
 * Get falling trees count
 */
export function getFallingTreeCount() {
  return fallingTrees.filter(t => t.status === 'falling').length;
}

/**
 * Menghapus semua pohon dari scene
 */
export function clearTrees(scene) {
  trees = [];
  fallingTrees = [];
  
  if (trunkInstancedMesh) {
    trunkInstancedMesh.count = 0;
    foliageInstancedMesh1.count = 0;
    foliageInstancedMesh2.count = 0;
    foliageInstancedMesh3.count = 0;
    markMatricesForUpdate();
  }
}

/**
 * Reset trees
 */
export function resetTrees(scene, terrain, count = 30) {
  clearTrees(scene);
  return createTrees(scene, terrain, count);
}

/**
 * Dispose tree system (cleanup)
 */
export function disposeTreeSystem() {
  if (sceneRef) {
    if (trunkInstancedMesh) sceneRef.remove(trunkInstancedMesh);
    if (foliageInstancedMesh1) sceneRef.remove(foliageInstancedMesh1);
    if (foliageInstancedMesh2) sceneRef.remove(foliageInstancedMesh2);
    if (foliageInstancedMesh3) sceneRef.remove(foliageInstancedMesh3);
  }
  
  // Dispose geometries
  if (trunkGeometry) trunkGeometry.dispose();
  if (foliageGeometry1) foliageGeometry1.dispose();
  if (foliageGeometry2) foliageGeometry2.dispose();
  if (foliageGeometry3) foliageGeometry3.dispose();
  
  // Dispose materials
  if (trunkMaterial) trunkMaterial.dispose();
  if (foliageMaterial1) foliageMaterial1.dispose();
  if (foliageMaterial2) foliageMaterial2.dispose();
  if (foliageMaterial3) foliageMaterial3.dispose();
  
  trees = [];
  fallingTrees = [];
  
  trunkInstancedMesh = null;
  foliageInstancedMesh1 = null;
  foliageInstancedMesh2 = null;
  foliageInstancedMesh3 = null;
  
  console.log('Tree system disposed');
}
