// /static/js/factories/NeuronFactory.js
import { BaseElementFactory } from './BaseElementFactory.js';

export class NeuronFactory extends BaseElementFactory {
  createElement(elementData) {
    const shape = new THREE.Shape();
    const scale = elementData.scale || 1;
    this.drawCircle(shape, 0.10 * scale);

    const points = shape.getPoints();
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
    const neuronObj = new THREE.LineLoop(geometry, material);

    neuronObj.userData = elementData;
    neuronObj.userData.type = 'neuron';

    return neuronObj;
  }
}
