// File: /static/js/app.js
// The main orchestrator that wires everything together.

import { EventManager } from './EventManager.js';
export const eventBus = new EventManager();

import { SceneManager } from './SceneManager.js';
import { UIManager } from './UIManager.js';
import { loadProjects, loadRuns, loadRun } from './DataLoader.js';

// We'll have some global references to the managers
let sceneManager, uiManager;

window.onload = async function () {
  // 1) Initialize the Scene
  sceneManager = new SceneManager('threejs-container');

  // 2) Initialize the UIManager
  uiManager = new UIManager(sceneManager);

  // 3) Hook up UI events (buttons, selects, camera controls, etc.)
  setupUI();

  // 4) Load the projects right away
  await loadProjects();
};

/*************************************************
 * SETUP UI - hooking up existing button logic
 *************************************************/
function setupUI() {
  // generic helper to bind a click if element exists
  const bindButton = (id, fn) =>
    document.getElementById(id)?.addEventListener('click', fn);

  // reset MACs
  bindButton('resetButton', () => eventBus.notify('resetMACs'));

  // project dropdown
  const projectSelect = document.getElementById('projectSelect');
  if (projectSelect) {
    projectSelect.addEventListener('change', function () {
      const selectedProject = this.value;
      if (!selectedProject) return;

      document.getElementById('visualizeButton').disabled = true;
      const runSelect = document.getElementById('runSelect');
      runSelect.disabled = true;
      runSelect.innerHTML =
        '<option value="" disabled selected>Loading runs...</option>';

      fetch(`/api/update-project/${selectedProject}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }).catch(console.error);

      console.log(`Updated project selection to ${selectedProject}`);
      loadRuns(selectedProject);
    });
  }

  // run dropdown
  const runSelect = document.getElementById('runSelect');
  if (runSelect) {
    runSelect.addEventListener('change', function () {
      const sel = this.value;
      if (!sel) return;
      fetch(
        `/api/update-run/${projectSelect.value}/${sel}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      ).catch(console.error);
      console.log(`Updated run selection to ${sel}`);
    });
  }

  // visualize button
  bindButton('visualizeButton', () => loadRun());

  // camera controls
  bindButton('panButton', () => {
    sceneManager.setControls({ rotate: false, pan: true });
    console.log('Pan mode enabled');
  });

  bindButton('bothButton', () => {
    sceneManager.setControls({
      rotate: true,
      pan: true,
      azimuth: [-Infinity, Infinity],
      polar: [0, Math.PI],
    });
    console.log('Default mode enabled (rotate & pan)');
  });

  bindButton('resetControls', () => {
    sceneManager.setControls({
      rotate: true,
      pan: true,
      azimuth: [-Infinity, Infinity],
      polar: [0, Math.PI],
    });
    sceneManager.controls.reset();
    console.log('Controls reset');
  });
}

/*************************************************
 * EVENT SUBSCRIPTIONS
 *************************************************/

// When new visualization data arrives
eventBus.subscribe('newVisualizationData', async (data) => {
  // data.layers, data.input_dimensions, data.input_activations

  // STEP A: Fetch history and parse step-0 before drawing
  const proj = document.getElementById('projectSelect').value;
  const run = document.getElementById('runSelect').value;
  const resp = await fetch(`/api/${proj}/${run}/history`);
  const { step_history } = await resp.json();

  // Cache for future steps
  window._sparsey_stepHistory = step_history;

  // Determine sorted steps and pick the first
  const steps = Object.keys(step_history)
    .map((n) => parseInt(n, 10))
    .sort((a, b) => a - b);
  const initialStep = steps[0];
  const initialData = step_history[initialStep] || {};

  // STEP A1: Fetch weighted connections for the initial step
  const respW = await fetch(
    `/api/${proj}/${run}/${initialStep}/weight_connections`
  );
  window._sparsey_weightConnections = await respW.json();

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
      const idx = parseInt(m[2], 10) - 1; // history is 1-based
      macActs0[layerKey] = macActs0[layerKey] || {};
      macActs0[layerKey][idx] = val ? 1 : 0;
    }
  });

  // ── NEW ── Parse MAC activation *probabilities* at step 0
  const macProbs0 = {};
  Object.entries(initialData).forEach(([key, val]) => {
    const m = key.match(/^num_activations\/layer_(\d+)\/mac_(\d+)$/);
    if (m) {
      const layerKey = `layer_${m[1]}`;
      const idx = parseInt(m[2], 10) - 1; // make zero-based
      macProbs0[layerKey] = macProbs0[layerKey] || {};
      macProbs0[layerKey][idx] = parseFloat(val) || 0;
    }
  });

  // Parse neuron activations (step 0)
  const neuronActs0 = {};
  Object.entries(initialData).forEach(([key, val]) => {
    const m = key.match(
      /^neuron_activations\/layer_(\d+)\/mac_(\d+)\/cm_(\d+)\/neuron_(\d+)$/
    );
    if (!m) return;
    const [, L, M, C, N] = m.map((v, i) => (i === 0 ? v : parseInt(v, 10)));
    const layerKey = `layer_${L}`;
    neuronActs0[layerKey] ||= {};
    neuronActs0[layerKey][M] ||= {};
    neuronActs0[layerKey][M][C] ||= {};
    neuronActs0[layerKey][M][C][N] = !!val;
  });

  // STEP B: Build scene & grid based on step-0
  uiManager.buildFromLayers(
    data.layers,
    data.input_dimensions,
    pixelActs0 // pass step-0 pixel data so grid is drawn immediately
  );

  // Color MACs and draw bar-graphs for step 0
  uiManager.updateMacActivations(macActs0);
  uiManager.updateMacProbabilities(macProbs0);
  uiManager.updateNeuronActivations(neuronActs0);

  // Build and display weighted connections for initial step
  uiManager.buildWeightedConnectionsForStep(initialStep);
  uiManager.refreshConnectionVisibility();

  // STEP C: Populate dropdown without auto-trigger
  const inputSelect = document.getElementById('inputSelect');
  inputSelect.innerHTML = '';
  steps.forEach((step) => {
    const opt = document.createElement('option');
    opt.value = step;
    opt.textContent = `Input ${step}`;
    inputSelect.appendChild(opt);
  });
  inputSelect.disabled = false;

    // Install listener for future steps
  inputSelect.addEventListener('change', async () => {
    const sel = parseInt(inputSelect.value, 10);

    // Fetch new weight connections
    const respW2 = await fetch(
      `/api/${proj}/${run}/${sel}/weight_connections`
    );
    window._sparsey_weightConnections = await respW2.json();

    const stepData = window._sparsey_stepHistory[sel] || {};

    // Update input grid
    const pixelActs = {};
    Object.entries(stepData).forEach(([key, val]) => {
      const m = key.match(/^input_activations\/pixel_(\d+)$/);
      if (m) pixelActs[+m[1]] = val ? 1 : 0;
    });
    uiManager.updateInputGrid(pixelActs);

    // Parse MAC activations (on/off)
    const macActs = {};
    Object.entries(stepData).forEach(([key, val]) => {
      const m = key.match(/^neuron_activations\/layer_(\d+)\/mac_(\d+)$/);
      if (m) {
        const layerKey = `layer_${m[1]}`;
        const idx = parseInt(m[2], 10) - 1;
        macActs[layerKey] = macActs[layerKey] || {};
        macActs[layerKey][idx] = val ? 1 : 0;
      }
    });

    // Parse neuron activations
    const neuronActs = {};
    Object.entries(stepData).forEach(([key, val]) => {
      const m = key.match(
        /^neuron_activations\/layer_(\d+)\/mac_(\d+)\/cm_(\d+)\/neuron_(\d+)$/
      );
      if (!m) return;
      const [, L, M, C, N] = m.map((v, i) => (i === 0 ? v : parseInt(v, 10)));
      const layerKey = `layer_${L}`;
      neuronActs[layerKey] ||= {};
      neuronActs[layerKey][M] ||= {};
      neuronActs[layerKey][M][C] ||= {};
      neuronActs[layerKey][M][C][N] = !!val;
    });
    uiManager.updateNeuronActivations(neuronActs);

    // ── NEW ── Compute true MAC activation probabilities from neuronActs
    const macProbs = {};
    Object.entries(neuronActs).forEach(([layerKey, macs]) => {
      macProbs[layerKey] = {};
      Object.entries(macs).forEach(([macIdx, cms]) => {
        const fired = Object.values(cms).flatMap(cm => Object.values(cm));
        const countFired = fired.filter(Boolean).length;
        const total = fired.length;
        // Use zero-based index so bar[0] maps to mac_1, bar[1] → mac_2, etc.
        const zeroIdx = parseInt(macIdx, 10) - 1;
        macProbs[layerKey][zeroIdx] = total ? countFired/total : 0;
      });
    });
    uiManager.updateMacProbabilities(macProbs);

    // First update the MAC visuals, then color them on/off
    uiManager.updateMacActivations(macActs);

    // Rebuild weighted connections for selected step
    uiManager.buildWeightedConnectionsForStep(sel);
    uiManager.refreshConnectionVisibility();
  });
});

// Optionally clear side panel before load
eventBus.subscribe('clearSidePanel', () => {
  uiManager.clearSidePanel();
});
