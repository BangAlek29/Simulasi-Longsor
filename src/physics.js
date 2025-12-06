import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { 
    terrain, 
    terrainConfig, 
    getTerrainHeightAt,
    reduceStabilityAt,
    isOnSlope
} from './terrain.js';
import { getTreeProtectionAt } from './trees.js';

// Physics world
let world = null;
let physicsBodies = [];
let physicsToThree = new Map(); // Map physics body to Three.js mesh

// Water physics bodies
let waterBodies = [];
let waterMeshes = [];

// Debris physics bodies  
let debrisBodies = [];
let debrisMeshes = [];

// Soil chunk physics (realistic landslide chunks)
let soilChunks = [];
const MAX_SOIL_CHUNKS = 60;

// Mud flow system
let mudFlowParticles = [];
const MAX_MUD_PARTICLES = 100;

// Physics constants
const GRAVITY = -15;
const WATER_MASS = 0.3;
const DEBRIS_MASS = 2.5;
const SOIL_CHUNK_MASS = 8.0;      // Heavier soil chunks
const MUD_MASS = 0.8;              // Mud particles
const WATER_RESTITUTION = 0.2;
const DEBRIS_RESTITUTION = 0.1;
const SOIL_RESTITUTION = 0.05;     // Almost no bounce for soil
const MUD_RESTITUTION = 0.02;      // Mud sticks
const FRICTION = 0.4;
const SOIL_FRICTION = 0.7;         // High friction for soil
const MUD_FRICTION = 0.3;          // Slippery mud

// Terrain collision body
let terrainBody = null;

// Scene reference
let sceneRef = null;

// Physics materials
let waterMaterial = null;
let debrisMaterial = null;
let terrainMaterial = null;
let soilMaterial = null;
let mudMaterial = null;

// Object pooling
const MAX_WATER_BODIES = 150;
const MAX_DEBRIS_BODIES = 80;

// Shared geometries and materials for Three.js visualization
let waterSphereGeometry = null;
let waterSphereMaterial = null;
let debrisSphereGeometry = null;
let debrisSphereMaterial = null;
let soilChunkMaterials = [];  // Multiple materials for variation
let mudSphereMaterial = null;

// Water spawn settings
let isWaterFlowing = false;
let waterIntensity = 50;
let frameCounter = 0;
let physicsEnabled = true; // Toggle for physics simulation

/**
 * Enable/disable physics simulation
 */
export function setPhysicsEnabled(enabled) {
    physicsEnabled = enabled;
    
    if (!enabled) {
        // Hide all physics objects when disabled
        waterBodies.forEach(w => {
            if (w.active) {
                w.mesh.visible = false;
            }
        });
        debrisBodies.forEach(d => {
            if (d.active) {
                d.mesh.visible = false;
            }
        });
    } else {
        // Show active physics objects when enabled
        waterBodies.forEach(w => {
            if (w.active) {
                w.mesh.visible = true;
            }
        });
        debrisBodies.forEach(d => {
            if (d.active) {
                d.mesh.visible = true;
            }
        });
    }
    
    console.log(`Physics engine ${enabled ? 'enabled' : 'disabled'}`);
}

/**
 * Check if physics is enabled
 */
export function isPhysicsEnabledState() {
    return physicsEnabled;
}

/**
 * Initialize physics world
 */
export function initPhysicsWorld(scene) {
    sceneRef = scene;
    
    // Create physics world
    world = new CANNON.World({
        gravity: new CANNON.Vec3(0, GRAVITY, 0)
    });
    
    // Broadphase for better performance
    world.broadphase = new CANNON.SAPBroadphase(world);
    world.allowSleep = true;
    
    // Create physics materials
    terrainMaterial = new CANNON.Material('terrain');
    waterMaterial = new CANNON.Material('water');
    debrisMaterial = new CANNON.Material('debris');
    soilMaterial = new CANNON.Material('soil');
    mudMaterial = new CANNON.Material('mud');
    
    // Contact materials
    const terrainWaterContact = new CANNON.ContactMaterial(terrainMaterial, waterMaterial, {
        friction: FRICTION * 0.5,
        restitution: WATER_RESTITUTION
    });
    
    const terrainDebrisContact = new CANNON.ContactMaterial(terrainMaterial, debrisMaterial, {
        friction: FRICTION,
        restitution: DEBRIS_RESTITUTION
    });
    
    const waterDebrisContact = new CANNON.ContactMaterial(waterMaterial, debrisMaterial, {
        friction: 0.1,
        restitution: 0.05
    });
    
    // Soil contact materials - realistic heavy soil behavior
    const terrainSoilContact = new CANNON.ContactMaterial(terrainMaterial, soilMaterial, {
        friction: SOIL_FRICTION,
        restitution: SOIL_RESTITUTION
    });
    
    const soilSoilContact = new CANNON.ContactMaterial(soilMaterial, soilMaterial, {
        friction: SOIL_FRICTION * 0.8,
        restitution: SOIL_RESTITUTION
    });
    
    // Mud contact materials - slippery and sticky
    const terrainMudContact = new CANNON.ContactMaterial(terrainMaterial, mudMaterial, {
        friction: MUD_FRICTION,
        restitution: MUD_RESTITUTION
    });
    
    const mudMudContact = new CANNON.ContactMaterial(mudMaterial, mudMaterial, {
        friction: MUD_FRICTION * 0.5,
        restitution: MUD_RESTITUTION
    });
    
    const soilMudContact = new CANNON.ContactMaterial(soilMaterial, mudMaterial, {
        friction: MUD_FRICTION,
        restitution: MUD_RESTITUTION
    });
    
    world.addContactMaterial(terrainWaterContact);
    world.addContactMaterial(terrainDebrisContact);
    world.addContactMaterial(waterDebrisContact);
    world.addContactMaterial(terrainSoilContact);
    world.addContactMaterial(soilSoilContact);
    world.addContactMaterial(terrainMudContact);
    world.addContactMaterial(mudMudContact);
    world.addContactMaterial(soilMudContact);
    
    // Create terrain collision body
    createTerrainCollider();
    
    // Initialize shared geometries
    waterSphereGeometry = new THREE.SphereGeometry(0.4, 8, 6);
    waterSphereMaterial = new THREE.MeshPhongMaterial({
        color: 0x4488ff,
        transparent: true,
        opacity: 0.7,
        shininess: 100
    });
    
    debrisSphereGeometry = new THREE.SphereGeometry(0.6, 6, 4);
    debrisSphereMaterial = new THREE.MeshPhongMaterial({
        color: 0x8B4513,
        shininess: 10
    });
    
    // Soil chunk materials - variety of brown/earth colors
    soilChunkMaterials = [
        new THREE.MeshPhongMaterial({ color: 0x5C4033, shininess: 5 }),  // Dark brown
        new THREE.MeshPhongMaterial({ color: 0x6B4423, shininess: 5 }),  // Saddle brown
        new THREE.MeshPhongMaterial({ color: 0x704214, shininess: 5 }),  // Sepia
        new THREE.MeshPhongMaterial({ color: 0x8B4513, shininess: 5 }),  // Sienna
        new THREE.MeshPhongMaterial({ color: 0x654321, shininess: 5 }),  // Dark brown 2
    ];
    
    // Mud material - wet earth look
    mudSphereMaterial = new THREE.MeshPhongMaterial({
        color: 0x4A3728,
        shininess: 30,
        transparent: true,
        opacity: 0.9
    });
    
    // Pre-create water bodies pool
    for (let i = 0; i < MAX_WATER_BODIES; i++) {
        createPooledWaterBody();
    }
    
    // Pre-create debris bodies pool
    for (let i = 0; i < MAX_DEBRIS_BODIES; i++) {
        createPooledDebrisBody();
    }
    
    // Pre-create soil chunks pool
    for (let i = 0; i < MAX_SOIL_CHUNKS; i++) {
        createPooledSoilChunk();
    }
    
    // Pre-create mud particles pool
    for (let i = 0; i < MAX_MUD_PARTICLES; i++) {
        createPooledMudParticle();
    }
    
    console.log('🔧 Physics world initialized with realistic landslide simulation');
}

/**
 * Create terrain collision body using heightfield
 */
function createTerrainCollider() {
    if (!terrain) return;
    
    const geometry = terrain.geometry;
    const positions = geometry.attributes.position;
    
    // Get terrain dimensions
    const width = terrainConfig.width;
    const depth = terrainConfig.depth;
    const segmentsW = terrainConfig.segmentsW;
    const segmentsD = terrainConfig.segmentsD;
    
    // Create height data matrix for heightfield
    const heightData = [];
    
    for (let i = 0; i <= segmentsD; i++) {
        heightData.push([]);
        for (let j = 0; j <= segmentsW; j++) {
            // Sample height from terrain
            const x = (j / segmentsW - 0.5) * width;
            const z = (i / segmentsD - 0.5) * depth;
            const height = getTerrainHeightAt(x, z);
            heightData[i].push(height);
        }
    }
    
    // Create heightfield shape
    const heightfieldShape = new CANNON.Heightfield(heightData, {
        elementSize: width / segmentsW
    });
    
    terrainBody = new CANNON.Body({
        mass: 0, // Static
        material: terrainMaterial
    });
    
    terrainBody.addShape(heightfieldShape);
    
    // Position and rotate heightfield to match Three.js terrain
    terrainBody.position.set(
        -width / 2,
        0,
        depth / 2
    );
    terrainBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    
    world.addBody(terrainBody);
}

/**
 * Create pooled water body
 */
function createPooledWaterBody() {
    const radius = 0.4;
    const shape = new CANNON.Sphere(radius);
    
    const body = new CANNON.Body({
        mass: WATER_MASS,
        material: waterMaterial,
        shape: shape,
        linearDamping: 0.2,
        angularDamping: 0.5
    });
    
    body.position.set(0, -100, 0); // Hide initially
    body.sleep();
    
    // Create Three.js mesh
    const mesh = new THREE.Mesh(waterSphereGeometry, waterSphereMaterial);
    mesh.visible = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    
    sceneRef.add(mesh);
    world.addBody(body);
    
    waterBodies.push({
        body: body,
        mesh: mesh,
        active: false,
        age: 0,
        maxAge: 400
    });
}

/**
 * Create pooled debris body
 */
function createPooledDebrisBody() {
    // Random shape - box or sphere
    const useBox = Math.random() > 0.5;
    let shape;
    let mesh;
    
    if (useBox) {
        const size = 0.4 + Math.random() * 0.4;
        shape = new CANNON.Box(new CANNON.Vec3(size, size * 0.6, size));
        const boxGeometry = new THREE.BoxGeometry(size * 2, size * 1.2, size * 2);
        mesh = new THREE.Mesh(boxGeometry, debrisSphereMaterial);
    } else {
        const radius = 0.3 + Math.random() * 0.4;
        shape = new CANNON.Sphere(radius);
        mesh = new THREE.Mesh(debrisSphereGeometry, debrisSphereMaterial);
    }
    
    const body = new CANNON.Body({
        mass: DEBRIS_MASS,
        material: debrisMaterial,
        shape: shape,
        linearDamping: 0.3,
        angularDamping: 0.4
    });
    
    body.position.set(0, -100, 0);
    body.sleep();
    
    mesh.visible = false;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    sceneRef.add(mesh);
    world.addBody(body);
    
    debrisBodies.push({
        body: body,
        mesh: mesh,
        active: false,
        age: 0,
        maxAge: 500
    });
}

/**
 * Create pooled soil chunk - realistic landslide mass
 */
function createPooledSoilChunk() {
    // Random irregular shape - compound of boxes for more realistic look
    const baseSize = 0.8 + Math.random() * 1.2;
    const heightVar = 0.4 + Math.random() * 0.6;
    const widthVar = 0.6 + Math.random() * 0.8;
    
    // Create compound shape for irregular chunk
    const body = new CANNON.Body({
        mass: SOIL_CHUNK_MASS * (baseSize / 1.2),
        material: soilMaterial,
        linearDamping: 0.4,
        angularDamping: 0.5
    });
    
    // Main shape
    const mainShape = new CANNON.Box(new CANNON.Vec3(baseSize, heightVar, widthVar));
    body.addShape(mainShape);
    
    // Add smaller protrusions for irregularity
    if (Math.random() > 0.5) {
        const extraShape = new CANNON.Box(new CANNON.Vec3(baseSize * 0.3, heightVar * 0.5, widthVar * 0.4));
        body.addShape(extraShape, new CANNON.Vec3(baseSize * 0.5, heightVar * 0.3, 0));
    }
    
    body.position.set(0, -100, 0);
    body.sleep();
    
    // Create Three.js mesh - irregular rock-like geometry
    const geometry = createIrregularChunkGeometry(baseSize, heightVar, widthVar);
    const materialIndex = Math.floor(Math.random() * soilChunkMaterials.length);
    const mesh = new THREE.Mesh(geometry, soilChunkMaterials[materialIndex]);
    mesh.visible = false;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    sceneRef.add(mesh);
    world.addBody(body);
    
    soilChunks.push({
        body: body,
        mesh: mesh,
        active: false,
        age: 0,
        maxAge: 800,
        settled: false,
        settleTime: 0
    });
}

/**
 * Create irregular chunk geometry for more realistic look
 */
function createIrregularChunkGeometry(baseSize, heightVar, widthVar) {
    const geometry = new THREE.BoxGeometry(baseSize * 2, heightVar * 2, widthVar * 2, 3, 2, 2);
    const positions = geometry.attributes.position;
    
    // Deform vertices for irregular shape
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const z = positions.getZ(i);
        
        // Random displacement for organic look
        const noise = (Math.random() - 0.5) * 0.3;
        positions.setX(i, x + noise * baseSize);
        positions.setY(i, y + noise * heightVar);
        positions.setZ(i, z + noise * widthVar);
    }
    
    geometry.computeVertexNormals();
    return geometry;
}

/**
 * Create pooled mud particle
 */
function createPooledMudParticle() {
    // Slightly larger sphere for mud blob
    const radius = 0.3 + Math.random() * 0.25;
    const shape = new CANNON.Sphere(radius);
    
    const body = new CANNON.Body({
        mass: MUD_MASS,
        material: mudMaterial,
        shape: shape,
        linearDamping: 0.5,  // High damping - mud is viscous
        angularDamping: 0.7
    });
    
    body.position.set(0, -100, 0);
    body.sleep();
    
    // Flattened sphere for mud blob look
    const geometry = new THREE.SphereGeometry(radius, 8, 6);
    geometry.scale(1, 0.6, 1); // Flatten
    const mesh = new THREE.Mesh(geometry, mudSphereMaterial);
    mesh.visible = false;
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    
    sceneRef.add(mesh);
    world.addBody(body);
    
    mudFlowParticles.push({
        body: body,
        mesh: mesh,
        active: false,
        age: 0,
        maxAge: 600,
        splattered: false
    });
}

/**
 * Spawn water particle with physics
 */
function spawnWaterParticle() {
    if (!physicsEnabled) return;
    
    // Find inactive water body
    const waterObj = waterBodies.find(w => !w.active);
    if (!waterObj) return;
    
    // Spawn position at hill peak
    const spawnX = (Math.random() - 0.5) * terrainConfig.width * 0.6;
    const spawnZ = -terrainConfig.depth / 2 + 5 + Math.random() * 8;
    const spawnY = getTerrainHeightAt(spawnX, spawnZ) + 2;
    
    waterObj.body.position.set(spawnX, spawnY, spawnZ);
    waterObj.body.wakeUp();
    
    // Initial velocity - flowing down slope
    const intensityFactor = waterIntensity / 50;
    waterObj.body.velocity.set(
        (Math.random() - 0.5) * 2,
        -1,
        3 + Math.random() * 2 * intensityFactor
    );
    
    waterObj.active = true;
    waterObj.age = 0;
    waterObj.mesh.visible = true;
}

/**
 * Spawn debris particle with physics
 */
export function spawnDebrisParticle(x, y, z, radius = 8) {
    if (!physicsEnabled) return;
    
    // Find inactive debris body
    const debrisObj = debrisBodies.find(d => !d.active);
    if (!debrisObj) return;
    
    // Random offset within radius
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * radius * 0.5;
    const spawnX = x + Math.cos(angle) * dist;
    const spawnZ = z + Math.sin(angle) * dist;
    const spawnY = y + 1 + Math.random() * 2;
    
    debrisObj.body.position.set(spawnX, spawnY, spawnZ);
    debrisObj.body.wakeUp();
    
    // Initial velocity - tumbling down
    debrisObj.body.velocity.set(
        (Math.random() - 0.5) * 3,
        Math.random() * 2,
        2 + Math.random() * 4
    );
    
    // Random angular velocity for tumbling effect
    debrisObj.body.angularVelocity.set(
        (Math.random() - 0.5) * 5,
        (Math.random() - 0.5) * 5,
        (Math.random() - 0.5) * 5
    );
    
    debrisObj.active = true;
    debrisObj.age = 0;
    debrisObj.mesh.visible = true;
}

/**
 * Spawn soil chunk - heavy terrain piece
 */
export function spawnSoilChunk(x, y, z, velocity = null) {
    if (!physicsEnabled) return;
    
    const chunk = soilChunks.find(c => !c.active);
    if (!chunk) return;
    
    // Random offset
    const offsetX = (Math.random() - 0.5) * 3;
    const offsetZ = (Math.random() - 0.5) * 3;
    
    chunk.body.position.set(x + offsetX, y + 1, z + offsetZ);
    chunk.body.wakeUp();
    
    // Initial velocity - heavy mass sliding/tumbling
    if (velocity) {
        chunk.body.velocity.copy(velocity);
    } else {
        chunk.body.velocity.set(
            (Math.random() - 0.5) * 2,
            Math.random() * 1.5,
            1.5 + Math.random() * 3
        );
    }
    
    // Slow tumbling for heavy mass
    chunk.body.angularVelocity.set(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 1,
        (Math.random() - 0.5) * 2
    );
    
    chunk.active = true;
    chunk.age = 0;
    chunk.settled = false;
    chunk.settleTime = 0;
    chunk.mesh.visible = true;
}

/**
 * Spawn mud particle - viscous flow
 */
export function spawnMudParticle(x, y, z, inheritVelocity = null) {
    if (!physicsEnabled) return;
    
    const mud = mudFlowParticles.find(m => !m.active);
    if (!mud) return;
    
    // Spread pattern
    const spreadAngle = Math.random() * Math.PI * 2;
    const spreadDist = Math.random() * 2;
    
    mud.body.position.set(
        x + Math.cos(spreadAngle) * spreadDist,
        y + 0.5 + Math.random(),
        z + Math.sin(spreadAngle) * spreadDist
    );
    mud.body.wakeUp();
    
    // Mud flows slower but spreads
    if (inheritVelocity) {
        mud.body.velocity.set(
            inheritVelocity.x * 0.6 + (Math.random() - 0.5) * 2,
            inheritVelocity.y * 0.3,
            inheritVelocity.z * 0.8 + Math.random() * 2
        );
    } else {
        mud.body.velocity.set(
            (Math.random() - 0.5) * 3,
            -0.5,
            2 + Math.random() * 3
        );
    }
    
    // Minimal rotation for mud
    mud.body.angularVelocity.set(0, 0, 0);
    
    mud.active = true;
    mud.age = 0;
    mud.splattered = false;
    mud.mesh.visible = true;
}

/**
 * Spawn multiple debris for landslide - NOW WITH REALISTIC SOIL AND MUD
 */
export function spawnLandslideDebris(worldPos, count = 10) {
    // Spawn soil chunks (heavy pieces) - 40% of count
    const soilCount = Math.ceil(count * 0.4);
    for (let i = 0; i < soilCount; i++) {
        spawnSoilChunk(worldPos.x, worldPos.y, worldPos.z);
    }
    
    // Spawn mud particles (flow) - 40% of count
    const mudCount = Math.ceil(count * 0.4);
    for (let i = 0; i < mudCount; i++) {
        spawnMudParticle(worldPos.x, worldPos.y, worldPos.z);
    }
    
    // Spawn small debris (rocks) - 20% of count
    const debrisCount = Math.floor(count * 0.2);
    for (let i = 0; i < debrisCount; i++) {
        spawnDebrisParticle(worldPos.x, worldPos.y, worldPos.z);
    }
}

/**
 * Start water flow
 */
export function startPhysicsWaterFlow() {
    isWaterFlowing = true;
    console.log('🌊 Physics water flow started');
}

/**
 * Stop water flow
 */
export function stopPhysicsWaterFlow() {
    isWaterFlowing = false;
    console.log('⏹️ Physics water flow stopped');
}

/**
 * Set water intensity
 */
export function setPhysicsWaterIntensity(intensity) {
    waterIntensity = intensity;
}

/**
 * Update physics world
 */
export function updatePhysics(deltaTime = 1/60) {
    if (!world || !physicsEnabled) return;
    
    frameCounter++;
    
    // Step physics world
    world.step(deltaTime);
    
    // Spawn water if flowing
    if (isWaterFlowing) {
        const intensityFactor = waterIntensity / 50;
        const spawnInterval = Math.max(2, Math.floor(8 / intensityFactor));
        const spawnCount = Math.max(1, Math.floor(intensityFactor * 2));
        
        if (frameCounter % spawnInterval === 0) {
            for (let i = 0; i < spawnCount; i++) {
                spawnWaterParticle();
            }
        }
    }
    
    // Update water bodies
    updateWaterBodies();
    
    // Update debris bodies
    updateDebrisBodies();
    
    // Update soil chunks
    updateSoilChunks();
    
    // Update mud particles
    updateMudParticles();
}

/**
 * Update water bodies
 */
function updateWaterBodies() {
    waterBodies.forEach(waterObj => {
        if (!waterObj.active) return;
        
        waterObj.age++;
        
        const body = waterObj.body;
        const mesh = waterObj.mesh;
        
        // Check bounds and age
        if (waterObj.age > waterObj.maxAge ||
            body.position.z > terrainConfig.depth / 2 + 10 ||
            body.position.y < -10) {
            // Deactivate
            waterObj.active = false;
            mesh.visible = false;
            body.position.set(0, -100, 0);
            body.velocity.set(0, 0, 0);
            body.sleep();
            return;
        }
        
        // Apply erosion on slope
        if (isOnSlope(body.position.z)) {
            const erosionRate = 0.005 * (waterIntensity / 50);
            const treeProtection = getTreeProtectionAt(body.position.x, body.position.z);
            const finalErosion = erosionRate * (1 - treeProtection * 0.7);
            reduceStabilityAt(body.position.x, body.position.z, finalErosion, 2);
        }
        
        // Add slight forward push to simulate water flow
        body.velocity.z += 0.05;
        
        // Sync Three.js mesh with physics body
        mesh.position.copy(body.position);
        mesh.quaternion.copy(body.quaternion);
    });
}

/**
 * Update debris bodies
 */
function updateDebrisBodies() {
    debrisBodies.forEach(debrisObj => {
        if (!debrisObj.active) return;
        
        debrisObj.age++;
        
        const body = debrisObj.body;
        const mesh = debrisObj.mesh;
        
        // Check bounds and age
        if (debrisObj.age > debrisObj.maxAge ||
            body.position.z > terrainConfig.depth / 2 + 10 ||
            body.position.y < -10) {
            // Deactivate
            debrisObj.active = false;
            mesh.visible = false;
            body.position.set(0, -100, 0);
            body.velocity.set(0, 0, 0);
            body.angularVelocity.set(0, 0, 0);
            body.sleep();
            return;
        }
        
        // Slow down debris on flat area
        const depthFrac = (body.position.z + terrainConfig.depth / 2) / terrainConfig.depth;
        if (depthFrac > terrainConfig.flatAreaStart) {
            body.velocity.x *= 0.98;
            body.velocity.z *= 0.98;
        }
        
        // Sync Three.js mesh with physics body
        mesh.position.copy(body.position);
        mesh.quaternion.copy(body.quaternion);
    });
}

/**
 * Update soil chunks - heavy terrain pieces with settling behavior
 */
function updateSoilChunks() {
    soilChunks.forEach(chunk => {
        if (!chunk.active) return;
        
        chunk.age++;
        
        const body = chunk.body;
        const mesh = chunk.mesh;
        
        // Check bounds and age
        if (chunk.age > chunk.maxAge ||
            body.position.z > terrainConfig.depth / 2 + 15 ||
            body.position.y < -10) {
            deactivateSoilChunk(chunk);
            return;
        }
        
        // Check if chunk has settled (low velocity)
        const speed = body.velocity.length();
        const angularSpeed = body.angularVelocity.length();
        
        if (speed < 0.3 && angularSpeed < 0.2) {
            chunk.settleTime++;
            
            // Mark as settled after being slow for a while
            if (chunk.settleTime > 60 && !chunk.settled) {
                chunk.settled = true;
                // Spawn mud around settled chunk
                if (Math.random() > 0.5) {
                    spawnMudParticle(body.position.x, body.position.y, body.position.z);
                }
            }
            
            // Deactivate after fully settled
            if (chunk.settleTime > 200) {
                deactivateSoilChunk(chunk);
                return;
            }
        } else {
            chunk.settleTime = 0;
        }
        
        // Heavy chunks push through - add downslope force on steep terrain
        const depthFrac = (body.position.z + terrainConfig.depth / 2) / terrainConfig.depth;
        if (depthFrac < terrainConfig.flatAreaStart) {
            // On slope - add gravity component along slope
            body.velocity.z += 0.05;
        } else {
            // On flat - slow down
            body.velocity.x *= 0.96;
            body.velocity.z *= 0.96;
        }
        
        // Sync Three.js mesh with physics body
        mesh.position.copy(body.position);
        mesh.quaternion.copy(body.quaternion);
    });
}

/**
 * Deactivate soil chunk
 */
function deactivateSoilChunk(chunk) {
    chunk.active = false;
    chunk.mesh.visible = false;
    chunk.body.position.set(0, -100, 0);
    chunk.body.velocity.set(0, 0, 0);
    chunk.body.angularVelocity.set(0, 0, 0);
    chunk.body.sleep();
}

/**
 * Update mud particles - viscous flow behavior
 */
function updateMudParticles() {
    mudFlowParticles.forEach(mud => {
        if (!mud.active) return;
        
        mud.age++;
        
        const body = mud.body;
        const mesh = mud.mesh;
        
        // Check bounds and age
        if (mud.age > mud.maxAge ||
            body.position.z > terrainConfig.depth / 2 + 15 ||
            body.position.y < -10) {
            deactivateMudParticle(mud);
            return;
        }
        
        // Mud spreading behavior
        const speed = body.velocity.length();
        
        // Add viscous drag
        body.velocity.x *= 0.97;
        body.velocity.z *= 0.98;
        
        // Mud follows terrain closely
        const terrainY = getTerrainHeightAt(body.position.x, body.position.z);
        if (body.position.y < terrainY + 0.3) {
            body.position.y = terrainY + 0.2;
            body.velocity.y = Math.max(0, body.velocity.y * 0.3);
            
            // Mark as splattered
            if (!mud.splattered && speed < 1) {
                mud.splattered = true;
                // Flatten mesh when splattered
                mesh.scale.set(1.5, 0.3, 1.5);
            }
        }
        
        // Continue flow on slope
        const depthFrac = (body.position.z + terrainConfig.depth / 2) / terrainConfig.depth;
        if (depthFrac < terrainConfig.flatAreaStart) {
            // On slope - mud flows
            body.velocity.z += 0.08;
            
            // Spread sideways
            body.velocity.x += (Math.random() - 0.5) * 0.05;
        } else {
            // On flat - spread out and stop
            body.velocity.x *= 0.94;
            body.velocity.z *= 0.92;
            
            // Deactivate if too slow on flat
            if (speed < 0.2 && mud.age > 100) {
                mud.maxAge = Math.min(mud.maxAge, mud.age + 50);
            }
        }
        
        // Apply erosion where mud flows
        if (isOnSlope(body.position.z)) {
            reduceStabilityAt(body.position.x, body.position.z, 0.002, 1);
        }
        
        // Sync Three.js mesh with physics body
        mesh.position.copy(body.position);
        // Mud doesn't rotate much
        mesh.rotation.y = Math.atan2(body.velocity.x, body.velocity.z);
    });
}

/**
 * Deactivate mud particle
 */
function deactivateMudParticle(mud) {
    mud.active = false;
    mud.mesh.visible = false;
    mud.mesh.scale.set(1, 1, 1); // Reset scale
    mud.body.position.set(0, -100, 0);
    mud.body.velocity.set(0, 0, 0);
    mud.body.sleep();
}

/**
 * Get active water count
 */
export function getActivePhysicsWaterCount() {
    return waterBodies.filter(w => w.active).length;
}

/**
 * Get active debris count (includes soil chunks and mud)
 */
export function getActivePhysicsDebrisCount() {
    const debris = debrisBodies.filter(d => d.active).length;
    const soil = soilChunks.filter(s => s.active).length;
    const mud = mudFlowParticles.filter(m => m.active).length;
    return debris + soil + mud;
}

/**
 * Get active soil chunks count
 */
export function getActiveSoilChunksCount() {
    return soilChunks.filter(s => s.active).length;
}

/**
 * Get active mud particles count
 */
export function getActiveMudCount() {
    return mudFlowParticles.filter(m => m.active).length;
}

/**
 * Check if physics water is flowing
 */
export function isPhysicsWaterFlowing() {
    return isWaterFlowing || waterBodies.some(w => w.active);
}

/**
 * Reset physics system
 */
export function resetPhysics() {
    isWaterFlowing = false;
    frameCounter = 0;
    
    // Reset all water bodies
    waterBodies.forEach(waterObj => {
        waterObj.active = false;
        waterObj.mesh.visible = false;
        waterObj.body.position.set(0, -100, 0);
        waterObj.body.velocity.set(0, 0, 0);
        waterObj.body.sleep();
    });
    
    // Reset all debris bodies
    debrisBodies.forEach(debrisObj => {
        debrisObj.active = false;
        debrisObj.mesh.visible = false;
        debrisObj.body.position.set(0, -100, 0);
        debrisObj.body.velocity.set(0, 0, 0);
        debrisObj.body.angularVelocity.set(0, 0, 0);
        debrisObj.body.sleep();
    });
    
    // Reset all soil chunks
    soilChunks.forEach(chunk => {
        chunk.active = false;
        chunk.settled = false;
        chunk.settleTime = 0;
        chunk.mesh.visible = false;
        chunk.body.position.set(0, -100, 0);
        chunk.body.velocity.set(0, 0, 0);
        chunk.body.angularVelocity.set(0, 0, 0);
        chunk.body.sleep();
    });
    
    // Reset all mud particles
    mudFlowParticles.forEach(mud => {
        mud.active = false;
        mud.splattered = false;
        mud.mesh.visible = false;
        mud.mesh.scale.set(1, 1, 1);
        mud.body.position.set(0, -100, 0);
        mud.body.velocity.set(0, 0, 0);
        mud.body.sleep();
    });
    
    console.log('Physics system reset');
}

/**
 * Get debris positions for collision detection
 */
export function getPhysicsDebrisPositions() {
    return debrisBodies
        .filter(d => d.active)
        .map(d => ({
            position: new THREE.Vector3().copy(d.body.position),
            velocity: new THREE.Vector3().copy(d.body.velocity)
        }));
}

/**
 * Update terrain collider (called when terrain changes)
 */
export function updateTerrainCollider() {
    if (!world || !terrainBody) return;
    
    // Remove old terrain body
    world.removeBody(terrainBody);
    
    // Create new terrain collider
    createTerrainCollider();
}
