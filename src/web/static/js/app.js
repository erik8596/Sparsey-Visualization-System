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

  // Camera control buttons (pan, both, resetControls)
  const panButton = document.getElementById('panButton');
  if (panButton) {
    panButton.addEventListener('click', () => {
      sceneManager.controls.enableRotate = false;
      sceneManager.controls.enablePan = true;
      sceneManager.controls.mouseButtons = {
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN
      };
      console.log('Pan mode enabled');
    });
  }

  const bothButton = document.getElementById('bothButton');
  if (bothButton) {
    bothButton.addEventListener('click', () => {
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
      console.log('Default mode enabled (rotate & pan)');
    });
  }

  const resetControls = document.getElementById('resetControls');
  if (resetControls) {
    resetControls.addEventListener('click', () => {
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
      console.log('Controls reset');
    });
  }
}

/*************************************************
 * EVENT SUBSCRIPTIONS
 *************************************************/

// If we get new data from the server for visualization
eventBus.subscribe('newVisualizationData', async (data) => {
  // data.layers, data.input_dimensions, data.input_activations

  // STEP A: Fetch history and parse step-0 before drawing
  const proj = document.getElementById('projectSelect').value;
  const run  = document.getElementById('runSelect').value;
  const resp = await fetch(`/api/${proj}/${run}/history`);
  const { step_history } = await resp.json();

  // Cache for future steps
  window._sparsey_stepHistory = step_history;

  // Determine sorted steps and pick the first
  const steps = Object.keys(step_history)
    .map(n => parseInt(n, 10))
    .sort((a, b) => a - b);
  const initialStep = steps[0];
  const initialData = step_history[initialStep] || {};

  // Parse input activations at step 0
  const pixelActs0 = {};
  Object.entries(initialData).forEach(([key, val]) => {
    const m = key.match(/^input_activations\/pixel_(\d+)$/);
    if (m) pixelActs0[+m[1]] = val ? 1 : 0;
  });

  // Parse MAC activations (neuron_activations) at step 0
  const macActs0 = {};
  Object.entries(initialData).forEach(([key, val]) => {
    const m = key.match(/^neuron_activations\/layer_(\d+)\/mac_(\d+)$/);
    if (m) {
      const layerKey = `layer_${m[1]}`;
      const idx      = parseInt(m[2], 10) - 1; // history is 1-based
      macActs0[layerKey] = macActs0[layerKey] || {};
      macActs0[layerKey][idx] = val ? 1 : 0;
    }
  });

  // Parse neuron activations (step 0)
  const neuronActs0 = {};
  Object.entries(initialData).forEach(([key,val]) => {
    const m = key.match(
      /^neuron_activations\/layer_(\d+)\/mac_(\d+)\/cm_(\d+)\/neuron_(\d+)$/
    );
    if (!m) return;
    const [, L, M, C, N] = m.map((v,i) =>
      i===0 ? v : parseInt(v,10)
    );
    const layerKey = `layer_${L}`;
    neuronActs0[layerKey]           ||= {};
    neuronActs0[layerKey][M]       ||= {};
    neuronActs0[layerKey][M][C]    ||= {};
    neuronActs0[layerKey][M][C][N]  = !!val;
  });

  // STEP B: Build scene & grid based on step-0
  uiManager.buildFromLayers(
    data.layers,
    data.input_dimensions,
    pixelActs0          // <— pass step-0 pixel data so grid is drawn immediately
  );

  // Color MACs for step 0
  uiManager.updateMacActivations(macActs0);
  uiManager.updateNeuronActivations(neuronActs0);

  // STEP C: Populate dropdown without auto-trigger
  const inputSelect = document.getElementById('inputSelect');
  inputSelect.innerHTML = '';
  steps.forEach(step => {
    const opt = document.createElement('option');
    opt.value = step;
    opt.textContent = `Input ${step}`;
    inputSelect.appendChild(opt);
  });
  inputSelect.disabled = false;

  // Install listener for future steps
  inputSelect.addEventListener('change', () => {
    const sel      = parseInt(inputSelect.value, 10);
    const stepData = window._sparsey_stepHistory[sel] || {};

    // Update input grid
    const pixelActs = {};
    Object.entries(stepData).forEach(([key, val]) => {
      const m = key.match(/^input_activations\/pixel_(\d+)$/);
      if (m) pixelActs[+m[1]] = val ? 1 : 0;
    });
    uiManager.updateInputGrid(pixelActs);

    // Update MAC activations
    const macActs = {};
    Object.entries(stepData).forEach(([key, val]) => {
      const m = key.match(/^neuron_activations\/layer_(\d+)\/mac_(\d+)$/);
      if (m) {
        const layerKey = `layer_${m[1]}`;
        const idx      = parseInt(m[2], 10) - 1;
        macActs[layerKey] = macActs[layerKey] || {};
        macActs[layerKey][idx] = val ? 1 : 0;
      }
    });
    console.log(' → macActs:', macActs);
    uiManager.updateMacActivations(macActs);

    // Update neuron activations
    const neuronActs = {};
    Object.entries(stepData).forEach(([key,val]) => {
      const m = key.match(
        /^neuron_activations\/layer_(\d+)\/mac_(\d+)\/cm_(\d+)\/neuron_(\d+)$/
      );
      if (!m) return;
      const [, L, M, C, N] = m.map((v,i) =>
        i===0 ? v : parseInt(v,10)
      );
      const layerKey = `layer_${L}`;
      neuronActs[layerKey]           ||= {};
      neuronActs[layerKey][M]       ||= {};
      neuronActs[layerKey][M][C]    ||= {};
      neuronActs[layerKey][M][C][N]  = !!val;
    });
    console.log(' → neuronActs:', neuronActs);
    uiManager.updateNeuronActivations(neuronActs);
  });
});

// Optionally clear side panel if we want to do that before load
eventBus.subscribe('clearSidePanel', () => {
  uiManager.clearSidePanel();
});
