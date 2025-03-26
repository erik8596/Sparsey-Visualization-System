// File: /static/js/UIManager.js

import { eventBus } from './app.js';
// import { getElementFactory } from './factories/ElementFactoryProvider.js';

export class UIManager {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.scene = sceneManager.scene;
    this.raycaster = sceneManager.raycaster;
    this.mouse = sceneManager.mouse;
    this.sharedTopRenderer = sceneManager.sharedTopRenderer;
    this.projectSelect = document.getElementById('projectSelect');
    this.runSelect = document.getElementById('runSelect');
    this.visualizeButton = document.getElementById('visualizeButton');
    this.macDetailsContainer = document.getElementById('mac-details-container');
    this.macDetailsMsg = document.getElementById('mac-details-msg');
    this.resetButton = document.getElementById('resetButton');
    this.sidePanelContainer = document.getElementById('side-panel');
    this.bottomPanelContainer = document.getElementById('bottom-panel');

    // Dictionary of arrays keyed by z-value for uniform scaling
    // [PRESERVED] original property from old snippet
    this.layerGroups = {};

    // We'll store the entire input layer in a single group at a special z
    // [PRESERVED + used in the updated code]
    this.inputGridGroup = null;
    // [PRESERVED] "fake" z-value for input layer
    this.inputGridZ = -9999;

    this.clickableMACs = [];
    this.selectedMACs = [];

    // Subscribe to "sceneClicked"
    eventBus.subscribe('sceneClicked', (event) => this.onSceneClick(event));
    // Subscribe to "resetMACs"
    eventBus.subscribe('resetMACs', () => this.resetToggledMACs());
  }

  /**
   * Main entry to build all layers from W&B data.
   * 
   * @param {Array} layers - array of MAC/CM/neuron objects
   * @param {Object} inputDims - optional {width, height}
   * @param {Object} inputActivations - optional dictionary for input cell states
   */
  buildFromLayers(layers, inputDims = null, inputActivations = null) {
    // 1) Clear old scene objects
    while (this.scene.children.length > 0) {
      this.scene.remove(this.scene.children[0]);
    }
    this.clickableMACs = [];
    this.selectedMACs = [];

    // Clear old dictionary
    this.layerGroups = {};
    this.inputGridGroup = null;

    const macGroups = [];
    const mac_spacing = 1.33;

    // 2) Compute layer-wise centroids to center align each layer
    const layerGroupsObj = {};
    layers.forEach(element => {
      const layer = element.z;
      if (!layerGroupsObj[layer]) {
        layerGroupsObj[layer] = [];
      }
      layerGroupsObj[layer].push(element);
    });

    // Calculate center offsets for each layer
    const layerCenters = {};
    Object.keys(layerGroupsObj).forEach(layer => {
      const elements = layerGroupsObj[layer];
      let sumX = 0, sumY = 0;
      elements.forEach(el => {
        sumX += el.x;
        sumY += el.y;
      });
      layerCenters[layer] = {
        x: sumX / elements.length,
        y: sumY / elements.length
      };
    });

    // [DEBUG LOG] Show all z-values in your data
    console.log("[DEBUG] All layer z-values (unfiltered):", layers.map(el => el.z));
    // [DEBUG LOG] Also show inputGridZ
    console.log("[DEBUG] inputGridZ is:", this.inputGridZ);

    /**
     * [NEW or MODIFIED] Build a map from z-value -> layer index, EXCLUDING the input layer (z = -9999).
     * This ensures each unique real layer z gets a stable 1-based index,
     * and won't be offset by the input layer.
     */
    const relevantZValues = layers
      .map(el => el.z)
      .filter(z => z !== this.inputGridZ);  // exclude -9999
    // [DEBUG LOG] Show the relevant z-values after filtering out -9999
    console.log("[DEBUG] Excluding inputGridZ =>", relevantZValues);
    // Sort them
    const uniqueZValues = [...new Set(relevantZValues)].sort((a, b) => a - b);
    // [DEBUG LOG] Show the sorted real layers
    console.log("[DEBUG] Sorted real layers:", uniqueZValues);
    // Now map each real z to an index (1-based)
    const zToIndexMap = {};
    uniqueZValues.forEach((zVal, idx) => {
      zToIndexMap[zVal] = idx + 1;
    });
    // [DEBUG LOG] Show the final z -> layerIndex mapping
    console.log("[DEBUG] zToIndexMap:", zToIndexMap);
    // Store the mapping for later use in generating the sliders
    this.zToIndexMap = zToIndexMap;

    // 3) First pass: build MAC composites
    layers.forEach(element => {
      if (element.type === 'mac') {
        const macGroup = new THREE.Group();
        const shape = new THREE.Shape();
        this.drawHexagon(shape, 2.0);

        const fillGeometry = new THREE.ShapeGeometry(shape);
        const isActive = (element.active === true || element.active === 1);
        const fillColor = isActive ? new THREE.Color(1.0, 0, 0) : new THREE.Color(0xcccccc);
        const fillOpacity = isActive ? 0.8 : 0.2;

        const fillMaterial = new THREE.MeshBasicMaterial({
          color: fillColor,
          transparent: true,
          opacity: fillOpacity,
          side: THREE.DoubleSide
        });
        const fillMesh = new THREE.Mesh(fillGeometry, fillMaterial);
        fillMesh.position.z = -0.01;
        macGroup.add(fillMesh);

        if (element.raw_activation !== undefined) {
          macGroup.userData.raw_activation = element.raw_activation;
        }
        if (element.avg_activation !== undefined) {
          macGroup.userData.avg_activation = element.avg_activation;
        }

        const points = shape.getPoints();
        const outlineGeometry = new THREE.BufferGeometry().setFromPoints(points);
        const outlineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 });
        const outlineLine = new THREE.LineLoop(outlineGeometry, outlineMaterial);
        outlineLine.userData = { type: 'mac_outline' };
        macGroup.add(outlineLine);

        macGroup.userData = element;
        macGroup.userData.outlineLine = outlineLine;
        macGroup.userData.fillMesh = fillMesh;
        macGroup.userData.originalZ = element.z;
        macGroup.userData.type = 'mac';

        // [NEW] Store the stable "layerIndex" for this MAC,
        // defaulting to 0 if it's not in zToIndexMap (e.g., if it was the input layer).
        const thisZ = element.z;
        macGroup.userData.layerIndex = zToIndexMap[thisZ] || 0;

        // Position the MAC in the scene (centered by subtracting layerCenters)
        macGroup.position.set(
          element.x - layerCenters[thisZ].x,
          (element.y - layerCenters[thisZ].y) * mac_spacing,
          thisZ
        );

        this.sceneManager.add(macGroup);
        this.clickableMACs.push(macGroup);
        macGroups.push(macGroup);

        // Put macGroup in layerGroups for uniform scaling
        if (!this.layerGroups[thisZ]) {
          this.layerGroups[thisZ] = [];
        }
        this.layerGroups[thisZ].push(macGroup);
      }
    });

    // 4) Second pass: build CM/neuron objects
    layers.forEach(element => {
      if (element.type === 'cm' || element.type === 'neuron') {
        let object;
        if (element.type === 'cm') {
          // [PRESERVED from your old code, but changed the shape to 'drawCircle' if you want a circle]
          const shape = new THREE.Shape();
          this.drawCircle(shape, 0.4); 
          const points = shape.getPoints();
          const geometry = new THREE.BufferGeometry().setFromPoints(points);
          const material = new THREE.LineBasicMaterial({ color: 0x0000FF, linewidth: 2 });
          object = new THREE.LineLoop(geometry, material);
        } else if (element.type === 'neuron') {
          const shape = new THREE.Shape();
          this.drawCircle(shape, 0.10);

          if (element.active) {
            const fillGeometry = new THREE.ShapeGeometry(shape);
            const intensity = element.raw_activation || 0;
            const color = new THREE.Color(0, intensity, 0);
            const fillMaterial = new THREE.MeshBasicMaterial({
              color: color,
              side: THREE.DoubleSide,
              transparent: true,
              opacity: 0.8
            });
            object = new THREE.Mesh(fillGeometry, fillMaterial);
          } else {
            const points = shape.getPoints();
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({
              color: 0x444444,
              linewidth: 1,
              transparent: true,
              opacity: 0.2
            });
            object = new THREE.LineLoop(geometry, material);
          }

          if (element.raw_activation !== undefined) {
            object.userData.raw_activation = element.raw_activation;
          }
          if (element.avg_activation !== undefined) {
            object.userData.avg_activation = element.avg_activation;
          }
        }

        object.userData = element;
        object.userData.type = element.type;

        // [NEW - optional] Also store stable layerIndex for CMs/neurons
        const thisZ = element.z;
        object.userData.layerIndex = zToIndexMap[thisZ] || 0;

        object.position.set(
          element.x - layerCenters[thisZ].x,
          (element.y - layerCenters[thisZ].y) * mac_spacing,
          thisZ
        );

        // Attach to nearest MAC if that logic remains
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
          this.sceneManager.add(object);
        }

        // Store object in layerGroups for uniform scaling
        if (!this.layerGroups[thisZ]) {
          this.layerGroups[thisZ] = [];
        }
        this.layerGroups[thisZ].push(object);
      }
    });

    // 5) Build the input layer from real W&B data if available
    if (inputDims && inputDims.width && inputDims.height) {
      this.createInputGrid(inputDims.width, inputDims.height, inputActivations);
      // Register the entire inputGridGroup under inputGridZ
      if (!this.layerGroups[this.inputGridZ]) {
        this.layerGroups[this.inputGridZ] = [];
      }
      this.layerGroups[this.inputGridZ].push(this.inputGridGroup);
    }

    // 6) Create a single uniform scale slider for each layer, including the input.
    this.generateUniformScaleSliders();
  }

  /**
   * Creates an entire input grid in a single group.
   * We store it in "this.inputGridGroup" so we can do uniform scaling on it.
   */
  createInputGrid(cols, rows, activations = {}) {
    // [ADDED] If we already had one, remove it from the scene
    if (this.inputGridGroup) {
      this.scene.remove(this.inputGridGroup);
    }
    // Create fresh group for the input layer
    this.inputGridGroup = new THREE.Group();

    // [PRESERVED from your snippet: position it at Z=-10 or whatever you prefer]
    this.inputGridGroup.position.set(0, 0, -10);
    this.scene.add(this.inputGridGroup);

    const hexSize = 2.0;
    const macSpacing = 3.0;
    // [MODIFIED] zOffset = 0 so that the group itself is at -10 in world space
    const zOffset = 0;  

    for (let rowIdx = 0; rowIdx < rows; rowIdx++) {
      for (let colIdx = 0; colIdx < cols; colIdx++) {
        const x = colIdx * macSpacing;
        let y = rowIdx * Math.sqrt(3) * hexSize;
        if (colIdx % 2 !== 0) {
          y += (Math.sqrt(3) * hexSize) / 2;
        }

        // Activation check
        const macIndex = rowIdx * cols + colIdx + 1;
        const isActive = (activations[macIndex] === 1);

        // Create shape
        const shape = new THREE.Shape();
        this.drawHexagon(shape, hexSize);

        // Fill
        const fillGeometry = new THREE.ShapeGeometry(shape);
        const fillMaterial = new THREE.MeshBasicMaterial({
          color: 0xffcccc,
          transparent: true,
          opacity: isActive ? 1.0 : 0.0,
          side: THREE.DoubleSide
        });
        const fillMesh = new THREE.Mesh(fillGeometry, fillMaterial);

        // Outline
        const points = shape.getPoints();
        const outlineGeometry = new THREE.BufferGeometry().setFromPoints(points);
        const outlineMaterial = new THREE.LineBasicMaterial({
          color: 0x0000ff,
          linewidth: 1
        });
        const outlineMesh = new THREE.LineLoop(outlineGeometry, outlineMaterial);

        // Group them
        const cellGroup = new THREE.Group();
        cellGroup.add(fillMesh);
        cellGroup.add(outlineMesh);

        // Center horizontally & vertically, but keep Z=0
        cellGroup.position.set(
          x - ((cols - 1) * macSpacing) / 2,
          y - ((rows - 1) * Math.sqrt(3) * hexSize) / 2,
          zOffset
        );

        this.inputGridGroup.add(cellGroup);
      }
    }
  }

 /**
 * Creates a styled box (using CSS) that contains the "Individual Layer Controls"
 * title and, for each layer, a subheading and a row with a "Scaling:" label, a slider, 
 * and a reset button. Dividers are inserted between layer groups.
 */
generateUniformScaleSliders() {
  const leftPanel = document.getElementById('left-side-panel');
  if (!leftPanel) return;

  // Create or reuse the scaling controls container.
  let scaleContainer = document.getElementById('uniform-layer-scales');
  if (!scaleContainer) {
    scaleContainer = document.createElement('div');
    scaleContainer.id = 'uniform-layer-scales';
    leftPanel.appendChild(scaleContainer);
  } else {
    scaleContainer.innerHTML = '';
  }

  // Add the title inside the box.
  const title = document.createElement('h4');
  title.textContent = 'Individual Layer Controls';
  title.style.marginTop = '0';
  title.style.marginBottom = '5px';
  title.style.textAlign = 'center';
  title.style.fontStyle = 'italic';
  scaleContainer.appendChild(title);

  // Collect, sort, and then reverse the z-values from our layerGroups
  const zValues = Object.keys(this.layerGroups)
    .map(z => parseFloat(z))
    .sort((a, b) => a - b)
    .reverse();

  // For each z-value, create a slider group.
  zValues.forEach((zVal, index) => {
    let labelName;
    if (zVal === this.inputGridZ) {
      labelName = 'Input Layer';
    } else if (this.zToIndexMap && this.zToIndexMap[zVal] != null) {
      const layerIndex = this.zToIndexMap[zVal];
      labelName = `Layer ${layerIndex}`;
    } else {
      labelName = `Layer Z=${zVal}`;
    }

    // Create a container for this layer's controls.
    const layerContainer = document.createElement('div');
    layerContainer.className = 'layer-container';

    // Create a subheading for the layer.
    const subheading = document.createElement('h5');
    subheading.textContent = labelName;
    subheading.className = 'layer-subheading';
    subheading.style.margin = '0';
    subheading.style.marginBottom = '5px';
    subheading.style.textAlign = 'center';
    layerContainer.appendChild(subheading);

    // Create a row for the scaling controls.
    const sliderRow = document.createElement('div');
    sliderRow.className = 'slider-row';
    sliderRow.style.display = 'flex';
    sliderRow.style.alignItems = 'center';

    // Create a label for the slider.
    const scalingLabel = document.createElement('label');
    scalingLabel.textContent = 'Scaling:';
    scalingLabel.className = 'scaling-label';
    scalingLabel.style.marginRight = '8px';
    sliderRow.appendChild(scalingLabel);

    // Create the slider.
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0.1';
    slider.max = '3.0';
    slider.step = '0.05';
    slider.value = '1.0';
    slider.className = 'layer-slider';
    slider.style.setProperty('width', '150px', 'important');
    slider.addEventListener('input', (evt) => {
      const scaleVal = parseFloat(evt.target.value);
      if (this.layerGroups[zVal]) {
        this.layerGroups[zVal].forEach(obj => {
          obj.scale.set(scaleVal, scaleVal, scaleVal);
        });
      }
    });
    sliderRow.appendChild(slider);

    // Create the reset button.
    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'Reset';
    resetBtn.className = 'slider-reset-btn';
    resetBtn.style.marginLeft = '8px';
    resetBtn.style.padding = '2px 6px';
    resetBtn.style.fontSize = '0.8em';
    resetBtn.addEventListener('click', (evt) => {
      slider.value = '1.0';
      if (this.layerGroups[zVal]) {
        this.layerGroups[zVal].forEach(obj => {
          obj.scale.set(1, 1, 1);
        });
      }
    });
    sliderRow.appendChild(resetBtn);

    // Append the slider row to the layer container.
    layerContainer.appendChild(sliderRow);

    // Create a toggle row for showing/hiding MACs, CMs, and Neurons
    const toggleRow = document.createElement('div');
    toggleRow.className = 'toggle-row';
    toggleRow.style.display = 'flex';
    toggleRow.style.justifyContent = 'space-around';
    toggleRow.style.marginTop = '5px';

    // MACs toggle checkbox
    const macCheckbox = document.createElement('input');
    macCheckbox.type = 'checkbox';
    macCheckbox.id = `toggle-mac-${zVal}`;
    macCheckbox.checked = true;
    toggleRow.appendChild(macCheckbox);
    const macLabel = document.createElement('label');
    macLabel.htmlFor = `toggle-mac-${zVal}`;
    macLabel.textContent = 'MACs';
    toggleRow.appendChild(macLabel);

    // CMs toggle checkbox
    const cmCheckbox = document.createElement('input');
    cmCheckbox.type = 'checkbox';
    cmCheckbox.id = `toggle-cm-${zVal}`;
    cmCheckbox.checked = true;
    toggleRow.appendChild(cmCheckbox);
    const cmLabel = document.createElement('label');
    cmLabel.htmlFor = `toggle-cm-${zVal}`;
    cmLabel.textContent = 'CMs';
    toggleRow.appendChild(cmLabel);

    // Neurons toggle checkbox
    const neuronCheckbox = document.createElement('input');
    neuronCheckbox.type = 'checkbox';
    neuronCheckbox.id = `toggle-neuron-${zVal}`;
    neuronCheckbox.checked = true;
    toggleRow.appendChild(neuronCheckbox);
    const neuronLabel = document.createElement('label');
    neuronLabel.htmlFor = `toggle-neuron-${zVal}`;
    neuronLabel.textContent = 'Neurons';
    toggleRow.appendChild(neuronLabel);

    // Append the toggle row to the layer's container
    layerContainer.appendChild(toggleRow);

    // Event listener for MACs toggle
    macCheckbox.addEventListener('change', () => {
      const show = macCheckbox.checked;
      if (this.layerGroups[zVal]) {
        this.layerGroups[zVal].forEach(obj => {
          if (obj.userData && obj.userData.type === 'mac') {
            obj.visible = show;
            if (show) {
              // Add back to clickableMACs if not already present
              if (!this.clickableMACs.includes(obj)) {
                this.clickableMACs.push(obj);
              }
            } else {
              // Remove from clickableMACs so they become untoggleable while hidden
              const idx = this.clickableMACs.indexOf(obj);
              if (idx > -1) {
                this.clickableMACs.splice(idx, 1);
              }
            }
          }
        });
      }
    });

    // Event listener for CMs toggle
    cmCheckbox.addEventListener('change', () => {
      const show = cmCheckbox.checked;
      if (this.layerGroups[zVal]) {
        this.layerGroups[zVal].forEach(obj => {
          if (obj.userData && obj.userData.type === 'cm') {
            obj.visible = show;
          }
        });
      }
    });

    // Event listener for Neurons toggle
    neuronCheckbox.addEventListener('change', () => {
      const show = neuronCheckbox.checked;
      if (this.layerGroups[zVal]) {
        this.layerGroups[zVal].forEach(obj => {
          if (obj.userData && obj.userData.type === 'neuron') {
            obj.visible = show;
          }
        });
      }
    });

    // --- End toggle controls block ---

    // Append the layer container to the scaling controls container.
    scaleContainer.appendChild(layerContainer);

    // If this is not the last layer, insert a divider.
    if (index < zValues.length - 1) {
      const divider = document.createElement('hr');
      divider.className = 'slider-divider';
      scaleContainer.appendChild(divider);
    }
  });
}

  onSceneClick(event) {
    const rect = this.sceneManager.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.sceneManager.camera);
    const intersects = this.raycaster.intersectObjects(this.clickableMACs, true);
    if (intersects.length > 0) {
      const macGroup = this.getMACGroup(intersects[0].object);
      if (macGroup && macGroup.userData.type === 'mac') {
        this.toggleMACSelection(macGroup);
        eventBus.notify('macToggled', macGroup);
      }
    }
  }

  getMACGroup(object) {
    while (object) {
      if (this.clickableMACs.includes(object) && object.userData && object.userData.type === 'mac') {
        return object;
      }
      object = object.parent;
    }
    return null;
  }

  toggleMACSelection(macGroup) {
    const outlineLine = macGroup.userData.outlineLine;

    // Optional helper: disable raycasting on newly added lines
    function disableRaycast(object) {
      object.raycast = () => {};
      object.children && object.children.forEach(child => disableRaycast(child));
    }

    if (macGroup.userData.isSelected) {
      // Deselecting
      if (macGroup.userData.innerOutline) {
        macGroup.remove(macGroup.userData.innerOutline); // remove green border
        macGroup.userData.innerOutline = null;
      }
      macGroup.userData.isSelected = false;

      // Hide side-panel info for this MAC
      if (macGroup.userData.canvasWrapper) {
        macGroup.userData.canvasWrapper.style.display = 'none';
      }

      // Remove from the array of selected MACs
      const idx = this.selectedMACs.indexOf(macGroup);
      if (idx !== -1) {
        this.selectedMACs.splice(idx, 1);
      }
    } else {
      // Selecting
      if (!macGroup.userData.canvasWrapper) {
        macGroup.userData.canvasWrapper = this.createMACCanvas(macGroup);
      } else {
        macGroup.userData.canvasWrapper.style.display = 'block';
      }

      // Create an inner green border
      const innerOutlineGeometry = outlineLine.geometry.clone();
      const innerOutlineMaterial = new THREE.LineBasicMaterial({ color: 0x08FF08, linewidth: 1 });
      const innerOutline = new THREE.LineLoop(innerOutlineGeometry, innerOutlineMaterial);
      innerOutline.position.z = 0.01; // slightly above main outline
      disableRaycast(innerOutline);
      macGroup.add(innerOutline);

      macGroup.userData.innerOutline = innerOutline;
      macGroup.userData.isSelected = true;
      this.selectedMACs.push(macGroup);
    }

    // [MODIFIED] Use the stable layerIndex for display in the side panel.
    const layerIndex = macGroup.userData.layerIndex;
    const detailsDiv = document.getElementById('mac-details');
    if (detailsDiv) {
      detailsDiv.innerHTML = `<p><strong>Layer:</strong> ${layerIndex}</p>`;
    }
  }

  resetToggledMACs() {
    this.selectedMACs.forEach(macGroup => {
      if (macGroup.userData.isSelected) {
        macGroup.userData.outlineLine.material.color.set(0x000000);
        macGroup.position.z = macGroup.userData.originalZ;
        macGroup.userData.isSelected = false;
        if (macGroup.userData.innerOutline) {
          macGroup.remove(macGroup.userData.innerOutline);
          macGroup.userData.innerOutline = null;
        }
      }
    });
    this.selectedMACs = [];
    const detailsDiv = document.getElementById("mac-details");
    if (detailsDiv) {
      detailsDiv.innerHTML = `<p><strong>Layer:</strong></p>`;
    }
    this.clearSidePanel();
    this.clickableMACs.forEach(macGroup => {
      macGroup.userData.canvasWrapper = null;
    });
  }

  createMACCanvas(macGroup) {
    const containerDiv = document.createElement('div');
    containerDiv.classList.add('mac-canvas-wrapper');
    containerDiv.style.marginBottom = '10px';
    containerDiv.style.textAlign = 'center';

    const label = document.createElement('p');
    // Display using the stable layerIndex
    label.textContent = `MAC Layer ${macGroup.userData.layerIndex}`;
    label.style.margin = '0 0 5px 0';
    containerDiv.appendChild(label);

    const topCanvas = document.createElement('canvas');
    topCanvas.width = 200;
    topCanvas.height = 200;
    topCanvas.style.border = '2px solid #ccc';
    topCanvas.style.display = 'block';
    topCanvas.style.margin = '0 auto';
    containerDiv.appendChild(topCanvas);

    const barGraphLabel = document.createElement('p');
    barGraphLabel.textContent = 'MAC Activation Probabilities:';
    barGraphLabel.style.margin = '5px 0';
    barGraphLabel.style.fontStyle = 'italic';
    containerDiv.appendChild(barGraphLabel);

    const barGraphScrollContainer = document.createElement('div');
    barGraphScrollContainer.style.width = '200px';
    barGraphScrollContainer.style.overflowX = 'auto';
    barGraphScrollContainer.style.display = 'block';
    barGraphScrollContainer.style.margin = '0 auto';

    const barGraphCanvas = document.createElement('canvas');
    barGraphCanvas.width = 800;
    barGraphCanvas.height = 100;
    barGraphCanvas.style.border = '1px solid #ccc';
    barGraphCanvas.style.marginTop = '5px';

    barGraphScrollContainer.appendChild(barGraphCanvas);
    containerDiv.appendChild(barGraphScrollContainer);

    const sidePanel = document.getElementById('side-panel');
    sidePanel.appendChild(containerDiv);

    this.createTopView(macGroup, topCanvas);
    this.renderBarGraph(macGroup, barGraphCanvas);

    return containerDiv;
  }

  createTopView(macGroup, canvas) {
    if (!this.sharedTopRenderer) {
      console.error('Shared top renderer not initialized');
      return;
    }

    const topScene = new THREE.Scene();
    topScene.background = new THREE.Color(0xffffff);

    const aspect = canvas.width / canvas.height;
    const viewSize = 5;
    const topCamera = new THREE.OrthographicCamera(
      -viewSize * aspect, viewSize * aspect,
      viewSize, -viewSize,
      0.1, 100
    );
    topCamera.position.set(0, 0, 10);
    topCamera.lookAt(0, 0, 0);

    const compositeClone = macGroup.clone(true);
    this.resetOutlineColor(compositeClone);
    const scaleFactor = 1.5;
    compositeClone.scale.set(scaleFactor, scaleFactor, scaleFactor);
    compositeClone.position.set(0, 0, 0);
    topScene.add(compositeClone);

    try {
      const renderTarget = new THREE.WebGLRenderTarget(canvas.width, canvas.height);
      this.sharedTopRenderer.setRenderTarget(renderTarget);
      this.sharedTopRenderer.render(topScene, topCamera);
      this.sharedTopRenderer.setRenderTarget(null);

      const pixelBuffer = new Uint8Array(canvas.width * canvas.height * 4);
      this.sharedTopRenderer.readRenderTargetPixels(
        renderTarget, 0, 0, canvas.width, canvas.height, pixelBuffer
      );

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      const imageData = tempCtx.createImageData(canvas.width, canvas.height);
      imageData.data.set(pixelBuffer);
      this.flipImageDataVertically(imageData);
      tempCtx.putImageData(imageData, 0, 0);

      const ctx2d = canvas.getContext('2d');
      ctx2d.clearRect(0, 0, canvas.width, canvas.height);
      ctx2d.drawImage(tempCanvas, 0, 0);

      renderTarget.dispose();
    } catch (error) {
      console.error('Error creating top view:', error);
    }
  }

  renderBarGraph(macGroup, canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // [PRESERVED sample data approach from your snippet]
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
      ctx.font = '10px Helvetica';
      ctx.textAlign = 'center';
      ctx.fillText(index + 1, x + fixedBarWidth / 2, canvas.height - 2);
    });
  }

  resetOutlineColor(group) {
    group.traverse(child => {
      if (child.isLine && child.material && child.material.color && child.userData && child.userData.type === 'mac_outline') {
        child.material.color.set(0x000000);
      }
    });
  }

  flipImageDataVertically(imageData) {
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

  clearSidePanel() {
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

  updateProjectDropdown(projects) {
    this.projectSelect.innerHTML = '<option value="" disabled selected>Select a project</option>';
    projects.forEach(project => {
      const option = document.createElement('option');
      option.value = project;
      option.textContent = project;
      this.projectSelect.appendChild(option);
    });
    this.projectSelect.disabled = false;
    this.runSelect.disabled = true;
    this.visualizeButton.disabled = true;
  }

  updateRunDropdown(project_runs) {
    console.log('Updating run dropdown with data:', project_runs);

    if (!this.runSelect) {
      console.error('Run select element not found!');
      return;
    }

    this.runSelect.innerHTML = '<option value="" disabled selected>Select a run</option>';

    // Check if project_runs is an array and has items
    if (!Array.isArray(project_runs) || project_runs.length === 0) {
      console.log('No valid runs data to display');
      this.runSelect.innerHTML = '<option value="" disabled selected>No runs available</option>';
      this.runSelect.disabled = true;
      this.visualizeButton.disabled = true;
      return;
    }

    // Add each run to the dropdown
    project_runs.forEach(run => {
      const option = document.createElement('option');
      option.value = run.id;
      option.textContent = run.name;
      this.runSelect.appendChild(option);
    });

    this.runSelect.disabled = false;
    this.visualizeButton.disabled = false;
  }

  showError(message) {
    console.error(message);
    alert(message);
  }

  updateMACDetails(macData) {
    if (!macData) {
      this.macDetailsMsg.textContent = '(Click on a MAC to see its details)';
      return;
    }
    this.macDetailsMsg.textContent = `MAC ID: ${macData.id}
        Layer: ${macData.layer}
        Position: (${macData.position.x.toFixed(4)}, ${macData.position.y.toFixed(4)}, ${macData.position.z.toFixed(4)})`;
  }

  clearBottomPanel() {
    while (this.bottomPanelContainer.firstChild) {
      this.bottomPanelContainer.removeChild(this.bottomPanelContainer.firstChild);
    }
  }

  addSidePanelCanvas(canvas) {
    this.sidePanelContainer.appendChild(canvas);
  }

  // [NEW METHOD – if you want to show/hide the left side panel]
  toggleSidePanel() {
    const panel = document.getElementById('left-side-panel');
    if (!panel) return;
    panel.classList.toggle('collapsed');
  }

  addBottomPanelCanvas(canvas) {
    this.bottomPanelContainer.appendChild(canvas);
  }

  drawHexagon(shape, size) {
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

  drawCircle(shape, radius) {
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
}
