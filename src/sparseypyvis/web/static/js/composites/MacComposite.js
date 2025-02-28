// /static/js/composites/MacComposite.js
import { CompositeNode } from './CompositeNode.js';

export class MacComposite extends CompositeNode {
  constructor(elementData = {}, fillMesh = null, outlineLine = null) {
    // If Three.js calls `new this.constructor()` with no args, we avoid crashing:
    super();

    // Provide default userData object
    this.userData = elementData;
    // If userData.type is missing, default to "mac"
    if (!this.userData.type) {
      this.userData.type = 'mac';
    }

    // Keep references in userData
    this.userData.fillMesh = fillMesh;
    this.userData.outlineLine = outlineLine;
    if (!('originalZ' in this.userData)) {
      this.userData.originalZ = this.userData.z ?? 0;
    }

    // If we actually got a fillMesh and outlineLine, add them as children
    if (fillMesh) {
      fillMesh.position.z = -0.01;
      this.add(fillMesh);
    }
    if (outlineLine) {
      this.add(outlineLine);
    }
  }

  // -------------------------------------------------
  // 2. Override .copy() to properly replicate fields
  // -------------------------------------------------
  copy(source, recursive) {
    // Let Three.js do the default copying of transforms, children, etc.
    super.copy(source, recursive);

    // Then replicate custom userData. (shallow copy is typically enough)
    this.userData = { ...source.userData };

    // We'll re-find the fillMesh and outlineLine among our children,
    // because the default clone logic has already cloned them for us.
    this.userData.fillMesh = null;
    this.userData.outlineLine = null;

    this.traverse((child) => {
      // If a child is a mesh, assume it's our fill
      if (child.isMesh) {
        this.userData.fillMesh = child;
      }
      // If a child has userData.type === "mac_outline", that's our outline
      if (child.userData && child.userData.type === 'mac_outline') {
        this.userData.outlineLine = child;
      }
    });

    return this;
  }
}
