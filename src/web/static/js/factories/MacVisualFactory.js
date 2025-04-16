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
      const x = 2.0 * Math.cos(angle);
      const y = 2.0 * Math.sin(angle);
      if (i === 0) shape.moveTo(x, y);
      else         shape.lineTo(x, y);
    }
    shape.closePath();

    // Determine active vs inactive
    const isActive = !!element.active;

    // For MACs, we want them to be opaque (so nothing underneath shows)
    // Active MACs: pink fill (0xFFB2B2)
    // Inactive MACs: white fill (0xFFFFFF)
    const fillColor = isActive ? 0xFFB2B2 : 0xFFFFFF;
    const fillMat = new THREE.MeshBasicMaterial({
      color: fillColor,
      transparent: false, // fully opaque
      side: THREE.DoubleSide,
      depthTest: true  // Ensure depth testing is on.
    });
    const fillGeom = new THREE.ShapeGeometry(shape);
    const fillMesh = new THREE.Mesh(fillGeom, fillMat);
    fillMesh.userData.isMacVisual = true;
    fillMesh.position.z = -0.01;
    fillMesh.renderOrder = 100; // Ensure MAC fill renders on top
    group.add(fillMesh);

    // Outline color: active => red, inactive => blue
    const outlineColor = isActive ? 0xFF0000 : 0x0000FF;
    const pts = shape.getPoints();
    const outlineGeom = new THREE.BufferGeometry().setFromPoints(pts);
    const outlineMat = new THREE.LineBasicMaterial({
      color: outlineColor,
      linewidth: 1
    });
    const outlineLine = new THREE.LineLoop(outlineGeom, outlineMat);

    // Store the original outline color in userData so it can be restored later
    outlineLine.userData = {
      type: 'mac_outline',
      isMacVisual: true,
      originalOutlineColor: outlineColor
    };

    group.add(outlineLine);

    // Metadata assignment
    Object.assign(group.userData, element, {
      outlineLine,
      fillMesh,
      originalZ: element.z,
      type: 'mac',
      layerIndex,
      isMACGroup: true
    });

    // Position relative to the layer centroid
    group.position.set(
      element.x - layerCenter.x,
      (element.y - layerCenter.y) * mac_spacing,
      0
    );

    return group;
  }
}
