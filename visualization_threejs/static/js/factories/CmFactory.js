// /static/js/factories/CmFactory.js
import { BaseElementFactory } from './BaseElementFactory.js';

export class CmFactory extends BaseElementFactory {
  createElement(elementData) {
    const cmShape = new THREE.Shape();
    const scale = elementData.scale || 1;
    this.drawHexagon(cmShape, 0.5 * scale);

    const points = cmShape.getPoints();
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0x0000FF, linewidth: 2 });
    const cmObj = new THREE.LineLoop(geometry, material);

    cmObj.userData = elementData;
    cmObj.userData.type = 'cm';

    return cmObj;
  }
}
