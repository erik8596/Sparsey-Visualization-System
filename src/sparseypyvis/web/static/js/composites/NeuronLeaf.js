// /static/js/composites/NeuronLeaf.js

export class NeuronLeaf extends THREE.LineLoop {
    constructor(elementData = {}, geometry = null, material = null) {
      // If geometry is null (when clone calls new with no args), create a default
      if (!geometry) {
        geometry = new THREE.BufferGeometry();
      }
      // If material is null, create a default (or use some fallback)
      if (!material) {
        material = new THREE.LineBasicMaterial({ color: 0x000000 });
      }
  
      // Now call super(...) with guaranteed non-null geometry/material
      super(geometry, material);
  
      this.userData = elementData;
      if (!this.userData.type) {
        this.userData.type = 'neuron';
      }
    }
  
    copy(source, recursive) {
      // Let Three.js do its normal copy logic (transforms, children, etc.)
      super.copy(source, recursive);
  
      // Shallow copy of userData
      this.userData = { ...source.userData };
  
      return this;
    }
  }
  