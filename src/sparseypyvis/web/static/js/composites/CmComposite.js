// /static/js/composites/CmComposite.js
import { CompositeNode } from './CompositeNode.js';

export class CmComposite extends CompositeNode {
  constructor(elementData = {}, geometry = null, material = null) {
    super();

    // Provide a valid object for userData
    this.userData = elementData;
    if (!this.userData.type) {
      this.userData.type = 'cm';
    }

    // If you want a default for, say, originalZ:
    if (!('z' in this.userData)) {
      this.userData.z = 0;
    }

    // Build the line loop only if geometry/material are passed
    if (geometry && material) {
      const lineLoop = new THREE.LineLoop(geometry, material);
      this.add(lineLoop);
    }
  }

  // Optionally override copy if you have special fields to replicate
  copy(source, recursive) {
    // Let Three.js do the default copying
    super.copy(source, recursive);

    // Then replicate userData
    this.userData = { ...source.userData };

    // If we want to find the line loop we just cloned, we can search children:
    // (only needed if you plan to store a direct reference in userData)
    return this;
  }
}
