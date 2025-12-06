import * as THREE from 'three';
import { terrainConfig, isOnFlatArea, getTerrainHeightAt, isInsideTerrain } from './terrain.js';
import { getLandslidePositions } from './landslide.js';

// Penyimpanan rumah
let allHouses = [];
let housesGroup = new THREE.Group();

// Konstanta - disesuaikan dengan terrain yang lebih sempit
const HOUSE_SCALE = 1.5;
const FLAT_AREA_Z_START = 22;     // Area datar dimulai (sesuai terrainConfig.flatAreaStart)
const FLAT_AREA_Z_END = 45;       // Area datar berakhir (sedikit dikurangi)
const FLAT_AREA_X_START = -25;    // Area datar x (terrain width 60, half = 30, margin 5)
const FLAT_AREA_X_END = 25;       // Area datar x
const VILLAGE_RADIUS = 12;        // Radius cluster dikecilkan
const HOUSE_DAMAGE_THRESHOLD = 12; // Jarak untuk mendeteksi kerusakan dari longsor

/**
 * Data struktur House
 */
class House {
  constructor(position, meshGroup) {
    this.position = position.clone();
    this.meshGroup = meshGroup;
    this.originalPosition = position.clone();
    this.status = 'normal'; // 'normal', 'damaged'
    this.damageProgress = 0;
    this.originalRotation = new THREE.Euler().copy(meshGroup.rotation);
    this.originalScale = new THREE.Vector3().copy(meshGroup.scale);
    this.fallVelocity = 0;
    this.rotationAxis = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      0.1,
      (Math.random() - 0.5) * 2
    ).normalize();
  }

  reset() {
    this.status = 'normal';
    this.damageProgress = 0;
    this.fallVelocity = 0;
    this.meshGroup.position.copy(this.originalPosition);
    this.meshGroup.rotation.copy(this.originalRotation);
    this.meshGroup.scale.copy(this.originalScale);
    this.meshGroup.quaternion.identity();
    
    // Restore material colors
    this.meshGroup.traverse((child) => {
      if (child.isMesh && child.userData.originalColor) {
        child.material.color.setHex(child.userData.originalColor);
      }
    });
  }
}

/**
 * Buat single rumah dengan desain yang lebih realistis
 */
function createHouse(position) {
  const houseGroup = new THREE.Group();
  houseGroup.position.copy(position);

  // BANGUNAN UTAMA - Balok kubus untuk rumah (lebih sederhana dan realistis)
  const buildingGeometry = new THREE.BoxGeometry(2.5, 2, 2.5);
  const buildingMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xD4A574,    // Warna tanah/batu cerah
    roughness: 0.8,
    metalness: 0
  });
  const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
  building.position.y = 1;  // Setengah tinggi bangunan
  building.castShadow = true;
  building.receiveShadow = true;
  building.userData.originalColor = 0xD4A574;
  houseGroup.add(building);

  // ATAP - Piramida segitiga (pyramidal roof) - DIPERBAIKI TINGGI & ROTASI
// ATAP - Piramida segitiga (pyramidal roof) - DIPERBAIKI POSISI & ROTASI
  const roofGeometry = new THREE.ConeGeometry(2.1, 1.8, 4); // 4-sided pyramid, ukuran disesuaikan
  const roofMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xC41E3A,    // Merah cerah untuk atap
    roughness: 0.7,
    metalness: 0
  });
  const roof = new THREE.Mesh(roofGeometry, roofMaterial);
  roof.position.y = 2.9;  // Posisi di atas bangunan
  roof.rotation.y = Math.PI / 4;  // Putar sumbu Y 45 derajat agar sisi atap sejajar dengan dinding
  roof.castShadow = true;
  roof.receiveShadow = true;
  roof.userData.originalColor = 0xC41E3A;
  houseGroup.add(roof);

  // PINTU - Bentuk sederhana 
  const doorGeometry = new THREE.BoxGeometry(0.6, 1.2, 0.08);
  const doorMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x654321,    // Cokelat gelap untuk pintu kayu
    roughness: 0.9,
    metalness: 0
  });
  const door = new THREE.Mesh(doorGeometry, doorMaterial);
  door.position.set(0, 0.9, 1.28);
  door.castShadow = true;
  door.userData.originalColor = 0x654321;
  houseGroup.add(door);

  // JENDELA KIRI - Kecil dan sederhana
  const windowGeometry = new THREE.BoxGeometry(0.4, 0.4, 0.08);
  const windowMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x87CEEB,    // Biru cerah untuk kaca
    roughness: 0.2,
    metalness: 0.3,
    emissive: 0x4da6ff  // Sedikit bersinar
  });
  
  const windowLeft = new THREE.Mesh(windowGeometry, windowMaterial);
  windowLeft.position.set(-0.7, 1.5, 1.28);
  windowLeft.userData.originalColor = 0x87CEEB;
  houseGroup.add(windowLeft);

  // JENDELA KANAN
  const windowRight = windowLeft.clone();
  windowRight.position.set(0.7, 1.5, 1.28);
  houseGroup.add(windowRight);

  // CEROBONG ASAP SEDERHANA (chimney)
  const chimneyGeometry = new THREE.BoxGeometry(0.3, 1.2, 0.3);
  const chimneyMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x8B4513,    // Cokelat untuk cerobong
    roughness: 0.8,
    metalness: 0
  });
  const chimney = new THREE.Mesh(chimneyGeometry, chimneyMaterial);
  chimney.position.set(0.8, 2.5, -0.5);
  chimney.castShadow = true;
  houseGroup.add(chimney);

  houseGroup.scale.set(HOUSE_SCALE, HOUSE_SCALE, HOUSE_SCALE);

  return houseGroup;
}

/**
 * Buat cluster rumah-rumah (perumahan)
 */
export function createVillage(scene, terrain, count = 8) {
  // Random cluster center di area datar
  const clusterX = FLAT_AREA_X_START + Math.random() * (FLAT_AREA_X_END - FLAT_AREA_X_START);
  const clusterZ = FLAT_AREA_Z_START + Math.random() * (FLAT_AREA_Z_END - FLAT_AREA_Z_START);

  const raycaster = new THREE.Raycaster();
  const downDirection = new THREE.Vector3(0, -1, 0);

  for (let i = 0; i < count; i++) {
    // Random posisi dalam radius cluster
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * VILLAGE_RADIUS;
    const x = clusterX + Math.cos(angle) * distance;
    const z = clusterZ + Math.sin(angle) * distance;

    // Pastikan posisi berada dalam flat area
    if (x >= FLAT_AREA_X_START && x <= FLAT_AREA_X_END &&
        z >= FLAT_AREA_Z_START && z <= FLAT_AREA_Z_END) {
      
      // Gunakan raycasting untuk mendapatkan height terrain yang tepat
      const rayOrigin = new THREE.Vector3(x, 150, z);
      raycaster.set(rayOrigin, downDirection);
      const intersects = raycaster.intersectObject(terrain);

      let houseY = 0.8;
      if (intersects.length > 0) {
        houseY = intersects[0].point.y + 0.1;
      }

      const housePosition = new THREE.Vector3(x, houseY, z);
      addHouse(scene, housePosition);
    }
  }
}

/**
 * Tambahkan rumah individual - dengan validasi batas terrain
 */
export function addHouse(scene, position) {
  // Validasi: pastikan posisi dalam batas terrain
  if (!isInsideTerrain(position.x, position.z)) {
    console.log('Tidak bisa menambahkan rumah di luar terrain');
    return null;
  }
  
  // Validasi: pastikan posisi dalam flat area
  if (position.x < FLAT_AREA_X_START || position.x > FLAT_AREA_X_END ||
      position.z < FLAT_AREA_Z_START || position.z > FLAT_AREA_Z_END) {
    console.log('Rumah hanya bisa dibangun di area datar (pemukiman)');
    return null;
  }

  const houseGeometry = createHouse(position);
  housesGroup.add(houseGeometry);
  scene.add(housesGroup);

  const house = new House(position, houseGeometry);
  allHouses.push(house);

  return house;
}

/**
 * Hapus rumah terdekat dari posisi tertentu
 */
export function removeNearestHouse(position, radius = 20) {
  let nearestHouse = null;
  let nearestDistance = radius;

  // Cari rumah terdekat dalam radius
  allHouses.forEach((house) => {
    const distance = house.meshGroup.position.distanceTo(position);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestHouse = house;
    }
  });

  // Hapus rumah jika ditemukan
  if (nearestHouse) {
    housesGroup.remove(nearestHouse.meshGroup);
    const index = allHouses.indexOf(nearestHouse);
    if (index > -1) {
      allHouses.splice(index, 1);
    }
    console.log(`Rumah dihapus. Total rumah: ${allHouses.length}`);
    return true;
  }

  return false;
}

/**
 * Dapatkan jumlah rumah saat ini
 */
export function getHouseCount() {
  return allHouses.length;
}

/**
 * Initialize houses system
 */
export function initHousesSystem(scene, terrain) {
  housesGroup = new THREE.Group();
  allHouses = [];
  scene.add(housesGroup);
  
  // Buat 2-3 cluster rumah-rumah di area datar
  createVillage(scene, terrain, 8);
  createVillage(scene, terrain, 7);
  createVillage(scene, terrain, 6);

  console.log(`Houses system initialized with ${allHouses.length} houses`);
}

/**
 * Check collision dengan longsor dan update status rumah
 */
export function checkLandslideCollision() {
  const landslideData = getLandslidePositions();
  
  allHouses.forEach(house => {
    if (house.status === 'damaged') return;
    
    landslideData.forEach(landslide => {
      // Hanya check jika longsor sudah mencapai area datar
      if (landslide.progress < 0.3) return;
      
      const dx = house.meshGroup.position.x - landslide.position.x;
      const dz = house.meshGroup.position.z - landslide.position.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      
      // Check apakah rumah dalam radius longsor
      if (distance < HOUSE_DAMAGE_THRESHOLD + landslide.progress * 10) {
        house.status = 'damaged';
        console.log('🏚️ Rumah terkena longsor!');
        
        // Ubah warna material menjadi gelap (rusak)
        house.meshGroup.traverse(child => {
          if (child.isMesh) {
            child.material.color.setHex(0x555555);
          }
        });
      }
    });
  });
}

/**
 * Animate rumah yang rusak (roboh)
 */
export function animateDamagedHouses() {
  allHouses.forEach(house => {
    if (house.status === 'damaged' && house.damageProgress < 1) {
      house.damageProgress += 0.015;
      
      if (house.damageProgress <= 1) {
        // Rotasi roboh
        const tiltAngle = house.damageProgress * Math.PI * 0.45;
        const rotation = new THREE.Quaternion();
        rotation.setFromAxisAngle(house.rotationAxis, tiltAngle);
        house.meshGroup.quaternion.copy(rotation);
        
        // Jatuh ke bawah
        house.fallVelocity += 0.008;
        house.meshGroup.position.y -= house.fallVelocity;
        
        // Stop di tanah
        if (house.meshGroup.position.y <= -0.5) {
          house.meshGroup.position.y = -0.5;
          house.damageProgress = 1;
        }
      }
    }
  });
}

/**
 * Update semua rumah (dipanggil setiap frame)
 */
export function updateHouses() {
  // Check collision dengan longsor
  checkLandslideCollision();
  
  // Animate damaged houses
  animateDamagedHouses();
}

/**
 * Get semua rumah (untuk debug/stats)
 */
export function getAllHouses() {
  return allHouses;
}

/**
 * Get rumah stats
 */
export function getHousesStats() {
  const stats = {
    total: allHouses.length,
    normal: 0,
    damaged: 0
  };

  allHouses.forEach((house) => {
    if (house.status === 'normal') stats.normal++;
    else if (house.status === 'damaged') stats.damaged++;
  });

  return stats;
}

/**
 * Reset semua rumah
 */
export function resetHouses() {
  allHouses.forEach((house) => {
    house.reset();
  });
}
