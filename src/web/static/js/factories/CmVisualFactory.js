// File: /static/js/factories/CmVisualFactory.js
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';
import { VisualFactory } from './VisualFactory.js';

export class CmVisualFactory extends VisualFactory {
  create(element, layerCenter, mac_spacing) {
    // 1) Build the circle outline path (radius 0.4, 20 segments)
    const shape = this.drawShapePath(0.4, 14);

    // 2) Create only the outline (black, linewidth 2)
    const loop = this.createOutline(shape, { color: 0x000000, linewidth: 2 }, 0, 0);

    // 3) Assign metadata and position
    Object.assign(loop.userData, element, { type: 'cm' });
    loop.position.set(
      element.x - layerCenter.x,
      (element.y - layerCenter.y) * mac_spacing,
      0
    );

    return loop;
  }
}
