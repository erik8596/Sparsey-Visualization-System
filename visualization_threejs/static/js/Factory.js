export class ShapeFactory {
    static createHexagon(size, color = 0x000000, lineWidth = 1) {
      const shape = new THREE.Shape();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        const x = size * Math.cos(angle);
        const y = size * Math.sin(angle);
        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
      }
      shape.closePath();
      const points = shape.getPoints();
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ color, linewidth: lineWidth });
      return new THREE.LineLoop(geometry, material);
    }
  
    static createCircle(radius, segments = 20, color = 0x000000, lineWidth = 1) {
      const shape = new THREE.Shape();
      for (let i = 0; i < segments; i++) {
        const angle = (Math.PI * 2 / segments) * i;
        const x = radius * Math.cos(angle);
        const y = radius * Math.sin(angle);
        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
      }
      shape.closePath();
      const points = shape.getPoints();
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ color, linewidth: lineWidth });
      return new THREE.LineLoop(geometry, material);
    }
  }
  
  export class UIComponentFactory {
    static createMACCanvas(layer) {
      const containerDiv = document.createElement("div");
      containerDiv.classList.add("mac-canvas-wrapper");
      containerDiv.style.marginBottom = "10px";
      containerDiv.style.textAlign = "center";
  
      const label = document.createElement("p");
      label.textContent = `MAC Layer ${layer}`;
      label.style.margin = "0 0 5px 0";
      containerDiv.appendChild(label);
  
      const topCanvas = document.createElement("canvas");
      topCanvas.width = 200;
      topCanvas.height = 200;
      topCanvas.style.border = "2px solid #ccc";
      topCanvas.style.display = "block";
      topCanvas.style.margin = "0 auto";
      containerDiv.appendChild(topCanvas);
  
      const barGraphLabel = document.createElement("p");
      barGraphLabel.textContent = "MAC Activation Probabilities:";
      barGraphLabel.style.margin = "5px 0";
      barGraphLabel.style.fontStyle = "italic";
      containerDiv.appendChild(barGraphLabel);
  
      const barGraphScrollContainer = document.createElement("div");
      barGraphScrollContainer.style.width = "200px";
      barGraphScrollContainer.style.overflowX = "auto";
      barGraphScrollContainer.style.display = "block";
      barGraphScrollContainer.style.margin = "0 auto";
  
      const barGraphCanvas = document.createElement("canvas");
      barGraphCanvas.width = 800;
      barGraphCanvas.height = 100;
      barGraphCanvas.style.border = "1px solid #ccc";
      barGraphCanvas.style.marginTop = "5px";
      barGraphScrollContainer.appendChild(barGraphCanvas);
      containerDiv.appendChild(barGraphScrollContainer);
  
      return { containerDiv, topCanvas, barGraphCanvas };
    }
  }
  