import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createTerrain, getAverageStability, updateTerrainColors, getDamagedAreaPercent, stabilityMap } from './terrain.js';
import { createTrees, getTrees, getTreeCount, updateTreeStability } from './trees.js';
import { setupMouseInteraction, setAllTrees } from './interaction.js';
import { initializeUI, updateHousesStats, updateEnvironmentStats, setWaterIntensityCallback, setPhysicsToggleCallback, isPhysicsEnabled } from './ui.js';
import { initWaterSystem, updateWaterSystem, startWaterFlow, stopWaterFlow, isFlowing, setWaterIntensity } from './water.js';
import { initLandslideSystem, updateLandslide, getActiveLandslideCount, setLandslideCallback } from './landslide.js';
import { initHousesSystem, updateHouses, getHousesStats } from './houses.js';
import { initSimulationController, updateSimulation } from './simulation-controller.js';
import { 
    initPhysicsWorld, 
    updatePhysics, 
    setPhysicsWaterIntensity,
    getActivePhysicsWaterCount,
    getActivePhysicsDebrisCount,
    getActiveSoilChunksCount,
    getActiveMudCount,
    isPhysicsWaterFlowing,
    setPhysicsEnabled
} from './physics.js';

// New enhancement imports
import { initStats, beginStats, endStats } from './stats-monitor.js';
import { initEffects, renderWithEffects, updateEffectsSize } from './effects.js';
import { createSky, updateClouds } from './atmosphere.js';
import { cameraShake, goToPreset, CAMERA_PRESETS } from './animations.js';

// Audio and Rain imports
import { 
    initAudio, 
    startRain as startRainAudio, 
    stopRain as stopRainAudio, 
    updateRainIntensity as updateRainAudioIntensity,
    playLandslideSound,
    playTreeFallSound,
    playHouseCollapseSound,
    startWaterFlow as startWaterFlowAudio,
    stopWaterFlow as stopWaterFlowAudio,
    playThunder,
    resumeAudio
} from './audio.js';
import { 
    initRainSystem, 
    startRain as startRainVisual, 
    stopRain as stopRainVisual, 
    setRainIntensity as setRainVisualIntensity,
    updateRain,
    isRainActive
} from './rain.js';

let scene, camera, renderer, controls;
let terrainObject = null;
let initialTrees = null;
let usePostProcessing = true;
let composer = null;
let audioInitialized = false;
let thunderTimer = 0;

export function initScene() {
    scene = new THREE.Scene();
    // Background will be handled by sky dome
    scene.background = new THREE.Color(0x87CEEB);
    
    // Initialize Stats monitor (FPS)
    initStats();

    // Initialize UI
    initializeUI();
    
    // Connect water intensity callback (both old system, physics, rain visual and audio)
    setWaterIntensityCallback((intensity) => {
        setWaterIntensity(intensity);
        setPhysicsWaterIntensity(intensity);
        // Update rain visual and audio based on intensity
        if (isRainActive()) {
            setRainVisualIntensity(intensity);
            updateRainAudioIntensity(intensity);
        }
    });

    // Connect physics toggle callback
    setPhysicsToggleCallback((enabled) => {
        setPhysicsEnabled(enabled);
    });

    camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.1,
        2000
    );
    // Posisi kamera disesuaikan untuk terrain yang lebih sempit
    camera.position.set(60, 45, 70);
    camera.lookAt(0, 10, 0);

    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        powerPreference: 'high-performance'
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.body.appendChild(renderer.domElement);

    // Cahaya directional untuk pencahayaan terrain
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(80, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.far = 400;
    directionalLight.shadow.camera.left = -80;
    directionalLight.shadow.camera.right = 80;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    scene.add(directionalLight);

    // Cahaya ambient untuk pencahayaan keseluruhan
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    // Kontrol kamera dengan mouse (OrbitControls)
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = false;
    controls.target.set(0, 10, 0);
    controls.maxPolarAngle = Math.PI / 2.1; // Limit rotasi agar tidak bisa lihat dari bawah

    // Event listener untuk resize window
    window.addEventListener('resize', onWindowResize);

    // Buat terrain
    terrainObject = createTerrain(scene);

    // Buat pohon-pohon di area lereng
    initialTrees = createTrees(scene, terrainObject, 30);

    // Initialize water system (air bah)
    initWaterSystem(scene);
    
    // Initialize rain system (visual particles)
    initRainSystem(scene);

    // Initialize landslide system
    initLandslideSystem(scene);
    
    // Set landslide callback for camera shake and audio
    setLandslideCallback((intensity) => {
        cameraShake(camera, intensity, 0.5);
        playLandslideSound(intensity);
    });

    // Initialize houses system
    initHousesSystem(scene, terrainObject);

    // Initialize physics world (Cannon.js)
    initPhysicsWorld(scene);

    // Initialize simulation controller and connect rain/audio callbacks
    initSimulationController();
    
    // Import and set rain effect callbacks for simulation controller
    import('./simulation-controller.js').then(module => {
        module.setRainEffectCallbacks(
            (intensity) => {
                startRainVisual(intensity);
                if (audioInitialized) startRainAudio(intensity);
            },
            () => {
                stopRainVisual();
                if (audioInitialized) stopRainAudio();
            }
        );
        module.setWaterFlowAudioCallbacks(
            () => { if (audioInitialized) startWaterFlowAudio(); },
            () => { if (audioInitialized) stopWaterFlowAudio(); }
        );
    });

    // Setup interaksi mouse untuk menambah/menghapus pohon
    setAllTrees(initialTrees);
    setupMouseInteraction(camera, renderer, terrainObject, scene, initialTrees, stabilityMap);
    
    // Create enhanced sky and atmosphere
    createSky(scene);
    
    // Initialize post-processing effects
    try {
        composer = initEffects(renderer, scene, camera);
    } catch (e) {
        console.warn('Post-processing not available:', e);
        usePostProcessing = false;
    }
    
    // Add fog for depth
    scene.fog = new THREE.FogExp2(0x87CEEB, 0.003);
    
    // Setup audio initialization on first user interaction
    setupAudioInitialization();
    
    // Setup keyboard shortcuts for camera presets
    setupKeyboardShortcuts();
}

// Clock untuk physics timing
const clock = new THREE.Clock();
let elapsedTime = 0;

export function animate() {
    requestAnimationFrame(animate);
    
    // Stats begin
    beginStats();
    
    controls.update();

    // Get delta time for physics
    const deltaTime = Math.min(clock.getDelta(), 0.1);
    elapsedTime += deltaTime;

    // Update physics world (Cannon.js)
    updatePhysics(deltaTime);

    // Update water system (particle-based)
    updateWaterSystem();
    
    // Update rain visual system
    updateRain(deltaTime);
    
    // Random thunder during rain
    if (isRainActive() && audioInitialized) {
        thunderTimer += deltaTime;
        if (thunderTimer > 15 + Math.random() * 30) { // Thunder every 15-45 seconds
            playThunder(0.5 + Math.random() * 0.3);
            thunderTimer = 0;
        }
    }

    // Update tree stability (pohon terus memberikan stabilitas)
    updateTreeStability();

    // Update terrain colors berdasarkan stability
    updateTerrainColors();

    // Update simulation controller
    updateSimulation();

    // Update landslide system
    updateLandslide();

    // Update houses system (check collision dengan longsor)
    updateHouses();

    // Update UI stats setiap frame
    updateAllUIStats();
    
    // Update clouds animation
    updateClouds(elapsedTime * 1000);

    // Render with post-processing or normal
    if (usePostProcessing && composer) {
        renderWithEffects();
    } else {
        renderer.render(scene, camera);
    }
    
    // Stats end
    endStats();
}

/**
 * Setup audio initialization on first user interaction
 */
function setupAudioInitialization() {
    const initAudioOnInteraction = async () => {
        if (!audioInitialized) {
            await initAudio();
            await resumeAudio();
            audioInitialized = true;
            console.log('Audio system ready');
        }
    };
    
    // Initialize audio on first click/touch/keypress
    window.addEventListener('click', initAudioOnInteraction, { once: true });
    window.addEventListener('touchstart', initAudioOnInteraction, { once: true });
    window.addEventListener('keydown', initAudioOnInteraction, { once: true });
}

/**
 * Start rain (visual + audio)
 */
export function startRainEffect(intensity = 50) {
    startRainVisual(intensity);
    if (audioInitialized) {
        startRainAudio(intensity);
    }
}

/**
 * Stop rain (visual + audio)
 */
export function stopRainEffect() {
    stopRainVisual();
    if (audioInitialized) {
        stopRainAudio();
    }
    thunderTimer = 0;
}

/**
 * Play tree fall sound (exported for other modules)
 */
export function onTreeFall() {
    if (audioInitialized) {
        playTreeFallSound();
    }
}

/**
 * Play house collapse sound (exported for other modules)
 */
export function onHouseCollapse() {
    if (audioInitialized) {
        playHouseCollapseSound();
    }
}

/**
 * Update semua statistik UI setiap frame
 */
function updateAllUIStats() {
    // Statistik lingkungan
    const treesCount = getTreeCount();
    const stabilityAverage = getAverageStability();
    const activeLandslideCount = getActiveLandslideCount();
    // Combine both water systems status
    const waterFlowing = isFlowing() || isPhysicsWaterFlowing();
    const damagedPercent = getDamagedAreaPercent();
    // Physics particles count (water + debris)
    const physicsParticleCount = getActivePhysicsWaterCount() + getActivePhysicsDebrisCount();
    
    updateEnvironmentStats(treesCount, stabilityAverage, activeLandslideCount, waterFlowing, damagedPercent, physicsParticleCount);
    
    // Statistik rumah
    const housesStats = getHousesStats();
    updateHousesStats(housesStats);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    // Update post-processing size
    if (usePostProcessing) {
        updateEffectsSize(window.innerWidth, window.innerHeight);
    }
}

/**
 * Setup keyboard shortcuts for camera presets
 */
function setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
        // Number keys for camera presets
        switch(e.key) {
            case '1':
                goToPreset(camera, controls, 'overview');
                break;
            case '2':
                goToPreset(camera, controls, 'peak');
                break;
            case '3':
                goToPreset(camera, controls, 'settlement');
                break;
            case '4':
                goToPreset(camera, controls, 'side');
                break;
            case '5':
                goToPreset(camera, controls, 'top');
                break;
            case 'p':
            case 'P':
                // Toggle post-processing
                usePostProcessing = !usePostProcessing;
                console.log(`Post-processing: ${usePostProcessing ? 'ON' : 'OFF'}`);
                break;
        }
    });
}

/**
 * Trigger camera shake (exported for landslide events)
 */
export function triggerCameraShake(intensity = 0.5) {
    cameraShake(camera, intensity, 0.5);
}

// Export scene untuk digunakan modul lain
export function getScene() {
    return scene;
}