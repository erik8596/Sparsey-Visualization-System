// File: /static/js/factories/MacVisualFactory.js
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';
import { VisualFactory } from './VisualFactory.js';

export class MacVisualFactory extends VisualFactory {
  create(element, layerCenter, mac_spacing, layerIndex) {
    const group = new THREE.Group();

    // 1) Draw a hexagon shape of radius 2.0
    const shape = new THREE.Shape();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      const x = 2.0 * Math.cos(angle);
      const y = 2.0 * Math.sin(angle);
      if (i === 0) shape.moveTo(x, y);
      else         shape.lineTo(x, y);
    }
    shape.closePath();

    // 2) Define fill colors for active/inactive states
    const fillColorActive   = 0xFFB2B2; // pink
    const fillColorInactive = 0xFFFFFF; // white

    // 3) Determine if this MAC is active
    const isActive = !!element.active;

    // 4) Create the fill mesh
    const fillMat = new THREE.MeshBasicMaterial({
      color: isActive ? fillColorActive : fillColorInactive,
      transparent: false,
      side: THREE.DoubleSide,
      depthTest: true
    });
    const fillGeom = new THREE.ShapeGeometry(shape);
    const fillMesh = new THREE.Mesh(fillGeom, fillMat);
    fillMesh.position.z = -0.01;
    fillMesh.renderOrder = 100; // Render on top

    // Store fill colors for dynamic updates
    fillMesh.userData.isMacVisual = true;
    fillMesh.userData.activeFillColor   = fillColorActive;
    fillMesh.userData.inactiveFillColor = fillColorInactive;

    group.add(fillMesh);

    // 5) Create the outline mesh
    const outlineColorActive   = 0xFF0000; // red
    const outlineColorInactive = 0x0000FF; // blue
    const points = shape.getPoints();
    const outlineGeom = new THREE.BufferGeometry().setFromPoints(points);
    const outlineMat = new THREE.LineBasicMaterial({
      color: isActive ? outlineColorActive : outlineColorInactive,
      linewidth: 1
    });
    const outlineLine = new THREE.LineLoop(outlineGeom, outlineMat);

    // Store outline colors for dynamic updates
    outlineLine.userData.type                  = 'mac_outline';
    outlineLine.userData.isMacVisual           = true;
    outlineLine.userData.activeOutlineColor    = outlineColorActive;
    outlineLine.userData.inactiveOutlineColor  = outlineColorInactive;

    group.add(outlineLine);

    // 6) Attach metadata for step-based updates
    Object.assign(group.userData, element, {
      fillMesh,
      outlineLine,
      originalZ: element.z,
      type: 'mac',
      layerIndex,
      macIndex: element.macIndex,  // Ensure 'macIndex' is provided on element
      isMACGroup: true
    });

    // 7) Position relative to layer center
    group.position.set(
      element.x - layerCenter.x,
      (element.y - layerCenter.y) * mac_spacing,
      0
    );

    return group;
  }
}
