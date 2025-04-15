// File: /static/js/factories/MacVisualFactory.js
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';
import { VisualFactory } from './VisualFactory.js';

export class MacVisualFactory extends VisualFactory {
  create(element, layerCenter, mac_spacing, layerIndex) {
    const group = new THREE.Group();

    // Draw a hexagon shape of radius 2.0
    const shape = new THREE.Shape();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      const x = 2.0 * Math.cos(angle), y = 2.0 * Math.sin(angle);
      if (i === 0) shape.moveTo(x, y);
      else        shape.lineTo(x, y);
    }
    shape.closePath();

    // Fill mesh
    const fillGeom = new THREE.ShapeGeometry(shape);
    const isActive = !!element.active;
    const fillMat = new THREE.MeshBasicMaterial({
      color: isActive ? new THREE.Color(1, 0, 0) : new THREE.Color(0xcccccc),
      transparent: true,
      opacity: isActive ? 0.8 : 0.2,
      side: THREE.DoubleSide
    });
    const fillMesh = new THREE.Mesh(fillGeom, fillMat);
    fillMesh.userData.isMacVisual = true;
    fillMesh.position.z = -0.01;
    group.add(fillMesh);

    // Outline
    const pts = shape.getPoints();
    const outlineGeom = new THREE.BufferGeometry().setFromPoints(pts);
    const outlineMat  = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 });
    const outlineLine = new THREE.LineLoop(outlineGeom, outlineMat);
    outlineLine.userData = { type: 'mac_outline', isMacVisual: true };
    group.add(outlineLine);

    // Metadata
    Object.assign(group.userData, element, {
      outlineLine,
      fillMesh,
      originalZ: element.z,
      type: 'mac',
      layerIndex,
      isMACGroup: true
    });

    // Position relative to layer centroid
    group.position.set(
      element.x - layerCenter.x,
      (element.y - layerCenter.y) * mac_spacing,
      0
    );

    return group;
  }
}
