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

    this.clickableMACs = [];
    this.selectedMACs = [];

    // Subscribe to "sceneClicked"
    eventBus.subscribe('sceneClicked', (event) => this.onSceneClick(event));
    // Subscribe to "resetMACs"
    eventBus.subscribe('resetMACs', () => this.resetToggledMACs());
  }

  buildFromLayers(layers) {
    // Clear old scene objects
    while (this.scene.children.length > 0) {
      this.scene.remove(this.scene.children[0]);
    }
    this.clickableMACs = [];
    this.selectedMACs = [];

    const macGroups = [];
    const mac_spacing = 1.33;

    // Calculate center point of all elements
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    layers.forEach(element => {
      minX = Math.min(minX, element.x);
      maxX = Math.max(maxX, element.x);
      minY = Math.min(minY, element.y);
      maxY = Math.max(maxY, element.y);
      minZ = Math.min(minZ, element.z);
      maxZ = Math.max(maxZ, element.z);
    });

    // Calculate center offsets
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;

    // First pass: create MAC composites
    layers.forEach(element => {
      if (element.type === 'mac') {
        const macGroup = new THREE.Group();
        const shape = new THREE.Shape();
        this.drawHexagon(shape, 2.0); // Adjust MAC size as needed

        // Create a fill mesh
        const fillGeometry = new THREE.ShapeGeometry(shape);
        const isActive = (element.active === true || element.active === 1);
        const fillColor = 0xffcccc;
        const fillOpacity = isActive ? 1.0 : 0.0;
        const fillMaterial = new THREE.MeshBasicMaterial({
          color: fillColor,
          transparent: true,
          opacity: fillOpacity,
          side: THREE.DoubleSide
        });
        const fillMesh = new THREE.Mesh(fillGeometry, fillMaterial);
        fillMesh.position.z = -0.01;
        macGroup.add(fillMesh);

        // Create an outline
        const points = shape.getPoints();
        const outlineGeometry = new THREE.BufferGeometry().setFromPoints(points);
        const outlineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 });
        const outlineLine = new THREE.LineLoop(outlineGeometry, outlineMaterial);
        outlineLine.userData = { type: 'mac_outline' };
        macGroup.add(outlineLine);

        macGroup.userData = element;
        macGroup.userData.outlineLine = outlineLine;
        macGroup.userData.fillMesh = fillMesh;
        macGroup.userData.originalZ = element.z - centerZ;

        // Center the position
        macGroup.position.set(
          element.x - centerX,
          (element.y - centerY) * mac_spacing,
          element.z - centerZ
        );

        this.sceneManager.add(macGroup);
        this.clickableMACs.push(macGroup);
        macGroups.push(macGroup);
      }
    });

    // Second pass: create CM/neuron objects
    layers.forEach(element => {
      if (element.type === 'cm' || element.type === 'neuron') {
        let object;
        if (element.type === 'cm') {
          const shape = new THREE.Shape();
          this.drawHexagon(shape, 0.5);
          const points = shape.getPoints();
          const geometry = new THREE.BufferGeometry().setFromPoints(points);
          const material = new THREE.LineBasicMaterial({ color: 0x0000FF, linewidth: 2 });
          object = new THREE.LineLoop(geometry, material);
        } else if (element.type === 'neuron') {
          const shape = new THREE.Shape();
          this.drawCircle(shape, 0.10);

          if (element.active) {
            // For active neurons: filled green circle with black outline
            const fillGeometry = new THREE.ShapeGeometry(shape);
            const fillMaterial = new THREE.MeshBasicMaterial({
              color: 0x00ff00,  // Changed from red (0xff0000) to green (0x00ff00)
              side: THREE.DoubleSide,
              transparent: true,
              opacity: 0.8  // Added slight transparency
            });
            object = new THREE.Mesh(fillGeometry, fillMaterial);

            // Add black outline with increased width for better visibility
            const outlinePoints = shape.getPoints();
            const outlineGeometry = new THREE.BufferGeometry().setFromPoints(outlinePoints);
            const outlineMaterial = new THREE.LineBasicMaterial({
              color: 0x000000,
              linewidth: 2,
              transparent: true,
              opacity: 1.0
            });
            const outline = new THREE.LineLoop(outlineGeometry, outlineMaterial);
            object.add(outline);
          } else {
            // For inactive neurons: just lighter black outline
            const points = shape.getPoints();
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({
              color: 0x444444,  // Changed to lighter color for inactive neurons
              linewidth: 1,
              transparent: true,
              opacity: 0.5
            });
            object = new THREE.LineLoop(geometry, material);
          }

          // Add raw activation data to userData if available
          if (element.raw_activation !== undefined) {
            object.userData.raw_activation = element.raw_activation;
          }
          if (element.avg_activation !== undefined) {
            object.userData.avg_activation = element.avg_activation;
          }

          object.userData = element;
          object.userData.type = element.type;
        }

        object.userData = element;
        object.userData.type = element.type;

        // Center the position
        object.position.set(
          element.x - centerX,
          (element.y - centerY) * mac_spacing,
          element.z - centerZ
        );

        // Attach to nearest MAC
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
    if (macGroup.userData.isSelected) {
      outlineLine.material.color.set(0x000000);
      macGroup.position.z = macGroup.userData.originalZ;
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
      outlineLine.material.color.set(0x008000);
      macGroup.position.z = macGroup.userData.originalZ + 0.5;
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

  createInputGrid(cols, rows) {
    const hexSize = 2.0;
    const macSpacing = 3.0;
    const zOffset = -10;

    for (let rowIdx = 0; rowIdx < rows; rowIdx++) {
      for (let colIdx = 0; colIdx < cols; colIdx++) {
        const x = colIdx * macSpacing;
        let y = rowIdx * Math.sqrt(3) * hexSize;
        if (colIdx % 2 !== 0) {
          y += (Math.sqrt(3) * hexSize) / 2;
        }

        // We'll create a small hex shape for the input cell
        const shape = new THREE.Shape();
        for (let i = 0; i < 6; i++) {
          let angle = (Math.PI / 3) * i;
          let xx = hexSize * Math.cos(angle);
          let yy = hexSize * Math.sin(angle);
          if (i === 0) shape.moveTo(xx, yy);
          else shape.lineTo(xx, yy);
        }
        shape.closePath();

        const geometry = new THREE.BufferGeometry().setFromPoints(shape.getPoints());
        const material = new THREE.LineBasicMaterial({ color: 0x0000ff, linewidth: 1 });
        const cellHex = new THREE.LineLoop(geometry, material);

        cellHex.position.set(
          x - ((cols - 1) * macSpacing) / 2,
          y - ((rows - 1) * Math.sqrt(3) * hexSize) / 2,
          zOffset
        );
        this.sceneManager.add(cellHex);
      }
    }
  }

  createInputGrid(cols, rows, activations = {}) {
    const hexSize = 2.0;
    const macSpacing = 3.0;
    const zOffset = -10;

    for (let rowIdx = 0; rowIdx < rows; rowIdx++) {
      for (let colIdx = 0; colIdx < cols; colIdx++) {
        const x = colIdx * macSpacing;
        let y = rowIdx * Math.sqrt(3) * hexSize;
        if (colIdx % 2 !== 0) {
          y += (Math.sqrt(3) * hexSize) / 2;
        }

        // Calculate the MAC index for this position
        const macIndex = rowIdx * cols + colIdx + 1;
        const isActive = activations[macIndex] === 1;

        // Create input cell shape
        const shape = new THREE.Shape();
        this.drawHexagon(shape, hexSize);

        // Create fill mesh for active state
        const fillGeometry = new THREE.ShapeGeometry(shape);
        const fillMaterial = new THREE.MeshBasicMaterial({
          color: 0xffcccc,
          transparent: true,
          opacity: isActive ? 1.0 : 0.0,
          side: THREE.DoubleSide
        });
        const fillMesh = new THREE.Mesh(fillGeometry, fillMaterial);

        // Create outline
        const points = shape.getPoints();
        const outlineGeometry = new THREE.BufferGeometry().setFromPoints(points);
        const outlineMaterial = new THREE.LineBasicMaterial({
          color: 0x0000ff,
          linewidth: 1
        });
        const outlineMesh = new THREE.LineLoop(outlineGeometry, outlineMaterial);

        // Create a group to hold both meshes
        const cellGroup = new THREE.Group();
        cellGroup.add(fillMesh);
        cellGroup.add(outlineMesh);

        cellGroup.position.set(
          x - ((cols - 1) * macSpacing) / 2,
          y - ((rows - 1) * Math.sqrt(3) * hexSize) / 2,
          zOffset
        );

        this.sceneManager.add(cellGroup);
      }
    }
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
      -viewSize * aspect, viewSize * aspect, viewSize, -viewSize, 0.1, 100
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
