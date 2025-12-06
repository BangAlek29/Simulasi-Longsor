import * as THREE from 'three';

// Variabel untuk akses terrain di file lain
export let terrain;
export let stabilityMap = [];
export let stabilityGridWidth = 64;
export let stabilityGridHeight = 64;

// Terrain dimensions - Lebar dikecilkan, panjang tetap
const TERRAIN_WIDTH = 60;  // Dikecilkan dari 120
const TERRAIN_DEPTH = 100;
const TERRAIN_SEGMENTS_W = 50;
const TERRAIN_SEGMENTS_D = 70;

// Export untuk digunakan modul lain
export const terrainConfig = {
    width: TERRAIN_WIDTH,
    depth: TERRAIN_DEPTH,
    halfWidth: TERRAIN_WIDTH / 2,
    halfDepth: TERRAIN_DEPTH / 2,
    segmentsW: TERRAIN_SEGMENTS_W,
    segmentsD: TERRAIN_SEGMENTS_D,
    peakHeight: 35,
    flatAreaStart: 0.72  // depthFraction dimana area datar dimulai
};

/**
 * Check apakah posisi berada dalam batas terrain
 */
export function isInsideTerrain(x, z) {
    const halfW = TERRAIN_WIDTH / 2;
    const halfD = TERRAIN_DEPTH / 2;
    return x >= -halfW && x <= halfW && z >= -halfD && z <= halfD;
}

/**
 * Initialize stability map untuk setiap grid
 */
function initStabilityMap() {
    stabilityMap = [];
    for (let x = 0; x < stabilityGridWidth; x++) {
        stabilityMap[x] = [];
        for (let z = 0; z < stabilityGridHeight; z++) {
            stabilityMap[x][z] = 1.0; // Full stability
        }
    }
}

// Fungsi untuk membuat tekstur rumput bergaya kartun
function createGrassTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Warna dasar rumput hijau
    ctx.fillStyle = '#2d5a2d';
    ctx.fillRect(0, 0, 256, 256);

    // Tambahkan warna hijau muda untuk variasi
    for (let i = 0; i < 1500; i++) {
        const x = Math.random() * 256;
        const y = Math.random() * 256;
        const size = Math.random() * 3 + 1;
        const colors = ['#3d7a3d', '#4d9a4d', '#2d5a2d', '#1d4d1d'];
        ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
        ctx.fillRect(x, y, size, size);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(8, 8);
    return texture;
}

/**
 * Fungsi noise sederhana untuk variasi terrain
 */
function smoothNoise(x, z, scale = 0.01, amplitude = 1) {
    const nx = x * scale;
    const nz = z * scale;
    const noise = (Math.sin(nx * 0.5) * Math.cos(nz * 0.7) + 
                   Math.sin(nx * 0.3) * Math.cos(nz * 0.4) + 
                   Math.sin(nx * 0.8) * Math.cos(nz * 0.9)) / 3;
    return noise * amplitude;
}

export function createTerrain(scene) {
    // Initialize stability map
    initStabilityMap();
    
    const width = TERRAIN_WIDTH;
    const depth = TERRAIN_DEPTH;
    const widthSegments = TERRAIN_SEGMENTS_W;
    const depthSegments = TERRAIN_SEGMENTS_D;

    // Buat geometry bidang datar yang akan dimodifikasi
    const geometry = new THREE.PlaneGeometry(width, depth, widthSegments, depthSegments);

    // Miringkan terrain menjadi lereng (dari horizontal menjadi miring)
    geometry.rotateX(-Math.PI / 2);

    // Simpan referensi untuk diakses di modul lain
    geometry.userData.terrainDepth = depth;
    geometry.userData.terrainWidth = width;

    // Modifikasi vertices untuk membentuk bukit dengan kontur alami
    const vertices = geometry.attributes.position;

    for (let i = 0; i < vertices.count; i++) {
        const x = vertices.getX(i);
        const z = vertices.getZ(i);

        // depthFraction: 0 = paling belakang (puncak), 1 = paling depan (datar)
        const depthFraction = (z + depth / 2) / depth;
        
        let height = 0;

        // Zona 1: Area Puncak Bukit (depthFraction < 0.25)
        if (depthFraction < 0.25) {
            const peakHeight = terrainConfig.peakHeight + smoothNoise(x, z, 0.008, 3);
            const xVariation = Math.sin((x / width) * Math.PI * 3) * 2;
            height = peakHeight + xVariation;
        }
        // Zona 2: Area Lereng Transisi (0.25 <= depthFraction < 0.72)
        else if (depthFraction < terrainConfig.flatAreaStart) {
            const slopeProgress = (depthFraction - 0.25) / (terrainConfig.flatAreaStart - 0.25);
            const slopeHeight = terrainConfig.peakHeight * (1 - Math.pow(slopeProgress, 0.8));
            
            const slopeNoise = smoothNoise(x, z, 0.015, 3);
            const xVariation = Math.sin((x / width) * Math.PI * 2.5) * (1 - slopeProgress) * 2;
            
            height = slopeHeight + slopeNoise + xVariation;
        }
        // Zona 3: Area Dataran Depan (depthFraction >= 0.72)
        else {
            const flatNoise = smoothNoise(x, z, 0.02, 0.3);
            height = 0.5 + flatNoise;
        }

        // Pastikan height tidak negatif
        height = Math.max(0.1, height);
        vertices.setY(i, height);
    }
    geometry.computeVertexNormals();

    // Setup vertex colors untuk visualisasi erosi
    const colors = [];
    const vertexCount = geometry.attributes.position.count;
    for (let i = 0; i < vertexCount; i++) {
        colors.push(0.18, 0.55, 0.18); // Hijau awal
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));

    // Buat tekstur rumput bergaya kartun
    const grassTexture = createGrassTexture();

    // Material dengan vertex colors untuk visualisasi erosi
    const material = new THREE.MeshLambertMaterial({
        map: grassTexture,
        vertexColors: true,
        wireframe: false,
    });

    // Buat mesh terrain
    terrain = new THREE.Mesh(geometry, material);
    terrain.receiveShadow = true;
    terrain.castShadow = true;

    // Posisi terrain di tengah scene
    terrain.position.set(0, 0, 0);

    scene.add(terrain);

    // Buat sisi-sisi untuk cross-section (earth block cut look)
    createTerrainSides(scene, geometry);
  
    return terrain;
}

/**
 * Buat sisi-sisi terrain untuk efek cross-section balok tanah
 */
function createTerrainSides(scene, topGeometry) {
    const positions = topGeometry.attributes.position;
    const width = TERRAIN_WIDTH;
    const depth = TERRAIN_DEPTH;
    
    // Material untuk sisi tanah (coklat seperti tanah terpotong)
    const earthMaterial = new THREE.MeshLambertMaterial({
        color: 0x8B4513,
        side: THREE.DoubleSide
    });
    
    const darkEarthMaterial = new THREE.MeshLambertMaterial({
        color: 0x654321,
        side: THREE.DoubleSide
    });

    // Sisi kiri (x = -width/2)
    const leftSideGeometry = createSideGeometry(positions, 'left', width, depth);
    const leftSide = new THREE.Mesh(leftSideGeometry, earthMaterial);
    leftSide.receiveShadow = true;
    scene.add(leftSide);

    // Sisi kanan (x = width/2)
    const rightSideGeometry = createSideGeometry(positions, 'right', width, depth);
    const rightSide = new THREE.Mesh(rightSideGeometry, earthMaterial);
    rightSide.receiveShadow = true;
    scene.add(rightSide);

    // Sisi belakang (z = -depth/2) - puncak bukit
    const backSideGeometry = createSideGeometry(positions, 'back', width, depth);
    const backSide = new THREE.Mesh(backSideGeometry, darkEarthMaterial);
    backSide.receiveShadow = true;
    scene.add(backSide);

    // Sisi bawah (ground base)
    const bottomGeometry = new THREE.PlaneGeometry(width, depth);
    bottomGeometry.rotateX(Math.PI / 2);
    const bottom = new THREE.Mesh(bottomGeometry, darkEarthMaterial);
    bottom.position.y = -1;
    bottom.receiveShadow = true;
    scene.add(bottom);
}

/**
 * Helper untuk membuat geometry sisi terrain
 */
function createSideGeometry(topPositions, side, width, depth) {
    const vertices = [];
    const indices = [];
    
    const halfWidth = width / 2;
    const halfDepth = depth / 2;
    const baseY = -1;
    
    // Cari edge vertices berdasarkan sisi
    const edgeVertices = [];
    
    for (let i = 0; i < topPositions.count; i++) {
        const x = topPositions.getX(i);
        const y = topPositions.getY(i);
        const z = topPositions.getZ(i);
        
        const tolerance = 0.5;
        
        if (side === 'left' && Math.abs(x + halfWidth) < tolerance) {
            edgeVertices.push({ x, y, z, origIndex: i });
        } else if (side === 'right' && Math.abs(x - halfWidth) < tolerance) {
            edgeVertices.push({ x, y, z, origIndex: i });
        } else if (side === 'back' && Math.abs(z + halfDepth) < tolerance) {
            edgeVertices.push({ x, y, z, origIndex: i });
        }
    }
    
    // Sort edge vertices
    if (side === 'left' || side === 'right') {
        edgeVertices.sort((a, b) => a.z - b.z);
    } else {
        edgeVertices.sort((a, b) => a.x - b.x);
    }
    
    // Build geometry dengan triangles
    for (let i = 0; i < edgeVertices.length - 1; i++) {
        const v1 = edgeVertices[i];
        const v2 = edgeVertices[i + 1];
        
        const baseIndex = vertices.length / 3;
        
        // Top vertices
        vertices.push(v1.x, v1.y, v1.z);
        vertices.push(v2.x, v2.y, v2.z);
        // Bottom vertices
        vertices.push(v1.x, baseY, v1.z);
        vertices.push(v2.x, baseY, v2.z);
        
        // Two triangles for quad
        indices.push(baseIndex, baseIndex + 1, baseIndex + 2);
        indices.push(baseIndex + 1, baseIndex + 3, baseIndex + 2);
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    
    return geometry;
}

/**
 * Get height at world position menggunakan raycasting
 */
export function getTerrainHeightAt(x, z) {
    if (!terrain) return 0;
    
    const raycaster = new THREE.Raycaster(
        new THREE.Vector3(x, 100, z),
        new THREE.Vector3(0, -1, 0)
    );
    const intersects = raycaster.intersectObject(terrain);
    
    if (intersects.length > 0) {
        return intersects[0].point.y;
    }
    return 0;
}

/**
 * Check apakah posisi berada di area lereng (bukan dataran)
 */
export function isOnSlope(z) {
    const depthFraction = (z + TERRAIN_DEPTH / 2) / TERRAIN_DEPTH;
    return depthFraction < terrainConfig.flatAreaStart;
}

/**
 * Check apakah posisi berada di area dataran (untuk rumah)
 */
export function isOnFlatArea(z) {
    const depthFraction = (z + TERRAIN_DEPTH / 2) / TERRAIN_DEPTH;
    return depthFraction >= terrainConfig.flatAreaStart;
}

/**
 * Get depthFraction dari posisi Z
 */
export function getDepthFraction(z) {
    return (z + TERRAIN_DEPTH / 2) / TERRAIN_DEPTH;
}

/**
 * Convert world position ke grid coordinates
 */
export function worldToGrid(x, z) {
    const gridX = Math.floor(((x + TERRAIN_WIDTH / 2) / TERRAIN_WIDTH) * stabilityGridWidth);
    const gridZ = Math.floor(((z + TERRAIN_DEPTH / 2) / TERRAIN_DEPTH) * stabilityGridHeight);
    return {
        x: Math.max(0, Math.min(stabilityGridWidth - 1, gridX)),
        z: Math.max(0, Math.min(stabilityGridHeight - 1, gridZ))
    };
}

/**
 * Convert grid coordinates ke world position
 */
export function gridToWorld(gridX, gridZ) {
    const x = (gridX / stabilityGridWidth - 0.5) * TERRAIN_WIDTH;
    const z = (gridZ / stabilityGridHeight - 0.5) * TERRAIN_DEPTH;
    return { x, z };
}

/**
 * Get stability at world position
 */
export function getStabilityAt(x, z) {
    const grid = worldToGrid(x, z);
    if (stabilityMap[grid.x] && stabilityMap[grid.x][grid.z] !== undefined) {
        return stabilityMap[grid.x][grid.z];
    }
    return 1.0;
}

/**
 * Reduce stability at position (dipanggil oleh water flow)
 */
export function reduceStabilityAt(x, z, amount, radius = 3) {
    const grid = worldToGrid(x, z);
    
    for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
            const gx = grid.x + dx;
            const gz = grid.z + dz;
            
            if (gx >= 0 && gx < stabilityGridWidth && gz >= 0 && gz < stabilityGridHeight) {
                const distance = Math.sqrt(dx * dx + dz * dz);
                const influence = Math.max(0, 1 - distance / (radius + 1));
                
                stabilityMap[gx][gz] -= amount * influence;
                stabilityMap[gx][gz] = Math.max(0, stabilityMap[gx][gz]);
            }
        }
    }
}

/**
 * Increase stability at position (dari pohon)
 */
export function increaseStabilityAt(x, z, amount, radius = 8) {
    const grid = worldToGrid(x, z);
    
    for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
            const gx = grid.x + dx;
            const gz = grid.z + dz;
            
            if (gx >= 0 && gx < stabilityGridWidth && gz >= 0 && gz < stabilityGridHeight) {
                const distance = Math.sqrt(dx * dx + dz * dz);
                const influence = Math.max(0, 1 - distance / (radius + 1));
                
                stabilityMap[gx][gz] = Math.min(1.0, stabilityMap[gx][gz] + amount * influence);
            }
        }
    }
}

/**
 * Update terrain colors berdasarkan stability
 */
export function updateTerrainColors() {
    if (!terrain) return;
    
    const geometry = terrain.geometry;
    const colors = geometry.attributes.color.array;
    const positions = geometry.attributes.position.array;
    const vertexCount = geometry.attributes.position.count;
    
    const healthyColor = new THREE.Color(0x2d8b22); // Hijau
    const erodedColor = new THREE.Color(0x8b5a2b);  // Coklat erosi
    const landslideColor = new THREE.Color(0x5c4033); // Coklat gelap longsor
    
    for (let i = 0; i < vertexCount; i++) {
        const x = positions[i * 3];
        const z = positions[i * 3 + 2];
        
        const grid = worldToGrid(x, z);
        const stability = stabilityMap[grid.x] ? (stabilityMap[grid.x][grid.z] || 1.0) : 1.0;
        
        let color;
        if (stability > 0.5) {
            color = new THREE.Color().lerpColors(erodedColor, healthyColor, (stability - 0.5) * 2);
        } else {
            color = new THREE.Color().lerpColors(landslideColor, erodedColor, stability * 2);
        }
        
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
    }
    
    geometry.attributes.color.needsUpdate = true;
}

/**
 * Reset stability map
 */
export function resetStabilityMap() {
    for (let x = 0; x < stabilityGridWidth; x++) {
        for (let z = 0; z < stabilityGridHeight; z++) {
            stabilityMap[x][z] = 1.0;
        }
    }
    updateTerrainColors();
}

/**
 * Get average stability
 */
export function getAverageStability() {
    let total = 0;
    let count = 0;
    
    for (let x = 0; x < stabilityGridWidth; x++) {
        for (let z = 0; z < stabilityGridHeight; z++) {
            total += stabilityMap[x][z];
            count++;
        }
    }
    
    return count > 0 ? total / count : 1.0;
}

/**
 * Get damaged area percentage
 */
export function getDamagedAreaPercent() {
    let damaged = 0;
    let total = stabilityGridWidth * stabilityGridHeight;
    
    for (let x = 0; x < stabilityGridWidth; x++) {
        for (let z = 0; z < stabilityGridHeight; z++) {
            if (stabilityMap[x][z] < 0.7) {
                damaged++;
            }
        }
    }
    
    return Math.round((damaged / total) * 100);
}