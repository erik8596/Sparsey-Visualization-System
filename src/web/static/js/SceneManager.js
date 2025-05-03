// /static/js/SceneManager.js
// Manages the Three.js scene, camera, renderer, and animation loop.
import { eventBus } from './app.js';

export class SceneManager {
  constructor(containerId) {
    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffffff);

    // Get container dimensions
    const container = document.getElementById(containerId);
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Camera
    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 50);

    // Renderers
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    container.appendChild(this.renderer.domElement);

    this.sharedTopRenderer = new THREE.WebGLRenderer({ antialias: true });
    this.sharedTopRenderer.setSize(200, 200);
    this.sharedTopRenderer.setClearColor(0xffffff, 1);

    // Controls
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxDistance = 200;
    this.controls.screenSpacePanning = false;
    // initial mouseButtons and angles are set in setControls below
    this.setControls({ rotate: true, pan: true });

    // Raycaster & interaction
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Storage
    this.macs = [];

    // Events & loop
    this.setupEventListeners();
    this.animate();
  }

  /** 
   * Apply rotate/pan mode and angle limits in one place. 
   * @param {{rotate:boolean, pan:boolean, azimuth?:[number,number], polar?:[number,number]}} opts 
   */
  setControls({
    rotate = true,
    pan    = true,
    azimuth = [-Infinity, Infinity],
    polar   = [0, Math.PI]
  } = {}) {
    this.controls.enableRotate = rotate;
    this.controls.enablePan    = pan;

    this.controls.mouseButtons = {
      LEFT:   rotate ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT:  THREE.MOUSE.PAN
    };

    this.controls.minAzimuthAngle = azimuth[0];
    this.controls.maxAzimuthAngle = azimuth[1];
    this.controls.minPolarAngle   = polar[0];
    this.controls.maxPolarAngle   = polar[1];
  }

  setupEventListeners() {
    window.addEventListener('resize', () => this.onWindowResize(), false);

    // click interactions
    this.renderer.domElement.addEventListener('click', (event) => {
      eventBus.notify('sceneClicked', event);
    });

    // (camera button wiring removed; now lives in app.js)
  }

  onWindowResize() {
    const container = document.getElementById('threejs-container');
    const width = container.clientWidth;
    const height = container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  add(obj)    { this.scene.add(obj); }
  remove(obj) { this.scene.remove(obj); }

  startRotateLeft() {
    if (!this.rotateInterval) {
      this.rotateInterval = setInterval(() => {
        this.controls.rotateLeft(0.02);
        this.controls.update();
      }, 16);
    }
  }

  startRotateRight() {
    if (!this.rotateInterval) {
      this.rotateInterval = setInterval(() => {
        this.controls.rotateLeft(-0.02);
        this.controls.update();
      }, 16);
    }
  }

  stopRotate() {
    clearInterval(this.rotateInterval);
    this.rotateInterval = null;
  }
}
