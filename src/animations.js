/**
 * Animation Effects Module
 * Menggunakan GSAP untuk animasi smooth
 */

import gsap from 'gsap';
import * as THREE from 'three';

// Animation timelines
let cameraTimeline = null;
let uiTimeline = null;

/**
 * Animate camera to a target position smoothly
 */
export function animateCameraTo(camera, controls, targetPosition, targetLookAt, duration = 2) {
    // Kill existing camera animation
    if (cameraTimeline) {
        cameraTimeline.kill();
    }
    
    cameraTimeline = gsap.timeline();
    
    // Animate camera position
    cameraTimeline.to(camera.position, {
        x: targetPosition.x,
        y: targetPosition.y,
        z: targetPosition.z,
        duration: duration,
        ease: 'power2.inOut',
        onUpdate: () => {
            camera.updateProjectionMatrix();
        }
    }, 0);
    
    // Animate controls target (look at)
    if (controls && targetLookAt) {
        cameraTimeline.to(controls.target, {
            x: targetLookAt.x,
            y: targetLookAt.y,
            z: targetLookAt.z,
            duration: duration,
            ease: 'power2.inOut'
        }, 0);
    }
    
    return cameraTimeline;
}

/**
 * Camera shake effect (for landslide impact)
 */
export function cameraShake(camera, intensity = 0.5, duration = 0.5) {
    const originalPosition = camera.position.clone();
    
    const timeline = gsap.timeline({
        onComplete: () => {
            // Return to original position
            camera.position.copy(originalPosition);
        }
    });
    
    // Multiple shake keyframes
    const shakeCount = Math.floor(duration * 20);
    const stepDuration = duration / shakeCount;
    
    for (let i = 0; i < shakeCount; i++) {
        const decay = 1 - (i / shakeCount); // Decay over time
        const offset = {
            x: (Math.random() - 0.5) * intensity * decay,
            y: (Math.random() - 0.5) * intensity * decay * 0.5,
            z: (Math.random() - 0.5) * intensity * decay
        };
        
        timeline.to(camera.position, {
            x: originalPosition.x + offset.x,
            y: originalPosition.y + offset.y,
            z: originalPosition.z + offset.z,
            duration: stepDuration,
            ease: 'none'
        });
    }
    
    return timeline;
}

/**
 * Animate object scale (pop in effect)
 */
export function animateScaleIn(object, duration = 0.5, delay = 0) {
    object.scale.set(0, 0, 0);
    
    return gsap.to(object.scale, {
        x: 1,
        y: 1,
        z: 1,
        duration: duration,
        delay: delay,
        ease: 'back.out(1.7)'
    });
}

/**
 * Animate object scale out (disappear effect)
 */
export function animateScaleOut(object, duration = 0.3, onComplete = null) {
    return gsap.to(object.scale, {
        x: 0,
        y: 0,
        z: 0,
        duration: duration,
        ease: 'back.in(1.7)',
        onComplete: onComplete
    });
}

/**
 * Animate object falling with bounce
 */
export function animateFall(object, targetY, duration = 1) {
    return gsap.to(object.position, {
        y: targetY,
        duration: duration,
        ease: 'bounce.out'
    });
}

/**
 * Animate color transition
 */
export function animateColor(material, targetColor, duration = 1) {
    const target = new THREE.Color(targetColor);
    
    return gsap.to(material.color, {
        r: target.r,
        g: target.g,
        b: target.b,
        duration: duration,
        ease: 'power2.inOut'
    });
}

/**
 * Animate opacity
 */
export function animateOpacity(material, targetOpacity, duration = 0.5) {
    return gsap.to(material, {
        opacity: targetOpacity,
        duration: duration,
        ease: 'power2.inOut'
    });
}

/**
 * Pulse animation (for warnings)
 */
export function pulseObject(object, scale = 1.2, duration = 0.5) {
    return gsap.to(object.scale, {
        x: scale,
        y: scale,
        z: scale,
        duration: duration,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut'
    });
}

/**
 * Stop pulse animation
 */
export function stopPulse(object) {
    gsap.killTweensOf(object.scale);
    object.scale.set(1, 1, 1);
}

/**
 * Floating animation (for UI elements in 3D)
 */
export function floatAnimation(object, amplitude = 0.5, duration = 2) {
    const startY = object.position.y;
    
    return gsap.to(object.position, {
        y: startY + amplitude,
        duration: duration,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut'
    });
}

/**
 * Rotate animation
 */
export function rotateAnimation(object, axis = 'y', duration = 4) {
    const rotation = { value: 0 };
    
    return gsap.to(rotation, {
        value: Math.PI * 2,
        duration: duration,
        repeat: -1,
        ease: 'none',
        onUpdate: () => {
            object.rotation[axis] = rotation.value;
        }
    });
}

/**
 * Staggered animation for multiple objects
 */
export function staggerScaleIn(objects, duration = 0.5, stagger = 0.1) {
    objects.forEach(obj => obj.scale.set(0, 0, 0));
    
    return gsap.to(objects.map(o => o.scale), {
        x: 1,
        y: 1,
        z: 1,
        duration: duration,
        stagger: stagger,
        ease: 'back.out(1.7)'
    });
}

/**
 * Animate UI panel
 */
export function animateUIPanel(element, show = true) {
    if (show) {
        gsap.fromTo(element, 
            { opacity: 0, x: 50 },
            { opacity: 1, x: 0, duration: 0.5, ease: 'power2.out' }
        );
    } else {
        gsap.to(element, {
            opacity: 0,
            x: 50,
            duration: 0.3,
            ease: 'power2.in'
        });
    }
}

/**
 * Typewriter effect for text
 */
export function typewriterEffect(element, text, duration = 2) {
    element.textContent = '';
    
    return gsap.to(element, {
        duration: duration,
        text: {
            value: text,
            delimiter: ''
        },
        ease: 'none'
    });
}

/**
 * Number counter animation
 */
export function animateNumber(element, targetValue, duration = 1, prefix = '', suffix = '') {
    const obj = { value: parseFloat(element.textContent) || 0 };
    
    return gsap.to(obj, {
        value: targetValue,
        duration: duration,
        ease: 'power2.out',
        onUpdate: () => {
            element.textContent = prefix + Math.round(obj.value) + suffix;
        }
    });
}

/**
 * Camera preset positions
 */
export const CAMERA_PRESETS = {
    overview: {
        position: new THREE.Vector3(60, 45, 70),
        lookAt: new THREE.Vector3(0, 10, 0)
    },
    peak: {
        position: new THREE.Vector3(0, 50, -40),
        lookAt: new THREE.Vector3(0, 30, -30)
    },
    settlement: {
        position: new THREE.Vector3(30, 20, 50),
        lookAt: new THREE.Vector3(0, 5, 40)
    },
    side: {
        position: new THREE.Vector3(80, 30, 0),
        lookAt: new THREE.Vector3(0, 15, 0)
    },
    top: {
        position: new THREE.Vector3(0, 100, 0),
        lookAt: new THREE.Vector3(0, 0, 0)
    }
};

/**
 * Animate camera to preset
 */
export function goToPreset(camera, controls, presetName, duration = 2) {
    const preset = CAMERA_PRESETS[presetName];
    if (preset) {
        return animateCameraTo(camera, controls, preset.position, preset.lookAt, duration);
    }
    return null;
}
