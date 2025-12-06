/**
 * Visual Effects Module
 * Menggunakan postprocessing untuk efek visual yang lebih bagus
 */

import * as THREE from 'three';
import { EffectComposer, RenderPass, BloomEffect, EffectPass, SMAAEffect, ToneMappingEffect, ToneMappingMode, VignetteEffect, DepthOfFieldEffect } from 'postprocessing';

let composer = null;
let bloomEffect = null;
let vignetteEffect = null;
let dofEffect = null;
let effectsEnabled = true;

/**
 * Initialize post-processing effects
 */
export function initEffects(renderer, scene, camera) {
    // Create composer
    composer = new EffectComposer(renderer);
    
    // Render pass - dasar rendering
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    
    // SMAA antialiasing - lebih smooth
    const smaaEffect = new SMAAEffect();
    
    // Bloom effect - glow pada area terang
    bloomEffect = new BloomEffect({
        intensity: 0.5,
        luminanceThreshold: 0.7,
        luminanceSmoothing: 0.3,
        mipmapBlur: true
    });
    
    // Vignette - darkening di pinggir
    vignetteEffect = new VignetteEffect({
        offset: 0.35,
        darkness: 0.5
    });
    
    // Tone mapping - warna lebih natural
    const toneMappingEffect = new ToneMappingEffect({
        mode: ToneMappingMode.ACES_FILMIC,
        resolution: 256,
        whitePoint: 4.0,
        middleGrey: 0.6,
        minLuminance: 0.01,
        averageLuminance: 1.0,
        adaptationRate: 1.0
    });
    
    // Combine effects
    const effectPass = new EffectPass(camera, smaaEffect, bloomEffect, vignetteEffect, toneMappingEffect);
    composer.addPass(effectPass);
    
    console.log('✨ Post-processing effects initialized');
    
    return composer;
}

/**
 * Render with effects
 */
export function renderWithEffects() {
    if (composer && effectsEnabled) {
        composer.render();
        return true;
    }
    return false;
}

/**
 * Update composer size on resize
 */
export function updateEffectsSize(width, height) {
    if (composer) {
        composer.setSize(width, height);
    }
}

/**
 * Toggle effects on/off
 */
export function setEffectsEnabled(enabled) {
    effectsEnabled = enabled;
}

/**
 * Check if effects are enabled
 */
export function isEffectsEnabled() {
    return effectsEnabled;
}

/**
 * Set bloom intensity
 */
export function setBloomIntensity(intensity) {
    if (bloomEffect) {
        bloomEffect.intensity = intensity;
    }
}

/**
 * Set vignette intensity
 */
export function setVignetteIntensity(darkness) {
    if (vignetteEffect) {
        vignetteEffect.darkness = darkness;
    }
}

/**
 * Get composer for external use
 */
export function getComposer() {
    return composer;
}
