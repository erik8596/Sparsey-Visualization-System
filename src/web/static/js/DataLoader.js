// /static/js/DataLoader.js
// Handles fetch calls for projects, runs, and run data.

import { eventBus } from './app.js';

export async function loadProjects() {
  try {
    const response = await fetch('/api/projects');
    const data = await response.json();
    // clear and populate the projects dropdown
    projectSelect.innerHTML = '<option value="" disabled selected>Select a project</option>';
    if (data.projects && data.projects.length > 0) {
      data.projects.forEach(project => {
        const option = document.createElement('option');
        option.value = project;
        option.textContent = project;
        projectSelect.appendChild(option);
      });
    } else {
      projectSelect.innerHTML = '<option value="" disabled selected>No projects available</option>';
    }

    return data.projects;
  } catch (error) {
    console.error('Error loading projects:', error);
    projectSelect.innerHTML = '<option value="" disabled selected>Error loading projects</option>';
    return [];
  }
}

export async function loadRuns(project) {
  try {
    console.log("Loading runs for project:", project);
    const response = await fetch(`/api/${project}/runs`);
    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    console.log("Fetched runs data:", data);
    const runSelect = document.getElementById('runSelect');
    runSelect.innerHTML = '<option value="" disabled selected>Select a run</option>';

    // Check if we have project_runs in the response and it's an array
    if (data.project_runs && Array.isArray(data.project_runs)) {
      data.project_runs.forEach(run => {
        let option = document.createElement('option');
        option.value = run.id;  // Changed from run.value to run.id based on API response
        option.textContent = run.name;  // Changed from run.label to run.name based on API response
        runSelect.appendChild(option);
      });
      runSelect.disabled = false;
      document.getElementById('visualizeButton').disabled = false;
    } else {
      runSelect.innerHTML = '<option value="" disabled selected>No runs available</option>';
      document.getElementById('visualizeButton').disabled = true;
    }

  } catch (error) {
    console.error("Error fetching runs:", error);
    const runSelect = document.getElementById('runSelect');
    runSelect.innerHTML = '<option value="" disabled selected>Failed to load runs</option>';
    document.getElementById('visualizeButton').disabled = true;

    // Show more informative error to user
    alert(`Failed to load runs: ${error.message}`);
  }
}

export async function loadRun() {
  // Clear any existing side-panel elements
  eventBus.notify('clearSidePanel');

  const runDropdown = document.getElementById('runSelect');
  if (runDropdown.selectedIndex < 1) {
    alert("Please select a run!");
    return;
  }
  const selectedOption = runDropdown.options[runDropdown.selectedIndex];
  const run_id = selectedOption.value;
  const project_name = document.getElementById('projectSelect').value;
  if (!run_id) {
    alert("No run selected!");
    return;
  }

  try {
    let response = await fetch(`/api/${project_name}/${run_id}/visualize`);
    let data = await response.json();
    console.log("Received visualization data:", data);

    if (data.error) {
      alert("Error: " + data.error);
      return;
    }

    // Process activations from the response
    const inputActivations = {};
    const macActivations = {};
    const neuronActivations = {};

    // Process input activations
    if (data.input_activations) {
      Object.entries(data.input_activations).forEach(([pixelIdx, value]) => {
        inputActivations[pixelIdx] = {
          value: value,
          isActive: value === 1
        };
      });
    }

    // Process MAC activations
    if (data.mac_activations) {
      Object.entries(data.mac_activations).forEach(([key, value]) => {
        const macMatch = key.match(/^neuron_activations\/layer_([1-9]\d*)\/mac_(\d+)$/);
        if (macMatch) {
          const [_, layer, mac] = macMatch;
          if (!macActivations[`layer_${layer}`]) {
            macActivations[`layer_${layer}`] = {};
          }
          macActivations[`layer_${layer}`][mac] = {
            value: value,
            isActive: value === 1,
            isNaN: Number.isNaN(value)
          };
        }
      });
    }

    // Process neuron activations
    if (data.neuron_activations) {
      Object.entries(data.neuron_activations).forEach(([key, value]) => {
        const neuronMatch = key.match(/^neuron_activations\/layer_(\d+)\/mac_(\d+)\/cm_(\d+)\/neuron_(\d+)$/);
        if (neuronMatch) {
          const [_, layer, mac, cm, neuron] = neuronMatch;

          if (!neuronActivations[`layer_${layer}`]) {
            neuronActivations[`layer_${layer}`] = {};
          }
          if (!neuronActivations[`layer_${layer}`][`mac_${mac}`]) {
            neuronActivations[`layer_${layer}`][`mac_${mac}`] = {};
          }
          if (!neuronActivations[`layer_${layer}`][`mac_${mac}`][`cm_${cm}`]) {
            neuronActivations[`layer_${layer}`][`mac_${mac}`][`cm_${cm}`] = {};
          }

          neuronActivations[`layer_${layer}`][`mac_${mac}`][`cm_${cm}`][neuron] = {
            value: value,
            isActive: value === 1,
            isNaN: Number.isNaN(value)
          };
        }
      });
    }

    // Publish an event with the processed data
    eventBus.notify('newVisualizationData', {
      layers: data.layers,
      input_dimensions: data.input_dimensions,
      input_activations: inputActivations,
      mac_activations: macActivations,
      neuron_activations: neuronActivations
    });

    return true;
  } catch (error) {
    console.error("Error during visualization:", error);
    alert("Failed to visualize the run.");
    return false;
  }
}
