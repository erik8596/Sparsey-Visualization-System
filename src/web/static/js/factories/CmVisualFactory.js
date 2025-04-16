// File: /static/js/factories/CmVisualFactory.js
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';
import { VisualFactory } from './VisualFactory.js';

export class CmVisualFactory extends VisualFactory {
  create(element, layerCenter, mac_spacing) {
    // Draw circle radius 0.4
    const shape = new THREE.Shape();
    const segments = 20;
    for (let i = 0; i < segments; i++) {
      const angle = (2 * Math.PI / segments) * i;
      const x = 0.4 * Math.cos(angle), y = 0.4 * Math.sin(angle);
      if (i === 0) shape.moveTo(x, y);
      else        shape.lineTo(x, y);
    }
    shape.closePath();

    const geom = new THREE.BufferGeometry().setFromPoints(shape.getPoints());
    const mat  = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
    const loop = new THREE.LineLoop(geom, mat);

    Object.assign(loop.userData, element, { type: 'cm' });
    loop.position.set(
      element.x - layerCenter.x,
      (element.y - layerCenter.y) * mac_spacing,
      0
    );
    return loop;
  }
}
