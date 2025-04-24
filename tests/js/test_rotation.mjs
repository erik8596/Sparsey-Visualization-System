import puppeteer from 'puppeteer';
import { expect } from 'chai';

describe('Sparsey Visualization - Rotation Navigation', function () {
  let browser, page;
  this.timeout(60000);

  // Utility functions (same as previous tests)
  const testUtils = {
    // Include your existing utility methods
    // ...
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
        const option = Array.from(select.options).find(opt => opt.text === text);
        return option ? option.value : null;
      }, runText);
      if (!runId) throw new Error(`Run "${runText}" not found`);
      await page.select('#runSelect', runId);
      return runId;
    },

    async initializeThreeJs() {
      await page.waitForSelector('#visualizeButton:not([disabled])');
      const [response] = await Promise.all([
        page.waitForResponse(res => res.url().includes('/visualize')),
        page.click('#visualizeButton')
      ]);

      // Wait for Three.js initialization
      await page.waitForFunction(() => {
        return window.scene && window.camera && window.renderer &&
          document.querySelector('#threejs-container canvas');
      }, { timeout: 20000 });
    }
  };

  before(async function () {
    // Same setup as previous test
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-unsafe-webgl']
    });

    page = await browser.newPage();
    page.on('console', msg => console.log('Browser console:', msg.text()));

    await page.goto('http://localhost:5000/', {
      waitUntil: ['networkidle0', 'domcontentloaded'],
      timeout: 30000
    });

    await testUtils.waitForProjectLoad();
    await testUtils.selectProject();
    await testUtils.waitForRunsLoad();
    await testUtils.selectRun();
    await testUtils.initializeThreeJs();
  });

  after(async function () {
    if (browser) await browser.close();
  });

  it('should rotate camera when dragging with right mouse button', async function () {
    // Record initial camera rotation
    const initialRotation = await page.evaluate(() => {
      if (!window.camera) return null;

      return {
        x: window.camera.rotation.x,
        y: window.camera.rotation.y,
        z: window.camera.rotation.z
      };
    });

    expect(initialRotation).to.not.be.null;

    // Simulate right-click drag to rotate
    const canvas = await page.$('#threejs-container canvas');
    const canvasBounds = await page.evaluate(canvas => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      };
    }, canvas);

    // Start at center, move to right
    const startX = canvasBounds.x + canvasBounds.width / 2;
    const startY = canvasBounds.y + canvasBounds.height / 2;
    const endX = startX + 100;  // Drag 100px right
    const endY = startY;

    // Right mouse button is button 2
    await page.mouse.move(startX, startY);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(endX, endY, { steps: 10 });
    await page.mouse.up({ button: 'right' });

    // Wait for rotation to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // Get new rotation
    const newRotation = await page.evaluate(() => {
      if (!window.camera) return null;

      return {
        x: window.camera.rotation.x,
        y: window.camera.rotation.y,
        z: window.camera.rotation.z
      };
    });

    expect(newRotation).to.not.be.null;

    // At least one rotation component should change
    const rotationChanged =
      newRotation.x !== initialRotation.x ||
      newRotation.y !== initialRotation.y ||
      newRotation.z !== initialRotation.z;

    console.log('Initial rotation:', initialRotation);
    console.log('New rotation:', newRotation);

    expect(rotationChanged).to.be.true;
  });
});
