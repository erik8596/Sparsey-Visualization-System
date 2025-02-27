import { eventBus } from './app.js';
import { getElementFactory } from './factories/ElementFactoryProvider.js';

export class MacManager {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.scene = sceneManager.scene;
    this.raycaster = sceneManager.raycaster;
    this.mouse = sceneManager.mouse;
    this.sharedTopRenderer = sceneManager.sharedTopRenderer;

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

    // First pass: create MAC composites
    layers.forEach(element => {
      if (element.type === 'mac') {
        const factory = getElementFactory('mac');
        if (!factory) return;
        const macGroup = factory.createElement(element);

        const mac_spacing = 1.33;
        macGroup.position.set(element.x, element.y * mac_spacing, element.z);

        this.sceneManager.add(macGroup);
        this.clickableMACs.push(macGroup);
        macGroups.push(macGroup);
      }
    });

    // Second pass: create CM/neuron objects
    layers.forEach(element => {
      if (element.type === 'cm' || element.type === 'neuron') {
        const factory = getElementFactory(element.type);
        if (!factory) return;
        const obj = factory.createElement(element);

        const mac_spacing = 1.33;
        obj.position.set(element.x, element.y * mac_spacing, element.z);

        // Attach to nearest MAC
        let closestMac = null;
        let minDistance = Infinity;
        macGroups.forEach(macGroup => {
          if (Math.abs(macGroup.position.z - obj.position.z) < 0.001) {
            const dx = macGroup.position.x - obj.position.x;
            const dy = macGroup.position.y - obj.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDistance) {
              minDistance = dist;
              closestMac = macGroup;
            }
          }
        });

        if (closestMac) {
          obj.position.sub(closestMac.position);
          closestMac.add(obj); // composite add
        } else {
          this.sceneManager.add(obj);
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
      ctx.font = '10px Arial';
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
}
