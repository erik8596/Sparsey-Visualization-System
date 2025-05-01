// /static/js/app.js
// The main orchestrator that wires everything together.

import { EventManager } from './EventManager.js';
export const eventBus = new EventManager();

import { SceneManager } from './SceneManager.js';
import { UIManager } from './UIManager.js';
// import { MacManager } from './MACManager.js';
import { loadProjects, loadRuns, loadRun } from './DataLoader.js';

// We'll have some global references to the managers
let sceneManager, uiManager;

window.onload = async function () {
  // 1) Initialize the Scene
  sceneManager = new SceneManager('threejs-container');

  // 2) Initialize the MacManager
  uiManager = new UIManager(sceneManager);

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
    projectSelect.addEventListener('change', function () {
      const selectedProject = this.value;
      if (selectedProject) {
        document.getElementById('visualizeButton').disabled = true;
        const runSelect = document.getElementById('runSelect');
        runSelect.disabled = true;
        runSelect.innerHTML = '<option value="" disabled selected>Loading runs...</option>';
        // Update project selection on server
        fetch(`/api/update-project/${selectedProject}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }).catch(error => {
          console.error('Error updating project selection:', error);
        });
        console.log(`Updated project selection to ${selectedProject}`);
        loadRuns(selectedProject);
      }
    });
  }

  // RunSelect => loadRun
  const runSelect = document.getElementById('runSelect');
  if (runSelect) {
    runSelect.addEventListener('change', function () {
      const selectedRun = this.value;
      if (selectedRun) {
        // Update run selection on server
        fetch(`/api/update-run/${projectSelect.value}/${selectedRun}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }).catch(error => {
          console.error('Error updating run selection:', error);
        });
        console.log(`Updated run selection to ${selectedRun}`);
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
eventBus.subscribe('newVisualizationData', async (data) => {
  // data.layers, data.input_dimensions
  // MacManager can build the scene
  uiManager.buildFromLayers(
    data.layers,
    data.input_dimensions,     // e.g. { width: 28, height: 28 }
    data.input_activations     // dictionary {1: 1, 2: 0, ...}
  );

  // If we have valid input_dimensions, create the input grid
  const dims = data.input_dimensions;
  if (dims && dims.width && dims.height) {
    uiManager.createInputGrid(dims.width, dims.height, data.input_activations);
  } else {
    console.error("Invalid input dimensions:", dims);
  }

  // 2) Fetch the full history so we know all the steps
  const proj = document.getElementById('projectSelect').value;
  const run  = document.getElementById('runSelect').value;
  const resp = await fetch(`/api/${proj}/${run}/history`);
  const { step_history } = await resp.json();

  // 3) Populate the dropdown with actual step numbers
  const inputSelect = document.getElementById('inputSelect');
  inputSelect.innerHTML = '';            // clear dummy entries
  const steps = Object.keys(step_history)
    .map(n => parseInt(n, 10))
    .sort((a, b) => a - b);
  steps.forEach(step => {
    const opt = document.createElement('option');
    opt.value = step;
    opt.textContent = `Input ${step}`;
    inputSelect.appendChild(opt);
  });
  inputSelect.disabled = false;

  // 4) On selection, re-draw the grid for that step
  inputSelect.onchange = () => {
    const sel = parseInt(inputSelect.value, 10);
    const stepData = step_history[sel] || {};
    const activations = {};
    // pick out only the pixel entries
    Object.entries(stepData).forEach(([key, val]) => {
      const m = key.match(/^input_activations\/pixel_(\d+)$/);
      if (m) activations[+m[1]] = val ? 1 : 0;
    });
    uiManager.updateInputGrid(activations);
  };
});

// Optionally clear side panel if we want to do that before load
eventBus.subscribe('clearSidePanel', () => {
  uiManager.clearSidePanel();
});
