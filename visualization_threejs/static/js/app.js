// /static/js/app.js
// The main orchestrator that wires everything together.

import { EventManager } from './EventManager.js';
export const eventBus = new EventManager();

import { SceneManager } from './SceneManager.js';
import { MacManager } from './MACManager.js';
import { loadProjects, loadRuns, loadRun } from './DataLoader.js';

// We'll have some global references to the managers
let sceneManager, macManager;

window.onload = async function() {
  // 1) Initialize the Scene
  sceneManager = new SceneManager('threejs-container');

  // 2) Initialize the MacManager
  macManager = new MacManager(sceneManager);

  // 3) Hook up UI events for camera controls, reset button, etc.
  setupUI();

  // 4) Load the projects right away
  await loadProjects();
};

/*************************************************
 * SETUP UI - hooking up existing button logic
 *************************************************/
function setupUI() {
  // Called once on page load

  // "Reset MACs" button => publish event (MacManager is subscribed)
  const resetButton = document.getElementById('resetButton');
  if (resetButton) {
    resetButton.addEventListener('click', () => eventBus.notify('resetMACs'));
  }

  // ProjectSelect => loadRuns
  const projectSelect = document.getElementById('projectSelect');
  if (projectSelect) {
    projectSelect.addEventListener('change', function() {
      const selectedProject = this.value;
      if (selectedProject) {
        document.getElementById('visualizeButton').disabled = true;
        const runSelect = document.getElementById('runSelect');
        runSelect.disabled = true;
        runSelect.innerHTML = '<option value="" disabled selected>Loading runs...</option>';
        loadRuns(selectedProject);
      }
    });
  }

  // "Visualize" button => calls loadRun
  const visualizeButton = document.getElementById('visualizeButton');
  if (visualizeButton) {
    visualizeButton.addEventListener('click', () => loadRun());
  }

  // Camera control buttons
  const panButton = document.getElementById("panButton");
  if (panButton) {
    panButton.addEventListener("click", () => {
      sceneManager.controls.enableRotate = false;
      sceneManager.controls.enablePan = true;
      sceneManager.controls.mouseButtons = {
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN
      };
      console.log("Pan mode enabled");
    });
  }

  const bothButton = document.getElementById("bothButton");
  if (bothButton) {
    bothButton.addEventListener("click", () => {
      sceneManager.controls.enableRotate = true;
      sceneManager.controls.enablePan = true;
      sceneManager.controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN
      };
      // Reset angle limitations
      sceneManager.controls.minAzimuthAngle = -Infinity;
      sceneManager.controls.maxAzimuthAngle = Infinity;
      sceneManager.controls.minPolarAngle = 0;
      sceneManager.controls.maxPolarAngle = Math.PI;
      console.log("Default mode enabled (rotate & pan)");
    });
  }

  const resetControls = document.getElementById("resetControls");
  if (resetControls) {
    resetControls.addEventListener("click", () => {
      sceneManager.controls.enableRotate = true;
      sceneManager.controls.enablePan = true;
      sceneManager.controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN
      };
      sceneManager.controls.minAzimuthAngle = -Infinity;
      sceneManager.controls.maxAzimuthAngle = Infinity;
      sceneManager.controls.minPolarAngle = 0;
      sceneManager.controls.maxPolarAngle = Math.PI;
      sceneManager.controls.reset();
      console.log("Controls reset");
    });
  }
}

/*************************************************
 * EVENT SUBSCRIPTIONS
 *************************************************/

// If we get new data from the server for visualization
eventBus.subscribe('newVisualizationData', (data) => {
  // data.layers, data.input_dimensions
  // MacManager can build the scene
  macManager.buildFromLayers(data.layers);

  // If we have valid input_dimensions, create the input grid
  const dims = data.input_dimensions;
  if (dims && dims.width && dims.height) {
    macManager.createInputGrid(dims.width, dims.height);
  } else {
    console.error("Invalid input dimensions:", dims);
  }
});

// Optionally clear side panel if we want to do that before load
eventBus.subscribe('clearSidePanel', () => {
  macManager.clearSidePanel();
});
