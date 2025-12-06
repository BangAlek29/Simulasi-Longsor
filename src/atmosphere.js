/**
 * Enhanced Sky and Atmosphere Module
 * Membuat langit dan atmosfer yang lebih bagus
 */

import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';

let sky = null;
let clouds = [];
let sunLight = null;
let ambientLight = null;
let scene = null;

// Sky parameters
const SKY_PARAMS = {
    topColor: new THREE.Color(0x0077ff),
    bottomColor: new THREE.Color(0x89CFF0),
    sunColor: new THREE.Color(0xffffcc),
    horizonColor: new THREE.Color(0xffffff)
};

// Cloud parameters
const CLOUD_COUNT = 15;
const CLOUD_HEIGHT_MIN = 60;
const CLOUD_HEIGHT_MAX = 80;

// Noise for cloud animation
const noise2D = createNoise2D();

/**
 * Create gradient sky dome
 */
export function createSky(sceneRef) {
    scene = sceneRef;
    
    // Sky dome geometry
    const skyGeometry = new THREE.SphereGeometry(500, 32, 32);
    
    // Custom shader for gradient sky
    const skyMaterial = new THREE.ShaderMaterial({
        uniforms: {
            topColor: { value: SKY_PARAMS.topColor },
            bottomColor: { value: SKY_PARAMS.bottomColor },
            horizonColor: { value: SKY_PARAMS.horizonColor },
            offset: { value: 20 },
            exponent: { value: 0.6 }
        },
        vertexShader: `
            varying vec3 vWorldPosition;
            void main() {
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 topColor;
            uniform vec3 bottomColor;
            uniform vec3 horizonColor;
            uniform float offset;
            uniform float exponent;
            varying vec3 vWorldPosition;
            
            void main() {
                float h = normalize(vWorldPosition + offset).y;
                
                // Three-way gradient: bottom -> horizon -> top
                vec3 color;
                if (h < 0.0) {
                    color = bottomColor;
                } else if (h < 0.3) {
                    float t = h / 0.3;
                    color = mix(bottomColor, horizonColor, pow(t, 0.5));
                } else {
                    float t = (h - 0.3) / 0.7;
                    color = mix(horizonColor, topColor, pow(t, exponent));
                }
                
                gl_FragColor = vec4(color, 1.0);
            }
        `,
        side: THREE.BackSide
    });
    
    sky = new THREE.Mesh(skyGeometry, skyMaterial);
    scene.add(sky);
    
    // Create sun
    createSun();
    
    // Create clouds
    createClouds();
    
    console.log('🌤️ Sky and atmosphere created');
    
    return sky;
}

/**
 * Create sun visual
 */
function createSun() {
    const sunGeometry = new THREE.SphereGeometry(8, 32, 32);
    const sunMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffaa,
        transparent: true,
        opacity: 0.9
    });
    
    const sun = new THREE.Mesh(sunGeometry, sunMaterial);
    sun.position.set(80, 100, -50);
    scene.add(sun);
    
    // Sun glow
    const glowGeometry = new THREE.SphereGeometry(12, 32, 32);
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffcc,
        transparent: true,
        opacity: 0.3
    });
    
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.copy(sun.position);
    scene.add(glow);
}

/**
 * Create volumetric clouds
 */
function createClouds() {
    const cloudMaterial = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.85,
        flatShading: true
    });
    
    for (let i = 0; i < CLOUD_COUNT; i++) {
        const cloud = createSingleCloud(cloudMaterial);
        
        // Random position
        cloud.position.set(
            (Math.random() - 0.5) * 300,
            CLOUD_HEIGHT_MIN + Math.random() * (CLOUD_HEIGHT_MAX - CLOUD_HEIGHT_MIN),
            (Math.random() - 0.5) * 300
        );
        
        // Random rotation and scale
        cloud.rotation.y = Math.random() * Math.PI * 2;
        const scale = 0.5 + Math.random() * 1;
        cloud.scale.set(scale, scale * 0.6, scale);
        
        // Store original position for animation
        cloud.userData.originalX = cloud.position.x;
        cloud.userData.speed = 0.5 + Math.random() * 1;
        cloud.userData.noiseOffset = Math.random() * 1000;
        
        clouds.push(cloud);
        scene.add(cloud);
    }
}

/**
 * Create single cloud from multiple spheres
 */
function createSingleCloud(material) {
    const cloud = new THREE.Group();
    
    // Main body - multiple overlapping spheres
    const sphereCount = 5 + Math.floor(Math.random() * 5);
    
    for (let i = 0; i < sphereCount; i++) {
        const radius = 3 + Math.random() * 4;
        const geometry = new THREE.SphereGeometry(radius, 8, 6);
        const sphere = new THREE.Mesh(geometry, material);
        
        sphere.position.set(
            (Math.random() - 0.5) * 12,
            (Math.random() - 0.3) * 4,
            (Math.random() - 0.5) * 8
        );
        
        cloud.add(sphere);
    }
    
    return cloud;
}

/**
 * Update clouds animation
 */
export function updateClouds(time) {
    clouds.forEach((cloud, index) => {
        // Move clouds slowly
        cloud.position.x = cloud.userData.originalX + 
            Math.sin(time * 0.0001 * cloud.userData.speed + cloud.userData.noiseOffset) * 20;
        
        // Subtle up/down movement
        cloud.position.y += Math.sin(time * 0.0005 + index) * 0.01;
        
        // Wrap around
        if (cloud.position.x > 200) {
            cloud.position.x = -200;
            cloud.userData.originalX = -200;
        }
    });
}

/**
 * Set time of day (0-24)
 */
export function setTimeOfDay(hour) {
    if (!sky) return;
    
    const uniforms = sky.material.uniforms;
    
    // Adjust colors based on time
    if (hour >= 6 && hour < 8) {
        // Sunrise
        uniforms.topColor.value.setHex(0x4a6fa5);
        uniforms.bottomColor.value.setHex(0xffa07a);
        uniforms.horizonColor.value.setHex(0xffd700);
    } else if (hour >= 8 && hour < 17) {
        // Day
        uniforms.topColor.value.setHex(0x0077ff);
        uniforms.bottomColor.value.setHex(0x89CFF0);
        uniforms.horizonColor.value.setHex(0xffffff);
    } else if (hour >= 17 && hour < 19) {
        // Sunset
        uniforms.topColor.value.setHex(0x4a4a8a);
        uniforms.bottomColor.value.setHex(0xff6b6b);
        uniforms.horizonColor.value.setHex(0xffa500);
    } else {
        // Night
        uniforms.topColor.value.setHex(0x0a0a2e);
        uniforms.bottomColor.value.setHex(0x1a1a4e);
        uniforms.horizonColor.value.setHex(0x2a2a5e);
    }
}

/**
 * Remove sky
 */
export function removeSky() {
    if (sky && scene) {
        scene.remove(sky);
        sky = null;
    }
    
    clouds.forEach(cloud => {
        if (scene) scene.remove(cloud);
    });
    clouds = [];
}
