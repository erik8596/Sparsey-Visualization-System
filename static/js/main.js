let scene, camera, renderer, controls;
let raycaster, mouse;
let clickableMACs = []; // Composite MAC groups for click detection
let selectedMACs = [];  // Global array for currently selected MAC groups
let macGroups = [];    // Array to store all MAC groups

async function initialize() {
  await loadProjects();

  document.getElementById('projectSelect').addEventListener('change', function () {
    let selectedProject = this.value;
    if (selectedProject) {
      document.getElementById('visualizeButton').disabled = true;
      let runSelect = document.getElementById('runSelect');
      runSelect.disabled = true;
      runSelect.innerHTML = '<option value="" disabled selected>Loading runs...</option>';
      loadRuns(selectedProject);
    }
  });

  const resetButton = document.getElementById("resetButton");
  if (resetButton) {
    resetButton.addEventListener("click", resetToggledMACs);
  }
}

async function loadProjects() {
  try {
    let response = await fetch('/get_projects');
    let projects = await response.json();
    if (projects.error) throw new Error(projects.error);
    console.log("Fetched projects:", projects);
    let projectSelect = document.getElementById('projectSelect');
    projectSelect.innerHTML = '<option value="" disabled selected>Select a project</option>';
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
    if (runs.error) throw new Error(runs.error);
    console.log("Fetched runs:", runs);
    let runSelect = document.getElementById('runSelect');
    runSelect.innerHTML = '<option value="" disabled selected>Select a run</option>';
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
    clickableMACs = [];
    selectedMACs = [];
    macGroups = [];
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
  scene.background = new THREE.Color(0xffffff);
  const container = document.getElementById('threejs-container');
  camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.set(0, 0, 50);
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxDistance = 200;
  controls.screenSpacePanning = false;
  window.addEventListener('resize', onWindowResize, false);
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();
  renderer.domElement.addEventListener('click', onDocumentMouseClick, false);
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
    if (element.type === "mac") {
      const macGroup = new THREE.Group();
      const shape = new THREE.Shape();
      drawHexagon(shape, 2.0);
      const geometry = new THREE.ShapeGeometry(shape);

      // Store the active state in userData
      macGroup.userData = {
        ...element,
        geometry: geometry,
        type: "mac"
      };

      // Create the outline with color based on activation state
      const points = shape.getPoints();
      const outlineGeometry = new THREE.BufferGeometry().setFromPoints(points);

      // Set outline color based on active property from backend
      const outlineMaterial = new THREE.LineBasicMaterial({
        color: element.active ? 0x800080 : 0x000000, // Purple if active, black if not
        linewidth: 1
      });

      const outlineLine = new THREE.LineLoop(outlineGeometry, outlineMaterial);
      outlineLine.userData = {
        type: "mac_outline",
        active: element.active
      };

      macGroup.add(outlineLine);
      macGroup.userData.outlineLine = outlineLine;
      macGroup.userData.originalZ = element.z;
      macGroup.position.set(element.x, element.y * mac_spacing, element.z);

      scene.add(macGroup);
      clickableMACs.push(macGroup);
      macGroups.push(macGroup);
    }
  });

  // Now, for each element that is a "cm" or "neuron", add it as a child to the nearest MAC group (if it belongs there)
  layers.forEach(element => {
    if (element.type === "cm" || element.type === "neuron") {
      let object;
      if (element.type === "cm") {
        const shape = new THREE.Shape();
        drawHexagon(shape, 0.5);
        const points = shape.getPoints();
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        // Set CMs to blue (0x0000FF)
        const material = new THREE.LineBasicMaterial({ color: 0x0000FF, linewidth: 2 });
        object = new THREE.LineLoop(geometry, material);
      } else if (element.type === "neuron") {
        const shape = new THREE.Shape();
        drawCircle(shape, 0.10);
        const points = shape.getPoints();
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
        object = new THREE.LineLoop(geometry, material);
      }
      object.userData = element;
      object.userData.type = element.type;
      // Set object's world position
      object.position.set(element.x, element.y * mac_spacing, element.z);
      // Find the nearest MAC group with an identical z (i.e. same layer)
      let closestMac = null;
      let minDistance = Infinity;
      macGroups.forEach(macGroup => {
        if (Math.abs(macGroup.position.z - object.position.z) < 0.001) {
          const dx = macGroup.position.x - object.position.x;
          const dy = macGroup.position.y - object.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDistance) {
            minDistance = dist;
            closestMac = macGroup;
          }
        }
      });
      if (closestMac) {
        // Convert object's world position to local position relative to its MAC group
        object.position.sub(closestMac.position);
        closestMac.add(object);
      } else {
        scene.add(object);
      }
    }
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
// function onWindowResize() {
//   camera.aspect = window.innerWidth / window.innerHeight;
//   camera.updateProjectionMatrix();

//   renderer.setSize(window.innerWidth, window.innerHeight);
// }
function onWindowResize() {
  const container = document.getElementById('threejs-container');
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}
// Animation loop

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

function getMACGroup(object) {
  while (object) {
    if (clickableMACs.includes(object)) {
      return object;
    }
    object = object.parent;
  }
  return null;
}

// Create a side-panel container that includes a top view canvas and a bar graph canvas
function createMACCanvas(macGroup) {
  const containerDiv = document.createElement("div");
  containerDiv.classList.add("mac-canvas-wrapper");
  // If no dynamic canvas exists yet in the side panel, add extra top margin
  const sidePanel = document.getElementById("side-panel");
  containerDiv.style.marginBottom = "10px";

  const label = document.createElement("p");
  label.textContent = `MAC - Layer: ${((macGroup.userData.z / 10) + 1).toFixed(1)}`;
  label.style.margin = "0 0 5px 0";
  containerDiv.appendChild(label);

  // Top view canvas
  const topCanvas = document.createElement("canvas");
  topCanvas.width = 200;
  topCanvas.height = 200;
  topCanvas.style.border = "2px solid #ccc";
  containerDiv.appendChild(topCanvas);

  // Bar graph canvas (for activation probabilities)
  const barGraphCanvas = document.createElement("canvas");
  barGraphCanvas.width = 200;
  barGraphCanvas.height = 100; // adjust height as needed
  barGraphCanvas.style.border = "1px solid #ccc";
  barGraphCanvas.style.marginTop = "5px";
  containerDiv.appendChild(barGraphCanvas);

  sidePanel.appendChild(containerDiv);

  // Render the top view using a composite clone from BEFORE outline change:
  createTopView(macGroup, topCanvas);
  // Render the dummy bar graph
  renderBarGraph(macGroup, barGraphCanvas);

  return containerDiv;
}

// Create a top-down view of the composite MAC group on the given canvas
function createTopView(macGroup, canvas) {
  const topScene = new THREE.Scene();
  topScene.background = new THREE.Color(0xffffff);

  const aspect = canvas.width / canvas.height;
  const viewSize = 5;
  const topCamera = new THREE.OrthographicCamera(-viewSize * aspect, viewSize * aspect, viewSize, -viewSize, 0.1, 100);
  topCamera.position.set(0, 0, 10);
  topCamera.lookAt(0, 0, 0);

  const topRenderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  topRenderer.setSize(canvas.width, canvas.height);

  // Deep clone the composite MAC group
  const compositeClone = macGroup.clone(true);
  // Reset the outline color ONLY for the MAC's own outline (marked with userData.type === "mac_outline")
  resetOutlineColor(compositeClone);
  // Scale up the clone to make it appear larger in the canvas.
  const scaleFactor = 1.5;  // Adjust this factor as needed.
  compositeClone.scale.set(scaleFactor, scaleFactor, scaleFactor);
  // Center the clone in the top view
  compositeClone.position.set(0, 0, 0);
  topScene.add(compositeClone);

  topRenderer.render(topScene, topCamera);
}

// Traverse a cloned group and reset only the MAC outline to black,
// leaving other child colors (like CM's blue) unchanged.
function resetOutlineColor(group) {
  group.traverse(child => {
    if (child.isLine && child.material && child.material.color && child.userData && child.userData.type === "mac_outline") {
      child.material.color.set(0x000000);
    }
  });
}

// Render a dummy bar graph for activation probabilities in the given canvas.
// This dummy graph draws three bars with fixed sample values.
function renderBarGraph(macGroup, canvas) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Sample data for three bars (values between 0 and 1)
  const sampleData = [0.8, 0.3, 0.6];
  const barWidth = (canvas.width - 20) / sampleData.length; // leave some margin
  const maxBarHeight = canvas.height - 20;

  // Draw bars
  sampleData.forEach((value, index) => {
    const barHeight = value * maxBarHeight;
    const x = 10 + index * barWidth;
    const y = canvas.height - barHeight - 10; // leave margin at bottom

    // Draw the bar (blue color)
    ctx.fillStyle = '#007bff';
    ctx.fillRect(x, y, barWidth - 5, barHeight);

    // Optionally draw a border
    ctx.strokeStyle = '#000';
    ctx.strokeRect(x, y, barWidth - 5, barHeight);

    // Draw label below the bar
    ctx.fillStyle = '#000';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Bar ${index + 1}`, x + (barWidth - 5) / 2, canvas.height - 2);
  });
}

function onDocumentMouseClick(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(clickableMACs, true);
  if (intersects.length > 0) {
    const macGroup = getMACGroup(intersects[0].object);
    if (macGroup) {
      toggleMACSelection(macGroup);
    }
  }
}

// Toggle a MAC's selection state. When selecting, create the side-panel clone before changing the main scene's outline.
function toggleMACSelection(macGroup) {
  const outlineLine = macGroup.userData.outlineLine;
  if (macGroup.userData.isSelected) {
    // Deselect: revert to original color based on active state
    outlineLine.material.color.set(macGroup.userData.active ? 0x800080 : 0x000000);
    macGroup.position.z = macGroup.userData.originalZ;
    macGroup.userData.isSelected = false;
    const index = selectedMACs.indexOf(macGroup);
    if (index !== -1) {
      selectedMACs.splice(index, 1);
    }
    if (macGroup.userData.canvasWrapper) {
      macGroup.userData.canvasWrapper.remove();
      delete macGroup.userData.canvasWrapper;
    }
  } else {
    // Select: create side-panel and change color to green
    macGroup.userData.canvasWrapper = createMACCanvas(macGroup);
    outlineLine.material.color.set(0x008000);
    macGroup.position.z = macGroup.userData.originalZ + 0.2;
    macGroup.userData.isSelected = true;
    selectedMACs.push(macGroup);
  }
  const macData = macGroup.userData;
  let layer = (macData.z / 10) + 1;
  const detailsDiv = document.getElementById("mac-details");
  detailsDiv.innerHTML = `<p><strong>Layer:</strong> ${layer.toFixed(1)}</p>`;
}

function resetToggledMACs() {
  const macsToReset = selectedMACs.slice();
  macsToReset.forEach(macGroup => {
    if (macGroup.userData.isSelected) {
      // Reset to original color based on active state
      macGroup.userData.outlineLine.material.color.set(
        macGroup.userData.active ? 0x800080 : 0x000000
      );
      macGroup.position.z = macGroup.userData.originalZ;
      macGroup.userData.isSelected = false;
      if (macGroup.userData.canvasWrapper) {
        macGroup.userData.canvasWrapper.remove();
        delete macGroup.userData.canvasWrapper;
      }
    }
  });
  selectedMACs = [];
  const detailsDiv = document.getElementById("mac-details");
  detailsDiv.innerHTML = `<p><strong>Layer:</strong></p>`;
}

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


async function loadRun() {
  let runDropdown = document.getElementById('runSelect');
  let run_id = runDropdown.value;
  let project_name = document.getElementById('projectSelect').value;

  try {
    let response = await fetch('/visualize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ run_id, project: project_name })
    });
    let data = await response.json();

    // Extract layers and input dimensions
    const { input_dimensions, layers } = data;

    // Visualize the network layers
    visualizeData(layers, true);

    // Create the input grid for the first layer
    createInputGrid(input_dimensions.width, input_dimensions.height);

    // Start the Three.js render lonimate();
  } catch (error) {
    console.error("Error during visualization:", error);
    alert("Failed to visualize the run.");
  }
}
