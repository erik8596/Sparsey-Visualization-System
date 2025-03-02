let scene, camera, renderer, controls;

// Initialize the application
async function initialize() {
  await loadProjects();

  // Event Listener for Project Selection
  document.getElementById('projectSelect').addEventListener('change', function () {
    let selectedProject = this.value;
    if (selectedProject) {
      // Disable the visualize button and run dropdown until runs are loaded
      document.getElementById('visualizeButton').disabled = true;
      let runSelect = document.getElementById('runSelect');
      runSelect.disabled = true;
      runSelect.innerHTML = '<option value="" disabled selected>Loading runs...</option>';

      loadRuns(selectedProject);
    }
  });
}

// Fetch and populate projects dropdown
async function loadProjects() {
  try {
    let response = await fetch('/get_projects');
    let projects = await response.json();

    if (projects.error) {
      throw new Error(projects.error);
    }

    console.log("Fetched projects from Flask:", projects);  // Debugging log

    let projectSelect = document.getElementById('projectSelect');
    projectSelect.innerHTML = '<option value="" disabled selected>Select a project</option>';  // Add placeholder

    projects.forEach(project => {
      let option = document.createElement('option');
      option.value = project.value;
      option.textContent = project.label;
      projectSelect.appendChild(option);
    });

    console.log("Dropdown successfully updated with projects!");

    // Enable projectSelect if it was disabled
    projectSelect.disabled = false;

  } catch (error) {
    console.error("Error fetching projects:", error);
    alert("Failed to load projects. Check the console for details.");
    let projectSelect = document.getElementById('projectSelect');
    projectSelect.innerHTML = '<option value="" disabled selected>Failed to load projects</option>';
  }
}

// Fetch and populate runs dropdown based on selected project
async function loadRuns(project) {
  try {
    let response = await fetch('/get_runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project })
    });
    let runs = await response.json();

    if (runs.error) {
      throw new Error(runs.error);
    }

    console.log("Fetched runs for project from Flask:", runs);  // Debugging log

    let runSelect = document.getElementById('runSelect');
    runSelect.innerHTML = '<option value="" disabled selected>Select a run</option>';  // Add placeholder

    runs.forEach(run => {
      let option = document.createElement('option');
      option.value = run.value;
      option.textContent = run.label;
      runSelect.appendChild(option);
    });

    console.log("Dropdown successfully updated with runs!");

    // Enable runSelect and visualize button
    runSelect.disabled = false;
    document.getElementById('visualizeButton').disabled = false;

  } catch (error) {
    console.error("Error fetching runs:", error);
    alert("Failed to load runs. Check the console for details.");
    let runSelect = document.getElementById('runSelect');
    runSelect.innerHTML = '<option value="" disabled selected>Failed to load runs</option>';
  }
}

function getInputDimensions(modelConfig) {
  console.log("🔍 Inside getInputDimensions, received config:", modelConfig);

  // Check if we have the original config structure
  const config = modelConfig.config || modelConfig;
  const layer1 = config.layer_1;

  if (!layer1 || !layer1.params) {
    console.error("❌ layer_1 or its params are missing in modelConfig!");
    return { width: null, height: null };
  }

  const params = layer1.params;
  const inputDimensions = {
    width: params.prev_layer_mac_grid_num_cols || null,
    height: params.prev_layer_mac_grid_num_rows || null
  };

  console.log("📏 Extracted Input Dimensions:", inputDimensions);
  return inputDimensions;
}


async function loadRun() {
  let runDropdown = document.getElementById('runSelect');
  let selectedIndex = runDropdown.selectedIndex;
  if (selectedIndex < 1) {
    alert("Please select a run!");
    return;
  }
  let selectedOption = runDropdown.options[selectedIndex];
  let run_id = selectedOption.value;
  let projectSelect = document.getElementById('projectSelect');
  let project_name = projectSelect.value;

  try {
    let response = await fetch('/visualize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ run_id, project: project_name })
    });

    let data = await response.json();
    console.log("📥 Full Response Data:", data);

    if (data.error) {
      alert("Error: " + data.error);
      return;
    }

    // Extract input dimensions and layers from the response
    const { input_dimensions, layers } = data;

    // Initialize scene if not already initialized
    if (!scene) {
      initializeScene();
    }

    // Clear existing scene
    while (scene.children.length > 0) {
      scene.remove(scene.children[0]);
    }

    // First visualize the network layers
    if (layers) {
      visualizeData(layers, false); // Pass false to prevent scene clearing
    } else {
      console.error("❌ No layers data in response!");
    }

    // Then add the input grid
    if (input_dimensions && input_dimensions.width && input_dimensions.height) {
      createInputGrid(input_dimensions.width, input_dimensions.height);
    } else {
      console.error("❌ Invalid input dimensions:", input_dimensions);
    }

    // Start the animation loop
    animate();
  } catch (error) {
    console.error("Error during visualization:", error);
    alert("Failed to visualize the run. Check the console for details.");
  }
}

// Initialize Three.js scene and components
function initializeScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);  // Set white background

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 50);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById('threejs-container').appendChild(renderer.domElement);

  // Add orbit controls for zoom and pan
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxDistance = 200;
  controls.screenSpacePanning = false;

  // Handle window resize
  window.addEventListener('resize', onWindowResize, false);
}

// Visualize the data using Three.js
function visualizeData(layers, clearScene = true) {
  // Initialize scene if not already initialized
  if (!scene) {
    initializeScene();
  }

  // Clear existing scene only if clearScene is true
  if (clearScene) {
    while (scene.children.length > 0) {
      scene.remove(scene.children[0]);
    }
  }

  const mac_spacing = 1.33;  // Increase spacing between MACs

  layers.forEach(element => {
    let shape, material, points, lineGeometry, line;

    if (element.type === "mac") {
      shape = new THREE.Shape();
      drawHexagon(shape, 2.0);  // Adjust MAC size here
      material = new THREE.LineBasicMaterial({ color: 0x0000ff, linewidth: 1 });  // Thin blue line
    } else if (element.type === "cm") {
      shape = new THREE.Shape();
      drawHexagon(shape, 0.5);  // Adjust CM size here
      material = new THREE.LineBasicMaterial({ color: 0x008000, linewidth: 1 });  // Thin green line
    } else if (element.type === "neuron") {
      shape = new THREE.Shape();
      drawCircle(shape, 0.10);  // Adjust neuron size here
      material = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 });  // Thin black line
    }

    // Convert shape to line geometry
    points = shape.getPoints();
    lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
    line = new THREE.LineLoop(lineGeometry, material);
    line.position.set(element.x, element.y * mac_spacing, element.z);
    scene.add(line);
  });
  //createInputGrid(); // Creating the input grid
  animate();
}

// Function to create a hexagonal mesh
function createHexagon(size, color) {
  const shape = new THREE.Shape();
  drawHexagon(shape, size);

  const geometry = new THREE.BufferGeometry();
  const points = shape.getPoints();
  geometry.setFromPoints(points);

  const material = new THREE.LineBasicMaterial({
    color: color,
    linewidth: 1
  });

  return new THREE.LineLoop(geometry, material);
}

function createInputGrid(cols, rows) {
  const hexSize = 2.0;
  const macSpacing = 3.0;
  const zOffset = -10; // Place input grid below the network layers

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * macSpacing;
      let y = row * Math.sqrt(3) * hexSize;  // Changed to let
      if (col % 2 !== 0) {
        y += (Math.sqrt(3) * hexSize) / 2;
      }
      const macHex = createHexagon(hexSize, 0x0000ff);
      macHex.position.set(x - (cols - 1) * macSpacing / 2, y - (rows - 1) * Math.sqrt(3) * hexSize / 2, zOffset);
      scene.add(macHex);
    }
  }
}

// Handle window resize
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

// Function to draw a hexagon outline
function drawHexagon(shape, size) {
  for (let i = 0; i < 6; i++) {
    let angle = (Math.PI / 3) * i;
    let x = size * Math.cos(angle);
    let y = size * Math.sin(angle);
    if (i === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  }
  shape.closePath();
}

// Function to draw a circle outline
function drawCircle(shape, radius) {
  const numSegments = 50;  // Smooth circle outline
  for (let i = 0; i < numSegments; i++) {
    let angle = (Math.PI * 2 / numSegments) * i;
    let x = radius * Math.cos(angle);
    let y = radius * Math.sin(angle);
    if (i === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  }
  shape.closePath();
}

window.onload = initialize;
