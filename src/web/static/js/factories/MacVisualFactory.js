// File: /static/js/factories/MacVisualFactory.js
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';
import { VisualFactory } from './VisualFactory.js';

export class MacVisualFactory extends VisualFactory {
  create(element, layerCenter, mac_spacing, layerIndex) {
    const group = new THREE.Group();

    // 1) Build hexagon path of radius 2.0
    const shape = this.drawShapePath(2.0, 6);

    // 2) Determine active state and colors
    const isActive = !!element.active;
    const fillColor   = isActive ? 0xFFB2B2 : 0xFFFFFF;
    const outlineColor= isActive ? 0xFF0000 : 0x0000FF;

    // 3) Create the fill mesh (z = -0.01, renderOrder 100)
    const fillMesh = this.createMesh(
      shape,
      { color: fillColor, transparent: false, side: THREE.DoubleSide, depthTest: true },
      -0.01,
      100
    );
    // store for dynamic updates
    Object.assign(fillMesh.userData, {
      isMacVisual: true,
      activeFillColor: 0xFFB2B2,
      inactiveFillColor: 0xFFFFFF
    });
    group.add(fillMesh);

    // 4) Create the outline loop (linewidth 1)
    const outlineLine = this.createOutline(
      shape,
      { color: outlineColor, linewidth: 1 },
      0,
      0
    );
    Object.assign(outlineLine.userData, {
      type: 'mac_outline',
      isMacVisual: true,
      activeOutlineColor:   0xFF0000,
      inactiveOutlineColor: 0x0000FF
    });
    group.add(outlineLine);

    // 5) Attach all the original metadata
    Object.assign(group.userData, element, {
      fillMesh,
      outlineLine,
      originalZ: element.z,
      type: 'mac',
      layerIndex,
      macIndex: element.macIndex,
      isMACGroup: true
    });

    // 6) Position relative to layer center
    group.position.set(
      element.x - layerCenter.x,
      (element.y - layerCenter.y) * mac_spacing,
      0
    );

    return group;
  }
}
