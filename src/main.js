import { initScene, animate } from './scene.js';
import { initPanelControls } from './ui-panel.js';

// Inisialisasi panel UI controls (drag, resize, minimize)
initPanelControls();

// Inisialisasi scene
initScene();

// Loop render
animate();
