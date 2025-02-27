import { UIManager } from './UIManager.js';

export class EventManager {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    window.addEventListener('macClick', (e) => this.onMACClick(e.detail.macGroup));
    window.addEventListener('resetMACs', () => this.resetSelections());
  }

  onMACClick(macGroup) {
    if (macGroup.userData.isSelected) {
      this.deselectMAC(macGroup);
    } else {
      this.selectMAC(macGroup);
    }
    UIManager.updateMACDetails(macGroup);
  }

  selectMAC(macGroup) {
    macGroup.userData.outlineLine.material.color.set(0x008000);
    macGroup.position.z = macGroup.userData.originalZ + 0.5;
    macGroup.userData.isSelected = true;
    this.sceneManager.selectedMACs.push(macGroup);
    if (!macGroup.userData.canvasWrapper) {
      macGroup.userData.canvasWrapper = UIManager.createMACCanvas(macGroup);
    } else {
      macGroup.userData.canvasWrapper.style.display = "block";
    }
  }

  deselectMAC(macGroup) {
    macGroup.userData.outlineLine.material.color.set(0x000000);
    macGroup.position.z = macGroup.userData.originalZ;
    macGroup.userData.isSelected = false;
    const index = this.sceneManager.selectedMACs.indexOf(macGroup);
    if (index !== -1) {
      this.sceneManager.selectedMACs.splice(index, 1);
    }
    if (macGroup.userData.canvasWrapper) {
      macGroup.userData.canvasWrapper.style.display = "none";
    }
  }

  resetSelections() {
    this.sceneManager.selectedMACs.forEach(macGroup => {
      if (macGroup.userData.isSelected) {
        macGroup.userData.outlineLine.material.color.set(0x000000);
        macGroup.position.z = macGroup.userData.originalZ;
        macGroup.userData.isSelected = false;
      }
    });
    this.sceneManager.selectedMACs = [];
    UIManager.clearMACDetails();
    UIManager.clearSidePanel();
    // Optionally, remove any stored canvasWrapper references:
    this.sceneManager.clickableMACs.forEach(macGroup => {
      macGroup.userData.canvasWrapper = null;
    });
  }
}
