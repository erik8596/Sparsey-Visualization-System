import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const testDir = './tests/js';
const integrationTestFiles = [
  'test_mac_toggle.mjs',
  'test_temporal_navigation.mjs',
  'test_rotation.mjs',
  'test_receptive_fields.mjs',
  'test_mac_activations.mjs',
  'test_weighted_connections.mjs',
  'test_comprehensive_interaction.mjs'
];

async function runTest(testFile) {
  console.log(`\n========== Running ${testFile} ==========\n`);

  return new Promise((resolve) => {
    const testProcess = spawn('npx', ['mocha', '--timeout', '60000', path.join(testDir, testFile)], {
      stdio: 'inherit'
    });

    testProcess.on('close', (code) => {
      console.log(`\n========== ${testFile} finished with code ${code} ==========\n`);
      resolve(code === 0);
    });
  });
}

async function main() {
  console.log('Starting Sparsey Visualization System integration tests...');

  let allPassed = true;
  const results = {};

  for (const testFile of integrationTestFiles) {
    const filePath = path.join(testDir, testFile);

    if (fs.existsSync(filePath)) {
      const passed = await runTest(testFile);
      results[testFile] = passed;

      if (!passed) {
        allPassed = false;
      }
    } else {
      console.error(`Warning: Test file ${filePath} does not exist, skipping.`);
      results[testFile] = 'SKIPPED';
    }
  }

  console.log('\n========== Integration Test Summary ==========');
  for (const [test, result] of Object.entries(results)) {
    console.log(`${test}: ${result === true ? '✅ PASSED' : result === 'SKIPPED' ? '⚠️ SKIPPED' : '❌ FAILED'}`);
  }

  process.exit(allPassed ? 0 : 1);
}

main().catch(err => {
  console.error('Error running tests:', err);
  process.exit(1);
});
