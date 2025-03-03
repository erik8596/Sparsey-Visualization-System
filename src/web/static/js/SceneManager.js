// /static/js/SceneManager.js
// Manages the Three.js scene, camera, renderer, and animation loop.
import { eventBus } from './app.js';

export class SceneManager {
  constructor() {
    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x222222);  // should reset it back to white when needed

    // Create camera
    this.camera = new THREE.PerspectiveCamera(
      75, // Field of view
      window.innerWidth / window.innerHeight, // Aspect ratio
      0.1, // Near plane
      1000 // Far plane
    );
    this.camera.position.z = 5;

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    const container = document.getElementById('threejs-container');
    container.appendChild(this.renderer.domElement);

    // Create OrbitControls
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 1;
    this.controls.maxDistance = 50;

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

    // Instead of direct toggling, we publish an event "sceneClicked"
    this.renderer.domElement.addEventListener('click', (event) => {
      eventBus.notify('sceneClicked', event);
    });
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
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
