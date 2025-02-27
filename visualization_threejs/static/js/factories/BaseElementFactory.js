// /static/js/factories/BaseElementFactory.js
export class BaseElementFactory {
    createElement(elementData) {
      throw new Error("createElement() must be implemented by a subclass");
    }
  
    // Shared helpers
  
    drawHexagon(shape, size) {
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        const x = size * Math.cos(angle);
        const y = size * Math.sin(angle);
        if (i === 0) {
          shape.moveTo(x, y);
        } else {
          shape.lineTo(x, y);
        }
      }
      shape.closePath();
    }
  
    drawCircle(shape, radius) {
      const numSegments = 20;
      for (let i = 0; i < numSegments; i++) {
        const angle = (Math.PI * 2 / numSegments) * i;
        const x = radius * Math.cos(angle);
        const y = radius * Math.sin(angle);
        if (i === 0) {
          shape.moveTo(x, y);
        } else {
          shape.lineTo(x, y);
        }
      }
      shape.closePath();
    }
  }
  