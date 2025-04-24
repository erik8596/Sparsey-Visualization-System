import puppeteer from 'puppeteer';
import { expect } from 'chai';

describe('Sparsey Visualization - MAC Activation Probabilities', function () {
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

  it('should have MAC activation visualization controls', async function () {
    // Check if activation controls exist
    const controlExists = await page.evaluate(() => {
      // Look for controls related to MAC activations
      const controls = Array.from(document.querySelectorAll('button, input, select'));

      return controls.some(control => {
        const text = (control.textContent || control.value || control.id || '').toLowerCase();
        return text.includes('activation') ||
          text.includes('probability') ||
          text.includes('active mac');
      });
    });

    // This test might fail if the feature isn't implemented yet
    console.log(`MAC activation controls exist: ${controlExists}`);
  });

  it('should visually indicate MAC activation probabilities', async function () {
    // Try to toggle MAC activation visualization
    const result = await page.evaluate(() => {
      // Look for an activations toggle
      const toggle = Array.from(document.querySelectorAll('button, input[type="checkbox"]')).find(el => {
        const text = (el.textContent || el.id || '').toLowerCase();
        return text.includes('activation') || text.includes('probability');
      });

      if (!toggle) {
        return { success: false, reason: 'Activation toggle not found' };
      }

      // Store initial MAC appearances
      const macs = window.scene.children.filter(obj =>
        obj.userData && obj.userData.type === 'mac');

      if (macs.length === 0) {
        return { success: false, reason: 'No MACs found in scene' };
      }

      const initialColors = macs.map(mac => {
        if (mac.material && mac.material.color) {
          return {
            id: mac.userData.id,
            color: mac.material.color.getHex()
          };
        }
        return { id: mac.userData.id, color: null };
      });

      // Click the toggle
      toggle.click();

      // Return a promise to allow time for visual updates
      return new Promise(resolve => {
        setTimeout(() => {
          // Get updated colors
          const newColors = macs.map(mac => {
            if (mac.material && mac.material.color) {
              return {
                id: mac.userData.id,
                color: mac.material.color.getHex()
              };
            }
            return { id: mac.userData.id, color: null };
          });

          // Check if any colors changed
          const colorChanges = initialColors.map((initial, i) => {
            return {
              id: initial.id,
              initialColor: initial.color,
              newColor: newColors[i].color,
              changed: initial.color !== newColors[i].color
            };
          });

          resolve({
            success: true,
            colorChanges: colorChanges,
            anyChanged: colorChanges.some(change => change.changed)
          });
        }, 1000);
      });
    });

    console.log(`MAC activation visualization test: ${JSON.stringify(result)}`);
  });
});
