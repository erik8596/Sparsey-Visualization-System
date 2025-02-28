// A base class for composite nodes, extending THREE.Group.
export class CompositeNode extends THREE.Group {
    constructor() {
      super();
    }
  
    // Optionally, define methods like addChild, removeChild, toggleSelection, etc.
    addChild(child) {
      this.add(child);
    }
  
    removeChild(child) {
      this.remove(child);
    }
  }
  