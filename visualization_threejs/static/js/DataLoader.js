// /static/js/DataLoader.js
// Handles fetch calls for projects, runs, and run data.

import { eventBus } from './app.js';

export async function loadProjects() {
  try {
    let response = await fetch('/get_projects');
    let projects = await response.json();
    if (projects.error) throw new Error(projects.error);

    console.log("Fetched projects:", projects);
    const projectSelect = document.getElementById('projectSelect');
    projectSelect.innerHTML = '<option value="" disabled selected>Select a project</option>';
    projects.forEach(project => {
      let option = document.createElement('option');
      option.value = project.value;
      option.textContent = project.label;
      projectSelect.appendChild(option);
    });
    projectSelect.disabled = false;
  } catch (error) {
    console.error("Error fetching projects:", error);
    alert("Failed to load projects.");
    document.getElementById('projectSelect').innerHTML = '<option value="" disabled selected>Failed to load projects</option>';
  }
}

export async function loadRuns(project) {
  try {
    let response = await fetch('/get_runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project })
    });
    let runs = await response.json();
    if (runs.error) throw new Error(runs.error);

    console.log("Fetched runs:", runs);
    const runSelect = document.getElementById('runSelect');
    runSelect.innerHTML = '<option value="" disabled selected>Select a run</option>';
    runs.forEach(run => {
      let option = document.createElement('option');
      option.value = run.value;
      option.textContent = run.label;
      runSelect.appendChild(option);
    });
    runSelect.disabled = false;

    // Let the "Visualize" button be enabled
    document.getElementById('visualizeButton').disabled = false;
  } catch (error) {
    console.error("Error fetching runs:", error);
    alert("Failed to load runs.");
    document.getElementById('runSelect').innerHTML = '<option value="" disabled selected>Failed to load runs</option>';
  }
}

export async function loadRun() {
  // Clear any existing side-panel elements:
  // We'll just notify MacManager to do that if needed, or do it directly here:
  // But let's do it in MacManager via an event if you prefer. 
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
    let response = await fetch('/visualize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ run_id, project: project_name })
    });
    let data = await response.json();
    console.log("Received visualization data:", data);

    if (data.error) {
      alert("Error: " + data.error);
      return;
    }

    // Publish an event with the new data, so MacManager can rebuild the scene
    eventBus.notify('newVisualizationData', data);

  } catch (error) {
    console.error("Error during visualization:", error);
    alert("Failed to visualize the run.");
  }
}
