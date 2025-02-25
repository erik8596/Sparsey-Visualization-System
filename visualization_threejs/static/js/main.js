let scene, camera, renderer, controls;
let raycaster, mouse;
let clickableMACs = []; // Composite MAC groups for click detection
let selectedMACs = [];  // Global array for currently selected MAC groups

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
    projectSelect.disabled = false;
  } catch (error) {
    console.error("Error fetching projects:", error);
    alert("Failed to load projects.");
    document.getElementById('projectSelect').innerHTML = '<option value="" disabled selected>Failed to load projects</option>';
  }
}

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
    runSelect.disabled = false;
    document.getElementById('visualizeButton').disabled = false;
  } catch (error) {
    console.error("Error fetching runs:", error);
    alert("Failed to load runs.");
    document.getElementById('runSelect').innerHTML = '<option value="" disabled selected>Failed to load runs</option>';
  }
}

async function loadRun() {
  let runDropdown = document.getElementById('runSelect');
  if (runDropdown.selectedIndex < 1) {
    alert("Please select a run!");
    return;
  }
  let selectedOption = runDropdown.options[runDropdown.selectedIndex];
  let run_id = selectedOption.value;
  let project_name = document.getElementById('projectSelect').value;
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
    visualizeData(data.layers);
  } catch (error) {
    console.error("Error during visualization:", error);
    alert("Failed to visualize the run.");
  }
}

// Build the scene with composite MAC groups
function visualizeData(layers) {
  if (scene) {
    while (scene.children.length > 0) {
      scene.remove(scene.children[0]);
    }
    clickableMACs = [];
    selectedMACs = [];
  } else {
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

  const mac_spacing = 1.33;
  let macGroups = [];

  // First, create composite MAC groups for elements with type "mac"
  layers.forEach(element => {
    if (element.type === "mac") {
      const macGroup = new THREE.Group();
      const shape = new THREE.Shape();
      drawHexagon(shape, 2.0);
      const geometry = new THREE.ShapeGeometry(shape);
      macGroup.userData = element;
      macGroup.userData.geometry = geometry;
      macGroup.userData.type = "mac";
      // Create the black outline and mark it as the MAC outline
      const points = shape.getPoints();
      const outlineGeometry = new THREE.BufferGeometry().setFromPoints(points);
      const outlineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 });
      const outlineLine = new THREE.LineLoop(outlineGeometry, outlineMaterial);
      outlineLine.userData = { type: "mac_outline" };
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
  animate();
}

function onWindowResize() {
  const container = document.getElementById('threejs-container');
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

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
    ctx.fillText(`Bar ${index+1}`, x + (barWidth - 5)/2, canvas.height - 2);
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
    // Deselect: revert outline color and position, remove side-panel container
    outlineLine.material.color.set(0x000000);
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
    // Before changing the MAC's outline, create the side-panel composite clone.
    macGroup.userData.canvasWrapper = createMACCanvas(macGroup);
    // Now change the outline and raise the MAC in the main scene.
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
  // Make a copy of the currently selected MACs
  const macsToReset = selectedMACs.slice();
  macsToReset.forEach(macGroup => {
    if (macGroup.userData.isSelected) {
      // Reset the outline color to black
      macGroup.userData.outlineLine.material.color.set(0x000000);
      // Reset the position
      macGroup.position.z = macGroup.userData.originalZ;
      // Mark as deselected
      macGroup.userData.isSelected = false;
      // Remove the side-panel canvas if it exists
      if (macGroup.userData.canvasWrapper) {
        macGroup.userData.canvasWrapper.remove();
        delete macGroup.userData.canvasWrapper;
      }
    }
  });
  // Clear the selectedMACs array
  selectedMACs = [];
  // Optionally update the details display
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

function drawCircle(shape, radius) {
  const numSegments = 50;
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
