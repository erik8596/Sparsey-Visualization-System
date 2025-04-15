// File: /static/js/factories/VisualFactory.js
// Defines the interface for all visual factories.
export class VisualFactory {
    /**
     * Abstract factory method.
     * @param {Object} element       - The data for the component (type, x, y, z, active, etc.).
     * @param {Object} layerCenter   - { x, y } centroid of the layer.
     * @param {number} mac_spacing   - Spacing multiplier for y positioning.
     * @param {number} layerIndex    - Index of the layer from zToIndexMap.
     * @returns {THREE.Object3D}     - A Three.js object (Group, Mesh, or LineLoop).
     */
    create(element, layerCenter, mac_spacing, layerIndex) {
      throw new Error("VisualFactory.create() must be implemented by subclass");
    }
  }  
  