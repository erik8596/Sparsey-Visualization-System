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

        macGroup.position.set(
          element.x - layerCenters[element.z].x,
          (element.y - layerCenters[element.z].y) * mac_spacing,
          element.z
        );

        this.sceneManager.add(macGroup);
        this.clickableMACs.push(macGroup);
        macGroups.push(macGroup);

        // Put macGroup in layerGroups for uniform scaling
        if (!this.layerGroups[element.z]) {
          this.layerGroups[element.z] = [];
        }
        this.layerGroups[element.z].push(macGroup);
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

        object.position.set(
          element.x - layerCenters[element.z].x,
          (element.y - layerCenters[element.z].y) * mac_spacing,
          element.z
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
        if (!this.layerGroups[element.z]) {
          this.layerGroups[element.z] = [];
        }
        this.layerGroups[element.z].push(object);
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

    // 6) Create a single uniform scale slider for each layer, including the input
    this.generateUniformScaleSliders();  // [PRESERVED from your snippet, does the side panel sliders]
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
   * For each layer in layerGroups, create a single uniform scale slider in the left panel.
   */
  generateUniformScaleSliders() {
    // [PRESERVED] This was from your snippet, building the slider in "left-side-panel"
    const leftPanel = document.getElementById('left-side-panel');
    if (!leftPanel) return;

    let scaleContainer = document.getElementById('uniform-layer-scales');
    if (!scaleContainer) {
      scaleContainer = document.createElement('div');
      scaleContainer.id = 'uniform-layer-scales';
      scaleContainer.style.margin = '10px 0';
      scaleContainer.style.padding = '10px';
      scaleContainer.style.borderTop = '1px solid #999';
      leftPanel.appendChild(scaleContainer);
    } else {
      scaleContainer.innerHTML = '';
    }

    const title = document.createElement('h4');
    title.textContent = 'Scale Each Layer (Including Input)';
    scaleContainer.appendChild(title);

    const zValues = Object.keys(this.layerGroups)
      .map(z => parseFloat(z))
      .sort((a, b) => a - b);

    zValues.forEach(zVal => {
      const labelName = (zVal === this.inputGridZ) ? 'Input Layer' : `Layer Z=${zVal}`;

      const wrapper = document.createElement('div');
      wrapper.style.marginBottom = '8px';

      const label = document.createElement('label');
      label.textContent = labelName;
      label.style.display = 'block';
      label.style.marginBottom = '4px';

      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = '0.1';
      slider.max = '3.0';
      slider.step = '0.05';
      slider.value = '1.0';

      slider.addEventListener('input', (evt) => {
        const scaleVal = parseFloat(evt.target.value);
        if (this.layerGroups[zVal]) {
          this.layerGroups[zVal].forEach(obj => {
            obj.scale.set(scaleVal, scaleVal, scaleVal);
          });
        }
      });

      wrapper.appendChild(label);
      wrapper.appendChild(slider);
      scaleContainer.appendChild(wrapper);
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
    if (macGroup.userData.isSelected) {
      macGroup.remove(macGroup.userData.innerOutline); // Remove inner green border
      macGroup.userData.isSelected = false;
      const idx = this.selectedMACs.indexOf(macGroup);
      if (idx !== -1) {
        this.selectedMACs.splice(idx, 1);
      }
      if (macGroup.userData.canvasWrapper) {
        macGroup.userData.canvasWrapper.style.display = 'none';
      }
    } else {
      if (!macGroup.userData.canvasWrapper) {
        macGroup.userData.canvasWrapper = this.createMACCanvas(macGroup);
      } else {
        macGroup.userData.canvasWrapper.style.display = 'block';
      }
      
      // Create an inner green border
      const innerOutlineGeometry = outlineLine.geometry.clone();
      const innerOutlineMaterial = new THREE.LineBasicMaterial({ color: 0x08FF08, linewidth: 4 });
      const innerOutline = new THREE.LineLoop(innerOutlineGeometry, innerOutlineMaterial);
      innerOutline.position.z = 0.01; // Slightly above main outline to be visible
      macGroup.add(innerOutline);
      macGroup.userData.innerOutline = innerOutline;
      
      macGroup.userData.isSelected = true;
      this.selectedMACs.push(macGroup);
    }

    const macData = macGroup.userData;
    const layer = (macData.z / 10) + 1;
    const detailsDiv = document.getElementById('mac-details');
    if (detailsDiv) {
      detailsDiv.innerHTML = `<p><strong>Layer:</strong> ${layer.toFixed(1)}</p>`;
    }
  }

  resetToggledMACs() {
    this.selectedMACs.forEach(macGroup => {
      if (macGroup.userData.isSelected) {
        macGroup.userData.outlineLine.material.color.set(0x000000);
        macGroup.position.z = macGroup.userData.originalZ;
        macGroup.userData.isSelected = false;
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
    label.textContent = `MAC Layer ${(macGroup.userData.z / 10) + 1}`;
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
