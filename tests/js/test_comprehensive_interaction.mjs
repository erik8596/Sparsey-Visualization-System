import puppeteer from 'puppeteer';
import { expect } from 'chai';

describe('Sparsey Visualization - Comprehensive Interaction', function () {
  let browser, page;
  this.timeout(90000); // Longer timeout for comprehensive test

  // Common test utilities - similar to other test files
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
      await page.waitForSelector('#visualizeButton:not([disabled])');
      const [response] = await Promise.all([
        page.waitForResponse(res => res.url().includes('/visualize')),
        page.click('#visualizeButton')
      ]);

      await page.waitForFunction(() => {
        return window.scene && window.camera && window.renderer &&
          document.querySelector('#threejs-container canvas');
      }, { timeout: 20000 });
    }
  };

  before(async function () {
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

    // Setup the visualization
    await testUtils.waitForProjectLoad();
    await testUtils.selectProject();
    await testUtils.waitForRunsLoad();
    await testUtils.selectRun();
    await testUtils.initializeThreeJs();
  });

  after(async function () {
    if (browser) await browser.close();
  });

  it('should perform a sequence of interactions that demonstrate the full workflow', async function () {
    // Step 1: Record initial state
    const initialState = await page.evaluate(() => ({
      cameraPosition: {
        x: window.camera.position.x,
        y: window.camera.position.y,
        z: window.camera.position.z
      },
      objectCount: window.scene.children.length,
      macCount: window.scene.children.filter(obj =>
        obj.userData && obj.userData.type === 'mac'
      ).length
    }));

    console.log('Initial state:', initialState);
    expect(initialState.macCount).to.be.greaterThan(0, 'Should have MACs in the scene');

    // Step 2: Zoom in
    await page.evaluate(() => {
      document.querySelector('#threejs-container canvas')
        .dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true }));
    });
    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 3: Pan
    const canvasBounds = await page.evaluate(() => {
      const canvas = document.querySelector('#threejs-container canvas');
      const rect = canvas.getBoundingClientRect();
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      };
    });

    const startX = canvasBounds.x + canvasBounds.width / 2;
    const startY = canvasBounds.y + canvasBounds.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down({ button: 'left' });
    await page.mouse.move(startX + 50, startY + 50, { steps: 5 });
    await page.mouse.up({ button: 'left' });
    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 4: Select a MAC
    await page.evaluate(() => {
      const mac = window.scene.children.find(obj =>
        obj.userData && obj.userData.type === 'mac');

      if (mac && typeof window.selectMAC === 'function') {
        window.selectMAC(mac.userData.id);
      }
    });
    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 5: Toggle visualization features if available
    const toggleResults = await page.evaluate(() => {
      const results = {};

      // Try to find and toggle various features
      const features = ['activation', 'receptive', 'connection', 'weight'];

      for (const feature of features) {
        const toggle = Array.from(document.querySelectorAll('button, input[type="checkbox"]')).find(el => {
          const text = (el.textContent || el.value || el.id || '').toLowerCase();
          return text.includes(feature);
        });

        if (toggle) {
          toggle.click();
          results[feature] = 'toggled';
        } else {
          results[feature] = 'not found';
        }
      }

      return results;
    });

    console.log('Toggle results:', toggleResults);

    // Step 6: Rotate the view
    await page.mouse.move(startX, startY);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(startX + 70, startY, { steps: 5 });
    await page.mouse.up({ button: 'right' });
    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 7: Try to step through time if controls exist
    const timeStepResult = await page.evaluate(() => {
      const timeControl = document.querySelector('#timeline-controls');

      if (!timeControl) {
        return { success: false, reason: 'Timeline controls not found' };
      }

      const nextButton = Array.from(timeControl.querySelectorAll('button')).find(btn => {
        const text = btn.textContent.toLowerCase();
        return text.includes('next') || text.includes('forward') || text.includes('>');
      });

      if (nextButton) {
        nextButton.click();
        return { success: true, action: 'stepped forward' };
      }

      return { success: false, reason: 'Next button not found' };
    });

    console.log('Time step result:', timeStepResult);

    // Final state check
    const finalState = await page.evaluate(() => ({
      cameraPosition: {
        x: window.camera.position.x,
        y: window.camera.position.y,
        z: window.camera.position.z
      },
      objectCount: window.scene.children.length
    }));

    console.log('Final state:', finalState);

    // Verify state changes from interaction sequence
    expect(finalState.cameraPosition.x).to.not.equal(initialState.cameraPosition.x);
    expect(finalState.cameraPosition.y).to.not.equal(initialState.cameraPosition.y);
    expect(finalState.cameraPosition.z).to.not.equal(initialState.cameraPosition.z);
  });
});
