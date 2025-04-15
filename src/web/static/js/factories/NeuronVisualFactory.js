// File: /static/js/factories/NeuronVisualFactory.js
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';
import { VisualFactory } from './VisualFactory.js';

export class NeuronVisualFactory extends VisualFactory {
  create(element, layerCenter, mac_spacing) {
    // Draw circle radius 0.10
    const shape = new THREE.Shape();
    const segments = 20;
    for (let i = 0; i < segments; i++) {
      const angle = (2 * Math.PI / segments) * i;
      const x = 0.10 * Math.cos(angle), y = 0.10 * Math.sin(angle);
      if (i === 0) shape.moveTo(x, y);
      else        shape.lineTo(x, y);
    }
    shape.closePath();

    let obj;
    if (element.active) {
      const geom = new THREE.ShapeGeometry(shape);
      const color = new THREE.Color(0, element.raw_activation || 0, 0);
      const mat   = new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
        depthTest: false
      });
      obj = new THREE.Mesh(geom, mat);
      obj.position.z += 0.2;
      obj.renderOrder = 10;
    } else {
      const geom = new THREE.BufferGeometry().setFromPoints(shape.getPoints());
      const mat  = new THREE.LineBasicMaterial({
        color: 0x000000,
        linewidth: 1,
        transparent: true,
        opacity: 0.2
      });
      obj = new THREE.LineLoop(geom, mat);
    }

    Object.assign(obj.userData, element, { type: 'neuron' });
    if (element.raw_activation !== undefined) obj.userData.raw_activation = element.raw_activation;
    if (element.avg_activation !== undefined) obj.userData.avg_activation = element.avg_activation;

    obj.position.set(
      element.x - layerCenter.x,
      (element.y - layerCenter.y) * mac_spacing,
      0
    );
    return obj;
  }
}
