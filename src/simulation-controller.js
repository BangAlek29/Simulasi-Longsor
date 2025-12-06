/**
 * Module untuk mengontrol simulasi air bah dan longsor
 * Menggunakan physics engine (Cannon.js) untuk simulasi realistis
 */

import { startWaterFlow, stopWaterFlow, isFlowing } from './water.js';
import { 
    startPhysicsWaterFlow, 
    stopPhysicsWaterFlow, 
    resetPhysics,
    isPhysicsWaterFlowing 
} from './physics.js';

// Rain and audio will be controlled from here
let startRainEffect = null;
let stopRainEffect = null;
let startWaterFlowAudio = null;
let stopWaterFlowAudio = null;

let isSimulationRunning = false;
let simulationDuration = 0;
let resetCallback = null;

/**
 * Initialize simulation controller
 */
export function initSimulationController() {
  setupSimulationButtons();
  console.log('Simulation controller initialized');
}

/**
 * Set rain effect callbacks (called from scene.js)
 */
export function setRainEffectCallbacks(startFn, stopFn) {
    startRainEffect = startFn;
    stopRainEffect = stopFn;
}

/**
 * Set water flow audio callbacks
 */
export function setWaterFlowAudioCallbacks(startFn, stopFn) {
    startWaterFlowAudio = startFn;
    stopWaterFlowAudio = stopFn;
}

/**
 * Set callback untuk reset world
 */
export function setResetCallback(callback) {
  resetCallback = callback;
}

/**
 * Setup event listeners untuk tombol simulasi
 */
function setupSimulationButtons() {
  const toggleBtn = document.getElementById('toggleSimulationBtn');
  const resetBtn = document.getElementById('resetWorldBtn');
  const statusDiv = document.getElementById('simulationStatus');
  const statusMsg = document.getElementById('simulationMessage');

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      if (isSimulationRunning) {
        // Stop simulation
        stopSimulation();
        toggleBtn.textContent = 'Mulai';
        toggleBtn.classList.remove('running');
        if (statusDiv) statusDiv.classList.remove('active');
      } else {
        // Start simulation
        startSimulation();
        toggleBtn.textContent = 'Stop';
        toggleBtn.classList.add('running');
        if (statusDiv) statusDiv.classList.add('active');
        if (statusMsg) statusMsg.textContent = '🌧️ Hujan deras dan air bah mengalir...';
      }
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      // Stop simulation first
      if (isSimulationRunning) {
        stopSimulation();
        if (toggleBtn) {
          toggleBtn.textContent = 'Mulai';
          toggleBtn.classList.remove('running');
        }
        if (statusDiv) statusDiv.classList.remove('active');
      }
      
      // Reset world
      if (resetCallback) {
        resetCallback();
        console.log('🔄 World reset!');
      } else {
        // Fallback: reload page
        window.location.reload();
      }
    });
  }
}

/**
 * Mulai simulasi air bah
 */
export function startSimulation() {
  if (isSimulationRunning) return;
  
  isSimulationRunning = true;
  simulationDuration = 0;
  
  // Start rain effect (visual + audio)
  if (startRainEffect) {
    startRainEffect(50); // Start with 50% intensity
  }
  
  // Start water flow dari puncak (both systems)
  startWaterFlow();
  startPhysicsWaterFlow(); // Physics-based water
  
  // Start water flow audio
  if (startWaterFlowAudio) {
    startWaterFlowAudio();
  }
  
  console.log('🚨 SIMULASI DIMULAI: Hujan deras dan air bah dengan physics engine!');
}

/**
 * Hentikan simulasi
 */
export function stopSimulation() {
  isSimulationRunning = false;
  stopWaterFlow();
  stopPhysicsWaterFlow(); // Stop physics water
  
  // Stop rain effect (visual + audio)
  if (stopRainEffect) {
    stopRainEffect();
  }
  
  // Stop water flow audio
  if (stopWaterFlowAudio) {
    stopWaterFlowAudio();
  }
  
  console.log('⏹️ Simulasi dihentikan');
}

/**
 * Update simulasi setiap frame
 */
export function updateSimulation() {
  if (!isSimulationRunning) return;
  
  simulationDuration++;
  
  // Update status message berdasarkan progress
  const statusMsg = document.getElementById('simulationMessage');
  if (statusMsg) {
    if (simulationDuration < 100) {
      statusMsg.textContent = '🌧️ Hujan deras dimulai, air mengalir dari puncak...';
    } else if (simulationDuration < 300) {
      statusMsg.textContent = '💧 Air mengikis lereng bukit...';
    } else if (simulationDuration < 500) {
      statusMsg.textContent = '⚠️ Tanah mulai tidak stabil di area minim pohon...';
    } else {
      statusMsg.textContent = '🏔️ Longsor terjadi! Material bergerak ke pemukiman...';
    }
  }
}

/**
 * Check apakah simulasi sedang berjalan
 */
export function isSimulationActive() {
  return isSimulationRunning;
}

/**
 * Get simulation duration
 */
export function getSimulationDuration() {
  return simulationDuration;
}
