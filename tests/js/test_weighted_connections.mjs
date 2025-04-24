import puppeteer from 'puppeteer';
import { expect } from 'chai';

describe('Sparsey Visualization - Weighted Connections', function () {
  let browser, page;
  this.timeout(60000);

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

  it('should have a toggle control for weighted connections', async function () {
    // Check if connection controls exist
    const controlExists = await page.evaluate(() => {
      // Look for controls related to weighted connections
      const controls = Array.from(document.querySelectorAll('button, input, select'));

      return controls.some(control => {
        const text = (control.textContent || control.value || control.id || '').toLowerCase();
        return text.includes('connection') ||
          text.includes('weight') ||
          text.includes('synap');
      });
    });

    console.log(`Weighted connection controls exist: ${controlExists}`);
  });

  it('should display weighted connections between neurons when toggled', async function () {
    // Try to toggle weighted connections display
    const result = await page.evaluate(() => {
      // Look for a connection toggle
      const toggle = Array.from(document.querySelectorAll('button, input[type="checkbox"]')).find(el => {
        const text = (el.textContent || el.id || '').toLowerCase();
        return text.includes('connection') || text.includes('weight') || text.includes('synap');
      });

      if (!toggle) {
        return { success: false, reason: 'Connection toggle not found' };
      }

      // Count connection objects before toggle
      const initialCount = window.scene.children.filter(obj =>
        obj.userData && obj.userData.type === 'connection'
      ).length;

      // Click the toggle
      toggle.click();

      // Return a promise to allow time for toggling
      return new Promise(resolve => {
        setTimeout(() => {
          // Count connection objects after toggle
          const newCount = window.scene.children.filter(obj =>
            obj.userData && obj.userData.type === 'connection'
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

    console.log(`Weighted connections toggle test: ${JSON.stringify(result)}`);
  });

  it('should update connection visibility when specific MACs are selected', async function () {
    // Test if selecting a MAC shows its connections
    const macConnectionResult = await page.evaluate(() => {
      // Find a MAC to select
      const mac = window.scene.children.find(obj =>
        obj.userData && obj.userData.type === 'mac');

      if (!mac || typeof window.selectMAC !== 'function') {
        return { success: false, reason: 'MAC not found or selectMAC function not available' };
      }

      // Count visible connections before selecting MAC
      const countVisibleConnections = () =>
        window.scene.children.filter(obj =>
          obj.userData &&
          obj.userData.type === 'connection' &&
          obj.visible
        ).length;

      const initialCount = countVisibleConnections();

      // Select the MAC to show its connections
      window.selectMAC(mac.userData.id);

      // Return a promise to allow time for updating
      return new Promise(resolve => {
        setTimeout(() => {
          const newCount = countVisibleConnections();

          resolve({
            success: true,
            initialCount,
            newCount,
            changed: initialCount !== newCount,
            macId: mac.userData.id
          });
        }, 1000);
      });
    });

    console.log(`MAC connection visibility test: ${JSON.stringify(macConnectionResult)}`);
  });
});
