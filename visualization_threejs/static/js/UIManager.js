import { RendererCache } from './RendererCache.js';
import { UIComponentFactory } from './Factory.js';

export class UIManager {
  static initialize() {
    document.getElementById('projectSelect').addEventListener('change', async function() {
      let selectedProject = this.value;
      if (selectedProject) {
        document.getElementById('visualizeButton').disabled = true;
        let runSelect = document.getElementById('runSelect');
        runSelect.disabled = true;
        runSelect.innerHTML = '<option value="" disabled selected>Loading runs...</option>';
        await UIManager.loadRuns(selectedProject);
      }
    });

    const resetButton = document.getElementById("resetButton");
    if (resetButton) {
      resetButton.addEventListener("click", () => {
        window.dispatchEvent(new CustomEvent('resetMACs'));
      });
    }
    UIManager.setupCameraControlButtons();
  }

  static async loadProjects() {
    try {
      let response = await fetch('/get_projects');
      let projects = await response.json();
      if (projects.error) throw new Error(projects.error);
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

  static async loadRuns(project) {
    try {
      let response = await fetch('/get_runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project })
      });
      let runs = await response.json();
      if (runs.error) throw new Error(runs.error);
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

  static updateMACDetails(macGroup) {
    let macData = macGroup.userData;
    let layer = (macData.z / 10) + 1;
    const detailsDiv = document.getElementById("mac-details");
    if (detailsDiv) {
      detailsDiv.innerHTML = `<p><strong>Layer:</strong> ${layer.toFixed(1)}</p>`;
    }
  }

  static clearMACDetails() {
    const detailsDiv = document.getElementById("mac-details");
    if (detailsDiv) {
      detailsDiv.innerHTML = `<p><strong>Layer:</strong></p>`;
    }
  }

  static createMACCanvas(macGroup) {
    let layer = (macGroup.userData.z / 10) + 1;
    const { containerDiv, topCanvas, barGraphCanvas } = UIComponentFactory.createMACCanvas(layer);
    const sidePanel = document.getElementById("side-panel");
    sidePanel.appendChild(containerDiv);
    UIManager.createTopView(macGroup, topCanvas);
    UIManager.renderBarGraph(macGroup, barGraphCanvas);
    return containerDiv;
  }

  static createTopView(macGroup, canvas) {
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
    UIManager.resetOutlineColor(compositeClone);
    const scaleFactor = 1.5;
    compositeClone.scale.set(scaleFactor, scaleFactor, scaleFactor);
    compositeClone.position.set(0, 0, 0);
    topScene.add(compositeClone);
    const renderer = RendererCache.getInstance();
    const renderTarget = new THREE.WebGLRenderTarget(canvas.width, canvas.height);
    renderer.setRenderTarget(renderTarget);
    renderer.render(topScene, topCamera);
    renderer.setRenderTarget(null);
    const pixelBuffer = new Uint8Array(canvas.width * canvas.height * 4);
    renderer.readRenderTargetPixels(renderTarget, 0, 0, canvas.width, canvas.height, pixelBuffer);
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    const imageData = tempCtx.createImageData(canvas.width, canvas.height);
    imageData.data.set(pixelBuffer);
    UIManager.flipImageDataVertically(imageData);
    tempCtx.putImageData(imageData, 0, 0);
    const ctx2d = canvas.getContext('2d');
    ctx2d.clearRect(0, 0, canvas.width, canvas.height);
    ctx2d.drawImage(tempCanvas, 0, 0);
    renderTarget.dispose();
  }

  static flipImageDataVertically(imageData) {
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

  static renderBarGraph(macGroup, canvas) {
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

  static resetOutlineColor(group) {
    group.traverse(child => {
      if (child.isLine && child.material && child.material.color && child.userData && child.userData.type === "mac_outline") {
        child.material.color.set(0x000000);
      }
    });
  }

  static clearSidePanel() {
    const sidePanel = document.getElementById("side-panel");
    while (sidePanel.firstChild) {
      sidePanel.removeChild(sidePanel.firstChild);
    }
  }

  static setupCameraControlButtons() {
    const panButton = document.getElementById("panButton");
    const bothButton = document.getElementById("bothButton");
    const resetControls = document.getElementById("resetControls");

    panButton.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent('enablePanMode'));
    });

    bothButton.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent('enableRotateAndPanMode'));
    });

    resetControls.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent('resetCamera'));
    });
  }
}
