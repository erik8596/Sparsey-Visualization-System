// File: /static/js/factories/VisualFactory.js
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';

export class VisualFactory {
  /**
   * Build a Shape consisting of a circle or regular polygon
   * @param {number} radius
   * @param {number} segments  number of sides or circle segments
   * @returns {THREE.Shape}
   */
  drawShapePath(radius, segments) {
    const shape = new THREE.Shape();
    for (let i = 0; i < segments; i++) {
      const angle = (2 * Math.PI / segments) * i;
      const x = radius * Math.cos(angle);
      const y = radius * Math.sin(angle);
      i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y);
    }
    shape.closePath();
    return shape;
  }

  /**
   * Create a filled Mesh from a shape
   * @param {THREE.Shape} shape
   * @param {{color:number, transparent?:boolean, opacity?:number, side?:*, depthTest?:boolean}} opts
   * @param {number} zOffset - offset in Z
   * @param {number} renderOrder
   */
  createMesh(shape, opts, zOffset = 0, renderOrder = 0) {
    const geom = new THREE.ShapeGeometry(shape);
    const mat = new THREE.MeshBasicMaterial({
      color: opts.color,
      transparent: opts.transparent || false,
      opacity: opts.opacity != null ? opts.opacity : 1,
      side: opts.side || THREE.DoubleSide,
      depthTest: opts.depthTest != null ? opts.depthTest : true
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.z = zOffset;
    mesh.renderOrder = renderOrder;
    return mesh;
  }

  /**
   * Create an outline LineLoop from a shape
   * @param {THREE.Shape} shape
   * @param {{color:number, linewidth?:number}} opts
   * @param {number} zOffset
   * @param {number} renderOrder
   */
  createOutline(shape, opts, zOffset = 0, renderOrder = 0) {
    const points = shape.getPoints();
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: opts.color,
      linewidth: opts.linewidth || 1
    });
    const outline = new THREE.LineLoop(geom, mat);
    outline.position.z = zOffset;
    outline.renderOrder = renderOrder;
    return outline;
  }
}
