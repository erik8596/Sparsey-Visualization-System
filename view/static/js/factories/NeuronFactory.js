import { BaseElementFactory } from './BaseElementFactory.js';
import { NeuronLeaf } from '../composites/NeuronLeaf.js';

export class NeuronFactory extends BaseElementFactory {
  createElement(elementData) {
    const scale = elementData.scale || 1;
    const shape = new THREE.Shape();
    this.drawCircle(shape, 0.10 * scale);

    const points = shape.getPoints();
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });

    // Return a NeuronLeaf
    return new NeuronLeaf(elementData, geometry, material);
  }
}
