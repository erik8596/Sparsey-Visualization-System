import { BaseElementFactory } from './BaseElementFactory.js';
import { CmComposite } from '../composites/CmComposite.js';

export class CmFactory extends BaseElementFactory {
  createElement(elementData) {
    const scale = elementData.scale || 1;

    // Build shape
    const shape = new THREE.Shape();
    this.drawHexagon(shape, 0.5 * scale);

    const points = shape.getPoints();
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0x0000FF, linewidth: 2 });

    // Return a CmComposite
    return new CmComposite(elementData, geometry, material);
  }
}
