// File: /static/js/factories/NeuronVisualFactory.js
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';
import { VisualFactory } from './VisualFactory.js';

export class NeuronVisualFactory extends VisualFactory {
  create(element, layerCenter, mac_spacing) {
    // 1) Build the circular path (radius 0.10, 20 segments)
    const shape = this.drawShapePath(0.10, 14);

    // 2) Choose fill parameters based on active / previousActive
    let meshOpts, zOffset, renderOrder;
    if (element.active) {
      meshOpts = { color: 0x000000, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthTest: true };
      zOffset = 0.2; renderOrder = 10;
    } else {
      const fillColor = element.previousActive ? 0x808080 : 0xFFFFFF;
      meshOpts = { color: fillColor, transparent: false, opacity: 1.0, side: THREE.DoubleSide, depthTest: true };
      zOffset = 0; renderOrder = 5;
    }

    // 3) Create the filled mesh
    const obj = this.createMesh(shape, meshOpts, zOffset, renderOrder);

    // 4) Always add a thin black border on top
    const outline = this.createOutline(shape, { color: 0x000000, linewidth: 1 }, 0.001, 100);
    obj.add(outline);

    // 5) Assign userData exactly as before
    Object.assign(obj.userData, element, { type: 'neuron' });
    if (element.raw_activation !== undefined) obj.userData.raw_activation = element.raw_activation;
    if (element.avg_activation !== undefined) obj.userData.avg_activation = element.avg_activation;

    // 6) Position relative to layer center
    obj.position.set(
      element.x - layerCenter.x,
      (element.y - layerCenter.y) * mac_spacing,
      0
    );

    return obj;
  }
}
