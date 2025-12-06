import * as THREE from 'three';
import { 
    terrain, 
    terrainConfig, 
    getTerrainHeightAt, 
    reduceStabilityAt, 
    getStabilityAt,
    isOnSlope,
    getDepthFraction
} from './terrain.js';
import { getTrees, getTreeProtectionAt } from './trees.js';

// Konstanta sistem air bah - OPTIMIZED untuk performa
const BASE_PARTICLE_COUNT = 80;         // Base jumlah partikel
const BASE_FLOW_SPEED = 0.35;           // Base kecepatan alir
const WATER_SPREAD = 1.2;               // Penyebaran air ke samping
const BASE_EROSION_RATE = 0.008;        // Base erosi tanpa pohon
const EROSION_RATE_WITH_TREE = 0.002;   // Erosi dengan pohon
const WATER_SIZE = 1.8;                 // Ukuran partikel air
const BASE_SPAWN_INTERVAL = 8;          // Base spawn interval
const EROSION_CHECK_INTERVAL = 3;       // Check erosi setiap N frame

// Variabel sistem air
let waterParticles = [];
let waterMesh = null;
let isWaterFlowing = false;
let frameCounter = 0;
let scene = null;
let currentIntensity = 50; // Default intensity

/**
 * Set water intensity (dipanggil dari luar)
 */
export function setWaterIntensity(intensity) {
    currentIntensity = intensity;
}

/**
 * Get current water parameters based on intensity
 */
function getWaterParams() {
    const intensity = currentIntensity; // 10-100
    const intensityFactor = intensity / 50; // 0.2 - 2.0
    
    return {
        maxParticles: Math.floor(BASE_PARTICLE_COUNT * intensityFactor),
        flowSpeed: BASE_FLOW_SPEED * (0.7 + intensityFactor * 0.5),
        erosionRate: BASE_EROSION_RATE * intensityFactor,
        spawnInterval: Math.max(2, Math.floor(BASE_SPAWN_INTERVAL / intensityFactor)),
        spawnCount: Math.max(1, Math.floor(intensityFactor * 2))
    };
}

/**
 * Water particle class - SIMPLIFIED
 */
class WaterParticle {
    constructor(x, y, z) {
        this.position = new THREE.Vector3(x, y, z);
        const params = getWaterParams();
        this.velocity = new THREE.Vector3(0, 0, params.flowSpeed);
        this.age = 0;
        this.maxAge = 300;
        this.active = true;
    }
}

/**
 * Initialize water system
 */
export function initWaterSystem(sceneRef) {
    scene = sceneRef;
    waterParticles = [];
    
    // Buat geometry untuk partikel air
    createWaterMesh();
    
    console.log('Water flow system initialized');
}

/**
 * Create water mesh (points system)
 */
function createWaterMesh() {
    const geometry = new THREE.BufferGeometry();
    
    // Max particles (untuk buffer) - gunakan base * 3 untuk mengakomodasi intensitas tinggi
    const maxParticles = BASE_PARTICLE_COUNT * 3;
    
    // Positions awal (akan diupdate)
    const positions = new Float32Array(maxParticles * 3);
    const colors = new Float32Array(maxParticles * 3);
    const sizes = new Float32Array(maxParticles);
    
    // Initialize dengan posisi di luar view
    for (let i = 0; i < maxParticles; i++) {
        positions[i * 3] = 0;
        positions[i * 3 + 1] = -100; // Sembunyikan di bawah
        positions[i * 3 + 2] = 0;
        
        // Warna air biru dengan variasi
        colors[i * 3] = 0.2 + Math.random() * 0.1;
        colors[i * 3 + 1] = 0.5 + Math.random() * 0.2;
        colors[i * 3 + 2] = 0.9 + Math.random() * 0.1;
        
        sizes[i] = WATER_SIZE;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    // Material untuk partikel air
    const material = new THREE.PointsMaterial({
        size: WATER_SIZE,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    
    waterMesh = new THREE.Points(geometry, material);
    waterMesh.visible = false;
    
    if (scene) {
        scene.add(waterMesh);
    }
}

/**
 * Start water flow dari puncak bukit
 */
export function startWaterFlow() {
    if (isWaterFlowing) return;
    
    isWaterFlowing = true;
    waterParticles = [];
    frameCounter = 0;
    
    if (waterMesh) {
        waterMesh.visible = true;
    }
    
    console.log('🌊 Water flow started from peak');
}

/**
 * Stop water flow
 */
export function stopWaterFlow() {
    isWaterFlowing = false;
    
    // Biarkan partikel yang ada menyelesaikan perjalanannya
    console.log('⏹️ Water flow stopped');
}

/**
 * Spawn partikel air baru di puncak bukit
 */
function spawnWaterParticle() {
    const params = getWaterParams();
    if (waterParticles.length >= params.maxParticles) return;
    
    // Spawn di area puncak (z negatif = belakang = puncak)
    // Lebar spawn disesuaikan dengan terrain yang lebih sempit
    const spawnX = (Math.random() - 0.5) * terrainConfig.width * 0.7;
    const spawnZ = -terrainConfig.depth / 2 + 5 + Math.random() * 10; // Dekat puncak
    const spawnY = getTerrainHeightAt(spawnX, spawnZ) + 0.5;
    
    const particle = new WaterParticle(spawnX, spawnY, spawnZ);
    
    // Tambahkan variasi arah awal
    particle.velocity.x = (Math.random() - 0.5) * WATER_SPREAD * 0.5;
    particle.velocity.z = params.flowSpeed * (0.8 + Math.random() * 0.4);
    
    waterParticles.push(particle);
}

/**
 * Update water system setiap frame - OPTIMIZED
 */
export function updateWaterSystem() {
    if (!waterMesh) return;
    
    frameCounter++;
    const params = getWaterParams();
    
    // Spawn partikel baru jika flow aktif
    if (isWaterFlowing && frameCounter % params.spawnInterval === 0) {
        for (let i = 0; i < params.spawnCount; i++) {
            spawnWaterParticle();
        }
    }
    
    // Update semua partikel
    const positions = waterMesh.geometry.attributes.position.array;
    const shouldCheckErosion = frameCounter % EROSION_CHECK_INTERVAL === 0;
    
    let activeCount = 0;
    
    for (let i = 0; i < waterParticles.length; i++) {
        const particle = waterParticles[i];
        
        if (!particle.active) continue;
        
        // Update age
        particle.age++;
        
        // Deactivate jika terlalu tua atau keluar bounds
        if (particle.age > particle.maxAge || 
            particle.position.z > terrainConfig.depth / 2 + 10 ||
            particle.position.y < -5) {
            particle.active = false;
            positions[i * 3 + 1] = -100; // Sembunyikan
            continue;
        }
        
        // Get terrain height di posisi saat ini
        const terrainY = getTerrainHeightAt(particle.position.x, particle.position.z);
        
        // SIMPLIFIED slope calculation (lebih ringan)
        const heightAhead = getTerrainHeightAt(
            particle.position.x,
            particle.position.z + 2
        );
        
        // Air mengalir mengikuti slope - simplified
        const slopeZ = terrainY - heightAhead;
        particle.velocity.z = params.flowSpeed + Math.max(0, slopeZ * 0.08);
        
        // Sedikit spread ke samping
        particle.velocity.x += (Math.random() - 0.5) * 0.05;
        particle.velocity.x *= 0.92; // Damping
        particle.velocity.x = Math.max(-WATER_SPREAD, Math.min(WATER_SPREAD, particle.velocity.x));
        
        // Update position
        particle.position.x += particle.velocity.x;
        particle.position.z += particle.velocity.z;
        
        // Snap ke terrain height
        particle.position.y = terrainY + 0.4;
        
        // Apply erosion (hanya pada interval tertentu untuk performa)
        if (shouldCheckErosion && isOnSlope(particle.position.z)) {
            applyWaterErosion(particle);
        }
        
        // Update buffer
        positions[i * 3] = particle.position.x;
        positions[i * 3 + 1] = particle.position.y;
        positions[i * 3 + 2] = particle.position.z;
        
        activeCount++;
    }
    
    // Cleanup inactive particles (lebih jarang)
    if (frameCounter % 30 === 0) {
        waterParticles = waterParticles.filter(p => p.active);
    }
    
    // Hide mesh jika tidak ada partikel aktif dan flow sudah stop
    if (activeCount === 0 && !isWaterFlowing) {
        waterMesh.visible = false;
    }
    
    waterMesh.geometry.attributes.position.needsUpdate = true;
}

/**
 * Apply water erosion pada tanah - SIMPLIFIED
 */
function applyWaterErosion(particle) {
    const x = particle.position.x;
    const z = particle.position.z;
    const params = getWaterParams();
    
    // Check apakah ada pohon di dekat area ini
    const treeProtection = getTreeProtectionAt(x, z);
    
    // Tentukan erosion rate berdasarkan ada/tidaknya pohon dan intensitas air
    let erosionRate = treeProtection > 0.1 ? EROSION_RATE_WITH_TREE : params.erosionRate;
    
    // Erosi lebih kuat di area tanpa proteksi pohon
    erosionRate *= (1 - treeProtection * 0.7);
    
    // Apply erosion ke stability map
    reduceStabilityAt(x, z, erosionRate, 2);
}

/**
 * Get water particle count (active)
 */
export function getActiveWaterCount() {
    return waterParticles.filter(p => p.active).length;
}

/**
 * Check if water is flowing
 */
export function isFlowing() {
    return isWaterFlowing || waterParticles.some(p => p.active);
}

/**
 * Reset water system
 */
export function resetWaterSystem() {
    isWaterFlowing = false;
    waterParticles = [];
    frameCounter = 0;
    
    if (waterMesh) {
        const positions = waterMesh.geometry.attributes.position.array;
        for (let i = 0; i < BASE_PARTICLE_COUNT * 3 * 3; i += 3) {
            positions[i + 1] = -100; // Hide all
        }
        waterMesh.geometry.attributes.position.needsUpdate = true;
        waterMesh.visible = false;
    }
}

/**
 * Get water data untuk collision detection
 */
export function getWaterData() {
    return {
        particles: waterParticles.filter(p => p.active),
        isFlowing: isWaterFlowing
    };
}
