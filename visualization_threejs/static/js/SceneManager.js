export class SceneManager {
    constructor(containerId) {
      this.container = document.getElementById(containerId);
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0xffffff);
      this.camera = new THREE.PerspectiveCamera(75, this.container.clientWidth / this.container.clientHeight, 0.1, 1000);
      this.camera.position.set(0, 0, 50);
      this.renderer = new THREE.WebGLRenderer({ antialias: true });
      this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
      this.container.appendChild(this.renderer.domElement);
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
      window.addEventListener('resize', () => this.onWindowResize());
      this.clickableMACs = [];
      this.selectedMACs = [];
      this.raycaster = new THREE.Raycaster();
      this.mouse = new THREE.Vector2();
      this.renderer.domElement.addEventListener('click', (e) => this.onDocumentMouseClick(e), false);
      this.animate();
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
  
    clearScene() {
      while (this.scene.children.length > 0) {
        this.scene.remove(this.scene.children[0]);
      }
      this.clickableMACs = [];
      this.selectedMACs = [];
    }
  
    addToScene(object) {
      this.scene.add(object);
    }
  
    onDocumentMouseClick(event) {
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(this.clickableMACs, true);
      if (intersects.length > 0) {
        const macGroup = this.getMACGroup(intersects[0].object);
        if (macGroup) {
          const event = new CustomEvent('macClick', { detail: { macGroup } });
          window.dispatchEvent(event);
        }
      }
    }
  
    getMACGroup(object) {
      while (object) {
        if (this.clickableMACs.includes(object) && object.userData && object.userData.type === "mac") {
          return object;
        }
        object = object.parent;
      }
      return null;
    }
  }
  