let projects_dropdown = document.getElementById('project-select');
let project_runs_dropdown = document.getElementById('project-run-select');

async function loadProjects() {
    try {
        const response = await fetch('/api/projects');
        const data = await response.json();
        
        // Clear and populate the projects dropdown
        projects_dropdown.innerHTML = '<option value="" disabled selected>Select a project</option>';
        if (data.projects && data.projects.length > 0) {
            data.projects.forEach(project => {
                const option = document.createElement('option');
                option.value = project;
                option.textContent = project;
                projects_dropdown.appendChild(option);
            });
        } else {
            projects_dropdown.innerHTML = '<option value="" disabled selected>No projects available</option>';
        }
        
        return data.projects;
    } catch (error) {
        console.error('Error loading projects:', error);
        projects_dropdown.innerHTML = '<option value="" disabled selected>Error loading projects</option>';
        return [];
    }
}

// Call loadProjects when the page loads
window.addEventListener('DOMContentLoaded', loadProjects);


async function loadProjectRuns(projectName) {
    try {
        const response = await fetch(`/api/${projectName}/runs`);
        const data = await response.json();
        return data.project_runs;
    } catch (error) {
        console.error('Error loading runs:', error);
        return [];
    }
}

projects_dropdown.addEventListener('change', async function() {
    const selected_project = projects_dropdown.value;
    console.log("Selected Project: ", selected_project);

    // enable the runs dropdown once a project is selected
    project_runs_dropdown.disabled = false;
    project_runs_dropdown.innerHTML = '<option value="" disabled selected>Loading runs...</option>';
    
    // Fetch and populate runs
    const runs = await loadProjectRuns(selected_project);
    
    if (runs && runs.length > 0) {
        project_runs_dropdown.innerHTML = '<option value="" disabled selected>Select a run</option>';
        runs.forEach(run => {
            const option = document.createElement('option');
            option.value = run.id;  // Adjust based on your run object structure
            option.textContent = run.name || run.id;  // Adjust based on your run object structure
            project_runs_dropdown.appendChild(option);
        });
    } else {
        project_runs_dropdown.innerHTML = '<option value="" disabled selected>No runs available</option>';
    }
});

// Enable visualize button when a run is selected
project_runs_dropdown.addEventListener('change', function() {
    document.getElementById('visualizeButton').disabled = !this.value;
});