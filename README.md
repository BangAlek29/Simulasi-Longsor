# Landslide Simulation

Interactive 3D simulation of landslides and flash floods, built with Three.js — sculpt terrain, plant trees and settlements, then watch rain-driven erosion and water flow reshape the landscape in real time.

![JavaScript](https://img.shields.io/badge/JavaScript-ES6-yellow)
![Three.js](https://img.shields.io/badge/Three.js-0.181-000000)
![Vite](https://img.shields.io/badge/Vite-7-646CFF)
![License](https://img.shields.io/badge/License-MIT-green)

## Features

- **Two simulation modes** — landslide and flash-flood scenarios with adjustable flood discharge and intensity
- **Dynamic terrain** — procedurally generated landscape (simplex noise) with real-time water flow and erosion
- **Settlement editing** — add or remove trees and houses; visualize settlement impact and citizen-safety status
- **Multiple camera views** — top, settlement, peak, and side angles
- **Interactive controls** — camera pan/rotate via mouse (Ctrl + click), drag-and-resize UI panel
- **Postprocessing effects** — toggleable visual effects and ambient audio
- **Stats monitor** — live FPS and rendering stats

## Tech Stack

| Area | Technology |
|---|---|
| Rendering | Three.js 0.181, three-mesh-bvh |
| Physics | cannon-es |
| Animation | GSAP, @tweenjs/tween.js |
| Terrain | simplex-noise |
| Postprocessing | postprocessing |
| Tooling | Vite 7 |

## Project Structure

```
├── index.html
├── src/
│   ├── main.js                # entry point — panel, scene, render loop
│   ├── scene.js               # scene setup and animation loop
│   ├── terrain.js             # procedural terrain generation
│   ├── physics.js             # physics world and rigid bodies
│   ├── water.js               # water flow and flood simulation
│   ├── rain.js                # rain particle system
│   ├── landslide.js           # landslide dynamics
│   ├── houses.js              # settlement placement
│   ├── trees.js               # vegetation placement
│   ├── atmosphere.js          # sky and lighting
│   ├── effects.js             # postprocessing effects
│   ├── audio.js               # ambient audio
│   ├── interaction.js         # mouse/camera interactions
│   ├── simulation-controller.js  # simulation mode and parameters
│   ├── stats-monitor.js       # FPS stats overlay
│   ├── ui-panel.js            # draggable control panel
│   └── ui.js                  # UI wiring
├── vercel.json                # Vercel deployment config
└── vite.config.js
```

## Installation

```bash
git clone https://github.com/dzikribassyril/landslide-simulation.git
cd landslide-simulation
npm install
```

## Usage

```bash
npm run dev
```

Open `http://localhost:3000` in a browser. Use the control panel to switch simulation modes, add or remove trees and houses, adjust flood parameters, and switch camera angles.

To build for production:

```bash
npm run build
npm run preview
```

## License

MIT — see [LICENSE](LICENSE).
