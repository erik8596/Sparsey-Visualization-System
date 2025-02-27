// /static/js/SceneManager.js
// Manages the Three.js scene, camera, renderer, and animation loop.

import { eventBus } from './app.js'; // We'll import the shared eventBus
// We assume <script src="three.min.js" /> is in index.html, so THREE is global
// If you prefer an ES import, you'd do: import * as THREE from 'three';
// and similarly for OrbitControls.

export class SceneManager {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.raycaster = null;
    this.mouse = new THREE.Vector2();

    // We'll create a shared top renderer for side-panel snapshots,
    // just like your old code did.
    this.sharedTopRenderer = new THREE.WebGLRenderer({ antialias: true });
    this.sharedTopRenderer.setSize(200, 200);
    this.sharedTopRenderer.setClearColor(0xffffff, 1);

    this.rotateInterval = null; // used for continuous rotation

    this.initScene();
    this.initEvents();
    this.animate();
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffffff);

    this.camera = new THREE.PerspectiveCamera(
      75,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 0, 50);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.container.appendChild(this.renderer.domElement);

    // Use OrbitControls from the global scope
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxDistance = 200;
    this.controls.screenSpacePanning = false;
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN
    };

    this.raycaster = new THREE.Raycaster();
  }

  initEvents() {
    window.addEventListener('resize', () => this.onWindowResize(), false);

    // Instead of hooking "click" directly to toggling MACs,
    // we publish an event so that MacManager can handle it.
    this.renderer.domElement.addEventListener('click', (event) => {
      eventBus.notify('sceneClicked', event);
    });
  }

  onWindowResize() {
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  // Utility to add objects to the scene
  add(object) {
    this.scene.add(object);
  }

  // Utility to remove objects
  remove(object) {
    this.scene.remove(object);
  }

  // Continuous rotation logic, same as main.js
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
