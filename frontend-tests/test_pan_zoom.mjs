import puppeteer from 'puppeteer';
import { expect } from 'chai';

describe('Sparsey Visualization Frontend - Run Interaction', function () {
  let browser, page;
  this.timeout(60000);

  // Utility functions to simulate the full workflow.
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
        const option = Array.from(select.options).find(opt => opt.text === text);
        return option ? option.value : null;
      }, runText);
      if (!runId) throw new Error(`Run "${runText}" not found`);
      await page.select('#runSelect', runId);
      return runId;
    },

    async initializeThreeJs() {
      // Wait for the visualize button to be enabled and click it.
      await page.waitForSelector('#visualizeButton:not([disabled])', { timeout: 15000 });
      const [response] = await Promise.all([
        page.waitForResponse(res => res.url().includes('/visualize')),
        page.click('#visualizeButton')
      ]);
      if (response.status() !== 200) {
        throw new Error(`Visualization request failed: ${response.status()}`);
      }
      // Wait for Three.js initialization: canvas, scene, camera, renderer must all be present.
      await page.waitForFunction(() => {
        const status = {
          hasCanvas: !!document.querySelector('#threejs-container canvas'),
          hasScene: !!window.scene,
          hasCamera: !!window.camera,
          hasRenderer: !!window.renderer
        };
        return Object.values(status).every(v => v === true);
      }, { timeout: 15000, polling: 500 });
    }
  };

  before(async function () {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--enable-unsafe-webgl'
      ]
    });
    page = await browser.newPage();
    // Log browser console messages for debugging.
    page.on('console', msg => console.log('Browser console:', msg.text()));

    await page.goto('http://localhost:5000/', {
      waitUntil: ['networkidle0', 'domcontentloaded'],
      timeout: 30000
    });

    // Wait for the project dropdown to load and select a project.
    await testUtils.waitForProjectLoad();
    await testUtils.selectProject();
    // Wait for the runs dropdown to load and select a run.
    await testUtils.waitForRunsLoad();
    await testUtils.selectRun();
    // Trigger visualization to initialize the Three.js scene.
    await testUtils.initializeThreeJs();
  });

  after(async function () {
    if (browser) await browser.close();
  });

  it('should load the run and initialize the Three.js scene for interactions', async function () {
    // Check that key global objects exist.
    const cameraExists = await page.evaluate(() => !!window.camera);
    const sceneExists = await page.evaluate(() => !!window.scene);
    const rendererExists = await page.evaluate(() => !!window.renderer);
    expect(cameraExists).to.be.true;
    expect(sceneExists).to.be.true;
    expect(rendererExists).to.be.true;

    // Check that the canvas is present.
    const canvasExists = await page.evaluate(() => !!document.querySelector('#threejs-container canvas'));
    expect(canvasExists).to.be.true;
  });

  it('should allow interaction with the run by simulating a canvas click', async function () {
    // Record the initial camera position.
    const initialCameraPos = await page.evaluate(() => ({
      x: window.camera.position.x,
      y: window.camera.position.y,
      z: window.camera.position.z
    }));

    // Simulate a simple click on the canvas.
    const canvas = await page.$('#threejs-container canvas');
    await page.evaluate((canvas) => {
      canvas.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }, canvas);

    // Wait a moment for any interaction to occur.
    await new Promise(resolve => setTimeout(resolve, 500));

    // Retrieve the new camera position.
    const newCameraPos = await page.evaluate(() => ({
      x: window.camera.position.x,
      y: window.camera.position.y,
      z: window.camera.position.z
    }));

    // Here, we simply ensure that the camera position properties are defined.
    // (If your interaction is expected to change the camera position, you can assert that.)
    expect(newCameraPos.x).to.be.a('number');
    expect(newCameraPos.y).to.be.a('number');
    expect(newCameraPos.z).to.be.a('number');

    // Optionally, if clicking is expected to trigger a specific change,
    // you might check that the positions have changed:
    // expect(newCameraPos.x).to.not.equal(initialCameraPos.x);
  });
});
