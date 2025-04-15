// File: /static/js/ConnectionRenderer.js

export class ConnectionRenderer {
    /**
     * @param {THREE.Scene} scene
     * @param {Object.<string, Array<THREE.Object3D>>} macLookup
     */
    constructor(scene, macLookup) {
      this.scene     = scene;
      this.macLookup = macLookup;
      this.lines     = [];
      this.threshold = 0.01;
    }
  
    clear() {
      this.lines.forEach(line => this.scene.remove(line));
      this.lines = [];
    }
  
    /**
     * @param {Array<{src:string, dst:string, weight:number}>} connections
     */
    renderEdgeList(connections) {
      this.clear();
      connections.forEach(({ src, dst, weight }) => {
        if (Math.abs(weight) < this.threshold) return;
        const [srcLayer, srcIdx] = src.split(':').map(Number);
        const [dstLayer, dstIdx] = dst.split(':').map(Number);
        const srcMac = this.macLookup[srcLayer]?.[srcIdx];
        const dstMac = this.macLookup[dstLayer]?.[dstIdx];
        if (!srcMac || !dstMac) return;
        this._addLine(srcMac, dstMac, weight);
      });
    }
  
    _addLine(srcGroup, dstGroup, weight) {
      // Get world positions
      const srcPos = new THREE.Vector3();
      const dstPos = new THREE.Vector3();
      srcGroup.getWorldPosition(srcPos);
      dstGroup.getWorldPosition(dstPos);
  
      // Midpoint elevated for arch
      const mid = srcPos.clone().lerp(dstPos, 0.5);
      mid.z += srcPos.distanceTo(dstPos) * 0.2;
  
      // Quadratic curve
      const curve  = new THREE.QuadraticBezierCurve3(srcPos, mid, dstPos);
      const points = curve.getPoints(20);
      const geom   = new THREE.BufferGeometry().setFromPoints(points);
  
      // Color & opacity
      const absW  = Math.min(Math.abs(weight), 1);
      const color = weight >= 0
        ? new THREE.Color(0, absW, 0)
        : new THREE.Color(absW, 0, 0);
  
      const mat = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: absW * 0.8 + 0.2
      });
  
      const line = new THREE.Line(geom, mat);
      this.scene.add(line);
      this.lines.push(line);
    }
  }  