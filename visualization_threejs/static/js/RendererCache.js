export class RendererCache {
    static getInstance() {
      if (!RendererCache.instance) {
        RendererCache.instance = new THREE.WebGLRenderer({ antialias: true });
        RendererCache.instance.setSize(200, 200);
        RendererCache.instance.setClearColor(0xffffff, 1);
      }
      return RendererCache.instance;
    }
  }
  