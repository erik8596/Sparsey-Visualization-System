// /static/js/SceneManager.js
// Manages the Three.js scene, camera, renderer, animation loop ― *plus a
// couple of scene‑level helpers that used to live in UIManager.*

import { eventBus } from './app.js';

export class SceneManager {
  constructor(containerId) {
    /* ───────────────────────────────────────────────────────── scene setup */
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffffff);

    const container = document.getElementById(containerId);
    const width  = container.clientWidth;
    const height = container.clientHeight;

    /* camera */
    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 50);

    /* renderers */
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    container.appendChild(this.renderer.domElement);

    this.sharedTopRenderer = new THREE.WebGLRenderer({ antialias: true });
    this.sharedTopRenderer.setSize(200, 200);
    this.sharedTopRenderer.setClearColor(0xffffff, 1);

    /* controls */
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxDistance   = 200;
    this.controls.screenSpacePanning = false;
    this.setControls({ rotate: true, pan: true });    // helper below

    /* interaction utilities */
    this.raycaster = new THREE.Raycaster();
    this.mouse     = new THREE.Vector2();

    /* listeners + loop */
    this.setupEventListeners();
    this.animate();
  }

  /* ─────────────────────────────── public helpers  ──────────────── */

  /** Remove *everything* that is currently attached to the scene graph. */
  clearScene() {                                    
    while (this.scene.children.length) {
      this.scene.remove(this.scene.children[0]);
    }
  }

  /**
   * Adjust OrbitControls’ behaviour in a single place.
   * @param {Object} opts
   *        rotate  (Boolean) – enable mouse rotation  
   *        pan     (Boolean) – enable mouse panning  
   *        azimuth ([min,max]) – radians; left/right clamp  
   *        polar   ([min,max]) – radians; up/down clamp
   */
  setControls({
    rotate  = true,
    pan     = true,
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

    // forward clicks to whoever cares (UIManager, etc.)
    this.renderer.domElement.addEventListener('click', evt =>
      eventBus.notify('sceneClicked', evt));
  }

  onWindowResize() {
    const container   = document.getElementById('threejs-container');
    const width       = container.clientWidth;
    const height      = container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  /* re‑exports so callers don’t touch raw THREE.Scene methods */
  add(obj)    { this.scene.add(obj);    }
  remove(obj) { this.scene.remove(obj); }
}
