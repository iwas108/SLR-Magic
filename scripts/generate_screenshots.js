const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ssDir = path.join(__dirname, '..', 'docs', 'ss');
if (!fs.existsSync(ssDir)) {
  fs.mkdirSync(ssDir, { recursive: true });
}

async function capture() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 2,
  });

  const page = await context.newPage();

  // Helper function to safely click text
  async function safeClick(selectorText) {
    try {
      const el = page.locator(`text="${selectorText}"`).first();
      if (await el.isVisible({ timeout: 2000 })) {
        await el.click();
        await page.waitForTimeout(1000);
        return true;
      }
    } catch (e) {
      console.log(`Could not click "${selectorText}": ${e.message}`);
    }
    return false;
  }

  // 1. Ingestion Hub
  console.log('Taking 01-ingestion-hub.png...');
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(2000);
  await safeClick('Ingestion Hub');
  await page.screenshot({ path: path.join(ssDir, '01-ingestion-hub.png') });

  // 2. 4-Stage LLM Screening Pipeline
  console.log('Taking 02-llm-pipeline.png...');
  await safeClick('LLM Operations Pipeline');
  await page.screenshot({ path: path.join(ssDir, '02-llm-pipeline.png') });

  // 3. Double-Blind Calibration Sandbox
  console.log('Taking 03-calibration-sandbox.png...');
  await safeClick('Statistics');
  await page.screenshot({ path: path.join(ssDir, '03-calibration-sandbox.png') });

  // 4. Wide Cohort Table View
  console.log('Taking 04-cohort-table.png...');
  await safeClick('Raw Data');
  await page.screenshot({ path: path.join(ssDir, '04-cohort-table.png') });

  // 5. Inter-Rater SPA: Blinded Reviewer Workspace
  console.log('Taking 05-inter-rater-blinded.png...');
  await page.goto('http://localhost:3001', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(2000);
  const reviewBtn = page.locator('button:has-text("Review"), button:has-text("Start"), button:has-text("Prescreen"), button:has-text("Continue")').first();
  if (await reviewBtn.isVisible({ timeout: 2000 })) {
    await reviewBtn.click();
    await page.waitForTimeout(1000);
  }
  await page.screenshot({ path: path.join(ssDir, '05-inter-rater-blinded.png') });

  // 6. Inter-Rater SPA: Cohen's Kappa Metrics & Discrepancy Matrix
  console.log('Taking 06-inter-rater-agreement.png...');
  await page.goto('http://localhost:3001', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(ssDir, '06-inter-rater-agreement.png') });

  // 7. SLR Viewer: Interactive PRISMA 2020 Flowchart Canvas
  console.log('Taking 07-prisma-canvas.png...');
  await page.goto('http://localhost:3002', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(2000);
  await safeClick('Research Workflow');
  await page.screenshot({ path: path.join(ssDir, '07-prisma-canvas.png') });

  // 8. SLR Viewer: 17 Scientific Charts, Spend & Rigor Logs
  console.log('Taking 08-slr-viewer-analytics.png...');
  await safeClick('Scientific Rigor');
  await page.screenshot({ path: path.join(ssDir, '08-slr-viewer-analytics.png') });

  console.log('Done capturing all 8 screenshots!');
  await browser.close();
}

capture().catch(err => {
  console.error('Fatal error capturing screenshots:', err);
  process.exit(1);
});
