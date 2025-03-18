import { describe, it, expect, beforeEach } from 'vitest';
import { VisualizationManager } from '../../static/js/visualization.js';

describe('Visualization Tests', () => {
  let visualizer;

  beforeEach(() => {
    visualizer = new VisualizationManager();
  });

  describe('Pan and Zoom', () => {
    it('should handle zoom in', () => {
      visualizer.zoom(1.2);
      expect(visualizer.scale).toBeGreaterThan(1);
    });

    it('should handle pan', () => {
      const startPos = { x: 0, y: 0 };
      visualizer.pan(100, 50);
      expect(visualizer.position).not.toEqual(startPos);
    });
  });

  describe('Graph Rendering', () => {
    it('should render nodes', () => {
      const nodes = [{ id: 1, position: { x: 0, y: 0 } }];
      visualizer.renderNodes(nodes);
      expect(visualizer.getNodes().length).toBe(1);
    });

    it('should update node positions', () => {
      const node = { id: 1, position: { x: 0, y: 0 } };
      visualizer.addNode(node);
      visualizer.updateNodePosition(1, { x: 100, y: 100 });
      expect(visualizer.getNodePosition(1)).toEqual({ x: 100, y: 100 });
    });
  });
});
