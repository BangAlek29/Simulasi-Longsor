/**
 * Module untuk mengelola UI slider dan statistik
 * Versi simpel dan clean
 */

let treeCount = 12;
let brushRadius = 15;
let waterIntensity = 50; // 10-100 (debit air)
let physicsEnabled = true; // Physics mode toggle

// Callback untuk update water intensity
let onWaterIntensityChange = null;
// Callback untuk toggle physics mode
let onPhysicsToggle = null;

/**
 * Set callback untuk water intensity change
 */
export function setWaterIntensityCallback(callback) {
  onWaterIntensityChange = callback;
  // Panggil langsung dengan nilai saat ini
  if (callback) callback(waterIntensity);
}

/**
 * Set callback untuk physics toggle
 */
export function setPhysicsToggleCallback(callback) {
  onPhysicsToggle = callback;
  // Panggil langsung dengan nilai saat ini
  if (callback) callback(physicsEnabled);
}

/**
 * Check if physics is enabled
 */
export function isPhysicsEnabled() {
  return physicsEnabled;
}

/**
 * Initialize UI sliders dan event listeners
 */
export function initializeUI() {
  const treeCountSlider = document.getElementById('treeCountSlider');
  const radiusSlider = document.getElementById('radiusSlider');
  const waterIntensitySlider = document.getElementById('waterIntensitySlider');
  const physicsToggle = document.getElementById('physicsToggle');
  const treeCountValue = document.getElementById('treeCountValue');
  const radiusValue = document.getElementById('radiusValue');
  const waterIntensityValue = document.getElementById('waterIntensityValue');
  const physicsLabel = document.getElementById('physicsLabel');
  const physicsInfo = document.getElementById('physicsInfo');

  // Tree count slider
  if (treeCountSlider) {
    treeCountSlider.addEventListener('input', (e) => {
      treeCount = parseInt(e.target.value);
      if (treeCountValue) treeCountValue.textContent = treeCount;
    });
  }

  // Radius slider
  if (radiusSlider) {
    radiusSlider.addEventListener('input', (e) => {
      brushRadius = parseInt(e.target.value);
      if (radiusValue) radiusValue.textContent = brushRadius;
    });
  }

  // Water intensity slider
  if (waterIntensitySlider) {
    waterIntensitySlider.addEventListener('input', (e) => {
      waterIntensity = parseInt(e.target.value);
      if (waterIntensityValue) waterIntensityValue.textContent = waterIntensity + '%';
      // Trigger callback
      if (onWaterIntensityChange) onWaterIntensityChange(waterIntensity);
    });
  }

  // Physics toggle
  if (physicsToggle) {
    physicsToggle.addEventListener('change', (e) => {
      physicsEnabled = e.target.checked;
      
      // Update label and info
      if (physicsLabel) {
        physicsLabel.textContent = physicsEnabled ? 'Physics: ON' : 'Physics: OFF';
        physicsLabel.style.color = physicsEnabled ? '#7ed9a0' : '#888';
      }
      if (physicsInfo) {
        physicsInfo.textContent = physicsEnabled 
          ? 'Cannon.js physics engine aktif untuk simulasi realistis'
          : 'Mode klasik - simulasi berbasis partikel sederhana';
      }
      
      // Trigger callback
      if (onPhysicsToggle) onPhysicsToggle(physicsEnabled);
    });
  }
}

/**
 * Get water intensity (10-100)
 */
export function getWaterIntensity() {
  return waterIntensity;
}

/**
 * Dapatkan jumlah pohon yang akan ditambahkan
 */
export function getTreeCount() {
  return treeCount;
}

/**
 * Dapatkan radius area untuk menambah/menghapus pohon
 */
export function getBrushRadius() {
  return brushRadius;
}

/**
 * Set nilai slider secara programmatic
 */
export function setTreeCount(value) {
  treeCount = value;
  const slider = document.getElementById('treeCountSlider');
  const display = document.getElementById('treeCountValue');
  if (slider) slider.value = value;
  if (display) display.textContent = value;
}

export function setBrushRadius(value) {
  brushRadius = value;
  const slider = document.getElementById('radiusSlider');
  const display = document.getElementById('radiusValue');
  if (slider) slider.value = value;
  if (display) display.textContent = value;
}

/**
 * Update statistik rumah di UI
 */
export function updateHousesStats(stats) {
  const totalElement = document.getElementById('totalHouses');
  const healthyElement = document.getElementById('healthyHouses');
  const damagedElement = document.getElementById('damagedHouses');

  if (totalElement) totalElement.textContent = stats.total;
  if (healthyElement) healthyElement.textContent = stats.normal;
  if (damagedElement) damagedElement.textContent = stats.damaged;
  
  // Update SDG indicator
  updateSDGIndicators(stats);
}

/**
 * Update statistik lingkungan di UI
 */
export function updateEnvironmentStats(treesCount, stabilityAverage, activeLandslideCount, waterFlowing, damagedPercent, physicsParticleCount = 0) {
  const treeElement = document.getElementById('treeCount');
  const stabilityElement = document.getElementById('stabilityLevel');
  const landslideElement = document.getElementById('activeLandslides');
  const waterElement = document.getElementById('waterStatus');
  const damagedElement = document.getElementById('damagedArea');
  const physicsElement = document.getElementById('physicsParticles');

  if (treeElement) treeElement.textContent = treesCount;
  
  if (stabilityElement) {
    const stabilityPercent = Math.max(0, Math.round(stabilityAverage * 100));
    stabilityElement.textContent = stabilityPercent + '%';
    
    // Ubah warna berdasarkan stabilitas
    if (stabilityPercent > 60) {
      stabilityElement.className = 'stat-value';
    } else if (stabilityPercent > 30) {
      stabilityElement.className = 'stat-value warning';
    } else {
      stabilityElement.className = 'stat-value danger';
    }
  }

  if (landslideElement) {
    landslideElement.textContent = activeLandslideCount;
    landslideElement.className = activeLandslideCount > 0 ? 'stat-value danger' : 'stat-value';
  }

  if (waterElement) {
    waterElement.textContent = waterFlowing ? 'Aktif' : 'Mati';
    waterElement.style.color = waterFlowing ? '#4da6ff' : '#888';
  }

  if (damagedElement && damagedPercent !== undefined) {
    damagedElement.textContent = Math.round(damagedPercent) + '%';
    
    if (damagedPercent < 10) {
      damagedElement.className = 'stat-value';
    } else if (damagedPercent < 30) {
      damagedElement.className = 'stat-value warning';
    } else {
      damagedElement.className = 'stat-value danger';
    }
  }

  // Physics particle count
  if (physicsElement) {
    physicsElement.textContent = physicsParticleCount;
    physicsElement.style.color = physicsParticleCount > 0 ? '#4da6ff' : '#888';
  }
}

/**
 * Update SDG Indicators
 */
export function updateSDGIndicators(housesStats) {
  const safetyElement = document.getElementById('sdgSafety');
  
  if (housesStats && safetyElement) {
    const safePercent = housesStats.total > 0 
      ? Math.round((housesStats.normal / housesStats.total) * 100) 
      : 100;
    
    safetyElement.textContent = safePercent + '%';
    
    if (safePercent >= 80) {
      safetyElement.className = 'stat-value';
    } else if (safePercent >= 50) {
      safetyElement.className = 'stat-value warning';
    } else {
      safetyElement.className = 'stat-value danger';
    }
  }
}
