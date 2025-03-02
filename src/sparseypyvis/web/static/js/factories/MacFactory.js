import { BaseElementFactory } from './BaseElementFactory.js';
import { MacComposite } from '../composites/MacComposite.js';

export class MacFactory extends BaseElementFactory {
  createElement(elementData) {
    // Build the shape
    const shape = new THREE.Shape();
    this.drawHexagon(shape, 2.0);
    const fillGeometry = new THREE.ShapeGeometry(shape);

    // Fill material
    const isActive = (elementData.active === true || elementData.active === 1);
    const fillMaterial = new THREE.MeshBasicMaterial({
      color: 0xffcccc,
      transparent: true,
      opacity: isActive ? 1.0 : 0.0,
      side: THREE.DoubleSide
    });
    const fillMesh = new THREE.Mesh(fillGeometry, fillMaterial);
    fillMesh.position.z = -0.01;

    // Outline
    const points = shape.getPoints();
    const outlineGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const outlineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 });
    const outlineLine = new THREE.LineLoop(outlineGeometry, outlineMaterial);
    outlineLine.userData = { type: 'mac_outline' };

    // Return a MacComposite instead of raw THREE.Group
    return new MacComposite(elementData, fillMesh, outlineLine);
  }
}
