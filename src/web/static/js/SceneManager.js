// /static/js/SceneManager.js
// Manages the Three.js scene, camera, renderer, and animation loop.
import { eventBus } from './app.js';

export class SceneManager {
  constructor() {
    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffffff);  // White background

    // Get container dimensions
    const container = document.getElementById('threejs-container');
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Create camera
    this.camera = new THREE.PerspectiveCamera(
      75, // Field of view
      width / height, // Aspect ratio
      0.1, // Near plane
      1000 // Far plane
    );
    // Position camera at z=100 to ensure it's behind all layers
    this.camera.position.set(0, 0, 100);

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    container.appendChild(this.renderer.domElement);

    // Create shared top renderer for side panel snapshots
    this.sharedTopRenderer = new THREE.WebGLRenderer({ antialias: true });
    this.sharedTopRenderer.setSize(200, 200);
    this.sharedTopRenderer.setClearColor(0xffffff, 1);

    // Create OrbitControls
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 200;

    // Create raycaster and mouse vector for interaction
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Store MAC objects
    this.macs = [];

    // Setup event listeners
    this.setupEventListeners();

    // Start animation loop
    this.animate();
  }

  setupEventListeners() {
    window.addEventListener('resize', () => this.onWindowResize(), false);

    // Handle scene clicks
    this.renderer.domElement.addEventListener('click', (event) => {
      eventBus.notify('sceneClicked', event);
    });

    // Setup camera control buttons
    const panButton = document.getElementById('panButton');
    if (panButton) {
      panButton.addEventListener('click', () => {
        this.controls.enableRotate = false;
        this.controls.enablePan = true;
        this.controls.mouseButtons = {
          LEFT: THREE.MOUSE.PAN,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN
        };
        console.log("Pan mode enabled");
      });
    }

    const bothButton = document.getElementById('bothButton');
    if (bothButton) {
      bothButton.addEventListener('click', () => {
        this.controls.enableRotate = true;
        this.controls.enablePan = true;
        this.controls.mouseButtons = {
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN
        };
        // Reset angle limitations
        this.controls.minAzimuthAngle = -Infinity;
        this.controls.maxAzimuthAngle = Infinity;
        this.controls.minPolarAngle = 0;
        this.controls.maxPolarAngle = Math.PI;
        console.log("Default mode enabled (rotate & pan)");
      });
    }

    const resetControls = document.getElementById('resetControls');
    if (resetControls) {
      resetControls.addEventListener('click', () => {
        this.controls.enableRotate = true;
        this.controls.enablePan = true;
        this.controls.mouseButtons = {
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN
        };
        this.controls.minAzimuthAngle = -Infinity;
        this.controls.maxAzimuthAngle = Infinity;
        this.controls.minPolarAngle = 0;
        this.controls.maxPolarAngle = Math.PI;
        this.controls.reset();
        console.log("Controls reset");
      });
    }
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

  add(object) {
    this.scene.add(object);
  }

  remove(object) {
    this.scene.remove(object);
  }

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
    if (this.rotateInterval) {
      clearInterval(this.rotateInterval);
      this.rotateInterval = null;
    }
  }
}
