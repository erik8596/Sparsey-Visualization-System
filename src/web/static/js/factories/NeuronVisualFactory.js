// File: /static/js/factories/NeuronVisualFactory.js
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';
import { VisualFactory } from './VisualFactory.js';

export class NeuronVisualFactory extends VisualFactory {
  create(element, layerCenter, mac_spacing) {
    // Draw circle with radius 0.10 using 20 segments
    const shape = new THREE.Shape();
    const segments = 20;
    for (let i = 0; i < segments; i++) {
      const angle = (2 * Math.PI / segments) * i;
      const x = 0.10 * Math.cos(angle);
      const y = 0.10 * Math.sin(angle);
      if (i === 0) {
        shape.moveTo(x, y);
      } else {
        shape.lineTo(x, y);
      }
    }
    shape.closePath();

    let obj;
    if (element.active) {
      // Active neuron: fill with black (0x000000) at 80% opacity
      const geom = new THREE.ShapeGeometry(shape);
      const color = new THREE.Color(0x000000); // Black fill
      const mat = new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
        depthTest: true  // Enable depthTest so they obey z-buffer
      });
      obj = new THREE.Mesh(geom, mat);
      // Push it a bit forward in z so it renders over other objects if needed
      obj.position.z += 0.2;
      obj.renderOrder = 10;
    } else {
      // Inactive neuron:
      // Use gray if it was previously active; otherwise, white.
      let fillColor;
      if (element.previousActive) {
        fillColor = new THREE.Color(0x808080); // Gray for previously active neurons.
      } else {
        fillColor = new THREE.Color(0xFFFFFF); // White for never active neurons.
      }
      const geom = new THREE.ShapeGeometry(shape);
      // Set the material opaque (no transparency) so it blocks underlying content.
      const mat = new THREE.MeshBasicMaterial({
        color: fillColor,
        side: THREE.DoubleSide,
        transparent: false,
        opacity: 1.0,
        depthTest: true
      });
      obj = new THREE.Mesh(geom, mat);
      obj.renderOrder = 5;
    }

    // Always add a black border (LineLoop) to the neuron.
    // This border will be drawn on top of the neuron mesh.
    const outlineGeom = new THREE.BufferGeometry().setFromPoints(shape.getPoints());
    const outlineMat = new THREE.LineBasicMaterial({
      color: 0x000000,  // Black border
      linewidth: 1
    });
    const outlineLine = new THREE.LineLoop(outlineGeom, outlineMat);
    outlineLine.position.z = 0.001; // a tiny offset
    outlineLine.renderOrder = 100; // Draw the border on top
    obj.add(outlineLine);

    // Assign metadata
    Object.assign(obj.userData, element, { type: 'neuron' });
    if (element.raw_activation !== undefined) {
      obj.userData.raw_activation = element.raw_activation;
    }
    if (element.avg_activation !== undefined) {
      obj.userData.avg_activation = element.avg_activation;
    }

    // Override the active state - let the activation data control this
    // This ensures we don't have active neurons before processing activation data
    // obj.userData.active = false;

    // Position the neuron relative to the layer centroid
    obj.position.set(
      element.x - layerCenter.x,
      (element.y - layerCenter.y) * mac_spacing,
      0
    );
    return obj;
  }

  // /**
  //  * Updates the appearance of a neuron based on its activation status.
  //  * @param {Object} neuronObj - The neuron object to update
  //  * @param {boolean} isActive - Whether the neuron is active
  //  */
  // updateAppearance(neuronObj, isActive) {
  //   if (!neuronObj) return;

  //   // Check if the neuron object itself is a mesh, otherwise look for a mesh child
  //   const neuronMesh = neuronObj.isMesh ? neuronObj : neuronObj.children.find(child => child.isMesh);

  //   if (!neuronMesh || !neuronMesh.material) {
  //     console.warn('Cannot update neuron appearance - no mesh or material found', neuronObj);
  //     return;
  //   }

  //   if (isActive) {
  //     // Active neuron: black fill at 80% opacity
  //     neuronMesh.material.color.set(0x000000);
  //     neuronMesh.material.transparent = true;
  //     neuronMesh.material.opacity = 0.8;
  //     neuronMesh.renderOrder = 10;
  //   } else {
  //     // Inactive: white or gray based on previous state
  //     const wasActive = neuronObj.userData.previousActive || false;
  //     const fillColor = wasActive ? 0x808080 : 0xFFFFFF; // Gray or white
  //     neuronMesh.material.color.set(fillColor);
  //     neuronMesh.material.transparent = false;
  //     neuronMesh.material.opacity = 1.0;
  //     neuronMesh.renderOrder = 5;
  //   }

  //   // Remember this state for future updates
  //   neuronObj.userData.previousActive = neuronObj.userData.previousActive || isActive;

  //   // Ensure the outline is always visible on top
  //   const outlineMesh = neuronObj.children.find(child =>
  //     child.isLine || child.isLineLoop || child.isLineSegments);

  //   if (outlineMesh) {
  //     outlineMesh.renderOrder = 100;
  //   }
  // }
}
