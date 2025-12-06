import * as THREE from 'three';
import { 
    terrain, 
    stabilityMap, 
    stabilityGridWidth, 
    stabilityGridHeight,
    gridToWorld,
    worldToGrid,
    getTerrainHeightAt,
    terrainConfig,
    getDepthFraction
} from './terrain.js';
import { knockdownTreesInArea } from './trees.js';
import { spawnLandslideDebris } from './physics.js';

// Camera shake callback (will be set from scene.js)
let onLandslideTriggered = null;

/**
 * Set callback for landslide events
 */
export function setLandslideCallback(callback) {
    onLandslideTriggered = callback;
}

// Landslide system variables
let activeLandslides = [];
let scene = null;

// Konstanta - DIOPTIMALKAN untuk performa lebih ringan
const STABILITY_THRESHOLD = 0.3;      // Threshold untuk memicu longsor
const LANDSLIDE_SPEED = 0.012;        // Kecepatan animasi longsor (LEBIH LAMBAT untuk efek gradual)
const DEBRIS_PARTICLE_COUNT = 15;     // DIKURANGI lagi - hanya sedikit partikel tanah lepas
const LANDSLIDE_RADIUS = 8;           // Radius area longsor (dikecilkan sedikit)
const CHECK_INTERVAL = 50;            // DITINGKATKAN interval check (lebih jarang)

let frameCounter = 0;

// Single shared debris geometry untuk semua longsor (lebih efisien)
let sharedDebrisGeometry = null;
let sharedDebrisMaterial = null;

/**
 * Landslide data structure
 */
class Landslide {
    constructor(gridX, gridZ, worldPos) {
        this.gridX = gridX;
        this.gridZ = gridZ;
        this.position = worldPos.clone();
        this.startPosition = worldPos.clone();
        this.vertices = [];           // Indices vertex yang terpengaruh
        this.originalHeights = [];    // Tinggi asli vertex
        this.progress = 0;            // 0 sampai 1
        this.active = true;
        this.debrisSystem = null;
        this.reachedFlat = false;     // Sudah sampai dataran?
    }
}

/**
 * Initialize landslide system
 */
export function initLandslideSystem(sceneRef) {
    scene = sceneRef;
    activeLandslides = [];
    frameCounter = 0;
    
    // Create shared materials (reused untuk semua debris - lebih efisien)
    sharedDebrisMaterial = new THREE.PointsMaterial({
        color: 0x8B4513,
        size: 1.2,
        transparent: true,
        opacity: 0.85,
        sizeAttenuation: true
    });
    
    console.log('Landslide system initialized (optimized)');
}

/**
 * Update landslide system (dipanggil setiap frame)
 */
export function updateLandslide() {
    if (!terrain || !scene) return;
    
    frameCounter++;
    
    // Check untuk longsor baru secara periodik
    if (frameCounter % CHECK_INTERVAL === 0) {
        scanForNewLandslides();
    }
    
    // Update active landslides
    activeLandslides.forEach(landslide => {
        if (landslide.active) {
            updateActiveLandslide(landslide);
        }
    });
    
    // Update debris particles
    updateAllDebris();
    
    // Cleanup completed landslides
    activeLandslides = activeLandslides.filter(ls => ls.active || ls.progress < 1.0);
}

/**
 * Scan stability map untuk menemukan area yang perlu longsor
 */
function scanForNewLandslides() {
    const scanStep = 4; // Scan setiap 4 grid cells
    
    for (let gx = 0; gx < stabilityGridWidth; gx += scanStep) {
        for (let gz = 0; gz < stabilityGridHeight; gz += scanStep) {
            if (!stabilityMap[gx] || stabilityMap[gx][gz] === undefined) continue;
            
            const stability = stabilityMap[gx][gz];
            
            // Trigger longsor jika stabilitas rendah
            if (stability < STABILITY_THRESHOLD && stability > 0) {
                // Check apakah sudah ada longsor di area ini
                const worldPos = gridToWorld(gx, gz);
                worldPos.y = getTerrainHeightAt(worldPos.x, worldPos.z);
                
                // Hanya di area lereng (bukan dataran)
                const depthFrac = getDepthFraction(worldPos.z);
                if (depthFrac >= terrainConfig.flatAreaStart) continue;
                
                const alreadyExists = activeLandslides.some(ls => {
                    const dx = ls.gridX - gx;
                    const dz = ls.gridZ - gz;
                    return Math.sqrt(dx*dx + dz*dz) < 8;
                });
                
                if (!alreadyExists) {
                    triggerLandslide(gx, gz, new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z));
                }
            }
        }
    }
}

/**
 * Trigger longsor baru
 */
function triggerLandslide(gridX, gridZ, worldPos) {
    const landslide = new Landslide(gridX, gridZ, worldPos);
    
    // Temukan vertices yang terpengaruh
    const geometry = terrain.geometry;
    const positions = geometry.attributes.position;
    
    for (let i = 0; i < positions.count; i++) {
        const vx = positions.getX(i);
        const vy = positions.getY(i);
        const vz = positions.getZ(i);
        
        const dx = vx - worldPos.x;
        const dz = vz - worldPos.z;
        const dist = Math.sqrt(dx*dx + dz*dz);
        
        // Vertex dalam radius dan di area lereng
        if (dist < LANDSLIDE_RADIUS && vy > 2) {
            landslide.vertices.push(i);
            landslide.originalHeights.push(vy);
        }
    }
    
    if (landslide.vertices.length > 0) {
        // Tumbangkan pohon di area longsor
        knockdownTreesInArea(worldPos, LANDSLIDE_RADIUS, scene);
        
        // Create debris particles (visual - lebih ringan)
        createDebrisForLandslide(landslide);
        
        // Spawn physics-based debris (realistic tumbling)
        spawnLandslideDebris(worldPos, Math.floor(DEBRIS_PARTICLE_COUNT * 0.8));
        
        activeLandslides.push(landslide);
        
        // Trigger camera shake effect
        if (onLandslideTriggered) {
            onLandslideTriggered(0.3 + landslide.vertices.length * 0.01);
        }
        
        console.log(`🏔️ Longsor triggered at (${worldPos.x.toFixed(1)}, ${worldPos.z.toFixed(1)}) with ${landslide.vertices.length} vertices`);
    }
}

/**
 * Create debris particles untuk longsor - LEBIH NATURAL
 * Hanya sedikit partikel tanah yang lepas, bukan banyak
 */
function createDebrisForLandslide(landslide) {
    const particles = [];
    
    // Sedikit partikel - hanya tanah yang benar-benar lepas
    for (let i = 0; i < DEBRIS_PARTICLE_COUNT; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * LANDSLIDE_RADIUS * 0.5;
        
        particles.push({
            position: new THREE.Vector3(
                landslide.position.x + Math.cos(angle) * radius,
                landslide.position.y + 0.5 + Math.random() * 1.5, // Tidak terlalu tinggi
                landslide.position.z + Math.sin(angle) * radius
            ),
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.1,  // Sedikit gerak horizontal
                Math.random() * 0.05,          // Sedikit bounce
                0.15 + Math.random() * 0.15    // Bergerak ke depan perlahan
            ),
            age: 0,
            maxAge: 100 + Math.random() * 60, // Lifetime lebih pendek
            active: true
        });
    }
    
    // Create Three.js points untuk debris - gunakan shared material
    const geometry = new THREE.BufferGeometry();
    const positionsArray = new Float32Array(DEBRIS_PARTICLE_COUNT * 3);
    
    particles.forEach((p, i) => {
        positionsArray[i * 3] = p.position.x;
        positionsArray[i * 3 + 1] = p.position.y;
        positionsArray[i * 3 + 2] = p.position.z;
    });
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positionsArray, 3));
    
    const mesh = new THREE.Points(geometry, sharedDebrisMaterial);
    scene.add(mesh);
    
    landslide.debrisSystem = {
        particles,
        mesh,
        geometry
    };
}

/**
 * Update active landslide - EFEK GRADUAL & REALISTIS
 * Tanah terkikis perlahan dan menyatu dengan terrain sekitarnya
 */
function updateActiveLandslide(landslide) {
    landslide.progress += LANDSLIDE_SPEED;
    
    if (landslide.progress >= 1.0) {
        landslide.active = false;
        landslide.progress = 1.0;
    }
    
    const geometry = terrain.geometry;
    const positions = geometry.attributes.position;
    const colors = geometry.attributes.color;
    
    // Update vertex positions - erosi GRADUAL, bukan lubang langsung
    landslide.vertices.forEach((vertexIndex, idx) => {
        const originalHeight = landslide.originalHeights[idx];
        const vx = positions.getX(vertexIndex);
        const vz = positions.getZ(vertexIndex);
        
        // Hitung jarak dari pusat longsor
        const dx = vx - landslide.position.x;
        const dz = vz - landslide.position.z;
        const distFromCenter = Math.sqrt(dx * dx + dz * dz);
        
        // Faktor jarak - semakin jauh dari pusat, semakin kecil efeknya
        const distanceFactor = 1 - (distFromCenter / LANDSLIDE_RADIUS);
        const smoothFactor = Math.max(0, distanceFactor * distanceFactor); // Smooth falloff
        
        // Erosi GRADUAL - maksimal hanya 2-3 unit turun, bukan 8
        // Efek lebih kuat di pusat, melemah ke pinggir
        const maxErosion = 2.5 * smoothFactor;
        const currentErosion = landslide.progress * maxErosion;
        
        // Hitung height baru - turun perlahan
        const newHeight = Math.max(originalHeight * 0.7, originalHeight - currentErosion);
        
        positions.setY(vertexIndex, newHeight);
        
        // Ubah warna GRADUAL - dari hijau ke coklat muda, bukan langsung gelap
        const erosionIntensity = (currentErosion / maxErosion) * smoothFactor;
        
        // Blend dari hijau (0.18, 0.55, 0.18) ke coklat muda (0.55, 0.4, 0.25)
        const greenR = 0.18, greenG = 0.55, greenB = 0.18;
        const brownR = 0.55, brownG = 0.4, brownB = 0.25;
        
        const blendR = greenR + (brownR - greenR) * erosionIntensity * 0.7;
        const blendG = greenG + (brownG - greenG) * erosionIntensity * 0.7;
        const blendB = greenB + (brownB - greenB) * erosionIntensity * 0.7;
        
        colors.setXYZ(vertexIndex, blendR, blendG, blendB);
    });
    
    positions.needsUpdate = true;
    colors.needsUpdate = true;
    geometry.computeVertexNormals();
    
    // Update debris particles
    if (landslide.debrisSystem) {
        updateDebrisSystem(landslide.debrisSystem, landslide);
    }
    
    // Check apakah sudah sampai area dataran
    const currentZ = landslide.position.z + landslide.progress * 15;
    const depthFrac = getDepthFraction(currentZ);
    if (depthFrac >= terrainConfig.flatAreaStart && !landslide.reachedFlat) {
        landslide.reachedFlat = true;
        console.log('⚠️ Longsor mencapai area pemukiman!');
    }
}

/**
 * Update debris system - LEBIH NATURAL
 * Partikel bergerak perlahan dan menyatu dengan tanah
 */
function updateDebrisSystem(debrisSystem, landslide) {
    const positions = debrisSystem.geometry.attributes.position.array;
    let activeCount = 0;
    
    debrisSystem.particles.forEach((particle, i) => {
        if (!particle.active) return;
        
        particle.age++;
        
        if (particle.age > particle.maxAge) {
            particle.active = false;
            positions[i * 3 + 1] = -100; // Hide
            return;
        }
        
        // Gravity lebih lemah (partikel tanah berat, jatuh langsung)
        particle.velocity.y -= 0.008;
        
        // Move - lebih lambat
        particle.position.x += particle.velocity.x;
        particle.position.y += particle.velocity.y;
        particle.position.z += particle.velocity.z;
        
        // Ground collision - langsung menyatu dengan tanah
        const groundY = getTerrainHeightAt(particle.position.x, particle.position.z);
        if (particle.position.y < groundY + 0.1) {
            particle.position.y = groundY + 0.1;
            particle.velocity.y = 0; // Tidak bounce, langsung diam
            particle.velocity.x *= 0.7;
            particle.velocity.z *= 0.7;
            
            // Fade out setelah menyentuh tanah
            particle.maxAge = Math.min(particle.maxAge, particle.age + 30);
        }
        
        // Update buffer
        positions[i * 3] = particle.position.x;
        positions[i * 3 + 1] = particle.position.y;
        positions[i * 3 + 2] = particle.position.z;
        
        activeCount++;
    });
    
    debrisSystem.geometry.attributes.position.needsUpdate = true;
    
    return activeCount;
}

/**
 * Update all debris
 */
function updateAllDebris() {
    // Handled in updateActiveLandslide
}

/**
 * Get active landslides count
 */
export function getActiveLandslideCount() {
    return activeLandslides.filter(ls => ls.active).length;
}

/**
 * Get landslide data untuk collision detection dengan rumah
 */
export function getLandslideData() {
    const allDebris = [];
    
    activeLandslides.forEach(ls => {
        if (ls.debrisSystem) {
            ls.debrisSystem.particles.forEach(p => {
                if (p.active) {
                    allDebris.push({
                        position: p.position.clone()
                    });
                }
            });
        }
    });
    
    return {
        activeLandslides: activeLandslides,
        debrisParticles: allDebris
    };
}

/**
 * Get landslide positions untuk collision dengan rumah
 */
export function getLandslidePositions() {
    return activeLandslides.filter(ls => ls.active || ls.progress > 0.5).map(ls => ({
        position: ls.position.clone(),
        progress: ls.progress,
        radius: LANDSLIDE_RADIUS,
        reachedFlat: ls.reachedFlat
    }));
}

/**
 * Reset landslide system
 */
export function resetLandslideSystem() {
    // Remove all debris meshes
    activeLandslides.forEach(ls => {
        if (ls.debrisSystem && ls.debrisSystem.mesh) {
            scene.remove(ls.debrisSystem.mesh);
            ls.debrisSystem.geometry.dispose();
        }
    });
    
    activeLandslides = [];
    frameCounter = 0;
    
    console.log('Landslide system reset');
}
