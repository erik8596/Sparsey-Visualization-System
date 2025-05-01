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

  if (!run_id || !project_name) {
    alert("No project or run selected!");
    return;
  }

  try {
    // Use window.loadSteps instead of loadSteps directly
    await window.loadSteps(project_name, run_id);

    // The rest of the visualization will happen via the step selection
  } catch (error) {
    console.error("Error loading run:", error);
    alert("Failed to visualize the run.");
  }
}
