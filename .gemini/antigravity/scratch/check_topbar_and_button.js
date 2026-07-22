const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const scratchDir = 'C:\\Users\\Aditya Suranata\\.gemini\\antigravity\\brain\\55cb9109-4fc2-4443-8724-043635763aed\\scratch\\';

  console.log("Navigating to http://localhost:3000...");
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

  // 1. Screenshot Dashboard
  await page.screenshot({ path: scratchDir + 'dashboard_v2.png' });
  console.log("Saved dashboard_v2.png");

  // Get active project name from dashboard card for verification reference
  const projectCardName = await page.evaluate(() => {
    const header = document.querySelector('h4');
    return header ? header.textContent.trim() : null;
  });
  console.log(`Active project name shown on Dashboard: "${projectCardName}"`);

  // 2. Click Paper Database Sidebar Tab
  console.log("Clicking Paper Database sidebar button...");
  const sidebarButtons = await page.$$('aside nav button');
  let dbClicked = false;
  for (const btn of sidebarButtons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text && text.includes('Paper Database')) {
      await btn.click();
      dbClicked = true;
      break;
    }
  }

  if (!dbClicked) {
    console.error("Could not find Paper Database sidebar button!");
    process.exit(1);
  }

  await new Promise(r => setTimeout(r, 1500));

  // 3. Verify Header and Pipeline in Paper Database
  const paperDbHeaderText = await page.evaluate(() => {
    const h2 = document.querySelector('header h2');
    return h2 ? h2.textContent.trim() : null;
  });
  console.log(`Paper Database Header Title text: "${paperDbHeaderText}"`);

  const hasPipelineControls = await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll('header label'));
    return labels.some(l => l.textContent.includes('Match Cache')) &&
           labels.some(l => l.textContent.includes('Scrape PDFs')) &&
           document.querySelector('header button').textContent.includes('Execute Pipeline');
  });
  console.log(`Pipeline controls exist in Paper Database header: ${hasPipelineControls}`);

  await page.screenshot({ path: scratchDir + 'paper_database_v2.png' });
  console.log("Saved paper_database_v2.png");

  // 4. Click Ingestion Hub Button
  console.log("Clicking Ingestion Hub button...");
  const actionButtons = await page.$$('button');
  let ingestClicked = false;
  for (const btn of actionButtons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text && text.includes('Ingestion Hub')) {
      await btn.click();
      ingestClicked = true;
      break;
    }
  }

  if (!ingestClicked) {
    console.error("Could not find Ingestion Hub button in Paper Database view!");
    process.exit(1);
  }

  await new Promise(r => setTimeout(r, 1500));

  // 5. Verify Ingestion Hub View Rendered
  const ingestionHubTitleText = await page.evaluate(() => {
    const h3 = document.querySelector('h3');
    return h3 ? h3.textContent.trim() : null;
  });
  console.log(`Ingestion Hub View Title text: "${ingestionHubTitleText}"`);

  const hasBulkCsvIngest = await page.evaluate(() => {
    const h4 = document.querySelector('h4');
    return h4 ? h4.textContent.includes('Bulk CSV Ingest') : false;
  });
  console.log(`Bulk CSV Ingest panel is visible: ${hasBulkCsvIngest}`);

  await page.screenshot({ path: scratchDir + 'ingestion_hub_v2.png' });
  console.log("Saved ingestion_hub_v2.png");

  // 6. Click Pre-Calibration Sidebar Tab
  console.log("Clicking Pre-Calibration sidebar button...");
  const navButtons = await page.$$('aside nav button');
  let calClicked = false;
  for (const btn of navButtons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text && text.includes('Pre-Calibration')) {
      await btn.click();
      calClicked = true;
      break;
    }
  }

  if (!calClicked) {
    console.error("Could not find Pre-Calibration sidebar button!");
    process.exit(1);
  }

  await new Promise(r => setTimeout(r, 1500));

  // 7. Verify Header in Pre-Calibration
  const calHeaderText = await page.evaluate(() => {
    const h2 = document.querySelector('header h2');
    return h2 ? h2.textContent.trim() : null;
  });
  console.log(`Pre-Calibration Header Title text: "${calHeaderText}"`);

  await page.screenshot({ path: scratchDir + 'pre_calibration_v2.png' });
  console.log("Saved pre_calibration_v2.png");

  await browser.close();

  // Summary validations
  if (paperDbHeaderText && paperDbHeaderText.includes(projectCardName) &&
      calHeaderText && calHeaderText.includes(projectCardName) &&
      hasPipelineControls &&
      ingestionHubTitleText === 'Ingestion Hub' &&
      hasBulkCsvIngest) {
    console.log("ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!");
  } else {
    console.error("SOME VERIFICATION CHECKS FAILED!");
    process.exit(1);
  }
})();
