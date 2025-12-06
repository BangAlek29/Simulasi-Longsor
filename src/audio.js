/**
 * Audio System for Landslide Simulation
 * Uses Web Audio API for spatial and ambient sounds
 */

// Audio context
let audioContext = null;
let masterGain = null;
let isAudioInitialized = false;
let isAudioEnabled = true;

// Audio buffers
const audioBuffers = {
    rain: null,
    rainHeavy: null,
    landslide: null,
    treeFall: null,
    houseCollapse: null,
    waterFlow: null,
    thunder: null,
    ambient: null
};

// Active audio sources
let rainSource = null;
let ambientSource = null;
let waterFlowSource = null;

// Gain nodes for each sound type
let rainGain = null;
let ambientGain = null;
let effectsGain = null;
let waterFlowGain = null;

// Current state
let currentRainIntensity = 0;
let isRaining = false;

/**
 * Initialize audio system (must be called after user interaction)
 */
export async function initAudio() {
    if (isAudioInitialized) return;
    
    try {
        // Create audio context
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Create master gain
        masterGain = audioContext.createGain();
        masterGain.gain.value = 0.7;
        masterGain.connect(audioContext.destination);
        
        // Create category gains
        rainGain = audioContext.createGain();
        rainGain.gain.value = 0;
        rainGain.connect(masterGain);
        
        ambientGain = audioContext.createGain();
        ambientGain.gain.value = 0.3;
        ambientGain.connect(masterGain);
        
        effectsGain = audioContext.createGain();
        effectsGain.gain.value = 0.8;
        effectsGain.connect(masterGain);
        
        waterFlowGain = audioContext.createGain();
        waterFlowGain.gain.value = 0;
        waterFlowGain.connect(masterGain);
        
        // Generate procedural sounds
        await generateProceduralSounds();
        
        // Start ambient loop
        startAmbientLoop();
        
        isAudioInitialized = true;
        console.log('Audio system initialized');
        
    } catch (error) {
        console.warn('Audio initialization failed:', error);
    }
}

/**
 * Generate procedural audio (no external files needed)
 */
async function generateProceduralSounds() {
    // Generate rain sound (pink noise)
    audioBuffers.rain = generateNoiseBuffer(2, 'pink');
    audioBuffers.rainHeavy = generateNoiseBuffer(2, 'brown');
    
    // Generate ambient wind sound
    audioBuffers.ambient = generateWindBuffer(4);
    
    // Generate water flow sound
    audioBuffers.waterFlow = generateWaterFlowBuffer(2);
    
    // Generate landslide rumble
    audioBuffers.landslide = generateRumbleBuffer(3);
    
    // Generate tree fall sound
    audioBuffers.treeFall = generateTreeFallBuffer(1.5);
    
    // Generate house collapse sound
    audioBuffers.houseCollapse = generateCollapseBuffer(2);
    
    // Generate thunder
    audioBuffers.thunder = generateThunderBuffer(4);
}

/**
 * Generate noise buffer (white, pink, or brown noise)
 */
function generateNoiseBuffer(duration, type = 'white') {
    const sampleRate = audioContext.sampleRate;
    const length = sampleRate * duration;
    const buffer = audioContext.createBuffer(2, length, sampleRate);
    
    for (let channel = 0; channel < 2; channel++) {
        const data = buffer.getChannelData(channel);
        
        if (type === 'white') {
            for (let i = 0; i < length; i++) {
                data[i] = Math.random() * 2 - 1;
            }
        } else if (type === 'pink') {
            // Pink noise using Paul Kellet's method
            let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
            for (let i = 0; i < length; i++) {
                const white = Math.random() * 2 - 1;
                b0 = 0.99886 * b0 + white * 0.0555179;
                b1 = 0.99332 * b1 + white * 0.0750759;
                b2 = 0.96900 * b2 + white * 0.1538520;
                b3 = 0.86650 * b3 + white * 0.3104856;
                b4 = 0.55000 * b4 + white * 0.5329522;
                b5 = -0.7616 * b5 - white * 0.0168980;
                data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
                b6 = white * 0.115926;
            }
        } else if (type === 'brown') {
            let lastOut = 0;
            for (let i = 0; i < length; i++) {
                const white = Math.random() * 2 - 1;
                data[i] = (lastOut + (0.02 * white)) / 1.02;
                lastOut = data[i];
                data[i] *= 3.5;
            }
        }
    }
    
    return buffer;
}

/**
 * Generate wind ambient buffer
 */
function generateWindBuffer(duration) {
    const sampleRate = audioContext.sampleRate;
    const length = sampleRate * duration;
    const buffer = audioContext.createBuffer(2, length, sampleRate);
    
    for (let channel = 0; channel < 2; channel++) {
        const data = buffer.getChannelData(channel);
        let phase = 0;
        
        for (let i = 0; i < length; i++) {
            // Low frequency modulation for wind "gusts"
            const modFreq = 0.1 + Math.sin(i / sampleRate * 0.05) * 0.05;
            phase += modFreq;
            
            // Filtered noise
            const noise = (Math.random() * 2 - 1) * 0.3;
            const wind = Math.sin(phase) * 0.1 + noise * (0.3 + Math.sin(i / sampleRate * 0.2) * 0.2);
            
            data[i] = wind * 0.4;
        }
    }
    
    return buffer;
}

/**
 * Generate water flow buffer
 */
function generateWaterFlowBuffer(duration) {
    const sampleRate = audioContext.sampleRate;
    const length = sampleRate * duration;
    const buffer = audioContext.createBuffer(2, length, sampleRate);
    
    for (let channel = 0; channel < 2; channel++) {
        const data = buffer.getChannelData(channel);
        let lastSample = 0;
        
        for (let i = 0; i < length; i++) {
            // Filtered noise for water
            const noise = Math.random() * 2 - 1;
            const filtered = lastSample * 0.7 + noise * 0.3;
            lastSample = filtered;
            
            // Add some burble effect
            const burble = Math.sin(i / sampleRate * 800 * (1 + Math.sin(i / sampleRate * 3) * 0.3)) * 0.1;
            
            data[i] = (filtered * 0.5 + burble) * 0.6;
        }
    }
    
    return buffer;
}

/**
 * Generate landslide rumble buffer
 */
function generateRumbleBuffer(duration) {
    const sampleRate = audioContext.sampleRate;
    const length = sampleRate * duration;
    const buffer = audioContext.createBuffer(2, length, sampleRate);
    
    for (let channel = 0; channel < 2; channel++) {
        const data = buffer.getChannelData(channel);
        
        for (let i = 0; i < length; i++) {
            const t = i / length;
            
            // Envelope: quick attack, gradual decay
            const envelope = Math.exp(-t * 2) * (1 - Math.exp(-t * 50));
            
            // Low frequency rumble
            const lowFreq = Math.sin(i / sampleRate * 30 * Math.PI * 2) * 0.5;
            const midFreq = Math.sin(i / sampleRate * 60 * Math.PI * 2) * 0.3;
            
            // Add noise for texture
            const noise = (Math.random() * 2 - 1) * 0.4;
            
            // Random "impacts"
            const impacts = Math.random() < 0.01 ? (Math.random() - 0.5) * 2 : 0;
            
            data[i] = (lowFreq + midFreq + noise + impacts) * envelope;
        }
    }
    
    return buffer;
}

/**
 * Generate tree fall buffer
 */
function generateTreeFallBuffer(duration) {
    const sampleRate = audioContext.sampleRate;
    const length = sampleRate * duration;
    const buffer = audioContext.createBuffer(2, length, sampleRate);
    
    for (let channel = 0; channel < 2; channel++) {
        const data = buffer.getChannelData(channel);
        
        for (let i = 0; i < length; i++) {
            const t = i / length;
            
            // Creaking sound at start
            const creak = t < 0.3 ? Math.sin(i / sampleRate * 200 * (1 + t * 5)) * (0.3 - t) : 0;
            
            // Whoosh sound during fall
            const whoosh = t > 0.2 && t < 0.8 ? 
                (Math.random() * 2 - 1) * Math.sin((t - 0.2) / 0.6 * Math.PI) * 0.5 : 0;
            
            // Impact at end
            const impact = t > 0.7 ? 
                Math.exp(-(t - 0.7) * 20) * Math.sin(i / sampleRate * 80 * Math.PI * 2) * 0.8 : 0;
            
            // Branch snapping
            const snaps = Math.random() < 0.005 && t > 0.7 ? (Math.random() - 0.5) * 1.5 : 0;
            
            data[i] = creak + whoosh + impact + snaps;
        }
    }
    
    return buffer;
}

/**
 * Generate house collapse buffer
 */
function generateCollapseBuffer(duration) {
    const sampleRate = audioContext.sampleRate;
    const length = sampleRate * duration;
    const buffer = audioContext.createBuffer(2, length, sampleRate);
    
    for (let channel = 0; channel < 2; channel++) {
        const data = buffer.getChannelData(channel);
        
        for (let i = 0; i < length; i++) {
            const t = i / length;
            
            // Initial crack
            const crack = t < 0.1 ? 
                Math.exp(-t * 50) * (Math.random() * 2 - 1) : 0;
            
            // Rumbling collapse
            const rumble = Math.exp(-t * 1.5) * (
                Math.sin(i / sampleRate * 40 * Math.PI * 2) * 0.4 +
                (Math.random() * 2 - 1) * 0.5
            );
            
            // Debris impacts
            const debris = Math.random() < 0.02 ? 
                Math.exp(-((t % 0.1) / 0.1) * 10) * (Math.random() - 0.5) * 1.5 : 0;
            
            data[i] = (crack + rumble + debris) * 0.8;
        }
    }
    
    return buffer;
}

/**
 * Generate thunder buffer
 */
function generateThunderBuffer(duration) {
    const sampleRate = audioContext.sampleRate;
    const length = sampleRate * duration;
    const buffer = audioContext.createBuffer(2, length, sampleRate);
    
    for (let channel = 0; channel < 2; channel++) {
        const data = buffer.getChannelData(channel);
        
        for (let i = 0; i < length; i++) {
            const t = i / length;
            
            // Initial crack
            const crack = t < 0.05 ? 
                Math.exp(-t * 100) * (Math.random() * 2 - 1) * 2 : 0;
            
            // Rolling thunder
            const envelope = Math.exp(-t * 1.5) * (1 - Math.exp(-t * 20));
            const roll = envelope * (
                Math.sin(i / sampleRate * 25 * Math.PI * 2 * (1 + t * 0.5)) * 0.3 +
                Math.sin(i / sampleRate * 50 * Math.PI * 2) * 0.2 +
                (Math.random() * 2 - 1) * 0.3
            );
            
            // Echo effect
            const echo = t > 0.5 ? 
                Math.exp(-(t - 0.5) * 2) * (Math.random() * 2 - 1) * 0.2 : 0;
            
            data[i] = crack + roll + echo;
        }
    }
    
    return buffer;
}

/**
 * Start ambient wind loop
 */
function startAmbientLoop() {
    if (!audioBuffers.ambient || !isAudioEnabled) return;
    
    ambientSource = audioContext.createBufferSource();
    ambientSource.buffer = audioBuffers.ambient;
    ambientSource.loop = true;
    ambientSource.connect(ambientGain);
    ambientSource.start();
}

/**
 * Start rain sound based on intensity
 */
export function startRain(intensity = 50) {
    if (!isAudioInitialized || !isAudioEnabled) return;
    
    currentRainIntensity = intensity;
    isRaining = true;
    
    // Stop existing rain source
    if (rainSource) {
        rainSource.stop();
        rainSource = null;
    }
    
    // Select buffer based on intensity
    const buffer = intensity > 70 ? audioBuffers.rainHeavy : audioBuffers.rain;
    
    // Create and start rain source
    rainSource = audioContext.createBufferSource();
    rainSource.buffer = buffer;
    rainSource.loop = true;
    rainSource.connect(rainGain);
    rainSource.start();
    
    // Fade in rain
    const targetGain = (intensity / 100) * 0.6;
    rainGain.gain.cancelScheduledValues(audioContext.currentTime);
    rainGain.gain.setValueAtTime(rainGain.gain.value, audioContext.currentTime);
    rainGain.gain.linearRampToValueAtTime(targetGain, audioContext.currentTime + 1);
}

/**
 * Update rain intensity
 */
export function updateRainIntensity(intensity) {
    if (!isAudioInitialized || !isRaining) return;
    
    currentRainIntensity = intensity;
    const targetGain = (intensity / 100) * 0.6;
    
    rainGain.gain.cancelScheduledValues(audioContext.currentTime);
    rainGain.gain.setValueAtTime(rainGain.gain.value, audioContext.currentTime);
    rainGain.gain.linearRampToValueAtTime(targetGain, audioContext.currentTime + 0.3);
    
    // Switch buffer if crossing threshold
    if (rainSource) {
        const shouldBeHeavy = intensity > 70;
        const currentIsHeavy = rainSource.buffer === audioBuffers.rainHeavy;
        
        if (shouldBeHeavy !== currentIsHeavy) {
            // Crossfade to new buffer
            const oldSource = rainSource;
            const newBuffer = shouldBeHeavy ? audioBuffers.rainHeavy : audioBuffers.rain;
            
            rainSource = audioContext.createBufferSource();
            rainSource.buffer = newBuffer;
            rainSource.loop = true;
            rainSource.connect(rainGain);
            rainSource.start();
            
            setTimeout(() => oldSource.stop(), 500);
        }
    }
}

/**
 * Stop rain sound
 */
export function stopRain() {
    if (!isAudioInitialized) return;
    
    isRaining = false;
    
    // Fade out rain
    rainGain.gain.cancelScheduledValues(audioContext.currentTime);
    rainGain.gain.setValueAtTime(rainGain.gain.value, audioContext.currentTime);
    rainGain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 2);
    
    // Stop source after fade
    setTimeout(() => {
        if (rainSource && !isRaining) {
            rainSource.stop();
            rainSource = null;
        }
    }, 2100);
}

/**
 * Start water flow sound
 */
export function startWaterFlow() {
    if (!isAudioInitialized || !isAudioEnabled || waterFlowSource) return;
    
    waterFlowSource = audioContext.createBufferSource();
    waterFlowSource.buffer = audioBuffers.waterFlow;
    waterFlowSource.loop = true;
    waterFlowSource.connect(waterFlowGain);
    waterFlowSource.start();
    
    // Fade in
    waterFlowGain.gain.cancelScheduledValues(audioContext.currentTime);
    waterFlowGain.gain.linearRampToValueAtTime(0.4, audioContext.currentTime + 0.5);
}

/**
 * Stop water flow sound
 */
export function stopWaterFlow() {
    if (!isAudioInitialized || !waterFlowSource) return;
    
    // Fade out
    waterFlowGain.gain.cancelScheduledValues(audioContext.currentTime);
    waterFlowGain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 1);
    
    const source = waterFlowSource;
    waterFlowSource = null;
    
    setTimeout(() => {
        try { source.stop(); } catch(e) {}
    }, 1100);
}

/**
 * Play landslide sound (one-shot)
 */
export function playLandslideSound(volume = 0.8) {
    if (!isAudioInitialized || !isAudioEnabled) return;
    
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffers.landslide;
    
    const gain = audioContext.createGain();
    gain.gain.value = volume;
    
    source.connect(gain);
    gain.connect(effectsGain);
    source.start();
}

/**
 * Play tree fall sound
 */
export function playTreeFallSound(volume = 0.6) {
    if (!isAudioInitialized || !isAudioEnabled) return;
    
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffers.treeFall;
    
    const gain = audioContext.createGain();
    gain.gain.value = volume;
    
    // Add slight pitch variation
    source.playbackRate.value = 0.9 + Math.random() * 0.2;
    
    source.connect(gain);
    gain.connect(effectsGain);
    source.start();
}

/**
 * Play house collapse sound
 */
export function playHouseCollapseSound(volume = 0.9) {
    if (!isAudioInitialized || !isAudioEnabled) return;
    
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffers.houseCollapse;
    
    const gain = audioContext.createGain();
    gain.gain.value = volume;
    
    source.connect(gain);
    gain.connect(effectsGain);
    source.start();
}

/**
 * Play thunder sound (random timing)
 */
export function playThunder(volume = 0.7) {
    if (!isAudioInitialized || !isAudioEnabled) return;
    
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffers.thunder;
    
    const gain = audioContext.createGain();
    gain.gain.value = volume * (0.5 + Math.random() * 0.5);
    
    source.connect(gain);
    gain.connect(masterGain);
    source.start();
}

/**
 * Set master volume
 */
export function setMasterVolume(volume) {
    if (!masterGain) return;
    masterGain.gain.value = Math.max(0, Math.min(1, volume));
}

/**
 * Toggle audio on/off
 */
export function toggleAudio(enabled) {
    isAudioEnabled = enabled;
    
    if (masterGain) {
        masterGain.gain.value = enabled ? 0.7 : 0;
    }
    
    console.log(`Audio ${enabled ? 'enabled' : 'disabled'}`);
}

/**
 * Check if audio is initialized
 */
export function isAudioReady() {
    return isAudioInitialized;
}

/**
 * Resume audio context (needed after user interaction)
 */
export async function resumeAudio() {
    if (audioContext && audioContext.state === 'suspended') {
        await audioContext.resume();
    }
}
