// File: /static/js/UIManager.js
import { eventBus } from './app.js';
import { MacVisualFactory } from './factories/MacVisualFactory.js';
import { CmVisualFactory } from './factories/CmVisualFactory.js';
import { NeuronVisualFactory } from './factories/NeuronVisualFactory.js';

export class UIManager {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.scene = sceneManager.scene;
    this.raycaster = sceneManager.raycaster;
    this.mouse = sceneManager.mouse;
    this.sharedTopRenderer = sceneManager.sharedTopRenderer;
    
    // Get elements defined in index.html.
    this.projectSelect = document.getElementById('projectSelect');
    this.runSelect = document.getElementById('runSelect');
    this.visualizeButton = document.getElementById('visualizeButton');
    this.macDetailsContainer = document.getElementById('mac-details-container');
    this.macDetailsMsg = document.getElementById('mac-details-msg');
    this.resetButton = document.getElementById('resetButton');
    this.sidePanelContainer = document.getElementById('side-panel');
    this.bottomPanelContainer = document.getElementById('bottom-panel');

    // Group objects for each layer.
    this.layerGroups = {};
    this.inputGridKey = 'input';
    this.inputGridGroup = null;
    this.layerSpacing = 10;

    this.clickableMACs = [];
    this.selectedMACs = [];

    // Instantiate the visual factories.
    this.macFactory    = new MacVisualFactory();
    this.cmFactory     = new CmVisualFactory();
    this.neuronFactory = new NeuronVisualFactory();

    // Subscribe to events.
    eventBus.subscribe('sceneClicked', (event) => this.onSceneClick(event));
    eventBus.subscribe('resetMACs', () => this.resetToggledMACs());

    // Initialize static Full Model Controls.
    this.initializeFullModelControls();
  }
  
  /**
   * Builds all layers from provided data.
   */
  buildFromLayers(layers, inputDims = null, inputActivations = null) {
    // Remove old objects.
    while (this.scene.children.length > 0) {
      this.scene.remove(this.scene.children[0]);
    }
    this.clickableMACs = [];
    this.selectedMACs = [];
    this.layerGroups = {};
    this.inputGridGroup = null;
  
    const mac_spacing = 1.33;
  
    // Compute centroids per layer.
    const layerGroupsObj = {};
    layers.forEach(element => {
      const layer = element.z;
      if (!layerGroupsObj[layer]) {
        layerGroupsObj[layer] = [];
      }
      layerGroupsObj[layer].push(element);
    });
    const layerCenters = {};
    Object.keys(layerGroupsObj).forEach(layer => {
      const elements = layerGroupsObj[layer];
      let sumX = 0, sumY = 0;
      elements.forEach(el => {
        sumX += el.x;
        sumY += el.y;
      });
      layerCenters[layer] = { x: sumX / elements.length, y: sumY / elements.length };
    });
  
    console.log("[DEBUG] Layers' z-values:", layers.map(el => el.z));
    console.log("[DEBUG] inputGridKey is:", this.inputGridKey);
  
    // Build mapping for layer spacing.
    const zToIndexMap = {};
    zToIndexMap[this.inputGridKey] = 0;
    const uniqueZValues = [...new Set(layers.map(el => el.z))].sort((a, b) => a - b);
    uniqueZValues.forEach((zVal, idx) => {
      zToIndexMap[zVal] = idx + 1;
    });
    this.zToIndexMap = zToIndexMap;
    console.log("[DEBUG] zToIndexMap:", zToIndexMap);
  
    // Build MAC composites using the MacVisualFactory.
    layers.forEach(element => {
      if (element.type === 'mac') {
        const layerCenter = layerCenters[element.z];
        const layerIndex  = zToIndexMap[element.z] || 0;
        const macGroup    = this.macFactory.create(element, layerCenter, mac_spacing, layerIndex);
  
        // Create or add to layer group.
        if (!this.layerGroups[element.z]) {
          const layerGroup = new THREE.Group();
          layerGroup.position.set(0, 0, this.layerSpacing * zToIndexMap[element.z]);
          this.layerGroups[element.z] = layerGroup;
          this.sceneManager.add(layerGroup);
        }
        this.layerGroups[element.z].add(macGroup);
        this.clickableMACs.push(macGroup);
      }
    });
  
    // Build CM objects using the CmVisualFactory.
    layers.forEach(element => {
      if (element.type === 'cm') {
        const layerCenter = layerCenters[element.z];
        const obj = this.cmFactory.create(element, layerCenter, mac_spacing);
        obj.userData.layerIndex = zToIndexMap[element.z] || 0;
  
        // Attach to nearest MAC if available.
        const thisZ = element.z;
        let closestMac = null;
        let minDistance = Infinity;
        this.layerGroups[thisZ].traverse(child => {
          if (child.userData && child.userData.type === 'mac') {
            const dx = child.position.x - obj.position.x;
            const dy = child.position.y - obj.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDistance) {
              minDistance = dist;
              closestMac = child;
            }
          }
        });
        if (closestMac) {
          obj.position.sub(closestMac.position);
          closestMac.add(obj);
        } else {
          this.layerGroups[thisZ].add(obj);
        }
      }
    });
  
    // Build Neuron objects using the NeuronVisualFactory.
    layers.forEach(element => {
      if (element.type === 'neuron') {
        const layerCenter = layerCenters[element.z];
        const obj = this.neuronFactory.create(element, layerCenter, mac_spacing);
        obj.userData.layerIndex = zToIndexMap[element.z] || 0;
  
        // Attach to nearest MAC if available.
        const thisZ = element.z;
        let closestMac = null;
        let minDistance = Infinity;
        this.layerGroups[thisZ].traverse(child => {
          if (child.userData && child.userData.type === 'mac') {
            const dx = child.position.x - obj.position.x;
            const dy = child.position.y - obj.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDistance) {
              minDistance = dist;
              closestMac = child;
            }
          }
        });
        if (closestMac) {
          obj.position.sub(closestMac.position);
          closestMac.add(obj);
        } else {
          this.layerGroups[thisZ].add(obj);
        }
      }
    });
  
    // Build input grid if provided.
    if (inputDims && inputDims.width && inputDims.height) {
      this.createInputGrid(inputDims.width, inputDims.height, inputActivations);
      if (!this.layerGroups[this.inputGridKey]) {
        const inputGroup = new THREE.Group();
        inputGroup.position.set(0, 0, this.layerSpacing * zToIndexMap[this.inputGridKey]);
        this.layerGroups[this.inputGridKey] = inputGroup;
        this.sceneManager.add(inputGroup);
      }
      this.layerGroups[this.inputGridKey].add(this.inputGridGroup);
    }
  
    // Update dynamic individual layer controls.
    this.updateUniformScaleSliders();
  
    // Remove the "hidden" class so that the controls become visible.
    const uniformControls = document.getElementById('uniform-layer-scales');
    const fullModelControls = document.getElementById('full-model-controls-box');
    if (uniformControls) {
      uniformControls.classList.remove('hidden');
    }
    if (fullModelControls) {
      fullModelControls.classList.remove('hidden');
    }

    // ← NEW: generate dummy arches and wire them to the checkbox
    this.generateDummyConnections();
    // ensure the checkbox state controls them immediately
    const weightedChk = document.getElementById('weightedConnectionsCheckbox');
    this.toggleDummyConnections(weightedChk?.checked);
  }
  
  /**
   * Creates the input grid.
   */
  createInputGrid(cols, rows, activations = {}) {
    this.inputGridGroup = new THREE.Group();
    this.inputGridGroup.position.set(0, 0, 0);
    const hexSize = 2.0;
    const macSpacing = 3.0;
    const zOffset = 0;
  
    for (let rowIdx = 0; rowIdx < rows; rowIdx++) {
      for (let colIdx = 0; colIdx < cols; colIdx++) {
        const x = colIdx * macSpacing;
        let y = rowIdx * Math.sqrt(3) * hexSize;
        if (colIdx % 2 !== 0) {
          y += (Math.sqrt(3) * hexSize) / 2;
        }
        const macIndex = rowIdx * cols + colIdx + 1;
        const isActive = (activations[macIndex] === 1);
        const shape = new THREE.Shape();
        this.drawHexagon(shape, hexSize);
        const fillGeometry = new THREE.ShapeGeometry(shape);
        const fillMaterial = new THREE.MeshBasicMaterial({
          color: 0xffcccc,
          transparent: true,
          opacity: isActive ? 1.0 : 0.0,
          side: THREE.DoubleSide
        });
        const fillMesh = new THREE.Mesh(fillGeometry, fillMaterial);
        const points = shape.getPoints();
        const outlineGeometry = new THREE.BufferGeometry().setFromPoints(points);
        const outlineMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff, linewidth: 1 });
        const outlineMesh = new THREE.LineLoop(outlineGeometry, outlineMaterial);
        const cellGroup = new THREE.Group();
        cellGroup.add(fillMesh);
        cellGroup.add(outlineMesh);
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
   * Dynamically updates the "Individual Layer Controls" container.
   * Uses firstElementChild (assumed to be the header) to preserve the title.
   * For the input layer (identified by this.inputGridKey), it does not add the toggles.
   */
  updateUniformScaleSliders() {
    const scaleContainer = document.getElementById('uniform-layer-scales');
    if (!scaleContainer) return;
    // Remove all children except the header (first element)
    while (scaleContainer.children.length > 1) {
      scaleContainer.removeChild(scaleContainer.lastElementChild);
    }
    // Sort keys: the input layer (this.inputGridKey) comes first; then others sorted numerically.
    const zKeys = Object.keys(this.layerGroups).sort((a, b) => {
      if (a === this.inputGridKey) return -1;
      if (b === this.inputGridKey) return 1;
      return Number(a) - Number(b);
    }).reverse();

    zKeys.forEach((key, index) => {
      let labelName;
      if (key === this.inputGridKey) {
        labelName = 'Input Layer';
      } else if (this.zToIndexMap && this.zToIndexMap[key] != null) {
        labelName = `Layer ${this.zToIndexMap[key]}`;
      } else {
        labelName = `Layer Z=${key}`;
      }

      const layerContainer = document.createElement('div');
      layerContainer.className = 'layer-container';

      const subheading = document.createElement('h5');
      subheading.textContent = labelName;
      subheading.className = 'layer-subheading';
      layerContainer.appendChild(subheading);

      // --- Create slider row (common for all layers)
      const sliderRow = document.createElement('div');
      sliderRow.className = 'slider-row';
      const scalingLabel = document.createElement('label');
      scalingLabel.textContent = 'Scaling:';
      scalingLabel.className = 'scaling-label';
      sliderRow.appendChild(scalingLabel);

      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = '0.1';
      slider.max = '3.0';
      slider.step = '0.05';
      slider.value = '1.0';
      slider.className = 'layer-slider';
      slider.addEventListener('input', (evt) => {
        const scaleVal = parseFloat(evt.target.value);
        this.layerGroups[key].scale.set(scaleVal, scaleVal, scaleVal);
      });
      sliderRow.appendChild(slider);

      const resetBtn = document.createElement('button');
      resetBtn.textContent = 'Reset';
      resetBtn.className = 'slider-reset-btn';
      resetBtn.addEventListener('click', () => {
        slider.value = '1.0';
        this.layerGroups[key].scale.set(1, 1, 1);
      });
      sliderRow.appendChild(resetBtn);
      layerContainer.appendChild(sliderRow);
      // --- End of slider row

      // Only create the toggle row if this is not the input layer
      if (key !== this.inputGridKey) {
        const toggleRow = document.createElement('div');
        toggleRow.className = 'toggle-row';

        // Create MACs checkbox.
        const macCheckbox = document.createElement('input');
        macCheckbox.type = 'checkbox';
        macCheckbox.id = `toggle-mac-${key}`;
        macCheckbox.checked = true;
        toggleRow.appendChild(macCheckbox);
        const macLabel = document.createElement('label');
        macLabel.htmlFor = `toggle-mac-${key}`;
        macLabel.textContent = 'MACs';
        toggleRow.appendChild(macLabel);

        // Create CMs checkbox.
        const cmCheckbox = document.createElement('input');
        cmCheckbox.type = 'checkbox';
        cmCheckbox.id = `toggle-cm-${key}`;
        cmCheckbox.checked = true;
        toggleRow.appendChild(cmCheckbox);
        const cmLabel = document.createElement('label');
        cmLabel.htmlFor = `toggle-cm-${key}`;
        cmLabel.textContent = 'CMs';
        toggleRow.appendChild(cmLabel);

        // Create Neurons checkbox.
        const neuronCheckbox = document.createElement('input');
        neuronCheckbox.type = 'checkbox';
        neuronCheckbox.id = `toggle-neuron-${key}`;
        neuronCheckbox.checked = true;
        toggleRow.appendChild(neuronCheckbox);
        const neuronLabel = document.createElement('label');
        neuronLabel.htmlFor = `toggle-neuron-${key}`;
        neuronLabel.textContent = 'Neurons';
        toggleRow.appendChild(neuronLabel);

        layerContainer.appendChild(toggleRow);

        // Attach event listeners for each checkbox.
        macCheckbox.addEventListener('change', () => {
          const show = macCheckbox.checked;
          if (this.layerGroups[key]) {
            this.layerGroups[key].traverse(child => {
              if (child.userData && child.userData.isMacVisual) {
                child.visible = show;
              }
            });
            if (show) {
              this.layerGroups[key].traverse(child => {
                if (child.userData && child.userData.type === 'mac' && !this.clickableMACs.includes(child)) {
                  this.clickableMACs.push(child);
                }
              });
            } else {
              this.layerGroups[key].traverse(child => {
                if (child.userData && child.userData.type === 'mac') {
                  const idx = this.clickableMACs.indexOf(child);
                  if (idx > -1) {
                    this.clickableMACs.splice(idx, 1);
                  }
                }
              });
            }
          }
        });
        cmCheckbox.addEventListener('change', () => {
          const show = cmCheckbox.checked;
          if (this.layerGroups[key]) {
            this.layerGroups[key].traverse(child => {
              if (child.userData && child.userData.type === 'cm') {
                child.visible = show;
              }
            });
          }
        });
        neuronCheckbox.addEventListener('change', () => {
          const show = neuronCheckbox.checked;
          if (this.layerGroups[key]) {
            this.layerGroups[key].traverse(child => {
              if (child.userData && child.userData.type === 'neuron') {
                child.visible = show;
              }
            });
          }
        });
      }
      
      // Append the complete layer container (slider row and, if added, toggle row)
      scaleContainer.appendChild(layerContainer);

      // Add a divider if not the last layer.
      if (index < zKeys.length - 1) {
        const divider = document.createElement('hr');
        divider.className = 'slider-divider';
        scaleContainer.appendChild(divider);
      }
    });
  }

  /**
   * Attaches event listeners to the static Full Model Controls.
   */
  initializeFullModelControls() {
    const layerSpacingSlider = document.getElementById('layerSpacingSlider');
    const resetSpacingBtn    = document.getElementById('resetSpacingBtn');
    const resetModelBtn      = document.getElementById('resetModelBtn');
    const weightedChk        = document.getElementById('weightedConnectionsCheckbox');

    // Layer Spacing slider
    if (layerSpacingSlider) {
      layerSpacingSlider.addEventListener('input', (evt) => {
        this.layerSpacing = parseFloat(evt.target.value);
        this.updateLayerSpacing();
      });
    }

    // Reset Layer Spacing button
    if (resetSpacingBtn) {
      resetSpacingBtn.addEventListener('click', () => {
        this.layerSpacing = 10;
        if (layerSpacingSlider) layerSpacingSlider.value = '10';
        this.updateLayerSpacing();
      });
    }

    // RESET ALL button
    if (resetModelBtn) {
      resetModelBtn.addEventListener('click', () => {
        // 1) Reset spacing
        this.layerSpacing = 10;
        if (layerSpacingSlider) layerSpacingSlider.value = '10';
        this.updateLayerSpacing();

        // 2) Reset uniform scales & visibility
        for (const key in this.layerGroups) {
          this.layerGroups[key].scale.set(1, 1, 1);
          this.layerGroups[key].traverse(child => {
            child.visible = true;
          });
        }
        this.updateUniformScaleSliders();

        // 3) Reset the checkbox UI
        if (weightedChk) {
          weightedChk.checked = false;
        }

        // 4) Hide dummy connections
        this.toggleDummyConnections(false);
      });
    }

    // Weighted Connections checkbox
    if (weightedChk) {
      weightedChk.addEventListener('change', (e) => {
        this.toggleDummyConnections(e.target.checked);
      });
    }
  }
  
  /**
   * Updates the z-position for layer groups using the current layerSpacing.
   */
  updateLayerSpacing() {
    for (const key in this.layerGroups) {
      const layerIndex = this.zToIndexMap[key];
      this.layerGroups[key].position.z = this.layerSpacing * layerIndex;
    }
  }

  /**
   * Generate a fixed set of dummy MAC‑to‑MAC connections (by index)
   * and draw them as arches.
   * Replace the `dummyPairs` array later with real data.
   */
  generateDummyConnections() {
    // Example dummy pairs of indices into this.clickableMACs
    const dummyPairs = [
      [0, 5],
      [2, 3],
      [1, 4],
      [6, 7],
      [2, 8],
      [9, 3],
      [10, 11],
      [5, 12],
      [7, 0],
      [4, 9]
    ];

    // Clear any existing dummy meshes
    if (this._dummyMeshes) {
      this._dummyMeshes.forEach(m => {
        this.scene.remove(m);
        m.geometry.dispose();
        m.material.dispose();
      });
    }
    this._dummyMeshes = [];

    dummyPairs.forEach(([i, j]) => {
      const macA = this.clickableMACs[i];
      const macB = this.clickableMACs[j];
      if (!macA || !macB) return;

      // world positions
      const posA = new THREE.Vector3();
      const posB = new THREE.Vector3();
      macA.getWorldPosition(posA);
      macB.getWorldPosition(posB);

      // mid‑point arch
      const mid = posA.clone().lerp(posB, 0.5);
      mid.z += 5; // lift arch height

      // quadratic Bézier curve
      const curve = new THREE.QuadraticBezierCurve3(posA, mid, posB);

      // tube geometry
      const tubeGeo = new THREE.TubeGeometry(curve, 20, 0.1, 8, false);

      // dummy weight color (random for now)
      const weight = Math.random();
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(1 - weight, weight, 0),
        transparent: true,
        opacity: 0.7
      });

      const mesh = new THREE.Mesh(tubeGeo, mat);
      mesh.visible = false; // start hidden
      mesh.userData.isDummyConnection = true;
      this.scene.add(mesh);
      this._dummyMeshes.push(mesh);
    });
  }

  /**
   * Toggle visibility of all dummy connections.
   */
  toggleDummyConnections(show) {
    if (!this._dummyMeshes) return;
    this._dummyMeshes.forEach(m => m.visible = show);
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
    function disableRaycast(object) {
      object.raycast = () => {};
      if (object.children) {
        object.children.forEach(child => disableRaycast(child));
      }
    }
    if (macGroup.userData.isSelected) {
      if (macGroup.userData.innerOutline) {
        macGroup.remove(macGroup.userData.innerOutline);
        macGroup.userData.innerOutline = null;
      }
      macGroup.userData.isSelected = false;
      if (macGroup.userData.canvasWrapper) {
        macGroup.userData.canvasWrapper.style.display = 'none';
      }
      const idx = this.selectedMACs.indexOf(macGroup);
      if (idx !== -1) {
        this.selectedMACs.splice(idx, 1);
      }
    } else {
      if (!macGroup.userData.canvasWrapper) {
        macGroup.userData.canvasWrapper = this.createMACCanvas(macGroup);
      } else {
        macGroup.userData.canvasWrapper.style.display = 'block';
      }
      const innerOutlineGeometry = outlineLine.geometry.clone();
      const innerOutlineMaterial = new THREE.LineBasicMaterial({ color: 0x08FF08, linewidth: 1 });
      const innerOutline = new THREE.LineLoop(innerOutlineGeometry, innerOutlineMaterial);
      innerOutline.position.z = 0.01;
      disableRaycast(innerOutline);
      macGroup.add(innerOutline);
      macGroup.userData.innerOutline = innerOutline;
      macGroup.userData.isSelected = true;
      this.selectedMACs.push(macGroup);
    }
  
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
  
    const label = document.createElement('p');
    label.classList.add('mac-canvas-label');
    label.textContent = `MAC Layer ${macGroup.userData.layerIndex}`;
    containerDiv.appendChild(label);
  
    const topCanvas = document.createElement('canvas');
    topCanvas.width = 200;
    topCanvas.height = 200;
    topCanvas.classList.add('mac-top-canvas');
    containerDiv.appendChild(topCanvas);
  
    const barGraphLabel = document.createElement('p');
    barGraphLabel.classList.add('bar-graph-label');
    barGraphLabel.textContent = 'MAC Activation Probabilities:';
    containerDiv.appendChild(barGraphLabel);
  
    const barGraphScrollContainer = document.createElement('div');
    barGraphScrollContainer.classList.add('bar-graph-scroll-container');
    const barGraphCanvas = document.createElement('canvas');
    barGraphCanvas.width = 800;
    barGraphCanvas.height = 100;
    barGraphCanvas.classList.add('bar-graph-canvas');
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
    const topCamera = new THREE.OrthographicCamera(-viewSize * aspect, viewSize * aspect, viewSize, -viewSize, 0.1, 100);
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
      this.sharedTopRenderer.readRenderTargetPixels(renderTarget, 0, 0, canvas.width, canvas.height, pixelBuffer);
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
    console.log('🔍 updateProjectDropdown called, projects =', projects);
    console.log('🔍 this.projectSelect =', this.projectSelect);

    if (!this.projectSelect) {
      console.error('❌ projectSelect element not found!');
      return;
    }
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
    if (!Array.isArray(project_runs) || project_runs.length === 0) {
      console.log('No valid runs data to display');
      this.runSelect.innerHTML = '<option value="" disabled selected>No runs available</option>';
      this.runSelect.disabled = true;
      this.visualizeButton.disabled = true;
      return;
    }
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
}
