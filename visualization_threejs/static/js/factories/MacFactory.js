// /static/js/factories/MacFactory.js
import { BaseElementFactory } from './BaseElementFactory.js';

export class MacFactory extends BaseElementFactory {
  createElement(elementData) {
    // Create a group for the MAC
    const macGroup = new THREE.Group();
    macGroup.userData = elementData;
    macGroup.userData.type = 'mac';

    // 1) Fill shape
    const shape = new THREE.Shape();
    this.drawHexagon(shape, 2.0);
    const fillGeometry = new THREE.ShapeGeometry(shape);
    const isActive = (elementData.active === true || elementData.active === 1);
    const fillMaterial = new THREE.MeshBasicMaterial({
      color: 0xffcccc,
      transparent: true,
      opacity: isActive ? 1.0 : 0.0,
      side: THREE.DoubleSide
    });
    const fillMesh = new THREE.Mesh(fillGeometry, fillMaterial);
    fillMesh.position.z = -0.01;
    macGroup.add(fillMesh);

    // 2) Outline
    const points = shape.getPoints();
    const outlineGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const outlineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 });
    const outlineLine = new THREE.LineLoop(outlineGeometry, outlineMaterial);
    outlineLine.userData = { type: 'mac_outline' };
    macGroup.add(outlineLine);

    // 3) Additional userData
    macGroup.userData.outlineLine = outlineLine;
    macGroup.userData.fillMesh = fillMesh;
    macGroup.userData.originalZ = elementData.z;

    return macGroup;
  }
}
