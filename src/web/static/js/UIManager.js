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

    // Arrays to track all neurons + the neuron connections
    this.allNeurons = [];
    this._dummyNeuronConnections = [];   // (Random mock connections)
    this._connectionRefCounts = new Map(); // Key: connection object, Value: reference count

    // Instantiate the visual factories.
    this.macFactory = new MacVisualFactory();
    this.cmFactory = new CmVisualFactory();
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
    // Remove old objects in the scene.
    while (this.scene.children.length > 0) {
      this.scene.remove(this.scene.children[0]);
    }

    this.clickableMACs = [];
    this.selectedMACs = [];
    this.layerGroups = {};
    this.inputGridGroup = null;
    this.allNeurons = [];  // Reset the neuron list
    this._dummyNeuronConnections = []; // Clear old connections
    this._connectionRefCounts = new Map(); // Clear reference counts

    const mac_spacing = 1.33;

    // Group elements by layer and compute centers
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

    // Build mapping for layer spacing
    const zToIndexMap = {};
    zToIndexMap[this.inputGridKey] = 0;
    const uniqueZValues = [...new Set(layers.map(el => el.z))].sort((a, b) => a - b);
    uniqueZValues.forEach((zVal, idx) => {
      zToIndexMap[zVal] = idx + 1;
    });
    this.zToIndexMap = zToIndexMap;

    // Build MAC composites
    layers.forEach(element => {
      if (element.type === 'mac') {
        const layerCenter = layerCenters[element.z];
        const layerIndex = zToIndexMap[element.z] || 0;
        const macGroup = this.macFactory.create(element, layerCenter, mac_spacing, layerIndex);

        // Create or add to layer group
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

    // Build CM objects
    layers.forEach(element => {
      if (element.type === 'cm') {
        const layerCenter = layerCenters[element.z];
        const obj = this.cmFactory.create(element, layerCenter, mac_spacing);
        obj.userData.layerIndex = zToIndexMap[element.z] || 0;

        // Attach to nearest MAC if available
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

    // Build Neuron objects
    layers.forEach(element => {
      if (element.type === 'neuron') {
        const layerCenter = layerCenters[element.z];
        console.log("Creating neuron:", element);
        const obj = this.neuronFactory.create(element, layerCenter, mac_spacing);
        console.log("Neuron created:", obj.userData);
        obj.userData.layerIndex = zToIndexMap[element.z] || 0;

        // Keep track of all neurons
        this.allNeurons.push(obj);

        // Attach to nearest MAC if available
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
          // Otherwise, add directly to the layer group
          this.layerGroups[thisZ].add(obj);
        }
      }
    });

    // Build input grid if provided
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

    // Update dynamic individual layer controls
    this.updateUniformScaleSliders();

    // Make sure controls are visible
    const uniformControls = document.getElementById('uniform-layer-scales');
    const fullModelControls = document.getElementById('full-model-controls-box');
    if (uniformControls) uniformControls.classList.remove('hidden');
    if (fullModelControls) fullModelControls.classList.remove('hidden');

    // Generate random *neuron* connections (instead of MAC->MAC)
    this.generateDummyNeuronConnections(200);

    // Initially refresh connection visibility (global + no MAC toggles yet)
    this.refreshConnectionVisibility();
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
          color: 0x000000,
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
   * Generate random neuron–neuron connections for demonstration.
   * If same layer => an arc (tube). Otherwise => a straight line.
   */
  generateDummyNeuronConnections(numConnections = 200) {
    // Clear existing connections
    if (this._dummyNeuronConnections) {
      this._dummyNeuronConnections.forEach(conn => {
        this.scene.remove(conn.mesh);
        conn.mesh.geometry.dispose();
        if (conn.mesh.material) conn.mesh.material.dispose();
      });
    }
    this._dummyNeuronConnections = [];
    this._connectionRefCounts = new Map(); // reset reference counts

    const n = this.allNeurons.length;
    if (n < 2) return;

    for (let i = 0; i < numConnections; i++) {
      // Pick a random pair of distinct neurons
      const idxA = Math.floor(Math.random() * n);
      const idxB = Math.floor(Math.random() * n);
      if (idxA === idxB) continue;

      const neuronA = this.allNeurons[idxA];
      const neuronB = this.allNeurons[idxB];
      const weight = Math.random(); // random weight for demonstration

      // Create the mesh (arc or line)
      const mesh = this.createNeuronConnectionMesh(neuronA, neuronB, weight);
      // Start hidden (we'll control visibility via refreshConnectionVisibility)
      mesh.visible = false;
      mesh.userData.isNeuronConnection = true;

      this.scene.add(mesh);
      const conn = { neuronA, neuronB, mesh, weight };
      this._dummyNeuronConnections.push(conn);

      // Initialize refCount to 0
      this._connectionRefCounts.set(conn, 0);
    }
  }

  /**
   * Creates either an arc (TubeGeometry) for same-layer or a line for cross-layer.
   * Also colors them by direction:
   *   - bottom-up (layerA < layerB) => blue
   *   - top-down  (layerA > layerB) => magenta
   *   - same layer => green
   */
  createNeuronConnectionMesh(neuronA, neuronB, weight) {
    const posA = new THREE.Vector3();
    const posB = new THREE.Vector3();
    neuronA.getWorldPosition(posA);
    neuronB.getWorldPosition(posB);

    const layerA = neuronA.userData.layerIndex;
    const layerB = neuronB.userData.layerIndex;

    let color;
    if (layerA < layerB) {
      // bottom-up
      color = new THREE.Color("#0000FF"); // Blue
    } else if (layerA > layerB) {
      // top-down
      color = new THREE.Color("#FF00FF"); // Magenta
    } else {
      // same layer => green
      color = new THREE.Color("#00FF00");
    }

    // If same layer => tube arc; otherwise => line
    if (layerA === layerB) {
      // replace the fixed lift with a dynamic one
      const mid = posA.clone().lerp(posB, 0.5);

      // compute how many layers apart this connection is
      const layerDiff = Math.abs(layerA - layerB);

      // if same layer, give it a small bump; otherwise base it on layerDiff
      const lift = layerDiff > 0
        ? layerDiff * this.layerSpacing * 0.5   // 50% of total layer separation
        : this.layerSpacing * 0.3;              // 30% bump when layerDiff === 0
      mid.z += lift;

      const curve = new THREE.QuadraticBezierCurve3(posA, mid, posB);
      const tubeGeo = new THREE.TubeGeometry(curve, 20, 0.03, 8, false);
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 });
      return new THREE.Mesh(tubeGeo, mat);
    } else {
      const points = [posA, posB];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ color });
      return new THREE.Line(geometry, material);
    }
  }

  /**
   * Recompute geometry for each neuron–neuron connection (arc or line)
   * in case neuron positions changed (due to scaling or spacing).
   */
  updateDummyNeuronConnections() {
    if (!this._dummyNeuronConnections) return;
    this._dummyNeuronConnections.forEach(conn => {
      const { neuronA, neuronB, mesh } = conn;
      const posA = new THREE.Vector3();
      const posB = new THREE.Vector3();
      neuronA.getWorldPosition(posA);
      neuronB.getWorldPosition(posB);

      // If it's a Mesh (Tube) => same-layer arc
      if (mesh.isMesh) {
        const mid = posA.clone().lerp(posB, 0.5);
        mid.z += 5;
        const curve = new THREE.QuadraticBezierCurve3(posA, mid, posB);
        const newGeo = new THREE.TubeGeometry(curve, 20, 0.03, 8, false);
        mesh.geometry.dispose();
        mesh.geometry = newGeo;

      } else if (mesh.isLine) {
        // If it's a Line => different-layer line
        const newPts = [posA, posB];
        const newGeo = new THREE.BufferGeometry().setFromPoints(newPts);
        mesh.geometry.dispose();
        mesh.geometry = newGeo;
      }
    });
  }

  /**
   * Single final source of truth:
   * Show connection if (global "Show All Weighted" is on) OR (refCount > 0).
   */
  refreshConnectionVisibility() {
    // Global "Show All Weighted" checkbox
    const weightedChk = document.getElementById('weightedConnectionsCheckbox');
    const globalShowAll = (weightedChk && weightedChk.checked);

    if (!this._dummyNeuronConnections) return;

    for (const conn of this._dummyNeuronConnections) {
      const refCount = this._connectionRefCounts.get(conn) || 0;
      // If global is on => always visible, else visible if refCount > 0
      conn.mesh.visible = globalShowAll || (refCount > 0);
    }
  }

  /**
   * Helper: find all neurons inside a particular MAC group.
   */
  getNeuronsInMAC(macGroup) {
    const neurons = [];
    macGroup.traverse(obj => {
      if (obj.userData && obj.userData.type === 'neuron') {
        neurons.push(obj);
      }
    });
    return neurons;
  }

  /**
   * Increment refCount for all connections belonging to neurons in this MAC.
   */
  incrementConnectionRefCountForMac(macGroup) {
    const macNeurons = this.getNeuronsInMAC(macGroup);
    for (const conn of this._dummyNeuronConnections) {
      const neuronA = conn.neuronA;
      const neuronB = conn.neuronB;
      if (macNeurons.includes(neuronA) || macNeurons.includes(neuronB)) {
        const current = this._connectionRefCounts.get(conn) || 0;
        this._connectionRefCounts.set(conn, current + 1);
      }
    }
  }

  /**
   * Decrement refCount for all connections belonging to neurons in this MAC.
   */
  decrementConnectionRefCountForMac(macGroup) {
    const macNeurons = this.getNeuronsInMAC(macGroup);
    for (const conn of this._dummyNeuronConnections) {
      const neuronA = conn.neuronA;
      const neuronB = conn.neuronB;
      if (macNeurons.includes(neuronA) || macNeurons.includes(neuronB)) {
        const current = this._connectionRefCounts.get(conn) || 0;
        const newVal = Math.max(current - 1, 0);
        this._connectionRefCounts.set(conn, newVal);
      }
    }
  }

  /**
 * Dynamically updates the "Individual Layer Controls" container.
 * Places each label to the left of its checkbox (MACs, CMs, Neurons).
 */
  updateUniformScaleSliders() {
    const scaleContainer = document.getElementById('uniform-layer-scales');
    if (!scaleContainer) return;

    // 1) Clear out any previous controls, leaving only the header
    while (scaleContainer.children.length > 1) {
      scaleContainer.removeChild(scaleContainer.lastElementChild);
    }

    // 2) Sort the layer keys: input first, then numeric layers in descending order
    const zKeys = Object.keys(this.layerGroups)
      .sort((a, b) => {
        if (a === this.inputGridKey) return -1;
        if (b === this.inputGridKey) return 1;
        return Number(a) - Number(b);
      })
      .reverse();

    // 3) Build a control block for each layer
    zKeys.forEach((key, index) => {
      // 3a) Determine a human‑readable name
      let labelName;
      if (key === this.inputGridKey) {
        labelName = '- Input Layer -';
      } else if (this.zToIndexMap && this.zToIndexMap[key] != null) {
        labelName = `- Layer ${this.zToIndexMap[key]} -`;
      } else {
        labelName = `- Layer Z=${key} -`;
      }

      // 3b) Create the container and subheading
      const layerContainer = document.createElement('div');
      layerContainer.className = 'layer-container';

      const subheading = document.createElement('h5');
      subheading.textContent = labelName;
      subheading.className = 'layer-subheading';
      layerContainer.appendChild(subheading);

      // 3c) Slider row
      const sliderRow = document.createElement('div');
      sliderRow.className = 'slider-row';

      const scalingLabel = document.createElement('label');
      scalingLabel.textContent = 'Scale:  ';
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
        this.updateDummyNeuronConnections();
        this.refreshConnectionVisibility();
      });
      sliderRow.appendChild(slider);

      const resetBtn = document.createElement('button');
      resetBtn.textContent = 'Reset';
      resetBtn.className = 'slider-reset-btn';
      resetBtn.addEventListener('click', () => {
        slider.value = '1.0';
        this.layerGroups[key].scale.set(1, 1, 1);
        this.updateDummyNeuronConnections();
        this.refreshConnectionVisibility();
      });
      sliderRow.appendChild(resetBtn);

      layerContainer.appendChild(sliderRow);

      // 3d) Toggles for MACs, CMs, Neurons (skip input layer)
      if (key !== this.inputGridKey) {
        const toggleRow = document.createElement('div');
        toggleRow.className = 'toggle-row';

        // Header
        const prefix = document.createElement('span');
        prefix.textContent = 'Show:';
        prefix.className = 'toggle-prefix';
        toggleRow.appendChild(prefix);

        // -- MACs --
        const macLabel = document.createElement('label');
        macLabel.htmlFor = `toggle-mac-${key}`;
        macLabel.textContent = 'MACs';
        toggleRow.appendChild(macLabel);

        const macCheckbox = document.createElement('input');
        macCheckbox.type = 'checkbox';
        macCheckbox.id = `toggle-mac-${key}`;
        macCheckbox.checked = true;
        toggleRow.appendChild(macCheckbox);

        // -- CMs --
        const cmLabel = document.createElement('label');
        cmLabel.htmlFor = `toggle-cm-${key}`;
        cmLabel.textContent = 'CMs';
        toggleRow.appendChild(cmLabel);

        const cmCheckbox = document.createElement('input');
        cmCheckbox.type = 'checkbox';
        cmCheckbox.id = `toggle-cm-${key}`;
        cmCheckbox.checked = true;
        toggleRow.appendChild(cmCheckbox);

        // -- Neurons --
        const neuronLabel = document.createElement('label');
        neuronLabel.htmlFor = `toggle-neuron-${key}`;
        neuronLabel.textContent = 'Neurons';
        toggleRow.appendChild(neuronLabel);

        const neuronCheckbox = document.createElement('input');
        neuronCheckbox.type = 'checkbox';
        neuronCheckbox.id = `toggle-neuron-${key}`;
        neuronCheckbox.checked = true;
        toggleRow.appendChild(neuronCheckbox);

        // 3e) Event listeners (exactly your original logic)
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
                  if (idx > -1) this.clickableMACs.splice(idx, 1);
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

        layerContainer.appendChild(toggleRow);
      }

      // Insert a divider _above_ every layer
      const divider = document.createElement('hr');
      divider.className = 'slider-divider';
      scaleContainer.appendChild(divider);

      // Now append the layer’s controls
      scaleContainer.appendChild(layerContainer);
    });
  }

  /**
   * Attaches event listeners to the static Full Model Controls.
   */
  initializeFullModelControls() {
    const layerSpacingSlider = document.getElementById('layerSpacingSlider');
    const resetSpacingBtn = document.getElementById('resetSpacingBtn');
    const resetModelBtn = document.getElementById('resetModelBtn');
    const weightedChk = document.getElementById('weightedConnectionsCheckbox');

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
    // Inside initializeFullModelControls() or wherever resetModelBtn is defined:
    if (resetModelBtn) {
      resetModelBtn.addEventListener('click', () => {
        // 1) Reset spacing
        this.layerSpacing = 10;
        if (layerSpacingSlider) layerSpacingSlider.value = '10';
        this.updateLayerSpacing();

        // 2) Reset uniform scales & forcibly set all children visible
        //    Also re-add MACs to this.clickableMACs (so we can click them again)
        this.clickableMACs = []; // Clear the old array
        for (const key in this.layerGroups) {
          // Reset scale
          this.layerGroups[key].scale.set(1, 1, 1);

          // Traverse, show everything, and re-add any MACs
          this.layerGroups[key].traverse(child => {
            child.visible = true;
            if (child.userData && child.userData.type === 'mac') {
              // Re-add to clickableMACs if not present
              if (!this.clickableMACs.includes(child)) {
                this.clickableMACs.push(child);
              }
            }
          });
        }

        // 2.5) Reset the slider UI positions
        const uniformControls = document.getElementById('uniform-layer-scales');
        if (uniformControls) {
          uniformControls
            .querySelectorAll('input.layer-slider')
            .forEach(slider => { slider.value = '1.0'; });
        }

        // 3) Re-check the layer toggles in the UI so the user sees that MACs are visible
        if (uniformControls) {
          // For each layer's MAC/CM/Neuron checkbox, set them to true
          const macCheckboxes = uniformControls.querySelectorAll('input[id^="toggle-mac-"]');
          macCheckboxes.forEach(cb => { cb.checked = true; });

          const cmCheckboxes = uniformControls.querySelectorAll('input[id^="toggle-cm-"]');
          cmCheckboxes.forEach(cb => { cb.checked = true; });

          const neuronCheckboxes = uniformControls.querySelectorAll('input[id^="toggle-neuron-"]');
          neuronCheckboxes.forEach(cb => { cb.checked = true; });
        }

        // 4) Reset Weighted Connections checkbox
        if (weightedChk) {
          weightedChk.checked = false;
        }

        // 5) Recompute connections so geometry matches the new scale/position
        this.updateDummyNeuronConnections();

        // 6) Refresh final visibility
        this.refreshConnectionVisibility();
      });
    }


    // Weighted Connections checkbox
    if (weightedChk) {
      weightedChk.addEventListener('change', () => {
        // Just re-check the final rule:
        this.refreshConnectionVisibility();
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

    // Recompute arcs/lines
    this.updateDummyNeuronConnections();
    // Then apply final visibility logic
    this.refreshConnectionVisibility();
  }

  // ---------- MAC Click Handling -----------------

  onSceneClick(event) {
    const rect = this.sceneManager.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.sceneManager.camera);

    // Intersect only with clickable MACs
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

    function disableRaycast(obj) {
      obj.raycast = () => { };
      if (obj.children) {
        obj.children.forEach(child => disableRaycast(child));
      }
    }

    // If it's already selected, we're toggling it OFF
    if (macGroup.userData.isSelected) {
      // Remove green "innerOutline" overlay
      if (macGroup.userData.innerOutline) {
        macGroup.remove(macGroup.userData.innerOutline);
        macGroup.userData.innerOutline = null;
      }
      macGroup.userData.isSelected = false;

      // Remove the entire section (divider + canvas) when untoggling
      if (macGroup.userData.canvasSection) {
        macGroup.userData.canvasSection.remove();
        macGroup.userData.canvasSection = null;
        macGroup.userData.canvasWrapper = null;
      }

      // Remove from selectedMACs array
      const idx = this.selectedMACs.indexOf(macGroup);
      if (idx !== -1) {
        this.selectedMACs.splice(idx, 1);
      }

      // **Revert outline to its original color** (instead of black)
      if (outlineLine && outlineLine.userData && outlineLine.userData.originalOutlineColor != null) {
        outlineLine.material.color.set(outlineLine.userData.originalOutlineColor);
      }

      // Decrement connection refCounts for neurons in this MAC
      this.decrementConnectionRefCountForMac(macGroup);
      this.refreshConnectionVisibility();

    } else {
      // Toggling MAC ON
      if (!macGroup.userData.canvasWrapper) {
        macGroup.userData.canvasWrapper = this.createMACCanvas(macGroup);
      } else {
        macGroup.userData.canvasWrapper.style.display = 'block';
      }

      // Create green "innerOutline" overlay
      const innerOutlineGeometry = outlineLine.geometry.clone();
      const innerOutlineMaterial = new THREE.LineBasicMaterial({ color: 0x08FF08, linewidth: 1 });
      const innerOutline = new THREE.LineLoop(innerOutlineGeometry, innerOutlineMaterial);
      innerOutline.position.z = 0.01;
      disableRaycast(innerOutline);
      macGroup.add(innerOutline);
      macGroup.userData.innerOutline = innerOutline;

      // Mark as selected
      macGroup.userData.isSelected = true;
      this.selectedMACs.push(macGroup);

      // Increment connection refCounts for neurons in this MAC
      this.incrementConnectionRefCountForMac(macGroup);
      this.refreshConnectionVisibility();
    }

    // Update MAC details display
    const layerIndex = macGroup.userData.layerIndex;
    const detailsDiv = document.getElementById('mac-details');
    if (detailsDiv) {
      detailsDiv.innerHTML = `<p><strong>Layer:</strong> ${layerIndex}</p>`;
    }
  }

  resetToggledMACs() {
    // Turn off all selected MACs
    this.selectedMACs.forEach(macGroup => {
      if (macGroup.userData.isSelected) {
        macGroup.userData.isSelected = false;

        // Remove the green "innerOutline" highlight
        if (macGroup.userData.innerOutline) {
          macGroup.remove(macGroup.userData.innerOutline);
          macGroup.userData.innerOutline = null;
        }

        // Revert the MAC's base outline to its original color (red or blue)
        const outlineLine = macGroup.userData.outlineLine;
        if (outlineLine && outlineLine.userData && outlineLine.userData.originalOutlineColor) {
          outlineLine.material.color.set(outlineLine.userData.originalOutlineColor);
        }
      }
    });

    // Clear the selectedMACs array
    this.selectedMACs = [];

    // Clear MAC details
    const detailsDiv = document.getElementById("mac-details");
    if (detailsDiv) {
      detailsDiv.innerHTML = `<p><strong>Layer:</strong></p>`;
    }
    this.clearSidePanel();

    // Remove references to the canvas
    this.clickableMACs.forEach(macGroup => {
      macGroup.userData.canvasWrapper = null;
    });

    // Also reset all connection refcounts to 0
    for (const conn of this._dummyNeuronConnections) {
      this._connectionRefCounts.set(conn, 0);
    }

    // Then finalize visibility
    this.refreshConnectionVisibility();
  }

  // ---------- MAC Canvas/Bar Graph stuff (unchanged) -----------------

  createMACCanvas(macGroup) {
    const containerDiv = document.createElement('div');
    containerDiv.classList.add('mac-canvas-wrapper');

    const label = document.createElement('p');
    label.classList.add('mac-canvas-label');
    label.textContent = `- MAC Layer ${macGroup.userData.layerIndex} -`;
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

    // 1) Create a single “section” wrapper
    const section = document.createElement('div');
    section.className = 'mac-section';

    // 2) If there’s already content, append the <hr> into *this* section
    if (sidePanel.children.length > 0) {
      const divider = document.createElement('hr');
      divider.className = 'slider-divider';
      section.appendChild(divider);
    }

    // 3) Move your existing containerDiv into that same section
    section.appendChild(containerDiv);

    // 4) Now append *only* the section
    sidePanel.appendChild(section);

    // 5) Remember the section (for removal later) and the wrapper
    macGroup.userData.canvasSection = section;
    macGroup.userData.canvasWrapper = containerDiv;

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
    compositeClone.scale.set(1.5, 1.5, 1.5);
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
    // Dummy bar graph
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
      if (child.isLine && child.material && child.material.color &&
        child.userData && child.userData.type === 'mac_outline') {
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
    if (!this.runSelect) {
      console.error('Run select element not found!');
      return;
    }
    this.runSelect.innerHTML = '<option value="" disabled selected>Select a run</option>';
    if (!Array.isArray(project_runs) || project_runs.length === 0) {
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
    this.macDetailsMsg.textContent =
      `MAC ID: ${macData.id}
       Layer: ${macData.layer}
       Position: (${macData.position.x.toFixed(4)},
                   ${macData.position.y.toFixed(4)},
                   ${macData.position.z.toFixed(4)})`;
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
