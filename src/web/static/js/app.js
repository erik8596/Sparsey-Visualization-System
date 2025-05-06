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
  const proj = document.getElementById('projectSelect').value;
  const run  = document.getElementById('runSelect').value;

  // STEP A: Fetch history and pick step 0
  const histResp = await fetch(`/api/${proj}/${run}/history`);
  const { step_history } = await histResp.json();
  window._sparsey_stepHistory = step_history;

  const steps = Object.keys(step_history)
    .map(n => parseInt(n, 10))
    .sort((a, b) => a - b);
  const initialStep = steps[0];
  const initialData = step_history[initialStep] || {};

  // STEP B: Fetch weight connections & activation probabilities in parallel
  const [wcResp, apResp] = await Promise.all([
    fetch(`/api/${proj}/${run}/${initialStep}/weight_connections`),
    fetch(`/api/${proj}/${run}/${initialStep}/activation_probabilities`)
  ]);
  window._sparsey_weightConnections = await wcResp.json();
  const rawProbs0 = await apResp.json();

  // STEP C: Parse all activation maps BEFORE UI updates
  // C1) input activations
  const pixelActs0 = {};
  Object.entries(initialData).forEach(([key, val]) => {
    const m = key.match(/^input_activations\/pixel_(\d+)$/);
    if (m) pixelActs0[+m[1]] = val ? 1 : 0;
  });

  // C2) MAC on/off activations
  const macActs0 = {};
  Object.entries(initialData).forEach(([key, val]) => {
    const m = key.match(/^neuron_activations\/layer_(\d+)\/mac_(\d+)$/);
    if (m) {
      const layerKey = `layer_${m[1]}`;
      const idx = parseInt(m[2], 10) - 1;
      macActs0[layerKey] ||= {};
      macActs0[layerKey][idx] = val ? 1 : 0;
    }
  });

  // C3) neuron activations
  const neuronActs0 = {};
  Object.entries(initialData).forEach(([key, val]) => {
    const m = key.match(
      /^neuron_activations\/layer_(\d+)\/mac_(\d+)\/cm_(\d+)\/neuron_(\d+)$/
    );
    if (!m) return;
    const L = m[1], M = parseInt(m[2], 10), C = parseInt(m[3], 10), N = parseInt(m[4], 10);
    const layerKey = `layer_${L}`;
    neuronActs0[layerKey] ||= {};
    neuronActs0[layerKey][M] ||= {};
    neuronActs0[layerKey][M][C] ||= {};
    neuronActs0[layerKey][M][C][N] = !!val;
  });

  // C4) per‐CM probability arrays
  const perCM0 = {};
  Object.entries(rawProbs0).forEach(([layerKey, macs]) => {
    perCM0[layerKey] = {};
    Object.entries(macs).forEach(([macKey, cms]) => {
      const cmMap = {};
      Object.entries(cms).forEach(([cmKey, neuronMap]) => {
        cmMap[cmKey] = Object.values(neuronMap);
      });
      perCM0[layerKey][macKey] = cmMap;
    });
  });

  // STEP D: Batch all UI updates
  uiManager.buildFromLayers(
    data.layers,
    data.input_dimensions,
    pixelActs0
  );
  uiManager.updateMacActivations(macActs0);
  uiManager.updateMacProbabilities(perCM0);
  uiManager.updateNeuronActivations(neuronActs0);
  uiManager.buildWeightedConnectionsForStep(initialStep);
  uiManager.refreshConnectionVisibility();

  // STEP E: Populate dropdown without auto-trigger
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

    // 1) Fetch new data in parallel
    const [wcResp2, apResp2] = await Promise.all([
      fetch(`/api/${proj}/${run}/${sel}/weight_connections`),
      fetch(`/api/${proj}/${run}/${sel}/activation_probabilities`)
    ]);
    window._sparsey_weightConnections = await wcResp2.json();
    const rawProbs = await apResp2.json();

    // 2) Parse input activations
    const stepData = window._sparsey_stepHistory[sel] || {};
    const pixelActs = {};
    Object.entries(stepData).forEach(([key, val]) => {
      const m = key.match(/^input_activations\/pixel_(\d+)$/);
      if (m) pixelActs[+m[1]] = val ? 1 : 0;
    });

    // 3) Parse MAC on/off activations
    const macActs = {};
    Object.entries(stepData).forEach(([key, val]) => {
      const m = key.match(/^neuron_activations\/layer_(\d+)\/mac_(\d+)$/);
      if (m) {
        const layerKey = `layer_${m[1]}`;
        const idx = parseInt(m[2], 10) - 1;
        macActs[layerKey] ||= {};
        macActs[layerKey][idx] = val ? 1 : 0;
      }
    });

    // 4) Parse neuron activations
    const neuronActs = {};
    Object.entries(stepData).forEach(([key, val]) => {
      const m = key.match(
        /^neuron_activations\/layer_(\d+)\/mac_(\d+)\/cm_(\d+)\/neuron_(\d+)$/
      );
      if (!m) return;
      const L = m[1], M = parseInt(m[2], 10), C = parseInt(m[3], 10), N = parseInt(m[4], 10);
      const layerKey = `layer_${L}`;
      neuronActs[layerKey] ||= {};
      neuronActs[layerKey][M] ||= {};
      neuronActs[layerKey][M][C] ||= {};
      neuronActs[layerKey][M][C][N] = !!val;
    });

    // 5) Build new per‐CM probs
    const perCM = {};
    Object.entries(rawProbs).forEach(([layerKey, macs]) => {
      perCM[layerKey] = {};
      Object.entries(macs).forEach(([macKey, cms]) => {
        const cmMap = {};
        Object.entries(cms).forEach(([cmKey, neuronMap]) => {
          cmMap[cmKey] = Object.values(neuronMap);
        });
        perCM[layerKey][macKey] = cmMap;
      });
    });

    // 6) Batch UI updates for new step
    uiManager.updateInputGrid(pixelActs);
    uiManager.updateMacActivations(macActs);
    uiManager.updateMacProbabilities(perCM);
    uiManager.updateNeuronActivations(neuronActs);
    uiManager.buildWeightedConnectionsForStep(sel);
    uiManager.refreshConnectionVisibility();
  });
});

// Optionally clear side panel before load
eventBus.subscribe('clearSidePanel', () => {
  uiManager.clearSidePanel();
});
