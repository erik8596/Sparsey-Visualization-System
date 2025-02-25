import puppeteer from 'puppeteer';
import { expect } from 'chai';

describe('Sparsey Visualization Frontend', function () {
  let browser, page;

  // Common test utilities
  const testUtils = {
    async waitForProjectLoad() {
      await page.waitForFunction(() => {
        const select = document.getElementById('projectSelect');
        return select && !select.disabled && select.options.length > 1;
      }, { timeout: 15000 });
    },

    async selectProject(projectName = 'october_demo') {
      await page.select('#projectSelect', projectName);
      await new Promise(resolve => setTimeout(resolve, 2000));
    },

    async waitForRunsLoad() {
      await page.waitForFunction(() => {
        const select = document.getElementById('runSelect');
        return select && !select.disabled && select.options.length > 1;
      }, { timeout: 15000 });
    },

    async selectRun(runText = 'demonstration_run_1') {
      const runId = await page.evaluate((text) => {
        const select = document.getElementById('runSelect');
        const option = Array.from(select.options)
          .find(opt => opt.text === text);
        return option ? option.value : null;
      }, runText);

      if (!runId) throw new Error(`Run "${runText}" not found`);
      await page.select('#runSelect', runId);
      return runId;
    },

    async initializeThreeJs() {
      // Wait for visualize button and click
      await page.waitForSelector('#visualizeButton:not([disabled])');
      const [response] = await Promise.all([
        page.waitForResponse(res => res.url().includes('/visualize')),
        page.click('#visualizeButton')
      ]);

      if (response.status() !== 200) {
        throw new Error(`Visualization request failed: ${response.status()}`);
      }

      // Wait for Three.js initialization
      await page.waitForFunction(() => {
        const status = {
          hasCanvas: !!document.querySelector('#threejs-container canvas'),
          hasWebGL: !!document.querySelector('#threejs-container canvas')?.getContext('webgl'),
          hasScene: !!window.scene,
          hasCamera: !!window.camera,
          hasRenderer: !!window.renderer
        };
        return Object.values(status).every(v => v === true);
      }, { timeout: 30000, polling: 1000 });
    }
  };

  before(async function () {
    this.timeout(60000);

    try {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--enable-unsafe-webgl',
          '--use-gl=egl',
          '--disable-gpu-sandbox',
          '--ignore-gpu-blacklist',
          '--enable-webgl'
        ]
      });

      page = await browser.newPage();
      page.on('console', msg => console.log('Browser console:', msg.text()));
      page.on('pageerror', err => console.error('Page error:', err));

      await page.goto('http://localhost:5000/', {
        waitUntil: ['networkidle0', 'domcontentloaded'],
        timeout: 30000
      });
    } catch (error) {
      console.error('Browser setup failed:', error);
      throw error;
    }
  });

  after(async () => {
    if (browser) await browser.close();
  });

  // 1. Basic Page Load Test
  it('should load the index page with required elements', async function () {
    const elements = ['projectSelect', 'runSelect', 'visualizeButton', 'threejs-container']
      .map(id => page.$(`#${id}`));
    const results = await Promise.all(elements);
    results.forEach(element => expect(element).to.not.be.null);
  });

  // 2. Project Loading Test
  it('should load and enable project selection', async function () {
    await testUtils.waitForProjectLoad();
    const projectSelect = await page.$eval('#projectSelect', el => ({
      disabled: el.disabled,
      options: Array.from(el.options).length
    }));
    expect(projectSelect.disabled).to.be.false;
    expect(projectSelect.options).to.be.greaterThan(1);
  });

  // 3. Run Selection Disabled Initially
  it('should have run selection disabled before project selection', async function () {
    const isDisabled = await page.$eval('#runSelect', el => el.disabled);
    expect(isDisabled).to.be.true;
  });

  // 4. Project Selection Enables Runs
  it('should enable run selection after choosing project', async function () {
    await testUtils.selectProject('october_demo');
    await testUtils.waitForRunsLoad();
    const runSelect = await page.$eval('#runSelect', el => ({
      disabled: el.disabled,
      options: Array.from(el.options).length
    }));
    expect(runSelect.disabled).to.be.false;
    expect(runSelect.options).to.be.greaterThan(1);
  });

  // 5. Run Selection Test
  it('should allow selecting a run after project is chosen', async function () {
    const runId = await testUtils.selectRun('demonstration_run_1');
    expect(runId).to.not.be.null;
    const visualizeButton = await page.$eval('#visualizeButton',
      button => !button.disabled
    );
    expect(visualizeButton).to.be.true;
  });

  // 6. Visualize Button Test
  it('should enable visualization after project and run selection', async function () {
    await page.waitForSelector('#visualizeButton:not([disabled])');
    const [response] = await Promise.all([
      page.waitForResponse(res => res.url().includes('/visualize')),
      page.click('#visualizeButton')
    ]);
    expect(response.status()).to.equal(200);

    // Verify canvas creation
    await page.waitForSelector('#threejs-container canvas', {
      visible: true,
      timeout: 5000
    });
    const hasCanvas = await page.$eval('#threejs-container canvas',
      el => el instanceof HTMLCanvasElement
    );
    expect(hasCanvas).to.be.true;
  });

  // Three.js Tests
  // describe('Three.js Visualization', function () {
  //   before(async function () {
  //     this.timeout(60000);
  //     await testUtils.waitForProjectLoad();
  //     await testUtils.selectProject();
  //     await testUtils.waitForRunsLoad();
  //     await testUtils.selectRun();
  //     await testUtils.initializeThreeJs();
  //   });

  //   it('should have proper WebGL context', async function () {
  //     const webglStatus = await page.evaluate(() => {
  //       const canvas = document.querySelector('#threejs-container canvas');
  //       const gl = canvas?.getContext('webgl');
  //       return {
  //         hasCanvas: !!canvas,
  //         hasContext: !!gl,
  //         contextAttributes: gl?.getContextAttributes()
  //       };
  //     });
  //     expect(webglStatus.hasCanvas).to.be.true;
  //     expect(webglStatus.hasContext).to.be.true;
  //   });

  //   // Camera Control Tests
  //   describe('Camera Controls', function () {
  //     it('should handle zoom in', async function () {
  //       const initialZ = await page.evaluate(() => window.camera.position.z);
  //       await page.evaluate(() => {
  //         document.querySelector('#threejs-container canvas')
  //           .dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true }));
  //       });
  //       await new Promise(resolve => setTimeout(resolve, 500));
  //       const newZ = await page.evaluate(() => window.camera.position.z);
  //       expect(newZ).to.be.lessThan(initialZ);
  //     });

  //     it('should handle zoom out', async function () {
  //       const initialZ = await page.evaluate(() => window.camera.position.z);
  //       await page.evaluate(() => {
  //         document.querySelector('#threejs-container canvas')
  //           .dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true }));
  //       });
  //       await new Promise(resolve => setTimeout(resolve, 500));
  //       const newZ = await page.evaluate(() => window.camera.position.z);
  //       expect(newZ).to.be.greaterThan(initialZ);
  //     });
  //   });
  // });

  // Visualization Flow Tests
  describe('Visualization Flow', function () {
    before(async function () {
      this.timeout(60000);
      // Setup project and run selection
      await testUtils.waitForProjectLoad();
      await testUtils.selectProject('october_demo');
      await testUtils.waitForRunsLoad();
      await testUtils.selectRun('demonstration_run_1');
    });

    it('should load and display the visualization', async function () {
      // 1. Click visualize and verify server response
      const [response] = await Promise.all([
        page.waitForResponse(res => res.url().includes('/visualize')),
        page.click('#visualizeButton')
      ]);
      expect(response.status()).to.equal(200);

      // 2. Wait for canvas to be created
      await page.waitForSelector('#threejs-container canvas', {
        visible: true,
        timeout: 10000
      });

      // 3. Verify that the visualization is actually rendered
      const visualizationStatus = await page.evaluate(() => ({
        hasCanvas: !!document.querySelector('#threejs-container canvas'),
        hasVisibleContent: !!window.scene?.children.length,
        cameraPosition: window.camera?.position || null
      }));

      expect(visualizationStatus.hasCanvas).to.be.true;
      expect(visualizationStatus.hasVisibleContent).to.be.true;
      expect(visualizationStatus.cameraPosition).to.not.be.null;
    });

    it('should respond to user interaction', async function () {
      // Wait a bit for everything to stabilize
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Try to zoom in and verify camera moves
      const initialZ = await page.evaluate(() => window.camera.position.z);

      await page.evaluate(() => {
        document.querySelector('#threejs-container canvas')
          .dispatchEvent(new WheelEvent('wheel', {
            deltaY: -100,
            bubbles: true
          }));
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      const newZ = await page.evaluate(() => window.camera.position.z);
      expect(newZ).to.be.lessThan(initialZ);
    });
  });
});
