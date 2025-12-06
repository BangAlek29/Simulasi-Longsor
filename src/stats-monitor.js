/**
 * Stats Monitor Module
 * Menampilkan FPS dan memory stats
 */

import Stats from 'stats.js';

let stats = null;
let statsEnabled = true;

/**
 * Initialize stats panel
 */
export function initStats() {
    stats = new Stats();
    stats.showPanel(0); // 0: fps, 1: ms, 2: mb
    
    // Style the stats panel
    stats.dom.style.position = 'absolute';
    stats.dom.style.left = '16px';
    stats.dom.style.top = '16px';
    stats.dom.style.zIndex = '100';
    
    document.body.appendChild(stats.dom);
    
    console.log('📊 Stats monitor initialized');
    
    return stats;
}

/**
 * Begin stats measurement (call at start of frame)
 */
export function beginStats() {
    if (stats && statsEnabled) {
        stats.begin();
    }
}

/**
 * End stats measurement (call at end of frame)
 */
export function endStats() {
    if (stats && statsEnabled) {
        stats.end();
    }
}

/**
 * Toggle stats visibility
 */
export function setStatsEnabled(enabled) {
    statsEnabled = enabled;
    if (stats) {
        stats.dom.style.display = enabled ? 'block' : 'none';
    }
}

/**
 * Check if stats are enabled
 */
export function isStatsEnabled() {
    return statsEnabled;
}

/**
 * Switch stats panel (0: fps, 1: ms, 2: mb)
 */
export function switchStatsPanel(panel) {
    if (stats) {
        stats.showPanel(panel);
    }
}
