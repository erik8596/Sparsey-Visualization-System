// Global variables for Three.js scene and interaction
let scene, camera, renderer, controls;
let raycaster, mouse;
let clickableMACs = []; // Composite MAC groups for click detection
let selectedMACs = [];  // Global array for currently selected MAC groups

// Create a shared offscreen renderer for side-panel snapshots.
let sharedTopRenderer = new THREE.WebGLRenderer({ antialias: true });
sharedTopRenderer.setSize(200, 200);
sharedTopRenderer.setClearColor(0xffffff, 1);

// Rotation interval variable for continuous rotation buttons
let rotateInterval = null;

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
  
  // Setup the camera control buttons overlay
  setupCameraControlButtons();
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
  // Clear any existing side-panel elements and their WebGL contexts.
  clearSidePanel();

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
    
    if (data.input_dimensions && data.input_dimensions.width && data.input_dimensions.height) {
      createInputGrid(data.input_dimensions.width, data.input_dimensions.height);
    } else {
      console.error("Invalid input dimensions:", data.input_dimensions);
    }
  } catch (error) {
    console.error("Error during visualization:", error);
    alert("Failed to visualize the run.");
  }
}

// --- Camera Control Functions ---

// Continuous rotation functions
function startRotateLeft() {
  if (!rotateInterval) {
    rotateInterval = setInterval(() => {
      controls.rotateLeft(0.02); // adjust this value for rotation speed (in radians)
      controls.update();
    }, 16); // roughly 60 fps
  }
}

function startRotateRight() {
  if (!rotateInterval) {
    rotateInterval = setInterval(() => {
      controls.rotateLeft(-0.02); // negative value for right rotation
      controls.update();
    }, 16);
  }
}

function stopRotate() {
  if (rotateInterval) {
    clearInterval(rotateInterval);
    rotateInterval = null;
  }
}

// Pan mode: map left mouse to pan and disable rotation
function enablePanMode() {
  controls.enableRotate = false;
  controls.enablePan = true;
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.PAN,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN
  };
  console.log("Pan mode enabled");
}

// Default mode: enable both rotate and pan (default mapping: left=rotate, right=pan)
function enableRotateAndPanMode() {
  controls.enableRotate = true;
  controls.enablePan = true;
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN
  };
  console.log("Rotate & Pan mode enabled");
}

function setupCameraControlButtons() {
  const panButton = document.getElementById("panButton");
  const bothButton = document.getElementById("bothButton");
  const resetControls = document.getElementById("resetControls");

  // "Pan Mode": disable rotation and map the left mouse button to pan.
  panButton.addEventListener("click", () => {
    controls.enableRotate = false;
    controls.enablePan = true;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN
    };
    console.log("Pan mode enabled");
  });

  // "Default Mode": restore full OrbitControls (rotate with left, pan with right).
  bothButton.addEventListener("click", () => {
    controls.enableRotate = true;
    controls.enablePan = true;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN
    };
    // Also reset any angle limitations:
    controls.minAzimuthAngle = -Infinity;
    controls.maxAzimuthAngle = Infinity;
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI;
    console.log("Default mode enabled (rotate & pan)");
  });

  // "Reset Controls": resets OrbitControls to its defaults.
  resetControls.addEventListener("click", () => {
    controls.enableRotate = true;
    controls.enablePan = true;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN
    };
    controls.minAzimuthAngle = -Infinity;
    controls.maxAzimuthAngle = Infinity;
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI;
    controls.reset();
    console.log("Controls reset");
  });
}




// --- Scene Setup and Render Functions ---
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
    // Default mapping: left=rotate, right=pan.
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN
    };
    window.addEventListener('resize', onWindowResize, false);
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    renderer.domElement.addEventListener('click', onDocumentMouseClick, false);
  }
  
  const mac_spacing = 1.33;
  let macGroups = [];
  
  layers.forEach(element => {
    if (element.type === "mac") {
      const macGroup = new THREE.Group();
      const shape = new THREE.Shape();
      drawHexagon(shape, 2.0);
      const fillGeometry = new THREE.ShapeGeometry(shape);
      const isActive = (element.active === true || element.active === 1);
      const fillMaterial = new THREE.MeshBasicMaterial({
        color: 0xffcccc,
        transparent: true,
        opacity: isActive ? 1.0 : 0.0,
        side: THREE.DoubleSide
      });
      const fillMesh = new THREE.Mesh(fillGeometry, fillMaterial);
      fillMesh.position.z = -0.01;
      macGroup.add(fillMesh);

      const points = shape.getPoints();
      const outlineGeometry = new THREE.BufferGeometry().setFromPoints(points);
      const outlineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 });
      const outlineLine = new THREE.LineLoop(outlineGeometry, outlineMaterial);
      outlineLine.userData = { type: "mac_outline" };
      macGroup.add(outlineLine);
      
      macGroup.userData = element;
      macGroup.userData.outlineLine = outlineLine;
      macGroup.userData.fillMesh = fillMesh;
      macGroup.userData.originalZ = element.z;
      macGroup.position.set(element.x, element.y * mac_spacing, element.z);
      scene.add(macGroup);
      clickableMACs.push(macGroup);
      macGroups.push(macGroup);
    }
  });
  
  layers.forEach(element => {
    if (element.type === "cm" || element.type === "neuron") {
      let object;
      const scale = element.scale || 1;
      if (element.type === "cm") {
        const shape = new THREE.Shape();
        drawHexagon(shape, 0.5 * scale);
        const points = shape.getPoints();
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: 0x0000FF, linewidth: 2 });
        object = new THREE.LineLoop(geometry, material);
      } else if (element.type === "neuron") {
        const shape = new THREE.Shape();
        drawCircle(shape, 0.10 * scale);
        const points = shape.getPoints();
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
        object = new THREE.LineLoop(geometry, material);
      }
      object.userData = element;
      object.userData.type = element.type;
      object.position.set(element.x, element.y * mac_spacing, element.z);
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
        object.position.sub(closestMac.position);
        closestMac.add(object);
      } else {
        scene.add(object);
      }
    }
  });
  animate();
}

function createInputGrid(cols, rows) {
  const hexSize = 2.0;
  const macSpacing = 3.0;
  const zOffset = -10;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * macSpacing;
      let y = row * Math.sqrt(3) * hexSize;
      if (col % 2 !== 0) {
        y += (Math.sqrt(3) * hexSize) / 2;
      }
      const cellHex = createHexagon(hexSize, 0x0000ff);
      cellHex.position.set(
        x - ((cols - 1) * macSpacing) / 2,
        y - ((rows - 1) * Math.sqrt(3) * hexSize) / 2,
        zOffset
      );
      scene.add(cellHex);
    }
  }
}

function createHexagon(size, color) {
  const shape = new THREE.Shape();
  drawHexagon(shape, size);
  const geometry = new THREE.BufferGeometry();
  const points = shape.getPoints();
  geometry.setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: color, linewidth: 1 });
  return new THREE.LineLoop(geometry, material);
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

function onDocumentMouseClick(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(clickableMACs, true);
  if (intersects.length > 0) {
    const macGroup = getMACGroup(intersects[0].object);
    if (macGroup && macGroup.userData && macGroup.userData.type === "mac") {
      try {
        toggleMACSelection(macGroup);
      } catch (error) {
        console.error("Error toggling MAC selection:", error);
      }
    }
  }
}

function getMACGroup(object) {
  while (object) {
    if (clickableMACs.includes(object) && object.userData && object.userData.type === "mac") {
      return object;
    }
    object = object.parent;
  }
  return null;
}

function toggleMACSelection(macGroup) {
  const outlineLine = macGroup.userData.outlineLine;
  if (macGroup.userData.isSelected) {
    outlineLine.material.color.set(0x000000);
    macGroup.position.z = macGroup.userData.originalZ;
    macGroup.userData.isSelected = false;
    const index = selectedMACs.indexOf(macGroup);
    if (index !== -1) {
      selectedMACs.splice(index, 1);
    }
    if (macGroup.userData.canvasWrapper) {
      macGroup.userData.canvasWrapper.style.display = "none";
    }
  } else {
    if (!macGroup.userData.canvasWrapper) {
      macGroup.userData.canvasWrapper = createMACCanvas(macGroup);
    } else {
      macGroup.userData.canvasWrapper.style.display = "block";
    }
    outlineLine.material.color.set(0x008000);
    macGroup.position.z = macGroup.userData.originalZ + 0.5;
    macGroup.userData.isSelected = true;
    selectedMACs.push(macGroup);
  }
  const macData = macGroup.userData;
  let layer = (macData.z / 10) + 1;
  const detailsDiv = document.getElementById("mac-details");
  if (detailsDiv) {
    detailsDiv.innerHTML = `<p><strong>Layer:</strong> ${layer.toFixed(1)}</p>`;
  }
}

function resetToggledMACs() {
  selectedMACs.forEach(macGroup => {
    if (macGroup.userData.isSelected) {
      macGroup.userData.outlineLine.material.color.set(0x000000);
      macGroup.position.z = macGroup.userData.originalZ;
      macGroup.userData.isSelected = false;
    }
  });
  selectedMACs = [];
  const detailsDiv = document.getElementById("mac-details");
  if (detailsDiv) {
    detailsDiv.innerHTML = `<p><strong>Layer:</strong></p>`;
  }
  clearSidePanel();
  clickableMACs.forEach(macGroup => {
    macGroup.userData.canvasWrapper = null;
  });
}

function createMACCanvas(macGroup) {
  const containerDiv = document.createElement("div");
  containerDiv.classList.add("mac-canvas-wrapper");
  containerDiv.style.marginBottom = "10px";
  containerDiv.style.textAlign = "center";
  
  const label = document.createElement("p");
  label.textContent = `MAC Layer ${(macGroup.userData.z / 10) + 1}`;
  label.style.margin = "0 0 5px 0";
  containerDiv.appendChild(label);
  
  const topCanvas = document.createElement("canvas");
  topCanvas.width = 200;
  topCanvas.height = 200;
  topCanvas.style.border = "2px solid #ccc";
  topCanvas.style.display = "block";
  topCanvas.style.margin = "0 auto";
  containerDiv.appendChild(topCanvas);
  
  const barGraphLabel = document.createElement("p");
  barGraphLabel.textContent = "MAC Activation Probabilities:";
  barGraphLabel.style.margin = "5px 0";
  barGraphLabel.style.fontStyle = "italic";
  containerDiv.appendChild(barGraphLabel);
  
  const barGraphScrollContainer = document.createElement("div");
  barGraphScrollContainer.style.width = "200px";
  barGraphScrollContainer.style.overflowX = "auto";
  barGraphScrollContainer.style.display = "block";
  barGraphScrollContainer.style.margin = "0 auto";
  
  const barGraphCanvas = document.createElement("canvas");
  barGraphCanvas.width = 800;
  barGraphCanvas.height = 100;
  barGraphCanvas.style.border = "1px solid #ccc";
  barGraphCanvas.style.marginTop = "5px";
  
  barGraphScrollContainer.appendChild(barGraphCanvas);
  containerDiv.appendChild(barGraphScrollContainer);
  
  const sidePanel = document.getElementById("side-panel");
  sidePanel.appendChild(containerDiv);
  
  createTopView(macGroup, topCanvas);
  renderBarGraph(macGroup, barGraphCanvas);
  
  return containerDiv;
}

function createTopView(macGroup, canvas) {
  const topScene = new THREE.Scene();
  topScene.background = new THREE.Color(0xffffff);
  
  const aspect = canvas.width / canvas.height;
  const viewSize = 5;
  const topCamera = new THREE.OrthographicCamera(
    -viewSize * aspect, viewSize * aspect, viewSize, -viewSize, 0.1, 100
  );
  topCamera.position.set(0, 0, 10);
  topCamera.lookAt(0, 0, 0);
  
  const compositeClone = macGroup.clone(true);
  resetOutlineColor(compositeClone);
  const scaleFactor = 1.5;
  compositeClone.scale.set(scaleFactor, scaleFactor, scaleFactor);
  compositeClone.position.set(0, 0, 0);
  topScene.add(compositeClone);
  
  const renderTarget = new THREE.WebGLRenderTarget(canvas.width, canvas.height);
  sharedTopRenderer.setRenderTarget(renderTarget);
  sharedTopRenderer.render(topScene, topCamera);
  sharedTopRenderer.setRenderTarget(null);
  
  const pixelBuffer = new Uint8Array(canvas.width * canvas.height * 4);
  sharedTopRenderer.readRenderTargetPixels(renderTarget, 0, 0, canvas.width, canvas.height, pixelBuffer);
  
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  const tempCtx = tempCanvas.getContext('2d');
  const imageData = tempCtx.createImageData(canvas.width, canvas.height);
  imageData.data.set(pixelBuffer);
  flipImageDataVertically(imageData);
  tempCtx.putImageData(imageData, 0, 0);
  
  const ctx2d = canvas.getContext('2d');
  ctx2d.clearRect(0, 0, canvas.width, canvas.height);
  ctx2d.drawImage(tempCanvas, 0, 0);
  
  renderTarget.dispose();
}

function flipImageDataVertically(imageData) {
  const width = imageData.width;
  const height = imageData.height;
  const halfHeight = Math.floor(height / 2);
  const bytesPerRow = width * 4;
  const temp = new Uint8Array(bytesPerRow);
  for (let row = 0; row < halfHeight; row++) {
    const topOffset = row * bytesPerRow;
    const bottomOffset = (height - row - 1) * bytesPerRow;
    temp.set(imageData.data.slice(topOffset, topOffset + bytesPerRow));
    imageData.data.copyWithin(topOffset, bottomOffset, bottomOffset + bytesPerRow);
    imageData.data.set(temp, bottomOffset);
  }
}

function resetOutlineColor(group) {
  group.traverse(child => {
    if (child.isLine && child.material && child.material.color && child.userData && child.userData.type === "mac_outline") {
      child.material.color.set(0x000000);
    }
  });
}

function renderBarGraph(macGroup, canvas) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const sampleData = Array.from({ length: 40 }, () => Math.random());
  const fixedBarWidth = 10;
  const gap = 8;
  const offsetX = 0;
  const maxBarHeight = canvas.height - 20;

  sampleData.forEach((value, index) => {
    const barHeight = value * maxBarHeight;
    const x = offsetX + index * (fixedBarWidth + gap);
    const y = canvas.height - barHeight - 10;
    
    ctx.fillStyle = '#007bff';
    ctx.fillRect(x, y, fixedBarWidth, barHeight);
    ctx.strokeStyle = '#000';
    ctx.strokeRect(x, y, fixedBarWidth, barHeight);
    
    ctx.fillStyle = '#000';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(index + 1, x + fixedBarWidth / 2, canvas.height - 2);
  });
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
  const numSegments = 20;
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

function clearSidePanel() {
  const sidePanel = document.getElementById("side-panel");
  while (sidePanel.firstChild) {
    let child = sidePanel.firstChild;
    if (child instanceof HTMLElement && child.querySelector) {
      const canvas = child.querySelector("canvas");
      if (canvas && canvas._topRenderer) {
        canvas._topRenderer.dispose();
        delete canvas._topRenderer;
      }
    }
    sidePanel.removeChild(child);
  }
}

window.onload = initialize;
