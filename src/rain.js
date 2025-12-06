/**
 * Rain Particle System using Instanced Mesh
 * High-performance rain visualization
 */

import * as THREE from 'three';
import { terrainConfig } from './terrain.js';

// Rain system variables
let rainMesh = null;
let rainGeometry = null;
let rainMaterial = null;
let rainCount = 0;
let isRaining = false;
let rainIntensity = 50;
let scene = null;

// Instance attributes
let instanceMatrix = null;
let instanceColor = null;
let velocities = [];
let positions = [];

// Rain configuration
const RAIN_CONFIG = {
    maxParticles: 5000,      // Maximum rain drops
    minParticles: 500,       // Minimum rain drops
    areaWidth: 80,           // Rain area width
    areaDepth: 120,          // Rain area depth
    heightMin: 50,           // Rain spawn height minimum
    heightMax: 80,           // Rain spawn height maximum
    dropLength: 0.8,         // Length of rain drop
    dropWidth: 0.02,         // Width of rain drop
    baseSpeed: 0.8,          // Base fall speed
    speedVariation: 0.3,     // Speed variation
    windX: 0.02,             // Wind effect X
    windZ: 0.05,             // Wind effect Z (toward camera)
    color: 0x88aacc,         // Rain color
    opacity: 0.6             // Rain opacity
};

// Splash system for ground impact
let splashPool = [];
let activeSplashes = [];
const MAX_SPLASHES = 100;

// Splash geometry and material (shared)
let splashGeometry = null;
let splashMaterial = null;

/**
 * Initialize rain system
 */
export function initRainSystem(sceneRef) {
    scene = sceneRef;
    
    // Create rain drop geometry (thin elongated box for rain streak)
    rainGeometry = new THREE.BoxGeometry(
        RAIN_CONFIG.dropWidth, 
        RAIN_CONFIG.dropLength, 
        RAIN_CONFIG.dropWidth
    );
    
    // Create rain material
    rainMaterial = new THREE.MeshBasicMaterial({
        color: RAIN_CONFIG.color,
        transparent: true,
        opacity: RAIN_CONFIG.opacity,
        depthWrite: false
    });
    
    // Create instanced mesh
    rainMesh = new THREE.InstancedMesh(
        rainGeometry, 
        rainMaterial, 
        RAIN_CONFIG.maxParticles
    );
    rainMesh.frustumCulled = false;
    rainMesh.visible = false;
    
    // Initialize instance data
    const dummy = new THREE.Object3D();
    for (let i = 0; i < RAIN_CONFIG.maxParticles; i++) {
        // Random position
        const x = (Math.random() - 0.5) * RAIN_CONFIG.areaWidth;
        const y = RAIN_CONFIG.heightMin + Math.random() * (RAIN_CONFIG.heightMax - RAIN_CONFIG.heightMin);
        const z = (Math.random() - 0.5) * RAIN_CONFIG.areaDepth;
        
        positions.push({ x, y, z });
        
        // Random velocity
        const speed = RAIN_CONFIG.baseSpeed + (Math.random() - 0.5) * RAIN_CONFIG.speedVariation;
        velocities.push({
            x: RAIN_CONFIG.windX * (0.5 + Math.random()),
            y: -speed,
            z: RAIN_CONFIG.windZ * (0.5 + Math.random())
        });
        
        // Set initial matrix
        dummy.position.set(x, y, z);
        dummy.rotation.set(0, 0, Math.PI * 0.05); // Slight angle for rain
        dummy.updateMatrix();
        rainMesh.setMatrixAt(i, dummy.matrix);
    }
    
    rainMesh.instanceMatrix.needsUpdate = true;
    scene.add(rainMesh);
    
    // Initialize splash system
    initSplashSystem();
    
    console.log('Rain system initialized with instanced mesh');
}

/**
 * Initialize splash effect pool
 */
function initSplashSystem() {
    // Splash geometry - small ring for ripple effect
    splashGeometry = new THREE.RingGeometry(0.1, 0.3, 8);
    splashGeometry.rotateX(-Math.PI / 2); // Lay flat
    
    splashMaterial = new THREE.MeshBasicMaterial({
        color: 0xaaccee,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
        depthWrite: false
    });
    
    // Pre-create splash meshes
    for (let i = 0; i < MAX_SPLASHES; i++) {
        const splash = new THREE.Mesh(splashGeometry, splashMaterial.clone());
        splash.visible = false;
        splash.userData = {
            active: false,
            age: 0,
            maxAge: 0.3 // Splash duration in seconds
        };
        scene.add(splash);
        splashPool.push(splash);
    }
}

/**
 * Start rain with given intensity
 */
export function startRain(intensity = 50) {
    rainIntensity = intensity;
    isRaining = true;
    
    // Calculate particle count based on intensity
    const intensityFactor = intensity / 100;
    rainCount = Math.floor(
        RAIN_CONFIG.minParticles + 
        (RAIN_CONFIG.maxParticles - RAIN_CONFIG.minParticles) * intensityFactor
    );
    
    // Update material opacity based on intensity
    rainMaterial.opacity = RAIN_CONFIG.opacity * (0.5 + intensityFactor * 0.5);
    
    rainMesh.visible = true;
    rainMesh.count = rainCount;
    
    console.log(`Rain started with ${rainCount} particles (intensity: ${intensity}%)`);
}

/**
 * Update rain intensity
 */
export function setRainIntensity(intensity) {
    rainIntensity = intensity;
    
    if (isRaining) {
        const intensityFactor = intensity / 100;
        rainCount = Math.floor(
            RAIN_CONFIG.minParticles + 
            (RAIN_CONFIG.maxParticles - RAIN_CONFIG.minParticles) * intensityFactor
        );
        
        rainMaterial.opacity = RAIN_CONFIG.opacity * (0.5 + intensityFactor * 0.5);
        rainMesh.count = rainCount;
        
        // Adjust wind based on intensity
        RAIN_CONFIG.windX = 0.02 * intensityFactor;
        RAIN_CONFIG.windZ = 0.05 * intensityFactor;
    }
}

/**
 * Stop rain
 */
export function stopRain() {
    isRaining = false;
    rainMesh.visible = false;
    rainMesh.count = 0;
    
    // Clear all splashes
    activeSplashes.forEach(splash => {
        splash.visible = false;
        splash.userData.active = false;
    });
    activeSplashes = [];
    
    console.log('Rain stopped');
}

/**
 * Update rain system (call every frame)
 */
export function updateRain(deltaTime) {
    if (!isRaining || !rainMesh) return;
    
    const dummy = new THREE.Object3D();
    const intensityFactor = rainIntensity / 100;
    
    // Terrain bounds
    const halfWidth = terrainConfig.halfWidth;
    const halfDepth = terrainConfig.halfDepth;
    
    for (let i = 0; i < rainCount; i++) {
        const pos = positions[i];
        const vel = velocities[i];
        
        // Update position with delta time
        const speedMult = 60 * deltaTime; // Normalize to 60 FPS
        pos.x += vel.x * speedMult;
        pos.y += vel.y * speedMult;
        pos.z += vel.z * speedMult;
        
        // Check if rain drop hit ground (approximate terrain height)
        // Use simple approximation - could be enhanced to use actual terrain height
        const groundLevel = getApproximateGroundLevel(pos.x, pos.z);
        
        if (pos.y <= groundLevel) {
            // Spawn splash effect
            if (Math.random() < 0.1 * intensityFactor) {
                spawnSplash(pos.x, groundLevel + 0.1, pos.z);
            }
            
            // Reset rain drop to top
            pos.y = RAIN_CONFIG.heightMin + Math.random() * (RAIN_CONFIG.heightMax - RAIN_CONFIG.heightMin);
            pos.x = (Math.random() - 0.5) * RAIN_CONFIG.areaWidth;
            pos.z = (Math.random() - 0.5) * RAIN_CONFIG.areaDepth;
            
            // Randomize velocity slightly
            vel.y = -(RAIN_CONFIG.baseSpeed + (Math.random() - 0.5) * RAIN_CONFIG.speedVariation);
        }
        
        // Wrap around horizontally
        if (pos.x > RAIN_CONFIG.areaWidth / 2) pos.x -= RAIN_CONFIG.areaWidth;
        if (pos.x < -RAIN_CONFIG.areaWidth / 2) pos.x += RAIN_CONFIG.areaWidth;
        if (pos.z > RAIN_CONFIG.areaDepth / 2) pos.z -= RAIN_CONFIG.areaDepth;
        if (pos.z < -RAIN_CONFIG.areaDepth / 2) pos.z += RAIN_CONFIG.areaDepth;
        
        // Update instance matrix
        dummy.position.set(pos.x, pos.y, pos.z);
        // Angle rain drops based on velocity
        dummy.rotation.set(
            Math.atan2(vel.z, -vel.y) * 0.3,
            0,
            Math.atan2(vel.x, -vel.y) * 0.3
        );
        dummy.updateMatrix();
        rainMesh.setMatrixAt(i, dummy.matrix);
    }
    
    rainMesh.instanceMatrix.needsUpdate = true;
    
    // Update splashes
    updateSplashes(deltaTime);
}

/**
 * Get approximate ground level at position
 */
function getApproximateGroundLevel(x, z) {
    // Simplified terrain height approximation
    // The actual terrain goes from peak (~35) to flat area (~0-2)
    const depthFrac = (z + terrainConfig.halfDepth) / terrainConfig.depth;
    
    if (depthFrac < terrainConfig.flatAreaStart) {
        // On slope - approximate height
        const slopeFrac = depthFrac / terrainConfig.flatAreaStart;
        return terrainConfig.peakHeight * (1 - slopeFrac) * 0.7;
    } else {
        // Flat area
        return 1;
    }
}

/**
 * Spawn splash effect at position
 */
function spawnSplash(x, y, z) {
    // Find inactive splash from pool
    const splash = splashPool.find(s => !s.userData.active);
    if (!splash) return;
    
    splash.position.set(x, y, z);
    splash.scale.set(0.3, 0.3, 0.3);
    splash.material.opacity = 0.5;
    splash.visible = true;
    splash.userData.active = true;
    splash.userData.age = 0;
    
    activeSplashes.push(splash);
}

/**
 * Update splash effects
 */
function updateSplashes(deltaTime) {
    for (let i = activeSplashes.length - 1; i >= 0; i--) {
        const splash = activeSplashes[i];
        splash.userData.age += deltaTime;
        
        const progress = splash.userData.age / splash.userData.maxAge;
        
        if (progress >= 1) {
            // Deactivate splash
            splash.visible = false;
            splash.userData.active = false;
            activeSplashes.splice(i, 1);
        } else {
            // Animate splash - grow and fade
            const scale = 0.3 + progress * 1.5;
            splash.scale.set(scale, scale, scale);
            splash.material.opacity = 0.5 * (1 - progress);
        }
    }
}

/**
 * Check if rain is currently active
 */
export function isRainActive() {
    return isRaining;
}

/**
 * Get current rain intensity
 */
export function getRainIntensity() {
    return rainIntensity;
}

/**
 * Cleanup rain system
 */
export function disposeRainSystem() {
    if (rainMesh) {
        scene.remove(rainMesh);
        rainGeometry.dispose();
        rainMaterial.dispose();
    }
    
    splashPool.forEach(splash => {
        scene.remove(splash);
        splash.material.dispose();
    });
    
    if (splashGeometry) splashGeometry.dispose();
    if (splashMaterial) splashMaterial.dispose();
    
    positions = [];
    velocities = [];
    splashPool = [];
    activeSplashes = [];
}
