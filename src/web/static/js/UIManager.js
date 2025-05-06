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
    this.projectSelect       = document.getElementById('projectSelect');
    this.runSelect           = document.getElementById('runSelect');
    this.visualizeButton     = document.getElementById('visualizeButton');
    this.macDetailsContainer = document.getElementById('mac-details-container');
    this.macDetailsMsg       = document.getElementById('mac-details-msg');
    this.resetButton         = document.getElementById('resetButton');
    this.sidePanelContainer  = document.getElementById('side-panel');
    this.bottomPanelContainer= document.getElementById('bottom-panel');

    // Group objects for each layer.
    this.layerGroups = {};
    this.inputGridKey = 'input';
    this.inputGridGroup = null;
    this.layerSpacing = 10;

    this.clickableMACs = [];
    this.selectedMACs = [];
    this.macProbs = {}; 

    // Arrays to track all neurons + the neuron connections
    this.allNeurons = [];
    this._neuronConnections = [];
    this._connectionRefCounts = new Map(); // Key: connection object, Value: reference count

    // Instantiate the visual factories.
    this.macFactory    = new MacVisualFactory();
    this.cmFactory     = new CmVisualFactory();
    this.neuronFactory = new NeuronVisualFactory();

    // Subscribe to events.
    eventBus.subscribe('sceneClicked', (event) => this.onSceneClick(event));
    eventBus.subscribe('resetMACs',   () => this.resetToggledMACs());

    // Initialize static Full Model Controls.
    this.initializeFullModelControls();
  }

  // ── NEW ── Remove-and-reset logic pulled into helpers ──────────────
  clearScene() {
    while (this.scene.children.length > 0) {
      this.scene.remove(this.scene.children[0]);
    }
  }

  resetState() {
    this.clickableMACs            = [];
    this.selectedMACs             = [];
    this.layerGroups              = {};
    this.inputGridGroup           = null;
    this.allNeurons               = [];
    this._NeuronConnections       = [];
    this._connectionRefCounts     = new Map();
    this.macMap                   = {};
    this.cmMap                    = {};
    this.neuronMap                = {};
  }
  
  buildFromLayers(layers, inputDims = null, inputActivations = null) {
    // 1) Clear out the old scene
    this.clearScene();
  
    // 2) Reset all our tracking arrays/maps
    this.resetState();
  
    // 3) Store inputDims so updateInputGrid can reuse them later
    this.inputDimensions = inputDims;
  
    // ── First pass: assign global MAC index, per-MAC CM index (1-based), per-CM neuron index (1-based)
    let macCounter    = 0;
    let cmCounter     = 0;
    let neuronCounter = 0;
    layers.forEach(el => {
      if (el.type === 'mac') {
        macCounter++;
        el.globalMacIndex = macCounter;
        cmCounter = 0;
      } else if (el.type === 'cm') {
        cmCounter++;
        el.cmIndex        = cmCounter;
        el.globalMacIndex = macCounter;
        neuronCounter = 0;
      } else if (el.type === 'neuron') {
        neuronCounter++;
        el.neuronIndex    = neuronCounter;
        el.globalMacIndex = macCounter;
        el.cmIndex        = cmCounter;
      }
    });
  
    // 4) Group elements by layer and compute centroids
    const layerGroupsObj = {};
    layers.forEach(el => {
      layerGroupsObj[el.z] ||= [];
      layerGroupsObj[el.z].push(el);
    });
    const layerCenters = {};
    Object.entries(layerGroupsObj).forEach(([z, elems]) => {
      let sumX = 0, sumY = 0;
      elems.forEach(e => { sumX += e.x; sumY += e.y; });
      layerCenters[z] = { x: sumX / elems.length, y: sumY / elems.length };
    });
  
    // 5) Map z-values to layer indices
    const zToIndexMap = {};
    zToIndexMap[this.inputGridKey] = 0;
    const uniqueZ = [...new Set(layers.map(el => el.z))].sort((a, b) => a - b);
    uniqueZ.forEach((zVal, idx) => { zToIndexMap[zVal] = idx + 1; });
    this.zToIndexMap = zToIndexMap;
  
    // 6) Sort MACs by global index so we can renumber per-layer
    const mac_spacing = 1.33;
    const macSortedByLayer = {};
    uniqueZ.forEach(zVal => {
      macSortedByLayer[zVal] = layerGroupsObj[zVal]
        .filter(el => el.type === 'mac')
        .sort((a, b) => a.globalMacIndex - b.globalMacIndex);
    });
  
    // 7) Build MAC groups & assign per-layer MAC indices (moved into helper)
    this._buildMACMeshes(macSortedByLayer, layerCenters, zToIndexMap);
  
    // 8) Build lookup from (layerKey|globalMacIndex) → localMacIndex
    const globalToLocal = {};
    Object.entries(this.macMap).forEach(([layerKey, macs]) => {
      Object.entries(macs).forEach(([localIdx, macGroup]) => {
        const g = macGroup.userData.globalMacIndex;
        globalToLocal[`${layerKey}|${g}`] = Number(localIdx);
      });
    });
  
    // 9) Build & index CMs (per-MAC, 1-based)
    this._buildCMMeshes(layers, layerCenters, zToIndexMap, globalToLocal);
  
    // 10) Build & index Neurons (per-CM, 1-based)
    this._buildNeuronMeshes(layers, layerCenters, zToIndexMap, globalToLocal);

    // ── NEW ── Count how many MACs per layer for bar-graph zero-filling
    this.macCounts = {};
    Object.entries(this.macMap).forEach(([layerKey, macs]) => {
      this.macCounts[layerKey] = Object.keys(macs).length;
    });
  
    // 11) Build input grid if requested (unchanged)
    this._buildInputGrid(inputDims, inputActivations);
  
    // 12) Restore UI controls and connections (unchanged)
    this._finalizeScene();
  }
  
  /**
   * @private
   * Builds all MAC groups, assigns macIndex, wires them into scene & maps.
   */
  _buildMACMeshes(macSortedByLayer, layerCenters, zToIndexMap) {
    const mac_spacing = 1.33;

    Object.entries(macSortedByLayer).forEach(([zVal, macList]) => {
      const center   = layerCenters[zVal];
      const layerIdx = zToIndexMap[zVal] || 0;
      const layerKey = `layer_${layerIdx}`;
      this.macMap[layerKey] = {};

      macList.forEach((el, idx) => {
        const macNumber = idx + 1;
        el.macIndex = macNumber;

        // create with factory
        const enhanced = { ...el, macIndex: macNumber };
        const macGroup = this.macFactory.create(enhanced, center, mac_spacing, layerIdx);

        // userData
        Object.assign(macGroup.userData, {
          type:           'mac',
          layerKey,
          macIndex:       macNumber,
          layerIndex:     layerIdx,
          globalMacIndex: el.globalMacIndex
        });

        // ensure group exists
        if (!this.layerGroups[zVal]) {
          const grp = new THREE.Group();
          grp.position.set(0, 0, this.layerSpacing * layerIdx);
          this.layerGroups[zVal] = grp;
          this.sceneManager.add(grp);
        }

        // add to scene & maps
        this.layerGroups[zVal].add(macGroup);
        this.clickableMACs.push(macGroup);
        this.macMap[layerKey][macNumber] = macGroup;
      });
    });
  }

  /**
   * @private
   * Builds all CMs, wires them into their parent MACs or layer groups,
   * and populates this.cmMap.
   */
  _buildCMMeshes(layers, layerCenters, zToIndexMap, globalToLocal) {
    const mac_spacing = 1.33;

    layers.forEach(el => {
      if (el.type !== 'cm') return;

      const layerIdx  = zToIndexMap[el.z] || 0;
      const layerKey  = `layer_${layerIdx}`;
      const mappedMac = globalToLocal[`${layerKey}|${el.globalMacIndex}`];
      const cmIndex   = el.cmIndex;

      // create CM mesh
      const cmMesh = this.cmFactory.create(el, layerCenters[el.z], mac_spacing);
      Object.assign(cmMesh.userData, {
        type:     'cm',
        layerKey,
        macIndex: mappedMac,
        cmIndex
      });

      // ensure map structure
      this.cmMap[layerKey]            ||= {};
      this.cmMap[layerKey][mappedMac] ||= {};
      this.cmMap[layerKey][mappedMac][cmIndex] = cmMesh;

      // attach to scene
      const parentMac = this.macMap[layerKey]?.[mappedMac];
      if (parentMac) {
        // position relative to its MAC
        cmMesh.position.sub(parentMac.position);
        parentMac.add(cmMesh);
      } else {
        // fallback: add directly to layer group
        this.layerGroups[el.z].add(cmMesh);
      }
    });
  }

  /**
   * @private
   * Builds all neurons, wires them into their parent CMs or layer groups,
   * and populates this.neuronMap & this.allNeurons.
   */
  _buildNeuronMeshes(layers, layerCenters, zToIndexMap, globalToLocal) {
    const mac_spacing = 1.33;

    layers.forEach(el => {
      if (el.type !== 'neuron') return;

      const layerIdx    = zToIndexMap[el.z] || 0;
      const layerKey    = `layer_${layerIdx}`;
      const mappedMac   = globalToLocal[`${layerKey}|${el.globalMacIndex}`];
      const cmIndex     = el.cmIndex;
      const neuronIndex = el.neuronIndex;

      // find CM center for positioning
      const cmData = layers.find(l =>
        l.type === 'cm' &&
        l.z === el.z &&
        l.globalMacIndex === el.globalMacIndex &&
        l.cmIndex === cmIndex
      );
      const cmCenter = { x: cmData.x, y: cmData.y };

      // create neuron mesh
      const neuronMesh = this.neuronFactory.create(el, cmCenter, mac_spacing);
      Object.assign(neuronMesh.userData, {
        type:        'neuron',
        layerKey,
        macIndex:    mappedMac,
        cmIndex,
        neuronIndex
      });

      // track it
      this.allNeurons.push(neuronMesh);
      this.neuronMap[layerKey] ||= {};
      this.neuronMap[layerKey][mappedMac] ||= {};
      this.neuronMap[layerKey][mappedMac][cmIndex] ||= {};
      this.neuronMap[layerKey][mappedMac][cmIndex][neuronIndex] = neuronMesh;

      // attach to its CM (or fallback)
      const parentCm = this.cmMap[layerKey]?.[mappedMac]?.[cmIndex];
      if (parentCm) {
        parentCm.add(neuronMesh);
      } else {
        this.layerGroups[el.z].add(neuronMesh);
      }
    });
  }

  /**
   * @private
   * Builds the input‐pixel grid if dimensions are given,
   * and attaches it at the correct z‐layer.
   */
  _buildInputGrid(inputDims, inputActivations) {
    if (!inputDims?.width || !inputDims?.height) return;

    // create grid
    this.createInputGrid(inputDims.width, inputDims.height, inputActivations);

    // ensure layer group exists
    const layerIdx  = this.zToIndexMap[this.inputGridKey];
    if (!this.layerGroups[this.inputGridKey]) {
      const inputGrp = new THREE.Group();
      inputGrp.position.set(0, 0, this.layerSpacing * layerIdx);
      this.layerGroups[this.inputGridKey] = inputGrp;
      this.sceneManager.add(inputGrp);
    }

    // attach grid
    this.layerGroups[this.inputGridKey].add(this.inputGridGroup);
  }

  /**
   * @private
   * Re-enables sliders, panels, builds initial connections, and
   * toggles visibility so the UI is back in its interactive state.
   */
  _finalizeScene() {
    this.updateUniformScaleSliders();
    document.getElementById('uniform-layer-scales')?.classList.remove('hidden');
    document.getElementById('full-model-controls-box')?.classList.remove('hidden');
    this.buildWeightedConnectionsForStep(0);
    this.refreshConnectionVisibility();
  }

  /**
   * Creates the input grid.
   */
  createInputGrid(cols, rows, activations = {}) {
    this.inputGridMap   = {};               // ← NEW: map pixelIndex → cell group
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
        // ← NEW:
        cellGroup.userData.type = 'input';
        cellGroup.position.set(
          x - ((cols - 1) * macSpacing) / 2,
          y - ((rows - 1) * Math.sqrt(3) * hexSize) / 2,
          zOffset
        );
        this.inputGridGroup.add(cellGroup);
        this.inputGridMap[ macIndex - 1 ] = cellGroup;
      }
    }
  }

    /**
   * Replace the existing input‐grid with a new one built from `activations`.
   * @param {{[pixelIndex: number]: 0|1}} activations
   */
  updateInputGrid(activations = {}) {
    // Remove the old grid
    if (this.inputGridGroup && this.layerGroups[this.inputGridKey]) {
      this.layerGroups[this.inputGridKey].remove(this.inputGridGroup);
      // (optional) dispose geometries/materials here
    }
    // Recreate it using stored dimensions
    const { width, height } = this.inputDimensions || {};
    if (width && height) {
      this.createInputGrid(width, height, activations);
      this.layerGroups[this.inputGridKey].add(this.inputGridGroup);
    } else {
      console.error("No inputDimensions saved on UIManager");
    }
  }

  updateMacActivations(macActs = {}) {
    // clickableMACs is your array of MAC groups
    this.clickableMACs.forEach(macGroup => {
      // unpack exactly what you stored in buildFromLayers
      const { layerKey, macIndex, fillMesh, outlineLine } = macGroup.userData;
    
      // new, correct zero-based lookup:
      const rawVal = macActs[layerKey]?.[macIndex - 1] ?? 0;
      const isActive = rawVal > 0;
  
      // 4) apply your usual coloring
      fillMesh.material.color.set(
        isActive
          ? fillMesh.userData.activeFillColor
          : fillMesh.userData.inactiveFillColor
      );
      outlineLine.material.color.set(
        isActive
          ? outlineLine.userData.activeOutlineColor
          : outlineLine.userData.inactiveOutlineColor
      );
    });
  }

  /**
   * Creates either an arc (TubeGeometry) for same-layer or a line for cross-layer.
   * Also colors them by direction:
   *   - bottom-up (layerA < layerB) => blue
   *   - top-down  (layerA > layerB) => magenta
   *   - same layer => green
   */
    /**
   * Creates either an arc (TubeGeometry) for same-layer
   * or a straight Line for cross-layer, colored by direction.
   */
  createNeuronConnectionMesh(neuronA, neuronB, weight) {
    // 1) grab world positions
    const posA = new THREE.Vector3();
    const posB = new THREE.Vector3();
    neuronA.getWorldPosition(posA);
    neuronB.getWorldPosition(posB);

    // 2) determine same-layer by Z coordinate
    const dz = posB.z - posA.z;
    const sameLayer = Math.abs(dz) < 1e-6;

    // 3) pick color
    let color;
    if (sameLayer) {
      color = new THREE.Color(0x00ff00);       // green
    } else if (dz > 0) {
      color = new THREE.Color(0x0000ff);       // blue (bottom→up)
    } else {
      color = new THREE.Color(0xff00ff);       // magenta (top→down)
    }

    // 4) build mesh
    let mesh;
    if (sameLayer) {
      // arc rising in Y so it bulges up on-screen
      const mid = posA.clone().lerp(posB, 0.5);
      mid.y += 5;  // tweak this “height” as you like
      const curve = new THREE.QuadraticBezierCurve3(posA, mid, posB);
      const geo   = new THREE.TubeGeometry(curve, 20, 0.03, 8, false);
      const mat   = new THREE.MeshBasicMaterial({ color });
      mesh = new THREE.Mesh(geo, mat);
    } else {
      // straight line for cross-layer
      const pts = [ posA, posB ];
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color });
      mesh = new THREE.Line(geo, mat);
    }

    // 5) disable raycasting so it doesn’t intercept clicks
    mesh.raycast = () => {};

    return mesh;
  }


  /**
   * Recompute geometry for each neuron–neuron connection (arc or line)
   * in case neuron positions changed (due to scaling or spacing).
   */
  updateWeightedConnections() {
    if (!this._neuronConnections) return;
    this._neuronConnections.forEach(conn => {
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

    if (!this._neuronConnections) return;

    for (const conn of this._neuronConnections) {
      const refCount = this._connectionRefCounts.get(conn) || 0;
      // If global is on => always visible, else visible if refCount > 0
      conn.mesh.visible = globalShowAll || (refCount > 0);
    }
  }

   /**
   * Build neuron–neuron connections for a given simulation step
   * using the cached weight JSON (0-based) and the existing
   * createNeuronConnectionMesh() routine.
   */
  buildWeightedConnectionsForStep(step) {
    
    // 1) Clear any existing connections
    if (this._neuronConnections) {
      this._neuronConnections.forEach(conn => {
        this.scene.remove(conn.mesh);
        conn.mesh.geometry.dispose();
        if (conn.mesh.material) conn.mesh.material.dispose();
      });
    }
    this._neuronConnections = [];
    this._connectionRefCounts    = new Map();

    // 2) Grab the weights for this step
    let weightsForStep = window._sparsey_weightConnections;
    // If the JSON is keyed by step, drill down:
    if (weightsForStep[step] !== undefined) {
      weightsForStep = weightsForStep[step];
    }
    if (!weightsForStep || typeof weightsForStep !== 'object') {
      console.warn(`No weighted connections for step ${step}`);
      return;
    }

    // 3) Iterate through layer→mac→cm→neuron structure
    Object.entries(weightsForStep).forEach(([layerKey, macs]) => {
      Object.entries(macs).forEach(([macKey, cms]) => {
        Object.entries(cms).forEach(([cmKey, neurons]) => {
          Object.entries(neurons).forEach(([neuronKey, data]) => {
            // Destination Three.js neuron object (1-based in UIManager)
            const macNum    = parseInt(macKey.split('_')[1], 10) + 1;
            const cmNum     = parseInt(cmKey.split('_')[1], 10) + 1;
            const neuronNum = parseInt(neuronKey.split('_')[1], 10) + 1;
            const dest = this.neuronMap[layerKey]?.[macNum]?.[cmNum]?.[neuronNum];
            if (!dest) {
              console.warn(` [Debug] Missing DEST for ${layerKey}.${macKey}.${cmKey}.${neuronKey}`, { layerKey, macNum, cmNum, neuronNum });
              return;
            }

            // 4) For each source connection
            data.sources.forEach((src, idx) => {
              const w = src.weight;
              if (!w) return;  // skip zero weights

              // Find source object in the **previous** layer (or input grid)
              let sourceObj = null;
              const coords = src.sparsey_coords;
              // compute the previous layer key
              const thisLayerIdx = parseInt(layerKey.split('_')[1], 10);
              const prevLayerIdx = thisLayerIdx - 1;
              const prevLayerKey = prevLayerIdx === 0 ? 'layer_1' : `layer_${prevLayerIdx}`;

              if (coords.length === 1) {
                // single‐element sources:
                if (prevLayerIdx === 0) {
                  // from input pixel
                  sourceObj = this.inputGridMap[ coords[0] ];
                } else {
                  // from an entire MAC of the previous layer
                  const macNum = coords[0] + 1;
                  sourceObj = this.macMap[ prevLayerKey ]?.[ macNum ];
                }
              } else if (coords.length === 3) {
                // neuron‐to‐neuron: [macIdx, cmIdx, neuronIdx]
                const [srcMacIdx, srcCmIdx, srcNeuronIdx] = coords;
                sourceObj = this.neuronMap[ prevLayerKey ]
                                 ?. [ srcMacIdx + 1 ]
                                 ?. [ srcCmIdx  + 1 ]
                                 ?. [ srcNeuronIdx + 1 ];
              }

              if (!sourceObj) {
                console.warn(` [Debug] Missing SOURCE for srcCoords=${coords} → dest ${layerKey}.${macKey}.${cmKey}.${neuronKey}`);
                return;
              }

              // 5) Create the Three.js mesh (arc/line)
              const mesh = this.createNeuronConnectionMesh(sourceObj, dest, w);
              mesh.visible = false;
              mesh.userData.isNeuronConnection = true;
              this.scene.add(mesh);

              // 6) Track it for toggles & "Show All"
              const conn = { neuronA: sourceObj, neuronB: dest, mesh, weight: w };
              this._neuronConnections.push(conn);
              this._connectionRefCounts.set(conn, 0);
            });
          });
        });
      });
    });
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
    for (const conn of this._neuronConnections) {
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
    for (const conn of this._neuronConnections) {
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
   * @param {{[layerKey: string]: {[macKey: string]: {[cmKey: string]: number[]}}}} macProbs
   */
  updateMacProbabilities(macProbs) {
    this.macProbs = macProbs;

    this.selectedMACs.forEach(macGroup => {
      const { layerKey, macIndex } = macGroup.userData;                // macIndex is 1-based
      const cmMap = macProbs[layerKey]?.[`mac_${macIndex}`] || {};
      const container = macGroup.userData.cmChartsContainer;

      // 1) clear out old CM‐charts
      container.innerHTML = '';

      // 2) subheader under the MAC canvas
      const subhdr = document.createElement('div');
      subhdr.classList.add('cm-charts-subheader');
      subhdr.textContent = 'Neuron Activation Probabilities / CM';
      container.appendChild(subhdr);

      // 3) one mini‐chart per CM
      Object.entries(cmMap).forEach(([cmKey, neuronProbs]) => {
        const cmNum = parseInt(cmKey.split('_')[1], 10);

        const cmDiv = document.createElement('div');
        cmDiv.classList.add('cm-chart-container');

        // small CM label
        const lbl = document.createElement('div');
        lbl.classList.add('cm-small-label');
        lbl.textContent = `CM ${cmNum}`;
        cmDiv.appendChild(lbl);

        // the bar‐graph canvas
        const c = document.createElement('canvas');
        c.width  = 100;
        c.height = 80;
        c.classList.add('bar-graph-canvas');
        cmDiv.appendChild(c);

        // draw the bars
        const ctx = c.getContext('2d');
        ctx.clearRect(0, 0, c.width, c.height);
        const maxH = c.height - 20;
        const gap  = 4;
        const barW = (c.width - gap * (neuronProbs.length + 1)) / neuronProbs.length;

        neuronProbs.forEach((p, i) => {
          const h = p * maxH;
          const x = gap + i * (barW + gap);
          const y = c.height - h - 10;

          ctx.fillStyle   = '#007bff';
          ctx.fillRect(x, y, barW, h);
          ctx.strokeRect(x, y, barW, h);

          // neuron index
          ctx.fillStyle = '#000';
          ctx.font      = '10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(i + 1, x + barW / 2, c.height - 2);
        });

        container.appendChild(cmDiv);
      });
    });
  }

  /**
   * Dynamically updates the “Individual Layer Controls” container.
   * (identical logic, slimmer code)
   */
  updateUniformScaleSliders() {
    const scaleContainer = document.getElementById('uniform-layer-scales');
    if (!scaleContainer) return;

    // ── Helpers ──────────────────────────────────────────────────────────
    const $ = (tag, props = {}, ...kids) => {
      const el = document.createElement(tag);
      Object.assign(el, props);
      kids.forEach(k => el.appendChild(k));
      return el;
    };
    const applyScale = (key, v) => {
      this.layerGroups[key].scale.set(v, v, v);
      this.updateWeightedConnections();
      this.refreshConnectionVisibility();
    };

    // ── 1) Keep the header, clear everything else ────────────────────────
    while (scaleContainer.children.length > 1) scaleContainer.lastElementChild.remove();

    // ── 2) Sorted layer keys: input first, then numeric (desc) ───────────
    const zKeys = Object
      .keys(this.layerGroups)
      .sort((a, b) => (a === this.inputGridKey) - (b === this.inputGridKey) || Number(b) - Number(a));

    // ── 3) Build controls per layer ──────────────────────────────────────
    zKeys.forEach(key => {
      const isInput = key === this.inputGridKey;
      const niceName = isInput
        ? '- Input Layer -'
        : `- Layer ${this.zToIndexMap?.[key] ?? `Z=${key}`} -`;

      /* Slider row ------------------------------------------------------- */
      const slider = $('input', { type: 'range', min: '0.1', max: '3.0', step: '0.05', value: '1.0', className: 'layer-slider' });
      const reset  = $('button', { className: 'slider-reset-btn', textContent: 'Reset' });

      slider.addEventListener('input', e => applyScale(key, parseFloat(e.target.value)));
      reset .addEventListener('click', () => { slider.value = '1.0'; applyScale(key, 1); });

      const layerBox = $('div', { className: 'layer-container' },
        $('h5',  { className: 'layer-subheading', textContent: niceName }),
        $('div', { className: 'slider-row' },
          $('label', { className: 'scaling-label', textContent: 'Scale:  ' }),
          slider, reset)
      );

      /* Toggle row (skip input layer) ------------------------------------ */
      if (!isInput) {
        const types = [['mac', 'MACs'], ['cm', 'CMs'], ['neuron', 'Neurons']];
        const toggleRow = $('div', { className: 'toggle-row' },
          $('span', { className: 'toggle-prefix', textContent: 'Show:' })
        );

        types.forEach(([type, text]) => {
          const id  = `toggle-${type}-${key}`;
          const box = $('input', { type: 'checkbox', id, checked: true });
          const lbl = $('label', { htmlFor: id, textContent: text });

          box.addEventListener('change', () => {
            const show = box.checked;
            this.layerGroups[key]?.traverse(child => {
              const ud = child.userData;
              const isMatch = type === 'mac'
                ? ud?.isMacVisual
                : ud?.type === type;
              if (isMatch) child.visible = show;
            });

            if (type === 'mac') {
              this.layerGroups[key]?.traverse(child => {
                if (child.userData?.type !== 'mac') return;
                const idx = this.clickableMACs.indexOf(child);
                if (show && idx === -1) this.clickableMACs.push(child);
                if (!show && idx > -1)  this.clickableMACs.splice(idx, 1);
              });
            }
          });

          toggleRow.append(lbl, box);
        });

        layerBox.appendChild(toggleRow);
      }

      // Divider + controls into the container
      scaleContainer.append($('hr', { className: 'slider-divider' }), layerBox);
    });
  }

  /**
   * Wires up the static “Full Model Controls”.
   * ────────────────────────────────────────────────────────────────────────────
   *  • Layer‑spacing slider  → updates inter‑layer distance in real time
   *  • “Reset Spacing”       → spacing ⇢ default
   *  • “RESET ALL”           → full visual reset (spacing, scales, visibility,
   *                            clickable‑MAC list, UI widgets, weighted‑edge flag)
   *  • Weighted‑connections  → toggles visibility rule only
   */
  initializeFullModelControls() {
    const $id = (id) => document.getElementById(id);

    const spacingSlider = $id('layerSpacingSlider');
    const resetSpacing  = $id('resetSpacingBtn');
    const resetModel    = $id('resetModelBtn');
    const weightedChk   = $id('weightedConnectionsCheckbox');
    const uniformUI     = $id('uniform-layer-scales');

    const DEFAULT_SPACING = 10;
    const DEFAULT_SCALE   = 1;

    /* Helper: apply new spacing ************************************************/
    const setSpacing = (v) => {
      this.layerSpacing = v;
      this.updateLayerSpacing();
    };

    /* ── Layer‑spacing slider ──────────────────────────────────────────────── */
    spacingSlider?.addEventListener('input',
      (e) => setSpacing(parseFloat(e.target.value)));

    /* ── “Reset Spacing” button ───────────────────────────────────────────── */
    resetSpacing?.addEventListener('click', () => {
      spacingSlider && (spacingSlider.value = DEFAULT_SPACING);
      setSpacing(DEFAULT_SPACING);
    });

    /* ── “RESET ALL” button ───────────────────────────────────────────────── */
    resetModel?.addEventListener('click', () => {
      /* 1) spacing --------------------------------------------------------- */
      spacingSlider && (spacingSlider.value = DEFAULT_SPACING);
      setSpacing(DEFAULT_SPACING);

      /* 2) scales / visibility / clickableMACs ---------------------------- */
      this.clickableMACs = [];
      Object.values(this.layerGroups).forEach(group => {
        group.scale.set(DEFAULT_SCALE, DEFAULT_SCALE, DEFAULT_SCALE);
        group.traverse(child => {
          child.visible = true;
          if (child.userData?.type === 'mac' &&
              !this.clickableMACs.includes(child)) {
            this.clickableMACs.push(child);
          }
        });
      });

      /* 3) reset per‑layer UI widgets ------------------------------------- */
      if (uniformUI) {
        uniformUI.querySelectorAll('input.layer-slider')
                .forEach(sl => { sl.value = DEFAULT_SCALE; });

        ['mac', 'cm', 'neuron'].forEach(t =>
          uniformUI.querySelectorAll(`input[id^="toggle-${t}-"]`)
                  .forEach(cb => { cb.checked = true; }));
      }

      /* 4) weighted‑connections flag off ---------------------------------- */
      if (weightedChk) weightedChk.checked = false;

      /* 5) rebuild geometry + final vis ----------------------------------- */
      this.updateWeightedConnections();
      this.refreshConnectionVisibility();
    });

    /* ── Weighted‑connections checkbox ────────────────────────────────────── */
    weightedChk?.addEventListener('change',
      () => this.refreshConnectionVisibility());
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
    this.updateWeightedConnections();
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
  
  /* ───────────────────────── toggleMACSelection ───────────────────────── */
  toggleMACSelection(macGroup) {
    const outline = macGroup.userData.outlineLine;

    // Cache the true outline colour once
    if (!outline.userData.originalOutlineColor) {
      outline.userData.originalOutlineColor = outline.material.color.clone();
    }

    /* ---------- Deselect path ---------- */
    const deselect = () => {
      macGroup.userData.innerOutline && macGroup.remove(macGroup.userData.innerOutline);
      macGroup.userData.innerOutline = null;

      macGroup.userData.canvasSection?.remove();
      macGroup.userData.canvasSection = macGroup.userData.canvasWrapper = null;

      outline.material.color.copy(outline.userData.originalOutlineColor);

      macGroup.userData.isSelected = false;
      this.decrementConnectionRefCountForMac(macGroup);
      this.refreshConnectionVisibility();
      this.selectedMACs = this.selectedMACs.filter(m => m !== macGroup);
    };

    /* ---------- Select path ------------ */
    const select = () => {
      // Canvas
      macGroup.userData.canvasWrapper ??= this.createMACCanvas(macGroup);
      macGroup.userData.canvasWrapper.style.display = 'block';

      // Green inner outline
      const inner = new THREE.LineLoop(
        outline.geometry.clone(),
        new THREE.LineBasicMaterial({ color: 0x08FF08, linewidth: 1 })
      );
      inner.position.z = 0.01;
      (function disableRaycast(o){ o.raycast = () => {}; o.children?.forEach(disableRaycast); })(inner);
      macGroup.add(inner);
      macGroup.userData.innerOutline = inner;

      macGroup.userData.isSelected = true;
      this.selectedMACs.push(macGroup);

      this.updateMacProbabilities(this.macProbs);
      this.incrementConnectionRefCountForMac(macGroup);
      this.refreshConnectionVisibility();
    };

    macGroup.userData.isSelected ? deselect() : select();

    // Side‑panel details
    const details = document.getElementById('mac-details');
    details && (details.innerHTML = `<p><strong>Layer:</strong> ${macGroup.userData.layerIndex}</p>`);
  }

  /* ───────────────────────── resetToggledMACs ─────────────────────────── */
  resetToggledMACs() {
    // Deselect every currently selected MAC
    this.selectedMACs.forEach(m => {
      if (!m.userData.isSelected) return;
      m.userData.isSelected = false;

      m.userData.innerOutline && m.remove(m.userData.innerOutline);
      m.userData.innerOutline = null;

      const line = m.userData.outlineLine;
      line?.userData?.originalOutlineColor &&
        line.material.color.copy(line.userData.originalOutlineColor);
    });

    // Clear arrays + UI
    this.selectedMACs = [];
    const details = document.getElementById('mac-details');
    details && (details.innerHTML = `<p><strong>Layer:</strong></p>`);
    this.clearSidePanel();

    // Reset canvases & connection ref‑counts
    this.clickableMACs.forEach(m => { m.userData.canvasWrapper = null; });
    this._neuronConnections.forEach(conn => this._connectionRefCounts.set(conn, 0));

    this.refreshConnectionVisibility();
  }

  

  /* ───────────────────── createMACCanvas ───────────────────── */
  createMACCanvas(macGroup) {
    const $ = (tag, cls = '') => Object.assign(document.createElement(tag), { className: cls });

    /* container + heading */
    const wrap  = $('div', 'mac-canvas-wrapper');
    const label = $('p',   'mac-canvas-label');
    label.textContent = `MAC ${macGroup.userData.macIndex} (Layer ${macGroup.userData.layerIndex})`;
    wrap.append(label);

    /* top‑view canvas + placeholder chart box */
    const topCanvas = $('canvas', 'mac-top-canvas');
    topCanvas.width = topCanvas.height = 150;
    const chartBox  = $('div', 'cm-charts-container');
    wrap.append(topCanvas, chartBox);

    /* side‑panel section (+ divider if needed) */
    const side   = document.getElementById('side-panel');
    const sect   = $('div', 'mac-section');
    if (side.children.length) sect.append($('hr', 'slider-divider'));
    sect.append(wrap);
    side.appendChild(sect);

    /* backlink bookkeeping */
    Object.assign(macGroup.userData, {
      canvasSection:     sect,
      canvasWrapper:     wrap,
      cmChartsContainer: chartBox
    });

    /* initial render */
    this.createTopView(macGroup, topCanvas);
    return wrap;
  }

  /* ───────────────────── createTopView ─────────────────────── */
  createTopView(macGroup, canvas) {
    if (!this.sharedTopRenderer) {
      console.error('Shared top renderer not initialized');
      return;
    }

    /* scene + camera */
    const aspect = canvas.width / canvas.height,
          size   = 5,
          scene  = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    const cam = new THREE.OrthographicCamera(
      -size * aspect, size * aspect, size, -size, 0.1, 100
    );
    cam.position.z = 10; cam.lookAt(0, 0, 0);

    /* clone MAC, remove outline colour, scale a bit */
    const clone = macGroup.clone(true);
    this.resetOutlineColor(clone);
    clone.scale.set(1.5, 1.5, 1.5);
    clone.position.set(0, 0, 0);
    scene.add(clone);

    try {
      /* off‑screen render */
      const r  = this.sharedTopRenderer;
      const rt = new THREE.WebGLRenderTarget(canvas.width, canvas.height);
      r.setRenderTarget(rt); r.render(scene, cam); r.setRenderTarget(null);

      /* read pixels → flip vertically → paint onto 2D canvas */
      const buf = new Uint8Array(canvas.width * canvas.height * 4);
      r.readRenderTargetPixels(rt, 0, 0, canvas.width, canvas.height, buf);

      const tmpC = document.createElement('canvas');
      tmpC.width = canvas.width; tmpC.height = canvas.height;
      const tmpX = tmpC.getContext('2d'),
            img  = tmpX.createImageData(canvas.width, canvas.height);
      img.data.set(buf); this.flipImageDataVertically(img); tmpX.putImageData(img, 0, 0);

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(tmpC, 0, 0);

      rt.dispose();
    } catch (e) {
      console.error('Error creating top view:', e);
    }
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
      const topOffset    = row * bytesPerRow;
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
      console.error('projectSelect element not found!');
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

  /**
   * Recolor every neuron mesh: black if active (true) at this step, white otherwise.
   *   neuronActs = {
   *     layer_1: {
   *       1: {            // macIndex
   *         1: {          // cmIndex
   *           1: false,  // neuronIndex → boolean/null
   *           2: true
   *         },
   *         2: {  … }
   *       },
   *       2: {  … }
   *     },
   *     layer_2: { … }
   *   }
   */
  updateNeuronActivations(neuronActs = {}) {
    this.allNeurons.forEach(neuron => {
      const { layerKey, macIndex, cmIndex, neuronIndex } = neuron.userData;

      // drill safely into the maps
      const layerMap  = neuronActs[layerKey]   || {};
      const cmMap     = layerMap[macIndex]     || {};
      const neuronMap = cmMap[cmIndex]         || {};

      // one-based lookup: JSON keys are "1","2",… not "0","1",…
      const isActive = Boolean(neuronMap[neuronIndex]);

      // reset and recolor
      neuron.material.transparent = false;
      neuron.material.opacity     = 1.0;
      neuron.material.color.set(
        isActive
          ? (neuron.userData.activeColor   || new THREE.Color(0x000000))
          : (neuron.userData.inactiveColor || new THREE.Color(0xffffff))
      );
    });
  }
}
