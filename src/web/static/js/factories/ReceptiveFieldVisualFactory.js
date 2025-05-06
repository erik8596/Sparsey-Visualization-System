// ReceptiveFieldVisualFactory.js
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';
export class ReceptiveFieldVisualFactory {
  constructor(scene) {
    this.scene = scene;

    /* styling ---------------------------------------------------------------- */
    this.fillMaterial    = new THREE.MeshBasicMaterial({
      color: 0x2367ff,           // blue‑grey fill
      opacity: 0.25,
      transparent: true,
      side: THREE.DoubleSide
    });
    this.outlineMaterial = new THREE.LineBasicMaterial({
      color: 0x2367ff,           // same hue, full‑opacity outline
      linewidth: 1
    });
  }

  /* helper – create a flat hexagon (XY‑plane) whose circumscribed‑circle
   * diameter equals `diam`.  We reuse the “hex” shape the rest of the
   * app already uses. */
  _makeHexMesh(diam) {
    const radius = diam / 2;
    const shape  = new THREE.Shape();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i;
      const x = radius * Math.cos(a);
      const y = radius * Math.sin(a);
      i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y);
    }
    shape.closePath();

    const fill    = new THREE.Mesh(new THREE.ShapeGeometry(shape), this.fillMaterial);
    const outline = new THREE.LineLoop(
                      new THREE.BufferGeometry().setFromPoints(shape.getPoints()),
                      this.outlineMaterial
                    );
    const g = new THREE.Group();
    g.add(fill, outline);
    return g;
  }

  /**
   * Build blue/grey hex overlays around every object in `objs`.
   * Returns a THREE.Group so caller can remove() it later.
   * @param {THREE.Object3D[]} objs – MAC groups *or* input cells.
   */
  build(objs = []) {
    const group = new THREE.Group();

    objs.forEach(o => {
      // bounding box gives XY extent; we ignore Z (overlay is flat)
      const box = new THREE.Box3().setFromObject(o);
      const size = new THREE.Vector3();
      box.getSize(size);

      /* pick the larger of width/height so the hex fully covers */
      const diam = Math.max(size.x, size.y);

      const hex  = this._makeHexMesh(diam * 1.05);   // slight oversize looks nicer
      /* sit the overlay a hair above the object so Z‑fighting is avoided */
      const ctr  = new THREE.Vector3();
      box.getCenter(ctr);
      hex.position.copy(ctr);
      hex.position.z += 0.02;

      // disable ray‑cast so clicks go through
      hex.traverse(child => { child.raycast = () => {}; });

      group.add(hex);
    });

    this.scene.add(group);
    return group;
  }
}