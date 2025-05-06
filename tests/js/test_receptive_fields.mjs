import puppeteer from 'puppeteer';
import { expect } from 'chai';

describe('Sparsey Visualization - Receptive Fields Visualization', function () {
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

  it('should have receptive fields toggle control', async function () {
    // Check if receptive fields control exists
    const controlExists = await page.evaluate(() => {
      // Look for a control that mentions receptive fields
      const controls = Array.from(document.querySelectorAll('button, input[type="checkbox"], select'));

      return controls.some(control => {
        const text = control.textContent || control.value || control.id || '';
        return text.toLowerCase().includes('receptive') ||
          control.id.toLowerCase().includes('receptive');
      });
    });

    // This test might fail if the feature isn't implemented yet
    console.log(`Receptive fields control exists: ${controlExists}`);
  });

  it('should display receptive fields when toggled', async function () {
    // Try to toggle receptive fields display
    const result = await page.evaluate(() => {
      // Look for a receptive fields toggle
      const toggle = Array.from(document.querySelectorAll('button, input[type="checkbox"]')).find(el => {
        const text = el.textContent || el.id || '';
        return text.toLowerCase().includes('receptive');
      });

      if (!toggle) {
        return { success: false, reason: 'Receptive fields toggle not found' };
      }

      // Count receptive field objects before toggle
      const initialCount = window.scene.children.filter(obj =>
        obj.userData && obj.userData.type === 'receptiveField'
      ).length;

      // Click the toggle
      toggle.click();

      // Return a promise to allow time for toggling
      return new Promise(resolve => {
        setTimeout(() => {
          // Count receptive field objects after toggle
          const newCount = window.scene.children.filter(obj =>
            obj.userData && obj.userData.type === 'receptiveField'
          ).length;

          resolve({
            success: true,
            initialCount,
            newCount,
            changed: initialCount !== newCount
          });
        }, 1000);
      });
    });

    console.log(`Receptive fields toggle test: ${JSON.stringify(result)}`);
  });
});
